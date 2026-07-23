/**
 * Thin fetch wrapper over the Control-imported `server/app/auth.py` contract,
 * reused exactly as it exists (SPEC R5 / "Decisions of record": server-set
 * cookie session, no browser-stored bearer tokens).
 *
 * Contract (re-diffed against `server/app/auth.py` on 2026-07-23):
 *  - POST /api/auth/login  { password }  -> 204 + Set-Cookie: atlas_session (httponly)
 *  - POST /api/auth/logout                -> 204, requires X-Atlas-CSRF: 1 + session cookie
 *  - GET  /api/me                         -> 200 {authenticated:true} if session valid, else 401
 *  - GET  /api/health                     -> 200, public, used by nothing here (no bearer, no probe)
 *
 * The cookie itself is httponly, so the frontend never reads or stores it —
 * `credentials: 'include'` lets the browser attach/receive it automatically.
 */

export const CSRF_HEADER = 'X-Atlas-CSRF';

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'invalid-password' | 'rate-limited' | 'network' | 'unknown'; message: string };

async function safeFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(path, { credentials: 'include', ...init });
  } catch {
    return null;
  }
}

export const authApi = {
  /** True only on a genuine 200 from the protected /api/me endpoint. */
  async me(): Promise<boolean> {
    const res = await safeFetch('/api/me');
    return res?.status === 200;
  },

  async login(password: string): Promise<LoginResult> {
    const res = await safeFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res === null) {
      return { ok: false, reason: 'network', message: 'Could not reach the server.' };
    }
    if (res.status === 204) return { ok: true };
    if (res.status === 401) {
      return { ok: false, reason: 'invalid-password', message: 'Incorrect password.' };
    }
    if (res.status === 429) {
      return {
        ok: false,
        reason: 'rate-limited',
        message: 'Too many attempts. Please wait and try again.',
      };
    }
    return { ok: false, reason: 'unknown', message: 'Sign-in failed.' };
  },

  async logout(): Promise<void> {
    await safeFetch('/api/auth/logout', {
      method: 'POST',
      headers: { [CSRF_HEADER]: '1' },
    });
  },
};
