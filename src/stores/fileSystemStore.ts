import { create } from 'zustand';
import { db } from '../services/db';

export type TreeNode = {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: TreeNode[];
};

interface FileSystemStore {
  rootHandle: FileSystemDirectoryHandle | null;
  rootNode: TreeNode | null;
  loading: boolean;
  error: string | null;
  needsReconnect: boolean;
  permissionLost: boolean;

  openFolder: () => Promise<void>;
  closeFolder: () => void;
  refreshDir: (path: string) => Promise<void>;
  ensureChildrenLoaded: (path: string) => Promise<void>;
  loadFileSystemSettings: () => Promise<void>;
  reconnectPermission: () => Promise<void>;

  createFile: (parentPath: string, name: string) => Promise<void>;
  createDirectory: (parentPath: string, name: string) => Promise<void>;
  rename: (path: string, newName: string) => Promise<{ oldPath: string; newPath: string; kind: 'file' | 'directory' } | null>;
  remove: (path: string) => Promise<string[]>;
  move: (sourcePath: string, targetDirPath: string) => Promise<{ oldPaths: string[]; newBasePath: string } | null>;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

async function buildChildren(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string
): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];
  for await (const [name, handle] of dirHandle.entries()) {
    nodes.push({
      name,
      path: `${parentPath}/${name}`,
      kind: handle.kind,
      handle,
    });
  }
  return sortNodes(nodes);
}

function findNodeByPath(node: TreeNode | null, path: string): TreeNode | null {
  if (!node) return null;
  if (node.path === path) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
  }
  return null;
}

function setChildrenAtPath(node: TreeNode, path: string, children: TreeNode[]): TreeNode {
  if (node.path === path) return { ...node, children };
  if (!node.children) return node;
  return {
    ...node,
    children: node.children.map((c) => setChildrenAtPath(c, path, children)),
  };
}

function getParentPath(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(0, idx);
}

