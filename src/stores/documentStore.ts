// Document store. Server-backed as of Agent 6 (Frontend AI Migration).
//
// Documents are stored in Postgres and the editor content in a serialized
// TipTap JSON string (capped at 2 MB on the server, see documents.ts).
//
// Tauri-only methods (`openFileFromTree`, `openFileAsDocument`,
// `openFileByPath`) keep their signatures for source compatibility with the
// dormant desktop build, but in the browser web build they short-circuit
// and return `null` — the browser can not read local filesystem paths.
//
// `setActiveDocument` still persists `lastActiveDocumentId` through the
// settings KV. `loadDocuments` restores the active id from there.
//
// On first load (no documents on the server) the store seeds a single
// `Untitled` document, matching the previous Dexie behaviour.

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Document, FileViewerItem } from '../types';
import { documentRepository } from '../repositories/documentRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { useUIStore } from './uiStore';
import { detectTauri } from '../utils/tauri';
import { parseByExt } from '../services/fileFormat';
import { isTextFile, isImageFile } from '../utils/fileType';
import type { TreeNode } from './fileSystemStore';

const toast = (msg: string) => useUIStore.getState().showToast(msg, 'error');

interface DocumentStore {
  documents: Document[];
  activeDocumentId: string | null;
  isLoaded: boolean;

  loadDocuments: () => Promise<void>;
  createDocument: (title?: string) => Promise<Document>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  setActiveDocument: (id: string) => void;
  duplicateDocument: (id: string) => Promise<Document>;
  getActiveDocument: () => Document | null;
  openFileFromViewer: (file: FileViewerItem) => Promise<Document | null>;
  // The Tauri-only methods below are kept for source compatibility with the
  // dormant desktop build. In the browser web build they are no-ops and
  // return `null`. They are intentionally NOT deleted so the desktop
  // resumption work later can re-enable them without a re-merge.
  openFileAsDocument: (node: TreeNode) => Promise<Document | null>;
  openFileFromTree: (node: TreeNode, forceNewTab?: boolean) => Promise<Document | null>;
  openFileByPath: (path: string) => Promise<Document | null>;
  renameDocumentBySourcePath: (oldPath: string, newPath: string, newTitle: string) => Promise<void>;
  deleteDocumentsBySourcePaths: (paths: string[]) => Promise<void>;
  setDocumentSplitEditorOpen: (id: string, v: boolean) => Promise<void>;
}

