import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { TelegramUser, TelegramInitData } from '../types';
import { getOrCreateUser } from '../db/sqlite';

/**
 * Validates Telegram WebApp initData using HMAC-SHA256
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string): TelegramInitData | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return null;
    }

    // Remove hash from params and sort alphabetically
    params.delete('hash');
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key: HMAC-SHA256(botToken, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.botToken)
      .digest();

    // Calculate HMAC-SHA256 of the data-check-string
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    // Compare hashes
    if (calculatedHash !== hash) {
      return null;
    }

    // Check auth_date is not too old (allow 24 hours)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60; // 24 hours

    if (now - authDate > maxAge) {
      console.warn('InitData expired:', { authDate, now, diff: now - authDate });
      // In production, you might want to reject expired data
      // return null;
    }

    // Parse the validated data
    const result: TelegramInitData = {
      auth_date: authDate,
      hash,
    };

    // Parse user data if present
    const userStr = params.get('user');
    if (userStr) {
      try {
        result.user = JSON.parse(userStr) as TelegramUser;
      } catch {
        console.error('Failed to parse user data');
      }
    }

    // Add other fields
    const queryId = params.get('query_id');
    if (queryId) {
      result.query_id = queryId;
    }

    return result;
  } catch (error) {
    console.error('Error validating initData:', error);
    return null;
  }
}

/**
 * Express middleware to validate Telegram initData on every request
 */
export function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip auth for health check endpoint
  if (req.path === '/health') {
    next();
    return;
  }

  // Get initData from header or query parameter
  const initData = req.headers['x-telegram-init-data'] as string || req.query.initData as string;

  if (!initData) {
    res.status(401).json({ error: 'Missing Telegram initData' });
    return;
  }

  const validatedData = validateInitData(initData);

  if (!validatedData) {
    res.status(401).json({ error: 'Invalid Telegram initData' });
    return;
  }

  if (!validatedData.user) {
    res.status(401).json({ error: 'User data not found in initData' });
    return;
  }

  // Attach user to request
  req.telegramUser = validatedData.user;

  // Get or create user in database
  try {
    const dbUser = getOrCreateUser(validatedData.user);
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error getting/creating user:', error);
    res.status(500).json({ error: 'Failed to process user' });
  }
}

/**
 * Validate initData for WebSocket connections
 */
export function validateWebSocketAuth(initData: string): TelegramUser | null {
  const validatedData = validateInitData(initData);
  return validatedData?.user || null;
}
