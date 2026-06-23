// Secure-ish storage for API keys and small secrets.
//
// Tauri desktop builds route through the OS keychain via the
// `plugin://secure-storage` IPC bridge, which gives us real at-rest
// protection.
//
// Web builds do not have access to the keychain. To keep the same call
// sites working in the browser, we fall back to a Web Crypto + localStorage
// scheme: the per-session encryption key lives in `sessionStorage` (dies on
// tab close), and the ciphertext for each entry is stored in `localStorage`
// (so it survives reloads). When the tab closes, the key is discarded and
// any previously written ciphertext becomes undecryptable — a deliberately
// conservative compromise for a non-Tauri environment.
//
// A one-time console warning is emitted the first time the web fallback is
// used so the developer can see why the persistence layer is weaker.

import { invoke, isTauri } from '@tauri-apps/api/core';

export interface Storage {
  secureGet: (key: string) => Promise<string | null>;
  secureSet: (key: string, value: string) => Promise<void>;
  secureDelete: (key: string) => Promise<void>;
}

const WEB_KEY_STORAGE_KEY = 'tabs:web-secure-key';
const WEB_PREFIX = 'tabs:web-secure:';
let webWarningEmitted = false;

function emitWebWarningOnce(): void {
  if (webWarningEmitted) return;
  webWarningEmitted = true;
  // Surfaced for developers only — the UI does not show this. We deliberately
  // do not block the flow because the Tauri keychain is unavailable here.
  console.warn(
    '[secureStorage] Running outside Tauri. Falling back to browser Web Crypto + localStorage. ' +
      'API keys are encrypted with a per-session key that is discarded on tab close.'
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getOrCreateSessionKey(): Promise<CryptoKey> {
  const existing = sessionStorage.getItem(WEB_KEY_STORAGE_KEY);
  if (existing) {
    const raw = base64ToBytes(existing);
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const rawBuffer = await crypto.subtle.exportKey('raw', key);
  const raw = new Uint8Array(rawBuffer);
  sessionStorage.setItem(WEB_KEY_STORAGE_KEY, bytesToBase64(raw));
  return key;
}

async function webSet(key: string, value: string): Promise<void> {
  emitWebWarningOnce();
  const aesKey = await getOrCreateSessionKey();
  const ivBuffer = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuffer);
  crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(value);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);
  const ciphertext = new Uint8Array(cipherBuffer);
  const payload = {
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ciphertext),
  };
  localStorage.setItem(WEB_PREFIX + key, JSON.stringify(payload));
}

async function webGet(key: string): Promise<string | null> {
  const raw = localStorage.getItem(WEB_PREFIX + key);
  if (!raw) return null;
  let payload: { iv?: string; ct?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    // Corrupt entry — drop it and treat as missing.
    localStorage.removeItem(WEB_PREFIX + key);
    return null;
  }
  if (!payload.iv || !payload.ct) return null;
  let aesKey: CryptoKey;
  try {
    aesKey = await getOrCreateSessionKey();
  } catch {
    // Session key is gone (or crypto unavailable). The ciphertext is now
    // undecryptable; remove the entry so we don't keep stale data around.
    localStorage.removeItem(WEB_PREFIX + key);
    return null;
  }
  try {
    const iv = base64ToBytes(payload.iv);
    const ct = base64ToBytes(payload.ct);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
    return new TextDecoder().decode(plaintext);
  } catch {
    // Wrong key or tampered ciphertext — drop it.
    localStorage.removeItem(WEB_PREFIX + key);
    return null;
  }
}

function webDelete(key: string): void {
  localStorage.removeItem(WEB_PREFIX + key);
}

export const secureStorage: Storage = {
  async secureGet(key) {
    if (isTauri()) {
      const value = await invoke<string | null>('secret_get', { account: key });
      return value ?? null;
    }
    return await webGet(key);
  },

  async secureSet(key, value) {
    if (isTauri()) {
      await invoke('secret_set', { account: key, value });
      return;
    }
    await webSet(key, value);
  },

  async secureDelete(key) {
    if (isTauri()) {
      await invoke('secret_delete', { account: key });
      return;
    }
    webDelete(key);
  },
};
