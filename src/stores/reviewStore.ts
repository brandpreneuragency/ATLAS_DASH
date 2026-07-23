import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';

/**
 * Agent -> Brain Review (Control's `Review.tsx`, M2 map row: "explicit
 * approve/reject remains delegated to the guarded brain workflow"). Wired to
 * `server/app/routers/review.py`:
 *  - GET  /api/review                       -> pending review notes
 *  - POST /api/review/{name}/decide  { decision } -> dispatches the guarded
 *    Hermes brain workflow and returns { run_id }; this store never resolves
 *    the decision itself, only asks the backend to run the guarded workflow.
 */

export interface ReviewItem {
  name: string;
  frontmatter: Record<string, unknown>;
  body_preview: string;
  source_path: string | null;
}

export type ReviewDecision = 'approved' | 'rejected';
export type ReviewLoadState = 'loading' | 'ready' | 'error';

interface ReviewStore {
  state: ReviewLoadState;
  items: ReviewItem[];
  errorMessage: string | null;
  /** name -> run_id (or 'starting' before the response arrives). Presence
   * means "Hermes is working on this note's decision" — driving the busy
   * indicator and the component's poll-while-processing behavior. */
  processing: Record<string, string>;
  refresh: () => Promise<void>;
  decide: (name: string, decision: ReviewDecision) => Promise<void>;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  state: 'loading',
  items: [],
  errorMessage: null,
  processing: {},

  refresh: async () => {
    set({ state: 'loading', errorMessage: null });
    try {
      const res = await fetch('/api/review', { credentials: 'include' });
      if (!res.ok) {
        set({ state: 'error', errorMessage: `Failed to load review queue (${res.status}).` });
        return;
      }
      const items = (await res.json()) as ReviewItem[];
      set((s) => {
        // A note vanishes from the list once Hermes resolves it — drop any
        // stale "processing" entry that no longer has a matching item.
        const names = new Set(items.map((i) => i.name));
        const nextProcessing: Record<string, string> = {};
        for (const [name, runId] of Object.entries(s.processing)) {
          if (names.has(name)) nextProcessing[name] = runId;
        }
        return { state: 'ready', items, errorMessage: null, processing: nextProcessing };
      });
    } catch {
      set({ state: 'error', errorMessage: 'Network error loading review queue.' });
    }
  },

  decide: async (name, decision) => {
    set((s) => ({
      processing: { ...s.processing, [name]: 'starting' },
      errorMessage: null,
    }));
    let res: Response;
    try {
      res = await fetch(`/api/review/${encodeURIComponent(name)}/decide`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ decision }),
      });
    } catch {
      set((s) => {
        const next = { ...s.processing };
        delete next[name];
        return { errorMessage: `Network error submitting decision for "${name}".`, processing: next };
      });
      return;
    }

    if (!res.ok) {
      set((s) => {
        const next = { ...s.processing };
        delete next[name];
        return { errorMessage: `Could not submit decision for "${name}" (${res.status}).`, processing: next };
      });
      return;
    }

    const result = (await res.json()) as { run_id: string };
    set((s) => ({ processing: { ...s.processing, [name]: result.run_id } }));
    await get().refresh();
  },
}));
