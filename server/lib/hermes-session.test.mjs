import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendQueryParam,
  cookieHeaderFromSetCookie,
  mergeCookieHeaders,
  createHermesSession,
  mintBasicSessionCookieHeader,
  signHermesBasicToken,
  decodeBasicAuthSecret,
} from './hermes-session.mjs';
import crypto from 'node:crypto';

test('cookieHeaderFromSetCookie keeps name=value and drops attributes', () => {
  const header = cookieHeaderFromSetCookie([
    'hermes_session_at=tok123; Path=/; HttpOnly; SameSite=Lax',
    'hermes_session_rt=rt456; Path=/; HttpOnly',
    'hermes_session_provider=basic; Path=/',
  ]);
  assert.equal(
    header,
    'hermes_session_at=tok123; hermes_session_rt=rt456; hermes_session_provider=basic',
  );
});

test('cookieHeaderFromSetCookie ignores empty / malformed', () => {
  assert.equal(cookieHeaderFromSetCookie([]), '');
  assert.equal(cookieHeaderFromSetCookie(['nope', '', 'a=b']), 'a=b');
});

test('mergeCookieHeaders overwrites by name', () => {
  assert.equal(
    mergeCookieHeaders('hermes_session_at=old; hermes_session_provider=basic', 'hermes_session_at=new'),
    'hermes_session_at=new; hermes_session_provider=basic',
  );
});

test('appendQueryParam handles bare path and existing query', () => {
  assert.equal(appendQueryParam('/api/ws', 'ticket', 'abc'), '/api/ws?ticket=abc');
  assert.equal(appendQueryParam('/api/ws?x=1', 'ticket', 'a+b'), '/api/ws?x=1&ticket=a%2Bb');
});

test('createHermesSession logs in and caches cookies', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith('/auth/password-login')) {
      return {
        ok: true,
        status: 200,
        headers: {
          getSetCookie: () => [
            'hermes_session_at=AT; Path=/; HttpOnly',
            'hermes_session_provider=basic; Path=/',
          ],
        },
        json: async () => ({ ok: true }),
        text: async () => '',
      };
    }
    throw new Error(`unexpected ${url}`);
  };

  const session = createHermesSession({
    target: 'http://127.0.0.1:9119',
    username: 'user',
    password: 'pass',
    fetchImpl,
  });
  assert.equal(session.hasCredentials(), true);
  const cookie = await session.ensureCookie();
  assert.equal(cookie, 'hermes_session_at=AT; hermes_session_provider=basic');
  // second call uses cache — no extra login
  await session.ensureCookie();
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/password-login$/);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.provider, 'basic');
  assert.equal(body.username, 'user');
});

test('createHermesSession mintWsTicket retries after 401', async () => {
  let loginCount = 0;
  let ticketCalls = 0;
  const fetchImpl = async (url, init) => {
    if (String(url).endsWith('/auth/password-login')) {
      loginCount += 1;
      return {
        ok: true,
        status: 200,
        headers: {
          getSetCookie: () => [`hermes_session_at=AT${loginCount}; Path=/`],
        },
        json: async () => ({ ok: true }),
        text: async () => '',
      };
    }
    if (String(url).endsWith('/api/auth/ws-ticket')) {
      ticketCalls += 1;
      if (ticketCalls === 1) {
        return { ok: false, status: 401, text: async () => 'nope', json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ ticket: 'tkt-ok', ttl_seconds: 30 }),
      };
    }
    throw new Error(`unexpected ${url}`);
  };

  const session = createHermesSession({
    target: 'http://127.0.0.1:9119',
    username: 'user',
    password: 'pass',
    fetchImpl,
  });
  const ticket = await session.mintWsTicket();
  assert.equal(ticket, 'tkt-ok');
  assert.equal(loginCount, 2);
  assert.equal(ticketCalls, 2);
});

test('createHermesSession without credentials is a no-op', async () => {
  const session = createHermesSession({ target: 'http://127.0.0.1:9119' });
  assert.equal(session.hasCredentials(), false);
  assert.equal(await session.ensureCookie(), '');
});

test('mintBasicSessionCookieHeader produces verifiable HMAC tokens', () => {
  const secret = '0123456789abcdef0123456789abcdef'; // 32 hex chars → 16 bytes
  const header = mintBasicSessionCookieHeader({
    username: 'burakodev',
    secret,
    nowSeconds: 1_700_000_000,
    accessTtlSeconds: 3600,
  });
  assert.match(header, /^hermes_session_at=/);
  assert.match(header, /hermes_session_rt=/);
  assert.match(header, /hermes_session_provider=basic/);

  const at = header.split('; ')[0].slice('hermes_session_at='.length);
  // accept padded urlsafe b64
  const blob = Buffer.from(at.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const raw = blob.subarray(0, blob.length - 32);
  const sig = blob.subarray(blob.length - 32);
  const expected = crypto
    .createHmac('sha256', decodeBasicAuthSecret(secret))
    .update(raw)
    .digest();
  assert.equal(Buffer.compare(sig, expected), 0);
  const payload = JSON.parse(raw.toString());
  assert.equal(payload.sub, 'burakodev');
  assert.equal(payload.kind, 'access');
  assert.equal(payload.exp, 1_700_000_000 + 3600);
});

test('createHermesSession mints locally when secret is set (no password)', async () => {
  const secret = 'a'.repeat(32);
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    throw new Error('should not fetch');
  };
  const session = createHermesSession({
    target: 'http://127.0.0.1:9119',
    username: 'u',
    secret,
    fetchImpl,
  });
  assert.equal(session.hasCredentials(), true);
  const cookie = await session.ensureCookie();
  assert.match(cookie, /hermes_session_at=/);
  assert.equal(fetchCalled, false);
  // signHermesBasicToken smoke
  const tok = signHermesBasicToken({ a: 1 }, decodeBasicAuthSecret(secret));
  assert.equal(typeof tok, 'string');
  assert.ok(tok.length > 10);
});
