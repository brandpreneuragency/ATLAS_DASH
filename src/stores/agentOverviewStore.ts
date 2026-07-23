import { create } from 'zustand';

/**
 * Agent Overview data (Control's `MissionControl.tsx` -> Agent area M5c).
 * Wired to the routers actually present in `server/app/routers/`:
 *  - GET /api/health   (system.py)  -> backend/db/hermes status
 *  - GET /api/agents   (agents.py)  -> per-agent health cards
 *  - GET /api/events   (events.py)  -> recent event activity feed
 *  - GET /api/runs     (workflows.py) -> run counts, bucketed by status
 *
 * Run status vocabulary is ratified (D-M4-STATUS-VOCAB) and DB-trigger
 * enforced: queued, running, waiting_approval, succeeded, failed,
 * cancelled, budget_exceeded. `RUN_STATUSES` is the single source of truth
 * for those exact strings — nothing here may rename or invent a status.
 */

export interface HealthResponse {
  status: string;
  db: string;
  hermes: { runs_api: string };
  version: string;
}

export interface AgentCard {
  id: number;
  name: string;
  kind: string;
  status: string;
  model: string | null;
  active_runs: number;
  health: Record<string, unknown> | null;
  enabled: boolean;
}

export interface AtlasEvent {
  id: number;
  ts: string;
  kind: string;
  source: string;
  agent_id: number | null;
  workflow_id: number | null;
  run_id: number | null;
  payload: Record<string, unknown>;
}

export const RUN_STATUSES = [
  'queued',
  'running',
  'waiting_approval',
  'succeeded',
  'failed',
  'cancelled',
  'budget_exceeded',
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

interface RunSummary {
  id: number;
  status: string;
}

export type RunCounts = Record<RunStatus, number>;

function emptyCounts(): RunCounts {
  return Object.fromEntries(RUN_STATUSES.map((s) => [s, 0])) as RunCounts;
}

function isRunStatus(value: string): value is RunStatus {
  return (RUN_STATUSES as readonly string[]).includes(value);
}

export type AgentOverviewState = 'loading' | 'ready' | 'error';

interface AgentOverviewStore {
  state: AgentOverviewState;
  health: HealthResponse | null;
  agents: AgentCard[];
  events: AtlasEvent[];
  runCounts: RunCounts;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

async function fetchJson<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) return { ok: false, status: res.status, data: null };
  const data = (await res.json()) as T;
  return { ok: true, status: res.status, data };
}

export const useAgentOverviewStore = create<AgentOverviewStore>((set) => ({
  state: 'loading',
  health: null,
  agents: [],
  events: [],
  runCounts: emptyCounts(),
  errorMessage: null,

  refresh: async () => {
    set({ state: 'loading', errorMessage: null });
    try {
      const [health, agents, events, runs] = await Promise.all([
        fetchJson<HealthResponse>('/api/health'),
        fetchJson<AgentCard[]>('/api/agents'),
        fetchJson<AtlasEvent[]>('/api/events?limit=50'),
        fetchJson<RunSummary[]>('/api/runs?limit=200'),
      ]);

      if (!health.ok || !agents.ok || !events.ok || !runs.ok) {
        const failed = [
          !health.ok && 'health',
          !agents.ok && 'agents',
          !events.ok && 'events',
          !runs.ok && 'runs',
        ].filter(Boolean);
        set({
          state: 'error',
          errorMessage: `Could not load: ${failed.join(', ')}.`,
        });
        return;
      }

      const runCounts = emptyCounts();
      for (const run of runs.data ?? []) {
        if (isRunStatus(run.status)) runCounts[run.status] += 1;
      }

      set({
        state: 'ready',
        health: health.data,
        agents: agents.data ?? [],
        events: events.data ?? [],
        runCounts,
        errorMessage: null,
      });
    } catch {
      set({ state: 'error', errorMessage: 'Network error loading agent overview.' });
    }
  },
}));
