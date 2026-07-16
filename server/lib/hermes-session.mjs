// server/lib/hermes-session.mjs — Hermes gated-mode session for tabs_api.
// When the dashboard binds non-loopback, Bearer HERMES_DASHBOARD_SESSION_TOKEN is ignored;
// only a session cookie (and single-use ?ticket= for WebSockets) authenticates API calls.
//
// Two ways to obtain cookies:
//   1. Password login: POST /auth/password-login (public API)
//   2. Local mint: HMAC-sign tokens with dashboard.basic_auth.secret
//      (matches plugins/dashboard_auth/basic — used as a service seam when
//      the plaintext password is not available on the host)
import crypto from 'node:crypto';

const DEFAULT_ACCESS_TTL = 12 * 60 * 60; // 12h — same as Hermes basic provider
const REFRESH_TTL = 30 * 24 * 60 * 60; // 30d

/**
 * Parse Set-Cookie header values into a Cookie request header string.
 * @param {string[]} setCookieHeaders
 * @returns {string}
 */
export function cookieHeaderFromSetCookie(setCookieHeaders) {
  if (!Array.isArray(setCookieHeaders) || setCookieHeaders.length === 0) return '';
  const pairs = [];
  for (const raw of setCookieHeaders) {
    if (typeof raw !== 'string' || !raw) continue;
    const pair = raw.split(';', 1)[0].trim();
    if (pair && pair.includes('=')) pairs.push(pair);
  }
  return pairs.join('; ');
}

/**
 * Merge/override cookies by name (rightmost wins).
 * @param {string} existing
 * @param {string} incoming
 */
