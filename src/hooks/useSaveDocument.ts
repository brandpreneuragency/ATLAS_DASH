import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useDocumentStore } from '../stores/documentStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import type { TreeNode } from '../stores/fileSystemStore';
import { serialize } from '../services/fileFormat';

function findNodeByPath(node: TreeNode, path: string): TreeNode | null {
  if (node.path === path) return node;
  for (const child of node.children ?? []) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  return null;
}

export function useSaveDocument() {
  const { activeDocumentId, documents, updateDocument } = useDocumentStore();
  const rootNode = useFileSystemStore((s) => s.rootNode);

  return useCallback(async (editor: Editor | null) => {
    if (!editor || !activeDocumentId) return;
    const editorJson = editor.getJSON();
    const json = JSON.stringify(editorJson);
    const text = editor.getText();
    const firstLine = text.split('\n')[0]?.trim() ?? '';
    const title = firstLine.slice(0, 80) || 'Untitled';
    updateDocument(activeDocumentId, { content: json, title });

    const doc = documents.find((d) => d.id === activeDocumentId);
    if (!doc?.sourcePath || !rootNode) return;

    const fileNode = findNodeByPath(rootNode, doc.sourcePath);
    if (!fileNode || fileNode.kind !== 'file') return;

    const parts = fileNode.name.split('.');
    const ext = (parts.length > 1 ? parts.pop() : parts[0])?.toLowerCase() ?? '';

    const writeToDisk = async () => {
      const handle = fileNode.handle as FileSystemFileHandle;
      const writable = await handle.createWritable();
      await writable.write(serialize(editorJson, ext));
      await writable.close();
      updateDocument(activeDocumentId, { isDirty: false });
    };

    try {
      await writeToDisk();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        try {
          await (fileNode.handle as any).requestPermission({ mode: 'readwrite' });
          await writeToDisk();
        } catch {
          console.warn('[Save] disk write failed after permission retry');
        }
      } else {
        console.warn('[Save] disk write failed:', err);
      }
    }
  }, [activeDocumentId, documents, updateDocument, rootNode]);
}
