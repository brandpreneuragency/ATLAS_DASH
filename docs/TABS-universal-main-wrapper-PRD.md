# TABS Universal Main Wrapper Layout Refactor — Product Requirements Document

**Repository:** `brandpreneuragency/TABS`  
**Target:** current `main` branch; agents must re-audit the checked-out branch before editing  
**Primary implementation model:** MiMo v2.5 Pro or another coding agent  
**Status:** Approved implementation specification  
**Scope type:** Cross-mode layout architecture refactor with state migration and component cleanup

---

## 1. Executive summary

TABS currently composes its workspace from several panel fragments whose logical identity and physical position are mixed together. In particular, the swap operation only exchanges the center panel and AI/detail panel inside `#main-row`, while the file tree, task list, or CRM list remains outside that swapped region. The two existing shell toggle buttons also change meaning based on mode or physical position:

- `#nav-btn-toggle-panel` currently toggles an inner contextual panel such as the file tree or task list.
- The header's `ai-toggle-btn` currently toggles the panel physically occupying the right side, which means it may close the center panel after a swap.

This project replaces that behavior with two stable, logical top-level wrappers used by every major application mode:

1. **Primary workspace wrapper**
   - Contains the mode's contextual left panel, the internal left resize handle, and the center content panel.
   - Examples:
     - Documents: file tree + editor
     - Tasks: task list + task detail
     - CRM/Forms: CRM or Forms list + workspace
     - Settings: settings list/category panel + settings detail panel

2. **Assistant/detail wrapper**
   - Contains the mode-specific AI sidebar or the active file viewer.
   - Examples:
     - Documents/Tasks: `AISidebar`
     - CRM/Forms: `CRMAISidebar`
     - Settings: `AISidebar` scoped to the active settings sub-tab
     - File viewer state: `FileViewerPanel`

A single main resize handle sits between these wrappers. The swap button moves the two complete wrappers, not their inner panels. Each wrapper is rendered once and repositioned through CSS Grid areas/order so editor, chat, form, and task component state is not lost.

The shell controls become logical controls:

- `#nav-btn-toggle-panel` always toggles the **primary workspace wrapper**, even when that wrapper is visually on the right.
- The header assistant toggle always toggles the **assistant/detail wrapper**, even when that wrapper is visually on the left.
- The swap button moves to the global app header, between the terminal button and assistant toggle.
- Swap is available in Documents, Tasks, CRM/Forms, and Settings whenever both wrappers are visible.
- Swap is disabled and greyed out when either wrapper is closed.

The refactor also removes duplicated normal/swapped JSX, obsolete wrapper elements, misleading state names, stale CSS selectors, and the nested Settings page layout that currently bypasses the shared shell.

---

## 2. Product goals

### 2.1 Required outcomes

1. Establish one shared two-wrapper architecture for:
   - Documents
   - Tasks
   - CRM
   - Forms
   - Settings

2. Make the swap operation move complete logical wrappers.

3. Make wrapper toggle controls independent of physical side.

4. Preserve all relevant UI state during swaps:
   - Tiptap editor instance and selection
   - Chat thread and streaming state
   - Task selection
   - CRM/Form selection
   - Settings selection and unsaved form state
   - File viewer state
   - Panel widths
   - Scroll positions where React and browser behavior permit

5. Add a contextual Settings AI sidebar scoped by `activeSettingsSubTab`.

6. Preserve independent collapse of the internal contextual panel within the primary wrapper.

7. Keep the terminal independent of horizontal wrapper swapping.

8. Simplify the component tree without changing visual design unnecessarily.

9. Preserve or improve keyboard, pointer, responsive, and accessibility behavior.

10. Produce a stable code structure that future agents can understand without tracing physical sibling assumptions.

### 2.2 Success definition

The work is complete when all supported modes share the same shell primitives, the two wrapper toggles retain consistent meaning before and after swaps, Settings participates like other modes, and the full regression matrix in this PRD passes.

---

## 3. Non-goals

Do not use this refactor to:

- Redesign the visual language, spacing system, typography, themes, or colors.
- Replace Zustand, Dexie, Tiptap, Vite, React, or Tauri.
- Redesign the individual Task, CRM, Forms, Settings, editor, or AI feature interfaces.
- Add drag-to-reorder wrappers.
- Add animated panel movement. Swaps must be instant.
- Add separate assistant widths per mode or per side.
- Add separate wrapper visibility per mode.
- Add a new Settings-specific agent type unless a later requirement explicitly asks for it.
- Expose or inject API keys, tokens, or other secrets into Settings AI context.
- Rewrite unrelated page templates or generic layout systems outside direct impact.
- Convert the entire repository to a new CSS methodology.
- Preserve obsolete public CSS IDs purely for convenience when all internal call sites can be migrated safely.

---

## 4. Terminology

### 4.1 Primary workspace wrapper

The top-level logical wrapper that contains the mode's working interface.

Suggested component name:

```tsx
<PrimaryWorkspaceWrapper />
```

It contains a reusable internal layout primitive:

```text
PrimaryWorkspaceContent
├── ContextualPanel       (optional)
├── ContextResizeHandle   (only when contextual panel is visible)
└── CenterContentPanel
```

### 4.2 Contextual panel

The optional mode-specific left panel inside the primary wrapper:

- Documents: File Explorer
- Tasks: Task List
- CRM: CRM List
- Forms: Forms List
- Settings: the active Settings section's list/category panel

The contextual panel has its own independent open state and one shared persisted width across modes.

### 4.3 Assistant/detail wrapper

The top-level logical wrapper containing the active detail surface:

- AI sidebar in normal operation
- File viewer while a file viewer item is active

Suggested component name:

```tsx
<AssistantWrapper />
```

The wrapper remains the same logical unit regardless of whether it is physically left or right.

### 4.4 Main resize handle

The handle between the two top-level wrappers. It always resizes the assistant/detail wrapper.

Suggested component name:

```tsx
<MainResizeHandle />
```

It replaces the misleading `CenterResizableHandle` concept.

### 4.5 Swapped

`wrappersSwapped === true` means:

```text
assistant/detail wrapper | main handle | primary workspace wrapper
```

It does not mean “AI is in the center panel.”

---

## 5. Current-state problems to remove

Agents must verify the current branch, but the known problems include:

