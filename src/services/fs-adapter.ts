// Bridge between the TABS frontend and Tauri's file system + dialog plugins.
//
// All file I/O in the app flows through these functions so that:
//   1. fs/dialog call sites in stores and components are typed and uniform
//   2. Unit tests can mock this module to test behaviour without touching disk
//   3. The backend (Tauri vs the old browser File System Access API) can be
//      swapped in one place if we ever ship a web build again
//
// Paths are stored with forward slashes everywhere; Tauri accepts both
// forward and backward slashes on Windows, so this is a lossless normalisation.
import {
  open as dialogOpen,
  save as dialogSave,
  type DialogFilter,
} from '@tauri-apps/plugin-dialog';
import {
  readDir as tauriReadDir,
  readTextFile as tauriReadTextFile,
  writeTextFile as tauriWriteTextFile,
  mkdir as tauriMkdir,
  remove as tauriRemove,
  rename as tauriRename,
  exists as tauriExists,
  stat as tauriStat,
} from '@tauri-apps/plugin-fs';

export interface FsDirEntry {
  name: string;
  /** Absolute path of the entry (forward slashes). */
  path: string;
  kind: 'file' | 'directory';
}

export interface FsMetadata {
  size: number;
  modifiedAt: Date | null;
  isDirectory: boolean;
  isFile: boolean;
}

// Path helpers -------------------------------------------------------------

function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

function join(parent: string, name: string): string {
  return normalize(parent).replace(/\/+$/, '') + '/' + name;
}

export function joinPath(parent: string, name: string): string {
  return join(parent, name);
}

export function basename(p: string): string {
  return normalize(p).split('/').pop() ?? p;
}

export function getExt(p: string): string {
  const m = normalize(p).match(/\.([^./]+)$/);
  return m ? m[1].toLowerCase() : '';
}

// Dialog picks -------------------------------------------------------------

/** Show a native folder picker. Returns the absolute path, or null if the
 *  user cancelled. */
export async function openFolderDialog(): Promise<string | null> {
  const result = await dialogOpen({ directory: true, multiple: false });
  return typeof result === 'string' ? normalize(result) : null;
}

/** Show a native file-open picker. Returns the absolute path, or null if the
 *  user cancelled. */
export async function openFileDialog(
  filters: DialogFilter[] = []
): Promise<string | null> {
  const result = await dialogOpen({ multiple: false, filters });
  return typeof result === 'string' ? normalize(result) : null;
}

/** Show a native Save As dialog. `defaultPath` may be either a file name
 *  ("note.md") or a folder ("/path/to/folder") in which case the suggested
 *  file name is appended. */
export async function pickSaveTabsPath(
  suggestedName: string,
  filters: DialogFilter[] = [{ name: 'All Files', extensions: ['*'] }],
  defaultPath?: string
): Promise<string | null> {
  return await dialogSave({
    defaultPath: defaultPath ? join(defaultPath, suggestedName) : suggestedName,
    filters,
  });
}

// Directory and file I/O ---------------------------------------------------

/** List a directory's immediate children (non-recursive). */
export async function readDir(path: string): Promise<FsDirEntry[]> {
  const entries = await tauriReadDir(path);
  return entries.map((e) => ({
    name: e.name,
    path: join(path, e.name),
    kind: e.isDirectory ? 'directory' : 'file',
  }));
}

/** Read a UTF-8 text file. */
export async function readTextFile(path: string): Promise<string> {
  return await tauriReadTextFile(path);
}

/** Write a UTF-8 text file. Creates the file if it does not exist;
 *  overwrites if it does. */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await tauriWriteTextFile(path, content);
}

/** Create a directory. */
export async function mkdir(path: string, recursive = false): Promise<void> {
  await tauriMkdir(path, { recursive });
}

/** Delete a file or directory. `recursive` must be true to delete a
 *  non-empty directory. */
export async function remove(path: string, recursive = false): Promise<void> {
  await tauriRemove(path, { recursive });
}

/** Rename or move a file or directory (atomic, single call). */
export async function rename(from: string, to: string): Promise<void> {
  await tauriRename(from, to);
}

/** Check whether a path exists on disk. */
export async function exists(path: string): Promise<boolean> {
  return await tauriExists(path);
}

/** Get file metadata (size, mtime, kind). */
export async function getMetadata(path: string): Promise<FsMetadata> {
  const info = await tauriStat(path);
  return {
    size: info.size,
    modifiedAt: info.mtime ?? null,
    isDirectory: info.isDirectory,
    isFile: info.isFile,
  };
}
