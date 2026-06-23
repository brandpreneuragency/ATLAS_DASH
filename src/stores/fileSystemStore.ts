// TABS file-system store.
//
// Phase 3 (Tauri migration): all file I/O is path-based. The old
// FileSystemDirectoryHandle / FileSystemFileHandle abstractions are gone.
// A TreeNode carries a `fullPath` (absolute, forward slashes) that is used
// for every fs/dialog call via the `fs-adapter` service.
import { create } from 'zustand';
import { db } from '../services/db';
import { useUIStore } from './uiStore';
import {
  openFolderDialog,
  readDir,
  writeTextFile,
  mkdir,
  remove as fsRemove,
  rename as fsRename,
  exists as fsExists,
  basename,
  joinPath,
  isNativeFsAvailable,
} from '../services/fs-adapter';

const toast = (msg: string) => useUIStore.getState().showToast(msg, 'error');

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export type TreeNode = {
  name: string;
  /** Display path (e.g. "myapp/src/foo.tsx"). Used for UI labels and keying. */
  path: string;
  /** Absolute path on disk (forward slashes). Use for every fs operation. */
  fullPath: string;
  kind: 'file' | 'directory';
  children?: TreeNode[];
};

export interface ConnectedFolder {
  id: string;
  /** Absolute path of the folder root. */
  path: string;
  rootNode: TreeNode | null;
}

export type FolderCapability = 'unsupported' | 'available';

interface FileSystemStore {
  rootNode: TreeNode | null;
  loading: boolean;
  error: string | null;
  needsReconnect: boolean;
  folderCapability: FolderCapability;

  connectedFolders: ConnectedFolder[];
  activeFolderId: string | null;

  openFolder: () => Promise<void>;
  closeFolder: () => void;
  connectFolder: (fullPath: string) => Promise<void>;
  disconnectFolder: (id: string) => void;
  setActiveFolderId: (id: string) => void;
  refreshDir: (fullPath: string) => Promise<void>;
  ensureChildrenLoaded: (fullPath: string) => Promise<void>;
  ensureSubtreeLoaded: (fullPath: string) => Promise<void>;
  loadFileSystemSettings: () => Promise<void>;

  createFile: (parentFullPath: string, name: string) => Promise<void>;
  createDirectory: (parentFullPath: string, name: string) => Promise<void>;
  rename: (fullPath: string, newName: string) => Promise<{ oldPath: string; newPath: string; kind: 'file' | 'directory' } | null>;
  remove: (fullPath: string) => Promise<string[]>;
  move: (sourceFullPath: string, targetDirFullPath: string) => Promise<{ oldPaths: string[]; newBasePath: string } | null>;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

async function buildChildren(
  parentFullPath: string,
  parentDisplayPath: string
): Promise<TreeNode[]> {
  const entries = await readDir(parentFullPath);
  return sortNodes(
    entries.map((e) => ({
      name: e.name,
      path: joinPath(parentDisplayPath, e.name),
      fullPath: e.path,
      kind: e.kind,
    }))
  );
}

function findNodeByFullPath(node: TreeNode | null, fullPath: string): TreeNode | null {
  if (!node) return null;
  if (node.fullPath === fullPath) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByFullPath(child, fullPath);
      if (found) return found;
    }
  }
  return null;
}

function setChildrenAtPath(node: TreeNode, fullPath: string, children: TreeNode[]): TreeNode {
  if (node.fullPath === fullPath) return { ...node, children };
  if (!node.children) return node;
  return {
    ...node,
    children: node.children.map((c) => setChildrenAtPath(c, fullPath, children)),
  };
}

const MAX_SUBTREE_INDEX_DEPTH = 48;

function mergeChildrenWithExistingSubtrees(
  nextChildren: TreeNode[],
  existingChildren?: TreeNode[]
): TreeNode[] {
  if (!existingChildren || existingChildren.length === 0) return sortNodes(nextChildren);
  const existingByFullPath = new Map(existingChildren.map((c) => [c.fullPath, c]));
  const merged = nextChildren.map((next) => {
    const existing = existingByFullPath.get(next.fullPath);
    if (!existing) return next;
    if (next.kind !== 'directory' || existing.kind !== 'directory') return next;
    if (existing.children === undefined) return next;
    return { ...next, children: existing.children };
  });
  return sortNodes(merged);
}