1. `AppLayout.tsx` duplicates normal and swapped JSX branches.
2. The contextual left panel is outside `#main-row`, so it does not move with the editor.
3. `CenterResizableHandle` and `useResizable` rely on immediate sibling positions and `#main-row`.
4. `toggleRightPanel()` changes logical meaning after swapping.
5. `selectIsRightPanelOpen` reports a physical-side concept rather than a stable feature concept.
6. `fileExplorerWidth` is used as a generic contextual width despite its mode-specific name.
7. `panelsSwapped` and comments describe “AI left, editor right” rather than wrapper identity.
8. Settings is treated as a special document state:
   - outer file explorer hidden
   - outer AI hidden
   - nested `ReusablePageTemplate` provides a separate left/center layout
9. `RightPanelSubheader` owns swap controls even though swapping is now a shell operation.
10. `AppLayout` mixes:
    - mode decisions
    - state selection
    - panel construction
    - visibility decisions
    - width calculations
    - modal placement
    - duplicated ordering
11. CSS contains selectors tied to `#main-row`, `.detail-panel`, `main-row--swapped`, and physical right-panel assumptions.
12. Responsive behavior couples drawer side to swap state; the new requirement always opens the assistant drawer from the right on narrow screens.
13. Existing state fields overlap:
    - `sidebarOpen`
    - `aiSidebarOpen`
    - `centerPanelOpen`
    - `fileExplorerOpen`
    - `taskListOpen`
    - `panelsSwapped`

The refactor must remove ambiguity rather than add another compatibility layer indefinitely.

---

## 6. Confirmed product decisions

These decisions are final.

### 6.1 Wrapper identity

Controls remain tied to logical wrapper identity, not physical side.

```text
nav-btn-toggle-panel → primary workspace wrapper
assistant toggle     → assistant/detail wrapper
```

### 6.2 Swap availability

Swap is available in all main modes:

- Documents
- Tasks
- CRM
- Forms
- Settings

It is available only when both wrappers are visible.

### 6.3 Primary wrapper toggle

Clicking `#nav-btn-toggle-panel` hides or shows the complete primary workspace wrapper.

It does not merely collapse the contextual panel.

### 6.4 Assistant wrapper toggle

Clicking the app-header assistant toggle hides or shows the complete assistant/detail wrapper.

It does not toggle “the physical right side.”

### 6.5 At least one wrapper must remain open

Both wrappers may never be closed simultaneously.

When the user attempts to close the only visible wrapper:

1. Open the other wrapper.
2. Close the requested wrapper.
3. Perform both state changes atomically to avoid a blank intermediate render.

### 6.6 Mode switching

When the user switches modes:

- Ensure the primary workspace wrapper is open.
- Preserve the assistant wrapper's global open/closed state.
- Do not reset swap state.
- Do not reset widths.
- Do not remount wrappers solely because the mode changed.

### 6.7 Internal contextual panel

The contextual panel remains independently collapsible inside the primary wrapper.

The old file-tree/task-list toggle behavior must not be lost; it moves to a distinct inner-context control.

### 6.8 Special pages

Special center-only pages remain valid:

- Task Projects may omit Task List.
- CRM Pipeline may omit CRM List.
- Other pages may omit contextual content when explicitly designed that way.

In these cases:

- Primary wrapper remains present.
- Center content fills the primary wrapper.
- Context resize handle is absent.
- Inner-context toggle is hidden or disabled because no contextual panel is available.

### 6.9 Settings

Settings becomes a normal shell mode with:

- Primary wrapper:
  - Settings contextual list/category panel
  - context resize handle
  - Settings center/detail panel
- Assistant wrapper:
  - `AISidebar`
  - chat context scoped by `activeSettingsSubTab`

The current nested Settings `ReusablePageTemplate` must be removed from the runtime Settings structure. The existing Settings section data and interactions must remain functional.

### 6.10 File Viewer

File Viewer is content inside the assistant/detail wrapper.

It moves with that wrapper on desktop swaps.

Hiding the assistant wrapper must not silently destroy file viewer state. Reopening the assistant wrapper should show the file viewer until the file viewer is explicitly closed.

### 6.11 Main resize

The main resize handle always controls assistant/detail width.

- Assistant on right: dragging left increases assistant width; dragging right decreases it.
- Assistant on left: dragging right increases assistant width; dragging left decreases it.

### 6.12 Width persistence

Use:

- one shared assistant wrapper width across all modes
- one shared contextual panel width across all modes

Widths persist across swaps, modes, and app restarts.

### 6.13 Wrapper visibility persistence

Persist one global pair:

```ts
primaryWrapperOpen: boolean
assistantWrapperOpen: boolean
```

Do not create visibility values per mode.

### 6.14 State migration

Introduce explicit wrapper state and remove obsolete fields after all call sites are migrated.

Preserve only genuinely independent inner-panel state or replace it with a clear mode-indexed context-panel state.

### 6.15 Icons and labels

Keep the existing `PanelLeft` and `PanelRight` icons for the two wrapper toggle controls.

Update:

- tooltips
- ARIA labels
- pressed state
- internal variable names

The labels must describe logical wrappers:

```text
Show workspace / Hide workspace
Show assistant / Hide assistant
```

### 6.16 Swap control location

Move the swap control to the global app header.

Control order in the right-side header control group:

```text
Terminal toggle
Swap wrappers
Assistant toggle
```

The swap button:

- uses the existing left-right swap icon or equivalent
- is disabled and visually greyed out unless both wrappers are open
- has an accurate tooltip and ARIA label
- remains visible while disabled to avoid header control movement

### 6.17 Responsive behavior

At `max-width: 900px`:

- Ignore swapped visual order.
- Primary wrapper is the base inline workspace.
- Assistant wrapper opens from the right as a drawer.
- The persisted desktop `wrappersSwapped` value is not changed.
- Returning to desktop restores the swapped desktop order.
- Main resize handle is hidden.
- Contextual panel may auto-collapse visually without mutating its persisted state.

### 6.18 DOM strategy

Render both wrappers once.

Use CSS Grid areas or equivalent CSS ordering to change placement.

Do not duplicate JSX for swapped and normal states.

### 6.19 Animation

No swap animation.

No grid-track animation.

No width transition during swapping.

### 6.20 Verification

Require:

- build
- lint
- focused automated tests where practical
- complete manual regression matrix
- final cleanup audit

---

## 7. Target user experience

### 7.1 Desktop, normal order

