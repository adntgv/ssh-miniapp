import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { DbUser, DbCredential, TelegramUser } from '../types';

let db: Database.Database;

/**
 * Initialize the SQLite database
 */
export function initDatabase(): Database.Database {
  // Ensure database directory exists
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.databasePath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      host_encrypted TEXT NOT NULL,
      port_encrypted TEXT NOT NULL,
      username_encrypted TEXT NOT NULL,
      auth_type TEXT NOT NULL CHECK (auth_type IN ('password', 'key')),
      auth_data_encrypted TEXT NOT NULL,
      use_mosh INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      credential_id INTEGER NOT NULL,
      session_type TEXT NOT NULL CHECK (session_type IN ('mosh', 'tmux')),
      session_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_activity TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE CASCADE,
      UNIQUE(user_id, credential_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_credential ON sessions(user_id, credential_id);
  `);

  console.log('Database initialized at:', config.databasePath);
  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Get or create a user from Telegram data
 */
export function getOrCreateUser(telegramUser: TelegramUser): DbUser {
  const db = getDatabase();

  // Try to find existing user
  const existingUser = db.prepare(`
    SELECT * FROM users WHERE telegram_user_id = ?
  `).get(telegramUser.id) as DbUser | undefined;

  if (existingUser) {
    // Update user info if changed
    db.prepare(`
      UPDATE users
      SET username = ?, first_name = ?, last_name = ?, updated_at = datetime('now')
      WHERE telegram_user_id = ?
    `).run(
      telegramUser.username || null,
      telegramUser.first_name,
      telegramUser.last_name || null,
      telegramUser.id
    );

    return db.prepare(`
      SELECT * FROM users WHERE telegram_user_id = ?
    `).get(telegramUser.id) as DbUser;
  }

  // Create new user
  const result = db.prepare(`
    INSERT INTO users (telegram_user_id, username, first_name, last_name)
    VALUES (?, ?, ?, ?)
  `).run(
    telegramUser.id,
    telegramUser.username || null,
    telegramUser.first_name,
    telegramUser.last_name || null
  );

  return db.prepare(`
    SELECT * FROM users WHERE id = ?
  `).get(result.lastInsertRowid) as DbUser;
}

/**
 * Get user by Telegram user ID
 */
export function getUserByTelegramId(telegramUserId: number): DbUser | undefined {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM users WHERE telegram_user_id = ?
  `).get(telegramUserId) as DbUser | undefined;
}

/**
 * Create a new credential
 */
export function createCredential(
  userId: number,
  name: string,
  hostEncrypted: string,
  portEncrypted: string,
  usernameEncrypted: string,
  authType: 'password' | 'key',
  authDataEncrypted: string,
  useMosh: boolean
): DbCredential {
  const db = getDatabase();

  const result = db.prepare(`
    INSERT INTO credentials (
      user_id, name, host_encrypted, port_encrypted,
      username_encrypted, auth_type, auth_data_encrypted, use_mosh
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    name,
    hostEncrypted,
    portEncrypted,
    usernameEncrypted,
    authType,
    authDataEncrypted,
    useMosh ? 1 : 0
  );

  return db.prepare(`
    SELECT * FROM credentials WHERE id = ?
  `).get(result.lastInsertRowid) as DbCredential;
}

/**
 * Get all credentials for a user
 */
export function getCredentialsByUserId(userId: number): DbCredential[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM credentials WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as DbCredential[];
}

/**
 * Get a credential by ID (with user ownership check)
 */
export function getCredentialById(credentialId: number, userId: number): DbCredential | undefined {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM credentials WHERE id = ? AND user_id = ?
  `).get(credentialId, userId) as DbCredential | undefined;
}

/**
 * Update a credential
 */
export function updateCredential(
  credentialId: number,
  userId: number,
  updates: {
    name?: string;
    hostEncrypted?: string;
    portEncrypted?: string;
    usernameEncrypted?: string;
    authType?: 'password' | 'key';
    authDataEncrypted?: string;
    useMosh?: boolean;
  }
): DbCredential | undefined {
  const db = getDatabase();

  // First check ownership
  const existing = getCredentialById(credentialId, userId);
  if (!existing) {
    return undefined;
  }

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.hostEncrypted !== undefined) {
    fields.push('host_encrypted = ?');
    values.push(updates.hostEncrypted);
  }
  if (updates.portEncrypted !== undefined) {
    fields.push('port_encrypted = ?');
    values.push(updates.portEncrypted);
  }
  if (updates.usernameEncrypted !== undefined) {
    fields.push('username_encrypted = ?');
    values.push(updates.usernameEncrypted);
  }
  if (updates.authType !== undefined) {
    fields.push('auth_type = ?');
    values.push(updates.authType);
  }
  if (updates.authDataEncrypted !== undefined) {
    fields.push('auth_data_encrypted = ?');
    values.push(updates.authDataEncrypted);
  }
  if (updates.useMosh !== undefined) {
    fields.push('use_mosh = ?');
    values.push(updates.useMosh ? 1 : 0);
  }

  if (fields.length === 0) {
    return existing;
  }

  fields.push("updated_at = datetime('now')");

  db.prepare(`
    UPDATE credentials SET ${fields.join(', ')} WHERE id = ? AND user_id = ?
  `).run(...values, credentialId, userId);

  return getCredentialById(credentialId, userId);
}

/**
 * Delete a credential
 */
export function deleteCredential(credentialId: number, userId: number): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM credentials WHERE id = ? AND user_id = ?
  `).run(credentialId, userId);
  return result.changes > 0;
}

/**
 * Session data types
 */
export interface DbSession {
  id: number;
  user_id: number;
  credential_id: number;
  session_type: 'mosh' | 'tmux';
  session_data: string;
  created_at: string;
  last_activity: string;
}

export interface MoshSessionData {
  host: string;
  port: number;
  key: string;
}

export interface TmuxSessionData {
  sessionName: string;
}

/**
 * Get an existing session for a user+credential
 */
export function getSession(userId: number, credentialId: number): DbSession | undefined {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM sessions WHERE user_id = ? AND credential_id = ?
  `).get(userId, credentialId) as DbSession | undefined;
}

/**
 * Save or update a session
 */
export function saveSession(
  userId: number,
  credentialId: number,
  sessionType: 'mosh' | 'tmux',
  sessionData: MoshSessionData | TmuxSessionData
): DbSession {
  const db = getDatabase();
  const dataJson = JSON.stringify(sessionData);

  db.prepare(`
    INSERT INTO sessions (user_id, credential_id, session_type, session_data)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, credential_id) DO UPDATE SET
      session_type = excluded.session_type,
      session_data = excluded.session_data,
      last_activity = datetime('now')
  `).run(userId, credentialId, sessionType, dataJson);

  return getSession(userId, credentialId)!;
}

/**
 * Update session last activity timestamp
 */
export function updateSessionActivity(userId: number, credentialId: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE sessions SET last_activity = datetime('now')
    WHERE user_id = ? AND credential_id = ?
  `).run(userId, credentialId);
}

/**
 * Delete a session
 */
export function deleteSession(userId: number, credentialId: number): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM sessions WHERE user_id = ? AND credential_id = ?
  `).run(userId, credentialId);
  return result.changes > 0;
}

/**
 * Delete stale sessions (older than specified hours)
 */
export function deleteStaleSessionsOlderThan(hours: number): number {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM sessions
    WHERE last_activity < datetime('now', '-' || ? || ' hours')
  `).run(hours);
  return result.changes;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
