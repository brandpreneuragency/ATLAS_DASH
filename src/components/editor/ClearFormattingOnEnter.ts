import { Extension, type Editor } from '@tiptap/core';

function shouldDeferEnter(editor: Editor): boolean {
  return (
    editor.isActive('bulletList') ||
    editor.isActive('orderedList') ||
    editor.isActive('taskList') ||
    editor.isActive('codeBlock') ||
    editor.isActive('table')
  );
}

/**
 * On normal Enter outside lists/code/tables, create the next block without
 * carrying marks (bold, color, inline h1–h3 presets, etc.).
 * Shift+Enter and list Enter behavior are left to TipTap defaults.
 */
export const ClearFormattingOnEnter = Extension.create({
  name: 'clearFormattingOnEnter',
  // Above default keymap (100); below is fine as long as we defer lists (101+).
  priority: 120,

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;

        if (shouldDeferEnter(editor)) {
          return false;
        }

        const didEnter = editor.commands.first(({ commands }) => [
          () => commands.newlineInCode(),
          () => commands.createParagraphNear(),
          () => commands.liftEmptyBlock(),
          () => commands.splitBlock({ keepMarks: false }),
        ]);

        if (!didEnter) {
          return false;
        }

        // unsetAllMarks() no-ops on an empty selection; clear stored marks so
        // the next keystrokes start unformatted.
        return editor.commands.command(({ tr, dispatch }) => {
          if (dispatch) {
            tr.setStoredMarks([]);
          }
          return true;
        });
      },
    };
  },
});