```text
┌──────────────────────────────────────────────────────────────────────┐
│ App Header: tabs ... | terminal | swap | assistant                  │
├────┬───────────────────────────────────────┬──┬──────────────────────┤
│Nav │ PRIMARY WORKSPACE                     │H │ ASSISTANT / DETAIL   │
│    │ ┌─────────────┬──┬──────────────────┐ │A │                      │
│    │ │ Context     │H │ Center content   │ │N │ AI or file viewer    │
│    │ │ panel       │A │                  │ │D │                      │
│    │ │             │N │                  │ │L │                      │
│    │ │             │D │                  │ │E │                      │
│    │ └─────────────┴──┴──────────────────┘ │  │                      │
└────┴───────────────────────────────────────┴──┴──────────────────────┘
```

### 7.2 Desktop, swapped order

```text
┌──────────────────────────────────────────────────────────────────────┐
│ App Header: tabs ... | terminal | swap | assistant                  │
├────┬──────────────────────┬──┬───────────────────────────────────────┤
│Nav │ ASSISTANT / DETAIL   │H │ PRIMARY WORKSPACE                    │
│    │                      │A │ ┌─────────────┬──┬──────────────────┐ │
│    │                      │N │ │ Context     │H │ Center content   │ │
│    │                      │D │ │ panel       │A │                  │ │
│    │                      │L │ │             │N │                  │ │
│    │                      │E │ │             │D │                  │ │
│    │                      │  │ └─────────────┴──┴──────────────────┘ │
└────┴──────────────────────┴──┴───────────────────────────────────────┘
```

### 7.3 Primary closed

```text
[ assistant/detail fills all available workspace width ]
```

- Main handle hidden.
- Swap disabled.
- Clicking workspace toggle restores primary.
- Clicking assistant toggle attempts to close the only visible wrapper:
  - primary opens
  - assistant closes

### 7.4 Assistant closed

```text
[ primary workspace fills all available workspace width ]
```

- Main handle hidden.
- Swap disabled.
- Clicking assistant toggle restores assistant.
- Clicking workspace toggle attempts to close the only visible wrapper:
  - assistant opens
  - primary closes

### 7.5 Contextual panel closed

```text
PRIMARY WORKSPACE
└── Center content fills wrapper
```

- Context handle hidden.
- Wrapper remains open.
- Inner-context toggle can restore the contextual panel.
- Top-level workspace toggle remains unaffected.

---

## 8. Mode layout matrix

| Mode/page | Contextual panel | Center content | Assistant content | Swap |
|---|---|---|---|---|
| Documents | `FileExplorerPanel` | `EditorWorkspace` | `AISidebar(workspaceId)` or File Viewer | Yes |
| Tasks: List/Calendar | `TaskListPanel` | `TaskDetailPanel` | `AISidebar(taskId)` or File Viewer | Yes |
| Tasks: Projects | None | `TaskProjectsKanban` | Task AI or File Viewer | Yes |
| CRM: standard pages | `CRMListPanel` | `CRMWorkspace` | `CRMAISidebar` or File Viewer | Yes |
| CRM: Pipeline | None | pipeline in `CRMWorkspace` | `CRMAISidebar` or File Viewer | Yes |
| Forms | `FormsListPanel` where applicable | Forms workspace inside `CRMWorkspace` | `CRMAISidebar` with Forms context or File Viewer | Yes |
| Settings: Models | provider list | models configuration | `AISidebar(settingsTab="models")` | Yes |
| Settings: Actions | groups/actions list | action editor | `AISidebar(settingsTab="actions")` | Yes |
| Settings: Appearance | category list | appearance editor | `AISidebar(settingsTab="appearance")` | Yes |
| Settings: Agents | agents list | agent editor | `AISidebar(settingsTab="agents")` | Yes |
| Settings: Tools | tools list/categories | tools editor | `AISidebar(settingsTab="tools")` | Yes |

If a Settings section currently composes left and center in one component, refactor it into a controller/provider plus two slot components, or another structure that renders both slots through the shared `PrimaryWorkspaceContent`. Do not leave a nested page-template layout inside the center panel.

---

## 9. Proposed component architecture

Exact filenames may vary if the current tree justifies a small adjustment, but responsibilities must remain clear.

### 9.1 Shell components

Suggested directory:

```text
src/components/layout/workspace/
├── WorkspaceShell.tsx
├── PrimaryWorkspaceWrapper.tsx
├── PrimaryWorkspaceContent.tsx
├── ContextualPanel.tsx
├── ContextResizeHandle.tsx
├── CenterContentPanel.tsx
├── AssistantWrapper.tsx
├── MainResizeHandle.tsx
├── WorkspaceHeaderControls.tsx
└── types.ts
```

Avoid extracting components that only rename one `<div>` and own no behavior or semantic contract.

### 9.2 `WorkspaceShell`

Responsibilities:

- Render stable top-level layout structure once.
- Apply normal/swapped class or data attribute.
- Apply single-wrapper state.
- Render main resize handle only when both wrappers are visible and desktop layout allows it.
- Keep modals and terminal outside the swapped horizontal wrapper order.
- Provide semantic IDs/data attributes for testing.

Illustrative structure:

```tsx
<div
  id="workspace-shell"
  className="workspace-shell"
  data-swapped={wrappersSwapped}
  data-primary-open={primaryWrapperOpen}
  data-assistant-open={assistantWrapperOpen}
>
  {primaryWrapperOpen && (
    <PrimaryWorkspaceWrapper>
      {primaryWorkspace}
    </PrimaryWorkspaceWrapper>
  )}

  {primaryWrapperOpen && assistantWrapperOpen && (
    <MainResizeHandle />
  )}

  {assistantWrapperOpen && (
    <AssistantWrapper>
      {assistantContent}
    </AssistantWrapper>
  )}
</div>
```

This illustrative JSX does not require both wrapper components to remain mounted while closed. The critical no-remount rule applies to swapping. If closing intentionally unmounts wrapper content today, preserve expected behavior only after checking for state loss. Prefer CSS hiding or stable keyed wrappers where unmounting would destroy meaningful unsaved state.

### 9.3 Grid placement

Preferred desktop CSS:

```css
.workspace-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto var(--assistant-wrapper-width);
  grid-template-areas: "primary handle assistant";
}

.workspace-shell[data-swapped="true"] {
  grid-template-columns: var(--assistant-wrapper-width) auto minmax(0, 1fr);
  grid-template-areas: "assistant handle primary";
}

.primary-workspace-wrapper {
  grid-area: primary;
}

.main-resize-handle {
  grid-area: handle;
}

.assistant-wrapper {
  grid-area: assistant;
}
```

Single-wrapper states must use one flexible track and no empty phantom columns.

Do not rely on DOM sibling direction to identify the resized panel.

### 9.4 `PrimaryWorkspaceContent`

Responsibilities:

- Render optional contextual panel.
- Render context resize handle only when contextual panel is both available and open.
- Render center panel.
- Own internal shrink safety:
  - `min-width: 0`
  - `min-height: 0`
  - correct overflow boundaries
- Accept an optional standard inner-context toggle injection point.

Suggested props:

```ts
interface PrimaryWorkspaceContentProps {
  mode: WorkspaceMode;
  contextPanel?: ReactNode;
  centerPanel: ReactNode;
  contextPanelAvailable: boolean;
  contextPanelOpen: boolean;
  onToggleContextPanel?: () => void;
  contextPanelLabel?: string;
}
```

### 9.5 `ContextualPanel`

Responsibilities:

- Apply the shared persisted contextual width.
- Provide one container-query context if required.
- Apply mode-specific ID/data attributes without mode-specific structural duplication.
- Host existing panel component unchanged where possible.

Suggested attributes:

```tsx
data-workspace-mode="documents|tasks|crm|forms|settings"
data-context-panel="file-tree|task-list|crm-list|forms-list|settings-list"
```

### 9.6 `CenterContentPanel`

Responsibilities:

- Provide the common center panel shell.
- Preserve optional subtask bar behavior.
- Provide a standard leading-control slot for the inner-context toggle.
- Avoid forcing child feature components to know top-level layout state.
- Maintain scroll and min-size boundaries.

### 9.7 `AssistantWrapper`

Responsibilities:

- Apply shared assistant width.
- Host:
  - panel subheader where appropriate
  - AI sidebar
  - CRM AI sidebar
  - file viewer
- Preserve container-query name currently expected by AI/detail content, or update all relevant queries atomically.
- Avoid physical names such as “right panel” in new APIs.

Suggested generic names:

```text
assistant-wrapper
assistant-panel
assistant-subheader
```

The file viewer remains assistant-wrapper content even though it is not an AI feature.

### 9.8 Resize handles

Rename:

```text
CenterResizableHandle → MainResizeHandle
useResizable          → useAssistantResize or useMainWrapperResize
LeftResizableHandle   → ContextResizeHandle
useLeftResizable      → useContextPanelResize
```

Handlers must use explicit element refs or a stable shell query, not `previousElementSibling` / `nextElementSibling`.

Preferred API:

```ts
const { onPointerDown } = useAssistantResize({
  shellRef,
  assistantRef,
  swapped: wrappersSwapped,
});
```

Use Pointer Events if practical:

- `onPointerDown`
- pointer capture
- cleanup on pointer up/cancel
- prevent text selection while dragging

Mouse events are acceptable only if the current repository constraints make pointer conversion risky; document the choice.

---

## 10. App composition architecture

### 10.1 Separate mode selection from shell layout

`App.tsx` should resolve a mode layout descriptor rather than passing ambiguous `editor`, `leftPanel`, and `sidebar` fragments.

Suggested contract:

```ts
interface WorkspaceModeLayout {
  mode: WorkspaceMode;
  contextPanel: ReactNode | null;
  centerPanel: ReactNode;
  assistantPanel: ReactNode | null;
  contextPanelAvailable: boolean;
  contextPanelOpen: boolean;
  onToggleContextPanel?: () => void;
  contextPanelLabel?: string;
}
```

A hook or pure resolver may produce this descriptor:

```ts
const modeLayout = useWorkspaceModeLayout({ editor, ... });
```

Then:

```tsx
<AppLayout
  modeLayout={modeLayout}
  subtasksBar={...}
  modals={...}
/>
```

Do not put all feature selection logic into the low-level `WorkspaceShell`.

### 10.2 Mode resolver requirements

The resolver must:

- determine active mode from existing state
- resolve special pages
- choose contextual panel content
- choose center content
- choose assistant content
- pass Settings sub-tab to Settings AI
- preserve CRM context object logic
- avoid creating new elements in unstable ways that remount content on every swap

### 10.3 Terminal and modals

- Terminal remains outside horizontal wrapper ordering.
- Modals remain outside panel overflow clipping.
- Swapping wrappers must not move, duplicate, or resize terminal.
- Existing `Ctrl/Cmd + J` behavior remains unchanged.

---

## 11. Settings integration specification

### 11.1 Required change

Settings must stop being treated as a shell exception.

Remove logic equivalent to:

- “Settings owns the whole center area”
- hide outer AI because Settings is active
- hide all outer panel architecture solely due to `activeView === 'settings'`

Settings may remain represented by `activeView === 'settings'` in the short term if renaming it to a full mode would cause unrelated churn, but shell behavior must treat it as a first-class `WorkspaceMode = 'settings'`.

### 11.2 Reuse existing Settings state

Keep:

- `activeSettingsSubTab`
- `openSettings(subTab?)`
- header Settings tabs

The global `TabBar` remains the Settings sub-tab navigation unless a separate product change requests otherwise.

Do not create duplicate Models/Actions/Appearance/Agents/Tools navigation.

### 11.3 Remove nested Settings layout

The existing pattern:

```tsx
<SettingsDocument>
  <SettingsSection>
    <SettingsPanels>
      <ReusablePageTemplate left + center />
    </SettingsPanels>
  </SettingsSection>
</SettingsDocument>
```

must be replaced so the active section supplies its left and center surfaces to the shared primary workspace content.

Acceptable architectures include:

#### Option A: controller + render slots

```tsx
<SettingsWorkspace>
  {({ contextPanel, centerPanel }) => (
    <PrimaryWorkspaceContent
      mode="settings"
      contextPanel={contextPanel}
      centerPanel={centerPanel}
      ...
    />
  )}
</SettingsWorkspace>
```

#### Option B: section layout descriptor hook

```ts
const settingsLayout = useSettingsSectionLayout(activeSettingsSubTab);
```

#### Option C: provider and sibling slot consumers

Use only if it avoids unnecessary complexity.

