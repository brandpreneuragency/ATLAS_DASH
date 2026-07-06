# Agent B Prompt — Models Left Panel Refactor

You are Agent B. Your branch is:

```txt
feature/models-left-panel-refactor
```

## Goal

Refactor Settings → Models left panel so it only manages AI/model infrastructure.

Do not build provider detail tabs in this branch. That is Agent C.

## Files to inspect first

```txt
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/components/settings/settings.css
src/stores/aiStore.ts
src/types/index.ts
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed files

```txt
src/components/settings/ModelsSection.tsx
src/components/settings/settings.css
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed only if required

```txt
src/components/settings/ModelsContent.tsx
src/stores/aiStore.ts
src/types/index.ts
```

## Forbidden files

```txt
src/components/settings/ToolsSection.tsx
src/components/settings/tools/*
src/services/db.ts
src/services/ai/importProviderModels.ts
```

## New left panel structure

```txt
AI Providers

[ Search providers ]

[ + Add Provider ]

LLM / Chat
  Provider name
  status · model count

Embeddings
  No providers yet

Vector Stores
  No providers yet

Image Models
  No providers yet
```

## Required behavior

1. Remove Web Search providers from Models left panel.
2. Remove Exa/Tavily/Firecrawl/Brave from Models left panel.
3. Keep exactly one clear primary action: `+ Add Provider`.
4. Keep local provider search.
5. Do not render Coming soon as clickable rows.
6. Replace fake selectable placeholder rows with non-clickable empty hints.
7. Do not duplicate connect buttons.

## Important anti-pattern to remove

If current code uses this kind of pattern:

```ts
renderEmptyGroup(group.id)
```

and it creates clickable placeholder rows, replace it with a non-interactive hint.

## UX rules

- Empty groups are visual labels/hints, not selectable pages.
- The selected provider should be visually distinct.
- Use existing tokens and settings list styles.
- Do not introduce a new design language.

## Acceptance

- Models left rail contains AI/model providers only.
- Exa/Tavily/Firecrawl/Brave are gone from Models left rail.
- Search providers works locally.
- Empty categories are not clickable.
- There is no duplicate connect/add provider button.

## Output

```md
## Agent B result
- Files changed:
- Web/search providers removed from Models: yes/no
- Clickable placeholders removed: yes/no
- Search behavior preserved: yes/no
- Risks / follow-up for orchestrator:
```
