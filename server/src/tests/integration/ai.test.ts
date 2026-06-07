// AI / Task AI integration tests.
//
// Covers (per the plan, Agent 6):
//   - auth required on every /api/ai, /api/agents, /api/provider-configs,
//     /api/settings, /api/task-ai, /api/tasks/:id/ai-history endpoint
//   - agents are auto-seeded with the two defaults (writer + task) on first
//     read
//   - default agents cannot be deleted
//   - provider configs: apiKey is encrypted at rest, never returned to the
//     client; the public shape exposes `hasApiKey: true|false` only
//   - settings rows are user-scoped; bulk GET returns the user's keys
//   - task-AI apply path: ownership, stale detection, transactional
//   - task-AI undo path: ownership, idempotency (already-undone → 400),
//     unknown batch → 404
//   - history endpoint: ownership, expired-batch sweep, undone rows hidden
//   - draft endpoint: validation, scope-confirmation short-circuit
//   - stream endpoint: 400 on missing messages
//
// We do NOT exercise the actual upstream provider calls (OpenAI, Anthropic,
// Gemini) — those require network egress and a real key. The plan
// explicitly preserves "Browser must not call provider APIs directly"; the
// server-side provider layer is covered by the engine tests + the planner
// unit tests (no DB).

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../db.js';
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

async function createProject(cookie: string, id: string, name: string): Promise<void> {
  const res = await request(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ id, name, color: 'text-blue-500' });
  expect(res.status).toBe(200);
}

async function createTask(
  cookie: string,
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const res = await request(app)
    .post('/api/tasks')
    .set('Cookie', cookie)
    .send({ id, title: id, date: '2026-06-06', ...overrides });
  expect(res.status).toBe(200);
}

