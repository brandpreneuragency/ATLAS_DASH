# Progress: Settings Panel Refactor

## Goal
Replace the monolithic Settings modal with a left-panel-based settings menu. The settings button on the NarrowSidebar opens a SettingsPanel that temporarily replaces the left panel (file explorer / task list). The panel shows a vertical menu (Models, Agents, Actions, Appearance). Each menu item opens its own focused modal popup.

## Current Status
- Agent 1: Complete
- Agent 2: Not Started
- Agent 3: Not Started
- Agent 4: Not Started

## Completed Steps
- Investigated project architecture (modals, header, layout, sidebar, uiStore)
- Collected clarifying answers from user
- Agent 1: Added `settingsPanelOpen` to uiStore, wired AppLayout to render SettingsPanel, updated NarrowSidebar settings button, created SettingsPanel component

## Current Step
Agent 1 complete. Ready for Agent 2.

## Remaining Steps
- Agent 2: Create ModelsSettingsPopup and AgentsSettingsPopup, wire into SettingsPanel
- Agent 3: Create ActionsSettingsPopup and AppearanceSettingsPopup, wire into SettingsPanel
- Agent 4: Cleanup — remove SettingsModal, FontSettingsModal, update activeModal type, clean i18n

## Files Changed

### Agent 1
- `src/stores/uiStore.ts` — added `settingsPanelOpen: boolean` (default `false`), added `setSettingsPanelOpen` setter (non-persisted, transient)
- `src/components/layout/AppLayout.tsx` — imported SettingsPanel; renders SettingsPanel in left panel slot when `settingsPanelOpen`; hides file explorer / task list / resize handle when settings is open
- `src/components/layout/NarrowSidebar.tsx` — settings button now toggles `settingsPanelOpen`; shows `nav-btn--on` class when active
- `src/components/settings/SettingsPanel.tsx` — new component: header with X close + vertical menu of 4 items (Models, Agents, Actions, Appearance). Each item sets local `activeSection` state. Popups NOT yet wired (Agent 2 & 3).

## Important Context
- SettingsPanel is a NEW component, not a modal. It lives in the left panel slot.
- Existing SettingsModal is NOT removed by Agent 1 (Agent 4 handles deletion). After Agent 1, the old modal is unreachable from the navbar but still in the bundle.
- The settings button no longer opens the old modal. It opens the new panel.
- Menu items (Models, Agents, Actions, Appearance) currently only update local `activeSection` state. They do NOT open popups yet — that's Agent 2 & 3's job.
- `setSettingsPanelOpen` does NOT persist to db. Settings panel is transient UI state.
- SettingsPanel uses `fileExplorerWidth` for its width (15–40vw range, same as other left panels).

## Verification Performed
- `npx tsc --noEmit` passes with zero errors
- Grep confirms `NarrowSidebar` no longer references `setActiveModal('settings')`
- Grep confirms `SettingsPanel` is imported and rendered in `AppLayout.tsx`
- Grep confirms `settingsPanelOpen` and `setSettingsPanelOpen` are in `uiStore.ts`
- `get_errors` reports only pre-existing inline-style lint warnings; no new errors

## Known Issues / Blockers
- None

## Next Agent Instructions
Agent 2: Create `src/components/settings/ModelsSettingsPopup.tsx` and `src/components/settings/AgentsSettingsPopup.tsx`.

For ModelsSettingsPopup:
- Modal pattern: `<div className="overlay">` → `<div className="modal modal--md">` → `modal-head` (title + X) → `modal-body`
- Accept `onClose: () => void` prop
- List provider configs from `useAIStore((s) => s.providerConfigs)` with selected models
- "Manage Providers" button at bottom that calls `setActiveModal('modelManagement')`

For AgentsSettingsPopup:
- Same modal pattern
- Two tabs: Writers / Tasks (styled like language picker in old SettingsModal)
- Active tab renders `<CharactersPanel scope={activeTab} />`
- "Add Agent" button calls `setActiveModal('agentEditor')`

Wire into SettingsPanel: add `popupOpen: 'models' | 'agents' | 'actions' | 'appearance' | null` state. Menu items set this state. Render popups conditionally. Use i18n keys for new strings. Add keys to `en.ts` and `tr.ts`.
