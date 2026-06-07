// Save the active document to disk.
//
// Phase 3 (Tauri migration): if the document was opened from the file tree
// or previously saved via the dialog, `doc.sourcePath` is its absolute
// path and we just overwrite it. Otherwise we show a native Save As dialog
// (`pickSaveTabsPath`) and write to the chosen path.
import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useDocumentStore } from '../stores/documentStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { serialize } from '../services/fileFormat';
import { writeTextFile, pickSaveTabsPath, getExt, joinPath } from '../services/fs-adapter';

export function useSaveDocument() {
  const { activeDocumentId, documents, updateDocument } = useDocumentStore();
  const rootNode = useFileSystemStore((s) => s.rootNode);

  return useCallback(
    async (editor: Editor | null) => {
      if (!editor || !activeDocumentId) return;
      const editorJson = editor.getJSON();
      updateDocument(activeDocumentId, { content: JSON.stringify(editorJson) });
      const doc = documents.find((d) => d.id === activeDocumentId);
      if (!doc) return;
      const title = doc.title || 'Untitled';

      // CASE 1: file already has a path (opened from tree or saved before)
      if (doc.sourcePath) {
        const ext = getExt(doc.sourcePath) || 'md';
        try {
          await writeTextFile(doc.sourcePath, serialize(editorJson, ext));
          await updateDocument(activeDocumentId, { isDirty: false });
        } catch (err: unknown) {
          console.warn('[Save] disk write failed:', err);
        }
        return;
      }

      // CASE 2: new/unsaved document -> show save dialog
      const filters = [
        { name: 'Markdown File', extensions: ['md', 'markdown'] },
        { name: 'Text File', extensions: ['txt'] },
      ];
      const suggestedName = `${title}.md`;
      const defaultDir = rootNode?.fullPath;
      try {
        const newPath = await pickSaveTabsPath(
          suggestedName,
          filters,
          defaultDir ? joinPath(defaultDir, suggestedName) : suggestedName
        );
        if (!newPath) return;
        const ext = getExt(newPath) || 'md';
        await writeTextFile(newPath, serialize(editorJson, ext));
        await updateDocument(activeDocumentId, { sourcePath: newPath, isDirty: false });
      } catch (err: unknown) {
        console.warn('[Save] dialog save failed:', err);
      }
    },
    [activeDocumentId, documents, updateDocument, rootNode]
  );
}