function emptyDocumentShell(title: string, order: number): Document {
  const now = Date.now();
  return {
    id: nanoid(8),
    title,
    content: '',
    createdAt: now,
    updatedAt: now,
    order,
  };
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  isLoaded: false,

  loadDocuments: async () => {
    try {
      const { documents } = await documentRepository.list();
      if (documents.length === 0) {
        const first = await get().createDocument('Untitled');
        set({ documents: [first], activeDocumentId: first.id, isLoaded: true });
        return;
      }
      const lastActiveId = await settingsRepository.get<string>('lastActiveDocumentId');
      const activeId =
        (typeof lastActiveId === 'string' && documents.find((d) => d.id === lastActiveId)
          ? lastActiveId
          : documents[0].id) ?? documents[0].id;
      set({ documents, activeDocumentId: activeId, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  createDocument: async (title = 'Untitled') => {
    const docs = get().documents;

    // Keep only one empty Untitled draft tab at a time.
    if (title === 'Untitled') {
      const untitledEmptyIds = docs
        .filter((d) => d.title === 'Untitled' && !d.sourcePath && !d.content?.includes('"text":'))
        .map((d) => d.id);

      if (untitledEmptyIds.length > 0) {
        for (const id of untitledEmptyIds) {
          await documentRepository.remove(id).catch(() => undefined);
        }
        const filtered = docs.filter((d) => !untitledEmptyIds.includes(d.id));
        const nextActiveId = filtered[filtered.length - 1]?.id ?? null;
        set({ documents: filtered, activeDocumentId: nextActiveId });
      }
    }

    const shell = emptyDocumentShell(title, get().documents.length);
    const { document } = await documentRepository.create({
      id: shell.id,
      title: shell.title,
      content: shell.content,
      order: shell.order,
    });
    set((s) => ({
      documents: [...s.documents, document],
      activeDocumentId: document.id,
    }));
    return document;
  },

  updateDocument: async (id, updates) => {
    const patch: DocumentUpdatePatch = { ...updates, updatedAt: Date.now() };
    // Optimistic local update so the editor doesn't flicker. Convert
    // `null` to `undefined` to match the `Document` shape (the server
    // accepts `null` for clearing the field, but the client-side type
    // uses `undefined` to mean "no field").
    const optimistic: Partial<Document> = {};
    if (patch.title !== undefined) optimistic.title = patch.title;
    if (patch.content !== undefined) optimistic.content = patch.content;
    if (patch.sourcePath !== undefined && patch.sourcePath !== null) {
      optimistic.sourcePath = patch.sourcePath;
    }
    if (patch.isDirty !== undefined) optimistic.isDirty = patch.isDirty;
    if (patch.splitEditorOpen !== undefined) optimistic.splitEditorOpen = patch.splitEditorOpen;
    optimistic.updatedAt = patch.updatedAt;
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, ...optimistic } : d)),
    }));
    try {
      const { document } = await documentRepository.update(id, {
        title: patch.title,
        content: patch.content,
        sourcePath: patch.sourcePath === undefined ? undefined : patch.sourcePath,
        isDirty: patch.isDirty,
        splitEditorOpen: patch.splitEditorOpen,
      });
      set((s) => ({
        documents: s.documents.map((d) => (d.id === id ? { ...d, ...document } : d)),
      }));
    } catch {
      // Best-effort: refetch on failure.
      try {
        const { documents } = await documentRepository.list();
        set({ documents });
      } catch {
        /* ignore */
      }
    }
  },

  deleteDocument: async (id) => {
    const closedDoc = get().documents.find((d) => d.id === id);
    const wasEmpty = !closedDoc?.content?.includes('"text":');
    try {
      await documentRepository.remove(id);
    } catch (err) {
      console.warn('[documentStore] failed to delete document:', err);
    }
    // Cascade: server-side chat message removal isn't a service we own in
    // the documents route (chat stays even if the document is deleted), so
    // we don't try to delete chat messages here. The chat route will see an
    // empty `documentId` and behave accordingly.
    const docs = get().documents.filter((d) => d.id !== id);
    let activeId = get().activeDocumentId;
    if (activeId === id) activeId = docs[docs.length - 1]?.id ?? null;
    if (docs.length === 0 && !wasEmpty) {
      const newDoc = await get().createDocument('Untitled');
      set({ documents: [newDoc], activeDocumentId: newDoc.id });
      return;
    }
    set({ documents: docs, activeDocumentId: activeId });
  },

  setActiveDocument: (id) => {
    set({ activeDocumentId: id });
    void settingsRepository.put('lastActiveDocumentId', id).catch(() => undefined);
  },

  duplicateDocument: async (id) => {
    const source = get().documents.find((d) => d.id === id);
    if (!source) throw new Error('Document not found');
    const shell: Document = {
      ...source,
      id: nanoid(8),
      title: `${source.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: get().documents.length,
    };
    const { document } = await documentRepository.create({
      id: shell.id,
      title: shell.title,
      content: shell.content,
      sourcePath: shell.sourcePath,
      order: shell.order,
    });
    set((s) => ({
      documents: [...s.documents, document],
      activeDocumentId: document.id,
    }));
    return document;
  },

  getActiveDocument: () => {
    const { documents, activeDocumentId } = get();
    return documents.find((d) => d.id === activeDocumentId) ?? null;
  },

  setDocumentSplitEditorOpen: async (id, v) => {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, splitEditorOpen: v } : d)),
    }));
    try {
      const { document } = await documentRepository.update(id, { splitEditorOpen: v });
      set((s) => ({
        documents: s.documents.map((d) => (d.id === id ? { ...d, ...document } : d)),
      }));
    } catch {
      /* ignore */
    }
  },

  renameDocumentBySourcePath: async (oldPath, newPath, newTitle) => {
    const doc = get().documents.find((d) => d.sourcePath === oldPath);
    if (!doc) return;
    await get().updateDocument(doc.id, { sourcePath: newPath, title: newTitle });
  },

  deleteDocumentsBySourcePaths: async (paths) => {
    const pathSet = new Set(paths);
    const toDelete = get().documents.filter((d) => d.sourcePath && pathSet.has(d.sourcePath));
    for (const doc of toDelete) {
      await get().deleteDocument(doc.id);
    }
  },

  // ── File viewer (image / text via data URL) ──────────────────────────────

  openFileFromViewer: async (file) => {
    const { documents } = get();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (file.dataUrl && isTextFile(file.name)) {
      let text: string;
      try {
        const base64 = file.dataUrl.split(',')[1];
        text = atob(base64);
      } catch {
        toast('Could not decode file content.');
        return null;
      }
      let json: object;
      try {
        json = parseByExt(text, ext);
      } catch {
        toast(`Could not parse file: ${file.name}`);
        return null;
      }
      const shell: Document = {
        id: nanoid(8),
        title: file.name,
        content: JSON.stringify(json),
        sourcePath: file.path,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: documents.length,
      };
      const { document } = await documentRepository.create({
        id: shell.id,
        title: shell.title,
        content: shell.content,
        sourcePath: shell.sourcePath,
        order: shell.order,
      });
      set((s) => ({
        documents: [...s.documents, document],
        activeDocumentId: document.id,
      }));
      return document;
    }

    if (file.dataUrl && isImageFile(file.name)) {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: { src: file.dataUrl },
          },
        ],
      };
      const shell: Document = {
        id: nanoid(8),
        title: file.name,
        content: JSON.stringify(content),
        sourcePath: file.path,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: documents.length,
      };
      const { document } = await documentRepository.create({
        id: shell.id,
        title: shell.title,
        content: shell.content,
        sourcePath: shell.sourcePath,
        order: shell.order,
      });
      set((s) => ({
        documents: [...s.documents, document],
        activeDocumentId: document.id,
      }));
      return document;
    }

    toast(`Unsupported file type for editor: .${ext}`);
    return null;
  },

  // ── Tauri-only (browser: no-op) ──────────────────────────────────────────

  openFileAsDocument: async (_node) => {
    if (!detectTauri()) return null;
    // Tauri desktop re-implementation will live here. For the web build we
    // do nothing.
    return null;
  },

  openFileFromTree: async (_node, _forceNewTab = false) => {
    if (!detectTauri()) return null;
    return null;
  },

  openFileByPath: async (_path) => {
    if (!detectTauri()) return null;
    return null;
  },
}));

interface DocumentUpdatePatch {
  title?: string;
  content?: string;
  sourcePath?: string | null;
  isDirty?: boolean;
  splitEditorOpen?: boolean;
  updatedAt: number;
}
