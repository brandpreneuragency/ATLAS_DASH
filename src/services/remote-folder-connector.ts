// src/services/remote-folder-connector.ts — FolderConnector over tabs_api /fs.
import type { FolderConnectionState, FolderConnector, FolderDirEntry, FolderMetadata } from './folder-connector';
import { type FsRoot, tabsApi } from './tabsApi';

export function splitRemotePath(p: string): { root: string; rel: string } {
  const i = p.indexOf(':');
  if (i <= 0) throw new Error(`remote path missing root prefix: ${p}`);
  return { root: p.slice(0, i), rel: p.slice(i + 1) };
}

export function joinRemotePath(root: string, rel: string): string {
  return `${root}:${rel}`;
}

/** True when `c` is a RemoteFolderConnector (has listRoots). */
export function isRemoteFolderConnector(
  c: FolderConnector,
): c is RemoteFolderConnector {
  return typeof (c as RemoteFolderConnector).listRoots === 'function';
}

export class RemoteFolderConnector implements FolderConnector {
  state: FolderConnectionState = 'available';
  onStateChange?: (state: FolderConnectionState) => void;
  private activeRoot: FsRoot | null = null;

  private setState(s: FolderConnectionState) {
    this.state = s;
    this.onStateChange?.(s);
  }

  isAvailable(): boolean {
    return true;
  }

  listRoots(): Promise<FsRoot[]> {
    return tabsApi.fs.roots();
  }

  async connectRoot(rootId: string): Promise<string> {
    this.setState('connecting');
    const roots = await tabsApi.fs.roots();
    const root = roots.find((r) => r.id === rootId);
    if (!root) {
      this.setState('error');
      throw new Error(`unknown root ${rootId}`);
    }
    this.activeRoot = root;
    this.setState('connected');
    return joinRemotePath(root.id, '');
  }

  async connectFolder(): Promise<string | null> {
    const roots = await this.listRoots();
    return roots.length ? this.connectRoot(roots[0].id) : null;
  }

  async readDir(path: string): Promise<FolderDirEntry[]> {
    const { root, rel } = splitRemotePath(path);
    const entries = await tabsApi.fs.list(root, rel);
    return entries.map((e) => ({
      name: e.name,
      path: joinRemotePath(root, e.path),
      kind: e.kind,
    }));
  }

  readTextFile(path: string): Promise<string> {
    const { root, rel } = splitRemotePath(path);
    return tabsApi.fs.readText(root, rel);
  }

  readBinaryFile(path: string): Promise<Uint8Array> {
    const { root, rel } = splitRemotePath(path);
    return tabsApi.fs.readBin(root, rel);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const { root, rel } = splitRemotePath(path);
    await tabsApi.fs.write(root, rel, content);
  }

  async mkdir(path: string, recursive = true): Promise<void> {
    const { root, rel } = splitRemotePath(path);
    await tabsApi.fs.mkdir(root, rel, recursive);
  }

  async remove(path: string, recursive = false): Promise<void> {
    const { root, rel } = splitRemotePath(path);
    await tabsApi.fs.remove(root, rel, recursive);
  }

  async rename(from: string, to: string): Promise<void> {
    const a = splitRemotePath(from);
    const b = splitRemotePath(to);
    if (a.root !== b.root) throw new Error('cross-root rename not supported');
    await tabsApi.fs.rename(a.root, a.rel, b.rel);
  }

  exists(path: string): Promise<boolean> {
    const { root, rel } = splitRemotePath(path);
    return tabsApi.fs.exists(root, rel);
  }

  async getMetadata(path: string): Promise<FolderMetadata> {
    const { root, rel } = splitRemotePath(path);
    const s = await tabsApi.fs.stat(root, rel);
    return {
      size: s.size,
      modifiedAt: s.modifiedAt ? new Date(s.modifiedAt) : null,
      isDirectory: s.isDirectory,
      isFile: s.isFile,
    };
  }

  // No native dialogs in the browser: Save As falls back to the active root's top level.
  async pickSavePath(suggestedName: string): Promise<string | null> {
    return this.activeRoot ? joinRemotePath(this.activeRoot.id, suggestedName) : null;
  }

  async pickOpenFile(): Promise<string | null> {
    return null;
  }
}
