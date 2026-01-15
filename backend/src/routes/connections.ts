import { Router, Request, Response } from 'express';
import {
  createCredential,
  getCredentialsByUserId,
  getCredentialById,
  updateCredential,
  deleteCredential,
} from '../db/sqlite';
import {
  encryptCredentials,
  decryptCredentials,
} from '../services/encryptionService';
import { ConnectionConfig } from '../types';

const router = Router();

/**
 * GET /api/connections
 * List all connections for the authenticated user
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const credentials = getCredentialsByUserId(userId);

    // Return connections without sensitive data
    const connections = credentials.map((cred) => {
      try {
        // Decrypt to get display info
        const decrypted = decryptCredentials(
          userId,
          cred.host_encrypted,
          cred.port_encrypted,
          cred.username_encrypted,
          cred.auth_data_encrypted
        );

        return {
          id: cred.id,
          name: cred.name,
          host: decrypted.host,
          port: decrypted.port,
          username: decrypted.username,
          authType: cred.auth_type,
          useMosh: cred.use_mosh === 1,
          createdAt: cred.created_at,
          updatedAt: cred.updated_at,
        };
      } catch (err) {
        console.error(`Failed to decrypt credential ${cred.id}:`, err);
        return {
          id: cred.id,
          name: cred.name,
          host: '[encrypted]',
          port: 22,
          username: '[encrypted]',
          authType: cred.auth_type,
          useMosh: cred.use_mosh === 1,
          createdAt: cred.created_at,
          updatedAt: cred.updated_at,
          error: 'Decryption failed',
        };
      }
    });

    res.json({ connections });
  } catch (err) {
    console.error('Error listing connections:', err);
    res.status(500).json({ error: 'Failed to list connections' });
  }
});

/**
 * GET /api/connections/:id
 * Get a single connection by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const connectionId = parseInt(req.params.id, 10);

    if (isNaN(connectionId)) {
      res.status(400).json({ error: 'Invalid connection ID' });
      return;
    }

    const credential = getCredentialById(connectionId, userId);
    if (!credential) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const decrypted = decryptCredentials(
      userId,
      credential.host_encrypted,
      credential.port_encrypted,
      credential.username_encrypted,
      credential.auth_data_encrypted
    );

    res.json({
      connection: {
        id: credential.id,
        name: credential.name,
        host: decrypted.host,
        port: decrypted.port,
        username: decrypted.username,
        authType: credential.auth_type,
        useMosh: credential.use_mosh === 1,
        createdAt: credential.created_at,
        updatedAt: credential.updated_at,
      },
    });
  } catch (err) {
    console.error('Error getting connection:', err);
    res.status(500).json({ error: 'Failed to get connection' });
  }
});

/**
 * POST /api/connections
 * Create a new connection
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { name, host, port, username, authType, authData, useMosh } =
      req.body as ConnectionConfig;

    // Validate required fields
    if (!name || !host || !port || !username || !authType || !authData) {
      res.status(400).json({
        error: 'Missing required fields: name, host, port, username, authType, authData',
      });
      return;
    }

    // Validate authType
    if (authType !== 'password' && authType !== 'key') {
      res.status(400).json({ error: 'authType must be "password" or "key"' });
      return;
    }

    // Validate port
    const portNum = parseInt(String(port), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      res.status(400).json({ error: 'Invalid port number' });
      return;
    }

    // Encrypt credentials
    const encrypted = encryptCredentials(userId, host, portNum, username, authData);

    // Create credential
    const credential = createCredential(
      userId,
      name,
      encrypted.hostEncrypted,
      encrypted.portEncrypted,
      encrypted.usernameEncrypted,
      authType,
      encrypted.authDataEncrypted,
      useMosh || false
    );

    res.status(201).json({
      connection: {
        id: credential.id,
        name: credential.name,
        host,
        port: portNum,
        username,
        authType,
        useMosh: credential.use_mosh === 1,
        createdAt: credential.created_at,
        updatedAt: credential.updated_at,
      },
    });
  } catch (err) {
    console.error('Error creating connection:', err);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

/**
 * PUT /api/connections/:id
 * Update an existing connection
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const connectionId = parseInt(req.params.id, 10);

    if (isNaN(connectionId)) {
      res.status(400).json({ error: 'Invalid connection ID' });
      return;
    }

    const { name, host, port, username, authType, authData, useMosh } =
      req.body as Partial<ConnectionConfig>;

    // Build updates object
    const updates: any = {};

    if (name !== undefined) {
      updates.name = name;
    }

    if (useMosh !== undefined) {
      updates.useMosh = useMosh;
    }

    if (authType !== undefined) {
      if (authType !== 'password' && authType !== 'key') {
        res.status(400).json({ error: 'authType must be "password" or "key"' });
        return;
      }
      updates.authType = authType;
    }

    // Handle encrypted fields
    if (host !== undefined) {
      const encrypted = encryptCredentials(userId, host, 22, '', '');
      updates.hostEncrypted = encrypted.hostEncrypted;
    }

    if (port !== undefined) {
      const portNum = parseInt(String(port), 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        res.status(400).json({ error: 'Invalid port number' });
        return;
      }
      const encrypted = encryptCredentials(userId, '', portNum, '', '');
      updates.portEncrypted = encrypted.portEncrypted;
    }

    if (username !== undefined) {
      const encrypted = encryptCredentials(userId, '', 22, username, '');
      updates.usernameEncrypted = encrypted.usernameEncrypted;
    }

    if (authData !== undefined) {
      const encrypted = encryptCredentials(userId, '', 22, '', authData);
      updates.authDataEncrypted = encrypted.authDataEncrypted;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    const updated = updateCredential(connectionId, userId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    // Decrypt for response
    const decrypted = decryptCredentials(
      userId,
      updated.host_encrypted,
      updated.port_encrypted,
      updated.username_encrypted,
      updated.auth_data_encrypted
    );

    res.json({
      connection: {
        id: updated.id,
        name: updated.name,
        host: decrypted.host,
        port: decrypted.port,
        username: decrypted.username,
        authType: updated.auth_type,
        useMosh: updated.use_mosh === 1,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err) {
    console.error('Error updating connection:', err);
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

/**
 * DELETE /api/connections/:id
 * Delete a connection
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const connectionId = parseInt(req.params.id, 10);

    if (isNaN(connectionId)) {
      res.status(400).json({ error: 'Invalid connection ID' });
      return;
    }

    const deleted = deleteCredential(connectionId, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting connection:', err);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

export default router;