The agent must choose the least complex structure that preserves local selection and unsaved form state.

### 11.4 Settings AI

Render:

```tsx
<AISidebar
  workspaceId={null}
  taskId={null}
  settingsTab={activeSettingsSubTab}
  editor={null}
/>
```

Render `RightPanelSubheader` or its renamed generic equivalent with:

```tsx
mode="writer"
settingsTab={activeSettingsSubTab}
```

Remove Settings-specific `hideSwapButton` behavior because swap now lives in the app header.

### 11.5 Settings AI behavior

The Settings chat must:

- maintain separate thread history per Settings sub-tab
- switch active chat context when sub-tab changes
- allow new chats and chat history
- use the existing writer agent/model selection unless product requirements later add a Settings agent
- provide a safe system context identifying the active Settings page

Add a lightweight context block such as:

```text
[Application context]
The user is currently in TABS Settings.
Active settings section: Actions.
Help explain this section and draft or improve configuration content such as
action prompts, agent instructions, model setup guidance, appearance settings,
and tool configuration. Never expose secret values or claim a setting was
changed unless the application actually performed that change.
```

The exact wording can be centralized in a helper:

```ts
buildSettingsAIContext(activeSettingsSubTab)
```

Security requirements:

- Never include provider API keys.
- Never include secure-storage values.
- Never serialize raw secrets into prompts, logs, or chat records.
- Provider names, selected model IDs, and non-secret configuration labels may be included only if needed.

Selected Settings record context is optional for this phase. Do not expand scope into a full settings-editing tool agent unless already supported safely.

---

## 12. State model

### 12.1 New state

Use clear logical names:

```ts
type WorkspaceMode = 'documents' | 'tasks' | 'crm' | 'forms' | 'settings';

interface UIStore {
  primaryWrapperOpen: boolean;
  assistantWrapperOpen: boolean;
  wrappersSwapped: boolean;

  assistantWrapperWidth: number;
  contextPanelWidth: number;

  contextPanelOpenByMode: {
    documents: boolean;
    tasks: boolean;
    crm: boolean;
    forms: boolean;
    settings: boolean;
  };

  setPrimaryWrapperOpen(value: boolean): void;
  setAssistantWrapperOpen(value: boolean): void;
  togglePrimaryWrapper(): void;
  toggleAssistantWrapper(): void;
  setWrappersSwapped(value: boolean): void;
  toggleWrappersSwapped(): void;

  setAssistantWrapperWidth(value: number): void;
  setContextPanelWidth(value: number): void;

  setContextPanelOpen(mode: WorkspaceMode, value: boolean): void;
  toggleContextPanel(mode: WorkspaceMode): void;
}
```

Names may vary slightly, but no new API may use “right panel” or “center panel open” to represent wrapper identity.

### 12.2 Invariants

Centralize invariants in store actions.

#### Invariant 1: at least one top-level wrapper open

```ts
primaryWrapperOpen || assistantWrapperOpen === true
```

#### Invariant 2: swap only changes when both wrappers are open

```ts
canSwapWrappers = primaryWrapperOpen && assistantWrapperOpen
```

If `setWrappersSwapped` is called while swap is unavailable, ignore it.

#### Invariant 3: closing the only visible wrapper opens the other

Pseudo-code:

```ts
togglePrimaryWrapper() {
  if (primaryWrapperOpen && !assistantWrapperOpen) {
    set({
      primaryWrapperOpen: false,
      assistantWrapperOpen: true,
    });
    persistBoth();
    return;
  }

  set({ primaryWrapperOpen: !primaryWrapperOpen });
}
```

Apply symmetrical logic to assistant.

#### Invariant 4: mode navigation opens primary

Mode entry actions must ensure:

```ts
primaryWrapperOpen = true
```

They must not force assistant open.

#### Invariant 5: file viewer does not redefine assistant visibility

`fileViewerOpen` selects assistant content. It is not a second assistant visibility flag.

### 12.3 Derived selectors

Add selectors with logical names:

```ts
selectCanSwapWrappers
selectIsPrimaryWrapperOpen
selectIsAssistantWrapperOpen
selectActiveWorkspaceMode
selectIsContextPanelAvailable
selectIsContextPanelOpen
```

Remove or stop using:

```text
selectIsMainRowSwapped
selectIsRightPanelOpen
selectCanSwapPanels
toggleRightPanel
```

Temporary aliases are allowed only during one migration phase and must be removed before completion.

### 12.4 Persistence keys

Recommended keys:

```text
primaryWrapperOpen
assistantWrapperOpen
wrappersSwapped
assistantWrapperWidth
contextPanelWidth
contextPanelOpenByMode
```

Use the existing `db.settings` persistence pattern.

### 12.5 Migration from old persisted state

Migration must be deterministic and backward-compatible for one release.

Recommended mapping:

```ts
primaryWrapperOpen =
  stored.primaryWrapperOpen ??
  true;

assistantWrapperOpen =
  stored.assistantWrapperOpen ??
  stored.aiSidebarOpen ??
  true;

wrappersSwapped =
  stored.wrappersSwapped ??
  stored.panelsSwapped ??
  false;

assistantWrapperWidth =
  stored.assistantWrapperWidth ??
  stored.sidebarWidth ??
  33;

contextPanelWidth =
  stored.contextPanelWidth ??
  stored.fileExplorerWidth ??
  22;
```

Context panel states:

```ts
contextPanelOpenByMode.documents =
  stored.contextPanelOpenByMode?.documents ??
  stored.fileExplorerOpen ??
  false;

contextPanelOpenByMode.tasks =
  stored.contextPanelOpenByMode?.tasks ??
  stored.taskListOpen ??
  true;

contextPanelOpenByMode.crm =
  stored.contextPanelOpenByMode?.crm ??
  true;

contextPanelOpenByMode.forms =
  stored.contextPanelOpenByMode?.forms ??
  true;

contextPanelOpenByMode.settings =
  stored.contextPanelOpenByMode?.settings ??
  true;
```

After loading and persisting new values:

- do not immediately delete old Dexie keys if rollback compatibility matters
- stop writing old keys
- remove old TypeScript fields and call sites
- document deprecated stored keys

### 12.6 Obsolete state audit

Agents must search all references before removal.

Candidates:

