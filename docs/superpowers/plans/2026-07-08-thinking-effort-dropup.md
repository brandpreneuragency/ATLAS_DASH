# Thinking-Effort Dropup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-model "thinking effort" dropup beside the model dropup in both chat composers, populated from the selected model's supported reasoning levels, and inject the chosen level into the API request.

**Architecture:** Model capability is resolved via a hybrid strategy — a curated in-repo catalog of known model families, best-effort detection during provider import, and a manual per-model override in settings. The selected level is stored on the `ModelItem` (`selectedReasoning`) so it is remembered per model and persists through the existing Dexie `providerConfigs` write path. A reusable `ReasoningDropup` component renders `model.reasoning.options` and is hidden when the model has no reasoning descriptor. At request time `streamOpenAI` injects the correct param.

**Tech Stack:** React 18 + TypeScript, Zustand store (`aiStore`), Dexie (`db.providerConfigs`), i18next, Vite.

**Verification note:** This repo has **no test runner** (no vitest/jest, no `*.test.ts`). The verification gate for every task is `npm run build` (`tsc -b && vite build`) + `npm run lint`, plus manual checks in `npm run dev`. Do not add a test harness — it is out of scope.

---

## File Structure

- Create `src/services/ai/reasoning.ts` — types (`ReasoningOption`, `ModelReasoning`), the curated catalog, `resolveReasoning()`, and `buildReasoningPayload()`. Single source of truth for reasoning logic; kept free of React/store imports.
- Modify `src/types/index.ts` — add `reasoning?` and `selectedReasoning?` to `ModelItem`.
- Modify `src/services/ai/importProviderModels.ts` — best-effort parse of reasoning hints into imported `ModelItem`s.
- Modify `src/services/ai/openai.ts` — inject reasoning payload into the request body.
- Modify `src/stores/aiStore.ts` — add `setModelReasoning` action + interface entry.
- Create `src/components/sidebar/ReasoningDropup.tsx` — reusable dropup, used by both composers.
- Modify `src/components/sidebar/ChatInput.tsx` — mount `ReasoningDropup` after the model dropup.
- Modify `src/components/sidebar/CRMAISidebar.tsx` — mount `ReasoningDropup` after the model dropup.
- Modify `src/components/settings/ModelsContent.tsx` — manual override editor per model.
- Modify `src/i18n/en.ts` and `src/i18n/tr.ts` — new keys.

---

## Task 1: Reasoning types, catalog, and resolver

**Files:**
- Create: `src/services/ai/reasoning.ts`
- Modify: `src/types/index.ts:153-163` (extend `ModelItem`)

- [ ] **Step 1: Add reasoning fields to `ModelItem`**

In `src/types/index.ts`, inside `export interface ModelItem { ... }` (currently ends after `currency?: 'USD';`), add two optional fields and import-free inline types. Add these lines before the closing `}` of `ModelItem`:

```ts
  /** Reasoning/thinking capability descriptor. Absent = not thinking-capable. */
  reasoning?: ModelReasoning;
  /** Current picked reasoning value for this model (the `value` of one option). */
  selectedReasoning?: string;
```

Then add these two interfaces immediately after the `ModelItem` interface:

```ts
export interface ReasoningOption {
  /** Shown in the dropup, e.g. "High". */
  label: string;
  /** Literal value sent to the API, e.g. "high". Empty string = off/omit. */
  value: string;
  /** Token budget for budget-based providers (Anthropic/Gemini). */
  budgetTokens?: number;
}

export interface ModelReasoning {
  /** How the value is injected into the request. */
  param: 'reasoning_effort' | 'reasoning' | 'thinking' | 'thinkingBudget';
  /** Ordered options; options[0] is the off/none state. */
  options: ReasoningOption[];
  /** Where this descriptor came from. */
  source: 'map' | 'import' | 'manual';
}
```

- [ ] **Step 2: Create the reasoning service**

Create `src/services/ai/reasoning.ts`:

