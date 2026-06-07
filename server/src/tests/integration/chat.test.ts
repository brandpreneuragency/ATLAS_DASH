// Chat thread / message integration tests.
//
// Covers (per the plan, Agent 6):
//   - auth required on every /api/chat-threads and /api/chat-messages
//   - thread CRUD: create, list (filter by mode), delete
//   - thread ownership: 404 on cross-user access (never 403)
//   - message CRUD: create, list, patch, delete
//   - cascade delete: hard-deleting a thread removes its messages
//   - thread title auto-rename on first user message
//   - thread `updatedAt` is bumped on every new message
//   - duplicate id (thread or message) → 400
//   - body-supplied ownerId is ignored (server always uses req.user.id)
//   - `mode` filter on list endpoint

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { now } from '../../util/now.js';

const app = createApp();

async function bootstrapUser(email: string, displayName: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/bootstrap')
    .send({ email, displayName, password });
  if (res.status !== 200) {
    throw new Error(`bootstrap failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const setCookie = res.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) throw new Error('no session cookie set');
  return (setCookie[0] ?? '').split(';')[0] ?? '';
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
  expect(reg.status).toBe(200);
  const setCookie = reg.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) throw new Error('no session cookie set');
  return (setCookie[0] ?? '').split(';')[0] ?? '';
}

describe('chat threads', () => {
  it('requires auth on list', async () => {
    const res = await request(app).get('/api/chat-threads');
    expect(res.status).toBe(401);
  });

  it('requires auth on create', async () => {
    const res = await request(app)
      .post('/api/chat-threads')
      .send({ id: 't1', mode: 'writer', title: 'New Chat' });
    expect(res.status).toBe(401);
  });

  it('requires auth on delete', async () => {
    const res = await request(app).delete('/api/chat-threads/t1');
    expect(res.status).toBe(401);
  });

  it('creates a thread, lists it, and lists it back filtered by mode', async () => {
    const cookie = await bootstrapUser('thread-create@example.com', 'Thread', 'password1234');

    const createWriter = await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'tw1', mode: 'writer', title: 'Writer chat' });
    expect(createWriter.status).toBe(200);
    expect(createWriter.body.thread).toMatchObject({
      id: 'tw1',
      mode: 'writer',
      title: 'Writer chat',
    });
    expect(typeof createWriter.body.thread.createdAt).toBe('number');
    expect(typeof createWriter.body.thread.updatedAt).toBe('number');

    const createTask = await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'tt1', mode: 'task', title: 'Task chat' });
    expect(createTask.status).toBe(200);

    const all = await request(app).get('/api/chat-threads').set('Cookie', cookie);
    expect(all.status).toBe(200);
    expect(all.body.threads).toHaveLength(2);
    const ids = all.body.threads.map((t: { id: string }) => t.id).sort();
    expect(ids).toEqual(['tt1', 'tw1']);

    const writerOnly = await request(app)
      .get('/api/chat-threads?mode=writer')
      .set('Cookie', cookie);
    expect(writerOnly.status).toBe(200);
    expect(writerOnly.body.threads).toHaveLength(1);
    expect(writerOnly.body.threads[0].id).toBe('tw1');

    const taskOnly = await request(app)
      .get('/api/chat-threads?mode=task')
      .set('Cookie', cookie);
    expect(taskOnly.status).toBe(200);
    expect(taskOnly.body.threads).toHaveLength(1);
    expect(taskOnly.body.threads[0].id).toBe('tt1');
  });

  it('rejects duplicate thread id', async () => {
    const cookie = await bootstrapUser('thread-dup@example.com', 'Dup', 'password1234');
    const first = await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'dup1', mode: 'writer' });
    expect(first.status).toBe(200);
    const second = await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'dup1', mode: 'writer' });
    expect(second.status).toBe(400);
  });

  it('ignores body-supplied ownerId', async () => {
    const cookie = await bootstrapUser('thread-owner@example.com', 'Owner', 'password1234');
    const create = await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'own1', mode: 'writer', title: 'X', ownerId: 'somebody-else' });
    expect(create.status).toBe(200);
    const list = await request(app).get('/api/chat-threads').set('Cookie', cookie);
    expect(list.body.threads).toHaveLength(1);
    expect(list.body.threads[0].id).toBe('own1');
    // No `ownerId` is ever sent to the client.
    expect(list.body.threads[0].ownerId).toBeUndefined();
  });

  it('returns 404 when one user tries to delete another user\'s thread', async () => {
    const adminCookie = await bootstrapUser('thread-xuser@example.com', 'Admin', 'password1234');
    const otherCookie = await createSecondUser(adminCookie);

    const create = await request(app)
      .post('/api/chat-threads')
      .set('Cookie', adminCookie)
      .send({ id: 'a-thread', mode: 'writer' });
    expect(create.status).toBe(200);

    const otherList = await request(app)
      .get('/api/chat-threads')
      .set('Cookie', otherCookie);
    expect(otherList.body.threads).toHaveLength(0);

    const del = await request(app)
      .delete('/api/chat-threads/a-thread')
      .set('Cookie', otherCookie);
    expect(del.status).toBe(404);

    const list = await request(app).get('/api/chat-threads').set('Cookie', adminCookie);
    expect(list.body.threads).toHaveLength(1);
  });

  it('hard-deletes a thread and its messages in one go', async () => {
    const cookie = await bootstrapUser('thread-cascade@example.com', 'Cascade', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'casc1', mode: 'writer' });
    await request(app)
      .post('/api/chat-threads/casc1/messages')
      .set('Cookie', cookie)
      .send({
        id: 'm1',
        mode: 'writer',
        agentId: 'default_writer',
        role: 'user',
        content: 'hello',
      });

    const listBefore = await request(app)
      .get('/api/chat-threads/casc1/messages')
      .set('Cookie', cookie);
    expect(listBefore.body.messages).toHaveLength(1);

    const del = await request(app)
      .delete('/api/chat-threads/casc1')
      .set('Cookie', cookie);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get('/api/chat-threads/casc1/messages')
      .set('Cookie', cookie);
    expect(listAfter.status).toBe(404);
  });

  it('returns 404 for deleting a non-existent thread', async () => {
    const cookie = await bootstrapUser('thread-del@example.com', 'Del', 'password1234');
    const del = await request(app)
      .delete('/api/chat-threads/nope')
      .set('Cookie', cookie);
    expect(del.status).toBe(404);
  });
});

describe('chat messages', () => {
  it('requires auth on list', async () => {
    const res = await request(app).get('/api/chat-threads/abc/messages');
    expect(res.status).toBe(401);
  });

  it('requires auth on create', async () => {
    const res = await request(app)
      .post('/api/chat-threads/abc/messages')
      .send({ id: 'm', mode: 'writer', agentId: 'a', role: 'user', content: '' });
    expect(res.status).toBe(401);
  });

  it('requires auth on patch', async () => {
    const res = await request(app)
      .patch('/api/chat-messages/m')
      .send({ content: 'x' });
    expect(res.status).toBe(401);
  });

  it('requires auth on delete', async () => {
    const res = await request(app).delete('/api/chat-messages/m');
    expect(res.status).toBe(401);
  });

  it('creates a message, lists it, and edits it', async () => {
    const cookie = await bootstrapUser('msg-create@example.com', 'Msg', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'th1', mode: 'writer' });

    const create = await request(app)
      .post('/api/chat-threads/th1/messages')
      .set('Cookie', cookie)
      .send({
        id: 'm1',
        mode: 'writer',
        agentId: 'default_writer',
        role: 'user',
        content: 'hello world',
      });
    expect(create.status).toBe(200);
    expect(create.body.message).toMatchObject({
      id: 'm1',
      threadId: 'th1',
      mode: 'writer',
      role: 'user',
      content: 'hello world',
      agentId: 'default_writer',
    });
    expect(typeof create.body.message.timestamp).toBe('number');

    const list = await request(app)
      .get('/api/chat-threads/th1/messages')
      .set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.messages).toHaveLength(1);

    const patch = await request(app)
      .patch('/api/chat-messages/m1')
      .set('Cookie', cookie)
      .send({ content: 'updated' });
    expect(patch.status).toBe(200);
    expect(patch.body.message.content).toBe('updated');

    const del = await request(app)
      .delete('/api/chat-messages/m1')
      .set('Cookie', cookie);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get('/api/chat-threads/th1/messages')
      .set('Cookie', cookie);
    expect(listAfter.body.messages).toHaveLength(0);
  });

  it('rejects duplicate message id', async () => {
    const cookie = await bootstrapUser('msg-dup@example.com', 'Dup', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'th2', mode: 'writer' });
    const first = await request(app)
      .post('/api/chat-threads/th2/messages')
      .set('Cookie', cookie)
      .send({ id: 'mm', mode: 'writer', agentId: 'a', role: 'user', content: 'x' });
    expect(first.status).toBe(200);
    const second = await request(app)
      .post('/api/chat-threads/th2/messages')
      .set('Cookie', cookie)
      .send({ id: 'mm', mode: 'writer', agentId: 'a', role: 'user', content: 'y' });
    expect(second.status).toBe(400);
  });

  it('auto-renames a "New Chat" thread on first user message', async () => {
    const cookie = await bootstrapUser('msg-rename@example.com', 'Ren', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'rn1', mode: 'writer' });
    const res = await request(app)
      .post('/api/chat-threads/rn1/messages')
      .set('Cookie', cookie)
      .send({
        id: 'rnm1',
        mode: 'writer',
        agentId: 'a',
        role: 'user',
        content: 'Help me write a fantasy novel about a time-travelling librarian',
      });
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/chat-threads').set('Cookie', cookie);
    const thread = list.body.threads.find((t: { id: string }) => t.id === 'rn1');
    expect(thread.title).toBe('Help me write a fantasy novel about a time-travelling librar');
  });

  it('bumps thread updatedAt on new message', async () => {
    const cookie = await bootstrapUser('msg-bump@example.com', 'Bump', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'bm1', mode: 'writer' });
    const before = (await request(app).get('/api/chat-threads').set('Cookie', cookie)).body.threads[0];
    // Wait a millisecond so the new BigInt `now()` differs.
    await new Promise((r) => setTimeout(r, 5));
    await request(app)
      .post('/api/chat-threads/bm1/messages')
      .set('Cookie', cookie)
      .send({ id: 'bmm1', mode: 'writer', agentId: 'a', role: 'user', content: 'x' });
    const after = (await request(app).get('/api/chat-threads').set('Cookie', cookie)).body.threads[0];
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  });

  it('rejects message create against a non-existent thread', async () => {
    const cookie = await bootstrapUser('msg-nothread@example.com', 'N', 'password1234');
    const res = await request(app)
      .post('/api/chat-threads/nope/messages')
      .set('Cookie', cookie)
      .send({ id: 'm', mode: 'writer', agentId: 'a', role: 'user', content: '' });
    expect(res.status).toBe(404);
  });

  it('cross-user access returns 404', async () => {
    const adminCookie = await bootstrapUser('msg-cross@example.com', 'Admin', 'password1234');
    const otherCookie = await createSecondUser(adminCookie);
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', adminCookie)
      .send({ id: 'a-th', mode: 'writer' });
    await request(app)
      .post('/api/chat-threads/a-th/messages')
      .set('Cookie', adminCookie)
      .send({ id: 'a-msg', mode: 'writer', agentId: 'a', role: 'user', content: 'secret' });

    const list = await request(app)
      .get('/api/chat-threads/a-th/messages')
      .set('Cookie', otherCookie);
    expect(list.status).toBe(404);

    const patch = await request(app)
      .patch('/api/chat-messages/a-msg')
      .set('Cookie', otherCookie)
      .send({ content: 'pwn' });
    expect(patch.status).toBe(404);

    const del = await request(app)
      .delete('/api/chat-messages/a-msg')
      .set('Cookie', otherCookie);
    expect(del.status).toBe(404);
  });

  it('preserves attachments and replyTo as Json', async () => {
    const cookie = await bootstrapUser('msg-shape@example.com', 'Shape', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'sh1', mode: 'writer' });
    const create = await request(app)
      .post('/api/chat-threads/sh1/messages')
      .set('Cookie', cookie)
      .send({
        id: 'shm1',
        mode: 'writer',
        agentId: 'a',
        role: 'user',
        content: 'see attached',
        replyTo: { id: 'prev', role: 'assistant', content: 'hi', sender: 'A' },
        attachments: [
          { fileId: 'f1', name: 'image.png', size: 1234, mimeType: 'image/png' },
        ],
      });
    expect(create.status).toBe(200);
    expect(create.body.message.replyTo).toEqual({
      id: 'prev',
      role: 'assistant',
      content: 'hi',
      sender: 'A',
    });
    expect(create.body.message.attachments).toEqual([
      { fileId: 'f1', name: 'image.png', size: 1234, mimeType: 'image/png' },
    ]);
  });

  it('rejects invalid body shape', async () => {
    const cookie = await bootstrapUser('msg-bad@example.com', 'Bad', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'bd1', mode: 'writer' });
    // role is not in the enum
    const res = await request(app)
      .post('/api/chat-threads/bd1/messages')
      .set('Cookie', cookie)
      .send({ id: 'bdm1', mode: 'writer', agentId: 'a', role: 'system', content: '' });
    expect(res.status).toBe(400);
  });

  it('accepts empty patch object? No — at least one field required', async () => {
    const cookie = await bootstrapUser('msg-patch@example.com', 'P', 'password1234');
    await request(app)
      .post('/api/chat-threads')
      .set('Cookie', cookie)
      .send({ id: 'pp1', mode: 'writer' });
    await request(app)
      .post('/api/chat-threads/pp1/messages')
      .set('Cookie', cookie)
      .send({ id: 'ppm1', mode: 'writer', agentId: 'a', role: 'user', content: '' });
    const res = await request(app)
      .patch('/api/chat-messages/ppm1')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(400);
  });
});
