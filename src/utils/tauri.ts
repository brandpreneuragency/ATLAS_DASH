// Runtime detection helpers for the Tauri desktop shell.
//
// In v1, the VPS web build is the only deployment target. Tauri support is
// dormant in the repository (see plan.md § "Tauri Isolation Rules"): the
// `src-tauri/` shell and the browser-only modules in `src/services/` are
// kept around for a future desktop bundle, but the web build must work
// without any Tauri dependency.
//
// Components that previously assumed a local-folder filesystem (the file
// explorer, the markdown-on-disk sync in `taskStore.ts`, etc.) use this
// helper to decide which behaviour to expose. In the browser build, the
// answer is always `false`.

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

export function detectTauri(): boolean {
  if (typeof window === 'undefined') return false;
  if ('__TAURI_INTERNALS__' in window) return true;
  if ('__TAURI__' in window) return true;
  const ua = window.navigator?.userAgent ?? '';
  return ua.includes('Tauri');
}
