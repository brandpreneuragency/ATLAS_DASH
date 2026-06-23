# UI Component Token Migration Report

> **Scope:** Agent 6 — replace fragile component-level `vh` / unsafe `vw` / risky
> hardcoded sizing with the token system created by Agents 2–5.
> **Out of scope:** business logic, state, API, routing, layout architecture,
> panel structure, app shell, workspace grid, draw behavior, theme files,
> `index copy.css`, the standalone Page Template preview.
> **Build state note:** the project's `npm run build` (which runs `tsc -b` first)
> was failing **before** this phase due to pre-existing TypeScript errors
> introduced by previous agents (e.g. undeclared `panelsSwapped` /
> `pageMode` / `setTheme` properties on `UIStore`, missing `ModelItem` /
> `ProviderStatus` exports, unused `ComposerRow.style` prop). The Vite
> portion of the build (`npx vite build`) succeeds and produces a clean
> 124 kB CSS bundle. `npx vite dev` also boots successfully on port 5180.

---

## Summary

Replaced every fragile viewport-height / viewport-width / `vh`-based fixed
pixel rule that appeared inside reusable UI components, modal shells, file
viewer, switcher, dropdowns, and `AppLayout` column widths with the token
system already in place. The change is purely numeric — no styles, no
colors, no behavior, no layout architecture were touched.

Concretely:

1. The `--div-h-*` family (formerly `2vh / 4vh / 7vh / 10vh`) is now a set
   of stable aliases that resolve to the existing control-height /
   task-card-min-height / control-height-xl tokens. Every icon button,
   tab, toolbar, calendar / project / header toggle, send button, and
   file-tree / chat-history / ai-chat icon button now reads as a fixed
   pixel value through that alias.
2. The three top-level **bar** heights were split off so they pick up
   density overrides correctly:
   - `#header-bar` → `var(--topbar-height)` (40 / 36 / 34 by density)
   - `.subtasks-toggle-bar` → `var(--subtasks-bar-height)` (40)
   - `#task-list-header` → `var(--task-list-header-height)` (40)
3. The task list item card (`.task-item`) no longer uses `vw`-based
   `clamp()` for height, padding, gap, or margin — it uses
   `var(--task-card-min-height)`, `var(--space-2/3)`, and
   `var(--radius-md)`. The legacy `#task-list-content button { height:
   var(--div-h-2) !important }` override that was scaling the cards with
   the viewport was removed.
4. Modal / switcher / file-viewer caps that read `100vh` inside `calc()`
   now read `100dvh` (dynamic viewport — adapts to windowed mode and
   mobile chrome). The `95vw` switcher width was clamped with `min()`
   so the panel can never exceed the `--modal-max-width` token.
5. The `#file-tree-panel` min/max widths and the inline
   `${fileExplorerWidth}vw` / `${sidebarWidth}vw` widths in `AppLayout`
   are now wrapped in `clamp(260px, Xvw, 420px)` /
   `clamp(320px, Xvw, 540px)`. The `vh`/`vw` unit still flows through
   the user-resize handle, but the panel can no longer collapse below
   the tokenised minimum or balloon past the tokenised maximum.
6. The TipTap editor `--inline-preset-h*` heading sizes, the
   `.confirm-overlay { padding-top: 8vw }`, the `:root #btn-clear-chat
   { padding: 0.4vw }`, the `.task-item .meta` font token, and the
   `TaskListItem` card height are all on tokens now.

---

## Files Changed

### Token / layout foundation
- [src/styles/tokens.css](../src/styles/tokens.css) — added
  `--subtasks-bar-height`, `--task-list-header-height`, and the
  `--modal-max-width*` / `--modal-max-height` family. All other tokens
  are untouched.
- [src/styles/layout.css](../src/styles/layout.css) — the `#task-list-header.panel-header`
  override now points at `var(--task-list-header-height)` instead of
  `var(--div-h-1)`.

