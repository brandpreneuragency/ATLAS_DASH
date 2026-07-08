// Generates a slim reasoning-capability snapshot from models.dev.
// Run: node scripts/sync-models-dev.mjs
// Output: src/data/reasoningCatalog.json  (id -> { param, options })
//
// models.dev is the general capability source (same DB opencode uses). We keep
// only what the effort dropup needs: whether a model reasons and its allowed
// levels/budget. Matching is by bare model id across all providers.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/data/reasoningCatalog.json', import.meta.url));
const SRC = 'https://models.dev/api.json';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Normalize a models.dev `reasoning_options` array into our descriptor. */
function toDescriptor(opts) {
  if (!Array.isArray(opts) || opts.length === 0) return null;
  const effort = opts.find((o) => o?.type === 'effort' && Array.isArray(o.values));
  const budget = opts.find((o) => o?.type === 'budget_tokens');
  const toggle = opts.find((o) => o?.type === 'toggle');

  // Effort values present (optionally alongside a toggle => toggle is the off state).
  if (effort) {
    const options = [{ label: 'Off', value: '' }];
    for (const v of effort.values) {
      if (v === 'none') continue; // 'none' == off; represented by the Off entry
      options.push({ label: cap(v), value: v });
    }
    return { param: 'reasoning_effort', options };
  }
  // Budget-only (e.g. native Anthropic): synthesize Off/Low/Med/High tiers >= min.
  if (budget) {
    const min = typeof budget.min === 'number' ? budget.min : 1024;
    return {
      param: 'thinking',
      options: [
        { label: 'Off', value: '', budgetTokens: 0 },
        { label: 'Low', value: 'low', budgetTokens: Math.max(min, 4000) },
        { label: 'Medium', value: 'medium', budgetTokens: Math.max(min, 12000) },
        { label: 'High', value: 'high', budgetTokens: Math.max(min, 24000) },
      ],
    };
  }
  // Toggle-only (on/off): enable via a `reasoning: { enabled }` object.
  if (toggle) {
    return {
      param: 'reasoning_enabled',
      options: [
        { label: 'Off', value: '' },
        { label: 'On', value: 'on' },
      ],
    };
  }
  return null;
}

const DEFAULT_EFFORT = {
  param: 'reasoning_effort',
  options: [
    { label: 'Off', value: '' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
  ],
};

// Native providers that don't advertise an `api` base URL in models.dev but have
// well-known hosts. Keeps host resolution correct for the big first-parties.
const NATIVE_HOSTS = {
  'api.anthropic.com': 'anthropic',
  'api.openai.com': 'openai',
  'generativelanguage.googleapis.com': 'google',
};

const res = await fetch(SRC);
if (!res.ok) throw new Error(`models.dev fetch failed: ${res.status}`);
const db = await res.json();

const providers = {}; // slug -> { id -> descriptor }
const byId = {};      // bare id -> richest descriptor (fallback)
const hosts = { ...NATIVE_HOSTS }; // host -> slug
let total = 0;
let withReasoning = 0;

for (const slug of Object.keys(db)) {
  const provider = db[slug];
  // Record host mapping from the provider's advertised api base URL.
  if (typeof provider?.api === 'string') {
    try { hosts[new URL(provider.api).host] = slug; } catch { /* ignore */ }
  }
  const models = provider?.models ?? {};
  const scoped = {};
  for (const id of Object.keys(models)) {
    total += 1;
    const m = models[id];
    if (!m?.reasoning) continue;
    const descriptor = toDescriptor(m.reasoning_options) ?? DEFAULT_EFFORT;
    scoped[id] = descriptor;
    // Bare-id fallback keeps the richest descriptor across providers.
    const existing = byId[id];
    if (!existing || descriptor.options.length > existing.options.length) {
      byId[id] = descriptor;
    }
    withReasoning += 1;
  }
  if (Object.keys(scoped).length > 0) providers[slug] = scoped;
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ providers, hosts, byId }));
console.log(`models scanned: ${total}, reasoning-capable: ${withReasoning}`);
console.log(`providers with reasoning models: ${Object.keys(providers).length}`);
console.log(`host mappings: ${Object.keys(hosts).length}`);
console.log(`unique fallback ids: ${Object.keys(byId).length}`);
console.log(`written: ${OUT}`);
