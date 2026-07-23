import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';

/**
 * Settings -> System (D-MODELS): folds Control's `Models.tsx` (Hermes model
 * switching + provider keys + model favorites/hidden prefs) and
 * `Settings.tsx` (notifications, run limits, backup status, system health)
 * into ONE settings-admin surface — no standalone Control-style page.
 *
 * Contracts (re-read directly from the routers, not assumed):
 *  - GET  /api/hermes/model                 -> { current, options }        (hermes.py)
 *  - POST /api/hermes/model  { model, provider }                          (hermes.py)
 *  - GET  /api/hermes/env                   -> { [key]: EnvEntry }         (hermes.py)
 *      "values arrive pre-masked from Hermes; we never unmask" — the
 *      backend comment on `env_list`. This store/UI never asks for or
 *      displays anything but the already-masked `redacted_value`.
 *  - PUT    /api/hermes/env  { key, value }                                (hermes.py)
 *  - DELETE /api/hermes/env/{key}                                          (hermes.py)
 *  - GET/PUT /api/settings/model-prefs      -> { favorites, hidden }       (system.py)
 *  - GET  /api/settings/notifications       -> masked booleans + plain ids (system.py)
 *  - PUT  /api/settings/notifications        (system.py)
 *  - POST /api/settings/notifications/test                                 (system.py)
 *  - GET/PUT /api/settings/limits                                          (system.py)
 *  - GET  /api/settings/backup                                             (system.py)
 *  - GET  /api/health                                                      (system.py)
 *
 * Password change (Control's `Settings.tsx` "Change password" section) has
 * NO backend route in this tree (`grep` of `server/app/routers/*.py` and
 * `auth.py` for `settings/password` finds nothing) — genuinely absent, not
 * ported at M3/M4. Not built here; see PARKED.md.
 */

export interface ProviderOption {
  slug?: string;
  name?: string;
  models?: string[];
}

export interface CurrentModel {
  model: string;
  provider: string;
  capabilities?: { context_window?: number };
}

export interface ModelInfo {
  current: CurrentModel;
  options: { providers?: ProviderOption[] | Record<string, string[]> };
}

export interface EnvEntry {
  is_set?: boolean;
  redacted_value?: string | null;
  is_password?: boolean;
  category?: string;
}

export interface ModelPrefs {
  favorites: string[];
  hidden: string[];
}

export interface NotifyView {
  telegram_bot_token_set: boolean;
  telegram_chat_id: string;
  smtp_url_set: boolean;
  smtp_to: string;
}

export interface LimitsView {
  default_max_runs_per_hour: number;
  default_budget_usd_per_run: number | null;
  global_concurrency: number;
}

export interface BackupInfo {
  ok: boolean;
  ts?: string;
  size?: number;
  reason?: string;
  error?: string;
}

export interface HealthInfo {
  status: string;
  db: string;
  hermes: Record<string, string>;
  version: string;
}

export interface ModelListEntry {
  provider: string;
  model: string;
}

export function flattenModelOptions(info: ModelInfo | null): ModelListEntry[] {
  const providers = info?.options?.providers ?? {};
  if (Array.isArray(providers)) {
    return providers.flatMap((p) =>
      (p.models ?? []).map((model) => ({ provider: p.slug ?? p.name ?? 'unknown', model })),
    );
  }
  return Object.entries(providers).flatMap(([provider, models]) =>
    (Array.isArray(models) ? models : []).map((model) => ({ provider, model })),
  );
}

interface SettingsSystemStore {
  state: 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  busy: boolean;

  modelInfo: ModelInfo | null;
  env: Record<string, EnvEntry>;
  prefs: ModelPrefs;
  notify: NotifyView | null;
  limits: LimitsView | null;
  backup: BackupInfo | null;
  health: HealthInfo | null;