```ts
// Single source of truth for model reasoning/thinking capability.
// No React or store imports — pure, so it can move behind an IPC bridge later.
import type { ModelItem, ModelReasoning, ReasoningOption } from '../../types';

/** Standard discrete effort set used by OpenAI-style providers. */
const EFFORT_LOW_HIGH: ReasoningOption[] = [
  { label: 'Off', value: '' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

/** Budget-mapped set for token-budget providers (Anthropic/Gemini). */
const BUDGET_SET: ReasoningOption[] = [
  { label: 'Off', value: '', budgetTokens: 0 },
  { label: 'Low', value: 'low', budgetTokens: 4000 },
  { label: 'Medium', value: 'medium', budgetTokens: 12000 },
  { label: 'High', value: 'high', budgetTokens: 24000 },
];

interface CatalogEntry {
  test: RegExp;
  reasoning: Omit<ModelReasoning, 'source'>;
}

/** Curated defaults keyed by model-id patterns. Maintained in-repo. */
const CATALOG: CatalogEntry[] = [
  { test: /^(o[1-4]|gpt-5)/i, reasoning: { param: 'reasoning_effort', options: EFFORT_LOW_HIGH } },
  { test: /claude.*(3-7|opus-4|sonnet-4)/i, reasoning: { param: 'thinking', options: BUDGET_SET } },
  { test: /^gemini-2\.5/i, reasoning: { param: 'thinkingBudget', options: BUDGET_SET } },
];

/**
 * Resolve a model's reasoning descriptor.
 * Precedence: manual (already on the item) > import (already on the item) > catalog.
 * Returns undefined when the model is not thinking-capable.
 */
export function resolveReasoning(model: ModelItem): ModelReasoning | undefined {
  if (model.reasoning && (model.reasoning.source === 'manual' || model.reasoning.source === 'import')) {
    return model.reasoning;
  }
  const hit = CATALOG.find((entry) => entry.test.test(model.id));
  if (hit) return { ...hit.reasoning, source: 'map' };
  return model.reasoning; // may still be a stored 'map' descriptor, or undefined
}

/** The option currently selected for a model, defaulting to the off option. */
export function selectedOption(reasoning: ModelReasoning, selectedValue?: string): ReasoningOption {
  return (
    reasoning.options.find((o) => o.value === selectedValue) ??
    reasoning.options[0]
  );
}

/**
 * Build the request-body fragment for the chosen reasoning value.
 * Returns {} for the off state (empty value with no literal), so the caller
 * can spread it unconditionally.
 */
export function buildReasoningPayload(
  reasoning: ModelReasoning,
  selectedValue?: string,
): Record<string, unknown> {
  const opt = selectedOption(reasoning, selectedValue);
  if (opt.value === '') return {}; // off = omit
  switch (reasoning.param) {
    case 'reasoning_effort':
      return { reasoning_effort: opt.value };
    case 'reasoning':
      return { reasoning: { effort: opt.value } };
    case 'thinking':
      return { thinking: { type: 'enabled', budget_tokens: opt.budgetTokens ?? 4000 } };
    case 'thinkingBudget':
      return { thinkingConfig: { thinkingBudget: opt.budgetTokens ?? 4000 } };
    default:
      return {};
  }
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors. (`buildReasoningPayload`/`resolveReasoning` are unused for now — if lint flags unused exports it will not, since they are exported.)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/services/ai/reasoning.ts
git commit -m "feat(ai): reasoning capability types, catalog, and resolver"
```

---

## Task 2: Best-effort import detection

**Files:**
- Modify: `src/services/ai/importProviderModels.ts:69-93` (`toModelItem`)

- [ ] **Step 1: Parse reasoning hints during import**

In `src/services/ai/importProviderModels.ts`, add a helper above `toModelItem` and set `reasoning` on the returned item when the endpoint exposes a hint. Replace the `return { id, name, enabled: true, capabilities: defaultCapabilities() };` block in `toModelItem` with a version that attaches `reasoning`:

```ts
function detectReasoning(entry: Record<string, unknown>): ModelReasoning | undefined {
  // OpenRouter / opencode-go style: supported_parameters lists accepted params.
  const params = entry.supported_parameters;
  if (Array.isArray(params)) {
    const hasReasoning = params.some(
      (p) => typeof p === 'string' && /^(reasoning|include_reasoning|reasoning_effort)$/i.test(p),
    );
    if (hasReasoning) {
      return {
        param: 'reasoning',
        options: [
          { label: 'Off', value: '' },
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ],
        source: 'import',
      };
    }
  }
  return undefined;
}
```

Add `ModelReasoning` to the type import at the top:

```ts
import type { ModelCapability, ModelItem, ModelReasoning } from '../../types';
```

Then in `toModelItem`, change the return to:

