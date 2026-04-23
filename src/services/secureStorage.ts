/**
 * Secure key-value storage abstraction.
 * Current implementation: IndexedDB via the existing settings table.
 * When Tauri is integrated, swap this module's internals to use
 * @tauri-apps/plugin-stronghold (OS keychain) without touching any callers.
 */
import { db } from './db';

export async function secureGet(key: string): Promise<string | null> {
  const row = await db.settings.get(key);
  return row ? String(row.value) : null;
}

export async function secureSet(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

export async function secureDelete(key: string): Promise<void> {
  await db.settings.delete(key);
}
