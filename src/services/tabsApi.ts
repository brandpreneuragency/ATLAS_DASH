// src/services/tabsApi.ts — same-origin client for the tabs_api service.
export interface FsRoot {
  id: string;
  label: string;
  path: string;
}
export interface FsEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

let _available: boolean | null = null;

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text().catch(() => '')}`);
  return res.json() as Promise<T>;
}

export const tabsApi = {
  async available(): Promise<boolean> {
    if (_available !== null) return _available;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch('/fs/roots', { signal: ctrl.signal });
      clearTimeout(t);
      _available = res.ok;
    } catch {
      _available = false;
    }
    return _available;
  },
  /** Test helper / re-probe after deploy. */
  resetAvailability(): void {
    _available = null;
  },
  fs: {
    roots: () => json<{ roots: FsRoot[] }>('/fs/roots').then((r) => r.roots),
    list: (root: string, path: string) =>
      json<{ entries: FsEntry[] }>(
        `/fs/list?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
      ).then((r) => r.entries),
    readText: (root: string, path: string) =>
      fetch(`/fs/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`).then((r) => {
        if (!r.ok) throw new Error(`read ${path}: ${r.status}`);
        return r.text();
      }),
    readBin: (root: string, path: string) =>
      fetch(`/fs/read-bin?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`).then(
        async (r) => {
          if (!r.ok) throw new Error(`read-bin ${path}: ${r.status}`);
          return new Uint8Array(await r.arrayBuffer());
        },
      ),
    write: (root: string, path: string, content: string) =>
      json<{ ok: true }>('/fs/write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ root, path, content }),
      }),
    mkdir: (root: string, path: string, recursive = true) =>
      json<{ ok: true }>('/fs/mkdir', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ root, path, recursive }),
      }),
    remove: (root: string, path: string, recursive = false) =>
      json<{ ok: true }>('/fs/remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ root, path, recursive }),
      }),
    rename: (root: string, from: string, to: string) =>
      json<{ ok: true }>('/fs/rename', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ root, from, to }),
      }),
    stat: (root: string, path: string) =>
      json<{ size: number; modifiedAt: string; isDirectory: boolean; isFile: boolean }>(
        `/fs/stat?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
      ),
    exists: (root: string, path: string) =>
      json<{ exists: boolean }>(
        `/fs/exists?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
      ).then((r) => r.exists),
  },
};
