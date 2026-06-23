# UI Layout Audit Report

> **Scope:** Whole `src/` tree. Audit only — no fixes, no tokens, no component edits.
> **Goal:** Prepare a stable base for migrating from `vh`/fixed sizing to a responsive token system using `100dvh` for the shell, CSS Grid for the workspace, panel primitives, and internal scroll.

---

## Summary

The app is currently assembled from **fragile `vh` units, flex chains, and a few fixed-size `vw` columns** instead of an `100dvh` shell + Grid workspace + token system. The most critical issues are:

1. The top-level shell uses `height: 100vh` (`index.css` L235) on `#app-content` and `html, body, #root` use a mix of `height: 100%` and `height: fit-content`, which makes the actual document size unreliable in windowed mode and on mobile-style resize.
2. Almost every button, tab, toolbar control, list item, and composer relies on `--div-h-1` (`4vh`) / `--div-h-2` (`7vh`) / `--div-h-3` (`10vh`) tokens. **These tokens are viewport-scaled, so the whole UI breathes with the window.** At 1080p `--div-h-1` ≈ 43 px (fine); at `1280x720` it drops to 28 px; at `800x600` it is 24 px — buttons, tab heights, and toolbar heights become undersized.
3. **Body scrolling is not enforced to be off** explicitly (`body` has no `overflow: hidden` in `index.css`). `#app-content` has `overflow: hidden`, but the body itself is not locked, and `html, body, #root` is the chain the browser uses to decide document size.
4. The main workspace is built with `display: flex` (`#main-row` and `#main-columns`), not Grid, and column widths are computed from `vw` (`fileExplorerWidth` vw, `sidebarWidth` vw). There is no `minmax()`, no `min-width: 0` flex safety, and column widths ignore the centre panel's min size until the browser forces a reflow.
5. Several panel bodies rely on the implicit `flex: 1` shrink behavior with no `min-height: 0`, so their scrollable child either overflows the column or pushes the rest of the layout down (chat body, task list body, AI sidebar body, comment thread, dropdown menus).
6. `position: fixed` is used heavily: a 36 px universal header, several modal overlays, and the `.switcher-panel` itself uses `height: 100vh`. These are not safe for windowed mode and the universal header is not yet aligned with the proposed `.app-shell` grid.

The future migration must:
- Make `100dvh` the only place `dvh`/`vh` exists.
- Replace `--div-h-*` with `px`/`rem` control-size tokens.
- Convert `#main-row` and panels to Grid.
- Add `min-height: 0` / `min-width: 0` to every shrink-prone child.
- Force `body { overflow: hidden }`.
- Make each panel a `.panel > .panel-header / .panel-body / .panel-footer`.

---

## Current Layout Structure

### App entry
- `src/main.tsx` mounts `<App />` into `#root` and imports `index.css` and `themes/cyberpunk.css`.
- `src/App.tsx` renders `<div id="app-content">` and wraps `<AppLayout>`.
- `App.tsx` also renders the initial loading screen (uses `.h-screen` utility which is `height: 100vh`).

### App shell
- `#app-content` (in `index.css` L227–L237) currently is `height: 100vh; overflow: hidden;`.
- `html { height: 100%; }` and `body, #root { height: fit-content; }` — inconsistent chain.
- `index.css` does **not** set `body { overflow: hidden }`. There is no body-level lock.
- A separate `#universal-header` (`position: fixed; top: 0; left: 0; right: 0; height: 36px; z-index: 1000;`) overlays the very top, with `grid-template-columns: repeat(3, 1fr)`. It is **not** part of the layout grid — it floats above.

### Workspace
- `src/components/layout/AppLayout.tsx` is the workspace container.
- Root row is `flex` (`.flex h-full overflow-h`) wrapping a `LeftNarrowSidebar` (`.nav-bar`), an optional `#file-tree-panel` or `#task-list-column` (width in vw), a resize handle, `#main-columns` (the centre+right region), and a `RightNarrowSidebar` (`display: none`).
- `#main-columns` is `flex flex-col flex-1` containing: an optional header, then `#main-row` (`flex flex-1 h-full`) which is the centre panel + (optional) handle + (optional) right AI sidebar.
- The centre panel (`#center-panel`) and right sidebar (`#ai-sidebar-panel` / `#file-viewer-panel`) widths are inline `style={{ width: \`${sidebarWidth}vw\`, maxWidth: '40vw' }}` — i.e. directly bound to viewport width units.

### Top bar / tabs
- `Header.tsx` renders `#header-bar` (`height: var(--div-h-1)`).
- The tabs row inside is `display: flex; overflow-x: auto` and a sticky-right "+" button.

### Modals & overlays
- `.overlay` (`index.css` L3509) is `position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px;`.
- `.switcher-panel` (`index.css` L3721) is `position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); height: 100vh;` — uses `vh` to size a centred modal.
- `.model-provider-modal` uses `max-height: calc(100vh - 32px);`.
- `.file-viewer-content-image img` uses `max-height: calc(100vh - 120px);`.

### Per-column current selectors
| Column | Current ID / class | Width logic | Height logic | Scroll |
|---|---|---|---|---|
| Left icon rail | `#nav-bar` | implicit (fit-content) | `100%` of parent | n/a |
| File tree / Task list | `#file-tree-panel` / `#task-list-column` | `${fileExplorerWidth}vw` with `min-width: 10vw !important; max-width: 40vw !important` | `100%` | `#filetree-list { overflow-y: scroll }` |
| Centre panel | `#center-panel` | `flex: 1` (no min-width, no `min-width: 0` on flex item) | `100%` | `#scroll-main { overflow-y: auto }` (good) |
| Right AI sidebar | `#ai-sidebar-panel` / `#file-viewer-panel` | `${sidebarWidth}vw` with `max-width: 40vw` | `100%` | `#scroll-ai` (no explicit `overflow` on the panel itself) |
| Right narrow rail | `#right-nav-bar` | `34px !important` | `100%` | n/a |