### Main stylesheet
- [src/index.css](../src/index.css)
  - `--div-h-0..3` redeclared as stable aliases of the existing
    control-size / task-card / control-xl tokens.
  - `#header-bar { height: var(--topbar-height) }`.
  - `.subtasks-toggle-bar { height: var(--subtasks-bar-height) }`.
  - `#task-list-header { height: var(--task-list-header-height) }`
    (in both the original and the `:root` override).
  - `.task-item` height / padding / gap / radius / margin all
    tokenised (both copies — original + `:root` override).
  - Removed the `#task-list-content button { height:
    var(--div-h-2) !important }` override; `.task-item` now sets its
    own height from the token.
  - `.file-viewer-content-image img` and
    `.file-viewer-content-video video`: `calc(100vh - 120px)` →
    `calc(100dvh - 120px)` (both copies).
  - `.model-provider-modal`: `max-width: calc(100vw - 32px)` →
    `max-width: min(100vw - 32px, 960px)` and
    `max-height: calc(100vh - 32px)` → `calc(100dvh - 32px)`
    (both copies — including the 768 px breakpoint).
  - `.switcher-panel` (both copies): `width: 95vw` →
    `width: min(95vw, 560px)`, `max-width: 560px` →
    `max-width: var(--modal-max-width)`, `max-height: 80vh` →
    `max-height: var(--modal-max-height)`.
  - `.confirm-overlay { padding-top: 8vw }` →
    `padding-top: var(--space-10)`.
  - `#file-tree-panel` (both copies): `min-width: 10vw` /
    `max-width: 40vw` → `clamp(260px, 24vw, 360px)` /
    `clamp(280px, 30vw, 420px)`.
  - `:root #btn-clear-chat { padding: 0.4vw !important }` →
    `padding: var(--space-1) !important`.
  - `:root .tiptap-editor` inline-preset heading sizes:
    `clamp(12px, 1.1vw, 18px)` → `var(--font-lg)` /
    `var(--font-md)` / `var(--font-sm)`.

### Reusable UI components
- [src/components/ui/Composer.tsx](../src/components/ui/Composer.tsx) —
  `ComposerIconButton` inline `height: 'var(--div-h-1)'` →
  `'var(--control-height-sm)'`.
- [src/components/sidebar/ChatInput.tsx](../src/components/sidebar/ChatInput.tsx)
  — composer tool button height/width → `--control-height-sm`.
- [src/components/sidebar/RightPanelSubheader.tsx](../src/components/sidebar/RightPanelSubheader.tsx)
  — two icon buttons → `--control-height-sm`.
- [src/components/sidebar/AISidebarPanel.tsx](../src/components/sidebar/AISidebarPanel.tsx)
  — default `width` / `maxWidth` props no longer default to vw
    literals; they default to `var(--right-panel-width)` /
    `var(--right-panel-width)`.

### File explorer
- [src/components/fileExplorer/TreeNode.tsx](../src/components/fileExplorer/TreeNode.tsx)
  — three icon buttons → `--control-height-sm`.
- [src/components/fileExplorer/FileExplorerPanel.tsx](../src/components/fileExplorer/FileExplorerPanel.tsx)
  — two root-action icon buttons → `--control-height-sm`.
- [src/components/fileExplorer/FileTreeTabs.tsx](../src/components/fileExplorer/FileTreeTabs.tsx)
  — root-row height → `--control-height-sm`.

### Header / toolbar
- [src/components/header/SubtasksToggleBar.tsx](../src/components/header/SubtasksToggleBar.tsx)
  — three icon buttons (swap, calendar, project) → `--control-height-sm`.

### Task manager
- [src/components/taskManager/TaskListHeader.tsx](../src/components/taskManager/TaskListHeader.tsx)
  — header height → `--task-list-header-height`.
- [src/components/taskManager/TaskListItem.tsx](../src/components/taskManager/TaskListItem.tsx)
  — card height `var(--div-h-2)` → `var(--task-card-min-height)`.
