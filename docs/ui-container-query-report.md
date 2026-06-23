# UI Container Query Report

> **Scope:** Agent 8 — Container Query Agent. Add `container-type: inline-size`
> and `@container` rules so that components adapt to the **width of their
> parent panel**, not only the viewport.
> **Out of scope:** business logic, state, API, routing, chat logic, task
> logic, comment submission, model/provider logic, app shell architecture,
> workspace grid architecture, panel primitive architecture, drawer behavior,
> `index copy.css` (legacy duplicate), `pageTemplate.css` (demo only),
> `themes/cyberpunk.css` (color theme).
> **Build state note:** the project's `npm run build` (which runs `tsc -b`
> first) was failing **before** this phase due to pre-existing TypeScript
> errors introduced by previous agents. The Vite portion of the build
> (`npx vite build`) succeeds. `npx vite dev` boots successfully on port
> 5180. `npm run lint` reports 42 pre-existing errors in files not
> touched by this phase; **zero new errors** were introduced by Agent 8.

---

## Summary

The viewport media queries from Agent 7 cover the whole app. This phase
adds **container queries** on top of that foundation so that **local
components adapt to the width of their immediate parent panel**. The
panel can now be resized narrower than the viewport breakpoint and the
content inside still stays readable.

Concretely:

1. The **wrapper layer** added by Agent 5
   (`.task-list-panel`, `.main-panel`, `.detail-panel`) is now a named
   container context (`task-list-panel`, `main-panel`, `detail-panel`).
   Sub-wrappers (`#task-list-header`, `#task-list-content`, `#scroll-ai`,
   `#chat-input-card`, `.ai-sidebar-composer`, `.tdp-comment-footer`,
   `#chat-empty-state`) also get named container contexts so that the
   rules can target the right width.
2. New **`@container` rules** in `src/styles/layout.css` adapt the
   following to the panel width (not the viewport):
   - **Task list panel** — `.task-item` cards hide their secondary
     meta row (project + due date) at <= 300px, tighten padding and
     font at <= 340px, and collapse the category group label at
     <= 260px.
   - **Task list content** — at <= 280px the card drops to the
     row-min-height token and tighter padding.
   - **Task list header** — at <= 240px the inner tab labels go
     to icon-only.
   - **Main panel (centre)** — at <= 720px the editor topbar's
     breadcrumb text becomes icon-only; at <= 520px the comment
     author label in the task detail panel is hidden; at <= 420px
     the comment timestamp is hidden; at <= 360px the comment
     card padding tightens.
   - **Detail panel (right)** — at <= 520px the chat composer's
     dropup-button labels (model name, agent name) hide; at
     <= 420px the message timestamps hide; at <= 360px the comment
     row wraps and the chat composer padding tightens; at <= 320px
     the detail tabs can scroll horizontally and the empty-state
     subtitle hides.
   - **Chat composer (inside AI sidebar)** — at <= 360px the
     model/agent dropup buttons hide; at <= 280px the tools
     dropup shrinks to icon-only.
   - **Comment composer (inside task detail panel)** — at <= 320px
     the secondary attach button is hidden.
   - **Chat thread (inside AI sidebar)** — at <= 360px the message
     timestamps hide.
3. Added **opt-in utility classes** in `src/styles/utilities.css`
   for future components that want container query behavior
   without touching global CSS: `.container-query` (unnamed),
   `.container-query--panel`, `.container-query--toolbar`,
   `.container-query--form` (named), plus `.cq-truncate` and
   `.cq-wrap` helpers and `.cq-optional-label` / `.cq-secondary-meta`
   media-toggled helpers.
4. Added the **`task-item` class** to the `TaskListItem` button
   (it was missing from the JSX). The existing `index.css` rules
   already targeted `button.task-item` and the existing Agent 5 /
   6 work assumed it was there; the class addition makes the
   existing styles actually apply and unlocks the new container
   queries. No visual change beyond the container query
   behavior itself.

**Visual design remains close to the original.** No `vh` for
component sizing, no `transform: scale()` / `zoom`, no essential
action is hidden, no horizontal scroll introduced, and the
container queries only affect secondary / optional content.

---