### Page template mode
- `src/components/pageTemplate/pageTemplate.css` contains its own `100vh` root in `.reusable-page-template__preview-root` (L219) and `.reusable-page-template__section` shapes using `var(--pt-*)` local tokens. The section pattern is actually a **good** reference: `--pt-header-height`, `--pt-footer-height`, sections with `flex: 1 1 auto; min-height: 0; overflow: auto;`.

---

## Critical Findings

| # | Risk | Where | Issue |
|---|---|---|---|
| C1 | Critical | `index.css` L227–L237 (`#app-content`) and `L148–L154` (`html,body,#root`) | Shell uses `height: 100vh` with a body chain that mixes `100%` and `fit-content`. No `body { overflow: hidden }`. In windowed mode or on browsers that ignore dvh, the app will under-fill or scroll the page. |
| C2 | Critical | `index.css` L98–L101 + global usage (`--div-h-0: 2vh; --div-h-1: 4vh; --div-h-2: 7vh; --div-h-3: 10vh;`) | All control heights (header bar, buttons, tab buttons, tbar, calendar day btn, calendar month btn, dropdown close, ai-toggle, side-nav-tab, task-list-tab, etc.) use `--div-h-1` = `4vh`. At 1280×720 this is 28.8 px, at 800×600 it is 24 px. The whole UI shrinks when the window shortens. This is the single largest token migration target. |
| C3 | Critical | `AppLayout.tsx` columns use inline `style={{ width: \`${fileExplorerWidth}vw\` }}`, and the centre/right columns also use `vw` for width | vw-based column widths ignore the centre panel's required min size, can exceed `40vw`, and on narrow windows the layout is over-constrained. No `clamp()`, no `minmax()`. |
| C4 | Critical | `#main-row` (centre + handle + right sidebar) | `display: flex` without `min-width: 0` on children. The right sidebar at `${sidebarWidth}vw` can prevent the centre panel from shrinking, breaking the layout. There is no `minmax(var(--main-panel-min-width), 1fr)`. |
| C5 | Critical | Many flex/grid parents (e.g. `#editor-column`, `#editor-card-wrapper`, `#ai-sidebar`, `#ai-sidebar-panel`, `#task-detail-panel`, `#chat-input-card`, `#task-list-content`, `#task-list-panel`, `#file-tree-panel`, `#filetree-list`) | Children that should shrink and scroll (chat body, comment thread, task list, file tree) do not have `min-height: 0` and rely on the implicit shrink default. This is the classic cause of overflow-into-parent problems in flex columns. |
| C6 | High | `index.css` L210–L222 (`#universal-header`) | `position: fixed; height: 36px;` floats above the app. The current shell doesn't reserve space for it, so the top 36 px of the centre/right content is visually overlapped. This needs to be folded into the proposed `.app-shell` Grid. |
| C7 | High | `index.css` L3721 (`.switcher-panel`) | `height: 100vh;` is used for a centred modal — even in windowed mode this may exceed the visual viewport. Must become a content-driven `min/max-height` with a sane cap. |
| C8 | High | `index.css` L227–L237 `#app-content` | Has `overflow: hidden`, but the body still scrolls on rare browsers/devtools. `body` needs its own `overflow: hidden`. |
| C9 | High | `index.css` L3509, L3616, L4127, L5619 (`position: fixed`) | Modals use `position: fixed` and a `padding: 16px` overlay. They work, but are not yet token-driven and several use `max-height: calc(100vh - Npx)`. Future target: use `100dvh - Npx` or a token. |
| C10 | High | `index.css` L275, L4095 (`position: sticky` on `.tabs-row` children and `#tdc-thread` etc.) | Sticky children inside flex parents without `min-height: 0` can become unsticky or shift unexpectedly. Worth flagging for the panel migration. |
| C11 | High | `src/components/aiChat/StandaloneAiChatPanelDemo.tsx` L106 | Inline style `height: '100vh'` on the demo root. Not in main app, but will leak through if imported. |
| C12 | High | `src/components/pageTemplate/pageTemplate.css` L219 | `height: 100vh` on the preview root. Not a runtime concern (used in the Page Template demo), but should also be tokenized for consistency. |

---

## Full Findings

