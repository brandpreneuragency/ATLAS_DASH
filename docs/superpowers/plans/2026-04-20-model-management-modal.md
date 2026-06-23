# Model Management Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-instance provider form with a full-page Model Management modal: collapsible provider rows (each with an API key popup), sub-rows per model with eye/hide toggles that control visibility in the sidebar quick-select list.

**Architecture:** One API key per provider type (not per instance), stored via existing `providerConfigs` DB table keyed by `provider`. Hidden models tracked as a `string[]` of `"provider:modelId"` persisted to the `settings` table. The new `ModelManagementModal` is wired into the existing `activeModal` system; `ModelsPanel` and `AIModelSelector` both filter by hidden models.

**Tech Stack:** React, Zustand, Dexie (IndexedDB), Tailwind CSS, lucide-react

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `'modelManagement'` to `AIProviderType`; add `ProviderKey` interface |
| Modify | `src/stores/aiStore.ts` | Add `hiddenModels`, `providerKeys` (one key per provider), `toggleHiddenModel`, `saveProviderKey`, load/persist hidden models |
| Modify | `src/stores/uiStore.ts` | Add `'modelManagement'` to modal union type |
| Create | `src/components/modals/ModelManagementModal.tsx` | Full modal: collapsible provider list + API key popup + model eye toggles |
| Modify | `src/components/sidebar/ModelsPanel.tsx` | Replace add-provider form with "Manage Models" button; filter visible models using `hiddenModels` |
| Modify | `src/components/header/AIModelSelector.tsx` | Filter dropdown to only show visible models |
| Modify | `src/App.tsx` | Register `<ModelManagementModal />` in modals slot |
| Delete logic | `src/components/modals/SettingsModal.tsx` | Remove provider add/edit form (keep file as thin shell or redirect to new modal) |

---

## Task 1: Extend types and store — hidden models + per-provider keys

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/aiStore.ts`
- Modify: `src/stores/uiStore.ts`

- [ ] **Step 1: Add `ProviderKey` interface and extend modal type in `src/types/index.ts`**

Replace the `AIProviderType` line and add after `AIProviderConfig`:

```ts
export type AIProviderType = 'gemini' | 'nvidia' | 'opencode' | 'groq' | 'mistral' | 'openrouter';

// One API key entry per provider type
export interface ProviderKey {
  provider: AIProviderType;
  apiKey: string;
  baseUrl?: string;
}
```

In the modal union type inside `uiStore.ts` (line 17):
```ts
activeModal: 'settings' | 'agentEditor' | 'quickPrompts' | 'editAgent' | 'modelManagement' | null;
```

- [ ] **Step 2: Add `hiddenModels` and `providerKeys` to `src/stores/aiStore.ts`**

Add to `AIStore` interface:
```ts
hiddenModels: string[];           // "provider:modelId" strings
providerKeys: Record<string, ProviderKey>; // keyed by provider type

