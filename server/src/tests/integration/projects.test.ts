// Project route tests.
//
// Covers:
//   - create / read / update / delete
//   - validation (missing name, empty body on PATCH)
//   - ordering (alphabetical)
//   - cross-user ownership: user A and user B see only their own projects,
//     and cross-user reads/writes return 404 (not 403) to avoid existence
//     leaks
//   - auth required
//   - body-supplied ownerId is ignored (server always uses req.user.id)

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../db.js';
import { hashPassword } from '../../auth/password.js';

const app = createApp();

async function bootstrapUser(email: string, displayName: string, password: string): Promise<string> {
  // Bootstrap returns a session cookie for the new user. The first user is
  // admin; subsequent users must register through /api/auth/register-with-invite
  // (see createSecondUser below).
  const res = await request(app)
    .post('/api/auth/bootstrap')
    .send({ email, displayName, password });
  if (res.status !== 200) {
    throw new Error(`bootstrap failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const setCookie = res.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) throw new Error('no session cookie set');
  const first = setCookie[0];
  if (!first) throw new Error('no session cookie set');
  return first.split(';')[0] ?? '';
}

async function createSecondUser(adminCookie: string): Promise<string> {
  const inviteRes = await request(app).post('/api/auth/invites').set('Cookie', adminCookie).send({});
  expect(inviteRes.status).toBe(200);
  const email = 'second@example.com';
  const reg = await request(app).post('/api/auth/register-with-invite').send({
    inviteCode: inviteRes.body.code,
    email,
    displayName: 'Second',
    password: 'password1234',
  });
  if (reg.status !== 200) {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  }
  const setCookie = reg.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) throw new Error('no session cookie set');
  const first = setCookie[0];
  if (!first) throw new Error('no session cookie set');
  return first.split(';')[0] ?? '';
}

describe('projects', () => {
  describe('auth', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const r1 = await request(app).get('/api/projects');
      expect(r1.status).toBe(401);
      const r2 = await request(app).post('/api/projects').send({});
      expect(r2.status).toBe(401);
      const r3 = await request(app).patch('/api/projects/p1').send({ name: 'x' });
      expect(r3.status).toBe(401);
      const r4 = await request(app).delete('/api/projects/p1');
      expect(r4.status).toBe(401);
    });
  });

  describe('POST /api/projects', () => {
    it('creates a project for the current user', async () => {
      const cookie = await bootstrapUser('owner-a@example.com', 'Owner A', 'password1234');
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ id: 'proj-a1', name: 'Work', color: 'text-blue-500' });
      expect(res.status).toBe(200);
      expect(res.body.project).toMatchObject({
        id: 'proj-a1',
        name: 'Work',
        color: 'text-blue-500',
      });
      expect(typeof res.body.project.createdAt).toBe('number');

      const row = await prisma.project.findUnique({ where: { id: 'proj-a1' } });
      expect(row?.ownerId).toBeTruthy();
    });

    it('ignores any client-supplied ownerId', async () => {
      const cookie = await bootstrapUser('a-idem@example.com', 'A', 'password1234');
      // Bootstrap a second user so we have a real "other" id to try to inject.
      await createSecondUser(cookie);
      const users = await prisma.user.findMany();
      const authedUser = users.find((u) => u.email === 'a-idem@example.com');
      const otherUser = users.find((u) => u.email === 'second@example.com');
      const someOtherUserId = otherUser?.id ?? '';
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ id: 'proj-idem', name: 'X', color: 'text-red-500', ownerId: someOtherUserId });
      expect(res.status).toBe(200);
      const row = await prisma.project.findUnique({ where: { id: 'proj-idem' } });
      // The saved ownerId is the authenticated user, not the body.
      expect(row?.ownerId).not.toBe(someOtherUserId);
      expect(row?.ownerId).toBe(authedUser?.id);
    });

    it('rejects an empty name', async () => {
      const cookie = await bootstrapUser('a-name@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ id: 'proj-noname', name: '   ', color: 'text-red-500' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing id', async () => {
      const cookie = await bootstrapUser('a-noid@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ name: 'NoId', color: 'text-red-500' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects', () => {
    it('returns the current user projects sorted by name', async () => {
      const cookie = await bootstrapUser('a-list@example.com', 'A', 'password1234');
      await request(app).post('/api/projects').set('Cookie', cookie).send({ id: 'p1', name: 'Zeta', color: 'c1' });
      await request(app).post('/api/projects').set('Cookie', cookie).send({ id: 'p2', name: 'Alpha', color: 'c2' });
      await request(app).post('/api/projects').set('Cookie', cookie).send({ id: 'p3', name: 'Mike', color: 'c3' });

      const res = await request(app).get('/api/projects').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.projects.map((p: { name: string }) => p.name)).toEqual(['Alpha', 'Mike', 'Zeta']);
    });

    it('does not include projects owned by other users', async () => {
      const aCookie = await bootstrapUser('a-mix@example.com', 'A', 'password1234');
      await request(app).post('/api/projects').set('Cookie', aCookie).send({ id: 'a-proj', name: 'AOnly', color: 'c' });
      const bCookie = await createSecondUser(aCookie);
      await request(app).post('/api/projects').set('Cookie', bCookie).send({ id: 'b-proj', name: 'BOnly', color: 'c' });

      const aList = await request(app).get('/api/projects').set('Cookie', aCookie);
      const bList = await request(app).get('/api/projects').set('Cookie', bCookie);

      expect(aList.body.projects.map((p: { id: string }) => p.id)).toEqual(['a-proj']);
      expect(bList.body.projects.map((p: { id: string }) => p.id)).toEqual(['b-proj']);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('renames and recolors an existing project', async () => {
      const cookie = await bootstrapUser('a-patch@example.com', 'A', 'password1234');
      await request(app).post('/api/projects').set('Cookie', cookie).send({ id: 'p1', name: 'Old', color: 'c-old' });
      const res = await request(app)
        .patch('/api/projects/p1')
        .set('Cookie', cookie)
        .send({ name: 'New', color: 'c-new' });
      expect(res.status).toBe(200);
      expect(res.body.project).toMatchObject({ id: 'p1', name: 'New', color: 'c-new' });
    });

    it('returns 404 for a non-existent project', async () => {
      const cookie = await bootstrapUser('a-404@example.com', 'A', 'password1234');
      const res = await request(app)
        .patch('/api/projects/does-not-exist')
        .set('Cookie', cookie)
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('rejects an empty body', async () => {
      const cookie = await bootstrapUser('a-eb@example.com', 'A', 'password1234');
      await request(app).post('/api/projects').set('Cookie', cookie).send({ id: 'p1', name: 'X', color: 'c' });
      const res = await request(app).patch('/api/projects/p1').set('Cookie', cookie).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('removes the project', async () => {
      const cookie = await bootstrapUser('a-del@example.com', 'A', 'password1234');
      await request(app).post('/api/projects').set('Cookie', cookie).send({ id: 'p1', name: 'X', color: 'c' });
      const res = await request(app).delete('/api/projects/p1').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const row = await prisma.project.findUnique({ where: { id: 'p1' } });
      expect(row).toBeNull();
    });
  });

  describe('cross-user ownership', () => {
    async function setupTwoUsers() {
      const aCookie = await bootstrapUser('a-cross@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await request(app).post('/api/projects').set('Cookie', aCookie).send({ id: 'a-proj', name: 'A', color: 'c' });
      return { aCookie, bCookie };
    }

    it('returns 404 (not 403) when user B patches/deletes user A project', async () => {
      const { aCookie, bCookie } = await setupTwoUsers();
      // Sanity: A can read it.
      const a = await request(app).patch('/api/projects/a-proj').set('Cookie', aCookie).send({ name: 'A2' });
      expect(a.status).toBe(200);
      // B cannot.
      const b = await request(app).patch('/api/projects/a-proj').set('Cookie', bCookie).send({ name: 'Hax' });
      expect(b.status).toBe(404);
      const bDel = await request(app).delete('/api/projects/a-proj').set('Cookie', bCookie);
      expect(bDel.status).toBe(404);
    });

    it('does not include the other user projects in list responses', async () => {
      const { aCookie, bCookie } = await setupTwoUsers();
      const aList = await request(app).get('/api/projects').set('Cookie', aCookie);
      const bList = await request(app).get('/api/projects').set('Cookie', bCookie);
      expect(aList.body.projects.map((p: { id: string }) => p.id)).toEqual(['a-proj']);
      expect(bList.body.projects).toEqual([]);
    });
  });

  // Sanity check that the auth pipeline used by this file is healthy. This
  // guards against an environmental regression (e.g. argon2 native binary
  // missing) silently skipping the rest of the suite.
  it('hashPassword round-trips', async () => {
    const h = await hashPassword('x');
    expect(h).toMatch(/^\$argon2id\$/);
  });
});