| Risk | File | Selector / Component | Current Pattern | Problem | Recommended Future Fix |
|---|---|---|---|---|---|
| Critical | `src/index.css` L227–L237 | `#app-content` | `height: 100vh; overflow: hidden;` | Top-level `vh` in the shell. In windowed mode the URL bar and toolbars inflate `vh`, causing over-scroll or hidden content. | `height: 100dvh;` on `.app-shell`; import only at shell. |
| Critical | `src/index.css` L148–L154 | `html, body, #root` | `html { height: 100% } body, #root { height: fit-content }` | Inconsistent chain — `#root` shrinks to its content, but `#app-content` is `100vh`. Some browsers will collapse the body to the visible children and re-show scrollbars. | `html, body, #root { height: 100%; } body { overflow: hidden; }` |
| Critical | `src/index.css` L98–L101 | `--div-h-0..3` | `--div-h-1: 4vh; --div-h-2: 7vh; --div-h-3: 10vh;` | Viewport-relative control heights. The whole UI breathes with the window. | Replace with `px`/`rem` control-size tokens. `--control-height-md: 40px;`, `--control-height-sm: 32px;`, `--topbar-height: 40px;`. |
| Critical | `src/components/layout/AppLayout.tsx` L46–L80 | `#file-tree-panel`, `#task-list-column`, `#ai-sidebar-panel` | `width: ${fileExplorerWidth}vw; min-width: 10vw !important; max-width: 40vw !important;` | vw-based widths, no `clamp()`. | `var(--task-list-width)` (`clamp(280px, 24vw, 420px)`), `var(--right-panel-width)` (`clamp(360px, 32vw, 540px)`). |
| Critical | `src/components/layout/AppLayout.tsx` L98–L110 | `#main-row` | `display: flex; flex-1; h-full` with three flex children (centre / handle / right sidebar) | No `min-width: 0` on the centre, no min-width on right, no Grid template. When the right sidebar is at `vw` width, the centre panel can be crushed to 0. | Convert to `display: grid; grid-template-columns: minmax(0, 1fr) auto var(--right-panel-width);` (or `minmax(var(--main-panel-min-width), 1fr)`). |
| Critical | `src/components/layout/AppLayout.tsx` L86 | `#center-panel` | `style={{ minWidth: 260 }}` | Hardcoded `minWidth: 260` in JSX. No `min-width: 0` on the flex item, so the editor inside can overflow. | `min-width: 0;` and replace JSX with token (`var(--main-panel-min-width)`). |
| Critical | `src/components/layout/AppLayout.tsx` L70 | `#main-columns` | `min-w-0` is present, but the inner `#main-row` does not propagate it. | OK on the wrapper; needs propagation. | Keep wrapper, add `min-width: 0` and `min-height: 0` to `#main-row`. |
| Critical | `src/components/taskManager/TaskDetailPanel.tsx` L94–L196 | `#task-detail-panel`, `#tdc-thread`, comment input wrapper | `flex-col h-full` parent with `flex-1` thread and a sticky-bottom comment input, but the thread has no `min-height: 0` and the comment input is `position: sticky; bottom: 0`. | The sticky comment input is layered, not part of the flex flow, so the thread can still overflow into the header. | Restructure as `.panel > .panel-header / .panel-body (min-height: 0, overflow-y: auto) / .panel-footer (sticky OK)`. |
| Critical | `src/components/taskManager/TaskListPanel.tsx` L66–L120 | `#task-list-panel`, `#task-list-content` | `display: flex; flex-direction: column; min-height: 0; height: 100%` is set, but `#task-list-main-wrapper` sets `flex: 1 1 0; minHeight: 0` inline, and the content child has `flex: 1; height: 100%` which is a double-binding. | Scroll sometimes works, sometimes shows the wrapper scrolling instead of the inner content. | Restructure to a clean `.panel-body` with single `min-height: 0; overflow-y: auto`. |
| Critical | `src/components/sidebar/AISidebar.tsx` L46–L96 | `#ai-sidebar`, `#ai-sidebar-panel` | `flex flex-col h-full w-full overflow-h` | The AISidebar parent has `overflow: hidden`; the chat thread/empty-state inside has no explicit scroll, and the `ChatInput` composer is `height: fit-content` only. | Make the AISidebar a `.panel` with `.panel-body { min-height: 0; overflow-y: auto }` and a `.panel-footer` for the composer. |
| High | `src/index.css` L210–L222 | `#universal-header` | `position: fixed; top: 0; height: 36px;` | Header floats, not part of layout. Causes overlap with content top. | Fold into `.app-shell` Grid first row: `grid-template-rows: var(--topbar-height) 1fr`. |
| High | `src/index.css` L235, L3721 | `#app-content`, `.switcher-panel` | `height: 100vh;` in two places | Multiple shell-level `vh` to consolidate into one. | Single `100dvh` on `.app-shell`. The switcher must be content-sized. |
| High | `src/index.css` L1006, L1014, L3524, L3589, L4241, L4247 | `.file-viewer-content-image img`, `.file-viewer-content-video video`, `.model-provider-modal`, `.model-provider-modal @ 768px` | `max-height: calc(100vh - 120px);` and `max-height: calc(100vh - 32px);` | Image/video scaling and modal caps use `vh`. | Use `calc(100dvh - Npx)` or, for modals, use `max-height: var(--modal-max-height)` token. |
| High | `src/index.css` L3613 | `.confirm-overlay` | `padding-top: 8vw;` | `vw` for vertical padding — illegal, will look broken on tall vs wide windows. | `padding-top: 8vh` is also wrong target. Should be a token (`--space-8`) or `min(8vh, 80px)`. |
| High | `src/index.css` L107 | `.font-fluid-12..18` | `--font-fluid-12: clamp(5px, 0.5vw, 11px);` etc. | Font-size uses `vw` which makes text size dependent on width, not on viewport. Looks wrong in windowed tall windows. | Replace with viewport-agnostic `rem`/`px` typography tokens. |
| High | `src/index.css` L1979–L1990 | `.task-item` | `padding: clamp(4px, 0.5vw, 8px) clamp(6px, 0.85vw, 12px); height: clamp(40px, 3.2vw, 52px); margin-bottom: 0.3vw;` | Task card height + padding use `vw`. Will look squeezed on narrow windows and oversized on wide ones. | Replace with `var(--task-card-min-height)`, `var(--space-3)`, `var(--space-2)`. |
| High | `src/index.css` L888, L4135 | `.switcher-panel`, root prompt switcher | `width: 95vw;` | Modal width is `vw`. Use `min(95vw, 560px)` or a token. | `--modal-max-width: 560px; max-width: var(--modal-max-width);` |
| High | `src/components/sidebar/ChatInput.tsx` (and similar inline styles across many files) | Chat input composer | `height: fit-content;` and inline `style={{ height: 'var(--div-h-1)' }}` on the tool buttons | Uses `--div-h-1` (4vh) and ad-hoc inline heights. | Replace with `--control-height-sm/md/lg`. |
| High | `src/components/taskManager/TaskCommentInput.tsx` and surrounding | `#task-comment-card` | `height: 66px;` (hardcoded) | Hardcoded footer height — will not match new token system. | `--panel-footer-min-height: 72px;` and density shrink to 56/64. |
| High | `src/components/editor/EditorWorkspace.tsx` L98 | `#scroll-main` | `className="ai-scroll flex-1 overflow-y-a"` | The editor scroll container has `flex-1` and `overflow-y: auto`, but its parent `#editor-column` uses `min-width: 0` only because the column rule sets it. No `min-height: 0`. | Add `min-height: 0;` to `#editor-column` and `#scroll-main` so the editor scrolls internally, not the page. |
| High | `src/index.css` L2095 | `html, body, #root` does not set `overflow` on body | `body, #root { height: fit-content; }` | In some Chromium setups, body can re-show scrollbar if children overflow. | Add `body { overflow: hidden; }` once and never again. |
| High | `src/components/layout/AppLayout.tsx` overall | Resize handles (`LeftResizableHandle`, `CenterResizableHandle`) | Mouse-driven, write directly to vw in `uiStore` | Sizing logic stores `vw`, not pixels, and the user can drag past `min/max`. | Convert state to pixels, clamp to `min/max` from tokens; store both `px` and the corresponding `vw` if needed for fallback. |
| Medium | `src/components/fileExplorer/FileExplorerPanel.tsx` | Inner root | `style={{ display: 'flex', minHeight: 0 }}` and inline search `height: 32` | Uses ad-hoc `minHeight: 0` and `height: 32`. | Use token + `.panel` shell. |
| Medium | `src/components/header/Header.tsx`, `EditorTopBar.tsx` | Tab buttons | `height: var(--div-h-1)` (4vh) for all tab buttons | All tab heights depend on `vh`. | `--topbar-height` token, fixed `px`/`rem`. |
| Medium | `src/index.css` L1232, L1235, L1264, L2857, L3312, L3760, L5959 | Various | `position: absolute;` | Used for floating labels / popovers. With `position: relative` parents that are flex items without `min-height: 0`, positioning context is the wrong element. | Audit each; for sticky internal labels, use `position: sticky` inside a scrolling `.panel-body`. |
| Medium | `src/index.css` L1347, L1147 | `#task-comment-thread`, `tabs-row`, `#filetree-list` | `overflow-y: scroll !important; overflow-x: scroll !important;` | `scroll` instead of `auto` — always shows scrollbar even when not needed. | Use `auto`. |
| Medium | `src/index.css` L409, L410, L573, L711, L890, L991, L999, L1044, L1296, L1314, L1394, L1711, L1724, L1729, L1740 | `overflow` (all classes) | Mixed `overflow: hidden`, `overflow: auto`, `overflow: hidden` with no `min-height: 0` | Many panels/components set `overflow: hidden` but no `min-height: 0` on the same element or its parent. | When adding a `.panel-body`, always pair `overflow-y: auto` with `min-height: 0`. |
| Low | `src/index.css` L191, L292, L361, L386, L399, L454, L524, L543, L581, L735, L765, L818, L827, L856, L891, L899, L907, L917, L925, L932, … | Dozens of `display: flex` declarations | Many are correct, but a few flex containers host shrinking children with no `min-height: 0`. | Track per-case during panel migration. |
| Low | `src/components/editor/SelectionToolbar.tsx` | inline `position` styles | Likely `position: absolute` / `fixed` | Worth a quick look; not surfaced in this scan. | Confirm during Agent 5. |
| Low | `src/components/header/Tab.tsx`, `TabBar.tsx` | tab content | `max-width: 180px;` per tab | OK constant, but tabs use `--div-h-1` for height. | Map height to token. |
| Low | `src/themes/cyberpunk.css` L655 | `overflow: hidden;` | Unrelated to layout | OK | None. |

