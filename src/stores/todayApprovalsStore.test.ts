import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useTodayApprovalsStore, type Approval } from './todayApprovalsStore';

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function queueFetch(responses: Array<{ status: number; body: unknown }>): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let i = 0;
  const fn: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: fn, calls };
}

const originalFetch = global.fetch;

const pendingApproval: Approval = {
  id: 42,
  run_id: 7,
  step_id: 3,
  kind: 'gate',
  external_ref: null,
  message: 'Deploy to prod?',
  status: 'pending',
  requested_at: new Date().toISOString(),
  resolved_at: null,
  resolved_via: null,
};

describe('todayApprovalsStore', () => {
  beforeEach(() => {
    useTodayApprovalsStore.setState({
      state: 'loading',
      approvals: [],
      errorMessage: null,
      resolvingIds: [],
      conflictIds: [],
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('refresh() loads pending approvals from GET /api/approvals?status=pending', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: [pendingApproval] }]);
    global.fetch = fetch;

    await useTodayApprovalsStore.getState().refresh();

    expect(useTodayApprovalsStore.getState().state).toBe('ready');
    expect(useTodayApprovalsStore.getState().approvals).toEqual([pendingApproval]);
    expect(calls[0].url).toBe('/api/approvals?status=pending');
    expect(calls[0].init).toMatchObject({ credentials: 'include' });
  });

  it('resolve() on success removes the approval from the list and clears busy state', async () => {
    useTodayApprovalsStore.setState({ state: 'ready', approvals: [pendingApproval] });
    const { fetch, calls } = queueFetch([{ status: 200, body: { ...pendingApproval, status: 'approved' } }]);
    global.fetch = fetch;

    await useTodayApprovalsStore.getState().resolve(42, 'approved');

    const s = useTodayApprovalsStore.getState();
    expect(s.approvals).toEqual([]);
    expect(s.resolvingIds).toEqual([]);
    expect(s.errorMessage).toBeNull();
    expect(calls[0].url).toBe('/api/approvals/42/resolve');
    expect(calls[0].init?.method).toBe('POST');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['X-Atlas-CSRF']).toBe('1');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ decision: 'approved' });
  });

  // --- The behaviour under test in the SPEC: HTTP 409 from the atomic claim
  // must be treated as a normal, retryable outcome — not a crash and not a
  // silent no-op. This is proven by asserting the exact post-409 contract:
  // (a) the approval is NOT dropped from the list (a real error path would
  //     also need to decide this, but the naive/wrong implementation is to
  //     treat 409 identically to a 5xx and set errorMessage), (b) no
  //     errorMessage is set (409 is not "an error" to the user), (c) a
  //     follow-up GET re-fetches ground truth, and (d) the id is recorded in
  //     conflictIds so the UI can show a "try again" hint.
  it('resolve() treats HTTP 409 as retryable: no error surfaced, list re-fetched, item stays actionable', async () => {
    useTodayApprovalsStore.setState({ state: 'ready', approvals: [pendingApproval] });
    const { fetch, calls } = queueFetch([
      { status: 409, body: { detail: 'run not resumable right now' } }, // POST resolve
      { status: 200, body: [pendingApproval] }, // GET refetch — still pending
    ]);
    global.fetch = fetch;

    await useTodayApprovalsStore.getState().resolve(42, 'approved');

    const s = useTodayApprovalsStore.getState();
    expect(s.errorMessage).toBeNull();
    expect(s.conflictIds).toEqual([42]);
    expect(s.resolvingIds).toEqual([]);
    expect(s.approvals).toEqual([pendingApproval]); // still present — resolvable again
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('/api/approvals/42/resolve');
    expect(calls[1].url).toBe('/api/approvals?status=pending');
  });

  it('resolve() on a genuine server error surfaces errorMessage and keeps the approval for retry', async () => {
    useTodayApprovalsStore.setState({ state: 'ready', approvals: [pendingApproval] });
    const { fetch, calls } = queueFetch([{ status: 500, body: { detail: 'boom' } }]);
    global.fetch = fetch;

    await useTodayApprovalsStore.getState().resolve(42, 'rejected');

    const s = useTodayApprovalsStore.getState();
    expect(s.errorMessage).toContain('42');
    expect(s.approvals).toEqual([pendingApproval]);
    expect(s.resolvingIds).toEqual([]);
    expect(calls).toHaveLength(1); // no refetch on a hard error
  });

  it('resolve() on a network failure surfaces errorMessage without throwing', async () => {
    useTodayApprovalsStore.setState({ state: 'ready', approvals: [pendingApproval] });
    global.fetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;

    await expect(useTodayApprovalsStore.getState().resolve(42, 'approved')).resolves.toBeUndefined();

    const s = useTodayApprovalsStore.getState();
    expect(s.errorMessage).toContain('Network error');
    expect(s.resolvingIds).toEqual([]);
  });
});