export function mergeCookieHeaders(existing, incoming) {
  const map = new Map();
  for (const src of [existing, incoming]) {
    if (!src) continue;
    for (const part of src.split(';')) {
      const pair = part.trim();
      if (!pair.includes('=')) continue;
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1);
      if (name) map.set(name, value);
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Append a query param to a path/url that may already have a query string.
 * @param {string} path
 * @param {string} key
 * @param {string} value
 */
export function appendQueryParam(path, key, value) {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

/**
 * Decode Hermes basic_auth.secret (base64, hex, or raw utf-8) to Buffer.
 * Mirrors the provider's flexible secret loading.
 * @param {string} secret
 * @returns {Buffer}
 */
export function decodeBasicAuthSecret(secret) {
  const s = String(secret || '').trim();
  if (!s) throw new Error('empty hermes basic_auth secret');
  // Match plugins/dashboard_auth/basic._resolve_secret: base64, then hex, then utf-8.
  try {
    const b64 = Buffer.from(s, 'base64');
    if (b64.length >= 16) return b64;
  } catch {
    // fall through
  }
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    try {
      const hex = Buffer.from(s, 'hex');
      if (hex.length >= 16) return hex;
    } catch {
      // fall through
    }
  }
  return Buffer.from(s, 'utf8');
}

/**
 * Sign a payload the same way plugins/dashboard_auth/basic._sign does:
 * urlsafe_b64(json_bytes + hmac_sha256(json_bytes)).
 * @param {Record<string, unknown>} payload
 * @param {Buffer} secretBytes
 */
/** urlsafe b64 with padding — matches Python base64.urlsafe_b64encode().decode() */
export function toUrlsafeB64(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function signHermesBasicToken(payload, secretBytes) {
  // Key order must match Hermes _mint_session: sub, kind, exp
  const raw = Buffer.from(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secretBytes).update(raw).digest();
  return toUrlsafeB64(Buffer.concat([raw, sig]));
}

/**
 * Build a Cookie header with hermes_session_* cookies for the basic provider.
 * @param {{
 *   username: string,
 *   secret: string,
 *   provider?: string,
 *   accessTtlSeconds?: number,
 *   nowSeconds?: number,
 * }} opts
 */
export function mintBasicSessionCookieHeader({
  username,
  secret,
  provider = 'basic',
  accessTtlSeconds = DEFAULT_ACCESS_TTL,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!username) throw new Error('username required to mint hermes session');
  const secretBytes = decodeBasicAuthSecret(secret);
  if (secretBytes.length < 16) throw new Error('hermes basic_auth secret too short');
  const ttl = Math.max(60, Number(accessTtlSeconds) || DEFAULT_ACCESS_TTL);
  const exp = nowSeconds + ttl;
  const access = signHermesBasicToken(
    { sub: username, kind: 'access', exp },
    secretBytes,
  );
  const refresh = signHermesBasicToken(
    { sub: username, kind: 'refresh', exp: nowSeconds + REFRESH_TTL },
    secretBytes,
  );
  return [
    `hermes_session_at=${access}`,
    `hermes_session_rt=${refresh}`,
    `hermes_session_provider=${provider}`,
  ].join('; ');
}

/**
 * @param {{
 *   target: string,
 *   username?: string,
 *   password?: string,
 *   secret?: string,
 *   provider?: string,
 *   accessTtlSeconds?: number,
 *   fetchImpl?: typeof fetch,
 * }} opts
 */
export function createHermesSession({
  target,
  username = '',
  password = '',
  secret = '',
  provider = 'basic',
  accessTtlSeconds = DEFAULT_ACCESS_TTL,
  fetchImpl = globalThis.fetch,
}) {
  const base = String(target || '').replace(/\/$/, '');
  let cookieHeader = '';
  let loginInflight = null;

  const canPasswordLogin = () => Boolean(username && password && base);
  const canMint = () => Boolean(username && secret);
  const hasCredentials = () => canPasswordLogin() || canMint();

  async function obtainCookies() {
    if (canPasswordLogin()) {
      const res = await fetchImpl(`${base}/auth/password-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ provider, username, password }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(
          `hermes password-login failed: ${res.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`,
        );
      }
      const setCookies =
        typeof res.headers.getSetCookie === 'function'
          ? res.headers.getSetCookie()
          : res.headers.raw?.()?.['set-cookie'] ||
            (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      const header = cookieHeaderFromSetCookie(setCookies);
      if (!header) throw new Error('hermes password-login returned no session cookies');
      return header;
    }
    if (canMint()) {
      return mintBasicSessionCookieHeader({
        username,
        secret,
        provider,
        accessTtlSeconds,
      });
    }
    throw new Error('hermes session credentials not configured');
  }

  async function ensureCookie({ force = false } = {}) {
    if (!hasCredentials()) return '';
    if (cookieHeader && !force) return cookieHeader;
    if (!loginInflight) {
      loginInflight = obtainCookies()
        .then((header) => {
          cookieHeader = header;
          return header;
        })
        .catch((err) => {
          cookieHeader = '';
          throw err;
        })
        .finally(() => {
          loginInflight = null;
        });
    }
    return loginInflight;
  }

  function invalidate() {
    cookieHeader = '';
  }

  /**
   * Mint a single-use WS ticket (gated mode). Retries once after re-login on 401.
   * @returns {Promise<string>}
   */
  async function mintWsTicket() {
    const attempt = async (cookie) =>
      fetchImpl(`${base}/api/auth/ws-ticket`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          ...(cookie ? { cookie } : {}),
        },
      });

    let cookie = await ensureCookie();
    let res = await attempt(cookie);
    if (res.status === 401) {
      invalidate();
      cookie = await ensureCookie({ force: true });
      res = await attempt(cookie);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `hermes ws-ticket failed: ${res.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`,
      );
    }
    const body = await res.json();
    const ticket = body?.ticket;
    if (!ticket || typeof ticket !== 'string') {
      throw new Error('hermes ws-ticket response missing ticket');
    }
    return ticket;
  }

  return {
    hasCredentials,
    ensureCookie,
    invalidate,
    mintWsTicket,
    /** @returns {string} current cached cookie header (may be empty) */
    getCookieHeader: () => cookieHeader,
  };
}
