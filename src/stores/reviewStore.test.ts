import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useReviewStore, type ReviewItem } from './reviewStore';

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

const pendingNote: ReviewItem = {
  name: '2026-07-23-idea',
  frontmatter: { tag: 'idea' },
  body_preview: 'Some note body preview…',
  source_path: '/vault/inbox/2026-07-23-idea.md',
};

describe('reviewStore (Agent -> Brain Review)', () => {
  beforeEach(() => {
    useReviewStore.setState({ state: 'loading', items: [], errorMessage: null, processing: {} });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('refresh() loads the pending review queue from GET /api/review', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: [pendingNote] }]);
    global.fetch = fetch;

    await useReviewStore.getState().refresh();

    expect(useReviewStore.getState().state).toBe('ready');
    expect(useReviewStore.getState().items).toEqual([pendingNote]);
    expect(calls[0].url).toBe('/api/review');
    expect(calls[0].init).toMatchObject({ credentials: 'include' });
  });

  it('refresh() surfaces a non-2xx response as an error state, not a crash', async () => {
    const { fetch } = queueFetch([{ status: 500, body: { detail: 'boom' } }]);
    global.fetch = fetch;

    await useReviewStore.getState().refresh();

    expect(useReviewStore.getState().state).toBe('error');
    expect(useReviewStore.getState().errorMessage).toMatch(/Failed to load review queue \(500\)/);
  });

  it('decide() POSTs the decision to /api/review/{name}/decide and delegates to the guarded brain workflow (never resolves locally)', async () => {
    useReviewStore.setState({ state: 'ready', items: [pendingNote] });
    const { fetch, calls } = queueFetch([
      { status: 200, body: { run_id: 'run-abc' } },
      { status: 200, body: [pendingNote] }, // refresh() after decide()
    ]);
    global.fetch = fetch;

    await useReviewStore.getState().decide(pendingNote.name, 'approved');

    expect(calls[0].url).toBe(`/api/review/${encodeURIComponent(pendingNote.name)}/decide`);
    expect(calls[0].init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ decision: 'approved' });
    // decide() itself never removes the item from `items` — only the
    // backend's own workflow resolution (reflected on the next refresh)
    // does. It records the dispatched run_id as the busy indicator.
    expect(useReviewStore.getState().processing[pendingNote.name]).toBe('run-abc');
  });

  it('decide() clears the busy indicator and surfaces an error on a non-2xx response', async () => {
    useReviewStore.setState({ state: 'ready', items: [pendingNote] });
    const { fetch } = queueFetch([{ status: 400, body: { detail: 'bad decision' } }]);
    global.fetch = fetch;

    await useReviewStore.getState().decide(pendingNote.name, 'rejected');

    const s = useReviewStore.getState();
    expect(s.processing[pendingNote.name]).toBeUndefined();
    expect(s.errorMessage).toMatch(/Could not submit decision/);
  });
});