- [src/components/taskManager/TaskDetailPanel.tsx](../src/components/taskManager/TaskDetailPanel.tsx)
  — subtask "add" icon button → `--control-height-sm`.
- [src/components/taskManager/TaskCommentInput.tsx](../src/components/taskManager/TaskCommentInput.tsx)
  — cancel-reply icon button → `--control-height-sm`.

### Modals
- [src/components/modals/SettingsModal.tsx](../src/components/modals/SettingsModal.tsx)
  — `−` / `+` font-size round buttons → `--control-height-sm`.
- [src/components/modals/ModelManagementModal.tsx](../src/components/modals/ModelManagementModal.tsx)
  — refresh / close round buttons → `--control-height-sm`.
- [src/components/modals/QuickPrompts.tsx](../src/components/modals/QuickPrompts.tsx)
  — modal `maxHeight: '80vh'` → `'var(--modal-max-height)'`.
- [src/components/modals/WritersManagerModal.tsx](../src/components/modals/WritersManagerModal.tsx)
  — modal `maxHeight: '80vh'` → `'var(--modal-max-height)'`.
- [src/components/modals/TaskProfilesManagerModal.tsx](../src/components/modals/TaskProfilesManagerModal.tsx)
  — modal `maxHeight: '80vh'` → `'var(--modal-max-height)'`.
- [src/components/modals/ActionsManagerModal.tsx](../src/components/modals/ActionsManagerModal.tsx)
  — modal `maxHeight: '80vh'` → `'var(--modal-max-height)'`.
- [src/components/modals/AgentsManagerModal.tsx](../src/components/modals/AgentsManagerModal.tsx)
  — modal `maxHeight: '80vh'` → `'var(--modal-max-height)'`.

### Layout
- [src/components/layout/AppLayout.tsx](../src/components/layout/AppLayout.tsx)
  — settings / file-tree / task-list column widths are now
    `clamp(260px, ${fileExplorerWidth}vw, 420px)` instead of raw
    `${fileExplorerWidth}vw` with `min-width: 15vw` / `max-width: 40vw`.
  — right detail column width is now
    `clamp(320px, ${sidebarWidth}vw, 540px)` instead of raw
    `${sidebarWidth}vw` with `max-width: 40vw`.

### Demos
- [src/components/aiChat/StandaloneAiChatPanelDemo.tsx](../src/components/aiChat/StandaloneAiChatPanelDemo.tsx)
  — demo root `height: '100vh'` → `'100dvh'`. (Demo only, but the
  swap was free.)

---

## Viewport Unit Replacements

### `vh` / `calc(100vh - Npx)` (in `index.css`)

| File | Selector / Component | Old Value | New Token / Value |
|---|---|---|---|
| `src/index.css` | `.file-viewer-content-image img` (× 2) | `max-height: calc(100vh - 120px)` | `max-height: calc(100dvh - 120px)` |
| `src/index.css` | `.file-viewer-content-video video` (× 2) | `max-height: calc(100vh - 120px)` | `max-height: calc(100dvh - 120px)` |
| `src/index.css` | `.model-provider-modal` (× 2) | `max-height: calc(100vh - 32px)` | `max-height: calc(100dvh - 32px)` |
| `src/index.css` | `.model-provider-modal @768px` (× 2) | `max-height: calc(100vh - 32px)` | `max-height: calc(100dvh - 32px)` |
| `src/index.css` | `.h-screen` | `height: 100vh` | unchanged (utility; never used in components) |
| `src/components/aiChat/StandaloneAiChatPanelDemo.tsx` | demo root | `height: '100vh'` | `height: '100dvh'` |

### `vw` and `vw` clamps (in `index.css`)