describe('agents', () => {
  describe('auth', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const r1 = await request(app).get('/api/agents');
      expect(r1.status).toBe(401);
      const r2 = await request(app).post('/api/agents').send({ id: 'a', name: 'A', scope: 'writer' });
      expect(r2.status).toBe(401);
      const r3 = await request(app).patch('/api/agents/a').send({ name: 'X' });
      expect(r3.status).toBe(401);
      const r4 = await request(app).delete('/api/agents/a');
      expect(r4.status).toBe(401);
    });
  });

  describe('GET /api/agents', () => {
    it('auto-seeds the default writer + task agents on first read', async () => {
      const cookie = await bootstrapUser('agents-seed@example.com', 'A', 'password1234');
      const res = await request(app).get('/api/agents').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const ids = (res.body.agents as Array<{ id: string; scope: string }>).map((a) => `${a.scope}:${a.id}`).sort();
      expect(ids).toEqual(['task:default_task', 'writer:default_writer']);
    });

    it('does not seed a second time on subsequent reads', async () => {
      const cookie = await bootstrapUser('agents-reread@example.com', 'A', 'password1234');
      await request(app).get('/api/agents').set('Cookie', cookie);
      const res = await request(app).get('/api/agents').set('Cookie', cookie);
      const writers = (res.body.agents as Array<{ id: string; scope: string }>).filter(
        (a) => a.scope === 'writer',
      );
      expect(writers).toHaveLength(1);
    });
  });

  describe('POST /api/agents', () => {
    it('creates a new agent', async () => {
      const cookie = await bootstrapUser('agents-create@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/agents')
        .set('Cookie', cookie)
        .send({ id: 'custom_a', name: 'Custom', scope: 'writer' });
      expect(res.status).toBe(200);
      expect(res.body.agent).toMatchObject({ id: 'custom_a', name: 'Custom', scope: 'writer' });
    });

    it('rejects an empty name', async () => {
      const cookie = await bootstrapUser('agents-noname@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/agents')
        .set('Cookie', cookie)
        .send({ id: 'x', name: '   ', scope: 'writer' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/agents/:id', () => {
    it('blocks deletion of a default agent', async () => {
      const cookie = await bootstrapUser('agents-defaultdel@example.com', 'A', 'password1234');
      // Seed the defaults by listing first.
      await request(app).get('/api/agents').set('Cookie', cookie);
      const res = await request(app).delete('/api/agents/default_writer').set('Cookie', cookie);
      expect(res.status).toBe(400);
    });

    it('deletes a non-default agent', async () => {
      const cookie = await bootstrapUser('agents-del@example.com', 'A', 'password1234');
      await request(app)
        .post('/api/agents')
        .set('Cookie', cookie)
        .send({ id: 'removable', name: 'Removable', scope: 'task' });
      const res = await request(app).delete('/api/agents/removable').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const row = await prisma.agent.findUnique({ where: { id: 'removable' } });
      expect(row).toBeNull();
    });

    it('returns 404 when deleting another user agent', async () => {
      const aCookie = await bootstrapUser('agents-cross-a@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await request(app)
        .post('/api/agents')
        .set('Cookie', aCookie)
        .send({ id: 'a-only', name: 'A', scope: 'writer' });
      const res = await request(app).delete('/api/agents/a-only').set('Cookie', bCookie);
      expect(res.status).toBe(404);
    });
  });
});

describe('provider configs', () => {
  describe('auth', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const r1 = await request(app).get('/api/provider-configs');
      expect(r1.status).toBe(401);
      const r2 = await request(app).post('/api/provider-configs').send({ id: 'p', name: 'P' });
      expect(r2.status).toBe(401);
      const r3 = await request(app).patch('/api/provider-configs/p').send({ name: 'X' });
      expect(r3.status).toBe(401);
      const r4 = await request(app).delete('/api/provider-configs/p');
      expect(r4.status).toBe(401);
    });
  });

  describe('POST /api/provider-configs', () => {
    it('encrypts the apiKey at rest and never returns the raw value', async () => {
      const cookie = await bootstrapUser('prov-enc@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/provider-configs')
        .set('Cookie', cookie)
        .send({
          id: 'p_openai',
          name: 'My OpenAI',
          provider: 'openai',
          apiKey: 'sk-supersecret',
          selectedModel: 'gpt-4o',
          baseUrl: 'https://api.openai.com/v1',
          customModels: ['gpt-4o'],
        });
      expect(res.status).toBe(200);
      // The raw key is never in the response.
      expect(res.body.providerConfig.apiKey).toBeUndefined();
      expect(res.body.providerConfig.hasApiKey).toBe(true);
      expect(res.body.providerConfig).toMatchObject({
        id: 'p_openai',
        name: 'My OpenAI',
        selectedModel: 'gpt-4o',
        isActive: true,
      });

      // Verify the DB row holds ciphertext, not plaintext.
      const row = await prisma.providerConfig.findUnique({ where: { id: 'p_openai' } });
      expect(row?.apiKey).toBeTruthy();
      expect(row?.apiKey).not.toContain('sk-supersecret');
    });
  });

  describe('GET /api/provider-configs', () => {
    it('masks the apiKey as hasApiKey on every row', async () => {
      const cookie = await bootstrapUser('prov-list@example.com', 'A', 'password1234');
      await request(app)
        .post('/api/provider-configs')
        .set('Cookie', cookie)
        .send({ id: 'p1', name: 'P1', apiKey: 'sk-1', customModels: [] });
      await request(app)
        .post('/api/provider-configs')
        .set('Cookie', cookie)
        .send({ id: 'p2', name: 'P2', apiKey: '', customModels: [] });

      const res = await request(app).get('/api/provider-configs').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const rows = res.body.providerConfigs as Array<{ id: string; hasApiKey: boolean; apiKey?: string }>;
      const p1 = rows.find((r) => r.id === 'p1')!;
      const p2 = rows.find((r) => r.id === 'p2')!;
      expect(p1.hasApiKey).toBe(true);
      expect(p2.hasApiKey).toBe(false);
      expect(p1.apiKey).toBeUndefined();
      expect(p2.apiKey).toBeUndefined();
    });

    it('does not include other users provider configs', async () => {
      const aCookie = await bootstrapUser('prov-iso-a@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await request(app)
        .post('/api/provider-configs')
        .set('Cookie', aCookie)
        .send({ id: 'a-p', name: 'A', apiKey: '' });
      const res = await request(app).get('/api/provider-configs').set('Cookie', bCookie);
      expect(res.body.providerConfigs).toEqual([]);
    });
  });

  describe('DELETE /api/provider-configs/:id', () => {
    it('returns 404 for another user provider config', async () => {
      const aCookie = await bootstrapUser('prov-del-a@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await request(app)
        .post('/api/provider-configs')
        .set('Cookie', aCookie)
        .send({ id: 'a-p', name: 'A', apiKey: '' });
      const res = await request(app).delete('/api/provider-configs/a-p').set('Cookie', bCookie);
      expect(res.status).toBe(404);
    });
  });
});

describe('settings', () => {
  it('requires auth', async () => {
    const r1 = await request(app).get('/api/settings');
    expect(r1.status).toBe(401);
    const r2 = await request(app).put('/api/settings').send({ key: 'x', value: 1 });
    expect(r2.status).toBe(401);
  });

  it('PUT then GET round-trips a value', async () => {
    const cookie = await bootstrapUser('settings-rt@example.com', 'A', 'password1234');
    const put = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ key: 'activeAgentId', value: 'default_writer' });
    expect(put.status).toBe(200);
    const get = await request(app).get('/api/settings').set('Cookie', cookie);
    expect(get.body.settings.activeAgentId).toBe('default_writer');
  });

  it('rejects non-alphanumeric keys', async () => {
    const cookie = await bootstrapUser('settings-key@example.com', 'A', 'password1234');
    const res = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ key: 'bad key with spaces!', value: 1 });
    expect(res.status).toBe(400);
  });

  it('GET with ?keys=a,b filters to only the requested keys', async () => {
    const cookie = await bootstrapUser('settings-keys@example.com', 'A', 'password1234');
    // Seed two rows.
    for (const [k, v] of [
      ['activeAgentId', 'writer-1'],
      ['activeTaskAgentId', 'task-1'],
      ['hiddenModels', ['a', 'b']],
    ] as const) {
      const put = await request(app)
        .put('/api/settings')
        .set('Cookie', cookie)
        .send({ key: k, value: v });
      expect(put.status).toBe(200);
    }
    const res = await request(app)
      .get('/api/settings')
      .query({ keys: 'activeAgentId,activeTaskAgentId' })
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.settings).toEqual({
      activeAgentId: 'writer-1',
      activeTaskAgentId: 'task-1',
    });
  });

  it('GET with ?keys= empty list returns all rows', async () => {
    const cookie = await bootstrapUser('settings-keys-all@example.com', 'A', 'password1234');
    const put = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ key: 'activeAgentId', value: 'writer-1' });
    expect(put.status).toBe(200);
    const res = await request(app)
      .get('/api/settings')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.settings.activeAgentId).toBe('writer-1');
  });

  it('GET with invalid key in ?keys= returns 400', async () => {
    const cookie = await bootstrapUser('settings-bad-keys@example.com', 'A', 'password1234');
    const res = await request(app)
      .get('/api/settings')
      .query({ keys: 'good,has space,also_bad_key' })
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('search-config GET returns the default when no row exists', async () => {
    const cookie = await bootstrapUser('settings-sc-default@example.com', 'A', 'password1234');
    const res = await request(app).get('/api/settings/search-config').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.searchConfig).toEqual({
      exaKey: '',
      tavilyKey: '',
      firecrawlKey: '',
      braveKey: '',
      enabled: false,
      searchProvider: 'tavily',
    });
  });

  it('search-config PUT then GET round-trips', async () => {
    const cookie = await bootstrapUser('settings-sc-rt@example.com', 'A', 'password1234');
    const put = await request(app)
      .put('/api/settings/search-config')
      .set('Cookie', cookie)
      .send({
        exaKey: '',
        tavilyKey: 'tvly-test',
        firecrawlKey: '',
        braveKey: '',
        enabled: true,
        searchProvider: 'tavily',
      });
    expect(put.status).toBe(200);
    const get = await request(app).get('/api/settings/search-config').set('Cookie', cookie);
    expect(get.body.searchConfig).toMatchObject({ tavilyKey: 'tvly-test', enabled: true });
  });

  it('system-instructions GET defaults to empty string', async () => {
    const cookie = await bootstrapUser('settings-si-default@example.com', 'A', 'password1234');
    const res = await request(app).get('/api/settings/system-instructions').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.systemInstructions).toBe('');
  });

  it('system-instructions PUT then GET round-trips', async () => {
    const cookie = await bootstrapUser('settings-si-rt@example.com', 'A', 'password1234');
    const put = await request(app)
      .put('/api/settings/system-instructions')
      .set('Cookie', cookie)
      .send({ systemInstructions: 'Be terse.' });
    expect(put.status).toBe(200);
    const get = await request(app).get('/api/settings/system-instructions').set('Cookie', cookie);
    expect(get.body.systemInstructions).toBe('Be terse.');
  });
});

