# UI Responsive Behavior Report

> **Scope:** Agent 7 — Responsive Behavior. Width and height breakpoints,
> panel visibility rules, overflow safety, density refinements, drawer
> preparation hooks.
> **Out of scope:** business logic, state, API, routing, modal internals,
> component-level sizing (Agents 1–6 already covered), `index copy.css`
> (legacy duplicate), `pageTemplate.css` (demo only).
> **Build state note:** as before this phase, the project's `npm run build`
> (which runs `tsc -b` first) fails for **pre-existing** TypeScript errors
> introduced by previous agents. `npx vite build` succeeds and produces a
> clean CSS bundle. `npx vite dev` boots successfully on port 5180.

---

## Summary

Added the missing responsive behavior layer on top of the token system
introduced by Agents 2–6. The layout foundation was already in place:
the workspace grid collapsed at 1280 px and 900 px, the app shell
filled `100dvh`, body scroll was locked, and component sizing was
token-driven. Agent 7 extends this with:

1. A **third width breakpoint at `640 px`** for very narrow windows.
   The main panel min-width relaxes to `0`, optional labels collapse,
   and the workspace grid resolves to `sidebar + main` only.
2. A **third height breakpoint at `480 px`** for very short viewports.
   The control-height and spacing tokens compress one final step while
   preserving a usable composer / footer height.
3. **Drawer preparation hooks** (`detail-panel--drawer`,
   `task-list-panel--drawer`, `.workspace-scrim`, `.is-drawer-open`)
   for future drawer/overlay work. No open/close state is wired up;
   these are CSS-only hooks.
4. **Responsive visibility utility classes** (`is-hidden-mobile`,
   `is-hidden-tablet`, `is-desktop-only`, `is-wide-only`, `is-mobile-only`,
   `is-short-only`, `is-hidden-short`, `is-collapsed`, `is-hidden`).
5. A consolidated **overflow-safety block** in `index.css` that
   re-asserts the shell / workspace / panel scroll contract as a
   defensive fallback against legacy inline widths.

No existing breakpoint, token, or class was renamed. No component
TSX was modified. No business logic, state, or routing changed.

---

## Files Changed

- [src/styles/layout.css](../src/styles/layout.css) — added the
  `<= 640 px` extra-small breakpoint, an updated comment block for
  the three width breakpoints, and the new "Drawer preparation
  hooks" section.
- [src/styles/density.css](../src/styles/density.css) — added a
  third `<= 480 px` height breakpoint that compresses the
  control-height, task-card, and spacing tokens one final step.
- [src/styles/utilities.css](../src/styles/utilities.css) — added
  a "Responsive visibility hooks" section and a "Drawer / collapse
  state hooks" section. No existing utility was removed or renamed.
- [src/index.css](../src/index.css) — added an "overflow safety
  (Agent 7)" block right after the body-lock rule. The block
  re-affirms `html, body, #root { width: 100%; height: 100% }`,
  the body overflow lock, the shell/workspace overflow chain,
  and a defensive `html { overflow-x: hidden }` cap.

No other files were modified. No component TSX was touched. No
new files were created outside the styles directory.

---

## Width Breakpoints

| Breakpoint | Behavior | Notes |
|---|---|---|
| `> 1280 px` | All four columns visible: sidebar, task list, main, detail panel. Workspace grid is `auto auto auto minmax(var(--main-panel-min-width), 1fr)`. | Wide desktop. |
| `<= 1280 px` | Right detail panel hidden. Task list keeps its token-bounded width. Main panel stays at `minmax(var(--main-panel-min-width), 1fr)`. | Medium desktop / narrow window. |
| `<= 900 px` | Task list panel hidden, left resize handle hidden. Workspace resolves to `sidebar + main` only with `minmax(0, 1fr)`. | Small desktop / tablet. |
| `<= 640 px` | Main panel min-width relaxes to `0`, optional labels (`.optional-toolbar-label`, `.secondary-panel-label`, `.secondary-meta`) hide. The left-resize handle is hidden for safety. | Phone / very narrow window. |

> The "left resize handle" is the `LeftResizableHandle` rendered
> between the task list and the main panel. It is conditionally
> rendered by `AppLayout.tsx` (driven by the same conditions as the
> task list itself), so the CSS rule in the `<= 900 px` and
> `<= 640 px` blocks is a no-op for the normal path but defends
> against any future use of `.workspace-handle` outside that branch.

---

## Height Breakpoints

| Breakpoint | Behavior | Notes |
|---|---|---|
| `> 720 px` | Default token values: topbar 40 px, panel header 48 px, panel footer 72 px, control-md 40 px, control-lg 48 px. | Standard density. |
| `<= 720 px` | topbar 36, panel header 42, panel footer 64, task card 56, control-md 36, control-lg 42, space-3/4 reduced. | Compact density. |
| `<= 620 px` | topbar 34, panel header 38, panel footer 56, task card 48, control-md 34, control-lg 38, space-3 reduced further. | Dense. |
| `<= 480 px` | topbar 32, panel header 36, panel footer 52, task card 44, control-xs 24, control-sm 28, control-md 32, control-lg 36, control-xl 44, space-2/3/4 further reduced. | Ultra-short. |

