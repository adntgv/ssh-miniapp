import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { validateWebSocketAuth } from '../middleware/telegramAuth';
import { getCredentialById, getUserByTelegramId } from '../db/sqlite';
import { decryptCredentials } from '../services/encryptionService';
import { createSSHSession, SSHSession } from '../services/sshService';
import { createMoshSession, MoshSession } from '../services/moshService';
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
 * Handle connect message - establish SSH or Mosh session
 */
async function handleConnect(
  ws: WebSocket,
  message: WSConnectMessage,
  user: TelegramUser,
  dbUser: DbUser
): Promise<void> {
  // Close existing session if any
  handleDisconnect(ws);

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

    if (credential.use_mosh) {
      // Create Mosh session
      console.log(`Creating Mosh session for user ${user.id} to ${decrypted.host}`);
      session = await createMoshSession(
        connectionOptions,
        message.cols || 80,
        message.rows || 24
      );
      sessionType = 'mosh';
    } else {
      // Create SSH session
      console.log(`Creating SSH session for user ${user.id} to ${decrypted.host}`);
      session = await createSSHSession(connectionOptions);
      sessionType = 'ssh';
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
    });

    session.on('error', (err: Error) => {
      sendMessage(ws, { type: 'error', error: err.message });
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
 * Handle disconnect message - close terminal session
 */
function handleDisconnect(ws: WebSocket): void {
  const activeSession = activeSessions.get(ws);
  if (activeSession) {
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
