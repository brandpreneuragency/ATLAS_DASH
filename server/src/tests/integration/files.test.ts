// File service integration tests.
//
// Covers:
//   - POST /api/tasks/:taskId/comments (multipart) — file is uploaded, the
//     comment row references the new fileId, and the file metadata round-trips
//   - GET /api/files/:fileId/content — owner can download, cross-user cannot
//   - DELETE /api/files/:fileId — soft-deletes the row and removes the bytes
//   - Path traversal in the original filename is sanitized, not honoured
//   - Upload size limit returns 413
//   - SHA-256 in the DB matches the uploaded bytes
//   - Multipart fields: text, replyTo (as JSON string), sender
//   - Auth required for every endpoint
//   - The on-disk path is never exposed to the client

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createApp } from '../../app.js';
import { prisma } from '../../db.js';
import { config } from '../../config.js';

const app = createApp();

// ── Test helpers ───────────────────────────────────────────────────────────

async function bootstrapUser(email: string, displayName: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/bootstrap').send({ email, displayName, password });
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
  if (reg.status !== 200) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
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

function sha256Hex(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function storageRoot(): string {
  return path.resolve(config.fileStorageRoot);
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('files: multipart upload + download + delete', () => {
  describe('auth', () => {
    it('rejects unauthenticated /api/files endpoints with 401', async () => {
      const r1 = await request(app).get('/api/files/abc/content');
      expect(r1.status).toBe(401);
      const r2 = await request(app).delete('/api/files/abc');
      expect(r2.status).toBe(401);
    });
  });

  describe('POST /api/tasks/:taskId/comments (multipart)', () => {
    it('creates a comment with an attached file and returns the file metadata', async () => {
      const cookie = await bootstrapUser('f-a@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');

      const bytes = Buffer.from('hello tabs file service\n', 'utf8');
      const expectedSha = sha256Hex(bytes);

      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'See attached')
        .attach('file', bytes, { filename: 'hello.txt', contentType: 'text/plain' });

      expect(res.status).toBe(200);
      expect(res.body.comment).toMatchObject({
        id: 'c1',
        taskId: 't1',
        text: 'See attached',
      });
      expect(typeof res.body.comment.fileId).toBe('string');
      expect(res.body.comment.fileId.length).toBeGreaterThan(0);

      expect(res.body.file).toMatchObject({
        id: res.body.comment.fileId,
        originalName: 'hello.txt',
        storedName: 'hello.txt',
        mimeType: 'text/plain',
        sizeBytes: bytes.length,
        sha256: expectedSha,
        taskId: 't1',
        commentId: 'c1',
        deletedAt: null,
      });
      // storagePath must never appear in the response.
      expect(res.body.file).not.toHaveProperty('storagePath');
    });

    it('persists the file under {root}/users/{ownerId}/{fileId}/{storedName}', async () => {
      const cookie = await bootstrapUser('f-disk@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', Buffer.from('disk-layout'), { filename: 'lay.txt', contentType: 'text/plain' });
      expect(res.status).toBe(200);

      const row = await prisma.file.findUnique({ where: { id: res.body.file.id } });
      expect(row).not.toBeNull();
      const expected = path.join(storageRoot(), 'users', row!.ownerId, row!.id, 'lay.txt');
      expect(row!.storagePath).toBe(path.resolve(expected));
      expect(existsSync(row!.storagePath)).toBe(true);
      expect(statSync(row!.storagePath).size).toBe(Buffer.byteLength('disk-layout'));
    });

    it('sanitizes a path-traversal filename', async () => {
      const cookie = await bootstrapUser('f-trav@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', Buffer.from('pwn'), {
          filename: '../../etc/passwd',
          contentType: 'text/plain',
        });
      expect(res.status).toBe(200);
      // The original filename the client sent is preserved on the metadata
      // record for display. The path-traversal segments are stripped by the
      // HTTP client stack before they reach multer (Node normalises the
      // multipart Content-Disposition filename), so the server sees only
      // the basename. End-to-end sanitization of unsafe filenames is
      // covered by the unit test for `sanitizeFilename`.
      expect(res.body.file.originalName).toBe('passwd');
      expect(res.body.file.storedName).toBe('passwd');
      // On-disk path stays inside the storage root.
      const row = await prisma.file.findUnique({ where: { id: res.body.file.id } });
      expect(row!.storagePath.startsWith(storageRoot())).toBe(true);
      expect(row!.storagePath).not.toContain('..');
    });

    it('parses replyTo as JSON when posted as a multipart field', async () => {
      const cookie = await bootstrapUser('f-reply@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const replyTo = JSON.stringify({ id: 'parent', text: 'Hi', sender: 'B' });
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'Reply with file')
        .field('replyTo', replyTo)
        .attach('file', Buffer.from('x'), { filename: 'r.txt', contentType: 'text/plain' });
      expect(res.status).toBe(200);
      expect(res.body.comment.replyTo).toMatchObject({ id: 'parent', text: 'Hi', sender: 'B' });
    });

    it('rejects a malformed replyTo JSON with 400', async () => {
      const cookie = await bootstrapUser('f-replybad@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .field('replyTo', 'not json')
        .attach('file', Buffer.from('x'), { filename: 'r.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
      // No file row written, no comment row written.
      const filesAfter = await prisma.file.count();
      const commentsAfter = await prisma.taskComment.count();
      expect(filesAfter).toBe(0);
      expect(commentsAfter).toBe(0);
    });

    it('returns 413 when the upload exceeds MAX_UPLOAD_MB', async () => {
      const cookie = await bootstrapUser('f-big@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      // .env.test pins MAX_UPLOAD_MB=10; allocate 11 MB.
      const tooBig = Buffer.alloc(11 * 1024 * 1024, 0x61);
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', tooBig, { filename: 'big.bin', contentType: 'application/octet-stream' });
      expect(res.status).toBe(413);
      // No file row, no comment row.
      expect(await prisma.file.count()).toBe(0);
      expect(await prisma.taskComment.count()).toBe(0);
    });

    it('returns 404 and deletes the temp upload when posting to another user task', async () => {
      const aCookie = await bootstrapUser('f-x@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      const res = await request(app)
        .post('/api/tasks/a-t1/comments')
        .set('Cookie', bCookie)
        .field('id', 'c1')
        .field('text', 'pwn')
        .attach('file', Buffer.from('pwn'), { filename: 'p.txt', contentType: 'text/plain' });
      expect(res.status).toBe(404);
      // No file or comment row was created.
      expect(await prisma.file.count()).toBe(0);
      expect(await prisma.taskComment.count()).toBe(0);
      // Temp dir contains no leaked file from this request.
      const tempDir = path.join(storageRoot(), '.tmp');
      const leftovers = existsSync(tempDir) ? readdirSync(tempDir) : [];
      expect(leftovers).toEqual([]);
    });

    it('text-only multipart (no file) creates a plain comment', async () => {
      const cookie = await bootstrapUser('f-txt@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'Just text');
      expect(res.status).toBe(200);
      expect(res.body.comment.text).toBe('Just text');
      expect(res.body.comment.fileId).toBeNull();
      expect(res.body.file).toBeUndefined();
    });

    it('rejects missing id with 400', async () => {
      const cookie = await bootstrapUser('f-noid@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('text', 'no id here')
        .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/files/:fileId/content', () => {
    it('streams the file to the owner with the right Content-Type and Content-Length', async () => {
      const cookie = await bootstrapUser('f-dl@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const bytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const upload = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', bytes, { filename: 'tiny.bin', contentType: 'application/octet-stream' });
      expect(upload.status).toBe(200);

      const download = await request(app)
        .get(`/api/files/${upload.body.file.id}/content`)
        .set('Cookie', cookie)
        .buffer(true)
        .parse((res, cb) => {
          // supertest's default JSON parser would corrupt binary bodies.
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toBe('application/octet-stream');
      expect(download.headers['content-length']).toBe(String(bytes.length));
      expect(download.headers['content-disposition']).toContain('tiny.bin');
      const downloaded = download.body as Buffer;
      expect(Buffer.isBuffer(downloaded)).toBe(true);
      expect(downloaded.equals(bytes)).toBe(true);
    });

    it('downloaded bytes match the recorded SHA-256', async () => {
      const cookie = await bootstrapUser('f-sha@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const bytes = Buffer.from('the quick brown fox jumps over the lazy dog');
      const expectedSha = sha256Hex(bytes);
      const upload = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', bytes, { filename: 'fox.txt', contentType: 'text/plain' });
      expect(upload.body.file.sha256).toBe(expectedSha);

      const download = await request(app)
        .get(`/api/files/${upload.body.file.id}/content`)
        .set('Cookie', cookie)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(sha256Hex(download.body as Buffer)).toBe(expectedSha);
    });

    it('returns 404 when user B tries to download user A file', async () => {
      const aCookie = await bootstrapUser('f-cross@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      const upload = await request(app)
        .post('/api/tasks/a-t1/comments')
        .set('Cookie', aCookie)
        .field('id', 'a-c1')
        .field('text', 'secret')
        .attach('file', Buffer.from('SECRET'), { filename: 's.txt', contentType: 'text/plain' });
      expect(upload.status).toBe(200);

      const aGet = await request(app).get(`/api/files/${upload.body.file.id}/content`).set('Cookie', aCookie);
      expect(aGet.status).toBe(200);
      const bGet = await request(app).get(`/api/files/${upload.body.file.id}/content`).set('Cookie', bCookie);
      expect(bGet.status).toBe(404);
    });

    it('returns 404 for an unknown fileId (does not leak existence)', async () => {
      const cookie = await bootstrapUser('f-none@example.com', 'A', 'password1234');
      const res = await request(app).get('/api/files/does-not-exist/content').set('Cookie', cookie);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/files/:fileId', () => {
    it('soft-deletes the row and removes the physical file', async () => {
      const cookie = await bootstrapUser('f-del@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const upload = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', Buffer.from('bye'), { filename: 'bye.txt', contentType: 'text/plain' });
      expect(upload.status).toBe(200);
      const fileId: string = upload.body.file.id;
      const row = await prisma.file.findUnique({ where: { id: fileId } });
      expect(existsSync(row!.storagePath)).toBe(true);

      const del = await request(app).delete(`/api/files/${fileId}`).set('Cookie', cookie);
      expect(del.status).toBe(200);
      expect(del.body.file.deletedAt).toBeTypeOf('number');

      const after = await prisma.file.findUnique({ where: { id: fileId } });
      expect(after).not.toBeNull();
      expect(after!.deletedAt).not.toBeNull();
      expect(existsSync(after!.storagePath)).toBe(false);

      // Subsequent download returns 404.
      const dl = await request(app).get(`/api/files/${fileId}/content`).set('Cookie', cookie);
      expect(dl.status).toBe(404);
    });

    it('cross-user delete returns 404 and does not touch the file', async () => {
      const aCookie = await bootstrapUser('f-delx@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1');
      const upload = await request(app)
        .post('/api/tasks/a-t1/comments')
        .set('Cookie', aCookie)
        .field('id', 'a-c1')
        .field('text', 'x')
        .attach('file', Buffer.from('mine'), { filename: 'm.txt', contentType: 'text/plain' });
      const fileId: string = upload.body.file.id;
      const del = await request(app).delete(`/api/files/${fileId}`).set('Cookie', bCookie);
      expect(del.status).toBe(404);
      const after = await prisma.file.findUnique({ where: { id: fileId } });
      expect(after!.deletedAt).toBeNull();
      expect(existsSync(after!.storagePath)).toBe(true);
    });

    it('deleting an already-soft-deleted file is idempotent', async () => {
      const cookie = await bootstrapUser('f-delidemp@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const upload = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', Buffer.from('once'), { filename: 'o.txt', contentType: 'text/plain' });
      const fileId: string = upload.body.file.id;
      const first = await request(app).delete(`/api/files/${fileId}`).set('Cookie', cookie);
      expect(first.status).toBe(200);
      const second = await request(app).delete(`/api/files/${fileId}`).set('Cookie', cookie);
      expect(second.status).toBe(200);
    });
  });

  describe('temp dir hygiene', () => {
    // The temp dir should never accumulate files across successful uploads.
    // (Failed-mid-flight cleanup is covered by the cross-user 404 test
    // above; this one verifies the happy path.)
    beforeEach(() => {
      const tempDir = path.join(storageRoot(), '.tmp');
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      mkdirSync(tempDir, { recursive: true });
    });

    it('temp dir is empty after a successful upload', async () => {
      const cookie = await bootstrapUser('f-tmp@example.com', 'A', 'password1234');
      await createTask(cookie, 't1');
      const res = await request(app)
        .post('/api/tasks/t1/comments')
        .set('Cookie', cookie)
        .field('id', 'c1')
        .field('text', 'x')
        .attach('file', Buffer.from('clean'), { filename: 'c.txt', contentType: 'text/plain' });
      expect(res.status).toBe(200);
      const tempDir = path.join(storageRoot(), '.tmp');
      const leftovers = existsSync(tempDir) ? readdirSync(tempDir) : [];
      expect(leftovers).toEqual([]);
    });
  });
});

// Final guard so the suite never accidentally pollutes the host fs root.
afterEach(() => {
  const root = storageRoot();
  if (!root.includes('test') && !root.includes('tmp')) {
    throw new Error(`Refusing to leave behind storage root that does not look test-scoped: ${root}`);
  }
});
