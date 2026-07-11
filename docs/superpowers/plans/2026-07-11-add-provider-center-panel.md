# Add Provider Center Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the Add Provider connect flow in the Settings → Models center panel and remove the right-side drawer overlay.

**Architecture:** `ModelsSection` owns `addProviderOpen` and swaps `centerMain` between `ConnectProviderPanel` and existing detail/Defaults/empty views. Refactor `ConnectProviderDrawer` into an inline panel (no scrim/dialog). Fix selection reconciliation so cancel can leave `selectedProviderId` as `null`.

**Tech Stack:** React, TypeScript, existing `useAIStore.connectNewProvider`, settings CSS / `index.css` preset styles.

## Global Constraints

- Do not change `connectNewProvider` store contract.
- No drawer/scrim/modal for Add Provider.
- Cancel/Escape from presets → `addProviderOpen = false` and `selectedProviderId = null`.
- Provider/Defaults click while adding → exit add mode and show that selection.
- Preserve unrelated worktree changes; edit only required hunks.
- User said implement — execute inline after plan is saved; commit only if user asks.

---

### Task 1: Create `ConnectProviderPanel`

**Files:**
- Create: `src/components/settings/modelProviders/ConnectProviderPanel.tsx`
- Delete: `src/components/modals/modelProvider/ConnectProviderDrawer.tsx` (after ModelsSection switches)
- Modify comments only if needed: `src/services/ai/openai.ts`, `src/services/ai/router.ts`

**Interfaces:**
- Produces: `export function ConnectProviderPanel({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected?: (providerId: string) => void }): JSX.Element | null`

- [x] **Step 1:** Create `ConnectProviderPanel.tsx` by adapting drawer logic:
  - Keep preset → form → Connect, phases, errors, focus, Escape (form→presets→onClose), `connectNewProvider`.
  - Remove scrim, `role="dialog"`, `aria-modal`, drawer head title, and X close button.
  - Keep form-step back button, Cancel, and Connect in panel chrome.
  - Root: `div.connect-provider-panel` with body + foot; return `null` when `!open`.
  - Reset state when `open` becomes true.
  - On success call only `onConnected` (not `onClose`) so cancel-clear-selection does not wipe the new provider.

- [x] **Step 2:** Add panel layout CSS in `src/components/settings/settings.css` (full-height column, padded body, foot actions). Keep `.connect-preset-btn*` in `index.css`. Leave unused drawer/scrim rules in place (narrow cleanup optional).

- [x] **Step 3:** Verify no remaining imports of `ConnectProviderDrawer` after Task 2; delete the drawer file; update openai/router comments to say `ConnectProviderPanel`.

---

### Task 2: Wire `ModelsSection` center mode

**Files:**
- Modify: `src/components/settings/ModelsSection.tsx`
- Modify: `src/components/settings/settings.css` (active add button)

**Interfaces:**
- Consumes: `ConnectProviderPanel` from Task 1

- [x] **Step 1:** Import `ConnectProviderPanel`. Remove drawer import/render beside `SettingsPanels`.

- [x] **Step 2:** Fix selection reconciliation so `null` is not auto-replaced:

```ts
useEffect(() => {
  if (!selectedProviderId) return;
  if (providerConfigs.some((p) => p.id === selectedProviderId)) return;
  const connected = providerConfigs.find((p) => p.status === 'connected');
  setSelectedProviderId(connected?.id ?? providerConfigs[0]?.id ?? null);
}, [providerConfigs, selectedProviderId]);
```

- [x] **Step 3:** Provider and Defaults clicks: `setAddProviderOpen(false)` then set selection.
- [x] **Step 4:** Add button: `setAddProviderOpen(true)`; class includes `settings-add-btn--active` when `addProviderOpen`.
- [x] **Step 5:** `onClose` from panel: `setAddProviderOpen(false); setSelectedProviderId(null)`.
- [x] **Step 6:** `handleProviderConnected`: set selected id, `setAddProviderOpen(false)`.
- [x] **Step 7:** When `addProviderOpen`, `centerHeader` = Add Provider title; `centerMain` = `<ConnectProviderPanel open onClose={...} onConnected={...} />`. Else existing Defaults / `ModelManagementContent`. List-item `--active` only when `!addProviderOpen`.

- [x] **Step 8:** Manual verify checklist from the design spec (no drawer; cancel → empty center; rail click exits add).

---

### Task 3: Plan/spec alignment check

- [x] Confirm design manual verification items 1–8 are covered by Tasks 1–2.
- [x] Run `npm run build` (or project typecheck) and fix only errors introduced by this change.
  - Build still fails on pre-existing errors in `TipTapEditor.tsx`, `FileExplorerPanel.tsx`, `workspaceStore.ts` — none from this slice.
