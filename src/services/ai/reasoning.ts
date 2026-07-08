// Reasoning capability resolution. Data comes from a bundled models.dev snapshot,
// optionally overlaid by a runtime-refreshed override cached in Dexie. Pure w.r.t.
// resolution (no React); the refresh function performs I/O.
import type { ModelItem, ModelReasoning } from '../../types';
import bundled from '../../data/reasoningCatalog.json';
import { runtimeFetch } from '../http';

export interface ReasoningCatalog {
  providers: Record<string, Record<string, ModelReasoning>>;
  hosts: Record<string, string>;
  byId: Record<string, ModelReasoning>;
}

const BUNDLED = bundled as unknown as ReasoningCatalog;
let overlay: ReasoningCatalog | null = null;

/** Replace the in-memory override layer (called after a refresh or cache load). */
export function setReasoningOverlay(next: ReasoningCatalog | null): void {
  overlay = next;
}

function hostOf(baseUrl?: string): string | undefined {
  if (!baseUrl) return undefined;
  try { return new URL(baseUrl).host; } catch { return undefined; }
}

function lookup(cat: ReasoningCatalog, host: string | undefined, id: string): ModelReasoning | undefined {
  if (host) {
    const slug = cat.hosts[host];
    const scoped = slug ? cat.providers[slug]?.[id] : undefined;
    if (scoped) return scoped;
  }
  return cat.byId[id];
}

/**
 * Resolve a model's reasoning descriptor, or undefined if not thinking-capable.
 * Precedence: manual override on the item > overlay (provider-scoped, then id) >
 * bundled (provider-scoped, then id).
 */
export function resolveReasoning(model: ModelItem, baseUrl?: string): ModelReasoning | undefined {
  if (model.reasoning?.source === 'manual') return model.reasoning;
  const host = hostOf(baseUrl);
  return (overlay ? lookup(overlay, host, model.id) : undefined) ?? lookup(BUNDLED, host, model.id);
}

/** The option currently selected for a model, defaulting to the off option. */
export function selectedOption(reasoning: ModelReasoning, selectedValue?: string) {
  return reasoning.options.find((o) => o.value === selectedValue) ?? reasoning.options[0];
}

/** Request-body fragment for the chosen value; {} for the off state. */
export function buildReasoningPayload(
  reasoning: ModelReasoning,
  selectedValue?: string,
): Record<string, unknown> {
  const opt = selectedOption(reasoning, selectedValue);
  if (opt.value === '') return {};
  switch (reasoning.param) {
    case 'reasoning_effort':
      return { reasoning_effort: opt.value };
    case 'reasoning':
      return { reasoning: { effort: opt.value } };
    case 'thinking':
      return { thinking: { type: 'enabled', budget_tokens: opt.budgetTokens ?? 4000 } };
    case 'reasoning_enabled':
      return { reasoning: { enabled: true } };
    default:
      return {};
  }
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

interface ModelsDevOption { type?: string; values?: string[]; min?: number }
interface ModelsDevModel { reasoning?: boolean; reasoning_options?: ModelsDevOption[] }
interface ModelsDevProvider { api?: string; models?: Record<string, ModelsDevModel> }

/** Normalize a models.dev api.json object into our slim catalog. Mirrors scripts/sync-models-dev.mjs. */
export function normalizeModelsDev(db: Record<string, ModelsDevProvider>): ReasoningCatalog {
  const NATIVE_HOSTS: Record<string, string> = {
    'api.anthropic.com': 'anthropic',
    'api.openai.com': 'openai',
    'generativelanguage.googleapis.com': 'google',
  };
  const DEFAULT_EFFORT: ModelReasoning = {
    param: 'reasoning_effort',
    options: [
      { label: 'Off', value: '' }, { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' },
    ],
  };
  const toDescriptor = (opts: ModelsDevOption[] | undefined): ModelReasoning | null => {
    if (!Array.isArray(opts) || opts.length === 0) return null;
    const effort = opts.find((o) => o?.type === 'effort' && Array.isArray(o.values));
    const budget = opts.find((o) => o?.type === 'budget_tokens');
    const toggle = opts.find((o) => o?.type === 'toggle');
    if (effort && effort.values) {
      const options = [{ label: 'Off', value: '' }];
      for (const v of effort.values) { if (v !== 'none') options.push({ label: cap(v), value: v }); }
      return { param: 'reasoning_effort', options };
    }
    if (budget) {
      const min = typeof budget.min === 'number' ? budget.min : 1024;
      return { param: 'thinking', options: [
        { label: 'Off', value: '', budgetTokens: 0 },
        { label: 'Low', value: 'low', budgetTokens: Math.max(min, 4000) },
        { label: 'Medium', value: 'medium', budgetTokens: Math.max(min, 12000) },
        { label: 'High', value: 'high', budgetTokens: Math.max(min, 24000) },
      ] };
    }
    if (toggle) {
      return { param: 'reasoning_enabled', options: [
        { label: 'Off', value: '' }, { label: 'On', value: 'on' },
      ] };
    }
    return null;
  };
  const providers: ReasoningCatalog['providers'] = {};
  const hosts: ReasoningCatalog['hosts'] = { ...NATIVE_HOSTS };
  const byId: ReasoningCatalog['byId'] = {};
  for (const slug of Object.keys(db)) {
    const provider = db[slug];
    if (typeof provider?.api === 'string') {
      try { hosts[new URL(provider.api).host] = slug; } catch { /* ignore */ }
    }
    const models = provider?.models ?? {};
    const scoped: Record<string, ModelReasoning> = {};
    for (const id of Object.keys(models)) {
      const m = models[id];
      if (!m?.reasoning) continue;
      const descriptor = toDescriptor(m.reasoning_options) ?? DEFAULT_EFFORT;
      scoped[id] = descriptor;
      const existing = byId[id];
      if (!existing || descriptor.options.length > existing.options.length) byId[id] = descriptor;
    }
    if (Object.keys(scoped).length > 0) providers[slug] = scoped;
  }
  return { providers, hosts, byId };
}

/** Fetch models.dev, normalize, set the overlay, and return the fresh catalog. */
export async function refreshReasoningCatalog(): Promise<ReasoningCatalog> {
  const res = await runtimeFetch('https://models.dev/api.json', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`models.dev fetch failed: ${res.status}`);
  const db = await res.json() as Record<string, ModelsDevProvider>;
  const catalog = normalizeModelsDev(db);
  setReasoningOverlay(catalog);
  return catalog;
}
