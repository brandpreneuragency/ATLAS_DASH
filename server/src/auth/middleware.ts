// Auth middleware. Mounts `req.user` and `req.session` on success.
//
// Use `requireAuth` to reject unauthenticated requests with 401. The optional
// `attachUser` variant attaches the user if a valid session exists but does
// not reject anonymous requests — useful for routes that behave differently
// when logged in.

import type { NextFunction, Request, Response } from 'express';
import type { Session, User } from '@prisma/client';
import { prisma } from '../db.js';
import { hashSessionToken, SESSION_COOKIE } from './session.js';
import { Unauthorized } from '../errors.js';
import { now } from '../util/now.js';

export interface AuthedRequest extends Request {
  user?: User;
  session?: Session;
}

export async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      return next();
    }
    const tokenHash = hashSessionToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) return next();
    if (session.expiresAt < now()) {
      // Best-effort cleanup.
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return next();
    }
    req.user = session.user;
    req.session = session;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  if (!req.user || !req.session) {
    return next(new Unauthorized('Authentication required'));
  }
  return next();
}
