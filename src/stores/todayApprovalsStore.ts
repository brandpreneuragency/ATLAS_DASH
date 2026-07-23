import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';

/**
 * Today approvals (M2 map D-APPROVALS: single approvals presentation,
 * surfaced from Today). Wired to `server/app/routers/approvals.py`:
 *  - GET  /api/approvals?status=pending
 *  - POST /api/approvals/{id}/resolve  { decision: 'approved' | 'rejected' }
 *
 * `resolve` MUST treat HTTP 409 as a normal, retryable outcome (SPEC 5c):
 * the backend does an atomic conditional claim and 409s when the approval
 * was already resolved, or when the run hasn't reached `waiting_approval`
 * yet (a real, tiny timing window right after `run.waiting_approval`).
 * A 409 here re-fetches the list rather than surfacing a crash or silently
 * dropping the approval — if it's still pending after the refetch, the
 * caller can simply try again.
 */

export interface Approval {
  id: number;
  run_id: number | null;
  step_id: number | null;
  kind: 'gate' | 'hermes_run';
  external_ref: string | null;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  resolved_at: string | null;
  resolved_via: string | null;
}

export type Decision = 'approved' | 'rejected';

export type TodayApprovalsState = 'loading' | 'ready' | 'error';

interface TodayApprovalsStore {
  state: TodayApprovalsState;
  approvals: Approval[];
  errorMessage: string | null;
  /** ids currently in flight for POST resolve — disables their buttons. */
  resolvingIds: number[];
  /** ids whose most recent resolve attempt came back 409, so the UI can
   * show a "just missed it — try again" hint instead of a hard error. */
  conflictIds: number[];
  refresh: () => Promise<void>;
  resolve: (id: number, decision: Decision) => Promise<void>;
}

export const useTodayApprovalsStore = create<TodayApprovalsStore>((set, get) => ({
  state: 'loading',
  approvals: [],
  errorMessage: null,
  resolvingIds: [],
  conflictIds: [],

  refresh: async () => {
    set({ state: 'loading', errorMessage: null });
    try {
      const res = await fetch('/api/approvals?status=pending', { credentials: 'include' });
      if (!res.ok) {
        set({ state: 'error', errorMessage: `Failed to load approvals (${res.status}).` });
        return;
      }
      const approvals = (await res.json()) as Approval[];
      set({ state: 'ready', approvals, errorMessage: null });
    } catch {
      set({ state: 'error', errorMessage: 'Network error loading approvals.' });
    }
  },

  resolve: async (id, decision) => {
    set((s) => ({
      resolvingIds: [...s.resolvingIds, id],
      conflictIds: s.conflictIds.filter((cid) => cid !== id),
      errorMessage: null,
    }));

    let res: Response;
    try {
      res = await fetch(`/api/approvals/${id}/resolve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ decision }),
      });
    } catch {
      set((s) => ({
        errorMessage: `Network error resolving approval #${id}.`,
        resolvingIds: s.resolvingIds.filter((rid) => rid !== id),
      }));
      return;
    }

    if (res.status === 409) {
      // Retryable race, not a failure: reopen for another attempt by
      // re-fetching ground truth from the server.
      set((s) => ({
        conflictIds: [...s.conflictIds, id],
        resolvingIds: s.resolvingIds.filter((rid) => rid !== id),
      }));
      await get().refresh();
      return;
    }

    if (!res.ok) {
      set((s) => ({
        errorMessage: `Could not resolve approval #${id} (${res.status}).`,
        resolvingIds: s.resolvingIds.filter((rid) => rid !== id),
      }));
      return;
    }

    // Success — drop it from the pending list locally.
    set((s) => ({
      approvals: s.approvals.filter((a) => a.id !== id),
      resolvingIds: s.resolvingIds.filter((rid) => rid !== id),
      conflictIds: s.conflictIds.filter((cid) => cid !== id),
    }));
  },
}));
