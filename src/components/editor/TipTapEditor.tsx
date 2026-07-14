import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Extension } from '@tiptap/core';
import { UndoRedo } from '@tiptap/extensions/undo-redo';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { InlineTextPreset } from './InlineTextPreset';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useUIStore } from '../../stores/uiStore';
import { getEditorStateCache } from '../../stores/workspaceStore';
import type { Editor } from '@tiptap/react';

// Cache full ProseMirror editor states per file path so undo/redo history,
// selection, and scroll position survive file swaps in the same session.
// The cache is owned by workspaceStore so it can clear entries on save/discard.

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
  fileId: string | null;
  workspaceId: string | null;
  initialContent: string;
  onEditorReady?: (editor: Editor) => void;
  editable?: boolean;
  title?: string;
  onTitleChange?: (title: string) => void;
}

export function TipTapEditor({
  fileId,
  workspaceId,
  initialContent,
  onEditorReady,
  editable = true,
  title,
  onTitleChange,
}: TipTapEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previousFileIdRef = useRef<string | null>(null);
  const editorStateCache = getEditorStateCache();
  const setSelectedText = useUIStore((s) => s.setSelectedText);
  const editorFontFamily = useUIStore((s) => s.editorFontFamily);
  const editorFontSize = useUIStore((s) => s.editorFontSize);

  const extensions = useMemo(
    () => [
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
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Typography,
      EditorShortcuts,
    ],
    []
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: 'tiptap-editor',
      },
      transformCopied: (slice: Slice, view: EditorView) => normalizeCopiedParagraphs(slice, view),
      transformPastedHTML: sanitizePastedHTML,
    }),
    []
  );

  const coreExtensionOptions = useMemo(
    () => ({
      clipboardTextSerializer: {
        blockSeparator: '\n',
      },
    }),
    []
  );

  const handleSelectionUpdate = useCallback(
    ({ editor: e }: { editor: Editor }) => {
      const { from, to } = e.state.selection;
      if (from !== to) {
        const text = e.state.doc.textBetween(from, to, ' ');
        const current = useUIStore.getState().selectedText;
        if (current?.text === text && current.from === from && current.to === to) return;
        setSelectedText({ text, from, to });
      } else {
        if (useUIStore.getState().selectedText === null) return;
        setSelectedText(null);
      }
    },
    [setSelectedText]
  );

  const editor = useEditor({
    coreExtensionOptions,
    extensions,
    content: '',
    editorProps,
    onSelectionUpdate: handleSelectionUpdate,
    shouldRerenderOnTransaction: false,
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
    const el = editor.view.dom as HTMLElement;
    el.style.fontFamily = editorFontFamily; // eslint-disable-line react-hooks/immutability
    el.classList.remove('font-size-14', 'font-size-16');
    if (editorFontSize !== 12) el.classList.add(`font-size-${editorFontSize}`);
    // Sync font-size class to the wrapper so the title input inherits the correct sizing
    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.classList.remove('font-size-14', 'font-size-16');
      if (editorFontSize !== 12) wrapper.classList.add(`font-size-${editorFontSize}`);
    }
  }, [editor, editorFontFamily, editorFontSize]);

  // Load content when file changes, preserving full editor state (including
  // undo/redo history) per file path for the lifetime of the session.
  // Only reuse a cached EditorState when it belongs to THIS editor instance
  // (same plugin object identity). States cached from a destroyed instance
  // (e.g. after remount) must not be passed to updateState — that leaves the
  // new view unable to render subsequent setContent calls.
  useEffect(() => {
    if (!editor) return;
    try {
      const prevId = previousFileIdRef.current;
      if (prevId && prevId !== fileId) {
        editorStateCache.set(prevId, editor.state);
      }

      const cached = fileId ? editorStateCache.get(fileId) : undefined;
      if (cached) {
        const livePlugins = editor.state.plugins;
        const samePlugins =
          cached.plugins.length === livePlugins.length &&
          cached.plugins.every((plugin, i) => plugin === livePlugins[i]);
        if (samePlugins) {
          editor.view.updateState(cached);
        } else {
          editor.commands.setContent(cached.doc.toJSON(), { emitUpdate: false });
          editorStateCache.delete(fileId!);
        }
      } else {
        const parsed = initialContent ? JSON.parse(initialContent) : null;
        // TipTap v3 emits updates from setContent/clearContent by default.
        // Suppress them on load so useAutoSave does not mark a clean file dirty.
        if (parsed) {
          editor.commands.setContent(parsed, { emitUpdate: false });
        } else {
          editor.commands.clearContent(false);
        }
      }
      previousFileIdRef.current = fileId;
    } catch {
      editor.commands.clearContent(false);
    }
  }, [editor, fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the current file's editor state when the editor unmounts (e.g.
  // switching to Settings/CRM/Task mode) so undo/redo survives those trips too.
  useEffect(() => {
    return () => {
      const currentId = previousFileIdRef.current;
      if (currentId && editor) {
        editorStateCache.set(currentId, editor.state);
      }
    };
  }, [editor]);

  useAutoSave(editor ?? null, workspaceId);

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
