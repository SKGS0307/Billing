import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'ttm_session';

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(token).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
