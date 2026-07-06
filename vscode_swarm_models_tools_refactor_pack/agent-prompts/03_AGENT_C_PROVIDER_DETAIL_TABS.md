# Agent C Prompt — Provider Detail Tabs

You are Agent C. Your branch is:

```txt
feature/provider-detail-tabs
```

## Goal

Replace the center-panel provider accordion UX with a selected-provider detail panel and tabs.

Do not implement all deep logic in this branch. Create the structure and wire it to existing provider data as safely as possible. Agent D and E will fill/refine specific tab behavior.

## Files to inspect first

```txt
src/components/settings/ModelsContent.tsx
src/components/settings/ModelsSection.tsx
src/components/modals/modelProvider/*
src/stores/aiStore.ts
src/types/index.ts
src/components/settings/settings.css
```

## Add files

```txt
src/components/settings/modelProviders/ProviderDetailPanel.tsx
src/components/settings/modelProviders/ProviderConnectionTab.tsx
src/components/settings/modelProviders/ProviderModelsTab.tsx
src/components/settings/modelProviders/ProviderDefaultsTab.tsx
src/components/settings/modelProviders/ProviderUsageTab.tsx
src/components/settings/modelProviders/ProviderAdvancedTab.tsx
src/components/settings/modelProviders/ProviderList.tsx
src/components/settings/modelProviders/ProviderListItem.tsx
src/components/settings/modelProviders/ProviderTabs.tsx
```

## Refactor or reuse

Reusable components to keep if useful:

```txt
src/components/modals/modelProvider/ProviderStatusBadge.tsx
src/components/modals/modelProvider/ModelSwitch.tsx
src/components/modals/modelProvider/AddCustomModelInput.tsx
src/components/modals/modelProvider/ConnectProviderDrawer.tsx
src/components/modals/modelProvider/ModalFooter.tsx
src/components/modals/modelProvider/ModelHoverCard.tsx
```

Replace `ProviderAccordionItem` as the main center UX. Do not delete it in this branch unless you confirm no imports remain.

## Allowed files

```txt
src/components/settings/ModelsContent.tsx
src/components/settings/modelProviders/*
src/components/settings/settings.css
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed only if required

```txt
src/components/settings/ModelsSection.tsx
src/stores/aiStore.ts
src/types/index.ts
```

## New center panel structure

```txt
ProviderDetailPanel

Header:
  Provider name
  Status badge
  Model count
  Last imported

Tabs:
  Connection
  Models
  Defaults
  Usage
  Advanced
```

## Required behavior

1. Selecting a provider in the left panel updates the center detail panel.
2. Center panel no longer shows all providers at once.
3. Provider settings are split into visible tabs.
4. Existing ProviderStatusBadge is reused if compatible.
5. Existing ModelSwitch is reused inside the Models tab if compatible.
6. Empty/no provider state is clear and useful.

## Tab shell requirements

Connection tab:
- Show provider name, base URL, API key placeholder/control area, status, test/sync action locations.
- Deep test/sync logic can be TODO for Agent D if not already cleanly available.

Models tab:
- Show search/filter/table layout.
- Reuse existing model enable/disable UI if safe.

Defaults tab:
- Show task default rows shell.
- Deep persistence can be TODO for Agent E.

Usage tab:
- Show honest Unknown/estimated layout shell.
- Do not fake quota.

Advanced tab:
- Show provider ID, base URL, and danger zone shell.
- Delete behavior can be completed by Agent E.

## Acceptance

- Provider detail tabs render without breaking existing Models page.
- Only selected provider is shown in the center panel.
- Existing provider status/model switch styling is reused where practical.
- No broad unrelated refactor.

## Output

```md
## Agent C result
- Files added:
- Files changed:
- Selected provider wiring source:
- Tabs implemented:
- Logic deferred to Agent D/E:
- Risks / follow-up for orchestrator:
```
