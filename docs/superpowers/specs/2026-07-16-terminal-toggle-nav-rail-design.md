# Terminal toggle → left nav rail

**Date:** 2026-07-16  
**Status:** Approved design — awaiting user review of this spec

## Goal

Move the terminal panel toggle from the header (`#header-btn-terminal`) to the bottom of the left narrow sidebar (`#nav-bar`), pinned to the absolute bottom of the rail and visually separate from the mode buttons (Documents / Tasks / CRM / Settings).

## Non-goals

- No changes to terminal panel behavior, height, tabs, or PTY wiring
- No changes to Ctrl/Cmd+J shortcut (`App.tsx`)
- No changes to header swap / assistant toggles
- No new shared toggle component abstraction

## Current behavior

- `Header.tsx` renders a `TerminalSquare` button in `.ai-toggle-col` that toggles `useUIStore.terminalPanelOpen` via `setTerminalPanelOpen`
- Labels include Show/Hide + Ctrl+J; `aria-pressed` reflects open state
- `LeftNarrowSidebar.tsx` owns `#nav-bar` with a top panel-toggle section and a mode-button section; CSS already defines `.nav-section-bottom`

## Design

### Placement

Add a third section at the end of `#nav-bar`:

```tsx
<div className="nav-section nav-section-bottom">
  <button id="nav-btn-terminal" ... />
</div>
```

Pin to the rail floor with `margin-top: auto` on that bottom section (or equivalent flex spacer) so it sits at the absolute bottom, with empty space between Settings and Terminal.

### Button

| Property | Value |
|----------|--------|
| id | `nav-btn-terminal` |
| Icon | `TerminalSquare` (lucide), size ~15 to match other nav icons |
| className | `nav-btn` + `nav-btn--on` when open |
| onClick | `setTerminalPanelOpen(!terminalPanelOpen)` |
| title / aria-label | Same Show/Hide (+ Ctrl+J in title) as today’s header button |
| aria-pressed | `terminalPanelOpen` |

### Header cleanup

Remove `#header-btn-terminal` and unused terminal-related imports/store selectors from `Header.tsx`. Leave swap and assistant buttons unchanged.

### CSS

- Use existing `.nav-btn` / `.nav-btn--on` styles
- Ensure `.nav-section-bottom` (or a small addition) gets `margin-top: auto` so the section sticks to the bottom of the flex column `.nav-bar`
- No need to mirror header `.ai-toggle-btn` styling in the rail

## Files to touch

1. `src/components/header/Header.tsx` — remove terminal button
2. `src/components/layout/LeftNarrowSidebar.tsx` — add bottom terminal toggle
3. `src/index.css` — bottom-section pin (`margin-top: auto` if not already effective)

## Success criteria

- Terminal toggle is only in the left nav rail, at the absolute bottom
- Open/pressed state and Ctrl+J still work
- Header no longer shows a terminal button
- Mode buttons and panel toggle layout unchanged aside from the new bottom control
