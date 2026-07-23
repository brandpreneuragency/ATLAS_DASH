import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';

/**
 * Files area (Control's `frontend/src/pages/Files.tsx`, M2 map: root-jailed
 * VPS file browser/editor, D-FILES). Wired to `server/app/routers/files.py`
 * — every path this store sends is a relative path under the server's
 * single root jail (`Settings.atlas_root`), resolved server-side through
 * `resolve_safe`; this store never attempts to construct or validate a jail
 * boundary itself, it only ever joins `currentDir + entry.name` (both of
 * which came from the server) or takes verbatim user text for `mkdir`/
 * `move dest`, and lets the backend's 400 `PathViolation` response reject
 * anything illegal.
 *
 * Endpoints:
 *  - GET    /api/files/tree?path=            -> directory listing
 *  - GET    /api/files/read?path=             -> { content, mtime, truncated }
 *  - PUT    /api/files/write                  -> { path, content, expected_mtime }
 *      * expected_mtime set + stale on disk -> 409 (mtime conflict)
 *      * expected_mtime: null -> server skips the check ("overwrite anyway")
 *  - POST   /api/files/mkdir                  -> { path }
 *  - POST   /api/files/move                   -> { paths, dest, overwrite }
 *  - POST   /api/files/delete                 -> { paths, recursive }
 *  - POST   /api/files/upload (multipart)     -> path=<dir>, file=<File>
 *
 * File events (file.created / file.changed / file.deleted) are appended
 * server-side by these same routes — nothing additional is needed here to
 * preserve them.
 */

export interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
  mtime: number;
}

export type DirLoadState = 'loading' | 'ready' | 'error';
export type OpenFileState = 'idle' | 'loading' | 'ready' | 'error';

interface FilesStore {
  currentDir: string;
  entries: FileEntry[];
  dirState: DirLoadState;
  dirError: string | null;

  selected: Set<string>;

  openPath: string | null;
  openContent: string;
  openMtime: number | null;
  openState: OpenFileState;
  openError: string | null;
  dirty: boolean;
  conflict: boolean;

  actionError: string | null;
  busy: boolean;

  navigate: (dir: string) => Promise<void>;
  refreshDir: () => Promise<void>;
  toggleSelect: (path: string) => void;
  clearSelection: () => void;

  openFile: (path: string) => Promise<void>;
  closeFile: () => void;
  setContent: (content: string) => void;
  save: (opts?: { force?: boolean }) => Promise<void>;
  reloadOpenFile: () => Promise<void>;

  mkdir: (name: string) => Promise<boolean>;
  moveSelected: (dest: string) => Promise<boolean>;
  deleteSelected: (recursive?: boolean) => Promise<boolean>;
  upload: (file: File) => Promise<boolean>;
}

export function joinRelPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (body?.detail) return body.detail;
  } catch {
    // no JSON body
  }
  return fallback;
}