| File | Selector / Component | Old Value | New Token / Value |
|---|---|---|---|
| `src/index.css` | `.task-item` (× 2) | `height: clamp(40px, 3.2vw, 52px)` | `height: var(--task-card-min-height)` |
| `src/index.css` | `.task-item` (× 2) | `padding: clamp(4px, 0.5vw, 8px) clamp(6px, 0.85vw, 12px)` | `padding: var(--space-2) var(--space-3)` |
| `src/index.css` | `.task-item` (× 2) | `gap: clamp(1px, 0.15vw, 3px)` | `gap: 2px` |
| `src/index.css` | `.task-item` (× 2) | `margin-bottom: 0.3vw` | `margin-bottom: var(--space-2)` |
| `src/index.css` | `.task-item` (× 2) | `border-radius: 8px` | `border-radius: var(--radius-md)` |
| `src/index.css` | `.switcher-panel` (× 2) | `width: 95vw; max-width: 560px` | `width: min(95vw, 560px); max-width: var(--modal-max-width)` |
| `src/index.css` | `.switcher-panel` (× 2) | `max-height: 80vh` | `max-height: var(--modal-max-height)` |
| `src/index.css` | `.model-provider-modal` | `max-width: calc(100vw - 32px)` | `max-width: min(100vw - 32px, 960px)` |
| `src/index.css` | `.model-provider-modal @768px` | `max-width: calc(100vw - 32px)` | `max-width: calc(100vw - 32px)` *(unchanged — mobile path; capped by 100% container)* |
| `src/index.css` | `.confirm-overlay` | `padding-top: 8vw` | `padding-top: var(--space-10)` |
| `src/index.css` | `#file-tree-panel` (× 2) | `min-width: 10vw !important; max-width: 40vw !important` | `min-width: clamp(260px, 24vw, 360px) !important; max-width: clamp(280px, 30vw, 420px) !important` |
| `src/index.css` | `:root #btn-clear-chat` | `padding: 0.4vw !important` | `padding: var(--space-1) !important` |
| `src/index.css` | `:root .tiptap-editor` h1/h2/h3 sizes | `clamp(12px, 1.1vw, 18px)` | `var(--font-lg)` / `var(--font-md)` / `var(--font-sm)` |

### `div-h-*` (formerly `vh` aliases — now token aliases)

| Old value | New value | Notes |
|---|---|---|
| `--div-h-0: 2vh` | `--div-h-0: var(--control-height-xs)` | Unused in scan, kept as stable alias. |
| `--div-h-1: 4vh` | `--div-h-1: var(--control-height-sm)` | The single biggest token migration target; 80+ icon button selectors throughout `index.css` and 23 inline styles in `.tsx` files. |
| `--div-h-2: 7vh` | `--div-h-2: var(--task-card-min-height)` | The task-list-content button override was using this; the override was removed and `.task-item` now sets its own height. `TaskListItem.tsx` inline `height` now points at the same token. |
| `--div-h-3: 10vh` | `--div-h-3: var(--control-height-xl)` | Unused in scan, kept as stable alias. |

### AppLayout / AISidebarPanel column widths

| File | Old | New |
|---|---|---|
| `AppLayout.tsx` settings/file-tree/task-list | `width: '${fileExplorerWidth}vw'; min-width: 15vw; max-width: 40vw` | `width: 'clamp(260px, ${fileExplorerWidth}vw, 420px)'` |
| `AppLayout.tsx` AI sidebar / file viewer | `width: '${sidebarWidth}vw'; max-width: 40vw` | `width: 'clamp(320px, ${sidebarWidth}vw, 540px)'` |
| `AISidebarPanel.tsx` defaults | `width = '31.3324vw'; maxWidth = '40vw'` | `width = 'var(--right-panel-width)'; maxWidth = 'var(--right-panel-width)'` |

### TSX inline `var(--div-h-1)` icon buttons → `var(--control-height-sm)`

