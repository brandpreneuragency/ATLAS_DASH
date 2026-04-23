import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Document } from '../types';
import { db } from '../services/db';
import { SUPPORTED_EXTENSIONS, parseByExt } from '../services/fileFormat';
import type { TreeNode } from './fileSystemStore';

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
  openFileAsDocument: (node: TreeNode) => Promise<Document | null>;
  renameDocumentBySourcePath: (oldPath: string, newPath: string, newTitle: string) => Promise<void>;
  deleteDocumentsBySourcePaths: (paths: string[]) => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  isLoaded: false,

  loadDocuments: async () => {
    const docs = await db.documents.orderBy('order').toArray();
    if (docs.length === 0) {
      const first = await get().createDocument('Untitled');
      set({ documents: [first], activeDocumentId: first.id, isLoaded: true });
    } else {
      const lastActiveId = await db.settings.get('lastActiveDocumentId');
      const activeId = lastActiveId?.value as string | undefined;
      const validId = docs.find((d) => d.id === activeId) ? activeId : docs[0].id;
      set({ documents: docs, activeDocumentId: validId ?? docs[0].id, isLoaded: true });
    }
  },

  createDocument: async (title = 'Untitled') => {
    const docs = get().documents;
    const doc: Document = {
      id: nanoid(8),
      title,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: docs.length,
    };
    await db.documents.put(doc);
    set((s) => ({ documents: [...s.documents, doc], activeDocumentId: doc.id }));
    return doc;
  },

  updateDocument: async (id, updates) => {
    const patch = { ...updates, updatedAt: Date.now() };
    await db.documents.update(id, patch);
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  },

  deleteDocument: async (id) => {
    await db.documents.delete(id);
    await db.chatMessages.where('documentId').equals(id).delete();
    const docs = get().documents.filter((d) => d.id !== id);
    let activeId = get().activeDocumentId;
    if (activeId === id) {
      activeId = docs[docs.length - 1]?.id ?? null;
    }
    if (docs.length === 0) {
      const newDoc = await get().createDocument('Untitled');
      set({ documents: [newDoc], activeDocumentId: newDoc.id });
      return;
    }
    set({ documents: docs, activeDocumentId: activeId });
  },

  setActiveDocument: (id) => {
    set({ activeDocumentId: id });
    db.settings.put({ key: 'lastActiveDocumentId', value: id });
  },

  duplicateDocument: async (id) => {
    const source = get().documents.find((d) => d.id === id);
    if (!source) throw new Error('Document not found');
    const docs = get().documents;
    const copy: Document = {
      ...source,
      id: nanoid(8),
      title: `${source.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: docs.length,
    };
    await db.documents.put(copy);
    set((s) => ({ documents: [...s.documents, copy], activeDocumentId: copy.id }));
    return copy;
  },

  getActiveDocument: () => {
    const { documents, activeDocumentId } = get();
    return documents.find((d) => d.id === activeDocumentId) ?? null;
  },

  renameDocumentBySourcePath: async (oldPath: string, newPath: string, newTitle: string) => {
    const doc = get().documents.find((d) => d.sourcePath === oldPath);
    if (!doc) return;
    await get().updateDocument(doc.id, { sourcePath: newPath, title: newTitle });
  },

  deleteDocumentsBySourcePaths: async (paths: string[]) => {
    const pathSet = new Set(paths);
    const toDelete = get().documents.filter((d) => d.sourcePath && pathSet.has(d.sourcePath));
    for (const doc of toDelete) {
      await get().deleteDocument(doc.id);
    }
  },

  openFileAsDocument: async (node: TreeNode) => {
    const { documents, setActiveDocument, createDocument, updateDocument } = get();
    const existing = documents.find((d) => d.sourcePath === node.path);
    if (existing) {
      setActiveDocument(existing.id);
      return existing;
    }
    const ext = node.name.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      alert(`Unsupported file type: .${ext}`);
      return null;
    }
    const file = await (node.handle as FileSystemFileHandle).getFile();
    const text = await file.text();
    let json: object;
    try {
      json = parseByExt(text, ext);
    } catch {
      alert(`Could not parse file: ${node.name}`);
      return null;
    }
    const doc = await createDocument(node.name);
    await updateDocument(doc.id, { content: JSON.stringify(json), sourcePath: node.path });
    return get().documents.find((d) => d.id === doc.id) ?? doc;
  },
}));