```text
sidebarOpen
setSidebarOpen
fileViewerPreviousSidebarOpen
fileViewerPreviousSidebarWidth
aiSidebarOpen
setAiSidebarOpen
centerPanelOpen
setCenterPanelOpen
panelsSwapped
setPanelsSwapped
fileExplorerOpen
setFileExplorerOpen
taskListOpen
setTaskListOpen
fileExplorerWidth
setFileExplorerWidth
```

Not every candidate must be deleted blindly.

Rules:

- Replace top-level visibility fields with wrapper state.
- Replace internal context visibility with `contextPanelOpenByMode`.
- Replace generic width misuse with `contextPanelWidth`.
- Simplify File Viewer previous-state restoration to assistant wrapper semantics.
- Remove fields only after all references are migrated and behavior is covered.

---

## 13. Toggle control specification

### 13.1 Navigation rail workspace toggle

Existing ID may remain:

```text
nav-btn-toggle-panel
```

Behavior:

```ts
onClick={togglePrimaryWrapper}
```

State:

```ts
aria-pressed={primaryWrapperOpen}
className includes active state when primaryWrapperOpen
```

Labels:

```text
Hide workspace
Show workspace
```

Keep `PanelLeft` icon.

It must not inspect:

- task mode
- file explorer state
- task list state
- physical left/right position

### 13.2 Header control group

Required order:

```tsx
<TerminalToggle />
<WrapperSwapButton />
<AssistantToggle />
```

#### Swap button

- icon: `ArrowLeftRight`
- visible in all modes
- disabled when `!canSwapWrappers`
- greyed out using native `disabled` plus disabled styling
- click toggles `wrappersSwapped`
- labels:
  - normal: `Swap workspace and assistant`
  - swapped: `Restore workspace and assistant order`
- `aria-pressed={wrappersSwapped}`
- `aria-disabled={!canSwapWrappers}` or native disabled semantics

#### Assistant toggle

Keep `PanelRight` icon.

Behavior:

```ts
onClick={toggleAssistantWrapper}
```

Labels:

```text
Hide assistant
Show assistant
```

It does not refer to “right panel.”

### 13.3 Inner contextual panel toggle

Because the navigation rail button now controls the whole primary wrapper, add a separate generic context-panel toggle.

Requirements:

- only visible when primary wrapper is open
- only enabled when the active page supports a contextual panel
- toggles `contextPanelOpenByMode[activeMode]`
- uses a visually distinct panel/columns icon
- appears in a stable leading-control area of the center panel header
- if the active feature supplies its own center header, inject the control rather than overlaying content
- labels use the actual panel:
  - Show file tree / Hide file tree
  - Show task list / Hide task list
  - Show CRM list / Hide CRM list
  - Show Forms list / Hide Forms list
  - Show Settings list / Hide Settings list

Do not place a floating button over editable content.

---

## 14. Resize behavior

### 14.1 Assistant width storage

Continue storing width as viewport percentage only if changing units would cause excessive scope. Rename the state to reflect the assistant wrapper.

Preferred clamp:

```text
minimum: 320px
maximum: shell width - primary minimum width - handle width
```

The primary wrapper must retain a usable minimum width.

### 14.2 Main resize algorithm

Do not use sibling traversal.

At pointer down:

1. Resolve shell rectangle.
2. Resolve assistant rectangle.
3. Store:
   - pointer start X
   - assistant starting width
   - which side assistant occupies
4. On pointer move:
   - compute delta based on assistant side
   - clamp width
   - persist through store action
5. On pointer up/cancel:
   - remove listeners/capture
   - clear dragging class

Pseudo-code:

```ts
const direction = wrappersSwapped ? 1 : -1;
const nextWidth = startWidth + deltaX * direction;
```

Verify direction manually; do not trust this pseudo-code without geometry testing.

### 14.3 Context resize algorithm

Context panel always occupies the left side within the primary wrapper.

It uses shared `contextPanelWidth`.

Clamp to existing visual expectations, approximately:

```text
min: 260px
max: 420px
```

or existing token bounds.

Do not allow the center content to collapse below its minimum usable width.

### 14.4 Drag styling

During either resize:

- set an appropriate root data attribute or body class
- use global `cursor: col-resize`
- disable text selection
- remove state reliably on pointer cancel/unmount

---

## 15. File Viewer behavior

### 15.1 Content selection

Assistant content precedence:

```ts
if (fileViewerOpen) {
  return <FileViewerPanel />;
}

return modeSpecificAssistant;
```

### 15.2 Open behavior

Opening a file viewer item:

- selects File Viewer as assistant content
- ensures `assistantWrapperOpen = true`
- remembers no obsolete “sidebarOpen” state
- does not modify `wrappersSwapped`
- does not modify primary visibility

### 15.3 Hide assistant behavior

If the user hides assistant while File Viewer is active:

- keep `fileViewerOpen` and selected file state
- hide wrapper
- reopening assistant shows the same File Viewer

### 15.4 Explicit File Viewer close

Closing File Viewer:

- clears File Viewer item
- returns assistant content to mode-specific AI
- does not force assistant visibility unless existing UX explicitly requires it

---

## 16. Responsive behavior

### 16.1 Desktop breakpoint

Use existing project breakpoint unless a token already defines it.

Target:

```css
@media (min-width: 901px) { ... }
@media (max-width: 900px) { ... }
```

### 16.2 Narrow layout

At `max-width: 900px`:

```text
primary wrapper: inline base workspace
assistant wrapper: fixed/right drawer when both wrappers are open
main handle: hidden
swapped visual order: ignored
```

Requirements:

- Assistant always enters from right.
- Do not mutate `wrappersSwapped`.
- Assistant drawer width uses a safe responsive cap.
- Drawer must not extend under the fixed navigation rail incorrectly.
- Drawer has adequate z-index and background.
- Focus and pointer interaction remain usable.
- Existing close/toggle control remains accessible in the global header.

### 16.3 Only assistant open on narrow width

When primary is closed and assistant is the only open wrapper:

- assistant becomes the main inline/full workspace surface, or a drawer sized to fill the available workspace
- do not leave an empty background behind a narrow drawer
- avoid modal-like focus trapping unless the application already uses it

### 16.4 Contextual panel at narrow width

The contextual panel may be automatically hidden below 900px using CSS or a derived responsive state.

Do not overwrite persisted `contextPanelOpenByMode`.

When viewport returns to desktop, restore its stored visibility.

### 16.5 Very narrow width

