// Auth flow tests.
//
// Covers (per the plan, Agent 1):
//   - first-user bootstrap
//   - bootstrap blocked after first user
//   - login success
//   - login failure (wrong password, unknown email)
//   - logout
//   - invite creation
//   - invite signup (valid / expired / used / unknown)
//   - expired session rejected
//   - ownership scaffolding (forged cookie rejected, protected routes require auth)
//
// We don't yet have project/task endpoints to test full cross-user ownership
// (those land in Agent 2). The 401 / forged-cookie cases are the same code
// path that the project/task handlers will use.

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../db.js';
import { generateInviteCode, hashInviteCode } from '../../auth/invite.js';
import { now } from '../../util/now.js';

const app = createApp();

async function loginCookie(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  const setCookie = res.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) throw new Error('no session cookie set');
  const first = setCookie[0];
  if (!first) throw new Error('no session cookie set');
  return first.split(';')[0] ?? '';
}

async function bootstrapAdmin(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/bootstrap')
    .send({ email: 'admin@example.com', displayName: 'Admin', password: 'password1234' });
  expect(res.status).toBe(200);
  return (res.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
}

describe('auth', () => {
  describe('GET /api/auth/status', () => {
    it('reports hasUsers=false on a fresh database', async () => {
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasUsers: false });
    });

    it('reports hasUsers=true after the first user is created', async () => {
      await bootstrapAdmin();
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasUsers: true });
    });
  });

  describe('POST /api/auth/bootstrap', () => {
    it('creates the first user as admin and sets a session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/bootstrap')
        .send({ email: 'first@example.com', displayName: 'First', password: 'password1234' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: 'first@example.com',
        displayName: 'First',
        role: 'admin',
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      const setCookie = res.headers['set-cookie'];
      expect(setCookie?.[0]).toMatch(/tabs_session=/);
    });

    it('rejects bootstrap after the first user exists', async () => {
      await bootstrapAdmin();
      const res = await request(app)
        .post('/api/auth/bootstrap')
        .send({ email: 'second@example.com', displayName: 'Second', password: 'password1234' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('rejects weak passwords (min 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/bootstrap')
        .send({ email: 'weak@example.com', displayName: 'Weak', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects malformed email', async () => {
      const res = await request(app)
        .post('/api/auth/bootstrap')
        .send({ email: 'not-an-email', displayName: 'Bad', password: 'password1234' });
      expect(res.status).toBe(400);
    });

    it('rejects empty display name', async () => {
      const res = await request(app)
        .post('/api/auth/bootstrap')
        .send({ email: 'a@example.com', displayName: '   ', password: 'password1234' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      await bootstrapAdmin();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'password1234' });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@example.com');
      expect(res.headers['set-cookie']?.[0]).toMatch(/tabs_session=/);
    });

    it('is case-insensitive on email', async () => {
      await bootstrapAdmin();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ADMIN@example.com', password: 'password1234' });
      expect(res.status).toBe(200);
    });

    it('rejects wrong password', async () => {
      await bootstrapAdmin();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
    });

    it('rejects unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the current user when authenticated', async () => {
      await bootstrapAdmin();
      const cookie = await loginCookie('admin@example.com', 'password1234');
      const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@example.com');
    });

    it('rejects a forged session cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'tabs_session=this-is-not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('rejects an expired session', async () => {
      await bootstrapAdmin();
      const cookie = await loginCookie('admin@example.com', 'password1234');

      // Manually expire the only session in the DB.
      await prisma.session.updateMany({ data: { expiresAt: now() - BigInt(1000) } });

      const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the session', async () => {
      await bootstrapAdmin();
      const cookie = await loginCookie('admin@example.com', 'password1234');
      const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
      expect(res.status).toBe(200);

      const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(meRes.status).toBe(401);
    });

    it('requires auth', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/invites', () => {
    it('requires auth', async () => {
      const res = await request(app).post('/api/auth/invites').send({});
      expect(res.status).toBe(401);
    });

    it('returns the raw code once and stores its hash', async () => {
      await bootstrapAdmin();
      const cookie = await loginCookie('admin@example.com', 'password1234');
      const res = await request(app)
        .post('/api/auth/invites')
        .set('Cookie', cookie)
        .send({ expiresInDays: 7 });
      expect(res.status).toBe(200);
      expect(res.body.code).toMatch(/^TABS-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      expect(res.body.expiresAt).toBeGreaterThan(Date.now());

      // The raw code must NOT be stored in plaintext.
      const codeHash = hashInviteCode(res.body.code);
      const stored = await prisma.invite.findUnique({ where: { codeHash } });
      expect(stored).not.toBeNull();
      expect(stored!.codeHash).not.toContain(res.body.code);
    });

    it('defaults to 14-day expiry', async () => {
      await bootstrapAdmin();
      const cookie = await loginCookie('admin@example.com', 'password1234');
      const res = await request(app).post('/api/auth/invites').set('Cookie', cookie).send({});
      expect(res.status).toBe(200);
      const expected = Number(now()) + 14 * 24 * 60 * 60 * 1000;
      // Allow 2s of clock drift between the handler and the test runner.
      expect(Math.abs(res.body.expiresAt - expected)).toBeLessThan(2_000);
    });

    it('rejects malformed expiresInDays', async () => {
      await bootstrapAdmin();
      const cookie = await loginCookie('admin@example.com', 'password1234');
      const res = await request(app)
        .post('/api/auth/invites')
        .set('Cookie', cookie)
        .send({ expiresInDays: 0 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/register-with-invite', () => {
    async function createInviteCodeFor(
      userId: string,
      overrides: { expiresAt?: bigint; usedAt?: bigint; usedByUserId?: string | null } = {},
    ): Promise<string> {
      const { code, codeHash } = generateInviteCode();
      const created = now();
      await prisma.invite.create({
        data: {
          codeHash,
          createdByUserId: userId,
          expiresAt: overrides.expiresAt ?? created + BigInt(24 * 60 * 60 * 1000),
          createdAt: created,
          usedAt: overrides.usedAt ?? null,
          usedByUserId: overrides.usedByUserId ?? null,
        },
      });
      return code;
    }

    it('registers a new user with a valid invite', async () => {
      await bootstrapAdmin();
      const admin = await prisma.user.findFirstOrThrow();
      const code = await createInviteCodeFor(admin.id);
      const res = await request(app)
        .post('/api/auth/register-with-invite')
        .send({ inviteCode: code, email: 'newbie@example.com', displayName: 'Newbie', password: 'password1234' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: 'newbie@example.com', role: 'user' });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toMatch(/tabs_session=/);

      // Invite is now marked as used.
      const updated = await prisma.invite.findFirstOrThrow();
      expect(updated.usedAt).not.toBeNull();
      expect(updated.usedByUserId).toBe(res.body.user.id);
    });

    it('rejects expired invites', async () => {
      await bootstrapAdmin();
      const admin = await prisma.user.findFirstOrThrow();
      const code = await createInviteCodeFor(admin.id, { expiresAt: now() - BigInt(1000) });
      const res = await request(app)
        .post('/api/auth/register-with-invite')
        .send({ inviteCode: code, email: 'late@example.com', displayName: 'Late', password: 'password1234' });
      expect(res.status).toBe(400);
    });

    it('rejects already-used invites', async () => {
      await bootstrapAdmin();
      const admin = await prisma.user.findFirstOrThrow();
      const code = await createInviteCodeFor(admin.id, { usedAt: now(), usedByUserId: admin.id });
      const res = await request(app)
        .post('/api/auth/register-with-invite')
        .send({ inviteCode: code, email: 'reuser@example.com', displayName: 'Re', password: 'password1234' });
      expect(res.status).toBe(400);
    });

    it('rejects unknown invite codes', async () => {
      const res = await request(app)
        .post('/api/auth/register-with-invite')
        .send({ inviteCode: 'TABS-AAAAA-BBBBB', email: 'u@example.com', displayName: 'U', password: 'password1234' });
      expect(res.status).toBe(404);
    });

    it('rejects malformed invite codes', async () => {
      const res = await request(app)
        .post('/api/auth/register-with-invite')
        .send({ inviteCode: 'not-an-invite', email: 'u@example.com', displayName: 'U', password: 'password1234' });
      expect(res.status).toBe(404);
    });

    it('rejects duplicate emails', async () => {
      await bootstrapAdmin();
      const admin = await prisma.user.findFirstOrThrow();
      const code = await createInviteCodeFor(admin.id);
      const res = await request(app)
        .post('/api/auth/register-with-invite')
        .send({ inviteCode: code, email: 'admin@example.com', displayName: 'Dup', password: 'password1234' });
      expect(res.status).toBe(409);
    });
  });
});