---

## Viewport Unit Usage

### `100vh` (shell-level, critical)
| File | Line | Selector | Use | Classification |
|---|---|---|---|---|
| `src/index.css` | 235 | `#app-content` | `height: 100vh` | **Should become `100dvh`** (shell) |
| `src/index.css` | 3721 | `.switcher-panel` | `height: 100vh` (centered modal) | **Should be removed** — modal must be content-sized with `max-height: var(--modal-max-height)` |
| `src/components/aiChat/StandaloneAiChatPanelDemo.tsx` | 106 | inline style | Demo root only | **Review** (not used in main app) |
| `src/components/pageTemplate/pageTemplate.css` | 219 | `.reusable-page-template__preview-root` | Demo only | **Review** (not used in main app) |

### `100vw` and `vw` for sizing
| File | Line | Selector | Use | Classification |
|---|---|---|---|---|
| `src/index.css` | 65–68 | `--font-fluid-*` | `clamp(...,Xvw,...)` font tokens | **Should become `rem`/`px`** |
| `src/index.css` | 888 | `.switcher-panel` | `width: 95vw;` | **`clamp()` or fixed token** |
| `src/index.css` | 107, 1130, 1131, 4326, 4327 | `#file-tree-panel` | `min-width: 10vw !important; max-width: 40vw !important;` | **Should become tokens** (`clamp(260px, 30vw, 360px)`) |
| `src/index.css` | 3522, 3587 | `.model-provider-modal` | `max-width: calc(100vw - 32px);` | **Should become `min(100vw - 32px, 920px)` or token** |
| `src/index.css` | 3613 | `.confirm-overlay` | `padding-top: 8vw;` | **Should be a vertical token, not vw** |
| `src/index.css` | 3633, 3698 | `.model-provider-modal` (inside `@media (max-width: 768px)`) | `max-width: calc(100vw - 32px);` | Same as above |
| `src/index.css` | 4135 | prompt switcher | `width: 95vw;` | **`clamp()` or fixed token** |
| `src/index.css` | 1979–1990 | `.task-item` | `padding: clamp(4px, 0.5vw, 8px) …; height: clamp(40px, 3.2vw, 52px); margin-bottom: 0.3vw;` | **Should become `px`/`rem` tokens** |
| `src/index.css` | 4837, 4841 | `.task-item` (in `:root #task-list-content`) | Same `vw`-based pattern as 1979 | **Should become `px`/`rem` tokens** |
| `src/components/layout/AppLayout.tsx` | 47, 64, 78, 99, 109 | `#settings-panel-column`, `#file-tree-panel`, `#task-list-column`, `#ai-sidebar-panel` | `width: \`${X}vw\`; max-width: '40vw'; min-width: '15vw';` | **Should become tokens** (`var(--task-list-width)`, `var(--right-panel-width)`) |

### `dvh` / `svh` / `lvh`
- **None found.** Good — clean slate for `100dvh` introduction.

### `calc(100vh - Npx)`
| File | Line | Use | Classification |
|---|---|---|---|
| `src/index.css` | 1006 | `.file-viewer-content-image img` `max-height: calc(100vh - 120px);` | Should become `calc(100dvh - 120px)` |
| `src/index.css` | 1014 | `.file-viewer-content-video video` `max-height: calc(100vh - 120px);` | Same |
| `src/index.css` | 3524, 3589, 3698, 3700 | `.model-provider-modal` `max-height: calc(100vh - 32px);` | Same |
| `src/index.css` | 4241, 4247 | `.file-viewer-content-image img` (in `:root` block) | Same |
| `src/components/aiChat/StandaloneAiChatPanel.tsx` (likely) | – | image preview cap | Same |
| `src/index copy.css` | (mirror of above) | duplicates | (legacy file — should be removed in this migration) |

