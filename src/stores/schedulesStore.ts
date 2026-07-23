import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';

/**
 * Agent → Schedules (Control's `Automation.tsx` Hermes cron jobs table),
 * wired to `server/app/routers/hermes.py`'s cron-federation surface
 * (proxied to HermesAdmin :9119):
 *  - GET    /api/hermes/cron
 *  - POST   /api/hermes/cron
 *  - PUT    /api/hermes/cron/{id}
 *  - DELETE /api/hermes/cron/{id}
 *  - POST   /api/hermes/cron/{id}/{pause|resume|trigger}
 *
 * This is Hermes cron scheduling — distinct from workflow trigger nodes
 * (`trigger.cron` inside a workflow graph, edited in the Workflow Editor).
 */

export interface CronSchedule {
  kind?: string;
  expr?: string;
  display?: string;
}

export interface CronJob {
  id: string;
  name: string;
  prompt?: string;
  schedule?: CronSchedule;
  enabled?: boolean;
  state?: string;
  last_status?: string;
  last_error?: string | null;
  next_run_at?: string | null;
  skills?: string[];
}

export interface CronJobInput {
  name: string;
  prompt: string;
  expr: string;
  skills: string[];
}

export type SchedulesState = 'loading' | 'ready' | 'error';
export type CronAction = 'pause' | 'resume' | 'trigger';

interface SchedulesStore {
  state: SchedulesState;
  jobs: CronJob[];
  errorMessage: string | null;
  actingId: string | null;

  refresh: () => Promise<void>;
  create: (job: CronJobInput) => Promise<boolean>;
  update: (id: string, job: CronJobInput) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  act: (id: string, action: CronAction) => Promise<void>;
}

function toBody(job: CronJobInput) {
  return { name: job.name, prompt: job.prompt, schedule: { kind: 'cron', expr: job.expr }, skills: job.skills };
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (body?.detail) return body.detail;
  } catch {
    // no JSON body
  }
  return fallback;
}

export const useSchedulesStore = create<SchedulesStore>((set, get) => ({
  state: 'loading',
  jobs: [],
  errorMessage: null,
  actingId: null,

  refresh: async () => {
    set({ state: 'loading', errorMessage: null });
    try {
      const res = await fetch('/api/hermes/cron', { credentials: 'include' });
      if (!res.ok) {
        set({ state: 'error', errorMessage: `Failed to load schedules (${res.status}).` });
        return;
      }
      const jobs = (await res.json()) as CronJob[];
      set({ state: 'ready', jobs, errorMessage: null });
    } catch {
      set({ state: 'error', errorMessage: 'Network error loading schedules.' });
    }
  },

  create: async (job) => {
    try {
      const res = await fetch('/api/hermes/cron', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify(toBody(job)),
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not create schedule (${res.status}).`) });
        return false;
      }
      await get().refresh();
      return true;
    } catch {
      set({ errorMessage: 'Network error creating schedule.' });
      return false;
    }
  },

  update: async (id, job) => {
    try {
      const res = await fetch(`/api/hermes/cron/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify(toBody(job)),
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not update schedule (${res.status}).`) });
        return false;
      }
      await get().refresh();
      return true;
    } catch {
      set({ errorMessage: 'Network error updating schedule.' });
      return false;
    }
  },

  remove: async (id) => {
    try {
      const res = await fetch(`/api/hermes/cron/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { [CSRF_HEADER]: '1' },
      });
      if (!res.ok && res.status !== 204) {
        set({ errorMessage: `Could not delete schedule (${res.status}).` });
      }
    } catch {
      set({ errorMessage: 'Network error deleting schedule.' });
    } finally {
      await get().refresh();
    }
  },

  act: async (id, action) => {
    set({ actingId: id, errorMessage: null });
    // Optimistic flip for pause/resume, matching Control's Automation.tsx
    // behavior — 'trigger' (run now) never changes enabled/state.
    if (action !== 'trigger') {
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === id
            ? { ...j, enabled: action === 'resume', state: action === 'resume' ? 'scheduled' : 'paused' }
            : j,
        ),
      }));
    }
    try {
      const res = await fetch(`/api/hermes/cron/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { [CSRF_HEADER]: '1' },
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not ${action} schedule (${res.status}).`) });
      }
    } catch {
      set({ errorMessage: `Network error on ${action}.` });
    } finally {
      set({ actingId: null });
      await get().refresh();
    }
  },
}));
