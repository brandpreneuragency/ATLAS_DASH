Main implementation direction

Do not build a totally new provider management system.

Refactor the existing system:

src/components/settings/ModelsSection.tsx
src/components/settings/ModelsContent.tsx
src/components/modals/modelProvider/*
src/stores/aiStore.ts
src/types/index.ts
src/services/db.ts
src/services/ai/importProviderModels.ts
src/i18n/en.ts
src/i18n/tr.ts
src/components/settings/settings.css

The target should be:

Settings → Models
  Left panel: AI providers only
  Center panel: selected provider details

Settings → Tools
  Left panel: search/browser/tool providers
  Center panel: selected tool details

This respects the app’s current settings architecture instead of forcing a foreign dashboard layout into it.

Phase 1 — Add a real Tools settings page
Change

Extend the settings sub-tabs:

export type SettingsSubTab =
  | 'models'
  | 'tools'
  | 'actions'
  | 'appearance'
  | 'agents';

Current type only includes:

'models' | 'actions' | 'appearance' | 'agents'
Files
src/stores/uiStore.ts
src/components/settings/SettingsDocument.tsx
src/components/settings/SettingsAISidebar.tsx
src/i18n/en.ts
src/i18n/tr.ts
Required work
Add tools to SettingsSubTab.
Add a ToolsSection.
Add tools rendering inside SettingsDocument.
Update whichever component renders the settings sub-tab navigation.
Add English/Turkish i18n keys.
Acceptance
Exa/Tavily no longer appear under Settings → Models.
Settings → Tools exists and has its own settings AI chat context, same as other settings tabs.
No separate route is required.
Phase 2 — Refactor ModelsSection left panel
Current issue

ModelsSection currently mixes:

LLM
Web Search
Embeddings
Vector Store
Coming soon placeholders
Connect provider

in the same left rail.

New left panel

Only show AI/model infrastructure:

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
Important rule

Do not render Coming soon as a clickable row anymore.

Replace this pattern:

renderEmptyGroup(group.id)

with a non-clickable empty hint.

Current placeholder rows are buttons and should be removed.

Files
src/components/settings/ModelsSection.tsx
src/components/settings/settings.css
Acceptance
Left rail has one clear primary action: + Add Provider.
Search providers works locally.
Empty categories are visual labels, not selectable fake pages.
Exa/Tavily are gone from this panel.
No duplicate connect buttons.
Phase 3 — Replace accordion detail with tabbed provider detail
Current issue

ModelsContent still renders a provider accordion list in the center panel. This is better than the old modal, but still creates too much friction for provider setup. It mixes connection form, import, model list, and add-custom-model inside one accordion.

New center panel structure

Create a selected-provider detail component:

ProviderDetailPanel

Header:
  Provider name
  status badge
  model count
  last imported

Tabs:
  Connection
  Models
  Defaults
  Usage
  Advanced
Files

Add:

src/components/settings/modelProviders/ProviderDetailPanel.tsx
src/components/settings/modelProviders/ProviderConnectionTab.tsx
src/components/settings/modelProviders/ProviderModelsTab.tsx
src/components/settings/modelProviders/ProviderDefaultsTab.tsx
src/components/settings/modelProviders/ProviderUsageTab.tsx
src/components/settings/modelProviders/ProviderAdvancedTab.tsx
src/components/settings/modelProviders/ProviderList.tsx
src/components/settings/modelProviders/ProviderListItem.tsx
src/components/settings/modelProviders/ProviderTabs.tsx

Refactor or reuse:

src/components/settings/ModelsContent.tsx
src/components/modals/modelProvider/ProviderAccordionItem.tsx
src/components/modals/modelProvider/ProviderStatusBadge.tsx
src/components/modals/modelProvider/ModelSwitch.tsx
src/components/modals/modelProvider/AddCustomModelInput.tsx
src/components/modals/modelProvider/ConnectProviderDrawer.tsx
src/components/modals/modelProvider/ModalFooter.tsx
Recommendation

Keep useful existing small components:

ProviderStatusBadge
ModelSwitch
AddCustomModelInput
ConnectProviderDrawer
ModalFooter
ModelHoverCard

But replace ProviderAccordionItem as the main center UX.

Acceptance
Selecting a provider in the left panel updates the center detail panel.
Center panel no longer shows all providers at once.
Provider settings are split into clear tabs.
Existing status badge and model switch styling are reused.
Phase 4 — Improve provider status model
Current status type

Current provider statuses are:

export type ProviderStatus = 'connected' | 'not_connected' | 'needs_setup';
Replace with richer status
export type ProviderStatus =
  | 'connected'
  | 'not_connected'
  | 'needs_key'
  | 'connection_failed'
  | 'sync_needed'
  | 'needs_setup';
Mapping
New status	Meaning
connected	Base URL + key + enabled model exist
not_connected	Provider exists but is not ready
needs_key	Base URL exists, key missing
connection_failed	Last test/import failed
sync_needed	Key/base URL exist, no imported models
needs_setup	Missing required config
Files
src/types/index.ts
src/stores/aiStore.ts
src/components/modals/modelProvider/ProviderStatusBadge.tsx
src/i18n/en.ts
src/i18n/tr.ts
Important

Current deriveStatus() and refreshStatus() are too weak. They return not_connected for most cases and preserve connected only in a limited way.

Refactor them into explicit status helpers:

function deriveProviderStatus(input: {
  hasBaseUrl: boolean;
  hasKey: boolean;
  modelCount: number;
  selectedModel?: string;
  lastError?: string;
  currentStatus?: ProviderStatus;
}): ProviderStatus
Acceptance
Left panel status is meaningful.
Failed import/test does not look like generic Not connected.
Missing key is shown as Needs key.
Imported-but-not-connected state is understandable.
Phase 5 — Connection tab
Use existing logic

The app already supports OpenAI-compatible provider import through:

GET {baseUrl}/models
Authorization: Bearer key

The import service validates URL, API key, HTTP status, JSON response, supported response shape, and empty model lists.

New tab layout
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
Important implementation detail

Today connectProvider() refuses to connect if no imported/enabled models exist.

For better UX:

Test connection should only validate base URL + key.
Sync models should call importProviderModels.
Connect provider should become automatic after:
valid key
valid base URL
at least one enabled model
Acceptance
User can add provider details without importing first.
User can test credentials before model selection.
User can sync models separately.
Errors are visible inside the tab, not only as toast.
Phase 6 — Models tab
Existing model support

Current ModelItem already supports:

id
name
enabled
description
capabilities
custom

The current store already supports adding/removing custom models and preserves custom models across re-imports.

New tab layout
Models

[ Search models... ] [ Sync Models ] [ + Add Custom Model ]

Filters:
All / Enabled / Disabled / Custom / Vision / Tool use / Reasoning

Model table:
Model name
Model ID
Capabilities
Source
Enabled
Rules
Keep hiddenModels as the current enable/disable mechanism for now.
Do not delete synced models.
Delete/remove should only apply to custom models.
Show Unknown for unknown context, speed, cost, reasoning.
Reuse ModelSwitch.
Acceptance
Model rows are scannable.
Custom model slugs can still be added.
Imported and manual models can coexist.
Users can find models without opening hover cards.
Phase 7 — Defaults tab
Current limitation

The app currently has:

activeProviderId
selectedModel per provider
appManagementProviderId

This is not enough for your requested “defaults per task type.”

Add task defaults

Add a settings-backed object instead of a new Dexie table first.

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

Store it as JSON in db.settings:

key: modelDefaults
value: JSON.stringify(defaults)

This matches the repo’s existing settings storage pattern. db.settings is already a generic key/value store.

UI
Defaults

General chat        [ Provider / Model ]
Writing             [ Provider / Model ]
Task management     [ Provider / Model ]
App management      [ Provider / Model ]
Coding              [ Provider / Model ]
Deep reasoning      [ Provider / Model ]
Fast cheap          [ Provider / Model ]
Vision              [ Provider / Model ]
Fallback            [ Provider / Model ]
Model filtering

Use ModelCapability:

vision → only capabilities.vision === true
tool_use → only capabilities.toolCalling === true
deep_reasoning → prefer reasoning === 'High'
fast_cheap → prefer speed === 'Fast' or cost === 'Free' | 'Limited'

Current capability structure already supports these fields.

Acceptance
User can set task-specific default models.
Existing activeProviderId remains as backwards-compatible general chat fallback.
Existing appManagementProviderId is migrated into the new defaults object if present.
Phase 8 — Usage tab
Important repo constraint

There is no model usage/cost logging table yet. Dexie currently stores documents, chat messages, agents, provider configs, settings, prompts, tasks, projects, task comments, AI change batches, and chat threads.

Add usage tracking gradually

Add a Dexie v12 table:

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

Schema:

modelUsage: 'id, providerId, modelId, taskKey, createdAt'
First version

Do not try to build perfect provider-side quota tracking.

Start with:

Usage

This month
Estimated cost: Unknown / calculated if pricing exists

By model:
Provider
Model
Input tokens
Output tokens
Estimated cost
Pricing fields

Extend ModelCapability or add model metadata:

inputPricePerMillion?: number;
outputPricePerMillion?: number;
currency?: 'USD';
Acceptance
If token data is unavailable, show Unknown.
If pricing is unavailable, show Unknown.
Do not fake provider quota.
Usage tab can exist as a structured placeholder until streaming code logs tokens.
Phase 9 — Advanced tab
UI
Advanced

Provider ID
readonly

Base URL
editable

Request timeout
optional later

Custom headers
optional later

Danger zone
[ Delete provider ]
Use existing delete method

The store already has deleteCustomProvider(id), which deletes the provider config and secure API key.

Rules
Require confirmation before delete.
Do not expose raw saved keys.
Do not add custom headers yet unless the streaming/import layer supports them.
Keep custom headers as a future item.
Phase 10 — Tools page
Why

Search tools are already part of SearchConfig:

exaKey
tavilyKey
firecrawlKey
braveKey
enabled
searchProvider

So Tools should manage:

Search Tools
  Tavily
  Exa
  Firecrawl
  Brave
Files

Add:

src/components/settings/ToolsSection.tsx
src/components/settings/tools/ToolsList.tsx
src/components/settings/tools/ToolDetailPanel.tsx
src/components/settings/tools/SearchToolDetail.tsx

Update:

src/components/settings/SettingsDocument.tsx
src/stores/uiStore.ts
src/stores/aiStore.ts
src/i18n/en.ts
src/i18n/tr.ts
Left panel
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
Center panel
Tavily

API Key
[ password input ]

Provider role
[ Default search provider ]

Web search
[ enabled toggle ]

[ Save ]
Store

Keep using searchConfig and saveSearchConfig.

Do not create a separate toolsStore yet unless the tool system grows beyond search.

Phase 11 — CSS rules for agents
Use existing tokens

The app already has a token foundation and explicitly imports tokens before density/layout/panels/utilities.

Use:

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

Spacing, radius, control heights, modal sizes, and z-index are already tokenized in tokens.css.

Current bad pattern to reduce

There are many inline styles in the current model/provider components. Do not expand this pattern. Move new layout styles into:

src/components/settings/settings.css

or a new scoped file:

src/components/settings/modelProviders.css
src/components/settings/tools.css

Current settings.css already declares shared settings list/detail styles using existing tokens.

Agent execution prompt
Refactor the TABS settings provider/model management UX according to the existing repo architecture.

Context:
- This is a Vite + React + Tauri + TypeScript app.
- State is managed with Zustand.
- Local persistence uses Dexie.
- API keys use secureStorage.
- Settings is rendered as a Settings document, not a normal route.
- Settings uses SettingsPanels / ReusablePageTemplate with left, center, and right AI sidebar columns.
- Keep the existing right Settings AI sidebar.
- Implement the new UX as a left provider/tool list + center detail panel inside the existing Settings structure.

Primary files to inspect first:
- src/components/settings/SettingsDocument.tsx
- src/components/settings/ModelsSection.tsx
- src/components/settings/ModelsContent.tsx
- src/components/settings/SettingsPanels.tsx
- src/components/settings/SettingsAISidebar.tsx
- src/components/settings/settings.css
- src/components/modals/modelProvider/*
- src/stores/aiStore.ts
- src/stores/uiStore.ts
- src/types/index.ts
- src/services/db.ts
- src/services/ai/importProviderModels.ts
- src/i18n/en.ts
- src/i18n/tr.ts

Main goals:
1. Refactor Settings → Models into a clean provider management area.
2. Move Exa/Tavily/Firecrawl/Brave out of Models into a new Settings → Tools page.
3. Use the current settings page structure and CSS tokens.
4. Do not introduce a new UI library.
5. Do not create a separate backend API layer.
6. Do not replace Dexie/secureStorage patterns.
7. Keep existing provider import logic where possible.

Models page requirements:
- Left panel: AI providers only.
- Center panel: selected provider details.
- No clickable Coming soon rows.
- No Web Search providers in Models.
- No duplicate Connect Provider buttons.
- Provider detail tabs:
  - Connection
  - Models
  - Defaults
  - Usage
  - Advanced

Tools page requirements:
- Add SettingsSubTab value: tools.
- Add ToolsSection.
- Manage Exa, Tavily, Firecrawl, and Brave there.
- Use existing searchConfig and saveSearchConfig.
- Show active/not connected status per search tool.

Provider data requirements:
- Preserve existing AIProviderConfig as much as possible.
- Extend ProviderStatus with:
  - connected
  - not_connected
  - needs_key
  - connection_failed
  - sync_needed
  - needs_setup
- Keep existing ModelItem and ModelCapability, but extend only where needed.
- Add task-specific model defaults using db.settings first, not a new table.
- Add modelUsage table only if implementing actual usage logging.

UX rules:
- Use selected-provider detail instead of provider accordions.
- Reuse ProviderStatusBadge, ModelSwitch, AddCustomModelInput, ConnectProviderDrawer, ModelHoverCard where useful.
- Keep sync/import model flow, but separate:
  - Test connection
  - Sync models
  - Connect / mark connected
- Show Unknown for unknown pricing, quota, context, usage.
- Never fake provider quota or cost.
- Destructive delete requires confirmation.

CSS rules:
- Use existing CSS tokens.
- Avoid hardcoded colors, spacing, radii, and font sizes in new code.
- Move new styles into settings.css or scoped settings CSS files.
- Match current SettingsPanels layout and visual language.

Implementation order:
1. Audit exact current settings navigation component and write a short implementation note.
2. Add tools SettingsSubTab and ToolsSection shell.
3. Move web search providers from ModelsSection/ModelsContent to ToolsSection.
4. Refactor ModelsSection left panel.
5. Create ProviderDetailPanel with tabs.
6. Move connection/import/model enable logic from ModelsContent into tab components.
7. Add model defaults data model and UI.
8. Add usage tab as honest Unknown/estimated UI; only add Dexie usage table if token logging is implemented.
9. Improve provider status model.
10. Update i18n EN/TR.
11. Clean unused old model modal/accordion code only after confirming nothing imports it.
12. Run typecheck/build/lint.

Acceptance:
- Settings → Models is focused only on model providers.
- Settings → Tools manages web/search tools.
- Existing right-side settings AI chat still works.
- Existing custom OpenAI-compatible provider flow still works.
- User can add provider, save key, sync models, add manual model slug, enable/disable models, select defaults, and delete provider.
- No new visual style is introduced.
- No unrelated app areas regress.