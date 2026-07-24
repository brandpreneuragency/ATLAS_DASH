/**
 * Fetch wrapper for third-party HTTP (AI providers, search APIs).
 * Same-origin `/fs` and `/hermes` clients use plain `fetch` directly.
 */
export const runtimeFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, init);