async function loadSubtree(
  node: TreeNode,
  depth = 0
): Promise<{ node: TreeNode; changed: boolean }> {
  if (node.kind !== 'directory') return { node, changed: false };
  if (depth >= MAX_SUBTREE_INDEX_DEPTH) {
    if (node.children !== undefined) return { node, changed: false };
    return { node: { ...node, children: [] }, changed: true };
  }
  let changed = false;
  let children = node.children;
  if (children === undefined) {
    try {
      children = await buildChildren(node.fullPath, node.path);
      changed = true;
    } catch {
      return { node: { ...node, children: [] }, changed: true };
    }
  }
  const loadedChildren: TreeNode[] = [];
  for (const child of children) {
    if (child.kind !== 'directory') {
      loadedChildren.push(child);
      continue;
    }
    try {
      const loaded = await loadSubtree(child, depth + 1);
      loadedChildren.push(loaded.node);
      if (loaded.changed) changed = true;
    } catch {
      if (child.children === undefined) {
        loadedChildren.push({ ...child, children: [] });
        changed = true;
      } else {
        loadedChildren.push(child);
      }
    }
  }
  if (!changed) return { node, changed: false };
  return { node: { ...node, children: sortNodes(loadedChildren) }, changed: true };
}

function getParentFullPath(fullPath: string): string {
  const idx = fullPath.lastIndexOf('/');
  return idx === -1 ? fullPath : fullPath.slice(0, idx);
}