Preserve existing minimum 320px shell support.

- no horizontal document scroll
- primary and assistant bodies use internal scrolling
- navigation rail remains usable
- header controls do not overflow silently; use existing overflow strategy or compact gaps

---

## 17. CSS and DOM cleanup requirements

### 17.1 Remove obsolete selectors

After migration, remove selectors that no longer describe the DOM, including candidates such as:

```text
#main-row
.main-row--swapped
.main-row--single-panel
.detail-panel
#center-resize-handle
.center-resize-handle
```

Do not leave dead compatibility CSS.

### 17.2 Replace physical naming

Avoid new classes such as:

```text
right-panel
left-main
center-swapped
```

Prefer:

```text
primary-workspace-wrapper
assistant-wrapper
contextual-panel
center-content-panel
workspace-shell
workspace-shell--swapped
```

### 17.3 Reduce unnecessary wrappers

A wrapper is justified only if it:

- owns layout
- owns overflow boundary
- owns semantic/test identity
- owns container-query context
- owns state or event handling
- is required for styling that cannot be placed safely on a child

Remove wrappers used only to stack utility classes that can be placed on the semantic component.

### 17.4 Remove duplicated styles

- Consolidate repeated inline panel styles into classes.
- Preserve truly dynamic widths as style variables.
- Move hardcoded repeated paddings/backgrounds into existing tokens/classes where safe.
- Do not perform a broad unrelated design-token migration.

### 17.5 Shrink safety

Every flex/grid boundary in the new shell must be audited for:

```css
min-width: 0;
min-height: 0;
overflow: hidden;
```

Scrollable children, not arbitrary ancestors, own `overflow: auto`.

### 17.6 Container queries

If current AI/detail content relies on `container-name: detail-panel`, either:

- preserve that container name on `AssistantWrapper`, or
- update every query in the same phase

Do not break responsive composer/sidebar behavior.

---

## 18. Accessibility requirements

1. All three header controls use native `<button>`.
2. Disabled swap uses native `disabled`.
3. Toggle buttons expose:
   - accurate `title`
   - accurate `aria-label`
   - `aria-pressed`
4. Resize handles:
   - retain pointer cursor and adequate hit target
   - should use `role="separator"`
   - should include:
     - `aria-orientation="vertical"`
     - meaningful label
     - `aria-valuemin`
     - `aria-valuemax`
     - `aria-valuenow`
5. Keyboard resize is recommended:
   - Arrow Left/Right changes width by small increments
   - Shift + Arrow changes by larger increments
6. Swapping must not move keyboard focus unexpectedly.
7. Closing a wrapper containing focus:
   - move focus to its corresponding toggle button
   - do not leave focus in hidden DOM
8. Drawer behavior must not make header controls inaccessible.

Keyboard resizing may be deferred only if documented as a follow-up and current handles are not keyboard accessible. All button semantics are mandatory.

---

## 19. Performance and state preservation

1. CSS swapping must not cause React remounts.
2. Do not use different `key` values for normal/swapped placement.
3. Memoize mode descriptors only when necessary; do not add premature complexity.
4. Avoid global store subscriptions to the full UI store in large layout components.
5. Use selectors for individual values/actions.
6. Do not recreate chat contexts unnecessarily on width drag.
7. Width updates may be frequent:
   - Zustand updates are acceptable
   - Dexie writes should be throttled/debounced if drag causes excessive writes
   - final pointer-up persistence is preferred
8. Preserve local Settings form state while swapping.
9. Do not reload chat threads on swap; only context changes should reload them.

---

## 20. Implementation phases

### Phase 0 — Audit and implementation map

No code changes.

Deliver:

- reference inventory for old state/actions/selectors
- CSS selector inventory
- mode matrix verified against current code
- Settings section structure map
- proposed exact file plan
- identified tests/build constraints

### Phase 1 — State model and migration

Implement:

- new wrapper state
- new width names
- context panel state
- invariant-preserving actions
- selectors
- persistence migration
- focused store tests if test infrastructure exists

Do not yet rewrite full layout.

Temporary compatibility selectors/actions are allowed only within this phase and the next.

### Phase 2 — Shared shell primitives

Implement:

- `WorkspaceShell`
- wrappers
- internal primary layout
- renamed resize handles/hooks
- desktop CSS Grid placement
- single-wrapper states
- no-remount swap

Wire Documents first as a vertical slice.

### Phase 3 — All mode adapters and Settings extraction

Migrate:

- Tasks
- CRM
- Forms
- Settings
- special center-only pages
- Settings left/center extraction
- Settings AI sidebar and sub-tab chat context

Remove Settings shell exception.

### Phase 4 — Global controls and interaction rules

Implement:

- nav workspace toggle
- terminal/swap/assistant header order
- disabled swap
- inner contextual toggle
- focus behavior
- File Viewer assistant ownership
- logical labels and selectors

Remove swap from `RightPanelSubheader`.

### Phase 5 — Responsive behavior and resize hardening

Implement:

- right-side assistant drawer below 900px
- swapped visual order ignored below breakpoint
- single-wrapper narrow behavior
- auto-hidden context panel without persisted mutation
- pointer/keyboard resize behavior
- overflow audit

### Phase 6 — Cleanup and regression

Remove:

- old state and actions
- compatibility aliases
- old component names
- dead wrappers
- dead CSS
- stale comments

Run full validation and manual matrix.

### Phase 7 — Independent review/fix pass

A fresh agent reviews:

- PRD compliance
- state invariants
- no-remount behavior
- mode regressions
- responsive behavior
- CSS dead code
- security of Settings AI context

Fix only confirmed defects.

---

## 21. Acceptance criteria

### 21.1 Structural

- [ ] Exactly two logical top-level wrappers exist in the horizontal shell.
- [ ] Main resize handle is between them.
- [ ] Context panel and center content are inside primary wrapper.
- [ ] AI/File Viewer is inside assistant wrapper.
- [ ] No duplicated normal/swapped JSX.
- [ ] Swap uses CSS placement/order.
- [ ] Terminal and modals are not swapped.

### 21.2 Toggle behavior

- [ ] Nav toggle always controls primary wrapper.
- [ ] Assistant toggle always controls assistant wrapper.
- [ ] Physical side does not change control meaning.
- [ ] At least one wrapper always remains open.
- [ ] Closing the only visible wrapper opens the other atomically.
- [ ] Mode changes open primary and preserve assistant state.
- [ ] Inner context panel has a separate toggle.

