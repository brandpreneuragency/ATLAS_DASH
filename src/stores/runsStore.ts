import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';
import type { RunStatus } from './agentOverviewStore';

/**
 * Agent → Runs (Control's `Automation.tsx` runs list + `RunDetail.tsx`),
 * wired to `server/app/routers/workflows.py`:
 *  - GET  /api/runs?workflow_id=&status=&limit=   (list, filterable)
 *  - GET  /api/runs/{id}                          (detail incl. steps)
 *  - POST /api/runs/{id}/cancel                   (cancellation)
 *
 * Status filtering MUST use the exact ratified vocabulary
 * (D-M4-STATUS-VOCAB) — `queued`, `running`, `waiting_approval`,
 * `succeeded`, `failed`, `cancelled`, `budget_exceeded` — never
 * `waiting_for_approval` or `completed`.
 */

export interface RunStep {
  id: number;
  node_id: string;
  node_type: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  cost_usd: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface Run {
  id: number;
  workflow_id: number;
  status: string;
  trigger_kind: string;
  trigger_payload: Record<string, unknown>;
  dry_run: boolean;
  error: string | null;
  cost_usd: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunDetail extends Run {
  steps: RunStep[];
}

/** Terminal run statuses — the backend rejects cancellation of these
 * (`server/app/routers/workflows.py::cancel_run` returns 409). Kept in one
 * place so the UI's "can I cancel this?" check can never drift from the
 * ratified vocabulary. */
const TERMINAL_STATUSES: readonly string[] = [
  'succeeded',
  'failed',
  'cancelled',
  'budget_exceeded',
];

export function isCancellableStatus(status: string): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export type RunsState = 'loading' | 'ready' | 'error';

interface RunsStore {
  state: RunsState;
  runs: Run[];
  errorMessage: string | null;
  statusFilter: RunStatus | 'all';
  workflowFilter: number | null;

  selectedRunId: number | null;
  selectedRun: RunDetail | null;
  detailState: RunsState;
  detailError: string | null;
  cancellingId: number | null;

  setStatusFilter: (status: RunStatus | 'all') => Promise<void>;
  setWorkflowFilter: (workflowId: number | null) => Promise<void>;
  refresh: () => Promise<void>;
  selectRun: (id: number | null) => Promise<void>;
  cancelRun: (id: number) => Promise<void>;
}

export function buildRunsQuery(status: RunStatus | 'all', workflowId: number | null): string {
  const params = new URLSearchParams();
  params.set('limit', '200');
  if (status !== 'all') params.set('status', status);
  if (workflowId != null) params.set('workflow_id', String(workflowId));
  return `/api/runs?${params.toString()}`;
}

export const useRunsStore = create<RunsStore>((set, get) => ({
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

  setStatusFilter: async (status) => {
    set({ statusFilter: status });
    await get().refresh();
  },

  setWorkflowFilter: async (workflowId) => {
    set({ workflowFilter: workflowId });
    await get().refresh();
  },

  refresh: async () => {
    set({ state: 'loading', errorMessage: null });
    try {
      const { statusFilter, workflowFilter } = get();
      const res = await fetch(buildRunsQuery(statusFilter, workflowFilter), { credentials: 'include' });
      if (!res.ok) {
        set({ state: 'error', errorMessage: `Failed to load runs (${res.status}).` });
        return;
      }
      const runs = (await res.json()) as Run[];
      set({ state: 'ready', runs, errorMessage: null });
    } catch {
      set({ state: 'error', errorMessage: 'Network error loading runs.' });
    }
  },

  selectRun: async (id) => {
    if (id === null) {
      set({ selectedRunId: null, selectedRun: null, detailState: 'ready', detailError: null });
      return;
    }
    set({ selectedRunId: id, detailState: 'loading', detailError: null });
    try {
      const res = await fetch(`/api/runs/${id}`, { credentials: 'include' });
      if (!res.ok) {
        set({ detailState: 'error', detailError: `Failed to load run #${id} (${res.status}).` });
        return;
      }
      const run = (await res.json()) as RunDetail;
      set({ detailState: 'ready', selectedRun: run, detailError: null });
    } catch {
      set({ detailState: 'error', detailError: `Network error loading run #${id}.` });
    }
  },

  cancelRun: async (id) => {
    set({ cancellingId: id, errorMessage: null });
    // NOTE: unlike a successful cancel, a failure must NOT fall through to
    // refresh() — refresh() unconditionally sets errorMessage: null at its
    // start, which would silently wipe the failure message we just set.
    let res: Response;
    try {
      res = await fetch(`/api/runs/${id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { [CSRF_HEADER]: '1' },
      });
    } catch {
      set({ cancellingId: null, errorMessage: `Network error cancelling run #${id}.` });
      return;
    }
    if (!res.ok) {
      let detail = `Could not cancel run #${id} (${res.status}).`;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch {
        // no JSON body — keep the generic message
      }
      set({ cancellingId: null, errorMessage: detail });
      return;
    }
    set({ cancellingId: null });
    await get().refresh();
    if (get().selectedRunId === id) await get().selectRun(id);
  },
}));
