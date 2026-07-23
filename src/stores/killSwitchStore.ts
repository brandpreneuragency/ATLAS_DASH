import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';

export type KillSwitchStatus = 'loading' | 'idle' | 'engaged' | 'error';

interface KillSwitchResponse {
  paused: boolean;
}

interface KillSwitchStore {
  status: KillSwitchStatus;
  busy: boolean;
  refresh: () => Promise<void>;
  toggle: () => Promise<void>;
}

/**
 * Persistent-header kill switch state (M1/M2: engage/release backed by
 * Control's system router, imported at M3 to
 * `server/app/routers/system.py`'s `GET/POST /api/killswitch`).
 *
 * Lives in a store (not component `useState`) so the fetch-on-mount /
 * fetch-on-toggle calls are plain store-action calls from the component's
 * effect/handler, matching this codebase's existing data-loading pattern
 * (`workspaceStore.loadWorkspaces()` and friends).
 */
export const useKillSwitchStore = create<KillSwitchStore>((set, get) => ({
  status: 'loading',
  busy: false,

  refresh: async () => {
    try {
      const res = await fetch('/api/killswitch', { credentials: 'include' });
      if (!res.ok) {
        set({ status: 'error' });
        return;
      }
      const data = (await res.json()) as KillSwitchResponse;
      set({ status: data.paused ? 'engaged' : 'idle' });
    } catch {
      set({ status: 'error' });
    }
  },

  toggle: async () => {
    const { status, busy } = get();
    if (busy || status === 'loading') return;
    const nextPaused = status !== 'engaged';
    set({ busy: true });
    try {
      const res = await fetch('/api/killswitch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ paused: nextPaused }),
      });
      if (!res.ok) {
        set({ status: 'error' });
        return;
      }
      const data = (await res.json()) as KillSwitchResponse;
      set({ status: data.paused ? 'engaged' : 'idle' });
    } catch {
      set({ status: 'error' });
    } finally {
      set({ busy: false });
    }
  },
}));
