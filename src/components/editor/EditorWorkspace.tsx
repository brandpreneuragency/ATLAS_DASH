import { useState, useCallback, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { TipTapEditor } from './TipTapEditor';
import { FormattingToolbar } from '../toolbar/FormattingToolbar';
import { SelectionToolbar } from './SelectionToolbar';
import { useDocumentStore } from '../../stores/documentStore';
import { useSaveDocument } from '../../hooks/useSaveDocument';

interface EditorWorkspaceProps {
  onEditorReady: (editor: Editor) => void;
}

export function EditorWorkspace({ onEditorReady }: EditorWorkspaceProps) {
  const [localEditor, setLocalEditor] = useState<Editor | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const { activeDocumentId, documents } = useDocumentStore();
  const activeDoc = documents.find((d) => d.id === activeDocumentId);
  const isFileBacked = !!activeDoc?.sourcePath;
  const editable = !isFileBacked || isUnlocked;
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const saveDocument = useSaveDocument();

  // Lock file-backed docs when the active tab changes
  useEffect(() => {
    const doc = documents.find((d) => d.id === activeDocumentId);
    setIsUnlocked(!doc?.sourcePath);
  }, [activeDocumentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocument(localEditor);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && localEditor?.isFocused) {
        e.preventDefault();
        localEditor.commands.selectAll();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [localEditor, saveDocument]);

  const handleEditorReady = useCallback(
    (editor: Editor) => {
      setLocalEditor(editor);
      onEditorReady(editor);
    },
    [onEditorReady]
  );

  return (
    <div className="flex flex-col h-full pl-0">
      {/* Sticky toolbar */}
      <div className="relative z-20 flex-shrink-0 flex items-center gap-[6px] mt-0 mb-0 mx-[10px]">
        <div className="flex-1 h-[30px] rounded-[10px] bg-transparent">
          <FormattingToolbar
            editor={localEditor}
            isFileBacked={isFileBacked}
            isLocked={!isUnlocked}
            onToggleLock={() => setIsUnlocked((v) => !v)}
          />
        </div>
      </div>

      {/* Editor content - scrollable */}
      <div ref={editorScrollRef} className="flex-1 w-full overflow-y-auto bg-transparent">
        <div className="max-w-3xl w-full mx-auto px-5 py-2.5">
          <TipTapEditor
            documentId={activeDocumentId}
            initialContent={activeDoc?.content ?? ''}
            onEditorReady={handleEditorReady}
            editable={editable}
          />
        </div>
      </div>

      <SelectionToolbar editor={localEditor} editorScrollRef={editorScrollRef} />
    </div>
  );
}
