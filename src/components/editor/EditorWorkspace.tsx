import { useState, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { TipTapEditor } from './TipTapEditor';
import { FormattingToolbar } from '../toolbar/FormattingToolbar';
import { SelectionToolbar } from './SelectionToolbar';
import { useDocumentStore } from '../../stores/documentStore';

interface EditorWorkspaceProps {
  onEditorReady: (editor: Editor) => void;
}

export function EditorWorkspace({ onEditorReady }: EditorWorkspaceProps) {
  const [localEditor, setLocalEditor] = useState<Editor | null>(null);
  const { activeDocumentId, documents } = useDocumentStore();
  const activeDoc = documents.find((d) => d.id === activeDocumentId);
  const editorScrollRef = useRef<HTMLDivElement>(null);

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
          <FormattingToolbar editor={localEditor} />
        </div>
      </div>

      {/* Editor content - scrollable */}
      <div ref={editorScrollRef} className="flex-1 w-full overflow-y-auto bg-transparent">
        <div className="max-w-3xl w-full mx-auto px-5 py-2.5">
          <TipTapEditor
            documentId={activeDocumentId}
            initialContent={activeDoc?.content ?? ''}
            onEditorReady={handleEditorReady}
          />
        </div>
      </div>

      <SelectionToolbar editor={localEditor} editorScrollRef={editorScrollRef} />
    </div>
  );
}
