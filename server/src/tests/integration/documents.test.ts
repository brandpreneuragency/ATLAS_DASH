// Document integration tests.
//
// Covers:
//   - auth required on every /api/documents endpoint
//   - document CRUD: create, list, update, delete
//   - ownership: 404 on cross-user access (never 403)
//   - body-supplied ownerId is ignored
//   - duplicate id → 400
//   - empty PATCH body → 400
//   - `order` defaults to the count of existing documents

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

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

describe('documents', () => {
  it('requires auth on list', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('requires auth on create', async () => {
    const res = await request(app).post('/api/documents').send({ id: 'd1' });
    expect(res.status).toBe(401);
  });

  it('requires auth on patch', async () => {
    const res = await request(app).patch('/api/documents/d1').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('requires auth on delete', async () => {
    const res = await request(app).delete('/api/documents/d1');
    expect(res.status).toBe(401);
  });

  it('creates a document, lists it, edits it, and deletes it', async () => {
    const cookie = await bootstrapUser('doc-create@example.com', 'Doc', 'password1234');

    const create = await request(app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .send({ id: 'd1', title: 'Note', content: 'Hello' });
    expect(create.status).toBe(200);
    expect(create.body.document).toMatchObject({
      id: 'd1',
      title: 'Note',
      content: 'Hello',
      order: 0,
      isDirty: false,
      splitEditorOpen: false,
    });
    expect(typeof create.body.document.createdAt).toBe('number');
    expect(typeof create.body.document.updatedAt).toBe('number');

    const list = await request(app).get('/api/documents').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.documents).toHaveLength(1);

    const patch = await request(app)
      .patch('/api/documents/d1')
      .set('Cookie', cookie)
      .send({ title: 'Renamed', content: 'World' });
    expect(patch.status).toBe(200);
    expect(patch.body.document.title).toBe('Renamed');
    expect(patch.body.document.content).toBe('World');
    // `updatedAt` should tick forward.
    expect(patch.body.document.updatedAt).toBeGreaterThanOrEqual(
      create.body.document.updatedAt,
    );

    const del = await request(app).delete('/api/documents/d1').set('Cookie', cookie);
    expect(del.status).toBe(200);

    const listAfter = await request(app).get('/api/documents').set('Cookie', cookie);
    expect(listAfter.body.documents).toHaveLength(0);
  });

  it('rejects duplicate id', async () => {
    const cookie = await bootstrapUser('doc-dup@example.com', 'Dup', 'password1234');
    const first = await request(app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .send({ id: 'd-dup' });
    expect(first.status).toBe(200);
    const second = await request(app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .send({ id: 'd-dup' });
    expect(second.status).toBe(400);
  });

  it('rejects empty patch', async () => {
    const cookie = await bootstrapUser('doc-patch@example.com', 'P', 'password1234');
    await request(app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .send({ id: 'd-p' });
    const res = await request(app)
      .patch('/api/documents/d-p')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(400);
  });

  it('cross-user access returns 404', async () => {
    const adminCookie = await bootstrapUser('doc-xuser@example.com', 'Admin', 'password1234');
    const otherCookie = await createSecondUser(adminCookie);
    await request(app)
      .post('/api/documents')
      .set('Cookie', adminCookie)
      .send({ id: 'a-doc' });

    const list = await request(app).get('/api/documents').set('Cookie', otherCookie);
    expect(list.body.documents).toHaveLength(0);

    const patch = await request(app)
      .patch('/api/documents/a-doc')
      .set('Cookie', otherCookie)
      .send({ title: 'pwn' });
    expect(patch.status).toBe(404);

    const del = await request(app)
      .delete('/api/documents/a-doc')
      .set('Cookie', otherCookie);
    expect(del.status).toBe(404);
  });

  it('auto-assigns sequential order on create', async () => {
    const cookie = await bootstrapUser('doc-order@example.com', 'O', 'password1234');
    const a = await request(app).post('/api/documents').set('Cookie', cookie).send({ id: 'a' });
    const b = await request(app).post('/api/documents').set('Cookie', cookie).send({ id: 'b' });
    const c = await request(app).post('/api/documents').set('Cookie', cookie).send({ id: 'c' });
    expect(a.body.document.order).toBe(0);
    expect(b.body.document.order).toBe(1);
    expect(c.body.document.order).toBe(2);
  });

  it('ignores body-supplied ownerId', async () => {
    const cookie = await bootstrapUser('doc-owner@example.com', 'O', 'password1234');
    const res = await request(app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .send({ id: 'own-d', ownerId: 'attacker' });
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/documents').set('Cookie', cookie);
    expect(list.body.documents).toHaveLength(1);
    expect(list.body.documents[0].ownerId).toBeUndefined();
  });
});
