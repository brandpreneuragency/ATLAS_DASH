# Thinking-Effort Dropup — Design

**Date:** 2026-07-08
**Status:** Approved (decisions delegated to implementer)

## Goal

Add a "thinking effort" dropup next to the model dropup in the chat composer. It
shows the effort levels the **currently selected model** supports, remembers the
choice per model, and injects the right reasoning parameter into the API request.
It appears in both composers (`ChatInput` and `CRMAISidebar`) and is hidden for
models with no thinking capability.

## Key finding: effort levels are per-model and mostly not auto-discoverable

Reasoning controls are not uniform across providers or models:

- deepseek-flash → `off / high / max`
- mimo-2.5 → `off / low / mid / high`
- nemotron-ultra → `on / off`
- OpenAI o-series / gpt-5 → `off / low / med / high` (`reasoning_effort` string)
- Anthropic 3.7/4 → token **budget** (`thinking.budget_tokens`), not levels
- Gemini 2.5 → token **budget** (`thinkingConfig.thinkingBudget`)

The OpenAI-compatible `/models` endpoint (what opencode-go exposes) returns only
`{ id, name }` — it does **not** enumerate the allowed effort values. OpenRouter's
`/models` includes `supported_parameters` which reveals *that* a model accepts a
`reasoning` param (yes/no), but not its enum. So the specific level sets come from
model docs and cannot be fully imported. This drives a **hybrid** approach: curated
defaults + best-effort import detection + manual override.

## Data model

Extend `ModelItem` in `src/types/index.ts`. Absence of `reasoning` means the model
is not thinking-capable and the dropup is hidden.

```ts
interface ReasoningOption {
  label: string;         // shown in dropup, e.g. "High"
  value: string;         // literal sent to API, e.g. "high"; "" = off/omit
  budgetTokens?: number; // for budget-based providers (Anthropic/Gemini)
}

interface ModelReasoning {
  param: 'reasoning_effort' | 'reasoning' | 'thinking' | 'thinkingBudget';
  options: ReasoningOption[]; // ordered; options[0] is the "off/none" state
  source: 'map' | 'import' | 'manual';
}

// added to ModelItem:
reasoning?: ModelReasoning;
selectedReasoning?: string; // current picked value, remembered per-model
```

**Decisions:**
- `selectedReasoning` lives on the model item — gives per-model memory for free and
  persists through the existing `db.providerConfigs.update(id, { models })` path.
- `options[0]` is the "off" state. At request time: if its `value === ''`, omit the
  reasoning param; otherwise send the literal value (handles deepseek `off`,
  nemotron `on/off`).

## Capability resolution (hybrid)

Pure function `resolveReasoning(config, model): ModelReasoning | undefined`.
Precedence, highest first:

1. **Manual override** — user-set in settings (`source: 'manual'`). Always wins.
2. **Import-detected** — `importProviderModels` parses reasoning hints from the
   endpoint payload when present: OpenRouter/opencode-go style
   `supported_parameters` containing `reasoning` / `include_reasoning`, plus any
   raw enum fields the endpoint happens to expose. When found, mark capable and
   seed a sensible default option set (`source: 'import'`).
3. **Curated map** — new `src/services/ai/reasoningCatalog.ts`, keyed by model-id
   patterns:
   - `o[1-4].*` / `gpt-5.*` → `off/low/med/high` (`reasoning_effort`)
   - `claude-.*(3-7|opus-4|sonnet-4).*` → `off/low/med/high` mapped to
     `budgetTokens` (e.g. 0 / 4k / 12k / 24k), `param: 'thinking'`
   - `gemini-2.5-.*` → `off/low/med/high` mapped to `thinkingBudget`
4. No match → `undefined` → **no dropup**.

**Auto-fill honesty:** if opencode-go's `/models` yields only `id/name`, those
models fall through to manual entry (the backup path). A real sample of that
endpoint's response can be used later to tune the import parser without changing
the design.

## UI — reusable dropup

New `src/components/sidebar/ReasoningDropup.tsx`, reused in `ChatInput.tsx` (after
the model dropup at ~line 451) and the equivalent spot in `CRMAISidebar.tsx`.

- Mirrors existing dropup markup: `chat-input-dropup-btn`, `.drop`, Brain icon,
  `header-dropdown-item--active` on the current option.
- Reads `activeModel.reasoning.options`; renders one `drop-item` per option.
- Hidden entirely when the active model has no `reasoning`.
- Selecting calls store action `setModelReasoning(configId, modelId, value)`.
- Label shows current option (e.g. "High"); falls back to the off option's label.

## Request injection

In `src/services/ai/openai.ts` (`streamOpenAI`, the live web path via
`router.streamChat`), before building the body, resolve the active model's
`reasoning` + `selectedReasoning` from `config` and inject by `param`:

- `reasoning_effort` → `{ reasoning_effort: value }`
- `reasoning` → `{ reasoning: { effort: value } }`
- `thinking` → `{ thinking: { type: 'enabled', budget_tokens } }` (from `budgetTokens`)
- `thinkingBudget` → provider-appropriate `thinkingConfig` shape
- off state (`value === ''`) → omit the param entirely.

`streamAnthropic` gets the analogous `thinking` injection for the Tauri path.

## Settings — manual override

In the model management panel (`src/components/settings/ModelsContent.tsx`), a small
per-model editor:

- Toggle "Supports thinking".
- Editable ordered list of options (label / value rows, optional budget tokens).
- Saving writes `reasoning` with `source: 'manual'`, persisted via the store.

## Store + i18n

- `aiStore`: add `setModelReasoning(configId, modelId, value)` (updates the model
  item, persists to `db.providerConfigs`). Effort survives model switching because
  it is read from the model item.
- i18n: add EN/TR keys — `chat.thinkingEffort` and level labels (Off/Low/Med/High).

## Out of scope

- Server-side (`aiRepository`) rework — the live path is `router.streamChat`.
- Custom UI for non-standard budget mapping beyond the manual option editor.
- Auto-refreshing curated map from a remote source; it ships in-repo.

## Open item

- Obtain a sample opencode-go `/models` response to tune the import parser for
  deepseek / mimo / nemotron auto-fill. Manual override covers these until then.
