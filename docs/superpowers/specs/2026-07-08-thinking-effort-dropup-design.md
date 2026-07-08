# Thinking-Effort Dropup — Design

**Date:** 2026-07-08
**Status:** Approved (decisions delegated to implementer)
**Revised:** 2026-07-08 — capability source changed from a hand-curated catalog to
models.dev after confirming provider `/models` endpoints expose no reasoning data.

## Goal

Add a "thinking effort" dropup next to the model dropup in the chat composer. It
shows the effort levels the currently selected model supports, remembers the choice
per model, and injects the right reasoning parameter into the API request. It
appears in both composers (`ChatInput` and `CRMAISidebar`) and is hidden for models
with no thinking capability.

## Why a general solution was needed

Reasoning controls are heterogeneous and not self-describing:

- deepseek-flash: `off / high / max`
- mimo-2.5: `off / low / mid / high`
- nemotron-ultra: `on / off`
- OpenAI o-series / gpt-5: discrete effort strings
- Anthropic / Gemini native: token budgets, not levels

Provider `/models` endpoints do not describe any of this. Verified directly:
`https://opencode.ai/zen/v1/models` and `.../zen/go/v1/models` return only
`{ id, object, created, owned_by }`. A hand-maintained catalog would be a
maintenance treadmill against fast-moving names (gpt-5.5, deepseek-v4-flash, ...).

## Capability source: models.dev

Use **models.dev** — the community capability database opencode itself uses. Its
`api.json` lists 151 providers and, per model, `reasoning` (boolean) plus
`reasoning_options`, which give the exact allowed levels:

- `{ type: "effort", values: [...] }` — discrete levels (gpt-5.5 →
  `none/low/medium/high/xhigh`; deepseek-v4-flash → `high/max`)
- `{ type: "budget_tokens", min }` — token-budget models (native Anthropic)
- `{ type: "toggle" }` — on/off models (kimi, glm, nemotron)

This captures every case above generally, for all providers, with no per-model
manual work.

### Bundled snapshot + host-scoped matching (hybrid)

Build script `scripts/sync-models-dev.mjs` fetches `api.json` and writes a slim
`src/data/reasoningCatalog.json` (~900KB raw, gzips small):

```jsonc
{
  "providers": { "opencode": { "deepseek-v4-flash": <descriptor>, ... }, ... },
  "hosts":     { "opencode.ai": "opencode", "openrouter.ai": "openrouter", ... },
  "byId":      { "gpt-5.5": <descriptor>, ... }   // richest fallback
}
```

Each `<descriptor>` is `{ param, options }` (see Data model). Normalization:
- effort values → `[{Off,""}, ...values]`, `param: 'reasoning_effort'` (`none` is
  dropped since the Off entry already represents it)
- budget_tokens → `[Off, Low, Med, High]` with `budgetTokens` >= min,
  `param: 'thinking'`
- toggle → `[{Off,""},{On,"on"}]`, `param: 'reasoning_enabled'`
- reasoning:true but no options → default `[Off, Low, Med, High]` effort set

Matching is provider-scoped by base-URL host (same model id can differ per
provider). `resolveReasoning(model, baseUrl)` precedence:

1. Manual override on the model item (`source: 'manual'`) — always wins.
2. Provider-scoped: `host = new URL(baseUrl).host` → `catalog.hosts[host]` →
   `catalog.providers[slug][model.id]`.
3. Bare-id fallback: `catalog.byId[model.id]`.
4. Nothing → `undefined` → no dropup.

The `hosts` map is auto-built from each provider's advertised `api` base URL plus a
few native hosts. For the opencode config, host `opencode.ai` resolves to the
`opencode` provider, giving exactly-right per-model levels for both `/zen/v1` and
`/zen/go/v1` (same host).

### Runtime refresh

The bundled snapshot works offline/first-run. `refreshReasoningCatalog()`
re-fetches models.dev, normalizes with the same rules, and caches an override layer
in Dexie merged over the bundle. Triggered by a "Refresh capabilities" button in
Settings → Models, and opportunistically after a model import.

## Data model

Extend `ModelItem` in `src/types/index.ts`. The dropup is hidden when
`resolveReasoning` returns `undefined`.

```ts
interface ReasoningOption {
  label: string;         // shown in dropup, e.g. "High"
  value: string;         // literal sent to API, e.g. "high"; "" = off/omit
  budgetTokens?: number; // for budget-based providers (Anthropic/Gemini)
}

interface ModelReasoning {
  param: 'reasoning_effort' | 'reasoning' | 'thinking' | 'reasoning_enabled';
  options: ReasoningOption[]; // ordered; options[0] is the off/none state
  source?: 'manual';          // set only for a user override
}

// added to ModelItem:
reasoning?: ModelReasoning;   // present only for a manual override
selectedReasoning?: string;   // current picked value, remembered per-model
```

**Decisions:**
- `selectedReasoning` lives on the model item — per-model memory for free, persists
  through the existing `db.providerConfigs.update(id, { models })` path.
- The resolved descriptor normally comes from the catalog, not the item; the item's
  `reasoning` field is only populated for a manual override.
- `options[0]` is the off state: if `value === ''`, omit the param; otherwise send
  the literal value.

## Request injection

In `src/services/ai/openai.ts` (`streamOpenAI`, the live web path via
`router.streamChat`), resolve the active model's descriptor from `config`
(`config.models`, `config.selectedModel`, `config.baseUrl`) and inject by `param`:

- `reasoning_effort` → `{ reasoning_effort: value }`
- `reasoning` → `{ reasoning: { effort: value } }`
- `thinking` → `{ thinking: { type: 'enabled', budget_tokens } }` (from `budgetTokens`)
- `reasoning_enabled` → `{ reasoning: { enabled: true } }` (toggle On)
- off state (`value === ''`) → omit entirely.

## UI — reusable dropup

New `src/components/sidebar/ReasoningDropup.tsx`, reused in `ChatInput.tsx` and the
equivalent spot in `CRMAISidebar.tsx`, placed right after the model dropup. Mirrors
existing dropup markup (`chat-input-dropup-btn`, `.drop`, Brain icon,
`header-dropdown-item--active`). Renders the resolved descriptor's options; hidden
when the active model resolves to no descriptor. Selecting calls
`setModelReasoning(configId, modelId, value)`.

## Settings — manual override + refresh

In the model management panel (`src/components/settings/ModelsContent.tsx`):
- A "Refresh capabilities" button calling `refreshReasoningCatalog()`.
- A per-model override: toggle "Supports thinking" + editable comma-separated levels
  (first = off). Saving writes `reasoning` with `source: 'manual'`.

## Store + i18n

- `aiStore`: `setModelReasoning(configId, modelId, value)` and
  `setModelReasoningDescriptor(configId, modelId, reasoning|undefined)`.
- i18n: EN/TR keys — `chat.thinkingEffort`, `models.supportsThinking`,
  `models.thinkingLevelsHint`, `models.refreshCapabilities`.

## Out of scope

- Server-side (`aiRepository`) rework — the live path is `router.streamChat`.
- Per-provider custom injection shapes beyond the four `param` kinds above.

## Open items

- Toggle-only injection (`reasoning: { enabled: true }`) is a best-effort shape for
  OpenAI-compatible gateways; manual override covers a provider that rejects it.
- Snapshot is ~900KB raw; acceptable (compresses well). Revisit if bundle size
  becomes a concern.