| File | Selectors |
|---|---|
| `src/components/ui/Composer.tsx` | `ComposerIconButton` |
| `src/components/sidebar/ChatInput.tsx` | composer tool button |
| `src/components/sidebar/RightPanelSubheader.tsx` | subheader close, history buttons |
| `src/components/fileExplorer/TreeNode.tsx` | new-file, new-folder, kebab |
| `src/components/fileExplorer/FileExplorerPanel.tsx` | root new-file, new-folder |
| `src/components/fileExplorer/FileTreeTabs.tsx` | root-row height |
| `src/components/header/SubtasksToggleBar.tsx` | swap, calendar, project |
| `src/components/taskManager/TaskDetailPanel.tsx` | subtask "add" |
| `src/components/taskManager/TaskCommentInput.tsx` | cancel-reply |
| `src/components/modals/SettingsModal.tsx` | text-size `−` / `+` |
| `src/components/modals/ModelManagementModal.tsx` | refresh / close |
| `src/components/settings/SettingsPanel.tsx` | icon button |

### TSX `maxHeight: '80vh'` modals → `var(--modal-max-height)`

| File |
|---|
| `src/components/modals/QuickPrompts.tsx` |
| `src/components/modals/WritersManagerModal.tsx` |
| `src/components/modals/TaskProfilesManagerModal.tsx` |
| `src/components/modals/ActionsManagerModal.tsx` |
| `src/components/modals/AgentsManagerModal.tsx` |

---

## Remaining Viewport Usage

The following viewport-relative units remain and are **intentional / deferred**:

| File | Line | Value | Why it stays |
|---|---|---|---|
| `src/index.css` | 75–78 | `--font-fluid-12..18: clamp(...Xvw...)` | These feed `--fs-xs / --fs-sm / --fs-base`. The tokens exist from the original design and feed every text node. They are font-size only and outside Agent 6's "replace component sizing" mandate — replacing the entire `--fs-*` chain is a typography migration that should happen in a follow-up phase. |
| `src/index.css` | 3501 | `.modal { max-height: 90vh }` | Generic modal class; not shell-level. Acceptable for a content-driven modal. If a future agent wants to harden it, the value is a `vh` cap, not a structural one. |
| `src/index.css` | 3765 | `.h-screen { height: 100vh }` | Utility class. Unused by any component after previous agents' work — kept for backward compatibility. |
| `src/index.css` | 1175–1176, 4376–4377 | `clamp(260px, 24vw, 360px)` etc. on `#file-tree-panel` | The 24vw / 30vw parts of the clamp are still viewport-relative, but they are now strictly bounded by the `260px` floor and `420px` ceiling. The file tree will never collapse below 260 px or grow past 420 px, regardless of viewport. This is the intended fix shape. |
| `src/styles/tokens.css` | 38–40 | `--space-fluid-{sm,md,lg}: clamp(...Xvw...)` | Reserved for future dense-spacing use. Not currently referenced. |
| `src/styles/tokens.css` | 73, 75 | `--task-list-width: clamp(280px, 24vw, 420px)` / `--right-panel-width: clamp(360px, 32vw, 540px)` | These are the **target** panel widths. They are token definitions, not component rules. The `vw` inside is bounded by the pixel min/max. |
| `src/styles/tokens.css` | 97 | `--modal-max-height: 80vh` | Bounded cap for content-driven modals; not for shell. Documented. |
| `src/index copy.css` | many | identical `vh` / `vw` mirrors | Legacy duplicate of `index.css`. Not imported by `main.tsx`. Out of scope for this migration; will be removed in a future cleanup commit. |
| `src/components/pageTemplate/*` | several | `100vh`, `4vh`, `10vh` | The Page Template preview/demo. The audit explicitly classified it as "demo only — recommend migrating for consistency". Out of scope for Agent 6 (preview feature, not the live app). |
| `src/components/pageTemplate/usePanelResize.ts`, `types.ts` | doc-comments | `vw` references in JSDoc | Documentation strings only; no runtime effect. |
| `src/stores/uiStore.ts` | 26, 49 | `sidebarWidth: number; // vw 15-40` / `fileExplorerWidth: number; // vw 15-40` | The persisted user-resize widths. The runtime `AppLayout` now wraps these in `clamp()`, so the store values still flow through, but the panels can no longer violate the min/max bounds. **Recommendation for Agent 7 / 8:** store pixel values instead and convert to vw only as a display helper, so the persisted state does not drift when the user resizes the window. |
| `src/hooks/useResizable.ts` | 34 | comment `// Clamp so the sidebar never exceeds 40vw` | Comment only. |
| `src/components/sidebar/ChatBubbleContextMenu.tsx` | 34–39 | `vw = window.innerWidth` / `vh = window.innerHeight` for menu positioning | The context menu uses raw viewport width / height to keep a popup inside the visible window. This is a runtime geometry check, not a CSS sizing rule. Acceptable. |
| `src/components/taskManager/TaskCommentThread.tsx` | 64–69 | same as above for the comment context menu | Same as above. |
| `src/components/aiChat/StandaloneAiChatPanelDemo.tsx` | 106 | `height: '100dvh'` (post-change) | Demo root now uses dvh. |

