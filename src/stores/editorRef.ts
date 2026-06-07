import type { Editor } from '@tiptap/react';

/** Mutable reference to the active TipTap editor instance. */
export const editorRef: { current: Editor | null } = { current: null };
