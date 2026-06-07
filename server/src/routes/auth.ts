// Auth endpoints.
//
//   POST   /api/auth/status                → { hasUsers }
//   POST   /api/auth/bootstrap             → first user only, becomes admin
//   POST   /api/auth/login                 → email + password
//   POST   /api/auth/logout                → requireAuth
//   GET    /api/auth/me                    → requireAuth
//   POST   /api/auth/invites               → requireAuth
//   POST   /api/auth/register-with-invite  → public, but requires a valid invite
//
// All private tables query with `ownerId` filtering. The session token is set
// as an HttpOnly cookie by the server.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  generateSessionToken,
  setSessionCookie,
  clearSessionCookie,
  SESSION_TTL_MS,
} from '../auth/session.js';
import { generateInviteCode, hashInviteCode, isWellFormedInviteCode } from '../auth/invite.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { asyncHandler, BadRequest, Conflict, Forbidden, NotFound, Unauthorized } from '../errors.js';
import { now } from '../util/now.js';

export const authRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function publicUser(u: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: bigint;
  updatedAt: bigint;
}) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    // Cast BigInt → number at the response boundary so the wire format
    // stays plain JSON. The frontend treats these as plain numbers.
    createdAt: Number(u.createdAt),
    updatedAt: Number(u.updatedAt),
  };
}

async function createSessionForUser(userId: string, res: import('express').Response) {
  const { token, tokenHash } = generateSessionToken();
  const created = now();
  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt: created + BigInt(SESSION_TTL_MS),
      createdAt: created,
    },
  });
  setSessionCookie(res, token);
}

// ── Status (public) ────────────────────────────────────────────────────────

authRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    try {
      const count = await prisma.user.count();
      res.json({ hasUsers: count > 0 });
    } catch (err) {
      // Database unreachable during boot is not a server error — it's a
      // degraded state the auth gate needs to handle gracefully.
      // eslint-disable-next-line no-console
      console.warn('[auth] /status DB unreachable:', err instanceof Error ? err.message : err);
      res.status(503).json({ hasUsers: false, ready: false });
    }
  }),
);

// ── Bootstrap (first user) ─────────────────────────────────────────────────

const bootstrapSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(200),
});

authRouter.post(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    const body = bootstrapSchema.parse(req.body);
    const count = await prisma.user.count();
    if (count > 0) {
      throw new Forbidden('Bootstrap is disabled because users already exist.');
    }
    const created = now();
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
        role: 'admin',
        createdAt: created,
        updatedAt: created,
      },
    });
    await createSessionForUser(user.id, res);
    res.json({ user: publicUser(user) });
  }),
);

// ── Login ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) throw new Unauthorized('Invalid email or password.');
    const ok = await verifyPassword(user.passwordHash, body.password);
    if (!ok) throw new Unauthorized('Invalid email or password.');
    await createSessionForUser(user.id, res);
    res.json({ user: publicUser(user) });
  }),
);

// ── Logout ─────────────────────────────────────────────────────────────────

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.session) {
      await prisma.session.delete({ where: { id: req.session.id } }).catch(() => undefined);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

// ── Me ─────────────────────────────────────────────────────────────────────

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ user: publicUser(req.user!) });
  }),
);

// ── Invites (admin/user) ───────────────────────────────────────────────────

const createInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional().default(14),
});

authRouter.post(
  '/invites',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createInviteSchema.parse(req.body ?? {});
    const { code, codeHash } = generateInviteCode();
    const created = now();
    const expiresAt = created + BigInt(body.expiresInDays * 24 * 60 * 60 * 1000);
    await prisma.invite.create({
      data: {
        codeHash,
        createdByUserId: req.user!.id,
        expiresAt,
        createdAt: created,
      },
    });
    // The raw code is returned ONCE; the server only stores the hash.
    res.json({ code, expiresAt: Number(expiresAt) });
  }),
);

// ── Register with invite ───────────────────────────────────────────────────

const registerWithInviteSchema = z.object({
  inviteCode: z.string().min(1).max(80),
  email: z.string().email().max(254),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(200),
});

authRouter.post(
  '/register-with-invite',
  asyncHandler(async (req, res) => {
    const body = registerWithInviteSchema.parse(req.body);
    if (!isWellFormedInviteCode(body.inviteCode)) {
      throw new NotFound('Invite code not found.');
    }
    const codeHash = hashInviteCode(body.inviteCode);
    const invite = await prisma.invite.findUnique({ where: { codeHash } });
    if (!invite) throw new NotFound('Invite code not found.');
    if (invite.usedAt !== null || invite.usedByUserId !== null) {
      throw new BadRequest('This invite code has already been used.');
    }
    if (invite.expiresAt < now()) {
      throw new BadRequest('This invite code has expired.');
    }
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new Conflict('A user with that email already exists.');

    const created = now();
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: body.email.toLowerCase(),
          displayName: body.displayName,
          passwordHash: await hashPassword(body.password),
          role: 'user',
          createdAt: created,
          updatedAt: created,
        },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: created, usedByUserId: u.id },
      });
      return u;
    });

    await createSessionForUser(user.id, res);
    res.json({ user: publicUser(user) });
  }),
);
