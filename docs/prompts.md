# TABS Universal Main Wrapper Refactor — Phased Coding Prompts

These prompts are designed for MiMo v2.5 Pro or a similar coding agent. Run them in order in the same repository and branch.

## Operating instructions

Before every phase:

1. Read the root `AGENTS.md`.
2. Read `docs/TABS-universal-main-wrapper-PRD.md` or the supplied PRD path.
3. Inspect the current working tree and preserve existing user changes.
4. Do not begin later phases.
5. Do not commit unless explicitly asked.
6. End with:
   - changed files
   - key decisions
   - commands run
   - results
   - remaining risks for the next phase

If the previous phase left a report, read it before proceeding.

---

# Phase 0 — Audit and exact implementation map

```text
You are working in the brandpreneuragency/TABS repository.

Read:
1. AGENTS.md
2. docs/TABS-universal-main-wrapper-PRD.md
3. package.json
4. the current layout, UI store, header, navigation rail, resize hooks, Settings components, AI sidebar, chat store, and responsive CSS

This phase is AUDIT ONLY. Do not edit production code.

Goal:
Produce a precise implementation map for the universal two-wrapper layout refactor.

Required investigation:
- Trace App.tsx → AppLayout.tsx → all mode-specific panels.
- Find every reference to:
  sidebarOpen
  setSidebarOpen
  sidebarWidth
  fileExplorerOpen
  fileExplorerWidth
  taskListOpen
  aiSidebarOpen
  centerPanelOpen
  panelsSwapped
  toggleRightPanel
  selectIsRightPanelOpen
  selectIsMainRowSwapped
  selectCanSwapPanels
  CenterResizableHandle
  LeftResizableHandle
  useResizable
  useLeftResizable
  main-row
  detail-panel
  center-resize-handle
  nav-btn-toggle-panel
  ai-toggle-btn
- Map Documents, Tasks, CRM, Forms, Settings, File Viewer, terminal, and special center-only pages.
- Map every Settings section and explain how its left and center slots currently share local state.
- Find every container query or selector depending on detail-panel/main-row IDs.
- Identify current responsive behavior at <=900px.
- Inspect available tests and validation scripts.
- Inspect current git diff and identify unrelated edits that must not be overwritten.

Deliver one markdown report in the response containing:
1. Current DOM tree.
2. Current state/action dependency table.
3. Proposed exact target file tree.
4. Proposed old→new state migration table.
5. Proposed Settings extraction strategy that preserves selection and unsaved form state.
6. CSS selectors to replace/remove.
7. Exact implementation sequence for phases 1–6.
8. Risks or PRD conflicts found.

Do not modify code. Do not ask the user questions unless the repository contradicts a mandatory PRD requirement. Resolve ordinary implementation details yourself.
```

---

# Phase 1 — State model, selectors, persistence, and migration

```text
Continue the TABS universal main-wrapper refactor.

Read:
- AGENTS.md
- docs/TABS-universal-main-wrapper-PRD.md
- the Phase 0 audit report
- current git diff

Scope for this phase:
Implement the new logical UI state model and persistence migration only. Do not perform the full layout rewrite yet.

Required new concepts:
- primaryWrapperOpen
- assistantWrapperOpen
- wrappersSwapped
- assistantWrapperWidth
- contextPanelWidth
- contextPanelOpenByMode
- logical wrapper actions and selectors
- at-least-one-wrapper-open invariant
- can-swap-only-when-both-open invariant
- mode entry ensures primary is open
- migration from old persisted values

Required actions/selectors:
- set/toggle primary wrapper
- set/toggle assistant wrapper
- set/toggle swapped
- set/toggle context panel by active mode
- selectCanSwapWrappers
- selectActiveWorkspaceMode
- logical wrapper visibility selectors

Important:
- Do not leave a blank state possible.
- Closing the only visible wrapper must atomically open the other.
- Do not make physical-side selectors part of the new API.
- Stop adding new uses of old fields.
- Temporary compatibility aliases are allowed only if needed for the next phase and must be clearly marked.
- Preserve old persisted data through deterministic fallback migration.
- Do not delete old fields until all current components compile, unless you update every call site in this phase safely.
- Avoid repeated Dexie writes during future pointer movement; design width persistence so it can be finalized on drag end or debounced.

Testing:
- Add focused store tests only if the repository has a practical existing test setup.
- Otherwise create pure helper functions for invariants/migration where useful and verify through TypeScript/build.
- Do not introduce a large new test framework solely for this phase unless clearly justified.

Validation:
- npm run build
- npm run lint

End with:
- exact old→new state mapping
- temporary compatibility items still present
- changed files
- validation results
- next-phase warnings
```