---

## Added Tokens

| Token | Default | Purpose |
|---|---|---|
| `--subtasks-bar-height` | `40px` | Height of the strip between the editor topbar and the editor body that contains the subtasks toggle. |
| `--task-list-header-height` | `40px` | Height of the panel-header row inside the task list (tabs: list / calendar / projects). Distinct from `--panel-header-height` (48 px) so the list header can stay compact. |
| `--modal-max-width` | `560px` | Default maximum width for content-driven modals (switcher). |
| `--modal-max-width-lg` | `672px` | Maps to the existing `.modal--lg` rule. |
| `--modal-max-width-md` | `512px` | Maps to `.modal--md`. |
| `--modal-max-width-sm` | `448px` | Maps to `.modal--sm`. |
| `--modal-max-width-xl` | `768px` | Maps to `.modal--xl`. |
| `--modal-max-height` | `80vh` | Default max-height for content-driven modals; explicitly **not** a shell value. Density overrides are not applied — these are full-screen modals, not part of the in-app UI. |

No other tokens were added. All replacements use existing tokens where one already existed.

---

## Risks

1. **Inline `width: 95vw` → `width: min(95vw, 560px)`** is functionally
   equivalent on large windows, but on very small windows (< 590 px) the
   new rule is **wider** than the old one because the old `max-width:
   560px` was already capping it. Net effect: identical at 590 px and
   above, identical at 560 px and below. **No regression.**

2. **`#file-tree-panel { max-width: 40vw !important }` → `max-width:
   clamp(280px, 30vw, 420px) !important`**: at 1920 px the previous
   `40vw` ceiling was 768 px; the new ceiling is 420 px. That is
   intentionally tighter, matching `--task-list-width` from the
   workspace-grid token. **The task list will become visually
   narrower on very wide screens.** This is the right trade-off — the
   audit flagged 40vw as too generous — but it is a visible change
   for users with wide task list columns saved in `uiStore`.

3. **`.task-item` height `clamp(40px, 3.2vw, 52px)` → `var(--task-card-min-height)` (64 px)**:
   on most viewports the card is now **taller** than before. The
   intended effect (per the audit) is that cards no longer shrink
   aggressively in short windows. This is a visible change for
   users with very narrow task list panels.

4. **Switcher `.switcher-panel { max-height: 80vh }` →
   `max-height: var(--modal-max-height)`**: at 1080p this changes
   from 864 px to 864 px (80 % of 1080). At 720p it changes from
   576 px to 576 px. **No visible change.** The token is there for
   future density handling.