---

## Fixed Height / Width Usage

| File | Selector | Value | Role | Classification |
|---|---|---|---|---|
| `src/index.css` L210 | `#universal-header` | `height: 36px;` | Top bar | **Should become token** (`--topbar-height: 40px;`) |
| `src/index.css` L1130 | `#file-tree-panel` | `min-width: 10vw !important;` | Panel min | **Token** (`--task-list-min-width: 260px`) |
| `src/index.css` L1131 | `#file-tree-panel` | `max-width: 40vw !important;` | Panel max | **Token** (`--task-list-max-width: 420px`) |
| `src/index.css` L1140 | `#filetree-tabs` | `height: 46px;` | File tree header | **Token** (panel header) |
| `src/index.css` L1176 | `.filetree-search` | `height: 32px;` | Search input | **Token** (`--control-height-sm`) |
| `src/index.css` L1214 | `.filetree-search-input` | `height: 28px;` | Search inner | **Token** (control height) |
| `src/index.css` L1283, L1284 | `.filetree-tab` | `height: 30px;` | Tab button | **Token** |
| `src/index.css` L1381 | `.tbar-btn` | `width/height: var(--div-h-1)` | Toolbar button | **Token** (control-md) |
| `src/index.css` L1410 | `.toolbar-strip` | `height: 30px;` | Toolbar | **Token** |
| `src/index.css` L1437 | `.editor-topbar` | `height: 34px;` | Top bar | **Token** (sub-header) |
| `src/index.css` L1556 | `.file-viewer-header` | `height: 42px;` | File viewer header | **Token** (panel header) |
| `src/index.css` L1607 | `.file-viewer-content-image img` | `max-height: calc(100vh - 120px);` | Image | **Token / `100dvh`** |
| `src/index.css` L1986 | `.task-item` | `height: clamp(40px, 3.2vw, 52px);` | Task card | **Token** (`--task-card-min-height`) |
| `src/index.css` L2080 | `.tabs-row` | `height: 100%;` (of `#header-bar`) | OK, but parent height is `vh` | Fix parent first |
| `src/index.css` L2408 | `.chat-textarea` | `min-height: 24px; max-height: 192px;` | Composer | **Tokens** (control-sm to text-area-max) |
| `src/index.css` L2575, L2585 | `.tabs-dropdown-toggle` | `width: 182px; height: 32px;` | Dropdown | **Token** |
| `src/index.css` L2968 | `.chat-input-card` / `.chat-input-root` | `height: 66px;` | Composer card | **Token** (panel footer) |
| `src/index.css` L3509 | `.overlay` | `position: fixed; inset: 0;` | Modal backdrop | OK; will become `100dvh` indirectly |
| `src/index.css` L3519 | `.model-provider-modal` | `width: 920px; max-width: calc(100vw - 32px);` | Modal | **Token** (modal-max-width) |
| `src/index.css` L3606, L3616 | `.confirm-box`, `.confirm-overlay` | `width: 90%; max-width: 400px; padding-top: 8vw;` | Confirm | **Token / no vw** |
| `src/index.css` L3621 | `.toast-container` | `position: fixed; bottom: 24px; right: 24px;` | Toasts | OK (corner-anchored) |
| `src/index.css` L3721 | `.switcher-panel` | `width: 95vw; max-width: 560px; max-height: 80vh;` | Command switcher | **Tokens** |
| `src/components/layout/AppLayout.tsx` L86 | `#center-panel` | `style={{ minWidth: 260 }}` | Centre min | **Token** |
| `src/components/layout/AppLayout.tsx` L99, L109 | `#ai-sidebar-panel` | `width: ${sidebarWidth}vw; maxWidth: '40vw';` | Right column | **Tokens** |
| `src/components/taskManager/TaskDetailPanel.tsx` L138 | comment-input wrapper | `position: 'sticky'; bottom: 0;` | Sticky footer | OK as sticky; pair with `.panel-body { min-height: 0 }` |
| `src/components/sidebar/ChatInput.tsx` L48 | `MAX_HEIGHT` | `192` (px) | Composer max | **Token** |
| `src/components/sidebar/ChatInput.tsx` and others | `style={{ height: 'var(--div-h-1)' }}` | 4vh | Buttons | **Token** |

---

## Scroll Behavior Audit

| Element | Current scroll | Should be | Comment |
|---|---|---|---|
| `html` | default (scrolls) | never | Body lock should prevent. |
| `body` | **not explicitly locked** | `overflow: hidden` | **Missing.** Add during Agent 3. |
| `#app-content` | `overflow: hidden` | `overflow: hidden` | OK as the shell overflow root. |
| `#main-columns` | `overflow-h` (= `overflow: hidden`) | `overflow: hidden` | OK wrapper, but children must scroll. |
| `#main-row` | `overflow-h` | `overflow: hidden` | OK. |
| `#center-panel` | `overflow-h` | `overflow: hidden` | OK. |
| `#scroll-main` (editor) | `overflow-y: auto` via `.ai-scroll` | internal scroll | Needs `min-height: 0` on `#editor-column`. |
| `#task-list-panel` | `flex-col h-full overflow: hidden` | internal scroll | OK wrapper, scroll on body. |
| `#task-list-content` | `ai-scroll overflow-y-a` (auto) | internal scroll | Scroll works but inconsistently. |
| `#filetree-list` | `overflow-y: scroll !important;` | internal scroll | Use `auto` (over-eager scrollbar). |
| `#ai-sidebar` | `overflow: hidden` | `overflow: hidden` | OK. |
| `#ai-sidebar-panel` | (no explicit overflow) | internal scroll | **Missing** — the AISidebar uses an empty-state or ChatThread; both need their own overflow. |
| `#chat-input-card` | (no scroll) | internal scroll only when overflowing content | OK, composer self-sizes. |
| `#task-detail-panel` | `flex-col h-full` | internal scroll on thread | Thread has `flex-1` but no `min-height: 0`; comment-input is sticky-bottom. |
| `#tdc-thread` | `flex-1 overflow-y-a` | internal scroll | Needs `min-height: 0`. |
| Modals (`.overlay`) | none on root (fixed) | n/a | OK. |
| `.switcher-panel` | `overflow: hidden` | `overflow-y: auto` if content > height | OK but height is `100vh` — needs reworking. |
| `body` (in styles.Confirm, .toast) | none | n/a | OK (toast is fixed). |
| `body` on settings/auth gate | `position: fixed; inset: 0; overflow-y: auto;` on `.auth-gate` | full-screen scrollable | OK, but the parent `body` should not scroll while this is open. |