  refresh: () => Promise<void>;
  switchModel: (model: string, provider: string) => Promise<boolean>;
  togglePref: (kind: 'favorites' | 'hidden', model: string) => Promise<void>;
  putEnvKey: (key: string, value: string) => Promise<boolean>;
  deleteEnvKey: (key: string) => Promise<void>;
  saveNotifications: (patch: Partial<{
    telegram_bot_token: string;
    telegram_chat_id: string;
    smtp_url: string;
    smtp_to: string;
  }>) => Promise<boolean>;
  testNotifications: () => Promise<{ telegram: boolean; email: boolean } | null>;
  saveLimits: (mrph: number, budget: number | null) => Promise<boolean>;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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

export const useSettingsSystemStore = create<SettingsSystemStore>((set, get) => ({
  state: 'loading',
  errorMessage: null,
  busy: false,

  modelInfo: null,
  env: {},
  prefs: { favorites: [], hidden: [] },
  notify: null,
  limits: null,
  backup: null,
  health: null,

  refresh: async () => {
    set({ state: 'loading', errorMessage: null });
    const [modelInfo, env, prefs, notify, limits, backup, health] = await Promise.all([
      getJson<ModelInfo>('/api/hermes/model'),
      getJson<Record<string, EnvEntry>>('/api/hermes/env'),
      getJson<ModelPrefs>('/api/settings/model-prefs'),
      getJson<NotifyView>('/api/settings/notifications'),
      getJson<LimitsView>('/api/settings/limits'),
      getJson<BackupInfo>('/api/settings/backup'),
      getJson<HealthInfo>('/api/health'),
    ]);
    set({
      state: 'ready',
      modelInfo,
      env: env ?? {},
      prefs: prefs ?? { favorites: [], hidden: [] },
      notify,
      limits,
      backup,
      health,
    });
  },

  switchModel: async (model, provider) => {
    set({ busy: true, errorMessage: null });
    try {
      const res = await fetch('/api/hermes/model', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ model, provider }),
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not switch model (${res.status}).`) });
        return false;
      }
      await get().refresh();
      return true;
    } catch {
      set({ errorMessage: 'Network error switching model.' });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  togglePref: async (kind, model) => {
    const current = get().prefs;
    const list = current[kind];
    const next: ModelPrefs = {
      ...current,
      [kind]: list.includes(model) ? list.filter((m) => m !== model) : [...list, model],
    };
    set({ prefs: next });
    try {
      await fetch('/api/settings/model-prefs', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify(next),
      });
    } catch {
      set({ errorMessage: 'Network error saving model preference.' });
    }
  },

  // Never called with the masked `redacted_value` — always a fresh value
  // the user typed into a blank (type=password) input.
  putEnvKey: async (key, value) => {
    set({ busy: true, errorMessage: null });
    try {
      const res = await fetch('/api/hermes/env', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not save key "${key}" (${res.status}).`) });
        return false;
      }
      await get().refresh();
      return true;
    } catch {
      set({ errorMessage: 'Network error saving provider key.' });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  deleteEnvKey: async (key) => {
    set({ busy: true, errorMessage: null });
    try {
      const res = await fetch(`/api/hermes/env/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { [CSRF_HEADER]: '1' },
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not delete key "${key}" (${res.status}).`) });
      }
    } catch {
      set({ errorMessage: 'Network error deleting provider key.' });
    } finally {
      set({ busy: false });
      await get().refresh();
    }
  },

  // `patch` only ever carries keys the user actually edited (empty fields
  // are omitted by the caller) — a masked placeholder is never sent back as
  // a "new" secret value.
  saveNotifications: async (patch) => {
    set({ busy: true, errorMessage: null });
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not save notification settings (${res.status}).`) });
        return false;
      }
      const notify = (await res.json()) as NotifyView;
      set({ notify });
      return true;
    } catch {
      set({ errorMessage: 'Network error saving notification settings.' });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  testNotifications: async () => {
    set({ busy: true, errorMessage: null });
    try {
      const res = await fetch('/api/settings/notifications/test', {
        method: 'POST',
        credentials: 'include',
        headers: { [CSRF_HEADER]: '1' },
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Test send failed (${res.status}).`) });
        return null;
      }
      return (await res.json()) as { telegram: boolean; email: boolean };
    } catch {
      set({ errorMessage: 'Network error sending test notification.' });
      return null;
    } finally {
      set({ busy: false });
    }
  },

  saveLimits: async (mrph, budget) => {
    set({ busy: true, errorMessage: null });
    try {
      const res = await fetch('/api/settings/limits', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ default_max_runs_per_hour: mrph, default_budget_usd_per_run: budget }),
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not save limits (${res.status}).`) });
        return false;
      }
      const limits = (await res.json()) as LimitsView;
      set({ limits });
      return true;
    } catch {
      set({ errorMessage: 'Network error saving limits.' });
      return false;
    } finally {
      set({ busy: false });
    }
  },
}));