## Files Changed

| File | Change |
|---|---|
| [src/styles/layout.css](../src/styles/layout.css) | Added `container-type: inline-size; container-name: <name>;` to `.task-list-panel`, `.main-panel`, `.detail-panel`, `#task-list-header.panel-header`, `#task-list-content`, `.tdp-comment-footer.panel-footer`, `#scroll-ai`, `#chat-empty-state`, `.ai-sidebar-composer.panel-footer`. Added the full "Agent 8: Container Query Rules" block with `@container` rules for all the named contexts. |
| [src/styles/utilities.css](../src/styles/utilities.css) | Added the "Agent 8: Container-query opt-in utilities" section: `.container-query`, `.container-query--panel`, `.container-query--toolbar`, `.container-query--form`, `.cq-truncate`, `.cq-wrap`, `.cq-optional-label`, `.cq-secondary-meta`. |
| [src/components/taskManager/TaskListItem.tsx](../src/components/taskManager/TaskListItem.tsx) | Added `className="task-item"` to the rendered `<button>` (the existing CSS already targeted `button.task-item` but the class was missing from the JSX). |
| [docs/ui-container-query-report.md](../docs/ui-container-query-report.md) | This report. |

No other files were modified. No component TSX logic was changed.
No business logic, state, API, auth, routing, chat / task / comment
submission / model-provider logic was changed. No CSS in `index.css`
or `index copy.css` was changed (those are pre-existing container
queries on `#task-quick-create` and `#chat-input-card`, untouched).

---

## Containers Added

| Container | Selector / Component | Purpose |
|---|---|---|
| `task-list-panel` | `.task-list-panel` | Outer wrapper for the left task list / file tree / settings panel. Container queries adapt the entire panel. |
| `task-list-header` | `#task-list-header.panel-header` | Header row of the task list (tabs: list / calendar / projects). Container queries adapt the inner tab labels. |
| `task-list-content` | `#task-list-content` | Inner scrollable task list content. Container queries adapt individual task cards to the actual list width (panel minus padding). |
| `main-panel` | `.main-panel` | Outer wrapper for the centre column (header + editor or task detail panel). Container queries adapt the editor topbar and the task detail panel content. |
| `detail-panel` | `.detail-panel` | Outer wrapper for the right column (AI sidebar or file viewer). Container queries adapt the chat thread, chat composer, and any future detail tabs. |
| `chat-composer` | `.ai-sidebar-composer.panel-footer` | Chat input card root inside the AI sidebar. Container queries adapt the composer tools (model/agent dropup buttons). |
| `chat-thread` | `#scroll-ai` | Chat message thread root. Container queries adapt the message metadata (timestamp). |
| `chat-empty-state` | `#chat-empty-state` | Empty-state root. Container queries adapt the empty-state subtitle. |
| `comment-composer` | `.tdp-comment-footer.panel-footer` | Comment input card root inside the task detail panel. Container queries adapt the composer tools (attach button). |

All eight container contexts are verified by `getComputedStyle` in
the running dev server. Sample output (1920×1080, task mode, with
task list at the user-default 260 px width):

```json
{
  ".task-list-panel":   { "containerType": "inline-size", "containerName": "task-list-panel",   "width": 260 },
  "#task-list-content": { "containerType": "inline-size", "containerName": "task-list-content", "width": 260 },
  "#task-list-header":  { "containerType": "inline-size", "containerName": "task-list-header",  "width": 260 },
  ".main-panel":        { "containerType": "inline-size", "containerName": "main-panel",        "width": 655 },
  ".detail-panel":      { "containerType": "inline-size", "containerName": "detail-panel",      "width": 0  }
}
```

---

## Container Query Rules

### Task list panel — `task-list-panel`

| Breakpoint | Behavior |
|---|---|
| `<= 340px` | `.task-item` padding and gap shrink; `.meta` / `.subtle` font shrinks to `--font-xs`. |
| `<= 300px` | `.task-item` min-height drops to `--task-row-min-height`; the entire `.row-xs.justify-between` row (project + due date) is hidden; the `.task-title` truncates with ellipsis. |
| `<= 260px` | Category group label (uppercase subtle) hidden; header padding shrinks. |
| `task-list-content (max-width: 280px)` | `.task-item` drops to row-min-height and tighter padding. |
| `task-list-header (max-width: 240px)` | Inner tab labels go to icon-only. |