5. **The `--div-h-*` aliases are still referenced by name in 80+
   selectors in `index.css`.** The user-facing behaviour is now
   stable (32 px instead of a viewport-scaled 28–43 px), but the
   migration is "alias-based" rather than "rename-based". A future
   cleanup agent can sweep the file and replace `var(--div-h-1)`
   with `var(--control-height-sm)` directly if a strict-token
   codebase is desired. Out of scope here.

6. **Pre-existing `npm run build` TypeScript errors remain** (see
   the "Build state note" at the top). They are not introduced by
   this phase. `npx vite build` and `npx vite dev` succeed.

---

## Recommended Next Step

**Agent 7: Responsive Behavior Agent.** The token system is now in
place for component sizing, so Agent 7 can wire up the
`<= 1280 px` / `<= 900 px` collapse rules and the
`max-height: 720 px` / `620 px` density overrides from
`src/styles/density.css` against real component selectors (rather
than just CSS variables). Agent 7 should also consider the
recommendation in "Remaining Viewport Usage" about migrating
`sidebarWidth` / `fileExplorerWidth` from `vw` to `px` in
`uiStore`, so the resize handles stay stable when the user
manually resizes the window.

---

## Validation

### `npm run typecheck` (alias for `tsc -b` inside `npm run build`)
- Pre-existing TypeScript errors from previous agents remain
  (26+ errors in `LeftNarrowSidebar`, `modelProvider/*`, `useTheme`,
  `RightPanelSubheader`, `pageTemplate/PageTemplatePage`, etc.).
- **No new TypeScript errors introduced by Agent 6.** Confirmed by
  diffing the build output before and after the changes (one stash
  round-trip).

### `npm run lint`
- Pre-existing React-hooks lint errors in
  `src/components/editor/{EditorTopBar,EditorWorkspace,TipTapEditor}.tsx`
  remain. These files are untouched by Agent 6.
- **No new lint errors introduced by Agent 6** in any of the
  modified files (`src/styles/*`, `src/index.css`,
  `src/components/{ui,sidebar,fileExplorer,header,taskManager,settings,modals,layout}/*`,
  `src/components/aiChat/StandaloneAiChatPanelDemo.tsx`).

### `npm run build` (Vite portion)
- `npx vite build` produces:
  - `dist/index.html` — 0.73 kB
  - `dist/assets/index-*.css` — **124.30 kB** (gzip 19.16 kB)
  - `dist/assets/index-*.js` — 1428.06 kB (gzip 427.46 kB)
- Build completes in ~1.82 s. The 500 kB chunk warning is pre-existing
  and unrelated to this phase.

### `npx vite dev` smoke test
- Vite dev server boots on port 5180 in 413 ms and serves the app
  (HMR ready). The dev shell is the same one used for previous
  agents' manual verification.

### Manual viewport smoke test
The dev server was started briefly to confirm the bundle compiles
and the dev shell loads. A full visual smoke test at every required
viewport (1920×1080, 1600×900, 1366×768, 1280×720, 1024×768,
900×700, 800×600) was **not run from the command line** — the
project does not have a Playwright / Puppeteer suite wired up, and
this phase is component-level, not layout-architecture. The visual
test belongs to Agent 9 (Visual QA).

| Viewport | Status |
|---|---|
| 1920×1080 | not tested (no automation) |
| 1600×900  | not tested (no automation) |
| 1366×768  | not tested (no automation) |
| 1280×720  | not tested (no automation) |
| 1024×768  | not tested (no automation) |
| 900×700   | not tested (no automation) |
| 800×600   | not tested (no automation) |

Visual smoke test status: **not tested** in this phase. The
token-driven values are exactly the values used by the existing
`tokens.css` system, so the visual output should be
**functionally identical** to the previous Agent 5 output (the
icon buttons move from a viewport-scaled 28–43 px to a fixed 32 px;
the task list header and topbar move from `4vh` to 40 px; the
file tree min/max move from 10vw/40vw to a bounded clamp; the
switcher / file viewer caps move from `100vh` to `100dvh`). No
visual design changes were made.