```ts
  const reasoning = detectReasoning(entry);
  return {
    id,
    name,
    enabled: true,
    capabilities: defaultCapabilities(),
    ...(reasoning ? { reasoning } : {}),
  };
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/ai/importProviderModels.ts
git commit -m "feat(ai): detect reasoning support during model import"
```

---

## Task 3: Store action `setModelReasoning`

**Files:**
- Modify: `src/stores/aiStore.ts:141` (interface) and `:535` (after `setActiveModel`)

- [ ] **Step 1: Add the interface entry**

In `src/stores/aiStore.ts`, in the store interface near `setActiveModel: (configId: string, modelSlug: string) => void;` (line ~141), add:

```ts
  setModelReasoning: (configId: string, modelSlug: string, value: string) => void;
```

- [ ] **Step 2: Implement the action**

Immediately after the `setActiveModel` implementation (ends at line ~535 with its closing `},`), add:

```ts
  setModelReasoning: (configId, modelSlug, value) => {
    const providerConfigs = get().providerConfigs.map((config) => {
      if (config.id !== configId) return config;
      const models = (config.models ?? []).map((m) =>
        m.id === modelSlug ? { ...m, selectedReasoning: value } : m,
      );
      return { ...config, models };
    });
    set({ providerConfigs });
    const models = providerConfigs.find((c) => c.id === configId)?.models;
    if (models) {
      void db.providerConfigs.update(configId, { models }).catch(() => undefined);
    }
  },
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/aiStore.ts
git commit -m "feat(store): add setModelReasoning action"
```

---

## Task 4: Request injection in `streamOpenAI`

**Files:**
- Modify: `src/services/ai/openai.ts:43-53` (request body)

- [ ] **Step 1: Inject the reasoning payload**

In `src/services/ai/openai.ts`, add the import at the top:

```ts
import { buildReasoningPayload, resolveReasoning } from './reasoning';
```

Then, just before the `const response = await runtimeFetch(...)` call, compute the payload:

```ts
  const activeModel = config.models?.find((m) => m.id === config.selectedModel);
  const reasoning = activeModel ? resolveReasoning(activeModel) : undefined;
  const reasoningPayload = reasoning
    ? buildReasoningPayload(reasoning, activeModel?.selectedReasoning)
    : {};
```

And spread it into the JSON body (the object currently containing `model`, `messages`, `stream`, `stream_options`):

```ts
    body: JSON.stringify({
      model: config.selectedModel || 'gpt-4o',
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...reasoningPayload,
    }),
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/ai/openai.ts
git commit -m "feat(ai): inject reasoning effort into chat request"
```

---

## Task 5: Reusable `ReasoningDropup` component

**Files:**
- Create: `src/components/sidebar/ReasoningDropup.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/sidebar/ReasoningDropup.tsx`. It mirrors the existing model dropup markup (`.chat-input-bottom-col`, `.chat-input-dropup-btn`, `.drop`, `.drop-item`, `header-dropdown-item--active`) and self-manages open state + outside-click:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../../stores/aiStore';
import { resolveReasoning, selectedOption } from '../../services/ai/reasoning';

