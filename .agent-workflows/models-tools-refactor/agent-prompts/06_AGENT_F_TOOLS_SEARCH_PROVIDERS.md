# Agent F Prompt — Tools Page Search Providers

You are Agent F. Your branch is:

```txt
feature/tools-search-providers
```

## Goal

Complete Settings → Tools for search providers and move Exa/Tavily/Firecrawl/Brave management out of Settings → Models.

Build on Agent A's ToolsSection shell.

## Files to inspect first

```txt
src/components/settings/ToolsSection.tsx
src/stores/aiStore.ts
src/types/index.ts
src/i18n/en.ts
src/i18n/tr.ts
src/components/settings/settings.css
```

Also inspect where web/search providers currently appear:

```txt
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/components/modals/modelProvider/*
```

## Add files

```txt
src/components/settings/tools/ToolsList.tsx
src/components/settings/tools/ToolDetailPanel.tsx
src/components/settings/tools/SearchToolDetail.tsx
```

## Allowed files

```txt
src/components/settings/ToolsSection.tsx
src/components/settings/tools/*
src/stores/aiStore.ts
src/i18n/en.ts
src/i18n/tr.ts
src/components/settings/settings.css
```

## Allowed only if required

```txt
src/types/index.ts
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
```

## Store rule

Use existing search config storage:

```txt
searchConfig
saveSearchConfig
```

Do not create `toolsStore` yet.

## Tools managed

```txt
Search Tools
  Tavily
  Exa
  Firecrawl
  Brave
```

## Left panel

```txt
Tools

Search
  Tavily      Active / Not connected
  Exa         Active / Not connected
  Firecrawl   Active / Not connected
  Brave       Active / Not connected

Browser
  Coming later, non-clickable

Storage
  Coming later, non-clickable
```

## Center panel

For selected search tool:

```txt
Tool name

API Key
[ password input ]

Provider role
[ Default search provider ]

Web search
[ enabled toggle ]

[ Save ]
```

## Required behavior

1. User can select Tavily, Exa, Firecrawl, or Brave in Tools.
2. User can enter/update API key for each.
3. User can set the selected tool as default search provider when supported by existing config.
4. User can enable/disable web search using existing config.
5. Active/not connected status reflects whether required key/config exists.
6. Do not expose raw saved keys if the current app stores them securely or masks them.
7. Browser and Storage placeholders are non-clickable.

## Migration/removal from Models

If web providers are still rendered under Models, remove their visible management from Models and leave it in Tools only.

Do not delete underlying search config state.

## Acceptance

- Settings → Tools manages Tavily, Exa, Firecrawl, and Brave.
- Settings → Models no longer shows web/search providers.
- Existing searchConfig/saveSearchConfig path remains intact.
- No separate tools store is introduced.
- No unrelated search behavior breaks.

## Output

```md
## Agent F result
- Files added:
- Files changed:
- Search config fields used:
- Search providers removed from Models: yes/no
- Risks / follow-up for orchestrator:
```
