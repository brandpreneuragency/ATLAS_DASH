import { useEffect, useRef } from 'react';
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

export function useAutoSave(editor: Editor | null, documentId: string | null) {
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const documents = useDocumentStore((s) => s.documents);
  const rootNode = useFileSystemStore((s) => s.rootNode);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextSaveRef = useRef(false);

  // Suppress the first save after content is loaded into the editor
  useEffect(() => {
    suppressNextSaveRef.current = true;
  }, [documentId]);

  useEffect(() => {
    if (!editor || !documentId) return;

    const handleUpdate = () => {
      if (suppressNextSaveRef.current) {
        suppressNextSaveRef.current = false;
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const editorJson = editor.getJSON();
        const json = JSON.stringify(editorJson);
        const text = editor.getText();
        const firstLine = text.split('\n')[0]?.trim() ?? '';
        const title = firstLine.slice(0, 80) || 'Untitled';
        updateDocument(documentId, { content: json, title });

        const doc = documents.find((d) => d.id === documentId);
        if (!doc?.sourcePath || !rootNode) return;

        const fileNode = findNodeByPath(rootNode, doc.sourcePath);
        if (!fileNode || fileNode.kind !== 'file') return;

        const ext = fileNode.name.split('.').pop()?.toLowerCase() ?? '';
        try {
          const handle = fileNode.handle as FileSystemFileHandle;
          const writable = await handle.createWritable();
          await writable.write(serialize(editorJson, ext));
          await writable.close();
        } catch (err: any) {
          if (err?.name === 'NotAllowedError') {
            try {
              await (fileNode.handle as any).requestPermission({ mode: 'readwrite' });
              const handle = fileNode.handle as FileSystemFileHandle;
              const writable = await handle.createWritable();
              await writable.write(serialize(editorJson, ext));
              await writable.close();
            } catch {
              console.warn('[AutoSave] disk write failed after permission retry');
            }
          } else {
            console.warn('[AutoSave] disk write failed:', err);
          }
        }
      }, 300);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, documentId, updateDocument, documents, rootNode]);
}
