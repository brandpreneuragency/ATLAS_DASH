import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Link,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { LinkInsert } from '../toolbar/LinkInsert';
import { ImageInsert } from '../toolbar/ImageInsert';

interface SelectionToolbarProps {
  editor: Editor | null;
  editorScrollRef: RefObject<HTMLDivElement | null>;
}

interface Pos { x: number; y: number }

const POPUP_W = 172; // 5 × 28px buttons + gaps + padding

function ToolBtn({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors text-sm flex-shrink-0 ${
        active ? 'toolbar-btn-active' : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

// Text label button for h1/h2/h3/p
function StyleBtn({
  onClick, active, label, title,
}: {
  onClick: () => void; active?: boolean; label: string; title?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors flex-shrink-0 font-mono text-[11px] font-medium ${
        active ? 'toolbar-btn-active' : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}

function RowDivider() {
  return <div className="h-px bg-border/60 mx-1.5" />;
}

export function SelectionToolbar({ editor, editorScrollRef }: SelectionToolbarProps) {
  const { selectedText } = useUIStore();
  const [pos, setPos] = useState<Pos | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  const [showLinkInsert, setShowLinkInsert] = useState(false);
  const [showImageInsert, setShowImageInsert] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = selectedText !== null && pos !== null;

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!editorScrollRef.current?.contains(e.target as Node)) return;
    setPos({ x: e.clientX, y: e.clientY });
  }, [editorScrollRef]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  useEffect(() => {
    if (!visible) {
      setLinkOpen(false);
      setShowLinkInsert(false);
      setShowImageInsert(false);
      setPos(null);
    }
  }, [visible]);

  useEffect(() => {
    if (linkOpen) {
      setHref(editor?.getAttributes('link').href ?? '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [linkOpen, editor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLinkOpen(false);
        setShowLinkInsert(false);
        setShowImageInsert(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const insertLink = () => {
    const url = href.trim();
    if (!url || !editor) return;
    editor.chain().focus().setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor?.chain().focus().unsetLink().run();
    setLinkOpen(false);
  };

  if (!visible) return null;

  const rawLeft = pos.x - POPUP_W / 2;
  const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - POPUP_W - 8));

  const currentAlign = (
    editor?.getAttributes('paragraph').textAlign ||
    editor?.getAttributes('heading').textAlign ||
    'left'
  ) as string;

  return (
    <div
      style={{ position: 'fixed', top: pos.y + 20, left: clampedLeft, zIndex: 200 }}
      className="bg-white border border-border rounded-lg shadow-lg flex flex-col"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Row 1: Link · Bold · Italic · Underline · Bullet list */}
      <div className="flex items-center gap-0.5 px-1.5 py-1">
        <ToolBtn onClick={() => { setLinkOpen((v) => !v); setShowLinkInsert(false); }} active={editor?.isActive('link') || linkOpen} title="Link">
          <Link size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
          <Italic size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline">
          <Underline size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
          <List size={13} />
        </ToolBtn>
      </div>

      {/* Inline URL row (Row 1 → Link) */}
      {linkOpen && (
        <div className="px-2 pb-2 flex gap-1.5 border-t border-border/50 pt-1.5">
          <input
            ref={inputRef}
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') insertLink(); }}
            placeholder="https://..."
            className="flex-1 text-xs border border-border rounded px-2 py-1 outline-none focus:border-brand min-w-0"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertLink}
            disabled={!href.trim()}
            className="text-xs px-2 py-1 bg-brand text-white rounded disabled:opacity-40 hover:bg-brand-dark transition-colors flex-shrink-0"
          >
            {editor?.isActive('link') ? 'Update' : 'Insert'}
          </button>
          {editor?.isActive('link') && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={removeLink}
              className="text-xs px-2 py-1 border border-border rounded hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              Remove
            </button>
          )}
        </div>
      )}

      <RowDivider />

      {/* Row 2: h1 · h2 · h3 · p · Number list */}
      <div className="flex items-center gap-0.5 px-1.5 py-1">
        <StyleBtn label="h1" title="Heading 1" active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().setHeading({ level: 1 }).run()} />
        <StyleBtn label="h2" title="Heading 2" active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().setHeading({ level: 2 }).run()} />
        <StyleBtn label="h3" title="Heading 3" active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().setHeading({ level: 3 }).run()} />
        <StyleBtn label="p"  title="Paragraph" active={editor?.isActive('paragraph')}             onClick={() => editor?.chain().focus().setParagraph().run()} />
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Number list">
          <ListOrdered size={13} />
        </ToolBtn>
      </div>

      <RowDivider />

      {/* Row 3: Align Left · Align Center · Align Right · Insert Link · Insert Image */}
      <div className="flex items-center gap-0.5 px-1.5 py-1">
        <ToolBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()}    active={currentAlign === 'left'}   title="Align left">
          <AlignLeft size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()}  active={currentAlign === 'center'} title="Align center">
          <AlignCenter size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().setTextAlign('right').run()}   active={currentAlign === 'right'}  title="Align right">
          <AlignRight size={13} />
        </ToolBtn>

        {/* Insert Link (full popup) */}
        <div className="relative">
          <ToolBtn
            onClick={() => { setShowLinkInsert((v) => !v); setShowImageInsert(false); setLinkOpen(false); }}
            active={editor?.isActive('link') || showLinkInsert}
            title="Insert link"
          >
            <Link size={13} />
          </ToolBtn>
          {showLinkInsert && (
            <LinkInsert editor={editor} onClose={() => setShowLinkInsert(false)} />
          )}
        </div>

        {/* Insert Image (full popup) */}
        <div className="relative">
          <ToolBtn
            onClick={() => { setShowImageInsert((v) => !v); setShowLinkInsert(false); }}
            active={showImageInsert}
            title="Insert image"
          >
            {/* camera/image icon inline to avoid lucide Image name collision */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </ToolBtn>
          {showImageInsert && (
            <ImageInsert editor={editor} onClose={() => setShowImageInsert(false)} />
          )}
        </div>
      </div>
    </div>
  );
}
