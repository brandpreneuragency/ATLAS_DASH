# Agent E Prompt — Defaults, Usage, and Advanced Tabs

You are Agent E. Your branch is:

```txt
feature/defaults-usage-advanced
```

## Goal

Implement provider Defaults, Usage, and Advanced tabs without overbuilding storage or faking data.

Build on Agent C and D after they have been merged or rebased into your worktree.

## Files to inspect first

```txt
src/types/index.ts
src/stores/aiStore.ts
src/services/db.ts
src/components/settings/modelProviders/ProviderDefaultsTab.tsx
src/components/settings/modelProviders/ProviderUsageTab.tsx
src/components/settings/modelProviders/ProviderAdvancedTab.tsx
src/components/modals/modelProvider/ProviderStatusBadge.tsx
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed files

```txt
src/types/index.ts
src/stores/aiStore.ts
src/services/db.ts
src/components/settings/modelProviders/ProviderDefaultsTab.tsx
src/components/settings/modelProviders/ProviderUsageTab.tsx
src/components/settings/modelProviders/ProviderAdvancedTab.tsx
src/i18n/en.ts
src/i18n/tr.ts
```

## Allowed only if required

```txt
src/components/settings/settings.css
src/components/settings/modelProviders/ProviderDetailPanel.tsx
```

## Defaults tab data model

Add task-specific defaults using `db.settings` first, not a new Dexie table.

Types:

```ts
export type TaskModelDefaultKey =
  | 'general_chat'
  | 'writing'
  | 'task_management'
  | 'app_management'
  | 'coding'
  | 'deep_reasoning'
  | 'fast_cheap'
  | 'long_context'
  | 'vision'
  | 'structured_output'
  | 'tool_use'
  | 'fallback';

export interface TaskModelDefault {
  taskKey: TaskModelDefaultKey;
  providerId: string;
  modelId: string;
}
```

Store as JSON in `db.settings`:

```txt
key: modelDefaults
value: JSON.stringify(defaults)
```

## Defaults migration

Preserve backward compatibility:

1. Existing `activeProviderId` remains the general chat fallback.
2. Existing `appManagementProviderId` is migrated into `app_management` if present.
3. Do not break current model selection per provider.

## Defaults UI

```txt
Defaults

General chat        [ Provider / Model ]
Writing             [ Provider / Model ]
Task management     [ Provider / Model ]
App management      [ Provider / Model ]
Coding              [ Provider / Model ]
Deep reasoning      [ Provider / Model ]
Fast cheap          [ Provider / Model ]
Vision              [ Provider / Model ]
Structured output   [ Provider / Model ]
Tool use            [ Provider / Model ]
Fallback            [ Provider / Model ]
```

## Model filtering preference rules

Use existing `ModelCapability` fields where available:

```txt
vision → capabilities.vision === true
tool_use → capabilities.toolCalling === true
deep_reasoning → prefer reasoning === 'High'
fast_cheap → prefer speed === 'Fast' or cost === 'Free' | 'Limited'
```

If metadata is unknown, show it as unknown. Do not invent capability data.

## Usage tab

Repo constraint: there may be no usage/cost logging table yet.

Add usage gradually. Only add Dexie usage table if actual token logging will be implemented.

If adding a table, use:

```ts
export interface ModelUsageRecord {
  id: string;
  providerId: string;
  modelId: string;
  taskKey?: TaskModelDefaultKey;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  createdAt: number;
}
```

Schema:

```ts
modelUsage: 'id, providerId, modelId, taskKey, createdAt'
```

First-version UI:

```txt
Usage

This month
Estimated cost: Unknown / calculated if pricing exists

By model:
Provider
Model
Input tokens
Output tokens
Estimated cost
```

## Pricing metadata

Extend model metadata only where compatible:

```ts
inputPricePerMillion?: number;
outputPricePerMillion?: number;
currency?: 'USD';
```

Do not fake provider-side quota.

## Advanced tab

UI:

```txt
Advanced

Provider ID
readonly

Base URL
editable

Request timeout
future item

Custom headers
future item

Danger zone
[ Delete provider ]
```

Rules:

1. Use existing `deleteCustomProvider(id)` if present.
2. Delete requires confirmation.
3. Do not expose raw saved keys.
4. Do not add custom headers unless streaming/import layers support them.
5. Custom headers should remain a future item if unsupported.

## Acceptance

- User can set task-specific default models.
- Defaults persist through existing settings storage.
- Existing active provider and app management provider behavior remains compatible.
- Usage tab is honest about Unknown values.
- Advanced tab allows safe provider delete with confirmation.
- No fake cost/quota is displayed.

## Output

```md
## Agent E result
- Files changed:
- Defaults storage implemented:
- Migration behavior:
- Usage table added: yes/no and why
- Advanced delete behavior:
- Risks / follow-up for orchestrator:
```