### 21.3 Swap

- [ ] Works in Documents.
- [ ] Works in Tasks.
- [ ] Works in CRM.
- [ ] Works in Forms.
- [ ] Works in Settings.
- [ ] Disabled when either wrapper is closed.
- [ ] Does not remount editor/chat/settings forms.
- [ ] Preserves widths.

### 21.4 Resize

- [ ] Main handle always resizes assistant.
- [ ] Direction works correctly in both orders.
- [ ] Context handle resizes contextual panel.
- [ ] Widths persist across mode, swap, and restart.
- [ ] Center content cannot be crushed below usable minimum.
- [ ] Drag cleanup works after pointer cancellation.

### 21.5 Settings

- [ ] Settings no longer hides outer shell as an exception.
- [ ] Nested `ReusablePageTemplate` is removed from active Settings layout.
- [ ] Every Settings sub-tab supplies contextual and center content.
- [ ] Settings AI is visible in assistant wrapper.
- [ ] Chat history is scoped per Settings sub-tab.
- [ ] Swap works in Settings.
- [ ] Settings AI context includes active sub-tab.
- [ ] No secret values are injected.

### 21.6 File Viewer

- [ ] Opens in assistant wrapper.
- [ ] Moves with assistant on desktop.
- [ ] Hiding assistant preserves File Viewer state.
- [ ] Reopening assistant restores active File Viewer.
- [ ] Closing viewer returns to correct mode AI.

### 21.7 Responsive

- [ ] At or below 900px assistant always opens from right.
- [ ] Swapped state is visually ignored but persisted.
- [ ] Returning to desktop restores order.
- [ ] Main resize handle hidden on narrow layouts.
- [ ] Only-assistant state fills usable workspace.
- [ ] No horizontal page scroll at 320px.

### 21.8 Cleanup

- [ ] Obsolete state names removed.
- [ ] Obsolete selectors removed.
- [ ] `CenterResizableHandle` removed/renamed.
- [ ] `toggleRightPanel` removed.
- [ ] `selectIsRightPanelOpen` removed.
- [ ] stale comments updated.
- [ ] no dead normal/swapped branches remain.

### 21.9 Quality

- [ ] `npm run build` passes.
- [ ] `npm run lint` passes or only pre-existing explicitly documented errors remain.
- [ ] focused tests pass.
- [ ] no new console errors.
- [ ] no TypeScript suppression added without justification.
- [ ] no secrets logged or prompted.

---

## 22. Manual regression matrix

Test at minimum:

- Desktop widths: 1920, 1440, 1280, 1024, 901 px
- Narrow widths: 900, 768, 640, 320 px
- Both default and cyberpunk themes if both remain supported

For each mode:

### Documents

- [ ] both wrappers normal
- [ ] both wrappers swapped
- [ ] primary only
- [ ] assistant only
- [ ] file tree open/closed
- [ ] resize context panel
- [ ] resize assistant both orders
- [ ] edit text, swap, verify selection/content
- [ ] AI chat send/stream while swapping
- [ ] File Viewer open/hide/reopen/close

### Tasks

- [ ] list page with task list
- [ ] calendar page
- [ ] projects page without context list
- [ ] task selection preserved after swap
- [ ] subtasks bar preserved
- [ ] task AI context remains correct

### CRM

- [ ] leads
- [ ] contacts
- [ ] companies
- [ ] activities
- [ ] pipeline without context list
- [ ] selected CRM entity context correct
- [ ] CRM AI remains correct after swap

### Forms

- [ ] forms list
- [ ] builder
- [ ] submissions
- [ ] form selection preserved
- [ ] CRM/Forms AI context remains correct

### Settings

For each sub-tab:

- [ ] left list/category visible
- [ ] center editor visible
- [ ] inner context toggle
- [ ] Settings AI visible
- [ ] distinct chat context
- [ ] swap preserves selected item and unsaved field value
- [ ] no nested layout overflow

### Controls

- [ ] nav toggle labels/states correct normal
- [ ] nav toggle labels/states correct swapped
- [ ] assistant toggle labels/states correct normal
- [ ] assistant toggle labels/states correct swapped
- [ ] swap button order correct
- [ ] swap disabled in both single-wrapper states
- [ ] attempt to close only wrapper opens other
- [ ] mode switch opens primary

### Terminal

- [ ] open/close before and after swap
- [ ] resize terminal if supported
- [ ] horizontal wrappers do not enter terminal row
- [ ] Ctrl/Cmd+J remains functional

---

## 23. Validation commands

The repository currently defines:

```bash
npm run build
npm run lint
```

Agents must inspect whether test scripts or local test tooling have been added since this PRD was written.

Recommended final sequence:

```bash
npm install
npm run build
npm run lint
```

If using an existing install:

```bash
npm run build
npm run lint
```

Do not alter lint configuration to hide new errors.

---

## 24. Risks and mitigations

### Risk: Settings state loss during extraction

**Mitigation:** Keep selection/form state in a controller/provider mounted once for the active sub-tab. Do not split state into disconnected sibling components without shared ownership.

### Risk: editor/chat remount on swap

**Mitigation:** CSS Grid areas; stable component keys; no conditional reversed JSX.

### Risk: resize direction inversion

**Mitigation:** explicit assistant ref and geometry tests in both orders.

### Risk: blank workspace from both wrappers closed

**Mitigation:** central store invariants and focused action tests.

### Risk: stale physical-side selectors

**Mitigation:** remove `rightPanel` concepts and search entire repository before completion.

### Risk: Settings AI leaks secrets

**Mitigation:** dedicated safe context builder; never read secure storage for context generation.

### Risk: nested overflow regressions

**Mitigation:** audit every new grid/flex boundary for `min-width: 0`, `min-height: 0`, and correct scroll owner.

### Risk: large refactor overwhelms a smaller coding model

**Mitigation:** follow phased prompts in `prompts.md`; each phase has a narrow contract and verification gate.

---

## 25. Required final implementation report

The implementation agent must report:

1. Files added.
2. Files modified.
3. Files removed.
4. State fields migrated.
5. Old fields/selectors intentionally retained and why.
6. Validation commands and results.
7. Manual states tested.
8. Known limitations.
9. Any deviation from this PRD, with explicit rationale.

A claim of completion without this report is incomplete.
