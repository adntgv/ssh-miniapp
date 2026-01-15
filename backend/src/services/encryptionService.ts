import crypto from 'crypto';
import { config } from '../config';
import { EncryptedData } from '../types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;

/**
 * Derive a per-user encryption key using PBKDF2
 * Key is derived from: PBKDF2(masterKey, SHA256(botToken + oderId))
 */
export function deriveUserKey(userId: number): Buffer {
  // Create salt from SHA256(botToken + oderId)
  // Note: Using "oderId" as specified in requirements (though it seems like "userId" was intended)
  const saltInput = config.botToken + userId.toString();
  const salt = crypto.createHash('sha256').update(saltInput).digest();

  // Derive key using PBKDF2
  const key = crypto.pbkdf2Sync(
    config.masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );

  return key;
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(plaintext: string, userId: number): string {
  const key = deriveUserKey(userId);

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Encrypt data
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + encrypted data as JSON
  const result: EncryptedData = {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encrypted,
  };

  return JSON.stringify(result);
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedJson: string, userId: number): string {
  const key = deriveUserKey(userId);

  // Parse encrypted data
  const { iv, authTag, encrypted }: EncryptedData = JSON.parse(encryptedJson);

  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );

  // Set auth tag
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  // Decrypt data
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt connection credentials
 */
export function encryptCredentials(
  userId: number,
  host: string,
  port: number,
  username: string,
  authData: string
): {
  hostEncrypted: string;
  portEncrypted: string;
  usernameEncrypted: string;
  authDataEncrypted: string;
} {
  return {
    hostEncrypted: encrypt(host, userId),
    portEncrypted: encrypt(port.toString(), userId),
    usernameEncrypted: encrypt(username, userId),
    authDataEncrypted: encrypt(authData, userId),
  };
}

/**
 * Decrypt connection credentials
 */
export function decryptCredentials(
  userId: number,
  hostEncrypted: string,
  portEncrypted: string,
  usernameEncrypted: string,
  authDataEncrypted: string
): {
  host: string;
  port: number;
  username: string;
  authData: string;
} {
  return {
    host: decrypt(hostEncrypted, userId),
    port: parseInt(decrypt(portEncrypted, userId), 10),
    username: decrypt(usernameEncrypted, userId),
    authData: decrypt(authDataEncrypted, userId),
  };
}

/**
 * Generate a random encryption key (for master key generation)
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
