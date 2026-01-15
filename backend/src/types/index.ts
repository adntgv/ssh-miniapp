// Telegram WebApp InitData types
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  [key: string]: unknown;
}

// Database models
export interface DbUser {
  id: number;
  telegram_user_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCredential {
  id: number;
  user_id: number;
  name: string;
  host_encrypted: string;
  port_encrypted: string;
  username_encrypted: string;
  auth_type: 'password' | 'key';
  auth_data_encrypted: string;
  use_mosh: number;
  created_at: string;
  updated_at: string;
}

// API types
export interface ConnectionConfig {
  id?: number;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  authData: string; // password or private key
  useMosh: boolean;
}

export interface EncryptedData {
  iv: string;
  authTag: string;
  encrypted: string;
}

// WebSocket message types
export type WSMessageType = 'connect' | 'input' | 'resize' | 'output' | 'disconnect' | 'error' | 'connected';

export interface WSMessage {
  type: WSMessageType;
  connectionId?: number;
  data?: string;
  cols?: number;
  rows?: number;
  error?: string;
}

export interface WSConnectMessage extends WSMessage {
  type: 'connect';
  connectionId: number;
}

export interface WSInputMessage extends WSMessage {
  type: 'input';
  data: string;
}

export interface WSResizeMessage extends WSMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export interface WSOutputMessage extends WSMessage {
  type: 'output';
  data: string;
}

export interface WSDisconnectMessage extends WSMessage {
  type: 'disconnect';
}

export interface WSErrorMessage extends WSMessage {
  type: 'error';
  error: string;
}

export interface WSConnectedMessage extends WSMessage {
  type: 'connected';
}

// Express request extensions
declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
      dbUser?: DbUser;
    }
  }
}

// SSH/Mosh session types
export interface TerminalSession {
  userId: number;
  connectionId: number;
  type: 'ssh' | 'mosh';
  close: () => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
}

export interface MoshServerInfo {
  port: number;
  key: string;
}
