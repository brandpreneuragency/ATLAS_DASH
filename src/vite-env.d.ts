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

// ── File System Access API type declarations ──────────────────────
// These APIs are not yet in the default TS DOM lib, so we declare
// the minimal surface used by src/services/browser-folder-connector.ts.

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<{
    name: string;
    kind: 'file' | 'directory';
  }>;
}

interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker(): Promise<{ name: string }>;
  showOpenFilePicker(): Promise<Array<{ name: string }>>;
}
