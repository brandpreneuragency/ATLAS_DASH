// Tauri folder connector — real native folder access through Tauri plugins.
//
// This adapter wraps the Tauri dialog and fs plugins behind the
// FolderConnector interface so UI code never imports @tauri-apps directly.

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
import type {
  FolderConnector,
  FolderConnectionState,
  FolderDirEntry,
  FolderMetadata,
} from './folder-connector';

function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

function join(parent: string, name: string): string {
  return normalize(parent).replace(/\/+$/, '') + '/' + name;
}

export class TauriFolderConnector implements FolderConnector {
  private _state: FolderConnectionState = 'available';
  private _onStateChange?: (state: FolderConnectionState) => void;

  get state(): FolderConnectionState {
    return this._state;
  }

  isAvailable(): boolean {
    return true;
  }

  set onStateChange(cb: ((state: FolderConnectionState) => void) | undefined) {
    this._onStateChange = cb;
  }

  private setState(s: FolderConnectionState) {
    this._state = s;
    this._onStateChange?.(s);
  }

  async connectFolder(): Promise<string | null> {
    this.setState('connecting');
    try {
      const result = await dialogOpen({ directory: true, multiple: false });
      const path = typeof result === 'string' ? normalize(result) : null;
      if (path) {
        this.setState('connected');
      } else {
        this.setState('available');
      }
      return path;
    } catch {
      this.setState('error');
      return null;
    }
  }

  async readDir(path: string): Promise<FolderDirEntry[]> {
    const entries = await tauriReadDir(path);
    return entries.map((e) => ({
      name: e.name,
      path: join(path, e.name),
      kind: e.isDirectory ? 'directory' : 'file',
    }));
  }

  async readTextFile(path: string): Promise<string> {
    return await tauriReadTextFile(path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await tauriWriteTextFile(path, content);
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    await tauriMkdir(path, { recursive });
  }

  async remove(path: string, recursive = false): Promise<void> {
    await tauriRemove(path, { recursive });
  }

  async rename(from: string, to: string): Promise<void> {
    await tauriRename(from, to);
  }

  async exists(path: string): Promise<boolean> {
    return await tauriExists(path);
  }

  async getMetadata(path: string): Promise<FolderMetadata> {
    const info = await tauriStat(path);
    return {
      size: info.size,
      modifiedAt: info.mtime ?? null,
      isDirectory: info.isDirectory,
      isFile: info.isFile,
    };
  }

  async pickSavePath(
    suggestedName: string,
    defaultPath?: string,
    filters: DialogFilter[] = [{ name: 'All Files', extensions: ['*'] }],
  ): Promise<string | null> {
    return await dialogSave({
      defaultPath: defaultPath ? join(defaultPath, suggestedName) : suggestedName,
      filters,
    });
  }

  async pickOpenFile(
    filters: { name: string; extensions: string[] }[] = [],
  ): Promise<string | null> {
    const tauriFilters: DialogFilter[] = filters.map((f) => ({
      name: f.name,
      extensions: f.extensions,
    }));
    const result = await dialogOpen({ multiple: false, filters: tauriFilters });
    return typeof result === 'string' ? normalize(result) : null;
  }
}
