// Secure key-value storage backed by the OS keychain
// (Windows Credential Manager / macOS Keychain / Linux Secret Service).
//
// Backed by the `keyring` Rust crate (exposed to the frontend through three
// custom commands `secret_get` / `secret_set` / `secret_delete` defined in
// `src-tauri/src/commands/secrets.rs`). We use the crate directly rather than
// a Tauri plugin wrapper because there is no Tauri 2-compatible
// `tauri-plugin-keyring` on crates.io.
//
// A one-time migration runs lazily on first call to `secureGet`: any legacy
// secret values sitting in the IndexedDB `settings` table are copied to the
// keychain and removed from the table.
import { db } from './db';

// Tauri-only key-value storage backed by the OS keychain. The `invoke`
// call is a dynamic import so the static module graph never references
// `@tauri-apps/api/core` in the web bundle; the bundler tree-shakes the
// dynamic-import target out entirely in browser builds. This module has
// no live consumers on the web build (the `searchConfig` /
// `systemInstructions` keys were migrated to `settingsRepository` in
// Agent 6), but we keep the file + pattern intact for the dormant Tauri
// desktop bundle.

type TauriCore = {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
};

let tauriCorePromise: Promise<TauriCore> | null = null;
async function loadTauriCore(): Promise<TauriCore> {
  if (!tauriCorePromise) {
    tauriCorePromise = (async () => {
      const mod = (await import('@tauri-apps/api/core')) as TauriCore;
      return mod;
    })();
  }
  return tauriCorePromise;
}

// Keys that used to live in db.settings and are now keychain-backed.
const MIGRATED_KEYS = new Set(['searchConfig', 'systemInstructions']);
const MIGRATION_FLAG = 'secureStorageMigratedToKeychain';

let migrationPromise: Promise<void> | null = null;

async function runMigrationOnce(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    try {
      const flag = await db.settings.get(MIGRATION_FLAG);
      if (flag?.value === '1') return;
      const core = await loadTauriCore();
      for (const key of MIGRATED_KEYS) {
        const row = await db.settings.get(key);
        const value = row?.value;
        if (value === undefined || value === null) continue;
        const str = String(value);
        try {
          await core.invoke<string | null>('secret_set', { account: key, value: str });
          await db.settings.delete(key);
        } catch (err) {
          console.warn(`[secureStorage] migration failed for "${key}":`, err);
        }
      }
      await db.settings.put({ key: MIGRATION_FLAG, value: '1' });
    } catch (err) {
      console.warn('[secureStorage] migration error:', err);
    }
  })();
  return migrationPromise;
}

export async function secureGet(key: string): Promise<string | null> {
  await runMigrationOnce();
  try {
    const core = await loadTauriCore();
    const v = await core.invoke<string | null>('secret_get', { account: key });
    return v ?? null;
  } catch (err) {
    console.warn(`[secureGet] "${key}" failed:`, err);
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  await runMigrationOnce();
  const core = await loadTauriCore();
  await core.invoke('secret_set', { account: key, value });
}

export async function secureDelete(key: string): Promise<void> {
  await runMigrationOnce();
  const core = await loadTauriCore();
  await core.invoke('secret_delete', { account: key });
}