### Future target scroll model

```css
body { overflow: hidden; }
.app-shell { overflow: hidden; }
.panel { overflow: hidden; min-width: 0; min-height: 0;
         display: flex; flex-direction: column; }
.panel-body { min-height: 0; overflow-y: auto; overflow-x: hidden; }
.panel-footer { flex: 0 0 auto; min-height: var(--panel-footer-min-height); }
```

---

## Panel Mapping

| Current Component / Selector | Future Role | Notes |
|---|---|---|
| `<div id="nav-bar">` (`LeftNarrowSidebar`) | Shell-level icon rail (not a `.panel`) | Fixed narrow width, no scrolling. |
| `<div id="file-tree-panel">` (in `AppLayout`) | `.panel` (left file explorer) | Min-width from `--task-list-min-width`. |
| `<div id="filetree-tabs">` (in `FileExplorerPanel`) | `.panel-header` | Height: `--panel-header-height`. |
| `<div role="search" id="filetree-search">` | header sub-row | Sits inside header. |
| `<div id="filetree-list">` (or its scroll parent) | `.panel-body` | Scroll internal. `min-height: 0`. |
| `<div id="task-list-column">` (in `AppLayout`) | `.panel` (left task list) | Min/max from tokens. |
| `<div id="task-list-panel">` (in `TaskListPanel`) | `.panel` body wrapper | Becomes the panel container. |
| `<div id="task-list-header">` | `.panel-header` | `--panel-header-height`. |
| `<div id="task-list-content">` | `.panel-body` | Internal scroll. |
| `<div id="task-quick-create">` (in `TaskListPanel`) | `.panel-footer` | `--panel-footer-min-height`. |
| `<div id="center-panel">` (in `AppLayout`) | `.panel` (centre) | Min `var(--main-panel-min-width)`. |
| `<SubtasksToggleBar />` | `.panel-header` (or part of editor header) | Height: `--panel-header-height`. |
| `<div id="editor-column">` / `<div id="editor-card-wrapper">` | centre `.panel-body` | Internal scroll. `min-height: 0`. |
| `<div id="scroll-main">` | inner scroll viewport (within editor body) | Already scrolls. |
| `<SelectionToolbar />` | floating, no panel role | Keep. |
| `<div id="ai-sidebar-panel">` (in `AppLayout`) | `.panel` (right AI) | Width `var(--right-panel-width)`. |
| `<RightPanelSubheader />` (`.right-panel-subheader`) | `.panel-header` | `--panel-header-height`. |
| `<ChatThread />` (or empty state) inside AISidebar | `.panel-body` | Internal scroll. `min-height: 0`. |
| `<ChatInput />` inside AISidebar | `.panel-footer` | `--panel-footer-min-height`. |
| `<div id="file-viewer-panel">` | `.panel` (right file viewer) | Same role as AI sidebar when active. |
| `<div id="file-viewer-header">` | `.panel-header` | Already 42 px. |
| `<div id="file-viewer-content">` | `.panel-body` | Already `flex: 1; min-height: 0; overflow: hidden`. |
| `<div id="task-detail-panel">` | `.panel` (right task details) | Currently only in `taskMode`. |
| `<div id="tdc-title">`, `<div id="tdc-subtasks">` | `.panel-header` content | Inside detail panel. |
| `<div id="tdc-thread">` | `.panel-body` | Internal scroll. `min-height: 0`. |
| bottom comment input wrapper | `.panel-footer` | Sticky-bottom or fixed flex item. |
| `<div id="chat-header">` | `.panel-header` (for AI sidebar) | Already a header. |
| `<div id="scroll-ai">` | inner scroll viewport | OK. |
| `<div id="chat-empty-state">` | centre of empty body | Cosmetic; OK. |
| `<div id="confirm-box">`, `<div id="model-provider-modal">` | modal (not a panel) | Continue using `.overlay` + `max-height: var(--modal-max-height)`. |
| `<div class="auth-gate">` | full-screen overlay (not a panel) | Position fixed; OK. |
| `<div class="toast-container">` | floating | OK. |
| `<div id="universal-header">` | first row of `.app-shell` grid | Currently `position: fixed`; should be grid row. |
| `<div id="right-nav-bar">` (`RightNarrowSidebar`) | shell-level narrow rail (not a `.panel`) | `display: none` in current code; revisit during shell migration. |
| Page Template sections (`.reusable-page-template__section--header/main/footer`) | reference pattern for `.panel` primitives | Already correct shape — use as the model. |

---

## Component Token Replacement Candidates

