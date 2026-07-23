import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AgentRuns } from './AgentRuns';
import { useRunsStore } from '../../stores/runsStore';

interface RecordedCall {
  url: string;
}

function queueFetch(byUrl: (url: string) => { status: number; body: unknown }): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fn: typeof fetch = async (url) => {
    const u = String(url);
    calls.push({ url: u });
    const r = byUrl(u);
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: fn, calls };
}

const originalFetch = global.fetch;

const runs = [
  { id: 1, workflow_id: 1, status: 'succeeded', trigger_kind: 'manual', trigger_payload: {}, dry_run: false, error: null, cost_usd: 0.01, tokens_in: 1, tokens_out: 1, created_at: '2026-01-01T00:00:00Z', started_at: null, finished_at: null },
  { id: 2, workflow_id: 1, status: 'running', trigger_kind: 'manual', trigger_payload: {}, dry_run: false, error: null, cost_usd: 0, tokens_in: 0, tokens_out: 0, created_at: '2026-01-01T00:00:00Z', started_at: null, finished_at: null },
];

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

describe('AgentRuns', () => {
  beforeEach(resetStore);
  afterEach(() => {
    global.fetch = originalFetch;
  });

  // --- Proves the status filter is really wired to the request the store
  // sends, not just a decorative <select>. This is the "run-status
  // filtering" scenario the phase brief singles out: if the onChange
  // handler stopped calling setStatusFilter (or setStatusFilter stopped
  // appending status= to the URL), this test fails on the second assertion
  // even though the initial unfiltered render still passes.
  it('changing the status filter re-fetches runs with the selected ratified status', async () => {
    const { fetch, calls } = queueFetch((url) => {
      if (url.includes('status=running')) return { status: 200, body: [runs[1]] };
      return { status: 200, body: runs };
    });
    global.fetch = fetch;

    render(<AgentRuns />);

    await waitFor(() => expect(screen.getByTestId('run-row-1')).toBeInTheDocument());
    expect(screen.getByTestId('run-row-2')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'running' } });

    await waitFor(() => expect(screen.queryByTestId('run-row-1')).not.toBeInTheDocument());
    expect(screen.getByTestId('run-row-2')).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/runs?limit=200&status=running')).toBe(true);
  });

  it('clicking a run row selects it and loads run detail', async () => {
    const detail = { ...runs[0], steps: [] };
    const { fetch } = queueFetch((url) => {
      if (url === '/api/runs/1') return { status: 200, body: detail };
      return { status: 200, body: runs };
    });
    global.fetch = fetch;

    render(<AgentRuns />);
    await waitFor(() => expect(screen.getByTestId('run-row-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('run-row-1'));

    await waitFor(() => expect(screen.getByTestId('run-detail')).toBeInTheDocument());
    expect(screen.getByTestId('run-detail-status')).toHaveTextContent('succeeded');
  });
});