function validateName(name: string, siblings: TreeNode[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty.';
  if (trimmed.includes('/') || trimmed.includes('\\')) return 'Name cannot contain / or \\.';
  if (siblings.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return `"${trimmed}" already exists.`;
  }
  return null;
}

function collectAllFullPaths(node: TreeNode): string[] {
  const paths = [node.fullPath];
  if (node.children) {
    for (const child of node.children) paths.push(...collectAllFullPaths(child));
  }
  return paths;
}

export const useFileSystemStore = create<FileSystemStore>((set, get) => ({
  rootNode: null,
  loading: false,
  error: null,
  needsReconnect: false,
  folderCapability: isNativeFsAvailable() ? 'available' : 'unsupported',

  connectedFolders: [],
  activeFolderId: null,

  connectFolder: async (fullPath: string) => {
    const { connectedFolders } = get();
    set({ loading: true, error: null });
    try {
      const name = basename(fullPath);
      const children = await buildChildren(fullPath, name);
      const usedSlots = new Set(connectedFolders.map((f) => parseInt(f.id)));
      let slot = 0;
      while (usedSlots.has(slot)) slot++;
      const id = String(slot);
      const rootNode: TreeNode = {
        name,
        path: name,
        fullPath,
        kind: 'directory',
        children,
      };
      const newFolders = [...connectedFolders, { id, path: fullPath, rootNode }];
      await db.fileHandles.put({ key: `rootFolder_${id}`, path: fullPath });
      set({
        connectedFolders: newFolders,
        activeFolderId: id,
        rootNode,
        loading: false,
        needsReconnect: false,
        error: null,
      });
    } catch (err: unknown) {
      set({ loading: false, error: getErrorMessage(err) });
    }
  },

  disconnectFolder: (id: string) => {
    const { connectedFolders, activeFolderId } = get();
    const remaining = connectedFolders.filter((f) => f.id !== id);
    void db.fileHandles.delete(`rootFolder_${id}`);
    if (id === activeFolderId) {
      if (remaining.length > 0) {
        const next = remaining[0];
        set({
          connectedFolders: remaining,
          activeFolderId: next.id,
          rootNode: next.rootNode,
        });
      } else {
        set({
          connectedFolders: [],
          activeFolderId: null,
          rootNode: null,
          error: null,
          needsReconnect: false,
        });
      }
    } else {
      set({ connectedFolders: remaining });
    }
  },

  setActiveFolderId: (id: string) => {
    const folder = get().connectedFolders.find((f) => f.id === id);
    if (folder) {
      set({
        activeFolderId: id,
        rootNode: folder.rootNode,
        needsReconnect: !folder.rootNode,
      });
    }
  },

  openFolder: async () => {
    if (!isNativeFsAvailable()) return;
    set({ loading: true, error: null });
    try {
      const fullPath = await openFolderDialog();
      if (!fullPath) {
        set({ loading: false });
        return;
      }
      await get().connectFolder(fullPath);
    } catch (err: unknown) {
      set({ loading: false, error: getErrorMessage(err) });
      toast(`Failed to open folder: ${getErrorMessage(err)}`);
    }
  },

  closeFolder: () => {
    const { activeFolderId } = get();
    if (activeFolderId) {
      get().disconnectFolder(activeFolderId);
    }
  },

  refreshDir: async (fullPath: string) => {
    const { rootNode, connectedFolders, activeFolderId } = get();
    const node = findNodeByFullPath(rootNode, fullPath);
    if (!node || node.kind !== 'directory' || !rootNode) return;
    const children = await buildChildren(node.fullPath, node.path);
    const merged = mergeChildrenWithExistingSubtrees(children, node.children);
    const updatedRootNode = setChildrenAtPath(rootNode, fullPath, merged);
    set({
      rootNode: updatedRootNode,
      connectedFolders: connectedFolders.map((f) =>
        f.id === activeFolderId ? { ...f, rootNode: updatedRootNode } : f
      ),
    });
  },

  ensureChildrenLoaded: async (fullPath: string) => {
    const { rootNode, connectedFolders, activeFolderId } = get();
    const node = findNodeByFullPath(rootNode, fullPath);
    if (!node || node.kind !== 'directory' || node.children !== undefined || !rootNode) return;
    const children = await buildChildren(node.fullPath, node.path);
    const updatedRootNode = setChildrenAtPath(rootNode, fullPath, children);
    set({
      rootNode: updatedRootNode,
      connectedFolders: connectedFolders.map((f) =>
        f.id === activeFolderId ? { ...f, rootNode: updatedRootNode } : f
      ),
    });
  },

  ensureSubtreeLoaded: async (fullPath: string) => {
    const { rootNode, activeFolderId } = get();
    const node = findNodeByFullPath(rootNode, fullPath);
    if (!node || node.kind !== 'directory' || !rootNode) return;

    const initialActiveFolderId = activeFolderId;
    const initialRootFullPath = rootNode.fullPath;
    const result = await loadSubtree(node);

    if (!result?.changed) return;

    const current = get();
    const currentRootNode = current.rootNode;
    if (
      current.activeFolderId !== initialActiveFolderId ||
      !currentRootNode ||
      currentRootNode.fullPath !== initialRootFullPath
    ) {
      return;
    }

    const updatedRootNode =
      result.node.fullPath === currentRootNode.fullPath
        ? result.node
        : setChildrenAtPath(currentRootNode, fullPath, result.node.children ?? []);

    set({
      rootNode: updatedRootNode,
      connectedFolders: current.connectedFolders.map((f) =>
        f.id === initialActiveFolderId ? { ...f, rootNode: updatedRootNode } : f
      ),
    });
  },

  loadFileSystemSettings: async () => {
    if (!isNativeFsAvailable()) {
      set({
        connectedFolders: [],
        activeFolderId: null,
        rootNode: null,
        needsReconnect: false,
        loading: false,
        folderCapability: 'unsupported',
      });
      return;
    }
    set({ folderCapability: 'available' });
    const records = await db.fileHandles.toArray();
    const folders: ConnectedFolder[] = [];
    for (const record of records) {
      if (!record.key.startsWith('rootFolder_')) continue;
      const id = record.key.replace('rootFolder_', '');
      const fullPath = record.path;
      try {
        if (await fsExists(fullPath)) {
          const name = basename(fullPath);
          const children = await buildChildren(fullPath, name);
          const rootNode: TreeNode = {
            name,
            path: name,
            fullPath,
            kind: 'directory',
            children,
          };
          folders.push({ id, path: fullPath, rootNode });
        } else {
          await db.fileHandles.delete(record.key);
        }
      } catch {
        await db.fileHandles.delete(record.key);
      }
    }
    if (folders.length > 0) {
      const first = folders[0];
      set({
        connectedFolders: folders,
        activeFolderId: first.id,
        rootNode: first.rootNode,
        needsReconnect: false,
      });
    }
  },

  createFile: async (parentFullPath: string, name: string) => {
    const { rootNode } = get();
    const parent = findNodeByFullPath(rootNode, parentFullPath);
    if (!parent || parent.kind !== 'directory') return;
    const siblings = parent.children ?? [];
    const err = validateName(name, siblings);
    if (err) { toast(err); return; }
    const trimmed = name.trim();
    const newPath = joinPath(parentFullPath, trimmed);
    try {
      await writeTextFile(newPath, '');
    } catch (e: unknown) {
      toast(getErrorMessage(e));
      return;
    }
    await get().refreshDir(parentFullPath);
  },

  createDirectory: async (parentFullPath: string, name: string) => {
    const { rootNode } = get();
    const parent = findNodeByFullPath(rootNode, parentFullPath);
    if (!parent || parent.kind !== 'directory') return;
    const siblings = parent.children ?? [];
    const err = validateName(name, siblings);
    if (err) { toast(err); return; }
    const trimmed = name.trim();
    const newPath = joinPath(parentFullPath, trimmed);
    try {
      await mkdir(newPath);
    } catch (e: unknown) {
      toast(getErrorMessage(e));
      return;
    }
    await get().refreshDir(parentFullPath);
  },

  rename: async (fullPath: string, newName: string) => {
    const { rootNode } = get();
    const node = findNodeByFullPath(rootNode, fullPath);
    if (!node) return null;
    const parentFullPath = getParentFullPath(fullPath);
    const parent = findNodeByFullPath(rootNode, parentFullPath);
    if (!parent || parent.kind !== 'directory') return null;
    const siblings = (parent.children ?? []).filter((s) => s.fullPath !== fullPath);
    const err = validateName(newName, siblings);
    if (err) { toast(err); return null; }
    const trimmed = newName.trim();
    const newPath = joinPath(parentFullPath, trimmed);
    try {
      await fsRename(fullPath, newPath);
    } catch (e: unknown) {
      toast(getErrorMessage(e));
      return null;
    }
    await get().refreshDir(parentFullPath);
    return { oldPath: fullPath, newPath, kind: node.kind };
  },

  move: async (sourceFullPath: string, targetDirFullPath: string) => {
    const { rootNode } = get();
    const node = findNodeByFullPath(rootNode, sourceFullPath);
    const targetDir = findNodeByFullPath(rootNode, targetDirFullPath);
    if (!node || !targetDir || targetDir.kind !== 'directory') return null;
    if (
      targetDirFullPath === sourceFullPath ||
      targetDirFullPath.startsWith(sourceFullPath + '/')
    ) {
      return null;
    }
    const sourceParentFullPath = getParentFullPath(sourceFullPath);
    if (sourceParentFullPath === targetDirFullPath) return null;
    const siblings = targetDir.children ?? [];
    const nameErr = validateName(node.name, siblings);
    if (nameErr) { toast(nameErr); return null; }
    const newPath = joinPath(targetDirFullPath, node.name);
    try {
      await fsRename(sourceFullPath, newPath);
    } catch (e: unknown) {
      toast(getErrorMessage(e));
      return null;
    }
    await get().refreshDir(sourceParentFullPath);
    await get().refreshDir(targetDirFullPath);
    return { oldPaths: collectAllFullPaths(node), newBasePath: newPath };
  },

  remove: async (fullPath: string) => {
    const { rootNode } = get();
    const node = findNodeByFullPath(rootNode, fullPath);
    if (!node) return [];
    const parentFullPath = getParentFullPath(fullPath);
    const removedPaths = collectAllFullPaths(node);
    try {
      await fsRemove(fullPath, node.kind === 'directory');
    } catch (e: unknown) {
      toast(getErrorMessage(e));
      return [];
    }
    await get().refreshDir(parentFullPath);
    return removedPaths;
  },
}));
