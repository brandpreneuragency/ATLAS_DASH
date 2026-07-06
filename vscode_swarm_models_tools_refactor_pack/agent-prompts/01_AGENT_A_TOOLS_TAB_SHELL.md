# Agent A Prompt — Settings Tools Tab Shell

You are Agent A. Your branch is:

```txt
feature/settings-tools-shell
```

## Goal

Add a real Settings → Tools sub-tab shell inside the existing Settings architecture.

Do not build the full tools management UI yet. Create the tab, render a basic ToolsSection shell, and preserve the existing right Settings AI sidebar behavior.

## Files to inspect first

```txt
src/stores/uiStore.ts
src/components/settings/SettingsDocument.tsx
src/components/settings/SettingsAISidebar.tsx
src/components/settings/SettingsPanels.tsx
src/components/settings/settings.css
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed files

```txt
src/stores/uiStore.ts
src/components/settings/SettingsDocument.tsx
src/components/settings/SettingsAISidebar.tsx
src/components/settings/SettingsPanels.tsx
src/components/settings/ToolsSection.tsx
src/components/settings/settings.css
src/i18n/en.ts
src/i18n/tr.ts
```

## Forbidden files unless necessary

```txt
src/stores/aiStore.ts
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/components/modals/modelProvider/*
src/services/db.ts
```

## Required work

1. Extend `SettingsSubTab` with `tools`.
2. Add a `ToolsSection` component.
3. Render `ToolsSection` inside `SettingsDocument` when the active tab is `tools`.
4. Update the component that renders the settings sub-tab navigation.
5. Add English and Turkish labels for Tools.
6. Ensure the right Settings AI sidebar still receives the correct settings context for the Tools tab.
7. Do not create a separate route.

## ToolsSection shell requirements

The shell should communicate the intended structure, without full functionality yet:

```txt
Left panel:
Tools
  Search
    Tavily
    Exa
    Firecrawl
    Brave
  Browser
    Coming later, non-clickable
  Storage
    Coming later, non-clickable

Center panel:
Selected tool details placeholder
```

## UX rules

- Browser and Storage placeholders must not be clickable buttons.
- Do not use clickable fake pages.
- Use existing settings panel/list/detail styling where possible.
- Use CSS tokens only.

## Acceptance

- Settings → Tools exists.
- It is rendered inside the current Settings document structure.
- The right Settings AI sidebar still appears.
- Exa/Tavily do not need to be removed from Models in this branch; that is Agent B/F work.
- TypeScript passes for files you changed.

## Output

When finished, report:

```md
## Agent A result
- Files changed:
- Settings navigation location found:
- Tools tab added: yes/no
- Right AI sidebar preserved: yes/no
- Risks / follow-up for orchestrator:
```
