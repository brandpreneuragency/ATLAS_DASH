/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL the frontend uses for API calls. Defaults to `/api` (same
   * origin in production, Vite-proxied to the API in dev). The browser
   * bundle reads this via `import.meta.env.VITE_API_BASE_URL`.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