/** Effort dropup shown only for the active reasoning-capable model. */
export function ReasoningDropup() {
  const { t } = useTranslation();
  const accentColor = 'var(--c-accent-2)';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { providerConfigs, activeProviderId, setModelReasoning } = useAIStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const config = providerConfigs.find((c) => c.id === activeProviderId);
  const model = config?.models?.find((m) => m.id === config.selectedModel);
  const reasoning = model ? resolveReasoning(model) : undefined;
  if (!config || !model || !reasoning) return null;

  const current = selectedOption(reasoning, model.selectedReasoning);

  return (
    <div ref={ref} className="chat-input-bottom-col chat-input-bottom-col--model">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chat-input-dropup-btn"
        data-active="true"
        style={{ color: accentColor }}
        aria-label={t('chat.thinkingEffort')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Brain size={12} className="chat-input-dropup-icon" />
        <span className="trunc med chat-input-dropup-label">{current.label}</span>
      </button>
      {open && (
        <div className="drop" style={{ left: 0, bottom: '100%', marginBottom: 4, minWidth: 140 }}>
          {reasoning.options.map((opt) => (
            <button
              type="button"
              key={opt.value || 'off'}
              onClick={() => { setModelReasoning(config.id, model.id, opt.value); setOpen(false); }}
              className={`drop-item${opt.value === current.value ? ' header-dropdown-item--active' : ''}`}
              style={{ fontSize: 'var(--fs-xs)' }}
            >
              <span className="med">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; component is unused for now (imported next task).

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/ReasoningDropup.tsx
git commit -m "feat(ui): reusable thinking-effort dropup component"
```

---

## Task 6: Mount the dropup in both composers

**Files:**
- Modify: `src/components/sidebar/ChatInput.tsx:2` (import) and `:495` (after model dropup `</div>`)
- Modify: `src/components/sidebar/CRMAISidebar.tsx` (import + after model dropup block ending ~line 770)

- [ ] **Step 1: Import and mount in ChatInput**

In `src/components/sidebar/ChatInput.tsx`, add the import after the existing imports (near line 18):

```tsx
import { ReasoningDropup } from './ReasoningDropup';
```

Then mount it immediately after the closing `</div>` of the model dropup column (the `<div ref={modelRef} className="chat-input-bottom-col chat-input-bottom-col--model">` block that ends at line ~495), i.e. right before the closing `</div>` of `chat-input-bottom-col--left`:

```tsx
            <ReasoningDropup />
```

- [ ] **Step 2: Import and mount in CRMAISidebar**

In `src/components/sidebar/CRMAISidebar.tsx`, add the import near the other sidebar imports:

```tsx
import { ReasoningDropup } from './ReasoningDropup';
```

Then mount `<ReasoningDropup />` immediately after the model dropup column block (the one containing the `Brain` icon at line ~736 and its `{modelDropdownOpen && (...)}` menu, closing around line ~770). Place it as a sibling right after that column's closing `</div>`.

- [ ] **Step 3: Verify in the running app**

Run: `npm run dev`, open the composer.
Expected: With a reasoning-capable model selected (e.g. a `gpt-5*`/`o*`/`claude-*-4*`/`gemini-2.5-*` model, or an imported model flagged during import), a Brain-icon "effort" dropup appears next to the model dropup and lets you pick a level. With a non-capable model selected, no effort dropup shows. Selecting a level and switching models then back restores the chosen level.

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/ChatInput.tsx src/components/sidebar/CRMAISidebar.tsx
git commit -m "feat(ui): show thinking-effort dropup in both composers"
```

---

## Task 7: Manual override editor in settings

**Files:**
- Modify: `src/components/settings/ModelsContent.tsx`
- Modify: `src/stores/aiStore.ts` (add `setModelReasoningDescriptor`)

- [ ] **Step 1: Add a store action to write the whole descriptor**

In `src/stores/aiStore.ts` interface (near the `setModelReasoning` entry from Task 3) add:

```ts
  setModelReasoningDescriptor: (
    configId: string,
    modelSlug: string,
    reasoning: import('../types').ModelReasoning | undefined,
  ) => void;
```

And after the `setModelReasoning` implementation add:

```ts
  setModelReasoningDescriptor: (configId, modelSlug, reasoning) => {
    const providerConfigs = get().providerConfigs.map((config) => {
      if (config.id !== configId) return config;
      const models = (config.models ?? []).map((m) =>
        m.id === modelSlug ? { ...m, reasoning } : m,
      );
      return { ...config, models };
    });
    set({ providerConfigs });
    const models = providerConfigs.find((c) => c.id === configId)?.models;
    if (models) {
      void db.providerConfigs.update(configId, { models }).catch(() => undefined);
    }
  },
```

- [ ] **Step 2: Add the per-model override UI**

In `src/components/settings/ModelsContent.tsx`, within the per-model row/card rendering, add a small "Thinking" control. Read the store action:

```tsx
const setModelReasoningDescriptor = useAIStore((s) => s.setModelReasoningDescriptor);
```

Render a toggle + comma-separated levels input per model (place near the existing model controls):

```tsx
{(() => {
  const r = model.reasoning;
  const enabled = !!r;
  const levelsText = r ? r.options.map((o) => o.label).join(', ') : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-xs)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            if (!e.target.checked) {
              setModelReasoningDescriptor(provider.id, model.id, undefined);
            } else {
              setModelReasoningDescriptor(provider.id, model.id, {
                param: 'reasoning_effort',
                source: 'manual',
                options: [
                  { label: 'Off', value: '' },
                  { label: 'Low', value: 'low' },
                  { label: 'Med', value: 'mid' },
                  { label: 'High', value: 'high' },
                ],
              });
            }
          }}
        />
        {t('models.supportsThinking')}
      </label>
      {enabled && (
        <input
          type="text"
          defaultValue={levelsText}
          title={t('models.thinkingLevelsHint')}
          style={{ flex: 1, minWidth: 120 }}
          onBlur={(e) => {
            const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
            if (parts.length === 0) return;
            const options = parts.map((label, i) => ({
              label,
              // First entry is the off state (empty value); others use lowercased label as the API value.
              value: i === 0 ? '' : label.toLowerCase(),
            }));
            setModelReasoningDescriptor(provider.id, model.id, {
              param: 'reasoning_effort',
              source: 'manual',
              options,
            });
          }}
        />
      )}
    </div>
  );
})()}
```

Note: adapt `provider` / `model` variable names to whatever the surrounding `.map` uses in `ModelsContent.tsx`. The levels input maps the first label to the off state (`value: ''`) and each subsequent label to its lowercased form as the API `value` — matching opencode-go models like `off, high, max` → sends `high`/`max`.

- [ ] **Step 3: Verify in the running app**

Run: `npm run dev`, open Settings → Models.
Expected: each model shows a "Supports thinking" toggle; enabling it and typing `Off, High, Max` makes the composer dropup for that model show those three levels; selecting `High`/`Max` sends `reasoning_effort: "high"`/`"max"`.

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/aiStore.ts src/components/settings/ModelsContent.tsx
git commit -m "feat(settings): manual per-model thinking override"
```

---

## Task 8: i18n keys

**Files:**
- Modify: `src/i18n/en.ts` and `src/i18n/tr.ts`

- [ ] **Step 1: Add EN keys**

In `src/i18n/en.ts`, under the `chat` section add:

```ts
    thinkingEffort: 'Thinking effort',
```

Under the `models` section add:

```ts
    supportsThinking: 'Supports thinking',
    thinkingLevelsHint: 'Comma-separated levels; first is off (e.g. Off, Low, Med, High)',
```

- [ ] **Step 2: Add TR keys**

In `src/i18n/tr.ts`, under the `chat` section add:

```ts
    thinkingEffort: 'Düşünme eforu',
```

Under the `models` section add:

```ts
    supportsThinking: 'Düşünmeyi destekler',
    thinkingLevelsHint: 'Virgülle ayrılmış seviyeler; ilki kapalı (örn. Kapalı, Düşük, Orta, Yüksek)',
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors, no missing-key warnings for `chat.thinkingEffort` / `models.supportsThinking`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/tr.ts
git commit -m "i18n: thinking-effort keys (EN/TR)"
```

---

## Task 9: Final end-to-end verification

- [ ] **Step 1: Full build + lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev` and verify:
1. Select a catalog model (`gpt-5*`/`o*`/`claude-*-4*`/`gemini-2.5-*`) → effort dropup appears, defaults to Off.
2. Select a non-capable model → no effort dropup.
3. In Settings → Models, enable "Supports thinking" on a plain model, set `Off, High, Max` → composer dropup shows those, selection persists across model switches.
4. Send a message with a level chosen; confirm via devtools Network that the request body includes the expected `reasoning_effort` / `reasoning` / `thinking` / `thinkingConfig` field (and omits it when Off).
5. Repeat check 1–2 in the CRM sidebar composer.

- [ ] **Step 3: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore: thinking-effort dropup final polish"
```

---

## Self-Review Notes

- **Spec coverage:** data model (T1), hybrid resolution — catalog (T1), import (T2), manual (T7); dropup in both composers (T5, T6); request injection (T4); per-model persistence via `selectedReasoning` (T1, T3); hide-when-unsupported (T5 returns null); i18n (T8). All spec sections mapped.
- **Type consistency:** `ModelReasoning`/`ReasoningOption` defined in T1 and reused verbatim in T2/T4/T5/T7. `setModelReasoning(configId, modelSlug, value)` and `setModelReasoningDescriptor(configId, modelSlug, reasoning)` signatures consistent across store + component usage.
- **Off semantics:** `options[0]` with `value === ''` → `buildReasoningPayload` returns `{}` (param omitted); literal `off`/`on` values (deepseek/nemotron) are sent because their `value` is non-empty.
- **Adaptation flags:** T6 and T7 note that exact JSX insertion points / loop variable names must be matched to the current file; catalog patterns (T1) are the maintenance surface as new models ship.
