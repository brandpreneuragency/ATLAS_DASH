import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FilePlus2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { TipTapEditor } from './TipTapEditor';
import { SelectionToolbar } from './SelectionToolbar';
import { EditorTopBar } from './EditorTopBar';
import { useDocumentStore } from '../../stores/documentStore';
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
  const { t } = useTranslation();
  const { activeDocumentId, documents, updateDocument, createDocument } = useDocumentStore();
  const { htmlViewOpen } = useUIStore();
  const activeDoc = documents.find((d) => d.id === activeDocumentId);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const saveDocument = useSaveDocument();
  const hasNoDocuments = documents.length === 0;

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
    <div id="editor-column" className="panel col h-full" style={{ background: 'var(--center-bg)' }}>
      <EditorTopBar editor={localEditor} onSave={saveDocument} />
      {/* Empty state when all tabs are closed (e.g. X on the only empty tab) */}
      {hasNoDocuments ? (
        <div className="panel-body empty-state flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3" style={{ color: 'var(--c-text-2)' }}>
            <FilePlus2 size={40} strokeWidth={1.25} />
            <p className="txt-sm">{t('tabs.noDocumentsOpen') ?? 'No document open'}</p>
            <button
              type="button"
              className="tbar-btn"
              onClick={() => createDocument()}
              title={t('tabs.newTab')}
            >
              {t('tabs.newDocument') ?? 'New document'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Editor area */}
          <div
            id="scroll-main"
            ref={editorScrollRef}
            className="panel-body ai-scroll flex-1 overflow-y-a"
            style={{
              padding: '0 60px',
            }}
          >
            <div style={{ margin: '0 auto', padding: 0 }}>
              <div style={{ display: htmlViewOpen ? 'none' : 'block' }}>
                <TipTapEditor
                  documentId={activeDocumentId}
                  initialContent={activeDoc?.content ?? ''}
                  onEditorReady={handleEditorReady}
                  title={activeDoc?.title}
                  onTitleChange={(t) => {
                    if (activeDocumentId) updateDocument(activeDocumentId, { title: t });
                  }}
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
        </>
      )}
    </div>
  );
}