| Component / Selector | Current Value | Suggested Token |
|---|---|---|
| All `--div-h-1` (4vh) usages (header, tbar-btn, side-nav-tab, file-viewer-close-btn, task-list-tab, chat-input-bottom-col--tools, calendar-month-btn, calendar-day-btn, project-group-btn, tab-close, ai-toggle-btn, ai-chat-icon-btn, tabs-dropdown-close, tab-plus-button) | `4vh` | `var(--control-height-sm)` or `var(--control-height-md)` |
| `--div-h-2` on `#task-list-content button` | `7vh` | `var(--control-height-lg)` or component-specific token |
| `--div-h-3` (declared) | `10vh` | n/a (unused in scan results) |
| `#universal-header { height: 36px }` | fixed `36px` | `var(--topbar-height)` |
| `#task-list-header { height: var(--div-h-1) }` | `4vh` | `var(--panel-header-height)` |
| `#filetree-tabs { height: 46px }` | `46px` | `var(--panel-header-height)` (48/42) |
| `#file-viewer-header { height: 42px }` | `42px` | `var(--panel-header-height)` |
| `#editor-topbar { height: 34px }` | `34px` | `var(--editor-topbar-height)` |
| `.toolbar-strip { height: 30px }` | `30px` | `var(--toolbar-height)` |
| `.filetree-search { height: 32px }` | `32px` | `var(--control-height-sm)` |
| `.filetree-search-input { height: 28px }` | `28px` | `var(--control-height-xs)` |
| `.filetree-tab { height: 30px }` | `30px` | `var(--control-height-sm)` |
| `.task-item { height: clamp(40px, 3.2vw, 52px) }` | `vw` | `var(--task-card-min-height)` |
| `.task-item { padding: clamp(4px, 0.5vw, 8px) clamp(6px, 0.85vw, 12px) }` | `vw` | `var(--space-2)` / `var(--space-3)` |
| `.task-item { margin-bottom: 0.3vw }` | `vw` | `var(--space-2)` |
| `.chat-input-card { height: 66px }` | `66px` | `var(--panel-footer-min-height)` (with density override) |
| `#chat-input { height: 32px }` | `32px` | `var(--control-height-sm)` |
| `#chat-textarea { min-height: 24px; max-height: 192px }` | `px` | `var(--control-height-xs)` / `var(--composer-max-height)` |
| `.composer-row { min-height: 44px }` | `44px` | `var(--control-height-lg)` |
| `.composer-input { height: 28px }` | `28px` | `var(--control-height-xs)` |
| `.tabs-dropdown-toggle { width: 182px; height: 32px }` | `px` | `var(--tabs-dropdown-width)` / `var(--control-height-sm)` |
| `.switcher-panel { width: 95vw; max-width: 560px; max-height: 80vh }` | `vw`, `vh` | `var(--modal-max-width)` / `var(--modal-max-height)` |
| `.model-provider-modal { width: 920px; max-height: calc(100vh - 32px) }` | `px`, `vh` | `var(--modal-max-width)` / `calc(var(--modal-max-height) - 32px)` |
| `.file-viewer-content-image img, video { max-height: calc(100vh - 120px) }` | `vh` | `calc(100dvh - 120px)` |
| `.btn { font-size: var(--fs-base); padding: 6px 12px; ... }` | `px` | tokens (already tokenized) |
| `.btn-icon { ... padding: 0; ... }` | none | OK as-is. |
| `.filetree-bc-label, .editor-bc-label { font-size: var(--fs-base) }` | token | OK. |
| `.task-item .meta, .task-item .subtle, .tiptap-editor p { font-size: var(--fs-base) }` | token | OK. |
| `.task-dot-low, .task-dot-medium, .task-dot-high { width/height: 6px }` | `6px` | `var(--dot-size)` (small, low-risk) |
| `.subtask-status-btn { width/height: 12px }` | `12px` | `var(--icon-size-sm)` |
| `.subtask-status-btn svg { width/height: 10px }` | `10px` | `var(--icon-size-xs)` (introduce) |
| `.tab-close { width/height: var(--div-h-1) }` | `4vh` | `var(--control-height-sm)` |
| `.right-panel-subheader { height: var(--div-h-1) }` | `4vh` | `var(--panel-header-height)` |
| `.tbar-btn { width/height: var(--div-h-1) }` | `4vh` | `var(--control-height-sm)` |
| `.tbar-btn svg { width: 12px; height: 12px }` | `12px` | `var(--icon-size-sm)` |
| `.btn-send svg { width: 14px; height: 24px }` | `px` | tokens |
| `.tabs-doc-marker { width/height: 8px }` | `8px` | `var(--dot-size)` (or keep) |
| `#tab-plus-button svg { width/height: 12px; font-size: 13px }` | `px` | `var(--icon-size-sm)` |
| `#tab-plus-button { height/width: var(--div-h-1) }` | `4vh` | `var(--control-height-sm)` |
| `.tabs-row > .tab-active, .tabs-row > .tab-passive { max-width: 180px }` | `180px` | `var(--tab-max-width)` |
| `.tabs-row[data-overflowing="true"] > :last-child:not(.tabs-new-btn) { min-width: 56px; max-width: 64px }` | `px` | `var(--tab-overflow-min-width)` / `var(--tab-overflow-max-width)` |
| `#right-nav-bar { width: 34px !important; }` | `34px` | `var(--sidebar-width)` (36px target) |
| `.header-toggle { width/height: var(--div-h-1) }` | `4vh` | `var(--control-height-sm)` |
| `.subtask-title { font-size: var(--fs-base); line-height: 1.4; }` | token | OK. |
| `.comment-bubble { border-radius: 8px; ... }` | `8px` | `var(--radius-md)` |
| `.media-thumb { border-radius: 8px; ... }` | `8px` | `var(--radius-md)` |
| `.ai-chat-top-bar { height: 32px; ... }` | `32px` | `var(--control-height-sm)` |
| `.calendar-day-card { border-radius: 8px; }` | `8px` | `var(--radius-md)` |

---

## Responsive Breakpoint Audit

### Existing media queries

| File | Line | Query | Affected selectors | Purpose | Notes |
|---|---|---|---|---|---|
| `src/index.css` | 3584 | `@media (max-width: 768px)` | `.model-provider-modal` | Modal becomes full-width on mobile | Only this single breakpoint in the entire CSS. Will need expansion in Agent 4/7. |
| `src/index copy.css` | 3695 | `@media (max-width: 768px)` | (mirror) | mirror | Legacy file. |
| `src/themes/cyberpunk.css` | – | none | – | – | – |
| `src/components/pageTemplate/pageTemplate.css` | – | none | – | – | – |
| All `.tsx`/`.ts` | – | none inline | – | – | – |

**Observations:**

- The codebase has effectively **one breakpoint** (768 px) and it is used only for the model provider modal. There are **no height-based breakpoints**.
- There is no `clamp()`-driven width collapse for the workspace columns.
- The task list, AI sidebar, and editor use **fixed `vw` widths and `vh` heights**, so the app does not currently respond to viewport changes gracefully. Resizing the browser window changes the column widths linearly (`vw`) and the control heights linearly (`vh`), which is a brittle scaling model.
- The right side rail is `display: none` (always), so there is no sidebar collapse to model after.
- The future breakpoint plan (per `plan.md`):
  - `< 1280 px` — hide right detail/AI panel; reduce task list.
  - `< 900 px` — hide task list; keep sidebar + main content.
  - `max-height: 720/620 px` — density mode (token overrides).