---

# Phase 2 — Shared shell primitives and Documents vertical slice

```text
Continue the TABS universal main-wrapper refactor.

Read:
- AGENTS.md
- PRD
- Phase 0 and Phase 1 reports
- current git diff

Scope:
Build the shared shell primitives and migrate Documents mode as the first complete vertical slice.

Create or refactor clear components equivalent to:
- WorkspaceShell
- PrimaryWorkspaceWrapper
- PrimaryWorkspaceContent
- ContextualPanel
- ContextResizeHandle
- CenterContentPanel
- AssistantWrapper
- MainResizeHandle

Requirements:
1. Render primary and assistant wrappers once.
2. Swap using CSS Grid areas/order, not duplicated JSX.
3. Main handle is between wrappers and always resizes assistant.
4. Context handle resizes the contextual panel.
5. Main handle only appears when both wrappers are open.
6. Single visible wrapper fills available width.
7. Documents primary wrapper contains:
   FileExplorerPanel + context handle + EditorWorkspace.
8. Documents assistant wrapper contains:
   RightPanelSubheader + AISidebar, or FileViewerPanel.
9. Swapping must not remount the editor or chat.
10. Terminal and modals stay outside swapped horizontal order.
11. Preserve min-width/min-height and internal scroll behavior.
12. Replace sibling traversal in resize hooks with explicit refs or stable shell/assistant references.
13. No swap animation.
14. Preserve relevant container-query behavior.

Do not migrate Tasks, CRM, Forms, or Settings yet except for compile-safe adapter scaffolding.

Use semantic logical names. Do not add new “right panel” APIs.

Validation:
- npm run build
- npm run lint
- manually verify Documents normal/swapped, primary-only, assistant-only, file tree open/closed, both resize directions, File Viewer, terminal

End with:
- target DOM tree
- proof/description that swap does not remount editor/chat
- changed files
- validation results
- known temporary adapters
```

---

# Phase 3 — Tasks, CRM, Forms, and Settings integration

```text
Continue the TABS universal main-wrapper refactor.

Read:
- AGENTS.md
- PRD
- all prior phase reports
- current git diff

Scope:
Migrate every remaining major mode to the shared shell and remove Settings as a shell exception.

Tasks:
- Task List/Calendar: contextual TaskListPanel + center TaskDetailPanel.
- Projects: no contextual panel; center TaskProjectsKanban fills primary.
- Preserve subtasks bar behavior.
- Task AISidebar remains task-scoped.

CRM:
- Standard CRM pages use CRMListPanel + CRMWorkspace.
- Pipeline omits contextual list.
- CRMAISidebar keeps correct entity/page context.

Forms:
- Forms pages use FormsListPanel where applicable + forms workspace in CRMWorkspace.
- Preserve form/submission context in CRMAISidebar.

Settings:
- Treat Settings as a first-class workspace mode.
- Remove AppLayout logic that hides the outer assistant and contextual architecture solely because Settings is active.
- Keep global Settings sub-tabs in TabBar.
- Refactor every Settings section so its left list/category and center detail render through shared PrimaryWorkspaceContent.
- Remove the active nested Settings ReusablePageTemplate/SettingsPanels runtime layout.
- Preserve selected provider/action/category/agent/tool and unsaved form values while swapping.
- Render AISidebar with settingsTab={activeSettingsSubTab}, workspaceId={null}, taskId={null}, editor={null}.
- Render the assistant subheader with the same settingsTab context.
- Ensure chat threads remain scoped per settings sub-tab.
- Add a safe buildSettingsAIContext helper describing the active settings section.
- Never include API keys or secure-storage values in AI context.
- Do not create a duplicate Settings navigation list; existing global Settings tabs remain the sub-tab navigation.

Special pages:
- contextual panel availability must be explicit.
- context handle and inner toggle are absent when unavailable.

Validation:
- npm run build
- npm run lint
- manually verify every mode and every Settings sub-tab in normal and swapped order

End with:
- mode matrix as implemented
- Settings extraction architecture
- Settings AI context/security notes
- changed files
- validation results
```

