import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import FontFamily from '@tiptap/extension-font-family';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useUIStore } from '../../stores/uiStore';
import type { Editor } from '@tiptap/react';

function sanitizePastedHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    el.style.removeProperty('color');
    el.style.removeProperty('background-color');
    el.style.removeProperty('background');
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
  doc.querySelectorAll('font[color]').forEach((el) => el.removeAttribute('color'));
  doc.querySelectorAll('mark').forEach((mark) => {
    const frag = document.createDocumentFragment();
    while (mark.firstChild) frag.appendChild(mark.firstChild);
    mark.parentNode?.replaceChild(frag, mark);
  });
  return doc.body.innerHTML;
}

interface TipTapEditorProps {
  documentId: string | null;
  initialContent: string;
  onEditorReady?: (editor: Editor) => void;
}

export function TipTapEditor({ documentId, initialContent, onEditorReady }: TipTapEditorProps) {
  const setSelectedText = useUIStore((s) => s.setSelectedText);
  const { editorFontFamily, editorFontSize } = useUIStore((s) => s);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      TextStyle,
      Color,
      FontFamily.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Typography,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: `tiptap-editor focus:outline-none${editorFontSize !== 12 ? ` font-size-${editorFontSize}` : ''}`,
        style: `font-family: ${editorFontFamily}`,
      },
      transformPastedHTML: sanitizePastedHTML,
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to } = e.state.selection;
      if (from !== to) {
        const text = e.state.doc.textBetween(from, to, ' ');
        setSelectedText({ text, from, to });
      } else {
        setSelectedText(null);
      }
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    const el = editor.options.element as HTMLElement;
    el.style.fontFamily = editorFontFamily;
    el.classList.remove('font-size-14', 'font-size-16');
    if (editorFontSize !== 12) el.classList.add(`font-size-${editorFontSize}`);
  }, [editor, editorFontFamily, editorFontSize]);

  // Load content when document changes
  useEffect(() => {
    if (!editor) return;
    try {
      const parsed = initialContent ? JSON.parse(initialContent) : null;
      if (parsed) {
        editor.commands.setContent(parsed);
      } else {
        editor.commands.clearContent();
      }
    } catch {
      editor.commands.clearContent();
    }
  }, [editor, documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useAutoSave(editor ?? null, documentId);

  return (
    <EditorContent
      editor={editor}
      className="w-full"
    />
  );
}
