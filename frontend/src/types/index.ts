export type ConnectionType = 'ssh' | 'mosh';

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  type: ConnectionType;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionFormData {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  type: ConnectionType;
}

export interface ConnectionCredentials {
  connectionId: string;
  password?: string;
  privateKey?: string;
}

export interface TerminalSession {
  sessionId: string;
  connectionId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WebSocketMessage {
  type: 'input' | 'output' | 'resize' | 'error' | 'connected' | 'disconnected';
  data?: string;
  cols?: number;
  rows?: number;
  error?: string;
}
