import type { Editor } from '@tiptap/react';
import { Search, Undo2, Redo2, Lock, LockOpen, Save } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useSaveDocument } from '../../hooks/useSaveDocument';
import { FindReplace } from './FindReplace';

interface ToolbarProps {
  editor: Editor | null;
  isFileBacked: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
}

function ToolBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void; active?: boolean; title?: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        flex items-center justify-center w-7 h-7 rounded-md transition-colors text-sm flex-shrink-0
        ${active ? 'toolbar-btn-active' : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}

export function FormattingToolbar({ editor, isFileBacked, isLocked, onToggleLock }: ToolbarProps) {
  const { setFindReplaceOpen, findReplaceOpen } = useUIStore();
  const saveDocument = useSaveDocument();

  return (
    <>
      <div className="flex h-[30px] items-center justify-between w-full px-0">
        {/* Left: Lock + Save */}
        <div className="flex items-center gap-0.5">
          {isFileBacked && (
            <button
              type="button"
              onClick={onToggleLock}
              title={isLocked ? 'Unlock to edit' : 'Lock file'}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors text-sm flex-shrink-0 hover:bg-gray-100"
            >
              {isLocked
                ? <Lock size={14} className="text-purple-500" />
                : <LockOpen size={14} className="text-text-secondary" />
              }
            </button>
          )}
          <ToolBtn
            onClick={() => saveDocument(editor)}
            title="Save to disk"
            disabled={isFileBacked && isLocked}
          >
            <Save size={14} />
          </ToolBtn>
        </div>

        {/* Right: Find, Undo, Redo */}
        <div className="flex items-center gap-0.5">
          <ToolBtn onClick={() => setFindReplaceOpen(!findReplaceOpen)} title="Find & Replace" active={findReplaceOpen}>
            <Search size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo" disabled={!editor?.can().undo()}>
            <Undo2 size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo" disabled={!editor?.can().redo()}>
            <Redo2 size={14} />
          </ToolBtn>
        </div>
      </div>

      <FindReplace editor={editor} />
    </>
  );
}
