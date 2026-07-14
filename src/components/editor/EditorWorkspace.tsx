import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import { TipTapEditor } from './TipTapEditor';
import { BlockInsertMenu } from './BlockInsertMenu';
import { SelectionToolbar } from './SelectionToolbar';
import { EditorTopBar } from './EditorTopBar';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useSaveDocument } from '../../hooks/useSaveDocument';
import { useUIStore } from '../../stores/uiStore';
import { editorRef } from '../../stores/editorRef';

function prettyHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let out = '';
  const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);
  function walk(node: Node, depth: number) {
    const indent = '  '.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text.trim()) return;
      out += indent + text + '\n';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const attrs = Array.from(el.attributes)
        .map((a) => ` ${a.name}="${a.value}"`)
        .join('');
      if (voidTags.has(tag)) {
        out += indent + `<${tag}${attrs} />\n`;
      } else {
        out += indent + `<${tag}${attrs}>\n`;
        el.childNodes.forEach((child) => walk(child, depth + 1));
        out += indent + `</${tag}>\n`;
      }
    }
  }
  doc.body.childNodes.forEach((child) => walk(child, 0));
  return out.trimEnd();
}

interface EditorWorkspaceProps {
  onEditorReady: (editor: Editor) => void;
}

export function EditorWorkspace({ onEditorReady }: EditorWorkspaceProps) {
  const [localEditor, setLocalEditor] = useState<Editor | null>(null);
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const htmlViewOpen = useUIStore((s) => s.htmlViewOpen);
  const rainbowMode = useUIStore((s) => s.rainbowMode);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const currentFile = activeWs?.currentFile ?? null;
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const saveDocument = useSaveDocument();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocument(localEditor);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [localEditor, saveDocument]);

  // Clear editorRef on unmount so TabBar doesn't call methods on a destroyed editor
  useEffect(() => {
    return () => {
      editorRef.current = null;
    };
  }, []);

  const handleEditorReady = useCallback(
    (editor: Editor) => {
      setLocalEditor(editor);
      editorRef.current = editor;
      onEditorReady(editor);
    },
    [onEditorReady]
  );

  const htmlSource = useMemo(() => {
    if (!localEditor) return '';
    return prettyHTML(localEditor.getHTML());
  }, [localEditor, htmlViewOpen]);

  return (
    <div
      id="editor-column"
      className={`panel col h-full${rainbowMode ? ' rainbow-mode' : ''}`}
      style={{ background: 'var(--center-bg)' }}
    >
      <EditorTopBar editor={localEditor} onSave={saveDocument} />

      <div
        id="scroll-main"
        ref={editorScrollRef}
        className="panel-body ai-scroll flex-1 overflow-y-a editor-pane"
        style={{ padding: '6px 60px' }}
        onClick={(e) => {
          if (!localEditor) return;
          const editorDom = localEditor.view.dom;
          if (editorDom.contains(e.target as Node)) return;

          // Left/right gutter clicks and selection drags that end outside
          // the editor must not jump the caret to the document end (that
          // scrolls #scroll-main to the bottom). Only empty space below
          // the content should focus the end.
          const { from, to } = localEditor.state.selection;
          if (from !== to) return;

          const rect = editorDom.getBoundingClientRect();
          if (e.clientY <= rect.bottom) return;

          e.preventDefault();
          localEditor.commands.focus('end');
        }}
      >
        <div style={{ margin: 0, padding: 0, width: '100%' }}>
          <div style={{ display: htmlViewOpen ? 'none' : 'block', width: '100%' }}>
            <TipTapEditor
              fileId={currentFile?.path ?? null}
              workspaceId={activeWorkspaceId}
              initialContent={currentFile?.content ?? ''}
              onEditorReady={handleEditorReady}
              title={currentFile?.name}
              onTitleChange={() => { /* file names are managed by the tree */ }}
            />
          </div>
          {htmlViewOpen && (
            <textarea
              className="html-source-view"
              value={htmlSource}
              onChange={(e) => {
                if (!localEditor) return;
                localEditor.commands.setContent(e.target.value);
              }}
              placeholder="HTML source"
              spellCheck={false}
            />
          )}
        </div>
      </div>

      <SelectionToolbar editor={localEditor} editorScrollRef={editorScrollRef} />
      <BlockInsertMenu editor={localEditor} editorScrollRef={editorScrollRef} />
    </div>
  );
}
