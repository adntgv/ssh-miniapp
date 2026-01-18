import { Client, ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
import { TmuxSessionData } from '../db/sqlite';

export interface SSHConnectionOptions {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  authData: string; // password or private key
}

export interface SSHSession extends EventEmitter {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

export interface SSHSessionResult {
  session: SSHSession;
  sessionData: TmuxSessionData;
  isReused: boolean;
}

/**
 * Create an SSH connection and return a session for terminal I/O
 */
export function createSSHSession(options: SSHConnectionOptions): Promise<SSHSession> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const session = new EventEmitter() as SSHSession;
    let stream: ClientChannel | null = null;

    // Set up connection options
    const connectConfig: any = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
    };

    if (options.authType === 'password') {
      connectConfig.password = options.authData;
    } else {
      connectConfig.privateKey = options.authData;
    }

    client.on('ready', () => {
      console.log(`SSH connection established to ${options.host}:${options.port}`);

      client.shell(
        {
          term: 'xterm-256color',
          cols: 80,
          rows: 24,
        },
        (err, shellStream) => {
          if (err) {
            client.end();
            reject(new Error(`Failed to start shell: ${err.message}`));
            return;
          }

          stream = shellStream;

          // Forward data from SSH to session
          stream.on('data', (data: Buffer) => {
            session.emit('data', data.toString('utf8'));
          });

          stream.stderr.on('data', (data: Buffer) => {
            session.emit('data', data.toString('utf8'));
          });

          stream.on('close', () => {
            session.emit('close');
            client.end();
          });

          // Implement session methods
          session.write = (data: string) => {
            if (stream && stream.writable) {
              stream.write(data);
            }
          };

          session.resize = (cols: number, rows: number) => {
            if (stream) {
              stream.setWindow(rows, cols, 0, 0);
            }
          };

          session.close = () => {
            if (stream) {
              stream.end();
            }
            client.end();
          };

          resolve(session);
        }
      );
    });

    client.on('error', (err) => {
      console.error('SSH connection error:', err.message);
      session.emit('error', err);
      reject(err);
    });

    client.on('close', () => {
      session.emit('close');
    });

    // Connect
    try {
      client.connect(connectConfig);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Create a persistent SSH session using tmux
 * This allows the session to persist even when the client disconnects
 */
export function createPersistentSSHSession(
  options: SSHConnectionOptions,
  sessionName: string,
  cols: number = 80,
  rows: number = 24
): Promise<SSHSessionResult> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const session = new EventEmitter() as SSHSession;
    let stream: ClientChannel | null = null;

    const connectConfig: any = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
    };

    if (options.authType === 'password') {
      connectConfig.password = options.authData;
    } else {
      connectConfig.privateKey = options.authData;
    }

    client.on('ready', () => {
      console.log(`SSH connection established to ${options.host}:${options.port}`);

      // First, check if tmux session exists
      client.exec(`tmux has-session -t '${sessionName}' 2>/dev/null && echo EXISTS || echo NEW`, (err, checkStream) => {
        if (err) {
          client.end();
          reject(new Error(`Failed to check tmux session: ${err.message}`));
          return;
        }

        let checkOutput = '';
        checkStream.on('data', (data: Buffer) => {
          checkOutput += data.toString('utf8');
        });

        checkStream.on('close', () => {
          const sessionExists = checkOutput.trim() === 'EXISTS';
          console.log(`Tmux session '${sessionName}' ${sessionExists ? 'exists, attaching' : 'not found, creating'}`);

          // Build the tmux command
          const tmuxCmd = sessionExists
            ? `tmux attach-session -t '${sessionName}'`
            : `tmux new-session -s '${sessionName}'`;

          client.shell(
            {
              term: 'xterm-256color',
              cols,
              rows,
            },
            (shellErr, shellStream) => {
              if (shellErr) {
                client.end();
                reject(new Error(`Failed to start shell: ${shellErr.message}`));
                return;
              }

              stream = shellStream;

              // Forward data from SSH to session
              stream.on('data', (data: Buffer) => {
                session.emit('data', data.toString('utf8'));
              });

              stream.stderr.on('data', (data: Buffer) => {
                session.emit('data', data.toString('utf8'));
              });

              stream.on('close', () => {
                session.emit('close');
                client.end();
              });

              // Implement session methods
              session.write = (data: string) => {
                if (stream && stream.writable) {
                  stream.write(data);
                }
              };

              session.resize = (cols: number, rows: number) => {
                if (stream) {
                  stream.setWindow(rows, cols, 0, 0);
                }
              };

              session.close = () => {
                // Detach from tmux instead of killing it, so session persists
                if (stream && stream.writable) {
                  // Send Ctrl+B, D to detach from tmux (default prefix + d)
                  // Using escape sequence to detach
                  stream.write('\x02d'); // Ctrl+B followed by 'd'
                }
                setTimeout(() => {
                  if (stream) {
                    stream.end();
                  }
                  client.end();
                }, 100);
              };

              // Send the tmux command to attach/create session
              stream.write(tmuxCmd + '\n');

              resolve({
                session,
                sessionData: { sessionName },
                isReused: sessionExists,
              });
            }
          );
        });
      });
    });

    client.on('error', (err) => {
      console.error('SSH connection error:', err.message);
      session.emit('error', err);
      reject(err);
    });

    client.on('close', () => {
      session.emit('close');
    });

    try {
      client.connect(connectConfig);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Execute a single command via SSH and return the output
 * Used for starting mosh-server on remote host
 */
export function executeSSHCommand(
  options: SSHConnectionOptions,
  command: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let output = '';
    let errorOutput = '';

    const connectConfig: any = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 30000,
    };

    if (options.authType === 'password') {
      connectConfig.password = options.authData;
    } else {
      connectConfig.privateKey = options.authData;
    }

    client.on('ready', () => {
      client.exec(command, (err, stream) => {
        if (err) {
          client.end();
          reject(new Error(`Failed to execute command: ${err.message}`));
          return;
        }

        stream.on('data', (data: Buffer) => {
          output += data.toString('utf8');
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString('utf8');
        });

        stream.on('close', (code: number) => {
          client.end();
          if (code === 0 || output.includes('MOSH CONNECT')) {
            resolve(output);
          } else {
            reject(new Error(`Command failed with code ${code}: ${errorOutput || output}`));
          }
        });
      });
    });

    client.on('error', (err) => {
      reject(err);
    });

    client.connect(connectConfig);
  });
}
