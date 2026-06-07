// Shared fetch helper. Picks the right `fetch` implementation based on
// the runtime:
//
//   * In a Tauri webview (desktop), use `@tauri-apps/plugin-http`. Tauri's
//     Rust-side fetch is required because the standard browser fetch is
//     blocked by Tauri's CSP and permission system in many builds.
//   * In a normal browser webview, use `globalThis.fetch` (the standard
//     browser implementation; we don't want to load the Tauri plugin in
//     the web bundle — it's not installed there and the import would fail).
//
// The choice is locked at module-load time: we re-read the global
// `__TAURI_INTERNALS__` flag (set by the Tauri runtime) once and use it
// for the lifetime of the module. There is no dynamic re-evaluation —
// Tauri mode is determined by the build, not by user action.

import { detectTauri } from '../../utils/tauri';

type FetchFn = typeof globalThis.fetch;

let tauriFetch: FetchFn | null = null;
let resolved: FetchFn | null = null;

async function loadTauriFetch(): Promise<FetchFn> {
  if (tauriFetch) return tauriFetch;
  // Dynamic import so the web build doesn't even attempt to resolve the
  // Tauri module. `detectTauri()` may be `false` in the webview, but the
  // import path exists on disk; resolving it at runtime via `import()`
  // defers the load and lets the bundler tree-shake it in browser builds.
  const mod = (await import('@tauri-apps/plugin-http')) as { fetch?: FetchFn };
  if (typeof mod.fetch !== 'function') {
    throw new Error('@tauri-apps/plugin-http did not export a fetch function');
  }
  tauriFetch = mod.fetch.bind(null) as FetchFn;
  return tauriFetch;
}

/** Resolve the fetch implementation to use. Awaits the Tauri dynamic
 *  import in Tauri mode; returns the global fetch otherwise. */
export async function resolveFetch(): Promise<FetchFn> {
  if (resolved) return resolved;
  if (detectTauri()) {
    resolved = await loadTauriFetch();
  } else {
    resolved = globalThis.fetch.bind(globalThis) as FetchFn;
  }
  return resolved;
}
