// Cookie-based session management.
//
// The client only ever holds the raw token (in an HttpOnly cookie). The
// server stores `SHA-256(token)` and looks sessions up by that hash. A stolen
// DB row cannot be used to authenticate because the plaintext token is not
// recoverable from the hash.

import crypto from 'node:crypto';
import type { Response } from 'express';
import { config } from '../config.js';

export const SESSION_COOKIE = 'tabs_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256Hex(token);
  return { token, tokenHash };
}

export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  });
}

export function clearSessionCookie(res: Response): void {
  res.cookie(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  });
}
