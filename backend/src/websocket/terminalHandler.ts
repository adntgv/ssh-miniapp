import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { validateWebSocketAuth } from '../middleware/telegramAuth';
import {
  getCredentialById,
  getUserByTelegramId,
  getSession,
  saveSession,
  deleteSession,
  updateSessionActivity,
  MoshSessionData,
  TmuxSessionData,
} from '../db/sqlite';
import { decryptCredentials } from '../services/encryptionService';
import { createPersistentSSHSession, SSHSession } from '../services/sshService';
import { createOrReuseMoshSession, MoshSession } from '../services/moshService';
import {
  WSMessage,
  WSConnectMessage,
  WSInputMessage,
  WSResizeMessage,
  TelegramUser,
  DbUser,
} from '../types';

interface ActiveSession {
  session: SSHSession | MoshSession;
  type: 'ssh' | 'mosh';
}

// Store active sessions per WebSocket connection
const activeSessions = new Map<WebSocket, ActiveSession>();

/**
 * Send a message to WebSocket client
 */
function sendMessage(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(
  ws: WebSocket,
  message: WSMessage,
  user: TelegramUser,
  dbUser: DbUser
): Promise<void> {
  switch (message.type) {
    case 'connect':
      await handleConnect(ws, message as WSConnectMessage, user, dbUser);
      break;

    case 'input':
      handleInput(ws, message as WSInputMessage);
      break;

    case 'resize':
      handleResize(ws, message as WSResizeMessage);
      break;

    case 'disconnect':
      handleDisconnect(ws);
      break;

    default:
      sendMessage(ws, {
        type: 'error',
        error: `Unknown message type: ${message.type}`,
      });
  }
}

/**
 * Handle connect message - establish SSH or Mosh session with persistence
 */
async function handleConnect(
  ws: WebSocket,
  message: WSConnectMessage,
  user: TelegramUser,
  dbUser: DbUser
): Promise<void> {
  // Close existing WebSocket session if any (but don't destroy remote session)
  const existingSession = activeSessions.get(ws);
  if (existingSession) {
    // Just remove from map, don't call close() which would kill the remote session
    activeSessions.delete(ws);
  }

  const { connectionId } = message;

  if (!connectionId) {
    sendMessage(ws, { type: 'error', error: 'connectionId is required' });
    return;
  }

  // Get credential from database
  const credential = getCredentialById(connectionId, dbUser.id);
  if (!credential) {
    sendMessage(ws, { type: 'error', error: 'Connection not found' });
    return;
  }

  try {
    // Decrypt credentials
    const decrypted = decryptCredentials(
      dbUser.id,
      credential.host_encrypted,
      credential.port_encrypted,
      credential.username_encrypted,
      credential.auth_data_encrypted
    );

    const connectionOptions = {
      host: decrypted.host,
      port: decrypted.port,
      username: decrypted.username,
      authType: credential.auth_type,
      authData: decrypted.authData,
    };

    let session: SSHSession | MoshSession;
    let sessionType: 'ssh' | 'mosh';

    // Check for existing persistent session
    const existingDbSession = getSession(dbUser.id, connectionId);
    const cols = message.cols || 80;
    const rows = message.rows || 24;

    if (credential.use_mosh) {
      // Try Mosh first, fall back to SSH+tmux if it fails
      console.log(`Attempting Mosh session for user ${user.id} to ${decrypted.host}`);

      let existingMoshData: MoshSessionData | undefined;
      if (existingDbSession && existingDbSession.session_type === 'mosh') {
        try {
          existingMoshData = JSON.parse(existingDbSession.session_data) as MoshSessionData;
        } catch {
          console.log('Failed to parse existing mosh session data');
        }
      }

      try {
        const result = await createOrReuseMoshSession(
          connectionOptions,
          cols,
          rows,
          existingMoshData
        );

        session = result.session;
        sessionType = 'mosh';

        // Save session data if new or updated
        if (!result.isReused || !existingDbSession) {
          saveSession(dbUser.id, connectionId, 'mosh', result.sessionData);
          console.log(`Saved new mosh session data for user ${user.id}`);
        } else {
          updateSessionActivity(dbUser.id, connectionId);
          console.log(`Reused existing mosh session for user ${user.id}`);
        }
      } catch (moshError) {
        // Mosh failed - fall back to SSH+tmux
        console.log(`Mosh failed: ${(moshError as Error).message}, falling back to SSH+tmux`);

        // Clear any stale mosh session data
        deleteSession(dbUser.id, connectionId);

        // Fall through to SSH+tmux
        const tmuxSessionName = `ssh_${dbUser.id}_${connectionId}`;
        const result = await createPersistentSSHSession(
          connectionOptions,
          tmuxSessionName,
          cols,
          rows
        );

        session = result.session;
        sessionType = 'ssh';
        saveSession(dbUser.id, connectionId, 'tmux', result.sessionData);

        // Notify user about fallback
        sendMessage(ws, {
          type: 'output',
          data: '\r\n\x1b[33m[Mosh unavailable - using SSH with persistent tmux session]\x1b[0m\r\n'
        });

        console.log(`Fell back to SSH+tmux session '${tmuxSessionName}' for user ${user.id}`);
      }
    } else {
      // Create persistent SSH session with tmux
      console.log(`Creating/resuming SSH+tmux session for user ${user.id} to ${decrypted.host}`);

      // Generate unique tmux session name
      const tmuxSessionName = `ssh_${dbUser.id}_${connectionId}`;

      const result = await createPersistentSSHSession(
        connectionOptions,
        tmuxSessionName,
        cols,
        rows
      );

      session = result.session;
      sessionType = 'ssh';

      // Save or update session data
      saveSession(dbUser.id, connectionId, 'tmux', result.sessionData);
      if (result.isReused) {
        console.log(`Resumed existing tmux session '${tmuxSessionName}' for user ${user.id}`);
      } else {
        console.log(`Created new tmux session '${tmuxSessionName}' for user ${user.id}`);
      }
    }

    // Store active session
    activeSessions.set(ws, { session, type: sessionType });

    // Forward terminal output to WebSocket
    session.on('data', (data: string) => {
      sendMessage(ws, { type: 'output', data });
    });

    session.on('close', () => {
      sendMessage(ws, { type: 'disconnect' });
      activeSessions.delete(ws);
      // Note: We don't delete the DB session here - it persists for reconnection
    });

    session.on('error', (err: Error) => {
      sendMessage(ws, { type: 'error', error: err.message });
      // On error, delete the session data as it's likely stale
      deleteSession(dbUser.id, connectionId);
    });

    // Send connected message
    sendMessage(ws, { type: 'connected' });

    // Apply initial resize if provided
    if (message.cols && message.rows) {
      session.resize(message.cols, message.rows);
    }
  } catch (err) {
    const error = err as Error;
    console.error('Failed to create session:', error.message);
    // Clean up any stale session data on connection failure
    deleteSession(dbUser.id, connectionId);
    sendMessage(ws, {
      type: 'error',
      error: `Connection failed: ${error.message}`,
    });
  }
}

/**
 * Handle input message - send data to terminal
 */
function handleInput(ws: WebSocket, message: WSInputMessage): void {
  const activeSession = activeSessions.get(ws);
  if (!activeSession) {
    sendMessage(ws, { type: 'error', error: 'No active session' });
    return;
  }

  if (message.data) {
    activeSession.session.write(message.data);
  }
}

/**
 * Handle resize message - resize terminal window
 */
function handleResize(ws: WebSocket, message: WSResizeMessage): void {
  const activeSession = activeSessions.get(ws);
  if (!activeSession) {
    return; // Silently ignore resize for non-existent session
  }

  if (message.cols && message.rows) {
    activeSession.session.resize(message.cols, message.rows);
  }
}

/**
 * Handle disconnect message - detach from terminal session (session persists)
 */
function handleDisconnect(ws: WebSocket): void {
  const activeSession = activeSessions.get(ws);
  if (activeSession) {
    // For SSH/tmux sessions, close() detaches from tmux (session persists on remote)
    // For Mosh sessions, close() kills mosh-client but mosh-server persists on remote
    activeSession.session.close();
    activeSessions.delete(ws);
  }
}

/**
 * Set up WebSocket server handler
 */
export function setupWebSocketHandler(wss: WebSocket.Server): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log('WebSocket connection attempt');

    // Extract initData from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const initData = url.searchParams.get('initData');

    if (!initData) {
      ws.close(4001, 'Missing initData');
      return;
    }

    // Validate initData
    const telegramUser = validateWebSocketAuth(initData);
    if (!telegramUser) {
      ws.close(4002, 'Invalid initData');
      return;
    }

    // Get user from database
    const dbUser = getUserByTelegramId(telegramUser.id);
    if (!dbUser) {
      ws.close(4003, 'User not found');
      return;
    }

    console.log(`WebSocket authenticated for user ${telegramUser.id}`);

    // Handle incoming messages
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await handleMessage(ws, message, telegramUser, dbUser);
      } catch (err) {
        const error = err as Error;
        console.error('Error handling WebSocket message:', error.message);
        sendMessage(ws, { type: 'error', error: 'Invalid message format' });
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      console.log(`WebSocket closed for user ${telegramUser.id}`);
      handleDisconnect(ws);
    });

    // Handle WebSocket error
    ws.on('error', (err: Error) => {
      console.error('WebSocket error:', err.message);
      handleDisconnect(ws);
    });
  });
}

/**
 * Get count of active sessions
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}