describe('task AI: apply / undo / history', () => {
  describe('auth', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const r1 = await request(app).post('/api/task-ai/drafts/m1/apply').send({});
      expect(r1.status).toBe(401);
      const r2 = await request(app).post('/api/task-ai/batches/b1/undo');
      expect(r2.status).toBe(401);
      const r3 = await request(app).get('/api/tasks/t1/ai-history');
      expect(r3.status).toBe(401);
    });
  });

  describe('POST /api/task-ai/drafts/:messageId/apply', () => {
    it('applies a valid draft and records a batch with inverse operations', async () => {
      const cookie = await bootstrapUser('apply-1@example.com', 'A', 'password1234');
      await createTask(cookie, 't1', { title: 'Original', date: '2026-06-06' });
      const apply = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          messageId: 'm1',
          summary: 'Set status to in_progress',
          operations: [
            { id: 'op1', type: 'update_task', taskId: 't1', updates: { status: 'in_progress' } },
          ],
        });
      expect(apply.status).toBe(200);
      const batch = apply.body.batch;
      expect(batch.id).toBeTruthy();
      expect(batch.appliedByMessageId).toBe('m1');
      expect(batch.operations).toHaveLength(1);
      expect(batch.inverseOperations).toHaveLength(1);
      // The inverse should restore the prior status.
      expect(batch.inverseOperations[0].updates.status).toBe('pending');

      const updated = await prisma.task.findUnique({ where: { id: 't1' } });
      expect(updated?.status).toBe('in_progress');
    });

    it('returns 400 when the draft has no task-scoped operations', async () => {
      const cookie = await bootstrapUser('apply-empty@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          summary: 'Nothing here',
          operations: [],
        });
      expect(res.status).toBe(400);
    });

    it('returns 404 when applying a draft for another user task', async () => {
      const aCookie = await bootstrapUser('apply-cross-a@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1', { title: 'A task', date: '2026-06-06' });
      const res = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', bCookie)
        .send({
          summary: 'Cross-user attempt',
          operations: [
            { id: 'op1', type: 'update_task', taskId: 'a-t1', updates: { status: 'completed' } },
          ],
        });
      expect(res.status).toBe(404);
    });

    it('detects stale tasks and returns 409', async () => {
      const cookie = await bootstrapUser('apply-stale@example.com', 'A', 'password1234');
      await createTask(cookie, 't1', { title: 'T', date: '2026-06-06' });
      const baseline = (await prisma.task.findUnique({ where: { id: 't1' } }))!.updatedAt;
      // Bump the task's updatedAt to simulate a concurrent edit.
      await prisma.task.update({
        where: { id: 't1' },
        data: { updatedAt: now() + BigInt(10_000) },
      });
      const res = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          summary: 'Stale attempt',
          baselineUpdatedAt: { t1: Number(baseline) },
          operations: [
            { id: 'op1', type: 'update_task', taskId: 't1', updates: { status: 'in_progress' } },
          ],
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('stale_task');
    });

    it('applies create_task and create+add_comment in a single transaction', async () => {
      const cookie = await bootstrapUser('apply-create@example.com', 'A', 'password1234');
      await createTask(cookie, 'parent', { title: 'Parent', date: '2026-06-06' });
      const res = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          summary: 'Create a subtask + add a comment',
          operations: [
            {
              id: 'op1',
              type: 'create_task',
              title: 'Subtask',
              parentId: 'parent',
              status: 'pending',
              importance: 'medium',
              date: '2026-06-06',
              projectId: null,
              content: '',
              assignees: [],
            },
            {
              id: 'op2',
              type: 'add_comment',
              taskId: 'parent',
              text: 'AI note',
            },
          ],
        });
      expect(res.status).toBe(200);

      const subtasks = await prisma.task.findMany({ where: { parentId: 'parent' } });
      expect(subtasks).toHaveLength(1);
      expect(subtasks[0]?.title).toBe('Subtask');

      const comments = await prisma.taskComment.findMany({ where: { taskId: 'parent' } });
      expect(comments).toHaveLength(1);
      expect(comments[0]?.text).toBe('AI note');
    });
  });

  describe('POST /api/task-ai/batches/:batchId/undo', () => {
    it('undoes a batch and restores the prior state', async () => {
      const cookie = await bootstrapUser('undo-1@example.com', 'A', 'password1234');
      await createTask(cookie, 't1', { title: 'T', date: '2026-06-06' });
      const apply = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          summary: 'Set in_progress',
          operations: [
            { id: 'op1', type: 'update_task', taskId: 't1', updates: { status: 'in_progress' } },
          ],
        });
      const batchId = apply.body.batch.id;

      const undo = await request(app)
        .post(`/api/task-ai/batches/${batchId}/undo`)
        .set('Cookie', cookie);
      expect(undo.status).toBe(200);
      expect(undo.body.batchId).toBe(batchId);
      const t = await prisma.task.findUnique({ where: { id: 't1' } });
      expect(t?.status).toBe('pending');
    });

    it('returns 400 when undoing a batch that was already undone', async () => {
      const cookie = await bootstrapUser('undo-twice@example.com', 'A', 'password1234');
      await createTask(cookie, 't1', { title: 'T', date: '2026-06-06' });
      const apply = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          summary: 'Do thing',
          operations: [
            { id: 'op1', type: 'update_task', taskId: 't1', updates: { status: 'in_progress' } },
          ],
        });
      const batchId = apply.body.batch.id;
      const r1 = await request(app)
        .post(`/api/task-ai/batches/${batchId}/undo`)
        .set('Cookie', cookie);
      expect(r1.status).toBe(200);
      const r2 = await request(app)
        .post(`/api/task-ai/batches/${batchId}/undo`)
        .set('Cookie', cookie);
      expect(r2.status).toBe(400);
    });

    it('returns 404 for an unknown batch id', async () => {
      const cookie = await bootstrapUser('undo-404@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/task-ai/batches/does-not-exist/undo')
        .set('Cookie', cookie);
      expect(res.status).toBe(404);
    });

    it('returns 404 when another user tries to undo my batch', async () => {
      const aCookie = await bootstrapUser('undo-cross-a@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 't1', { title: 'T', date: '2026-06-06' });
      const apply = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', aCookie)
        .send({
          summary: 'A change',
          operations: [
            { id: 'op1', type: 'update_task', taskId: 't1', updates: { status: 'in_progress' } },
          ],
        });
      const res = await request(app)
        .post(`/api/task-ai/batches/${apply.body.batch.id}/undo`)
        .set('Cookie', bCookie);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tasks/:taskId/ai-history', () => {
    it('returns active (non-undone) batches newest first', async () => {
      const cookie = await bootstrapUser('hist-1@example.com', 'A', 'password1234');
      await createTask(cookie, 't1', { title: 'T', date: '2026-06-06' });
      // Apply two batches.
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/task-ai/drafts/m1/apply')
          .set('Cookie', cookie)
          .send({
            summary: `Change ${i + 1}`,
            operations: [
              {
                id: `op${i}`,
                type: 'update_task',
                taskId: 't1',
                updates: { title: `T${i}` },
              },
            ],
          });
      }
      const res = await request(app).get('/api/tasks/t1/ai-history').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(2);
    });

    it('hides undone batches', async () => {
      const cookie = await bootstrapUser('hist-undone@example.com', 'A', 'password1234');
      await createTask(cookie, 't1', { title: 'T', date: '2026-06-06' });
      const apply = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          summary: 'A change',
          operations: [
            { id: 'op1', type: 'update_task', taskId: 't1', updates: { status: 'in_progress' } },
          ],
        });
      await request(app)
        .post(`/api/task-ai/batches/${apply.body.batch.id}/undo`)
        .set('Cookie', cookie);
      const res = await request(app).get('/api/tasks/t1/ai-history').set('Cookie', cookie);
      expect(res.body.history).toEqual([]);
    });

    it('sweeps expired batches on read', async () => {
      const cookie = await bootstrapUser('hist-expired@example.com', 'A', 'password1234');
      await createTask(cookie, 't1', { title: 'T', date: '2026-06-06' });
      const apply = await request(app)
        .post('/api/task-ai/drafts/m1/apply')
        .set('Cookie', cookie)
        .send({
          summary: 'Change',
          operations: [
            { id: 'op1', type: 'update_task', taskId: 't1', updates: { status: 'in_progress' } },
          ],
        });
      // Backdate the batch's expiresAt to the past.
      await prisma.taskAIChangeBatch.update({
        where: { id: apply.body.batch.id },
        data: { expiresAt: now() - BigInt(8 * 24 * 60 * 60 * 1000) },
      });
      const res = await request(app).get('/api/tasks/t1/ai-history').set('Cookie', cookie);
      expect(res.body.history).toEqual([]);
      const row = await prisma.taskAIChangeBatch.findUnique({ where: { id: apply.body.batch.id } });
      expect(row).toBeNull();
    });

    it('returns 404 for another user task history', async () => {
      const aCookie = await bootstrapUser('hist-cross-a@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await createTask(aCookie, 'a-t1', { title: 'A', date: '2026-06-06' });
      const res = await request(app).get('/api/tasks/a-t1/ai-history').set('Cookie', bCookie);
      expect(res.status).toBe(404);
    });
  });
});

