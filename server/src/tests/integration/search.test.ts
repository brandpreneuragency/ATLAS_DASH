// Search integration tests.
//
// Covers the security and behaviour of the `POST /api/ai/search` endpoint:
//   - auth required
//   - returns 400 when search is disabled
//   - returns 400 when the query is empty
//   - returns 400 when the chosen provider has no API key
//   - with a faked global `fetch`, returns the upstream results
//   - never leaks the user's stored api key in the response
//
// We stub `globalThis.fetch` so we don't hit the real Tavily / Firecrawl
// APIs from the test suite.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { prisma } from '../../db.js';
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

async function findUserId(email: string): Promise<string> {
  const user = await prisma.user.findFirstOrThrow({ where: { email } });
  return user.id;
}

async function putSearchConfig(email: string, cfg: object): Promise<void> {
  const userId = await findUserId(email);
  await prisma.setting.upsert({
    where: { ownerId_key: { ownerId: userId, key: 'searchConfig' } },
    create: { ownerId: userId, key: 'searchConfig', valueJson: JSON.stringify(cfg) },
    update: { valueJson: JSON.stringify(cfg) },
  });
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('POST /api/ai/search', () => {
  it('requires auth', async () => {
    const res = await request(app)
      .post('/api/ai/search')
      .send({ query: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when the query is empty', async () => {
    const cookie = await bootstrapUser('search-empty@example.com', 'A', 'password1234');
    const res = await request(app)
      .post('/api/ai/search')
      .set('Cookie', cookie)
      .send({ query: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when search is disabled', async () => {
    const cookie = await bootstrapUser('search-disabled@example.com', 'A', 'password1234');
    const res = await request(app)
      .post('/api/ai/search')
      .set('Cookie', cookie)
      .send({ query: 'hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the configured provider has no API key', async () => {
    const email = 'search-nokey@example.com';
    const cookie = await bootstrapUser(email, 'A', 'password1234');
    await putSearchConfig(email, { enabled: true, searchProvider: 'tavily', tavilyKey: '' });
    const res = await request(app)
      .post('/api/ai/search')
      .set('Cookie', cookie)
      .send({ query: 'hello' });
    expect(res.status).toBe(400);
  });

  it('returns upstream results for a valid Tavily request', async () => {
    const email = 'search-tavily@example.com';
    const cookie = await bootstrapUser(email, 'A', 'password1234');
    await putSearchConfig(email, { enabled: true, searchProvider: 'tavily', tavilyKey: 'tvly-test' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { title: 'A', url: 'https://a.example', content: 'aaa', score: 0.9 },
          { title: 'B', url: 'https://b.example', content: 'bbb', score: 0.5 },
        ],
      }),
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const res = await request(app)
      .post('/api/ai/search')
      .set('Cookie', cookie)
      .send({ query: 'hello', maxResults: 3 });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toEqual({
      title: 'A',
      url: 'https://a.example',
      snippet: 'aaa',
      score: 0.9,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('tavily.com/search');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('returns 502 when the upstream Tavily call returns a non-2xx response', async () => {
    const email = 'search-tavily-fail@example.com';
    const cookie = await bootstrapUser(email, 'A', 'password1234');
    await putSearchConfig(email, { enabled: true, searchProvider: 'tavily', tavilyKey: 'tvly-test' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    } as Response) as unknown as typeof globalThis.fetch;
    const res = await request(app)
      .post('/api/ai/search')
      .set('Cookie', cookie)
      .send({ query: 'hello' });
    expect(res.status).toBe(502);
  });

  it('refuses unsupported search providers with a 500', async () => {
    const email = 'search-unsupported@example.com';
    const cookie = await bootstrapUser(email, 'A', 'password1234');
    await putSearchConfig(email, { enabled: true, searchProvider: 'exa', exaKey: 'x' });
    const res = await request(app)
      .post('/api/ai/search')
      .set('Cookie', cookie)
      .send({ query: 'hello' });
    expect(res.status).toBe(500);
    // The server's central error handler intentionally hides the message
    // for 500s; we still check that we get a 500.
    expect(res.body).toBeDefined();
  });

  it('does not leak the api key in the response', async () => {
    const email = 'search-leak@example.com';
    const cookie = await bootstrapUser(email, 'A', 'password1234');
    await putSearchConfig(email, { enabled: true, searchProvider: 'tavily', tavilyKey: 'tvly-test' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const res = await request(app)
      .post('/api/ai/search')
      .set('Cookie', cookie)
      .send({ query: 'hello' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('tvly-test');
  });
});
