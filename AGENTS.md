# AGENTS.md — TABS Universal Main Wrapper Refactor

## 1. Purpose

This file defines mandatory rules for coding agents working on the TABS workspace layout refactor.

The current task is not a cosmetic panel reorder. It is a logical shell architecture change across Documents, Tasks, CRM, Forms, Settings, File Viewer, and shared header/navigation controls.

The authoritative requirements are in:

```text
docs/TABS-universal-main-wrapper-PRD.md
docs/prompts.md
```

If repository code and the PRD differ, re-check the current branch and follow the PRD unless doing so would break an explicitly newer user requirement.

---

## 2. Required read order

Before editing:

1. Read this `AGENTS.md`.
2. Read the full PRD.
3. Read the prompt for the active phase only.
4. Inspect `git status` and `git diff`.
5. Read all files you plan to change.
6. Search all references to any state, selector, class, ID, or component you plan to rename/remove.

Do not infer behavior from one file.

---

## 3. Core architecture invariants

These are non-negotiable.

### 3.1 Two logical wrappers

The horizontal workspace has two logical top-level wrappers:

```text
Primary workspace wrapper
Assistant/detail wrapper
```

The main resize handle sits between them.

### 3.2 Primary wrapper contents

The primary wrapper contains:

```text
optional contextual panel
optional context resize handle
center content panel
```

The contextual panel and center content move together when wrappers are swapped.

### 3.3 Logical controls

- Navigation rail panel button controls the primary wrapper.
- Header assistant button controls the assistant wrapper.
- Controls do not change meaning after swap.
- Do not implement “toggle whichever panel is on the right.”

### 3.4 At least one wrapper open

Never allow both wrappers to be closed.

Store actions must enforce the invariant atomically.

### 3.5 Swap prerequisites

Swap is enabled only when both wrappers are open.

The disabled button remains visible.

### 3.6 No remount on swap

Render each wrapper once.

Use CSS Grid areas/order or equivalent CSS placement.

Do not conditionally render reversed JSX branches.

Do not change keys on swap.

### 3.7 Main handle ownership

The main handle always resizes the assistant/detail wrapper.

It does not resize “the panel on the right.”

### 3.8 Settings is a normal mode

Settings participates in the same shell.

It has:

- contextual Settings list/category surface
- center Settings detail surface
- Settings AI sidebar scoped by active sub-tab

Do not restore the old Settings shell exception.

### 3.9 File Viewer ownership

File Viewer is assistant-wrapper content.

Hiding assistant does not destroy viewer selection.

### 3.10 Responsive rule

At `max-width: 900px`, assistant opens from the right regardless of stored swap state.

Do not mutate stored swap state for responsive presentation.

---

## 4. Phase discipline

Only perform the active phase.

Do not:

- implement later phases early because they look convenient
- combine broad cleanup with state migration
- remove compatibility APIs before all call sites are migrated
- redesign child features
- commit unless asked

At the end of each phase, provide a report suitable for the next agent.

---

## 5. Repository safety

### 5.1 Preserve user work

Before editing:

```bash
git status
git diff
```

Do not overwrite unrelated modifications.

If a target file already contains unrelated user edits, preserve them and make a minimal compatible patch.

### 5.2 No destructive git commands

