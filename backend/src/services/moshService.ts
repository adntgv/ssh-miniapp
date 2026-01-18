import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import { executeSSHCommand, SSHConnectionOptions } from './sshService';
import { MoshServerInfo } from '../types';
import { MoshSessionData } from '../db/sqlite';

export interface MoshSession extends EventEmitter {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

export interface MoshSessionResult {
  session: MoshSession;
  sessionData: MoshSessionData;
  isReused: boolean;
}

/**
 * Parse mosh-server output to extract connection info
 * mosh-server output format: "MOSH CONNECT <port> <key>"
 */
export function parseMoshServerOutput(output: string): MoshServerInfo | null {
  // Look for the MOSH CONNECT line
  const match = output.match(/MOSH CONNECT (\d+) ([A-Za-z0-9+/=]+)/);
  if (!match) {
    console.error('Failed to parse mosh-server output:', output);
    return null;
  }

  return {
    port: parseInt(match[1], 10),
    key: match[2],
  };
}

/**
 * Start mosh-server on remote host via SSH
 */
export async function startMoshServer(options: SSHConnectionOptions): Promise<MoshServerInfo> {
  // Start mosh-server on the remote host
  // The -s flag makes it print connection info to stdout
  const command = 'mosh-server new -s -c 256 -l LANG=en_US.UTF-8';

  console.log(`Starting mosh-server on ${options.host}:${options.port}`);

  const output = await executeSSHCommand(options, command);

  const serverInfo = parseMoshServerOutput(output);
  if (!serverInfo) {
    throw new Error('Failed to parse mosh-server connection info');
  }

  console.log(`Mosh server started on port ${serverInfo.port}`);
  return serverInfo;
}

/**
 * Create a Mosh session by:
 * 1. SSH to remote to start mosh-server
 * 2. Spawn local mosh-client with the connection info
 */
export async function createMoshSession(
  options: SSHConnectionOptions,
  initialCols: number = 80,
  initialRows: number = 24
): Promise<MoshSession> {
  // Start mosh-server on remote
  const serverInfo = await startMoshServer(options);

  // Create session event emitter
  const session = new EventEmitter() as MoshSession;

  // Spawn local mosh-client with MOSH_KEY environment variable
  const env = {
    ...process.env,
    MOSH_KEY: serverInfo.key,
    TERM: 'xterm-256color',
  };

  // mosh-client connects to the specified host:port using the key from MOSH_KEY
  const moshClientArgs = [
    options.host,
    serverInfo.port.toString(),
  ];

  console.log(`Spawning mosh-client to ${options.host}:${serverInfo.port}`);

  let ptyProcess: pty.IPty;

  try {
    ptyProcess = pty.spawn('mosh-client', moshClientArgs, {
      name: 'xterm-256color',
      cols: initialCols,
      rows: initialRows,
      cwd: process.env.HOME,
      env: env as { [key: string]: string },
    });
  } catch (err) {
    throw new Error(`Failed to spawn mosh-client: ${(err as Error).message}`);
  }

  // Forward data from mosh-client to session
  ptyProcess.onData((data: string) => {
    session.emit('data', data);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Mosh client exited with code ${exitCode}, signal ${signal}`);
    session.emit('close');
  });

  // Implement session methods
  session.write = (data: string) => {
    ptyProcess.write(data);
  };

  session.resize = (cols: number, rows: number) => {
    ptyProcess.resize(cols, rows);
  };

  session.close = () => {
    ptyProcess.kill();
  };

  return session;
}

/**
 * Connect mosh-client to an existing mosh-server
 * Returns null if connection fails (server likely dead)
 */
function connectToMoshServer(
  host: string,
  serverInfo: MoshServerInfo,
  cols: number,
  rows: number
): Promise<MoshSession | null> {
  return new Promise((resolve) => {
    const session = new EventEmitter() as MoshSession;

    const env = {
      ...process.env,
      MOSH_KEY: serverInfo.key,
      TERM: 'xterm-256color',
    };

    const moshClientArgs = [host, serverInfo.port.toString()];

    console.log(`Attempting to reconnect mosh-client to ${host}:${serverInfo.port}`);

    let ptyProcess: pty.IPty;
    let connectionFailed = false;
    let hasReceivedData = false;

    try {
      ptyProcess = pty.spawn('mosh-client', moshClientArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.env.HOME,
        env: env as { [key: string]: string },
      });
    } catch (err) {
      console.error('Failed to spawn mosh-client:', (err as Error).message);
      resolve(null);
      return;
    }

    // Set a timeout for connection - if no data within 5 seconds, assume failed
    const connectionTimeout = setTimeout(() => {
      if (!hasReceivedData) {
        console.log('Mosh reconnection timeout - no data received');
        connectionFailed = true;
        ptyProcess.kill();
        resolve(null);
      }
    }, 5000);

    ptyProcess.onData((data: string) => {
      hasReceivedData = true;
      clearTimeout(connectionTimeout);
      session.emit('data', data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      clearTimeout(connectionTimeout);
      console.log(`Mosh client exited with code ${exitCode}, signal ${signal}`);
      if (!hasReceivedData && !connectionFailed) {
        // Exited without receiving data - connection failed
        resolve(null);
      } else {
        session.emit('close');
      }
    });

    session.write = (data: string) => {
      ptyProcess.write(data);
    };

    session.resize = (cols: number, rows: number) => {
      ptyProcess.resize(cols, rows);
    };

    session.close = () => {
      clearTimeout(connectionTimeout);
      ptyProcess.kill();
    };

    // If we got data, resolve with the session after a short delay
    // to ensure connection is stable
    const checkInterval = setInterval(() => {
      if (hasReceivedData) {
        clearInterval(checkInterval);
        clearTimeout(connectionTimeout);
        resolve(session);
      }
    }, 100);

    // Clean up interval after timeout
    setTimeout(() => clearInterval(checkInterval), 5500);
  });
}

/**
 * Create or reuse a Mosh session
 * If existingSessionData is provided, tries to reconnect first
 */
export async function createOrReuseMoshSession(
  options: SSHConnectionOptions,
  initialCols: number = 80,
  initialRows: number = 24,
  existingSessionData?: MoshSessionData
): Promise<MoshSessionResult> {
  // Try to reconnect to existing session first
  if (existingSessionData) {
    console.log(`Attempting to reuse existing mosh session on port ${existingSessionData.port}`);
    const session = await connectToMoshServer(
      existingSessionData.host,
      { port: existingSessionData.port, key: existingSessionData.key },
      initialCols,
      initialRows
    );

    if (session) {
      console.log('Successfully reconnected to existing mosh session');
      return {
        session,
        sessionData: existingSessionData,
        isReused: true,
      };
    }
    console.log('Failed to reconnect, starting new mosh session');
  }

  // Start new mosh-server on remote, then connect
  const serverInfo = await startMoshServer(options);
  const newSession = await createMoshSessionInternal(options, serverInfo, initialCols, initialRows);

  return {
    session: newSession,
    sessionData: {
      host: options.host,
      port: serverInfo.port,
      key: serverInfo.key,
    },
    isReused: false,
  };
}

/**
 * Internal function to create mosh session with known server info
 */
async function createMoshSessionInternal(
  options: SSHConnectionOptions,
  serverInfo: MoshServerInfo,
  cols: number,
  rows: number
): Promise<MoshSession> {
  const session = new EventEmitter() as MoshSession;

  const env = {
    ...process.env,
    MOSH_KEY: serverInfo.key,
    TERM: 'xterm-256color',
  };

  const moshClientArgs = [options.host, serverInfo.port.toString()];

  console.log(`Spawning mosh-client to ${options.host}:${serverInfo.port}`);

  let ptyProcess: pty.IPty;

  try {
    ptyProcess = pty.spawn('mosh-client', moshClientArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      env: env as { [key: string]: string },
    });
  } catch (err) {
    throw new Error(`Failed to spawn mosh-client: ${(err as Error).message}`);
  }

  ptyProcess.onData((data: string) => {
    session.emit('data', data);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Mosh client exited with code ${exitCode}, signal ${signal}`);
    session.emit('close');
  });

  session.write = (data: string) => {
    ptyProcess.write(data);
  };

  session.resize = (cols: number, rows: number) => {
    ptyProcess.resize(cols, rows);
  };

  session.close = () => {
    ptyProcess.kill();
  };

  return session;
}

/**
 * Check if mosh-client is available on the system
 */
export async function checkMoshClientAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const checkPty = pty.spawn('which', ['mosh-client'], {
      name: 'xterm',
      cols: 80,
      rows: 24,
    });

    let output = '';

    checkPty.onData((data: string) => {
      output += data;
    });

    checkPty.onExit(({ exitCode }) => {
      resolve(exitCode === 0 && output.trim().length > 0);
    });
  });
}