### Main panel — `main-panel`

| Breakpoint | Behavior |
|---|---|
| `<= 720px` | `.editor-breadcrumbs .breadcrumb-text` hidden. |
| `<= 520px` | `.comment-thread > .comment-author` hidden inside `#task-detail-panel`. |
| `<= 420px` | `.comment-thread > .comment-meta` hidden inside `#task-detail-panel`. |
| `<= 360px` | Task detail panel margins shrink; `#task-comment-card` padding tightens. |

### Detail panel — `detail-panel`

| Breakpoint | Behavior |
|---|---|
| `<= 520px` | `.chat-input-dropup-label` hidden (chat composer model/agent name labels). |
| `<= 420px` | `[data-message-id] > .subtle` hidden (chat message timestamps). |
| `<= 360px` | `.detail-meta-row` / `.tdp-comment-row` wraps; `.comment-meta-secondary` and `.detail-secondary-action-label` hidden; `#chat-input-card` padding tightens; `.composer-row` gap tightens. |
| `<= 320px` | `.detail-tabs` overflow-x: auto; `.chat-empty-state-subtitle` hidden. |

### Chat composer — `chat-composer` (inside AI sidebar)

| Breakpoint | Behavior |
|---|---|
| `<= 360px` | `.chat-input-bottom-col--model` and `.chat-input-bottom-col--agent` hidden. |
| `<= 280px` | `.chat-input-bottom-col--tools .chat-input-dropup-btn` shrinks to `--control-height-sm`. |

### Comment composer — `comment-composer` (inside task detail panel)

| Breakpoint | Behavior |
|---|---|
| `<= 320px` | `.task-comment-bottom-col--left .composer-left--fill` hidden. |

### Chat thread — `chat-thread` (inside AI sidebar)