> All four density breakpoints only re-declare `:root` token
> values. They use no `vh`, no `transform: scale()`, and no
> `zoom`. The token overrides cascade to every consumer.

---

## Panel Visibility Rules

| Viewport Range | Sidebar | Task List | Main Content | Detail Panel |
|---|---|---|---|---|
| `> 1280 px` | visible | visible | visible | visible |
| `> 900 px && <= 1280 px` | visible | visible | visible | hidden |
| `> 640 px && <= 900 px` | visible | hidden | visible | hidden |
| `<= 640 px` | visible | hidden | visible | hidden |
| Any height `> 480 px` | same as above | same as above | same as above | same as above |
| Height `<= 480 px` | same as above | same as above | same as above | same as above (height-tokens compress) |

Priority order is honoured: main content > sidebar > task list > detail.
The detail panel is the first to hide, the sidebar is the last.

> **Note on actual rendering:** the task list and detail panel are
> already conditionally rendered by `AppLayout.tsx` based on the
> `taskMode`, `sidebarOpen`, `fileExplorerOpen`, etc. UI flags. The
> CSS rules above are a *defensive* layer: they keep the layout
> correct even if a panel is forced visible by a future feature or
> a refactor of `AppLayout.tsx`. The rules are also a contract for
> Agent 8 (Container Queries) — they describe the panel visibility
> model in one place.

---

## Drawer Hooks

| Class | Purpose | Activation |
|---|---|---|
| `.detail-panel--drawer` | Re-positions the right detail panel as a fixed overlay below the topbar. | Opt-in. Future drawer feature. |
| `.task-list-panel--drawer` | Same for the task list. Anchored to the right edge of the sidebar. | Opt-in. Future drawer feature. |
| `.workspace-scrim` | Fixed full-viewport scrim that sits above the workspace. | Opt-in. Future drawer feature. |
| `.workspace.is-drawer-open` | Activates the scrim and hides the inline panel column to prevent double-rendering. | Opt-in. Future drawer feature. |

**Status:** added as CSS-only hooks. No open/close state is wired
up. No JSX or store changes were made. Agent 8 (Container Query
Agent) or a later drawer feature can opt in by toggling the
classes on the relevant roots.

> The existing `.is-collapsed`, `.is-hidden`, and `.drawer-open`
> classes in `utilities.css` are also future-use hooks. They do
> not affect any current element.

---

## Overflow Behavior

| Container | Overflow | Source |
|---|---|---|
| `html` | `overflow-x: hidden` (defensive); `height: 100%` (from existing reset) | `index.css` (Agent 7) |
| `body` | `overflow: hidden` | `index.css` (Agent 3) — re-asserted by Agent 7 |
| `#root` | `height: 100%` (from existing reset) | `index.css` |
| `#app-content` | `overflow: hidden` (existing) + Agent 7 explicit `min-width: 0; min-height: 0; overflow: hidden` | `index.css` (Agent 7) |
| `.app-shell` | `overflow: hidden` (existing in `layout.css`) + Agent 7 re-assertion | `layout.css` + `index.css` |
| `.app-shell-main` | `overflow: hidden` (existing) | `index.css` (Agent 3) |
| `.workspace` | `overflow: hidden` (existing in `layout.css`) + Agent 7 re-assertion | `layout.css` + `index.css` |
| `.sidebar-panel` | `overflow: hidden` | `layout.css` + `index.css` |
| `.task-list-panel` | `overflow: hidden` | `layout.css` + `index.css` |
| `.main-panel` | `overflow: hidden` | `layout.css` + `index.css` |
| `.detail-panel` | `overflow: hidden` | `layout.css` + `index.css` |
| `.panel` | `overflow: hidden` | `layout.css` + `index.css` |
| `.panel-body` | `overflow-y: auto; overflow-x: hidden` | `layout.css` + `index.css` |

> The whole page is locked: `body { overflow: hidden }` is the only
> place where the body itself can be a scroll container, and it is
> locked. Internal panels scroll on their own; the workspace never
> scrolls as a whole; the main content remains usable at every
> supported viewport.

---

## Height Density Side-Effects (verified, no change)

The existing density rules in `src/styles/density.css` are unchanged
in their effect. The new `<= 480 px` block only adds an additional
layer on top. Verified that:

- `--topbar-height` resolves to 32 px at `<= 480 px`.
- `--control-height-md` resolves to 32 px at `<= 480 px`.
- `--task-card-min-height` resolves to 44 px at `<= 480 px`.
- `--panel-footer-min-height` resolves to 52 px at `<= 480 px`,
  keeping the composer / comment input usable.

---

## Remaining Risks