---

# Phase 4 — Global controls, invariants, File Viewer, and inner-context toggle

```text
Continue the TABS universal main-wrapper refactor.

Read:
- AGENTS.md
- PRD
- prior reports
- current git diff

Scope:
Complete shell controls and logical interaction behavior.

Header:
- Keep terminal toggle.
- Move swap button from RightPanelSubheader to global Header.
- Place controls in this exact order:
  terminal toggle → swap wrappers → assistant toggle
- Swap stays visible but native-disabled/greyed out unless both wrappers are open.
- Swap works in Documents, Tasks, CRM, Forms, and Settings.
- Update title, aria-label, aria-pressed, and disabled semantics.

Navigation rail:
- nav-btn-toggle-panel always toggles the complete primary workspace wrapper.
- Keep PanelLeft icon.
- It must not inspect task/file-tree/list physical state.
- Update tooltip and aria state to Show workspace / Hide workspace.

Assistant toggle:
- always toggles assistant/detail wrapper.
- Keep PanelRight icon.
- Update labels to Show assistant / Hide assistant.
- Remove “right panel” meaning.

At-least-one-open:
- Verify both toggle paths use store invariants.
- If the user closes the only visible wrapper, atomically open the other and close the requested wrapper.

Mode navigation:
- entering Documents, Tasks, CRM, Forms, or Settings ensures primary wrapper is open.
- preserve assistant open state, widths, and swapped state.

Inner contextual toggle:
- add a separate generic control in a stable leading-control area of the center panel header.
- show accurate mode-specific labels.
- hide/disable when no contextual panel is available.
- do not overlay editable content.
- use contextPanelOpenByMode.

RightPanelSubheader:
- remove swap UI and physical-side layout branches that exist only for swap-button placement.
- retain chat history, context window, and new chat behavior.
- rename component only if cleanup improves clarity and all call sites are updated.

File Viewer:
- opening viewer ensures assistant wrapper is open.
- viewer is assistant-wrapper content.
- hiding assistant preserves viewer state.
- reopening restores viewer.
- explicit viewer close returns to mode AI.

Validation:
- npm run build
- npm run lint
- manually test controls before/after swap and in both single-wrapper states

End with:
- control behavior truth table
- File Viewer state transitions
- removed old control APIs
- changed files
- validation results
```

---

# Phase 5 — Responsive layout and resize hardening

```text
Continue the TABS universal main-wrapper refactor.

Read:
- AGENTS.md
- PRD
- prior reports
- current git diff

Scope:
Finish responsive behavior, geometry, overflow, and resize robustness.

Desktop:
- verify normal/swapped grid tracks
- verify single-wrapper tracks
- verify assistant min/max constraints
- verify primary minimum width

At max-width 900px:
- ignore swapped visual order
- do not change persisted wrappersSwapped
- primary wrapper remains base inline workspace
- assistant opens from the RIGHT as a fixed drawer when both wrappers are open
- main resize handle hidden
- if assistant is the only open wrapper, it fills usable workspace rather than leaving a blank base
- context panel may auto-hide without changing persisted context state
- returning to desktop restores stored order and context visibility

At 640px and 320px:
- no horizontal body scroll
- header controls remain accessible
- navigation rail remains usable
- internal panel bodies scroll correctly

Resize:
- use explicit refs/geometry, not sibling traversal
- correct assistant growth direction on both sides
- correct clamping
- pointer capture/cancel cleanup
- body/root drag cursor and user-select cleanup
- add separator ARIA metadata
- add keyboard resize if practical without destabilizing the change
- avoid writing Dexie on every raw pointer event; persist final width or debounce

CSS:
- audit every new flex/grid boundary for min-width:0 and min-height:0
- preserve or migrate all relevant container queries
- remove old swapped drawer rules tied to detail-panel/main-row

Validation:
- npm run build
- npm run lint
- manually test 1920, 1440, 1280, 1024, 901, 900, 768, 640, and 320px

End with:
- responsive behavior table
- resize formulas/clamps
- accessibility behavior
- changed files
- validation results
```