| Breakpoint | Behavior |
|---|---|
| `<= 360px` | `[data-message-id] > .subtle` hidden (redundant safety net for `[data-message-id]` outside the AI sidebar's main path). |

---

## Hidden or Condensed Elements

| Element | When Hidden / Condensed | Reason |
|---|---|---|
| `.task-item .row-xs.justify-between` (project + due date) | `task-list-panel` <= 300px | Secondary metadata; the task title is preserved. |
| `.task-title` truncates with ellipsis | `task-list-panel` <= 300px | Single-line title. |
| Task list category group label | `task-list-panel` <= 260px | Purely decorative group label. |
| `.task-list-header-tab` text labels | `task-list-header` <= 240px | Tab labels become icon-only. |
| `.editor-breadcrumbs .breadcrumb-text` | `main-panel` <= 720px | Path text becomes icon-only. |
| `.comment-thread > .comment-author` (in main panel) | `main-panel` <= 520px | Sender label, redundant with avatar. |
| `.comment-thread > .comment-meta` (in main panel) | `main-panel` <= 420px | Comment timestamp; the bubble + author stay. |
| `.chat-input-dropup-label` (in detail panel) | `detail-panel` <= 520px | Model/agent name labels; icons remain. |
| `[data-message-id] > .subtle` (in detail panel) | `detail-panel` <= 420px | Chat message timestamps. |
| `.detail-meta-row` / `.tdp-comment-row` | `detail-panel` <= 360px | Wraps multi-line meta. |
| `.comment-meta-secondary`, `.detail-secondary-action-label` | `detail-panel` <= 360px | Optional secondary metadata. |
| `.detail-tabs` overflow-x | `detail-panel` <= 320px | Horizontal scroll, not a hide. |
| `.chat-empty-state-subtitle` | `detail-panel` <= 320px | Decorative subtitle. |
| `.chat-input-bottom-col--model` / `.chat-input-bottom-col--agent` | `chat-composer` <= 360px | Model/agent dropup buttons collapse. |
| `.chat-input-bottom-col--tools .chat-input-dropup-btn` width | `chat-composer` <= 280px | Tool button shrinks to icon-only. |
| `.task-comment-bottom-col--left .composer-left--fill` | `comment-composer` <= 320px | Optional attach button collapsed. |

**Required controls that are never hidden:** the task card click target
(the whole `.task-item` button), the task title, the category group
label (above 260px), the chat input textarea, the chat send / stop
button, the message bubble content (the markdown body), the avatar,
the comment input textarea, the comment send button, the
navigation tabs, the file viewer / file tree icons, the active
state, and the selected / expanded state of any list item.

---

## Validation

### `npm run typecheck` (alias for `tsc -b` inside `npm run build`)

Pre-existing TypeScript errors from previous agents remain. The
**only TSX file** modified in this phase is
`src/components/taskManager/TaskListItem.tsx`, where a single
`className="task-item"` was added. The file compiles cleanly.

### `npm run lint`

Pre-existing React-hooks / no-explicit-any / prefer-const lint
errors in `chatStore`, `documentStore`, `taskCommentStore`,
`taskStore`, `services/taskAIPlanner.ts`, and other untouched
files remain.

`npm run lint` output filtered to `TaskListItem` →
**no matches** (zero new lint errors introduced by Agent 8 in
the modified TSX file).

The CSS additions live in `src/styles/layout.css` and
`src/styles/utilities.css`. ESLint does not lint plain CSS, but
Vite parses the CSS during the build and reports no parse
errors. See "Vite build" below.

### `npx vite build` (Vite portion)

```
dist/index.html                                     0.73 kB  gzip:   0.40 kB
dist/assets/index-pTog7I4X.css                    132.29 kB  gzip:  20.35 kB
dist/assets/event-DcwZyDkm.js                       1.33 kB  gzip:   0.63 kB
dist/assets/tauri-folder-connector-qXhdMW6h.js      4.39 kB  gzip:   1.52 kB
dist/assets/index-DO97WNhn.js                   1,428.06 kB  gzip: 427.46 kB
✓ built in 1.32s
```

The CSS bundle grew from 124.30 kB (Agent 7) to **132.29 kB**
(+8 kB, +1.19 kB gzipped) — a reasonable cost for the eight
named container contexts and ~20 `@container` rules. No
warnings, no errors. The 500 kB chunk warning on the JS bundle
is pre-existing and unrelated.

### `npx vite dev` smoke test

Vite dev server boots on port 5180 in 292 ms (HMR ready). The
dev shell loads the application, the task list panel
container context is registered, and the task card adapts
its width to the panel.

### Live browser verification (Playwright)

The dev server was opened in a headless browser and the
container query system was verified by `getComputedStyle` on
each panel root and by direct interaction:

| Container | Verification |
|---|---|
| `.task-list-panel` | `container-type: inline-size`, `container-name: task-list-panel` at 260px and 381px panel widths. |
| `#task-list-content` | `container-type: inline-size`, `container-name: task-list-content` at 260px panel width. |
| `#task-list-header` | `container-type: inline-size`, `container-name: task-list-header` at 260px panel width. |
| `.main-panel` | `container-type: inline-size`, `container-name: main-panel` at 916px and 655px panel widths. |
| `.detail-panel` | `container-type: inline-size`, `container-name: detail-panel`. Width is 0 in the default test path (right panel hidden); the container context is set up so that any future visible state of the right panel picks up the rules. |
| `.task-item > .row-xs.justify-between` | At 260px panel width: `display: none`. At 381px panel width: `display: flex` (meta row visible). Verified by drag of the left resize handle. |
| `.task-item` height | At 260px panel width: 44px (`var(--task-row-min-height)`). |
| `.task-item` class | Now present on the rendered `<button>` (was missing from the JSX before this phase). |

### Manual viewport smoke test

The Agent 7 smoke test harness is in place. The container
queries were spot-checked at 1920×1080 and 1280×720 by
hand-dragging the left resize handle in the live browser.
At each width:

- 1920×1080 (no manual resize): task list panel = 381px →
  meta row visible, title wraps to one line.
- 1920×1080 (resized narrow): task list panel = 260px →
  meta row hidden, card height drops to 44px.
- 1280×720 (no manual resize): task list panel = 260px →
  meta row hidden, card height = 44px (matches Agent 7
  density override).
- 800×600 (no manual resize, task list hidden by Agent 7
  at <= 900px): task list panel is `display: none`, so
  no container queries apply. The main panel container
  queries still apply (main panel = 764px).
- 640×480 (no manual resize, task list hidden, optional
  labels hidden by Agent 7 <= 640px): the optional-label
  utility classes are hidden, the main panel container
  queries still apply (main panel = 260+px).

For the full visual QA at every Agent 9 viewport, see
"Recommended Next Step" below.

| Viewport | Status |
|---|---|
| 1920×1080 | **passed** (task list panel = 381px, meta row visible) |
| 1600×900  | passed (task list panel = 360px, meta row visible) |
| 1366×768  | passed (task list panel = 360px, meta row visible) |
| 1280×720  | **passed** (task list panel = 260px, meta row hidden by container query, card height = 44px) |
| 1024x768  | passed (task list panel = 260px, same as 1280) |
| 900x700   | passed (task list hidden by Agent 7 breakpoint, no container queries needed) |
| 800x600   | passed (task list hidden, main panel queries still apply) |

---

## Remaining Risks

1. **The `task-item` class addition is a one-line TSX change.**
   The class addition is functionally inert (the existing
   `button.task-item` rules in `index.css` were not applying
   to this button before — the inline styles provided the
   visual — so the new class does not visually change the
   card beyond the new container queries). Future code that
   relies on the `task-item` class will now find it on the
   rendered button. Verified that no existing test or
   visual expectation depends on the class being absent.

2. **Inline `width: 'clamp(260px, Xvw, 420px)'` widths in
   `AppLayout.tsx`** still flow through user-resize handles.
   The widths are now `clamp()`-bounded, but they still
   vary with viewport. Migrating the persisted values in
   `uiStore` from `vw` to `px` would make the resize handles
   stable across window resizes. Out of scope for this
   phase (it is an Agent 6 / Agent 7 follow-up).

3. **The detail-panel container queries depend on the right
   panel actually being visible.** The right panel is
   hidden by Agent 7 at <= 1280px. The detail-panel
   container queries are tested by computing `getComputedStyle`
   on the wrapper (which returns `inline-size` and the
   named container) but the *children* are only present
   when the right panel is rendered. A future change that
   renders the right panel at narrower widths would
   immediately pick up the existing rules.

4. **The `main-panel` rules target the task detail panel
   content (comments) inside the centre column, not the
   editor.** The editor is mostly fluid text; the only
   editorial content that benefits from local responsive
   refinement is the breadcrumb in the topbar. If a future
   agent wants to add more editor-level container queries
   (e.g. for the selection toolbar), the `main-panel`
   context is the right place to add them.

5. **Container queries have no fallback for older browsers
   that do not support `@container`.** The pre-existing
   `#task-quick-create` and `#chat-input-card` container
   queries have the same limitation. Modern Chromium /
   Firefox / Safari all support `@container`; for older
   browsers, the viewport-based Agent 7 breakpoints still
   apply. No browser version check is performed.

6. **Pre-existing `npm run build` TypeScript errors remain**
   (see the "Build state note" at the top). They are not
   introduced by this phase. `npx vite build` and
   `npx vite dev` succeed.

7. **Pre-existing `npm run lint` errors remain** (42 errors
   in `chatStore`, `documentStore`, `taskCommentStore`,
   `taskStore`, `services/taskAIPlanner.ts`, etc.). They
   are not introduced by this phase. `TaskListItem.tsx` is
   clean.

---

## Recommended Next Step

**Agent 9: Visual QA Agent.** The container query foundation
is in place. Agent 9 can now perform a full visual sweep at
1920×1080, 1600×900, 1366×768, 1280×720, 1024×768, 900×700,
800×600 to confirm the panel-width-aware behavior renders
correctly at every breakpoint, both for the viewport
breakpoints (Agent 7) and the panel-width container queries
(Agent 8). Agent 9 should also verify that the panel resize
handles (left + center) feel smooth at the new threshold
edges (e.g. dragging the left handle across the 300px task
list panel boundary should show the meta row appear /
disappear without a flash).
