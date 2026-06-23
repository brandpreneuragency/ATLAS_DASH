import { isTauriRuntime } from './runtime';

/**
 * Use Tauri's native HTTP client in the desktop app so API calls are not
 * blocked by WebView CORS rules. Browser builds keep the standard fetch path.
 */
export const runtimeFetch: typeof fetch = async (input, init) => {
  if (isTauriRuntime()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(input, init);
  }

  return globalThis.fetch(input, init);
};