---

# Phase 6 — Remove compatibility code, simplify tree, full regression

```text
Continue the TABS universal main-wrapper refactor.

Read:
- AGENTS.md
- PRD
- all prior reports
- current git diff

Scope:
Perform the required cleanup and full regression. Do not redesign unrelated features.

Remove or replace all obsolete concepts where no longer needed:
- selectIsMainRowSwapped
- selectIsRightPanelOpen
- selectCanSwapPanels
- toggleRightPanel
- centerPanelOpen
- aiSidebarOpen as top-level visibility
- panelsSwapped old API
- CenterResizableHandle
- useResizable generic/physical API
- #main-row
- main-row--swapped
- main-row--single-panel
- .detail-panel
- #center-resize-handle
- duplicated normal/swapped JSX
- Settings shell exception
- nested runtime SettingsPanels/ReusablePageTemplate layout if now unused
- stale comments and dead CSS

Audit candidates before deletion:
- sidebarOpen
- fileViewerPreviousSidebarOpen
- fileViewerPreviousSidebarWidth
- fileExplorerOpen
- taskListOpen
- fileExplorerWidth
Remove or migrate them according to the PRD; do not blindly delete still-valid feature state.

Component-tree cleanup:
- remove wrappers that own no layout, overflow, semantics, state, events, or container context
- consolidate repeated inline structural styles
- keep dynamic widths as variables/styles
- do not perform broad unrelated styling work

Repository-wide searches:
- ensure no old selector/action names remain except documented migration keys
- ensure no comments call assistant “right panel” when referring to logical identity
- ensure no Settings code still suppresses the outer assistant
- ensure swap button exists only in global header

Validation:
- npm run build
- npm run lint
- run any repository tests
- execute the complete PRD manual regression matrix
- inspect browser console
- inspect current git diff for accidental unrelated changes

Produce a final implementation report:
1. files added/modified/removed
2. state migration summary
3. old persisted keys retained only for fallback
4. test/build/lint results
5. manual matrix results
6. known limitations
7. any PRD deviations
```

---

# Phase 7 — Independent reviewer and defect-fix pass

```text
Act as an independent senior reviewer for the completed TABS universal main-wrapper refactor.

Read:
- AGENTS.md
- docs/TABS-universal-main-wrapper-PRD.md
- all phase reports
- the full git diff
- all touched files

Do not assume the implementation is correct.

Review categories:
1. Architecture
   - exactly two logical top-level wrappers
   - no duplicated swapped JSX
   - CSS swap without remount
   - terminal/modals outside swap
2. State
   - at least one wrapper invariant
   - logical toggles
   - mode entry behavior
   - persistence migration
   - File Viewer state
3. Modes
   - Documents
   - Tasks special pages
   - CRM special pages
   - Forms
   - Settings extraction and AI
4. Resize
   - explicit refs
   - both directions
   - clamping
   - persistence frequency
5. Responsive
   - assistant always right drawer <=900px
   - stored swap restored on desktop
   - only-assistant narrow state
6. Accessibility
   - disabled swap
   - labels/pressed states
   - focus after closing wrapper
   - separator semantics
7. Cleanup
   - dead CSS/state/components
   - stale physical-side naming
8. Security
   - Settings AI context excludes secrets

First produce a severity-ranked findings list with exact file and line references.

Then fix all confirmed Critical, High, and Medium defects that are within the PRD. Do not add unrelated features.

Run:
- npm run build
- npm run lint
- any tests

End with:
- findings fixed
- findings intentionally not fixed and why
- validation results
- final confidence assessment based on evidence
```