function validateName(name: string, siblings: TreeNode[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty.';
  if (trimmed.includes('/') || trimmed.includes('\\')) return 'Name cannot contain / or \\.';
  if (siblings.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return `"${trimmed}" already exists.`;
  return null;
}

async function copyDirectoryRecursive(
  srcHandle: FileSystemDirectoryHandle,
  destParentHandle: FileSystemDirectoryHandle,
  destName: string
): Promise<void> {
  const destDir = await destParentHandle.getDirectoryHandle(destName, { create: true });
  for await (const [name, handle] of srcHandle.entries()) {
    if (handle.kind === 'file') {
      const srcFile = await (handle as FileSystemFileHandle).getFile();
      const destFile = await destDir.getFileHandle(name, { create: true });
      const writable = await destFile.createWritable();
      await writable.write(srcFile);
      await writable.close();
    } else {
      await copyDirectoryRecursive(handle as FileSystemDirectoryHandle, destDir, name);
    }
  }
}

function collectAllPaths(node: TreeNode): string[] {
  const paths = [node.path];
  if (node.children) {
    for (const child of node.children) paths.push(...collectAllPaths(child));
  }
  return paths;
}

async function withPermissionGuard<T>(
  rootHandle: FileSystemDirectoryHandle | null,
  op: () => Promise<T>,
  onLost: () => void
): Promise<T | null> {
  try {
    return await op();
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      if (rootHandle) {
        try {
          const perm = await rootHandle.requestPermission({ mode: 'readwrite' });
          if (perm === 'granted') return await op();
        } catch { /* fall through */ }
      }
      onLost();
      return null;
    }
    throw err;
  }
}

export const useFileSystemStore = create<FileSystemStore>((set, get) => ({
  rootHandle: null,
  rootNode: null,
  loading: false,
  error: null,
  needsReconnect: false,
  permissionLost: false,

  openFolder: async () => {
    console.log('[FS] openFolder called');
    if (!('showDirectoryPicker' in window)) {
      set({ error: 'File System Access API not supported in this browser.' });
      return;
    }
    try {
      set({ loading: true, error: null });
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      console.log('[FS] handle:', handle.name);
      const children = await buildChildren(handle, handle.name);
      console.log('[FS] children count:', children.length);
      const rootNode: TreeNode = {
        name: handle.name,
        path: handle.name,
        kind: 'directory',
        handle,
        children,
      };
      await db.fileHandles.put({ key: 'rootFolder', handle });
      await db.settings.put({ key: 'fileExplorerRootName', value: handle.name });
      set({ rootHandle: handle, rootNode, loading: false, needsReconnect: false });
    } catch (err: any) {
      console.log('[FS] caught error:', err?.name, err?.message, err);
      if (err?.name === 'AbortError') {
        set({ loading: false });
      } else {
        set({ loading: false, error: String(err) });
      }
    }
  },

  closeFolder: () => {
    db.fileHandles.delete('rootFolder');
    db.settings.delete('fileExplorerRootName');
    set({ rootHandle: null, rootNode: null, error: null, needsReconnect: false });
  },

  refreshDir: async (path: string) => {
    const { rootNode } = get();
    const node = findNodeByPath(rootNode, path);
    if (!node || node.kind !== 'directory' || !rootNode) return;
    const children = await buildChildren(node.handle as FileSystemDirectoryHandle, node.path);
    set({ rootNode: setChildrenAtPath(rootNode, path, children) });
  },

  ensureChildrenLoaded: async (path: string) => {
    const { rootNode } = get();
    const node = findNodeByPath(rootNode, path);
    if (!node || node.kind !== 'directory' || node.children !== undefined || !rootNode) return;
    const children = await buildChildren(node.handle as FileSystemDirectoryHandle, node.path);
    set({ rootNode: setChildrenAtPath(rootNode, path, children) });
  },

  loadFileSystemSettings: async () => {
    const record = await db.fileHandles.get('rootFolder');
    if (!record) return;
    const handle = record.handle;
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        const children = await buildChildren(handle, handle.name);
        const rootNode: TreeNode = {
          name: handle.name,
          path: handle.name,
          kind: 'directory',
          handle,
          children,
        };
        set({ rootHandle: handle, rootNode, needsReconnect: false });
      } else if (perm === 'prompt') {
        set({ rootHandle: handle, needsReconnect: true });
      } else {
        await db.fileHandles.delete('rootFolder');
      }
    } catch {
      await db.fileHandles.delete('rootFolder');
    }
  },

  reconnectPermission: async () => {
    const { rootHandle, loadFileSystemSettings } = get();
    if (!rootHandle) return;
    const perm = await rootHandle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      set({ permissionLost: false });
      await loadFileSystemSettings();
    }
  },

  createFile: async (parentPath: string, name: string) => {
    const { rootNode, rootHandle } = get();
    const parent = findNodeByPath(rootNode, parentPath);
    if (!parent || parent.kind !== 'directory') return;
    const siblings = parent.children ?? [];
    const err = validateName(name, siblings);
    if (err) { alert(err); return; }
    await withPermissionGuard(
      rootHandle,
      async () => { await (parent.handle as FileSystemDirectoryHandle).getFileHandle(name.trim(), { create: true }); },
      () => set({ permissionLost: true })
    );
    await get().refreshDir(parentPath);
  },

  createDirectory: async (parentPath: string, name: string) => {
    const { rootNode, rootHandle } = get();
    const parent = findNodeByPath(rootNode, parentPath);
    if (!parent || parent.kind !== 'directory') return;
    const siblings = parent.children ?? [];
    const err = validateName(name, siblings);
    if (err) { alert(err); return; }
    await withPermissionGuard(
      rootHandle,
      async () => { await (parent.handle as FileSystemDirectoryHandle).getDirectoryHandle(name.trim(), { create: true }); },
      () => set({ permissionLost: true })
    );
    await get().refreshDir(parentPath);
  },

  rename: async (path: string, newName: string) => {
    const { rootNode, rootHandle } = get();
    const node = findNodeByPath(rootNode, path);
    if (!node) return null;
    const parentPath = getParentPath(path);
    const parent = findNodeByPath(rootNode, parentPath);
    if (!parent || parent.kind !== 'directory') return null;
    const siblings = (parent.children ?? []).filter((s) => s.path !== path);
    const err = validateName(newName, siblings);
    if (err) { alert(err); return null; }
    const trimmed = newName.trim();
    const parentDir = parent.handle as FileSystemDirectoryHandle;

    const result = await withPermissionGuard(
      rootHandle,
      async () => {
        if (node.kind === 'file') {
          const srcFile = await (node.handle as FileSystemFileHandle).getFile();
          const destHandle = await parentDir.getFileHandle(trimmed, { create: true });
          const writable = await destHandle.createWritable();
          await writable.write(srcFile);
          await writable.close();
          await parentDir.removeEntry(node.name);
        } else {
          const children = node.children ?? [];
          if (children.length > 500) {
            alert('Directory rename is blocked for folders with more than 500 entries.');
            return null;
          }
          await copyDirectoryRecursive(node.handle as FileSystemDirectoryHandle, parentDir, trimmed);
          await parentDir.removeEntry(node.name, { recursive: true });
        }
        return true;
      },
      () => set({ permissionLost: true })
    );

    if (!result) return null;
    await get().refreshDir(parentPath);
    const newPath = `${parentPath}/${trimmed}`;
    return { oldPath: path, newPath, kind: node.kind };
  },

  move: async (sourcePath: string, targetDirPath: string) => {
    const { rootNode, rootHandle } = get();
    const node = findNodeByPath(rootNode, sourcePath);
    const targetDir = findNodeByPath(rootNode, targetDirPath);
    if (!node || !targetDir || targetDir.kind !== 'directory') return null;

    // Guard: can't move a folder into itself or a descendant
    if (targetDirPath === sourcePath || targetDirPath.startsWith(sourcePath + '/')) return null;

    const sourceParentPath = getParentPath(sourcePath);
    if (sourceParentPath === targetDirPath) return null; // already in target

    const targetDirHandle = targetDir.handle as FileSystemDirectoryHandle;
    const siblings = targetDir.children ?? [];
    const nameErr = validateName(node.name, siblings);
    if (nameErr) { alert(nameErr); return null; }

    const result = await withPermissionGuard(rootHandle, async () => {
      if (node.kind === 'file') {
        const srcFile = await (node.handle as FileSystemFileHandle).getFile();
        const destHandle = await targetDirHandle.getFileHandle(node.name, { create: true });
        const writable = await destHandle.createWritable();
        await writable.write(await srcFile.arrayBuffer());
        await writable.close();
      } else {
        await copyDirectoryRecursive(node.handle as FileSystemDirectoryHandle, targetDirHandle, node.name);
      }
      const srcParent = findNodeByPath(get().rootNode, sourceParentPath);
      if (srcParent) {
        await (srcParent.handle as FileSystemDirectoryHandle).removeEntry(node.name, { recursive: node.kind === 'directory' });
      }
      return true;
    }, () => set({ permissionLost: true }));

    if (!result) return null;
    await get().refreshDir(sourceParentPath);
    await get().refreshDir(targetDirPath);
    return { oldPaths: collectAllPaths(node), newBasePath: `${targetDirPath}/${node.name}` };
  },

  remove: async (path: string) => {
    const { rootNode, rootHandle } = get();
    const node = findNodeByPath(rootNode, path);
    if (!node) return [];
    const parentPath = getParentPath(path);
    const parent = findNodeByPath(rootNode, parentPath);
    if (!parent || parent.kind !== 'directory') return [];
    const removedPaths = collectAllPaths(node);
    const parentDir = parent.handle as FileSystemDirectoryHandle;
    await withPermissionGuard(
      rootHandle,
      async () => { await parentDir.removeEntry(node.name, { recursive: node.kind === 'directory' }); },
      () => set({ permissionLost: true })
    );
    await get().refreshDir(parentPath);
    return removedPaths;
  },
}));
