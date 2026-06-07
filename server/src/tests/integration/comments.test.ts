// Task comment route tests.
//
// Covers:
//   - GET /api/tasks/:taskId/comments — list comments for a task
//   - POST /api/tasks/:taskId/comments — add a comment (with optional replyTo)
//   - PATCH /api/comments/:id — edit comment text
//   - DELETE /api/comments/:id — remove a comment
//   - cross-user ownership: user B cannot read or write user A task comments
//   - body-supplied ownerId is ignored
//   - auth required
//
// File uploads are Agent 3; `fileId` is accepted but not yet wired.

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../db.js';

const app = createApp();

async function bootstrapUser(email: string, displayName: string, password: string): Promise<string> {
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
  const reg = await request(app).post('/api/auth/register-with-invite').send({
    inviteCode: inviteRes.body.code,
    email: 'second@example.com',
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

async function createTask(cookie: string, id: string, title = 'A task'): Promise<void> {
  const res = await request(app)
    .post('/api/tasks')
    .set('Cookie', cookie)
    .send({ id, title, date: '2026-06-06' });
  if (res.status !== 200) throw new Error(`createTask failed: ${res.status} ${JSON.stringify(res.body)}`);
}

describe('task comments', () => {
  describe('auth', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const r1 = await request(app).get('/api/tasks/t1/comments');
      expect(r1.status).toBe(401);
      const r2 = await request(app).post('/api/tasks/t1/comments').send({});
      expect(r2.status).toBe(401);
      const r3 = await request(app).patch('/api/comments/c1').send({ text: 'x' });
      expect(r3.status).toBe(401);
      const r4 = await request(app).delete('/api/comments/c1');
      expect(r4.status).toBe(401);
    });
  });

  describe('POST /api/tasks/:taskId/comments', () => {
    it('adds a plain text comment', async () => {
      const cookie = await bootstrapUser('a-c1@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({ id: 'c1', text: 'Hello' });
      expect(res.status).toBe(200);
      expect(res.body.comment).toMatchObject({
        id: 'c1',
        taskId: 't1',
        text: 'Hello',
        fileId: null,
      });
      expect(typeof res.body.comment.createdAt).toBe('number');
    });

    it('adds a comment with a replyTo', async () => {
      const cookie = await bootstrapUser('a-c2@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({ id: 'c1', text: 'Original' });
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({
          id: 'c2',
          text: 'Reply',
          replyTo: { id: 'c1', text: 'Original', sender: 'You' },
        });
      expect(res.status).toBe(200);
      expect(res.body.comment.replyTo).toMatchObject({ id: 'c1', text: 'Original', sender: 'You' });
    });

    it('ignores client-supplied ownerId', async () => {
      const cookie = await bootstrapUser('a-c3@example.com', 'A', 'password1234');
      // Bootstrap a second user so we have a real "other" id to try to inject.
      await createSecondUser(cookie);
      await createTask(cookie, 't1');
      const users = await prisma.user.findMany();
      const otherUser = users.find((u) => u.email === 'second@example.com');
      const someOtherUserId = otherUser?.id ?? '';
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({ id: 'c1', text: 'Hello', ownerId: someOtherUserId });
      expect(res.status).toBe(200);
      const row = await prisma.taskComment.findUnique({ where: { id: 'c1' } });
      expect(row?.ownerId).not.toBe(someOtherUserId);
    });

    it('returns 404 when adding to another user task', async () => {
      const aCookie = await bootstrapUser('a-c4@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      const res = await request(app)
        .post('/api/tasks/a-t1/comments')
        .set('Cookie', bCookie)
        .send({ id: 'c1', text: 'Hello' });
      expect(res.status).toBe(404);
      const row = await prisma.taskComment.findUnique({ where: { id: 'c1' } });
      expect(row).toBeNull();
    });

    it('rejects missing id', async () => {
      const cookie = await bootstrapUser('a-c5@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({ text: 'no id' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tasks/:taskId/comments', () => {
    it('lists the task comments in createdAt order', async () => {
      const cookie = await bootstrapUser('a-c6@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      await request(app).post('/api/tasks/t1/comments').set('Cookie', cookie).send({ id: 'c1', text: 'A' });
      await new Promise((r) => setTimeout(r, 2));
      await request(app).post('/api/tasks/t1/comments').set('Cookie', cookie).send({ id: 'c2', text: 'B' });
      await new Promise((r) => setTimeout(r, 2));
      await request(app).post('/api/tasks/t1/comments').set('Cookie', cookie).send({ id: 'c3', text: 'C' });

      const res = await request(app).get('/api/tasks/t1/comments').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.comments.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2', 'c3']);
    });

    it('returns 404 for another user task', async () => {
      const aCookie = await bootstrapUser('a-c7@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      const res = await request(app).get('/api/tasks/a-t1/comments').set('Cookie', bCookie);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/comments/:id', () => {
    it('edits comment text', async () => {
      const cookie = await bootstrapUser('a-c8@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({ id: 'c1', text: 'Original' });
      const res = await request(app).patch('/api/comments/c1').set('Cookie', cookie).send({ text: 'Edited' });
      expect(res.status).toBe(200);
      expect(res.body.comment.text).toBe('Edited');
    });

    it('rejects an empty body (text is required)', async () => {
      const cookie = await bootstrapUser('a-c9@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({ id: 'c1', text: 'Original' });
      const res = await request(app).patch('/api/comments/c1').set('Cookie', cookie).send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for another user comment', async () => {
      const aCookie = await bootstrapUser('a-c10@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      await request(app)
        .post('/api/tasks/a-t1/comments')
        .set('Cookie', aCookie)
        .send({ id: 'a-c1', text: 'A' });
      const res = await request(app).patch('/api/comments/a-c1').set('Cookie', bCookie).send({ text: 'Hax' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    it('removes the comment', async () => {
      const cookie = await bootstrapUser('a-c11@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .send({ id: 'c1', text: 'Hello' });
      const res = await request(app).delete('/api/comments/c1').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const row = await prisma.taskComment.findUnique({ where: { id: 'c1' } });
      expect(row).toBeNull();
    });

    it('returns 404 for another user comment', async () => {
      const aCookie = await bootstrapUser('a-c12@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      await request(app)
        .post('/api/tasks/a-t1/comments')
        .set('Cookie', aCookie)
        .send({ id: 'a-c1', text: 'A' });
      const res = await request(app).delete('/api/comments/a-c1').set('Cookie', bCookie);
      expect(res.status).toBe(404);
    });
  });

  describe('ownership invariants', () => {
    it('user B cannot see user A comments even if guessing the comment id', async () => {
      const aCookie = await bootstrapUser('a-c13@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      await request(app)
        .post('/api/tasks/a-t1/comments')
        .set('Cookie', aCookie)
        .send({ id: 'a-c1', text: 'Secret' });
      const res = await request(app).get('/api/tasks/a-t1/comments').set('Cookie', bCookie);
      expect(res.status).toBe(404);
      const patch = await request(app).patch('/api/comments/a-c1').set('Cookie', bCookie).send({ text: 'Hax' });
      expect(patch.status).toBe(404);
      const del = await request(app).delete('/api/comments/a-c1').set('Cookie', bCookie);
      expect(del.status).toBe(404);
      // The comment is still there, owned by A.
      const row = await prisma.taskComment.findUnique({ where: { id: 'a-c1' } });
      expect(row).not.toBeNull();
      expect(row?.text).toBe('Secret');
    });
  });
});

