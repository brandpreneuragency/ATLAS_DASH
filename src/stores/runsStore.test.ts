import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useRunsStore, isCancellableStatus, buildRunsQuery, type Run, type RunDetail } from './runsStore';

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
    // 204/205/304 responses must carry a null body — a real backend 204
    // (e.g. DELETE/cancel) has none, and `Response` throws if given one.
    const body = r.status === 204 ? null : JSON.stringify(r.body);
    return new Response(body, {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: body === null ? undefined : { 'content-type': 'application/json' },
    });
  };
  return { fetch: fn, calls };
}

const originalFetch = global.fetch;

const runningRun: Run = {
  id: 5,
  workflow_id: 1,
  status: 'running',
  trigger_kind: 'manual',
  trigger_payload: {},
  dry_run: false,
  error: null,
  cost_usd: 0.01,
  tokens_in: 10,
  tokens_out: 20,
  created_at: new Date().toISOString(),
  started_at: new Date().toISOString(),
  finished_at: null,
};

function resetStore() {
  useRunsStore.setState({
    state: 'loading',
    runs: [],
    errorMessage: null,
    statusFilter: 'all',
    workflowFilter: null,
    selectedRunId: null,
    selectedRun: null,
    detailState: 'ready',
    detailError: null,
    cancellingId: null,
  });
}

describe('runsStore', () => {
  beforeEach(resetStore);
  afterEach(() => {
    global.fetch = originalFetch;
  });

  // --- The behaviour under test: run-status filtering. This is the exact
  // scenario the phase brief calls out as a candidate for "must fail if the
  // behaviour is removed" — if `buildRunsQuery`/`setStatusFilter` stopped
  // appending `status=` to the query, this test would still pass on a
  // response-shape check but fail on the asserted URL, so it is anchored to
  // the request the store actually issues, not just the data it renders.
  it('buildRunsQuery only appends status= for a specific ratified status, never for "all"', () => {
    expect(buildRunsQuery('all', null)).toBe('/api/runs?limit=200');
    expect(buildRunsQuery('running', null)).toBe('/api/runs?limit=200&status=running');
    expect(buildRunsQuery('waiting_approval', 3)).toBe(
      '/api/runs?limit=200&status=waiting_approval&workflow_id=3',
    );
  });

  it('setStatusFilter("running") re-fetches with status=running and only keeps matching runs from the server response', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: [runningRun] }]);
    global.fetch = fetch;

    await useRunsStore.getState().setStatusFilter('running');

    expect(useRunsStore.getState().statusFilter).toBe('running');
    expect(useRunsStore.getState().runs).toEqual([runningRun]);
    expect(calls[0].url).toBe('/api/runs?limit=200&status=running');
  });

  it('setStatusFilter("all") clears the status query param', async () => {
    useRunsStore.setState({ statusFilter: 'running' });
    const { fetch, calls } = queueFetch([{ status: 200, body: [] }]);
    global.fetch = fetch;

    await useRunsStore.getState().setStatusFilter('all');

    expect(calls[0].url).toBe('/api/runs?limit=200');
  });

  it('isCancellableStatus is true only for non-terminal ratified statuses', () => {
    expect(isCancellableStatus('queued')).toBe(true);
    expect(isCancellableStatus('running')).toBe(true);
    expect(isCancellableStatus('waiting_approval')).toBe(true);
    expect(isCancellableStatus('succeeded')).toBe(false);
    expect(isCancellableStatus('failed')).toBe(false);
    expect(isCancellableStatus('cancelled')).toBe(false);
    expect(isCancellableStatus('budget_exceeded')).toBe(false);
  });

  it('selectRun(id) loads run detail with steps from GET /api/runs/{id}', async () => {
    const detail: RunDetail = { ...runningRun, steps: [
      { id: 1, node_id: 'n1', node_type: 'trigger.manual', status: 'succeeded', input: {}, output: {}, error: null, cost_usd: null, started_at: null, finished_at: null },
    ] };
    const { fetch, calls } = queueFetch([{ status: 200, body: detail }]);
    global.fetch = fetch;

    await useRunsStore.getState().selectRun(5);

    expect(useRunsStore.getState().selectedRun).toEqual(detail);
    expect(useRunsStore.getState().detailState).toBe('ready');
    expect(calls[0].url).toBe('/api/runs/5');
  });

  it('cancelRun posts to /api/runs/{id}/cancel with the CSRF header, then refreshes', async () => {
    useRunsStore.setState({ runs: [runningRun] });
    const { fetch, calls } = queueFetch([
      { status: 204, body: '' }, // POST cancel
      { status: 200, body: [{ ...runningRun, status: 'cancelled' }] }, // GET refresh
    ]);
    global.fetch = fetch;

    await useRunsStore.getState().cancelRun(5);

    expect(calls[0].url).toBe('/api/runs/5/cancel');
    expect(calls[0].init?.method).toBe('POST');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['X-Atlas-CSRF']).toBe('1');
    expect(useRunsStore.getState().cancellingId).toBeNull();
    expect(useRunsStore.getState().errorMessage).toBeNull();
    expect(calls[1].url).toBe('/api/runs?limit=200');
  });

  it('cancelRun on a 409 (already-terminal run) surfaces the server detail as errorMessage', async () => {
    const { fetch } = queueFetch([
      { status: 409, body: { detail: 'run already succeeded' } },
      { status: 200, body: [] },
    ]);
    global.fetch = fetch;

    await useRunsStore.getState().cancelRun(5);

    expect(useRunsStore.getState().errorMessage).toBe('run already succeeded');
  });
});
