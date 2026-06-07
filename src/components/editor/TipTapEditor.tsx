import { useEffect, useRef } from 'react';
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
import { Extension } from '@tiptap/core';
import { UndoRedo } from '@tiptap/extensions/undo-redo';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { InlineTextPreset } from './InlineTextPreset';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useUIStore } from '../../stores/uiStore';
import type { Editor } from '@tiptap/react';

// History extension with NO built-in keyboard shortcuts.
// We handle undo/redo ourselves via EditorShortcuts below so we can
// check that the editor DOM is actually the active element before acting.
const CustomHistory = UndoRedo.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

// Extension that handles Ctrl+A, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z
// – but only when the editor DOM is actually the focused element.
const EditorShortcuts = Extension.create({
  name: 'editorShortcuts',
  priority: 150,

  addKeyboardShortcuts() {
    return {
      'Mod-a': () => this.editor.commands.selectAll(),
      'Mod-z': () => {
        const editorDom = this.editor.view?.dom;
        const isActive = editorDom && (document.activeElement === editorDom || editorDom.contains(document.activeElement));
        if (!isActive) return false;
        return this.editor.commands.undo();
      },
      'Mod-Shift-z': () => {
        const editorDom = this.editor.view?.dom;
        const isActive = editorDom && (document.activeElement === editorDom || editorDom.contains(document.activeElement));
        if (!isActive) return false;
        return this.editor.commands.redo();
      },
      'Mod-y': () => {
        const editorDom = this.editor.view?.dom;
        const isActive = editorDom && (document.activeElement === editorDom || editorDom.contains(document.activeElement));
        if (!isActive) return false;
        return this.editor.commands.redo();
      },
    };
  },
});

const SmartEnter = Extension.create({
  name: 'smartEnter',
  priority: 200,

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty) return false;

        // Only apply in normal paragraphs, let other nodes (headings, lists, code) use default behavior
        if ($from.parent.type.name !== 'paragraph') return false;

        // At the end of the paragraph and the last node is a hardBreak -> double Enter -> split paragraph
        if ($from.parentOffset === $from.parent.content.size) {
          const lastChild = $from.parent.lastChild;
          if (lastChild && lastChild.type.name === 'hardBreak') {
            const posBeforeBreak = $from.pos - lastChild.nodeSize;
            return editor
              .chain()
              .focus()
              .deleteRange({ from: posBeforeBreak, to: $from.pos })
              .splitBlock()
              .run();
          }
        }

        // Single Enter -> insert hard break (line break inside the paragraph)
        return editor.chain().focus().setHardBreak().run();
      },
    };
  },
});

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

function normalizeCopiedParagraphs(slice: Slice, view: EditorView): Slice {
  const paragraph = view.state.schema.nodes.paragraph;
  const hardBreak = view.state.schema.nodes.hardBreak;

  if (!paragraph || !hardBreak || slice.content.childCount <= 1) {
    return slice;
  }

  const topLevelNodes = Array.from({ length: slice.content.childCount }, (_, index) => slice.content.child(index));

  if (topLevelNodes.some((node) => node.type !== paragraph)) {
    return slice;
  }

  let mergedContent = Fragment.empty;

  topLevelNodes.forEach((node, index) => {
    if (index > 0) {
      mergedContent = mergedContent.append(Fragment.from(hardBreak.create()));
    }

    if (node.content.size > 0) {
      mergedContent = mergedContent.append(node.content);
    }
  });

  return new Slice(Fragment.from(paragraph.create(null, mergedContent)), slice.openStart, slice.openEnd);
}

interface TipTapEditorProps {
  documentId: string | null;
  initialContent: string;
  onEditorReady?: (editor: Editor) => void;
  editable?: boolean;
  title?: string;
  onTitleChange?: (title: string) => void;
}

export function TipTapEditor({ documentId, initialContent, onEditorReady, editable = true, title, onTitleChange }: TipTapEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const setSelectedText = useUIStore((s) => s.setSelectedText);
  const { editorFontFamily, editorFontSize } = useUIStore((s) => s);

  const editor = useEditor({
    coreExtensionOptions: {
      clipboardTextSerializer: {
        blockSeparator: '\n',
      },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
        undoRedo: false,
      }),
      CustomHistory,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      TextStyle,
      InlineTextPreset,
      Color,
      FontFamily.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Typography,
      SmartEnter,
      EditorShortcuts,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: `tiptap-editor${editorFontSize !== 12 ? ` font-size-${editorFontSize}` : ''}`,
        style: `font-family: ${editorFontFamily}`,
      },
      transformCopied: (slice, view) => normalizeCopiedParagraphs(slice, view),
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
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const el = editor.options.element as HTMLElement;
    el.style.fontFamily = editorFontFamily;
    el.classList.remove('font-size-14', 'font-size-16');
    if (editorFontSize !== 12) el.classList.add(`font-size-${editorFontSize}`);
    // Sync font-size class to the wrapper so the title input inherits the correct sizing
    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.classList.remove('font-size-14', 'font-size-16');
      if (editorFontSize !== 12) wrapper.classList.add(`font-size-${editorFontSize}`);
    }
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

  const showTitleInput = false; // toggle to true to re-enable the h1 title field

  return (
    <div ref={wrapperRef} className="w-full">
      {showTitleInput && (
        <input
          type="text"
          className="doc-title-field"
          value={title ?? ''}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder="Untitled"
        />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