### Conflicts with future token system
- The current `768 px` breakpoint for modal full-width is fine but should be expressed as a named token (`--bp-md`) for consistency.
- The current `vw`-driven columns will conflict with the future Grid system unless removed. They are the most important responsive migration target.

---

## Recommended Migration Order

1. **Token Architect (Agent 2):** Create `src/styles/tokens.css`, `density.css`, `layout.css` with all tokens listed above. Import them after `index.css` so they take precedence via the cascade or via `:root` override blocks. Do not change any existing rule.
2. **App Shell (Agent 3):** Update `index.css` so `#app-content` (or a new `.app-shell` class) uses `height: 100dvh;` and `body { overflow: hidden; }`. Fold `#universal-header` into the shell grid (`grid-template-rows: var(--topbar-height) 1fr;`). Remove the `position: fixed` header.
3. **Workspace Grid (Agent 4):** Convert `#main-row` (and its parent `#main-columns`) to a Grid template using `--task-list-width`, `minmax(var(--main-panel-min-width), 1fr)`, and `--right-panel-width`. Add `min-width: 0; min-height: 0;` to the workspace and all panel children. Convert `AppLayout.tsx` inline `vw` widths to tokens. Add breakpoint rules for `<=1280px` and `<=900px` collapse.
4. **Panel Primitive (Agent 5):** Standardize file-tree, task list, editor, AI sidebar, file viewer, and task detail into `.panel > .panel-header / .panel-body / .panel-footer`. Replace `overflow: hidden` on the panel root with internal scroll. Add `min-height: 0` everywhere scroll is internal.
5. **Component Token Replacement (Agent 6):** Replace `--div-h-*` references with `--control-height-*`. Replace `clamp(...,Xvw,...)` font-size, padding, height, margin, gap values with tokens. Replace `font-fluid-*` tokens with `rem`/`px` typography tokens. Replace `max-height: calc(100vh - Npx)` with `calc(100dvh - Npx)` and/or modal max-height tokens.
6. **Responsive Behavior (Agent 7):** Add the planned breakpoints. Hide right panel at `<=1280px` and task list at `<=900px`. Add density overrides for short viewports.
7. **Container Queries (Agent 8):** Add `container-type: inline-size;` to `.task-list-panel`, `#chat-input-card`, `.task-item`, `.comment-bubble`. Add `@container` rules to hide secondary metadata at small widths.
8. **Visual QA (Agent 9):** Test at 1920×1080, 1600×900, 1440×900, 1366×768, 1280×720, 1024×768, 900×700, 800×600.
9. **Regression Review (Agent 10):** Confirm zero remaining `vh` (except shell) and zero `vw` in component sizing.

---

## Do Not Touch Yet

- **`index copy.css`** — this is a legacy duplicate of `index.css`. Not imported by `main.tsx`. Should be deleted in a cleanup commit after the migration, but not part of this audit's responsibility.
- **Theme override blocks** (`:root` re-declarations near the bottom of `index.css` L4000+) — these are re-applying the same values; during Agent 2 they should be reviewed, but not during this audit.
- **Visual identity tokens** (`--c-rainbow-*`, `--c-background-*`, etc.) — out of scope; layout audit only.
- **App logic, state, and stores** — strictly forbidden by the prompt.
- **Component renames** — not in scope; `AppLayout`, `LeftNarrowSidebar`, `TaskListPanel`, `AISidebar`, etc. keep their names.
- **Drawer/sheet implementation** — only prepare class hooks (`detail-panel--drawer`, `task-list-panel--drawer`); do not implement.

---

## Open Questions

1. **Should `--div-h-1` (4vh) become a fixed `40px` token, or a `clamp()` that only changes in density mode?** The plan says `--control-height-md: 40px`, which suggests a fixed value. Confirm before Agent 2.
2. **What is the desired behavior for the `#universal-header` after the migration?** It is currently `position: fixed; height: 36px;`. Should it become the first row of `.app-shell` (as in the plan), or stay fixed? The plan implies grid, but a fixed floating header has a different visual feel — needs product decision.
3. **`RightNarrowSidebar` is `display: none`.** Should it remain hidden permanently (icon rail only on the left), or do we plan to expose it in the future? The `display: none` currently hides it in all viewports, but a left-side icon rail already exists.
4. **`fileExplorerWidth` and `sidebarWidth` in `uiStore` are stored as `vw` numbers.** Should they be migrated to pixels and computed against a fixed reference width, or should the store continue to express them as `vw`? Pixel storage is safer; vw is dynamic and silently breaks when window resizes.
5. **`min-width: 10vw !important` and `max-width: 40vw !important` on `#file-tree-panel`** are derived from `vw`. Should the future min/max be `clamp(260px, 30vw, 360px)` style, or fixed pixels?
6. **`--div-h-2` (7vh) is applied via `#task-list-content button` to override generic `button` height.** After the migration, should task list buttons be a dedicated component class (e.g. `.task-card`) with their own height token, instead of overriding a global button rule?
7. **`font-fluid-*` tokens** currently scale text with viewport width. Removing them may change the perceived text size in windowed mode (typically larger windows). Is that acceptable? Recommend dropping them; recommend `rem`/`px`.
8. **`pageTemplate.css` preview uses `100vh`.** This is a standalone preview, not the live app. Should it be migrated to `100dvh` for consistency, or left alone? Recommend migrating for consistency.
9. **Auth gate (`position: fixed; inset: 0`)** currently uses `overflow-y: auto` so the form can scroll. With the future `body { overflow: hidden }`, will the auth gate still be scrollable? It is `position: fixed`, so yes — but confirm during the migration.
10. **Density breakpoints at `max-height: 720px` and `620px`**: should they be triggered by the `body`'s height (which is `100dvh` after the migration), or by `min-height: 0`/`max-height` queries? Recommend the former, with media queries on the shell.