Never run without explicit user instruction:

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
git push --force
```

### 5.3 No silent dependency changes

Do not add packages unless:

- the current phase truly requires them
- the repository lacks an equivalent
- the reason is documented

This refactor should normally require no new runtime dependency.

---

## 6. State management rules

### 6.1 Logical names only

Use:

```text
primaryWrapperOpen
assistantWrapperOpen
wrappersSwapped
assistantWrapperWidth
contextPanelWidth
contextPanelOpenByMode
```

Do not introduce new APIs named around:

```text
rightPanel
centerPanelOpen
mainRowSwapped
AIOnLeft
```

### 6.2 Centralize invariants

Top-level wrapper invariants belong in Zustand actions, not scattered button handlers.

Components call actions; components do not reimplement the rules.

### 6.3 Select narrowly

Avoid:

```ts
const entireStore = useUIStore();
```

in large shell components.

Prefer selectors:

```ts
const primaryOpen = useUIStore((s) => s.primaryWrapperOpen);
```

Group only closely related values.

### 6.4 Persistence

Use existing Dexie settings patterns.

- New keys may read old keys as fallback.
- Stop writing deprecated keys after migration.
- Do not delete old persisted keys if rollback compatibility is useful.
- Do remove obsolete TypeScript state and actions after call sites are migrated.

### 6.5 Drag persistence

Do not write Dexie on every unthrottled pointermove.

Preferred:

- update in-memory width during drag
- persist final width on pointerup

A documented debounce is acceptable.

---

## 7. React component rules

### 7.1 Stable component identity

Swapping must preserve:

- editor instance
- chat
- local Settings forms
- task/CRM/form selections

Do not use swap-dependent keys.

### 7.2 Extract by responsibility

A component extraction is justified when it owns:

- layout
- state
- events
- overflow boundary
- semantic identity
- container-query context

Do not create one-line wrapper components with no contract.

### 7.3 Keep feature logic out of shell primitives

`WorkspaceShell` should not know how CRM context is built.

Mode resolution belongs in `App.tsx`, a mode-layout hook, or a dedicated adapter layer.

### 7.4 Settings state ownership

When splitting Settings left and center surfaces:

- hoist shared selection/form state to a controller/provider
- do not duplicate state in sibling components
- do not lose unsaved values when swapping
- do not create duplicate Settings navigation

---

## 8. CSS and layout rules

### 8.1 Use Grid for top-level wrapper placement

Desktop shell should use explicit areas or equivalent:

```text
primary | handle | assistant
assistant | handle | primary
```

### 8.2 Shrink safety

Audit every relevant parent/child:

```css
min-width: 0;
min-height: 0;
```

Apply scrolling to the intended body, not every ancestor.

### 8.3 No swap animation

Do not animate:

- grid columns
- wrapper order
- widths during swap

### 8.4 Avoid physical names

Prefer:

```text
workspace-shell
primary-workspace-wrapper
assistant-wrapper
contextual-panel
center-content-panel
main-resize-handle
```

### 8.5 Remove dead selectors

When the last use is migrated, remove obsolete CSS in the same or cleanup phase.

Do not leave comments claiming dead markup still exists.

### 8.6 Inline styles

Keep truly dynamic width values as CSS custom properties or inline styles.

Move repeated structural styles to classes.

Do not conduct an unrelated global style cleanup.

### 8.7 Container queries

Search all uses before changing container names.

Migrate atomically.

---

## 9. Resize implementation rules

### 9.1 No sibling traversal

Forbidden for the new handles:

```ts
previousElementSibling
nextElementSibling
```

Use refs or stable queried elements with clear IDs/data attributes.

### 9.2 Pointer lifecycle

Preferred:

- pointerdown
- setPointerCapture
- pointermove
- pointerup
- pointercancel
- cleanup on unmount

### 9.3 Geometry

Main handle always computes assistant width.

Account for assistant side.

Clamp against:

- assistant minimum
- shell width
- primary minimum
- handle width

### 9.4 Accessibility

Use:

```text
role="separator"
aria-orientation="vertical"
aria-label
aria-valuemin
aria-valuemax
aria-valuenow
```

Keyboard resize is recommended.

---

## 10. Control and accessibility rules

### Header order

Exact order:

```text
terminal
swap
assistant
```

### Swap

- visible in all main modes
- native disabled unless both wrappers open
- greyed-out disabled style
- accurate label and pressed state

### Workspace toggle

- keeps `PanelLeft`
- controls primary wrapper
- label: Show/Hide workspace

### Assistant toggle

- keeps `PanelRight`
- controls assistant wrapper
- label: Show/Hide assistant

### Focus

When hiding a wrapper that contains focus, return focus to the corresponding toggle.

Do not leave focus inside `display:none` or unmounted content.

---

## 11. Settings AI security

Settings AI may receive:

- active settings sub-tab
- non-secret labels
- safe explanatory context

It must never receive:

- API keys
- secure storage values
- access tokens
- raw secret fields
- hidden credentials

Do not log secret values while debugging.

---

## 12. File Viewer rules

Opening File Viewer:

- ensures assistant wrapper is open
- does not change swap
- does not close primary

Hiding assistant:

- preserves viewer state

Closing viewer:

- returns assistant content to mode AI
- does not misuse old sidebar restoration fields

---

## 13. Validation requirements

Run after every implementation phase:

```bash
npm run build
npm run lint
```

If the repository adds tests, run the relevant suite.

Do not change ESLint or TypeScript settings merely to pass.

Document pre-existing failures separately from new failures.

### Manual minimum

At each relevant phase test:

- normal and swapped
- primary only
- assistant only
- both toggle directions
- both resize directions
- active mode
- terminal
- File Viewer
- Settings when implemented
- 900px responsive boundary when implemented

---

## 14. Forbidden shortcuts

Do not:

- duplicate normal/swapped JSX
- hide bugs with `any`
- add `@ts-ignore` without explicit justification
- use stale physical-side selectors
- preserve obsolete wrappers “just in case”
- rewrite unrelated features
- silently reset persisted UI preferences
- let both wrappers close
- disable swap by removing it from the DOM
- remount editor/chat during swap
- expose secrets to Settings AI
- claim tests passed without running them

---

## 15. Required phase report

Every phase response must contain:

```text
Summary
Files changed
Behavior implemented
Temporary compatibility code
Validation commands
Validation results
Manual checks
Risks / next phase notes
```

Be factual. State what was not tested.

---

## 16. Completion definition

The task is not complete until:

- all modes use the shared shell
- Settings uses shared layout and AI
- logical toggles work in both positions
- swap is global and disabled correctly
- responsive behavior matches PRD
- obsolete state/CSS/components are removed
- build and lint pass
- manual regression matrix is reported
