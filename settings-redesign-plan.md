# Settings Redesign — Implementation Plan

Settings becomes a **special "Settings" document tab** in the existing `TabBar`
(alongside normal docs) instead of the left-rail `SettingsPanel` + modals. Inside
the Settings doc: a fixed, non-closable sub-tab strip (**Models · Actions ·
Appearance · Agents**) above a left+center `ReusablePageTemplate` (right panel
closed). The three manager modals are removed; all call sites are rewired to open
the Settings doc on the relevant sub-tab.

## State model (uiStore additions)
- `activeView: 'document' | 'settings'` — which doc-mode tab is active.
- `activeSettingsSubTab: 'models' | 'actions' | 'appearance' | 'agents'`.
- `openSettings(subTab?)` — switches to the Settings tab + sets sub-tab.
- `setActiveView`, `setActiveSettingsSubTab`.
- `documentStore.setActiveDocument` also sets `activeView='document'` (it already imports `useUIStore`).
- The Settings tab is **always present** in the TabBar (doc mode), non-closable, rendered first.
- `settingsPanelOpen` left-rail is removed from `AppLayout`; the uiStore field is left (harmless) to avoid churn.

## Shell
- `TabBar`: prepend a non-closable "Settings" tab (active when `activeView==='settings'`). Clicking it → `openSettings()` (keeps last sub-tab). The global "+" stays for normal docs.
- `App.tsx` `activeWorkspace`: in doc mode, render `<SettingsDocument/>` when `activeView==='settings'`, else `<EditorWorkspace/>`.
- `AppLayout`: when `settingsActive = activeView==='settings' && !taskMode && !pageMode && !crmOrForms`, hide the outer file-explorer + AI-sidebar (mirror `pageMode`), so the center `SettingsDocument` owns the full area.
- New `src/components/settings/SettingsDocument.tsx`: sub-tab strip + `ReusablePageTemplate` (left open, center open, **right closed**) with per-sub-tab left/center content.
- New `src/components/settings/settings.css` for new styles (avoid touching the pre-existing `index.css`/`Tab.tsx` working-tree edits).

## Sections
### Models (reuse `aiStore`)
- Left: provider list (`providerConfigs`) with status; click → `setActiveProvider` + focus-expand in center; "Add provider" opens the connect drawer.
- Center: existing `ModelManagementContent isInline` (extracted to `src/components/settings/ModelsContent.tsx` so `ModelManagementModal.tsx` can be deleted). Add an optional `focusProviderId` prop (backward compatible) so the left selection expands that provider's editor. Preserves connect/import/custom models/web search.

### Actions (extend quick-prompts; folder grouping; native HTML5 DnD)
- New `src/stores/actionsStore.ts` (Zustand): loads `db.quickPrompts` + new `db.actionGroups`; CRUD + grouping + reorder.
- Type additions: `QuickPrompt.groupId?`, `QuickPrompt.order?`, `QuickPrompt.icon?`; new `ActionGroup { id, name, scope, order }`.
- Dexie bump to v10: add `actionGroups: 'id, scope, order'`.
- Left: actions grouped into folders; right-click → context menu ("Add to group…"/"New group…"); HTML5 drag to reorder within/between groups and nest into groups.
- Center: detail editor (title, prompt, scope, group, icon, delete) — reuses `ActionForm`-style fields.

### Appearance (new theme-tokens store + loader; live :root)
- New `src/stores/themeStore.ts`: `tokens: Record<string,string>` overrides; `loadThemeTokens()` applies to `:root` via `style.setProperty`; `setToken(name,value)` / `resetToken(name)` persist. Persistence: Dexie `db.settings` key `themeTokens` (JSON) — matches the repo's existing Dexie persistence pattern (works in browser + Tauri; no FS dependency).
- Schema: `{ version: 1, tokens: { "--c-background-1": "#f5f5f5", "--fs-sm": "14px", ... } }` (only overrides; defaults come from CSS).
- Left: token categories — Text/Font, Color, Spacing, Radius, Shadows, Theme.
- Center: editors for the category — color picker for `--c-*`, slider/number for `--space-*`/`--radius-*`, font select for `--c-font-1`/`--fs-*`, shadow text input for `--shadow-*`. Includes existing font settings (`editorFontFamily`/`editorFontSize`), language, and theme picker (default/cyberpunk).
- Loaded at startup (called from `loadUISettings`).

### Agents (reuse `aiStore` + `AgentEditor`)
- Left: agents grouped by scope (writer/task); "+ New Agent".
- Center: agent detail editor — reuse `AgentEditor` form, extracted to non-modal `src/components/settings/AgentEditorForm.tsx` (no overlay; controlled by `editingAgentId`).

## Modals removed + rewired call sites
Remove:
- `src/components/modals/ModelManagementModal.tsx` (move `ModelManagementContent` → `settings/ModelsContent.tsx`; update `PageTemplatePage` import).
- `src/components/modals/AgentsManagerModal.tsx`
- `src/components/modals/ActionsManagerModal.tsx`
- `src/components/modals/WritersManagerModal.tsx`, `TaskProfilesManagerModal.tsx` (superseded by Agents sub-tab — single source of truth).
- `src/components/settings/SettingsPanel.tsx` (old left-rail).
- `App.tsx`: drop the above from the modals block.
- **Keep** `QuickPrompts.tsx` — it is a distinct in-chat prompt picker (`onSelectPrompt`), not the same concept as `ActionsManagerModal`.

Rewire (→ `openSettings(subTab)`):
- `AIModelSelector` "Manage API Keys & Models" → `openSettings('models')`.
- `SidebarHeader`: "Manage Models" → models; "Manage Writers" → agents; "Manage Actions" → actions.
- `ChatInput`: "Manage Actions" → actions; "Manage Models" → models; "Manage Writers/Task Profiles" → agents.
- `ModelsPanel` "Manage" → models.
- `SettingsModal`'s "Manage Providers" button — `SettingsContent` stays (used by `PageTemplatePage` page-mode); `SettingsModal` itself is currently unreached (no caller sets `activeModal='settings'`); drop the modal wrapper from App, keep `SettingsContent` export.
- Add a Settings gear entry in `LeftNarrowSidebar` (CSS `#nav-btn-settings` already exists).

## Non-goals / preserved
- Task mode, page mode (incl. `PageTemplatePage`), CRM, Forms behavior unchanged.
- Existing 3-panel visual logic preserved.
- `aiStore` providers/models, agents, and quick-prompts data preserved.

## Assumptions to flag
- Models center reuses the full `ModelManagementContent` accordion (with left-list focus-expand) rather than a strict single-provider-only view — to preserve connect/import/web-search without rebuilding the editor.
- Theme tokens persisted via Dexie (not a Tauri FS JSON file) to match the repo's existing persistence approach.
- `WritersManagerModal`/`TaskProfilesManagerModal` removed (not in the named list) because the Agents sub-tab is the single source of truth for agents; their 2 call sites rewired to Agents.
- `QuickPrompts` (in-chat picker) kept.
