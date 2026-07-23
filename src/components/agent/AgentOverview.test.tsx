import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentOverview } from './AgentOverview';
import { useAgentOverviewStore } from '../../stores/agentOverviewStore';

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

describe('AgentOverview', () => {
  beforeEach(() => {
    useAgentOverviewStore.setState({
      state: 'loading',
      health: null,
      agents: [],
      events: [],
      runCounts: {
        queued: 0,
        running: 0,
        waiting_approval: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        budget_exceeded: 0,
      },
      errorMessage: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders system health, agent health, run counts, and event activity from the wired endpoints', async () => {
    const { fetch, calls } = queueFetch((url) => {
      if (url.includes('/api/health')) {
        return { status: 200, body: { status: 'ok', db: 'ok', hermes: { runs_api: 'ok' }, version: '0.1.0' } };
      }
      if (url.includes('/api/agents')) {
        return {
          status: 200,
          body: [
            { id: 1, name: 'Hermes', kind: 'hermes', status: 'ok', model: 'gpt', active_runs: 2, health: null, enabled: true },
          ],
        };
      }
      if (url.includes('/api/events')) {
        return {
          status: 200,
          body: [{ id: 9, ts: new Date().toISOString(), kind: 'run.started', source: 'engine', agent_id: null, workflow_id: 1, run_id: 5, payload: {} }],
        };
      }
      if (url.includes('/api/runs')) {
        return {
          status: 200,
          body: [
            { id: 1, status: 'succeeded' },
            { id: 2, status: 'running' },
            { id: 3, status: 'running' },
            { id: 4, status: 'waiting_approval' },
          ],
        };
      }
      throw new Error(`unexpected url ${url}`);
    });
    global.fetch = fetch;

    render(<AgentOverview />);

    await waitFor(() => expect(screen.getByTestId('agent-card-1')).toBeInTheDocument());

    // System health — backend status, db, hermes runs_api all report 'ok'.
    expect(screen.getAllByText('ok').length).toBeGreaterThanOrEqual(3);

    // Agent health
    expect(screen.getByTestId('agent-card-1')).toHaveTextContent('Hermes');
    expect(screen.getByTestId('agent-card-1')).toHaveTextContent('2 active');

    // Run counts — bucketed using the exact ratified status strings.
    expect(screen.getByTestId('run-count-running')).toHaveTextContent('2');
    expect(screen.getByTestId('run-count-succeeded')).toHaveTextContent('1');
    expect(screen.getByTestId('run-count-waiting_approval')).toHaveTextContent('1');
    expect(screen.getByTestId('run-count-queued')).toHaveTextContent('0');

    // Event activity
    expect(screen.getByTestId('event-row-9')).toHaveTextContent('run.started');

    expect(calls.map((c) => c.url).sort()).toEqual(
      ['/api/agents', '/api/events?limit=50', '/api/health', '/api/runs?limit=200'].sort(),
    );
  });

  it('shows a retryable error state when a wired endpoint fails', async () => {
    const { fetch } = queueFetch((url) => {
      if (url.includes('/api/agents')) return { status: 500, body: { detail: 'boom' } };
      return { status: 200, body: url.includes('/api/health') ? { status: 'ok', db: 'ok', hermes: { runs_api: 'ok' }, version: '0.1.0' } : [] };
    });
    global.fetch = fetch;

    render(<AgentOverview />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('agents');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
