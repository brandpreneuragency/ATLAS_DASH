# Agent G Prompt — CSS, i18n, and Cleanup

You are Agent G. Your branch is:

```txt
feature/settings-css-i18n-cleanup
```

## Goal

Clean styling, translations, and unused code after the functional branches are merged.

Do not redesign the UI. Do not introduce a new visual style.

## Files to inspect first

```txt
src/components/settings/settings.css
src/components/settings/modelProviders/*
src/components/settings/tools/*
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/components/modals/modelProvider/*
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed files

```txt
src/components/settings/settings.css
src/components/settings/modelProviders/*
src/components/settings/tools/*
src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed only after import search confirms safety

```txt
src/components/modals/modelProvider/ProviderAccordionItem.tsx
```

## Token rules

Use existing tokens such as:

```css
var(--c-background-1)
var(--c-background-2)
var(--c-background-3)
var(--c-border-1)
var(--c-border-2)
var(--c-text-1)
var(--c-text-2)
var(--c-text-3)
var(--c-accent-center-panel)
var(--c-success)
var(--c-danger)
var(--fs-xs)
var(--fs-sm)
var(--fs-base)
var(--space-*)
var(--radius-*)
var(--control-height-*)
```

## CSS requirements

1. Avoid inline styles in new components.
2. Move new layout styles into `settings.css` or scoped settings CSS files if the repo already supports them.
3. Do not hardcode colors, spacing, radii, font sizes, shadows, z-index, or control heights unless adding tokens is clearly justified.
4. Match current SettingsPanels layout and visual language.
5. Ensure left list and center detail have consistent spacing and responsive behavior.

## i18n requirements

1. EN and TR keys must be complete.
2. No raw UI strings in components if the surrounding code uses i18n.
3. Keep key names consistent and grouped logically.
4. Do not machine-translate blindly if existing tone is visible; match existing simple wording.

## Cleanup requirements

1. Search imports before deleting any old modal/accordion code.
2. Remove unused exports only after confirming no imports remain.
3. Do not delete components that may still be used in other app areas.
4. Keep useful shared components:
   - ProviderStatusBadge
   - ModelSwitch
   - AddCustomModelInput
   - ConnectProviderDrawer
   - ModalFooter
   - ModelHoverCard

## Acceptance

- No new hardcoded styling patterns are introduced.
- i18n keys exist in EN/TR.
- No duplicate or dead Settings labels remain.
- Old accordion code is only removed if proven unused.
- UI still matches current app tokens and layout.

## Output

```md
## Agent G result
- Files changed:
- Inline styles reduced: yes/no
- i18n completed: yes/no
- Dead code removed: list or none
- Checks run:
- Risks / follow-up for orchestrator:
```
