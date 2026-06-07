import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useDocumentStore } from '../stores/documentStore';

export function useAutoSave(editor: Editor | null, documentId: string | null) {
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const documents = useDocumentStore((s) => s.documents);
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
      timerRef.current = setTimeout(() => {
        const editorJson = editor.getJSON();
        const json = JSON.stringify(editorJson);
        const doc = documents.find((d) => d.id === documentId);
        const updates: Parameters<typeof updateDocument>[1] = { content: json };
        if (doc?.sourcePath) updates.isDirty = true;
        updateDocument(documentId, updates);
      }, 300);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, documentId, updateDocument, documents]);
}
