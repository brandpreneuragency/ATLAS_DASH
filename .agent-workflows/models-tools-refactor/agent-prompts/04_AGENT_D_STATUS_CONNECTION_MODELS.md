# Agent D Prompt — Provider Status, Connection, and Models Logic

You are Agent D. Your branch is:

```txt
feature/provider-status-connection-models
```

## Goal

Improve provider status semantics and complete Connection + Models tab behavior.

You should build on Agent C's tab components if that branch has already been merged into your worktree. If not, first merge/rebase from main after Agent C is merged.

## Files to inspect first

```txt
src/types/index.ts
src/stores/aiStore.ts
src/services/ai/importProviderModels.ts
src/components/settings/modelProviders/ProviderConnectionTab.tsx
src/components/settings/modelProviders/ProviderModelsTab.tsx
src/components/modals/modelProvider/ProviderStatusBadge.tsx
src/components/modals/modelProvider/ModelSwitch.tsx
src/components/modals/modelProvider/AddCustomModelInput.tsx
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed files

```txt
src/types/index.ts
src/stores/aiStore.ts
src/components/settings/modelProviders/ProviderConnectionTab.tsx
src/components/settings/modelProviders/ProviderModelsTab.tsx
src/components/modals/modelProvider/ProviderStatusBadge.tsx
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed only if required

```txt
src/services/ai/importProviderModels.ts
src/components/modals/modelProvider/ModelSwitch.tsx
src/components/modals/modelProvider/AddCustomModelInput.tsx
src/components/settings/settings.css
```

## ProviderStatus update

Current type may be:

```ts
export type ProviderStatus = 'connected' | 'not_connected' | 'needs_setup';
```

Replace/extend with:

```ts
export type ProviderStatus =
  | 'connected'
  | 'not_connected'
  | 'needs_key'
  | 'connection_failed'
  | 'sync_needed'
  | 'needs_setup';
```

## Status meaning

| Status | Meaning |
|---|---|
| `connected` | Base URL + key + enabled model exist. |
| `not_connected` | Provider exists but is not ready. |
| `needs_key` | Base URL exists, key missing. |
| `connection_failed` | Last test/import failed. |
| `sync_needed` | Key/base URL exist, no imported models. |
| `needs_setup` | Missing required config. |

## Required helper

Refactor weak status logic into explicit helper(s), for example:

```ts
function deriveProviderStatus(input: {
  hasBaseUrl: boolean;
  hasKey: boolean;
  modelCount: number;
  selectedModel?: string;
  lastError?: string;
  currentStatus?: ProviderStatus;
}): ProviderStatus {
  if (input.lastError) return 'connection_failed';
  if (!input.hasBaseUrl) return 'needs_setup';
  if (!input.hasKey) return 'needs_key';
  if (input.modelCount <= 0) return 'sync_needed';
  if (!input.selectedModel) return 'sync_needed';
  return 'connected';
}
```

Adapt the exact logic to the existing store shape.

## Connection tab requirements

Layout:

```txt
Connection

Provider name
[ input ]

Base URL
[ input ]

API Key
[ password input ] [show/hide]

Connection status
Connected / Needs key / Sync needed / Failed

[ Test connection ]
[ Sync models ]
```

Behavior:

1. User can save provider name/base URL/API key without importing models first.
2. Test connection validates base URL + key only.
3. Sync models calls existing `importProviderModels` flow.
4. Provider becomes connected automatically only after:
   - valid key
   - valid base URL
   - at least one enabled model
5. Errors appear inside the tab, not only as toast.
6. Do not expose raw saved keys.

## Models tab requirements

Layout:

```txt
Models

[ Search models... ] [ Sync Models ] [ + Add Custom Model ]

Filters:
All / Enabled / Disabled / Custom / Vision / Tool use / Reasoning

Table:
Model name
Model ID
Capabilities
Source
Enabled
```

Behavior:

1. Keep `hiddenModels` as the enable/disable mechanism for now.
2. Do not delete synced models.
3. Delete/remove only applies to custom models.
4. Custom model slugs can still be added.
5. Imported and manual models can coexist.
6. Reuse `ModelSwitch`.
7. Show `Unknown` for unknown context, speed, cost, or reasoning.

## Acceptance

- Left panel status is meaningful.
- Failed import/test does not appear as generic Not connected.
- Missing key appears as Needs key.
- Sync-needed state is understandable.
- Connection and Models tabs are usable.
- Existing custom provider import flow still works.

## Output

```md
## Agent D result
- Files changed:
- Status helper added/updated:
- Connection test behavior:
- Sync behavior:
- Model filters added:
- Risks / follow-up for orchestrator:
```
