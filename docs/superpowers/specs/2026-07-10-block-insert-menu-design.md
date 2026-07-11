# Block Insert Menu ("+" handle) — Design

**Date:** 2026-07-10
**Status:** Approved, pending implementation plan

## Summary

Add a Notion-style block-insert affordance to the document editor. When the user
hovers over an **empty line**, a circular **+** button appears in the editor's
left gutter, aligned to that line. Clicking it opens a dropdown menu of block
types to insert. Selecting an item inserts/converts the block at that line.

## Trigger & Handle

- On `mousemove` over the editor scroll container, resolve the block under the
  pointer using ProseMirror `view.posAtCoords`.
- Show the **+** button only when the resolved block is an **empty paragraph**
  (node type `paragraph` with `content.size === 0`).
- Position: fixed/absolute overlay, left-aligned into the existing 60px left
  padding of the editor area (`EditorWorkspace`, `#scroll-main`), vertically
  centered on the hovered line's bounding rect (from `view.coordsAtPos` /
  `getBoundingClientRect`).
- The button is a circle with a `+` glyph (lucide `Plus`).
- Clicking the **+** opens a dropdown anchored to the button.
- The dropdown closes on: outside click (`mousedown`), `Escape`, or when a
  selection/insert happens — mirroring the existing `ImageInsert` close logic.
- The **+** hides when the pointer leaves the editor and no dropdown is open.

## Menu Contents

Each item runs a command targeting the hovered empty line, replacing/converting
that empty paragraph. Icons from `lucide-react`.

| Item | Action |
|------|--------|
| Image | Opens the existing `ImageInsert` panel (URL / upload), reused |
| Heading 1 | `setNode('heading', { level: 1 })` |
| Heading 2 | `setNode('heading', { level: 2 })` |
| Heading 3 | `setNode('heading', { level: 3 })` |
| Bulleted list | `toggleBulletList()` |
| Numbered list | `toggleOrderedList()` |
| Checklist | `toggleTaskList()` |
| Blockquote | `toggleBlockquote()` |
| Code block | `toggleCodeBlock()` |
| Table | `insertTable({ rows: 3, cols: 3, withHeaderRow: true })` |
| Divider | `setHorizontalRule()` |

Before running the command, the editor is focused and the selection is moved to
the hovered line's position so the block is inserted at the correct place.

## Architecture

**New component:** `src/components/editor/BlockInsertMenu.tsx`
- Props: `{ editor: Editor | null; editorScrollRef: RefObject<HTMLElement> }`
- Owns: hover detection, the `+` button overlay, the dropdown, and the item
  config array. Self-contained; no changes to `TipTapEditor`'s render path.
- Mounted in `EditorWorkspace`, alongside `SelectionToolbar`, so it has access
  to the live editor (`localEditor`) and the scroll container (`editorScrollRef`).

**Chosen approach:** custom hover overlay (full control over gutter positioning
and empty-line detection).
**Rejected:** TipTap `FloatingMenu` extension — cursor-anchored and focus-based,
cannot produce a hover-triggered left-gutter `+`.

## Extensions & Dependencies

New TipTap v3 packages:
- `@tiptap/extension-table`, `@tiptap/extension-table-row`,
  `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`
- `@tiptap/extension-task-list`, `@tiptap/extension-task-item`

Registered in the `extensions` array in `src/components/editor/TipTapEditor.tsx`:
- `Table.configure({ resizable: true })`, `TableRow`, `TableHeader`, `TableCell`
- `TaskList`, `TaskItem.configure({ nested: true })`

## Styling

Add to `src/index.css` (editor currently has no table/task-list styles):
- **Tables:** `.tiptap-editor table` — full-width, collapsed borders, cell
  padding, header background, selected-cell highlight, column-resize handle.
- **Task lists:** `.tiptap-editor ul[data-type="taskList"]` — remove bullets,
  flex layout for checkbox + label, checked-item styling.
- **+ button & dropdown:** circular button, dropdown reuses the existing `.drop`
  panel styling used by `ImageInsert` for visual consistency.

## Files Changed

- `src/components/editor/BlockInsertMenu.tsx` (new)
- `src/components/editor/EditorWorkspace.tsx` — mount `<BlockInsertMenu>`
- `src/components/editor/TipTapEditor.tsx` — register Table + TaskList/TaskItem
- `src/index.css` — table + task-list + handle/dropdown styles
- `package.json` / lockfile — 6 new dependencies

## Out of Scope (YAGNI)

- Slash ("/") command menu.
- Drag-to-reorder handle.
- Showing the + on non-empty lines.
- Callout/info-box custom node.

## Testing / Verification

- Manual, driven in the running dev server (browser) as done for the Enter fix:
  hover an empty line → + appears in gutter → click → menu opens → each item
  inserts the expected block at that line. Verify table renders/edits and task
  list items toggle. Confirm outside-click/Esc close the menu.
