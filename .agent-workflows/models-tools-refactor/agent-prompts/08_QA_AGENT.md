# QA Agent Prompt — Settings Models/Tools Refactor Review

You are the QA agent. Default mode: review first, edit only if explicitly approved.

## Goal

Find regressions, missed requirements, risky assumptions, broken state flow, broken i18n, and UX friction after all implementation branches have been merged.

## Inspect

```txt
src/components/settings/SettingsDocument.tsx
src/components/settings/SettingsPanels.tsx
src/components/settings/SettingsAISidebar.tsx
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/components/settings/ToolsSection.tsx
src/components/settings/modelProviders/*
src/components/settings/tools/*
src/components/modals/modelProvider/*
src/stores/aiStore.ts
src/stores/uiStore.ts
src/types/index.ts
src/services/db.ts
src/services/ai/importProviderModels.ts
src/i18n/en.ts
src/i18n/tr.ts
src/components/settings/settings.css
```

## Review questions

### Settings architecture

- Does Settings → Tools exist as a sub-tab, not a new route?
- Does the right Settings AI sidebar still appear for Models and Tools?
- Is SettingsDocument still the main renderer?

### Models page

- Does Models only show AI/model providers?
- Are Exa/Tavily/Firecrawl/Brave absent from Models?
- Is there one clear `+ Add Provider` action?
- Are Coming soon placeholders non-clickable?
- Does selecting a provider update the center panel?
- Does the center panel show only the selected provider?
- Are tabs visible: Connection, Models, Defaults, Usage, Advanced?

### Tools page

- Does Tools manage Tavily, Exa, Firecrawl, and Brave?
- Does Tools use existing `searchConfig` and `saveSearchConfig`?
- Are Browser/Storage placeholders non-clickable?
- Does active/not connected status make sense?

### Provider status

- Are statuses richer than generic not_connected?
- Does missing key show Needs key?
- Does failed test/import show Connection failed?
- Does key/base URL with no models show Sync needed?
- Does connected require base URL + key + enabled model?

### Connection/models flow

- Can provider details be saved before model import?
- Can credentials be tested before syncing models?
- Can models be synced separately?
- Can manual custom model slugs be added?
- Can imported and custom models coexist?
- Are synced models not deleted by normal remove action?
- Does delete apply only to custom models?

### Defaults/usage/advanced

- Are task defaults persisted in `db.settings` first?
- Is `activeProviderId` kept as general chat fallback?
- Is `appManagementProviderId` migrated or preserved?
- Does Usage show Unknown instead of fake data?
- Does provider delete require confirmation?
- Are raw saved keys hidden?

### CSS/i18n

- Are new styles token-based?
- Are there avoidable inline styles?
- Are EN/TR keys complete?
- Are hardcoded strings avoided where the app uses i18n?

## Run checks

Run only commands that exist:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Output

```md
# QA Report — Settings Models/Tools Refactor

## Pass/fail summary
- Settings architecture:
- Models page:
- Tools page:
- Provider status:
- Connection/models flow:
- Defaults/usage/advanced:
- CSS/i18n:
- Build/typecheck/lint:

## Blocking issues
1.

## Non-blocking issues
1.

## Suggested fixes
1.

## Files most likely responsible
- 

## Approval recommendation
Approved / Not approved
```