toggleHiddenModel: (key: string) => void;  // key = "provider:modelId"
saveProviderKey: (pk: ProviderKey) => Promise<void>;
isModelHidden: (provider: string, modelId: string) => boolean;
```

Add initial state:
```ts
hiddenModels: [],
providerKeys: {},
```

Add implementations inside `create<AIStore>((set, get) => ({`:
```ts
toggleHiddenModel: (key) => {
  const current = get().hiddenModels;
  const next = current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key];
  set({ hiddenModels: next });
  db.settings.put({ key: 'hiddenModels', value: JSON.stringify(next) });
},

saveProviderKey: async (pk) => {
  const next = { ...get().providerKeys, [pk.provider]: pk };
  set({ providerKeys: next });
  db.settings.put({ key: 'providerKeys', value: JSON.stringify(next) });
  // Also keep providerConfigs in sync so existing streaming code still works.
  // One config per provider, id = provider string.
  const config: AIProviderConfig = {
    id: pk.provider,
    provider: pk.provider,
    apiKey: pk.apiKey,
    selectedModel: PROVIDER_MODELS[pk.provider]?.models[0] ?? '',
    isActive: true,
    baseUrl: pk.baseUrl,
  };
  await db.providerConfigs.put(config);
  set((s) => {
    const exists = s.providerConfigs.find((c) => c.id === pk.provider);
    const configs = exists
      ? s.providerConfigs.map((c) => (c.id === pk.provider ? config : c))
      : [...s.providerConfigs, config];
    return { providerConfigs: configs, activeProviderId: s.activeProviderId ?? pk.provider };
  });
},

isModelHidden: (provider, modelId) =>
  get().hiddenModels.includes(`${provider}:${modelId}`),
```

- [ ] **Step 3: Load `hiddenModels` and `providerKeys` in `loadAISettings`**

Inside the existing `loadAISettings` async function, add after the existing `db.settings.get` calls:
```ts
const hiddenModelsRow = await db.settings.get('hiddenModels');
const providerKeysRow = await db.settings.get('providerKeys');

let hiddenModels: string[] = [];
if (hiddenModelsRow?.value) {
  try { hiddenModels = JSON.parse(String(hiddenModelsRow.value)); } catch { hiddenModels = []; }
}

let providerKeys: Record<string, ProviderKey> = {};
if (providerKeysRow?.value) {
  try { providerKeys = JSON.parse(String(providerKeysRow.value)); } catch { providerKeys = {}; }
}
```

And add to the `set({...})` call:
```ts
hiddenModels,
providerKeys,
```

Add the import at the top of `aiStore.ts`:
```ts
import { PROVIDER_MODELS } from '../services/ai/router';
import type { Agent, AIProviderConfig, ProviderKey } from '../types';
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd c:/MYAPPS/TABS && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd c:/MYAPPS/TABS
git add src/types/index.ts src/stores/aiStore.ts src/stores/uiStore.ts
git commit -m "feat: add hiddenModels + providerKeys to store"
```

---

## Task 2: Build `ModelManagementModal`

**Files:**
- Create: `src/components/modals/ModelManagementModal.tsx`

The modal is a large (max-w-2xl) overlay with:
- Header: "Model Management" + X close button
- Body: scrollable list of provider rows
- Each provider row: chevron to expand/collapse + provider name + key status badge + "API Key" button on right
- Expanded: sub-rows for each model with Eye/EyeOff toggle on right
- API Key popup: small inline card (not a second modal) that slides open below the row, has a password input + save button

- [ ] **Step 1: Create `src/components/modals/ModelManagementModal.tsx`**

```tsx
import { useState } from 'react';
import { X, ChevronRight, ChevronDown, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { PROVIDER_MODELS } from '../../services/ai/router';
import type { AIProviderType, ProviderKey } from '../../types';

const PROVIDER_BASE_URLS: Record<AIProviderType, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  opencode: 'https://api.opencode.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

interface ApiKeyPopupProps {
  provider: AIProviderType;
  existing?: ProviderKey;
  onSave: (pk: ProviderKey) => void;
  onClose: () => void;
}

function ApiKeyPopup({ provider, existing, onSave, onClose }: ApiKeyPopupProps) {
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');
  const [show, setShow] = useState(false);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave({ provider, apiKey: apiKey.trim(), baseUrl: baseUrl.trim() || undefined });
    onClose();
  };

  return (
    <div className="mx-4 mb-2 p-3 bg-highlight/40 border border-brand/20 rounded-xl space-y-2">
      <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">
        API Key — {PROVIDER_MODELS[provider]?.label}
      </div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type={show ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Paste your API key…"
          className="flex-1 text-xs border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-brand font-mono bg-white"
        />
        <button onClick={() => setShow((v) => !v)} className="text-text-secondary hover:text-text-primary">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div>
        <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase mb-1">
          Base URL <span className="font-normal normal-case">(optional override)</span>
        </div>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={PROVIDER_BASE_URLS[provider]}
          className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-brand font-mono bg-white"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="flex-1 bg-brand text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-40"
        >
          Save Key
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 border border-border rounded-lg text-xs text-text-secondary hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ProviderRowProps {
  provider: AIProviderType;
}

function ProviderRow({ provider }: ProviderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [keyPopupOpen, setKeyPopupOpen] = useState(false);
  const { hiddenModels, providerKeys, toggleHiddenModel, saveProviderKey } = useAIStore();

  const info = PROVIDER_MODELS[provider];
  const existingKey = providerKeys[provider];
  const hasKey = Boolean(existingKey?.apiKey);

  const handleSaveKey = async (pk: ProviderKey) => {
    await saveProviderKey(pk);
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Provider header row */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded
            ? <ChevronDown size={15} className="text-text-secondary flex-shrink-0" />
            : <ChevronRight size={15} className="text-text-secondary flex-shrink-0" />
          }
          <span className="text-sm font-semibold text-text-primary">{info.label}</span>
          <span className="text-xs text-text-secondary ml-1">
            {info.models.length} model{info.models.length !== 1 ? 's' : ''}
          </span>
        </button>
        {hasKey && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            <Check size={10} /> Key set
          </span>
        )}
        <button
          onClick={() => { setKeyPopupOpen((v) => !v); setExpanded(true); }}
          className="flex items-center gap-1.5 text-xs text-brand font-medium px-2 py-1 rounded-lg border border-brand/30 hover:bg-highlight transition-colors"
        >
          <KeyRound size={12} />
          API Key
        </button>
      </div>

      {/* API Key popup */}
      {keyPopupOpen && (
        <ApiKeyPopup
          provider={provider}
          existing={existingKey}
          onSave={handleSaveKey}
          onClose={() => setKeyPopupOpen(false)}
        />
      )}

      {/* Model sub-rows */}
      {expanded && info.models.length > 0 && (
        <div className="border-t border-border divide-y divide-border bg-surface-muted">
          {info.models.map((modelId) => {
            const key = `${provider}:${modelId}`;
            const hidden = hiddenModels.includes(key);
            return (
              <div key={modelId} className="flex items-center gap-3 px-4 py-2">
                <span className={`flex-1 text-xs font-mono ${hidden ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                  {modelId}
                </span>
                <button
                  onClick={() => toggleHiddenModel(key)}
                  title={hidden ? 'Show in selector' : 'Hide from selector'}
                  className={`p-1 rounded transition-colors ${hidden ? 'text-text-secondary hover:text-text-primary' : 'text-brand hover:text-brand-dark'}`}
                >
                  {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty models state */}
      {expanded && info.models.length === 0 && (
        <div className="px-4 py-3 text-xs text-text-secondary border-t border-border bg-surface-muted">
          No models defined — models will appear here when added to the provider list.
        </div>
      )}
    </div>
  );
}

export function ModelManagementModal() {
  const { activeModal, setActiveModal } = useUIStore();

  if (activeModal !== 'modelManagement') return null;

  const providers = Object.keys(PROVIDER_MODELS) as AIProviderType[];

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Model Management</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Configure API keys and choose which models appear in the quick selector.
            </p>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {providers.map((provider) => (
            <ProviderRow key={provider} provider={provider} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/MYAPPS/TABS && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd c:/MYAPPS/TABS
git add src/components/modals/ModelManagementModal.tsx
git commit -m "feat: add ModelManagementModal component"
```

---

## Task 3: Wire modal into App + uiStore, update entry points

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/header/AIModelSelector.tsx`
- Modify: `src/components/sidebar/ModelsPanel.tsx`
- Modify: `src/components/modals/SettingsModal.tsx`

- [ ] **Step 1: Register modal in `src/App.tsx`**

Add import:
```ts
import { ModelManagementModal } from './components/modals/ModelManagementModal';
```

Add to the modals slot (inside the `<>` fragment):
```tsx
<ModelManagementModal />
```

- [ ] **Step 2: Point "Manage API Keys & Models" in `AIModelSelector.tsx` to new modal**

Change the settings button's `onClick` from `setActiveModal('settings')` to `setActiveModal('modelManagement')`:

```tsx
onClick={() => { setActiveModal('modelManagement'); setOpen(false); }}
```

Also filter the dropdown list to skip hidden models. The dropdown currently shows `providerConfigs` (one entry per saved config). Update to instead show all providers that have a key set, and respect `hiddenModels`:

Replace the entire dropdown content `{providerConfigs.map(...)}` block with:

```tsx
{providerConfigs.length === 0 && (
  <div className="px-4 py-3 text-sm text-text-secondary">
    No providers configured yet.
  </div>
)}

{providerConfigs.map((config) => {
  const visibleModels = (PROVIDER_MODELS[config.provider]?.models ?? [])
    .filter((m) => !isModelHidden(config.provider, m));
  if (visibleModels.length === 0) return null;
  return visibleModels.map((modelId) => (
    <button
      key={`${config.provider}:${modelId}`}
      onClick={() => {
        setActiveProvider(config.id);
        // store selected model on config
        setActiveModel(config.provider, modelId);
        setOpen(false);
      }}
      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 text-left">
        <div className="font-medium text-xs">
          {PROVIDER_MODELS[config.provider]?.label ?? config.provider}
        </div>
        <div className="text-xs text-text-secondary truncate">{modelId}</div>
      </div>
      {config.id === activeProviderId && config.selectedModel === modelId && (
        <Check size={14} className="text-brand flex-shrink-0" />
      )}
    </button>
  ));
})}
```

Add `setActiveModel` and `isModelHidden` to the destructured store values:
```ts
const { providerConfigs, activeProviderId, setActiveProvider, setActiveModel, isModelHidden } = useAIStore();
```

- [ ] **Step 3: Add `setActiveModel` to `aiStore.ts`**

Add to `AIStore` interface:
```ts
setActiveModel: (provider: string, modelId: string) => void;
```

Add implementation:
```ts
setActiveModel: (provider, modelId) => {
  set((s) => {
    const configs = s.providerConfigs.map((c) =>
      c.provider === provider ? { ...c, selectedModel: modelId } : c
    );
    db.providerConfigs.bulkPut(configs);
    return { providerConfigs: configs };
  });
},
```

- [ ] **Step 4: Simplify `ModelsPanel.tsx` — replace the add/edit form with a button**

`ModelsPanel` no longer needs the `ProviderForm`. Replace the entire component content with a simple list of configured providers + a "Manage Models" button that opens the modal:

```tsx
import { Layers, Settings2 } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import { PROVIDER_MODELS } from '../../services/ai/router';

export function ModelsPanel() {
  const { providerConfigs, activeProviderId, setActiveProvider, setActiveModel, isModelHidden } = useAIStore();
  const { setActiveModal } = useUIStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 rounded-[10px] bg-white">
        <h3 className="text-xs font-semibold text-text-primary">Models</h3>
        <button
          onClick={() => setActiveModal('modelManagement')}
          className="flex items-center gap-1 text-xs text-brand font-medium hover:text-brand-dark transition-colors"
        >
          <Settings2 size={13} /> Manage
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {providerConfigs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-highlight flex items-center justify-center mb-3">
              <Layers size={18} className="text-brand" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">No models configured</p>
            <p className="text-xs text-text-secondary">Add an API key to start chatting.</p>
            <button
              onClick={() => setActiveModal('modelManagement')}
              className="mt-3 text-xs text-brand font-medium hover:text-brand-dark transition-colors"
            >
              Open Model Management →
            </button>
          </div>
        )}

        {providerConfigs.map((config) => {
          const visibleModels = (PROVIDER_MODELS[config.provider]?.models ?? [])
            .filter((m) => !isModelHidden(config.provider, m));
          if (visibleModels.length === 0) return null;
          return (
            <div key={config.id} className="space-y-0.5">
              <div className="text-[10px] font-bold tracking-widest text-text-secondary uppercase px-2 pt-2 pb-1">
                {PROVIDER_MODELS[config.provider]?.label ?? config.provider}
              </div>
              {visibleModels.map((modelId) => {
                const isActive = config.id === activeProviderId && config.selectedModel === modelId;
                return (
                  <button
                    key={modelId}
                    onClick={() => { setActiveProvider(config.id); setActiveModel(config.provider, modelId); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-highlight text-brand font-semibold'
                        : 'text-text-primary hover:bg-gray-100'
                    }`}
                  >
                    {modelId}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update `SettingsModal.tsx` to redirect to new modal**

The settings modal no longer needs the provider form. Simplify it to just show a "Manage Models" redirect link, keeping the file in case other settings are added later:

Replace the "AI Providers" section inside `SettingsModal` with:

```tsx
<div>
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-text-primary">AI Models</h3>
  </div>
  <button
    onClick={() => setActiveModal('modelManagement')}
    className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-gray-50 transition-colors text-sm text-text-primary"
  >
    <span>Manage providers, API keys & models</span>
    <span className="text-text-secondary text-xs">→</span>
  </button>
</div>
```

Remove all `ProviderForm`, `PROVIDERS`, `addingProvider`, `editingConfig` state and imports no longer needed (`Plus`, `Trash2`, `Check`, `Eye`, `EyeOff`, `AIProviderConfig`, `AIProviderType`, `PROVIDER_MODELS`).

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd c:/MYAPPS/TABS && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd c:/MYAPPS/TABS
git add src/App.tsx src/components/header/AIModelSelector.tsx src/components/sidebar/ModelsPanel.tsx src/components/modals/SettingsModal.tsx src/stores/aiStore.ts
git commit -m "feat: wire ModelManagementModal, simplify ModelsPanel + SettingsModal"
```

---

## Task 4: Build and smoke-test

- [ ] **Step 1: Build**

```bash
cd c:/MYAPPS/TABS && npm run build 2>&1 | tail -20
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual smoke test checklist**

Start dev server: `npm run dev`

1. Open app → click the AI model selector button in the header → dropdown appears
2. Click "Manage API Keys & Models" → `ModelManagementModal` opens
3. Each provider row shows: label, model count, "API Key" button
4. Click chevron on a provider row → expands to show models with Eye icons (all visible by default)
5. Click Eye on a model → it gets a strikethrough, EyeOff icon shown
6. Close and reopen modal → hidden state persisted (survives modal close)
7. Refresh page → hidden state still persisted (survives page reload via IndexedDB)
8. Click "API Key" button on a provider → inline popup appears with password field and base URL field
9. Enter a key and click "Save Key" → popup closes, green "Key set" badge appears on row
10. Open ModelsPanel in sidebar → hidden models not shown; clicking a visible model sets it active
11. Open AIModelSelector dropdown → hidden models not shown

- [ ] **Step 3: Commit**

```bash
cd c:/MYAPPS/TABS
git add -A
git commit -m "feat: model management modal complete"
```
