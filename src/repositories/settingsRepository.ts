// Settings repository. Thin convenience layer over the AI repository's
// generic settings endpoints (`/api/settings`). Centralised so stores can
// import a small surface and so the keys are validated through one place.
//
// Endpoints (see server/src/routes/settings.ts):
//
//   GET    /api/settings?keys=k1,k2,...
//   PUT    /api/settings              (body: { key, value })
//   DELETE /api/settings/:key
//   GET    /api/settings/search-config
//   PUT    /api/settings/search-config
//   GET    /api/settings/system-instructions
//   PUT    /api/settings/system-instructions
//
// All settings rows are owner-scoped (the (ownerId, key) primary key in the
// Prisma schema). The server always uses `req.user.id`; `ownerId` is never
// part of the wire shape.

import type { SearchConfig } from '../types';
import { apiClient } from '../services/apiClient';

export interface SettingsMap {
  [key: string]: unknown;
}

export const settingsRepository = {
  /** Fetch a batch of settings rows by key. Missing keys are absent from
   *  the returned map. */
  getMany(keys: string[]): Promise<SettingsMap> {
    return apiClient
      .get<{ settings: SettingsMap }>('/settings', { query: { keys } })
      .then((res) => res.settings);
  },

  /** Fetch a single setting by key. Returns `undefined` if the row is
   *  missing (a 404 from the server is normalised to `undefined` so the
   *  caller can use the default). */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const map = await this.getMany([key]);
    return map[key] as T | undefined;
  },

  /** Upsert a single setting. `value` is JSON-serialisable. */
  put(key: string, value: unknown): Promise<{ ok: true }> {
    return apiClient.put<{ ok: true }>('/settings', { key, value });
  },

  // ── Search config ─────────────────────────────────────────────────────

  getSearchConfig(signal?: AbortSignal): Promise<SearchConfig> {
    return apiClient
      .get<{ searchConfig: SearchConfig }>('/settings/search-config', { signal })
      .then((res) => res.searchConfig);
  },

  putSearchConfig(config: SearchConfig): Promise<SearchConfig> {
    return apiClient
      .put<{ searchConfig: SearchConfig }>('/settings/search-config', config)
      .then((res) => res.searchConfig);
  },

  // ── System instructions ───────────────────────────────────────────────

  getSystemInstructions(signal?: AbortSignal): Promise<string> {
    return apiClient
      .get<{ systemInstructions: string }>('/settings/system-instructions', { signal })
      .then((res) => res.systemInstructions);
  },

  putSystemInstructions(text: string): Promise<string> {
    return apiClient
      .put<{ systemInstructions: string }>('/settings/system-instructions', { systemInstructions: text })
      .then((res) => res.systemInstructions);
  },
};
