import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useSchedulesStore, type CronJob } from './schedulesStore';

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

const job: CronJob = {
  id: 'job-1',
  name: 'Nightly report',
  prompt: 'summarize the day',
  schedule: { kind: 'cron', expr: '0 6 * * *' },
  enabled: true,
  state: 'scheduled',
  last_status: 'ok',
  last_error: null,
  next_run_at: new Date().toISOString(),
  skills: [],
};

function resetStore() {
  useSchedulesStore.setState({ state: 'loading', jobs: [], errorMessage: null, actingId: null });
}

describe('schedulesStore', () => {
  beforeEach(resetStore);
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('refresh() loads cron jobs from GET /api/hermes/cron', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: [job] }]);
    global.fetch = fetch;

    await useSchedulesStore.getState().refresh();

    expect(useSchedulesStore.getState().state).toBe('ready');
    expect(useSchedulesStore.getState().jobs).toEqual([job]);
    expect(calls[0].url).toBe('/api/hermes/cron');
  });

  it('create() posts the cron expression nested under schedule.expr', async () => {
    const { fetch, calls } = queueFetch([
      { status: 200, body: job },
      { status: 200, body: [job] },
    ]);
    global.fetch = fetch;

    const ok = await useSchedulesStore.getState().create({
      name: 'Nightly report',
      prompt: 'summarize the day',
      expr: '0 6 * * *',
      skills: [],
    });

    expect(ok).toBe(true);
    expect(calls[0].url).toBe('/api/hermes/cron');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      name: 'Nightly report',
      prompt: 'summarize the day',
      schedule: { kind: 'cron', expr: '0 6 * * *' },
      skills: [],
    });
  });

  it('create() surfaces an invalid-cron-expression 400 from the server', async () => {
    const { fetch } = queueFetch([{ status: 400, body: { detail: 'invalid cron expression: bad token' } }]);
    global.fetch = fetch;

    const ok = await useSchedulesStore.getState().create({
      name: 'x',
      prompt: 'y',
      expr: 'not a cron',
      skills: [],
    });

    expect(ok).toBe(false);
    expect(useSchedulesStore.getState().errorMessage).toBe('invalid cron expression: bad token');
  });

  it('act("pause") optimistically flips enabled/state before the network resolves, then reconciles on refresh', async () => {
    useSchedulesStore.setState({ jobs: [job] });
    const { fetch, calls } = queueFetch([
      { status: 200, body: { ...job, enabled: false, state: 'paused' } },
      { status: 200, body: [{ ...job, enabled: false, state: 'paused' }] },
    ]);
    global.fetch = fetch;

    const pending = useSchedulesStore.getState().act('job-1', 'pause');
    // Optimistic flip happens synchronously before the fetch resolves.
    expect(useSchedulesStore.getState().jobs[0].enabled).toBe(false);
    expect(useSchedulesStore.getState().jobs[0].state).toBe('paused');

    await pending;

    expect(calls[0].url).toBe('/api/hermes/cron/job-1/pause');
    expect(calls[0].init?.method).toBe('POST');
    expect(useSchedulesStore.getState().actingId).toBeNull();
  });

  it('act("trigger") does not optimistically change enabled/state', async () => {
    useSchedulesStore.setState({ jobs: [job] });
    const { fetch } = queueFetch([
      { status: 200, body: job },
      { status: 200, body: [job] },
    ]);
    global.fetch = fetch;

    const pending = useSchedulesStore.getState().act('job-1', 'trigger');
    expect(useSchedulesStore.getState().jobs[0].enabled).toBe(true);
    expect(useSchedulesStore.getState().jobs[0].state).toBe('scheduled');
    await pending;
  });

  it('remove() deletes then refreshes', async () => {
    const { fetch, calls } = queueFetch([
      { status: 204, body: '' },
      { status: 200, body: [] },
    ]);
    global.fetch = fetch;

    await useSchedulesStore.getState().remove('job-1');

    expect(calls[0].url).toBe('/api/hermes/cron/job-1');
    expect(calls[0].init?.method).toBe('DELETE');
    expect(calls[1].url).toBe('/api/hermes/cron');
  });
});
