// Theme token store. Persists user overrides of the design-token CSS variables
// (`--c-*`, `--fs-*`, spacing, radius, shadows, font-family) to IndexedDB and
// applies them at runtime as inline CSS variables on `:root`.
//
// Persistence follows the repo's existing Dexie pattern (`db.settings`) rather
// than a Tauri FS JSON file, so it works identically in browser and desktop
// builds. Only overrides are stored; token defaults still come from the CSS.

import { create } from 'zustand';
import { db } from '../services/db';

const STORAGE_KEY = 'themeTokens';
const ROOT = (): HTMLElement => document.documentElement;

export interface ThemeTokensDoc {
  version: number;
  tokens: Record<string, string>;
}

function readDoc(raw: unknown): ThemeTokensDoc {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const tokens = obj.tokens;
    if (tokens && typeof tokens === 'object') {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(tokens as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v;
      }
      return { version: Number(obj.version ?? 1) || 1, tokens: out };
    }
  }
  return { version: 1, tokens: {} };
}

function applyTokens(tokens: Record<string, string>): void {
  const root = ROOT();
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
}

function clearTokenProperty(name: string): void {
  ROOT().style.removeProperty(name);
}

interface ThemeStore {
  tokens: Record<string, string>;
  isLoaded: boolean;
  loadThemeTokens: () => Promise<void>;
  setToken: (name: string, value: string) => void;
  resetToken: (name: string) => void;
  resetAll: () => void;
  hasOverride: (name: string) => boolean;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  tokens: {},
  isLoaded: false,

  loadThemeTokens: async () => {
    try {
      const row = await db.settings.get(STORAGE_KEY);
      const doc = readDoc(row?.value);
      applyTokens(doc.tokens);
      set({ tokens: doc.tokens, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  setToken: (name, value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      get().resetToken(name);
      return;
    }
    const tokens = { ...get().tokens, [name]: trimmed };
    ROOT().style.setProperty(name, trimmed);
    set({ tokens });
    void db.settings.put({ key: STORAGE_KEY, value: JSON.stringify({ version: 1, tokens }) });
  },

  resetToken: (name) => {
    const tokens = { ...get().tokens };
    delete tokens[name];
    clearTokenProperty(name);
    set({ tokens });
    void db.settings.put({ key: STORAGE_KEY, value: JSON.stringify({ version: 1, tokens }) });
  },

  resetAll: () => {
    const names = Object.keys(get().tokens);
    for (const name of names) clearTokenProperty(name);
    set({ tokens: {} });
    void db.settings.put({ key: STORAGE_KEY, value: JSON.stringify({ version: 1, tokens: {} }) });
  },

  hasOverride: (name) => Object.prototype.hasOwnProperty.call(get().tokens, name),
}));

/** Read the effective value of a token (override, else the computed CSS value). */
export function getTokenDisplayValue(name: string): string {
  const override = useThemeStore.getState().tokens[name];
  if (override !== undefined) return override;
  if (typeof window !== 'undefined') {
    return getComputedStyle(ROOT()).getPropertyValue(name).trim();
  }
  return '';
}