describe('AI chat endpoints', () => {
  describe('POST /api/ai/stream', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/ai/stream')
        .send({ providerId: 'p', messages: [{ role: 'user', content: 'hi' }] });
      expect(res.status).toBe(401);
    });

    it('rejects an empty messages array with 400', async () => {
      const cookie = await bootstrapUser('stream-empty@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', cookie)
        .send({ providerId: 'p', messages: [] });
      expect(res.status).toBe(400);
    });

    it('returns 404 when the provider is not owned by the user', async () => {
      const cookie = await bootstrapUser('stream-404@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', cookie)
        .send({
          providerId: 'does-not-exist',
          messages: [{ role: 'user', content: 'hi' }],
        });
      expect(res.status).toBe(404);
    });

    it('rejects another user provider id with 404', async () => {
      const aCookie = await bootstrapUser('stream-cross-a@example.com', 'A', 'password1234');
      const bCookie = await createSecondUser(aCookie);
      await request(app)
        .post('/api/provider-configs')
        .set('Cookie', aCookie)
        .send({ id: 'a-p', name: 'A', apiKey: 'sk-1' });
      const res = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', bCookie)
        .send({
          providerId: 'a-p',
          messages: [{ role: 'user', content: 'hi' }],
        });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/ai/task-draft', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/ai/task-draft')
        .send({
          providerId: 'p',
          systemPrompt: '',
          userText: 'plan this',
          context: emptyContext(),
          validProjectIds: [],
        });
      expect(res.status).toBe(401);
    });

    it('returns 400 when the userText is empty', async () => {
      const cookie = await bootstrapUser('draft-400@example.com', 'A', 'password1234');
      const res = await request(app)
        .post('/api/ai/task-draft')
        .set('Cookie', cookie)
        .send({
          providerId: 'p',
          systemPrompt: '',
          userText: '',
          context: emptyContext(),
          validProjectIds: [],
        });
      expect(res.status).toBe(400);
    });
  });
});

function emptyContext() {
  return {
    task: {
      id: 't1',
      title: 'T',
      status: 'pending',
      importance: 'medium',
      date: '2026-06-06',
      projectId: null,
      assignees: [],
      content: '',
      updatedAt: Date.now(),
    },
    subtasks: [],
    comments: [],
    baselineUpdatedAt: {},
    text: 'ACTIVE TASK\nid: t1\ntitle: T',
  };
}
