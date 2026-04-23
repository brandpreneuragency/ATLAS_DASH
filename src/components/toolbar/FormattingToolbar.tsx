import type { Editor } from '@tiptap/react';
import { Search, Undo2, Redo2, Save } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import type { TreeNode } from '../../stores/fileSystemStore';
import { serialize } from '../../services/fileFormat';
import { FindReplace } from './FindReplace';

interface ToolbarProps {
  editor: Editor | null;
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

function findNodeByPath(node: TreeNode, path: string): TreeNode | null {
  if (node.path === path) return node;
  for (const child of node.children ?? []) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  return null;
}

export function FormattingToolbar({ editor }: ToolbarProps) {
  const { setFindReplaceOpen, findReplaceOpen } = useUIStore();
  const { activeDocumentId, documents, updateDocument } = useDocumentStore();
  const rootNode = useFileSystemStore((s) => s.rootNode);

  const handleSave = async () => {
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
          console.warn('[Save] disk write failed after permission retry');
        }
      } else {
        console.warn('[Save] disk write failed:', err);
      }
    }
  };

  return (
    <>
      <div className="flex h-[30px] items-center justify-end gap-0.5 rounded-[10px] bg-transparent px-0 py-0">
        <ToolBtn onClick={handleSave} title="Save">
          <Save size={14} />
        </ToolBtn>
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

      <FindReplace editor={editor} />
    </>
  );
}
