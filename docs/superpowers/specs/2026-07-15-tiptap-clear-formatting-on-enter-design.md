# TipTap: Clear Formatting on Enter

**Date:** 2026-07-15  
**Status:** Approved design (pending implementation)

## Goal

When the user presses Enter and starts a new block in the TipTap document editor, the new block must begin with no text formatting (plain paragraph marks). Example: after finishing an h3-styled line and pressing Enter, continue as a normal paragraph with no marks.

## Requirements

### In scope

- Normal **Enter** outside lists clears **all** marks on the new block:
  - bold, italic, strike, underline
  - color, font family, highlight
  - link
  - inline text presets (`h1` / `h2` / `h3` via `textStyle.textPreset`)
  - any other active marks cleared by TipTap `unsetAllMarks()`
- Block headings already exit to a paragraph on Enter; keep that behavior.
- Use TipTap’s standard Enter command chain, with `splitBlock({ keepMarks: false })`, then `unsetAllMarks()`.

### Out of scope / unchanged

- **Lists** (bullet, ordered, task): keep current TipTap Enter behavior entirely (no custom clear-formatting override).
- **Shift+Enter** (hard break): leave marks alone.
- **Code blocks** and **tables**: do not override Enter; return `false` so existing handlers run.
- No UI, settings, i18n, or toolbar changes.
- Paste behavior unchanged.
- Toolbar “clear formatting” control unchanged.

## Approach

**Enter shortcut extension** (chosen over appendTransaction and per-extension config).

Add a small TipTap extension (working name: `ClearFormattingOnEnter`) that owns normal Enter when not in a skipped context.

### Why this approach

- Mirrors TipTap’s built-in Enter path (`newlineInCode` → `createParagraphNear` → `liftEmptyBlock` → `splitBlock`).
- `keepMarks: false` plus clearing stored marks fully meets “clear all formatting.”
- Returning `false` in lists / code blocks / tables preserves existing behavior without reimplementing it.

## Implementation sketch

1. Create extension file under `src/components/editor/` (same pattern as `InlineTextPreset` / `EditorShortcuts`).
2. `addKeyboardShortcuts()`:
   - Bind `Enter` only (not `Shift-Enter`).
   - If active in `bulletList`, `orderedList`, `taskList`, `codeBlock`, or `table` → `return false`.
   - Otherwise run TipTap’s standard Enter chain with `splitBlock({ keepMarks: false })`, then clear stored marks via `tr.setStoredMarks([])`.
   - Note: TipTap’s `unsetAllMarks()` is a no-op on an empty selection (the usual post-Enter cursor), so stored-mark clearing is required.
3. Register the extension in `TipTapEditor.tsx` extensions list with priority high enough to run for non-list Enter, while still deferring via `false` in skipped contexts.
4. No persistence or store changes.

## Success criteria

- Enter after inline h1/h2/h3 (or bold/color/etc.) → new paragraph with no marks; toolbar shows inactive formatting.
- Enter after block heading → paragraph (existing) with no carried marks.
- Enter in lists → same as today (new item / exit empty item / etc.).
- Shift+Enter → marks may continue.
- Enter in code block / table → unchanged.

## Risks

- Custom Enter must stay aligned with TipTap’s default Enter chain if upstream changes.
- Priority interactions with Heading / list shortcuts; mitigated by returning `false` in list/code/table contexts and including the standard command chain.