export const useFilesStore = create<FilesStore>((set, get) => ({
  currentDir: '',
  entries: [],
  dirState: 'loading',
  dirError: null,

  selected: new Set(),

  openPath: null,
  openContent: '',
  openMtime: null,
  openState: 'idle',
  openError: null,
  dirty: false,
  conflict: false,

  actionError: null,
  busy: false,

  navigate: async (dir) => {
    set({ currentDir: dir, dirState: 'loading', dirError: null, selected: new Set() });
    try {
      const res = await fetch(`/api/files/tree?path=${encodeURIComponent(dir)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        set({ dirState: 'error', dirError: await errorDetail(res, `Could not list "${dir || '/'}" (${res.status}).`) });
        return;
      }
      const body = (await res.json()) as { entries: FileEntry[] };
      set({ entries: body.entries, dirState: 'ready', dirError: null });
    } catch {
      set({ dirState: 'error', dirError: 'Network error listing directory.' });
    }
  },

  refreshDir: async () => {
    await get().navigate(get().currentDir);
  },

  toggleSelect: (path) => {
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { selected: next };
    });
  },

  clearSelection: () => set({ selected: new Set() }),

  openFile: async (path) => {
    set({ openPath: path, openState: 'loading', openError: null, conflict: false, dirty: false });
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        set({ openState: 'error', openError: await errorDetail(res, `Could not open "${path}" (${res.status}).`) });
        return;
      }
      const body = (await res.json()) as { content: string; mtime: number; truncated: boolean };
      set({
        openContent: body.content,
        openMtime: body.mtime,
        openState: 'ready',
        openError: null,
        dirty: false,
        conflict: false,
      });
    } catch {
      set({ openState: 'error', openError: 'Network error opening file.' });
    }
  },

  closeFile: () => set({ openPath: null, openContent: '', openMtime: null, openState: 'idle', dirty: false, conflict: false }),

  setContent: (content) => set({ openContent: content, dirty: true }),

  // The mtime-conflict path (backend `write()`'s 409 when `expected_mtime`
  // is stale): a normal save always sends the mtime we last read. On a 409
  // we surface `conflict: true` and leave `dirty`/`openContent` untouched —
  // the caller must explicitly reload the latest content or force-overwrite
  // (which resends the write with `expected_mtime: null`, matching the
  // backend's "skip the check" contract).
  save: async ({ force = false } = {}) => {
    const { openPath, openContent, openMtime } = get();
    if (openPath === null) return;
    set({ busy: true, actionError: null });
    try {
      const res = await fetch('/api/files/write', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({
          path: openPath,
          content: openContent,
          expected_mtime: force ? null : openMtime,
        }),
      });
      if (res.status === 409) {
        set({ conflict: true });
        return;
      }
      if (!res.ok) {
        set({ actionError: await errorDetail(res, `Could not save "${openPath}" (${res.status}).`) });
        return;
      }
      set({ dirty: false, conflict: false });
      // Re-read to pick up the fresh mtime, and refresh the listing so a
      // newly-created file shows up.
      await get().openFile(openPath);
      await get().refreshDir();
    } catch {
      set({ actionError: 'Network error saving file.' });
    } finally {
      set({ busy: false });
    }
  },

  reloadOpenFile: async () => {
    const { openPath } = get();
    if (openPath === null) return;
    await get().openFile(openPath);
  },

  mkdir: async (name) => {
    const path = joinRelPath(get().currentDir, name);
    set({ busy: true, actionError: null });
    try {
      const res = await fetch('/api/files/mkdir', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        set({ actionError: await errorDetail(res, `Could not create folder "${name}" (${res.status}).`) });
        return false;
      }
      await get().refreshDir();
      return true;
    } catch {
      set({ actionError: 'Network error creating folder.' });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  moveSelected: async (dest) => {
    const paths = Array.from(get().selected);
    if (paths.length === 0) return false;
    set({ busy: true, actionError: null });
    try {
      const res = await fetch('/api/files/move', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ paths, dest, overwrite: false }),
      });
      if (!res.ok) {
        set({ actionError: await errorDetail(res, `Could not move ${paths.length} item(s) (${res.status}).`) });
        return false;
      }
      set({ selected: new Set() });
      await get().refreshDir();
      return true;
    } catch {
      set({ actionError: 'Network error moving item(s).' });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  deleteSelected: async (recursive = true) => {
    const paths = Array.from(get().selected);
    if (paths.length === 0) return false;
    set({ busy: true, actionError: null });
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ paths, recursive }),
      });
      if (!res.ok) {
        set({ actionError: await errorDetail(res, `Could not delete ${paths.length} item(s) (${res.status}).`) });
        return false;
      }
      set({ selected: new Set() });
      if (get().openPath !== null && paths.includes(get().openPath as string)) {
        get().closeFile();
      }
      await get().refreshDir();
      return true;
    } catch {
      set({ actionError: 'Network error deleting item(s).' });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  upload: async (file) => {
    set({ busy: true, actionError: null });
    try {
      const form = new FormData();
      form.set('path', get().currentDir);
      form.set('file', file);
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { [CSRF_HEADER]: '1' },
        body: form,
      });
      if (!res.ok) {
        set({ actionError: await errorDetail(res, `Could not upload "${file.name}" (${res.status}).`) });
        return false;
      }
      await get().refreshDir();
      return true;
    } catch {
      set({ actionError: 'Network error uploading file.' });
      return false;
    } finally {
      set({ busy: false });
    }
  },
}));