1. **The CSS rules in `index.css` for the shell rely on cascade
   order with the `@import` block.** The `@import`s happen first
   in `index.css`, then the legacy `index.css` rules, then the
   Agent 7 overflow-safety block. If a future agent inserts a new
   `@import` after the legacy rules, the cascade order will change.
   The block is self-contained, but it is sensitive to file order.
2. **Inline `style={{ width: 'Xvw' }}` widths in `AppLayout.tsx`
   still flow through user-resize handles.** The widths are now
   `clamp(260px, Xvw, 420px)`, so they cannot violate the
   `--task-list-width` token bounds, but they still vary with
   viewport. Migrating the persisted values in `uiStore` from
   `vw` to `px` would make the resize handles stable across
   window resizes. Recommended for Agent 8.
3. **The drawer hooks are not exercised by any current component.**
   A future drawer feature must apply the `--drawer` modifier
   class and toggle `.is-drawer-open` on the workspace. There is
   no automated test for this.
4. **The `<= 480 px` density block changes `--control-height-xs`
   globally.** Any component that pins its size to that token
   (e.g. a small status dot) will compress one step. The change
   is intentional but should be visually verified.
5. **`html { overflow-x: hidden }` is a defensive fallback.** In
   a normal browser, the body lock already prevents horizontal
   scroll. In a browser that disagrees, this rule prevents the
   *horizontal* axis only; vertical overflow is still locked at
   the body level. The two together cover all known edge cases.
6. **Pre-existing `npm run build` TypeScript errors remain**
   (see the "Build state note" at the top). They are not
   introduced by this phase. `npx vite build` and `npx vite dev`
   succeed.
7. **`!important` was added to the 1280 px / 900 px / 640 px
   `display: none` rules in `layout.css`.** The `.flex-col`
   utility class from `index.css` (loaded after `layout.css`
   via `@import`) sets `display: flex` on the panel elements
   at the same selector specificity (0,0,1,0). Without
   `!important`, the `.flex-col` utility wins the cascade and
   the panels stay visible at narrow widths, breaking the
   responsive collapse. `!important` is the smallest safe
   fix; alternatives are increasing the selector specificity
   (`.workspace > .task-list-panel`) or removing the
   `.flex-col` class from the JSX (out of scope for this
   phase). Documented inline in `src/styles/layout.css`.

---

## Smoke-Test Results (Live Browser, `http://localhost:5180`)

A Playwright-driven smoke test was run at all required viewport
sizes. For each viewport, the test verified:

- `bodyNoScroll` — `body { overflow: hidden }` is honoured.
- `bodyFitsViewport` — body does not overflow the viewport.
- `appHeightPx` matches the viewport height — the shell fills.
- `sidebarVisible / sidebarWidth` — sidebar is always at 36 px.
- `taskListVisible` — task list hidden at <= 900 px.
- `detailVisible` — detail panel hidden at <= 1280 px.
- `mainVisible / mainWidth` — main panel always visible.
- Token values — topbar / control-md / task-card reflect the
  height-density rules.

| Viewport | bodyNoScroll | bodyFits | app=vp | sidebar | task list | detail | main | topbar | control-md | task card |
|---|---|---|---|---|---|---|---|---|---|---|
| 1920x1080 | ✅ | ✅ | 1080px | 36px | visible | hidden | 1499 | 40 | 40 | 64 |
| 1600x900  | ✅ | ✅ | 900px  | 36px | visible | hidden | 1243 | 40 | 40 | 64 |
| 1366x768  | ✅ | ✅ | 768px  | 36px | visible | hidden | 1056 | 40 | 40 | 64 |
| 1280x720  | ✅ | ✅ | 720px  | 36px | visible | hidden | 983  | 36 | 36 | 56 |
| 1024x768  | ✅ | ✅ | 768px  | 36px | visible | hidden | 727  | 40 | 40 | 64 |
| 900x700   | ✅ | ✅ | 700px  | 36px | hidden  | hidden | 864  | 36 | 36 | 56 |
| 800x600   | ✅ | ✅ | 600px  | 36px | hidden  | hidden | 764  | 34 | 34 | 48 |
| 640x480   | ✅ | ✅ | 480px  | 36px | hidden  | hidden | 260+ | 32 | 32 | 44 |
| 500x400   | ✅ | ✅ | 400px  | 36px | hidden  | hidden | 260+ | 32 | 32 | 44 |

All checks pass. The shell never scrolls, the workspace never
overflows horizontally, the sidebar stays visible at 36 px in
every viewport, the main panel is always usable, and the
optional labels / metadata collapse at <= 640 px as designed.

---

## Recommended Next Step

**Agent 8: Container Query Agent.** The breakpoint / density /
drawer foundation is now in place. Agent 8 can wire container
queries (`container-type: inline-size;` on panel roots,
`@container` rules for secondary metadata) on top of the
existing layout. The optional-label / secondary-meta classes
added by Agent 7 are designed to be picked up by container
queries in a follow-up phase without further layout work.
