# Orchestrator Master Prompt — Settings Models/Tools Refactor

You are the orchestration agent for a Vite + React + Tauri + TypeScript app.

Your job is to coordinate a multi-agent refactor of Settings → Models and Settings → Tools without letting agents overwrite each other.

## Core direction

Do **not** build a totally new provider management system.

Refactor the existing system around these files:

```txt
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
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

Target UX:

```txt
Settings → Models
  Left panel: AI/model providers only
  Center panel: selected provider details
  Right panel: existing Settings AI sidebar

Settings → Tools
  Left panel: search/browser/tool providers
  Center panel: selected tool details
  Right panel: existing Settings AI sidebar
```

## Hard rules

- Respect the current settings architecture.
- Do not create a separate route.
- Do not introduce a new UI library.
- Do not replace Zustand, Dexie, or secureStorage patterns.
- Do not create a separate backend API layer.
- Use existing CSS tokens.
- Avoid hardcoded colors, spacing, radii, shadows, font sizes, and inline styles.
- Keep the existing right Settings AI sidebar.
- Keep changes reviewable and scoped.
- Any destructive provider delete must require confirmation.
- Do not fake usage, quota, pricing, or provider cost data.

## First task: audit note

Before assigning implementation work, inspect these files:

```txt
src/components/settings/SettingsDocument.tsx
src/components/settings/SettingsPanels.tsx
src/components/settings/SettingsAISidebar.tsx
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/components/settings/settings.css
src/components/modals/modelProvider/*
src/stores/aiStore.ts
src/stores/uiStore.ts
src/types/index.ts
src/services/db.ts
src/services/ai/importProviderModels.ts
src/i18n/en.ts
src/i18n/tr.ts
```

Create or update:

```txt
docs/settings-models-tools-refactor-audit.md
```

Include:

1. current Settings tab/navigation structure
2. current ModelsSection responsibilities
3. current ModelsContent responsibilities
4. where Exa/Tavily/Firecrawl/Brave currently appear
5. provider status derivation points
6. existing searchConfig/saveSearchConfig shape
7. existing Dexie version and table list
8. existing commands for typecheck/lint/build/test
9. risks before parallel work starts
10. exact merge order recommendation

## Branches and owners

Use these branches/worktrees:

```txt
feature/settings-tools-shell
feature/models-left-panel-refactor
feature/provider-detail-tabs
feature/provider-status-connection-models
feature/defaults-usage-advanced
feature/tools-search-providers
feature/settings-css-i18n-cleanup
feature/qa-integration
```

## Merge order

Merge in this order:

```txt
1. feature/settings-tools-shell
2. feature/models-left-panel-refactor
3. feature/provider-detail-tabs
4. feature/tools-search-providers
5. feature/provider-status-connection-models
6. feature/defaults-usage-advanced
7. feature/settings-css-i18n-cleanup
8. feature/qa-integration, if used
```

If conflicts happen, prefer preserving the existing settings document/layout architecture and reusable model provider components.

## Final acceptance

Settings → Models must:

- show AI/model providers only
- remove web search providers
- use left provider list + center selected-provider detail
- remove clickable coming-soon rows
- preserve provider add/import/custom model flow
- support tabbed provider detail: Connection, Models, Defaults, Usage, Advanced

Settings → Tools must:

- exist as a Settings sub-tab
- manage Exa, Tavily, Firecrawl, and Brave
- use existing `searchConfig` and `saveSearchConfig`
- show active/not connected status per search tool
- keep the right Settings AI sidebar

Validation:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Only run commands that exist in the repo.

## Output format after each merge

```md
## Merge summary
- Branch merged:
- Files changed:
- Conflicts resolved:
- Checks run:
- Remaining risks:
- Next branch to merge:
```
