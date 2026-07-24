import type { ParsedRow, NormalizedModelRow } from "./types";
import { parseTriState } from "@model-monitor/schemas";

// ── Provider -> Developer mappings ────────────────────────────────
// The "Provider" column in the workbook mixes developers and access
// providers. These mappings separate them.

const DEVELOPER_NAMES = new Set([
  "openai",
  "anthropic",
  "google",
  "xai",
  "deepseek",
  "mistral ai",
  "nvidia",
  "alibaba",
  "xiaomi",
  "minimax",
  "moonshot ai",
  "tencent",
  "stepfun",
  "z.ai",
  "nous research",
  "meta",
]);

const ACCESS_PROVIDER_KEYWORDS = new Set([
  "opencode",
  "opencode zen",
  "opencode go",
  "commandcode",
  "command code",
  "commandcode cli",
]);

/** Normalized provider name → canonical developer name. */
const PROVIDER_TO_DEVELOPER: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  deepseek: "DeepSeek",
  "mistral ai": "Mistral AI",
  nvidia: "NVIDIA",
  alibaba: "Alibaba",
  xiaomi: "Xiaomi",
  minimax: "MiniMax",
  "moonshot ai": "Moonshot AI",
  tencent: "Tencent",
  stepfun: "StepFun",
  "z.ai": "Z.ai",
  "nous research": "Nous Research",
  meta: "Meta",
};

/** Normalized provider name → access provider label. */
const PROVIDER_TO_ACCESS_PROVIDER: Record<string, string> = {
  opencode: "OpenCode",
  "opencode go": "OpenCode",
  "opencode zen": "OpenCode",
  commandcode: "CommandCode",
  "command code": "CommandCode",
  "commandcode cli": "CommandCode",
};

// ── Provider alias normalization ──────────────────────────────────
// Normalized aliases for provider names to enable consistent matching.

const PROVIDER_ALIASES: Record<string, string> = {
  // OpenAI / ChatGPT
  openai: "OpenAI",
  "open ai": "OpenAI",
  chatgpt: "OpenAI",
  // Anthropic
  anthropic: "Anthropic",
  claude: "Anthropic",
  // Google
  google: "Google",
  gemini: "Google",
  // xAI
  xai: "xAI",
  "x ai": "xAI",
  grok: "xAI",
  // DeepSeek
  deepseek: "DeepSeek",
  "deep seek": "DeepSeek",
  // Mistral
  mistral: "Mistral AI",
  "mistral ai": "Mistral AI",
  codestral: "Mistral AI",
  devstral: "Mistral AI",
  ministral: "Mistral AI",
  // NVIDIA
  nvidia: "NVIDIA",
  nemotron: "NVIDIA",
  // Alibaba
  alibaba: "Alibaba",
  qwen: "Alibaba",
  // Xiaomi
  xiaomi: "Xiaomi",
  mimo: "Xiaomi",
  // MiniMax
  minimax: "MiniMax",
  // Moonshot AI
  moonshot: "Moonshot AI",
  "moonshot ai": "Moonshot AI",
  kimi: "Moonshot AI",
  // Tencent
  tencent: "Tencent",
  hy3: "Tencent",
  // StepFun
  stepfun: "StepFun",
  step: "StepFun",
  // Z.ai
  "z.ai": "Z.ai",
  glm: "Z.ai",
  // Nous Research
  nous: "Nous Research",
  "nous research": "Nous Research",
  hermes: "Nous Research",
};

// ── Public API ────────────────────────────────────────────────────

/**
 * Normalize a string: trim and collapse whitespace.
 */
export function normalizeTrim(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed.replace(/\s+/g, " ");
}

/**
 * Normalize a string for case-insensitive matching: lowercase, trim.
 */
export function normalizeCase(s: string | null | undefined): string | null {
  const trimmed = normalizeTrim(s);
  return trimmed === null ? null : trimmed.toLowerCase();
}

/**
 * Resolve a provider name via alias map, or return the trimmed original.
 */
export function resolveProviderAlias(
  raw: string | null | undefined,
): string | null {
  const normalized = normalizeCase(raw);
  if (!normalized) return null;
  return PROVIDER_ALIASES[normalized] ?? normalizeTrim(raw);
}

/**
 * Create a stable slug from a canonical ID.
 */
export function createSlugFromId(canonicalId: string): string {
  return canonicalId
    .toLowerCase()
    .replace(/[^a-z0-9/._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\/+/g, "/")
    .slice(0, 120);
}

/**
 * Determine if a provider name represents a developer (not an access provider).
 */
export function isDeveloper(rawProvider: string | null | undefined): boolean {
  const normalized = normalizeCase(rawProvider);
  if (!normalized) return false;
  if (DEVELOPER_NAMES.has(normalized)) return true;
  return !ACCESS_PROVIDER_KEYWORDS.has(normalized);
}

/**
 * Determine the developer from a workbook row.
 * The "Provider" column may hold a developer or access provider name.
 * When it's an access provider, we look for the developer in other fields.
 */
export function resolveDeveloper(
  provider: string | null | undefined,
): string | null {
  if (!provider) return null;
  const normalized = normalizeCase(provider);
  if (!normalized) return null;
  // Access providers are not developers
  if (ACCESS_PROVIDER_KEYWORDS.has(normalized)) return null;
  if (PROVIDER_TO_DEVELOPER[normalized]) {
    return PROVIDER_TO_DEVELOPER[normalized];
  }
  return normalizeTrim(provider);
}

/**
 * Determine the access provider from a workbook row.
 * Returns null if the row describes a developer-direct model.
 */
export function resolveAccessProvider(
  provider: string | null | undefined,
  pkg: string | null | undefined,
): string | null {
  if (!provider) return null;
  const normalized = normalizeCase(provider);
  if (!normalized) return null;

  // Direct check
  if (PROVIDER_TO_ACCESS_PROVIDER[normalized]) {
    return PROVIDER_TO_ACCESS_PROVIDER[normalized];
  }

  // Check package name for access provider hints
  if (pkg) {
    const pkgLower = normalizeCase(pkg);
    if (pkgLower) {
      if (PROVIDER_TO_ACCESS_PROVIDER[pkgLower]) {
        return PROVIDER_TO_ACCESS_PROVIDER[pkgLower];
      }
    }
  }

  // If it's a known developer, there's no access provider from this field
  if (DEVELOPER_NAMES.has(normalized)) {
    return null;
  }

  return null;
}

/**
 * Parse a tri-state boolean from a raw cell value.
 * Re-exported from @model-monitor/schemas.
 */
export { parseTriState } from "@model-monitor/schemas";

/**
 * Normalize an entire parsed row from "Master Models" into a
 * NormalizedModelRow.
 */
export function normalizeMasterRow(
  row: ParsedRow,
): NormalizedModelRow {
  const cells = row.cells;
  const provider = cellString(cells["Provider"]);
  const pkg = cellString(cells["Package"]);
  const modelId = cellString(cells["Model ID"]);
  const name = cellString(cells["Model"]);

  return {
    modelId,
    resolvedCanonicalId: null, // filled by matcher
    name,
    developer: resolveDeveloper(provider),
    accessProvider: resolveAccessProvider(provider, pkg),
    plan: cellString(cells["Package"]),
    subscription: cellString(cells["Package"]),
    family: cellString(cells["Family"]),
    generation: cellString(cells["Generation"]),
    lifecycleRaw: cellString(cells["Status"]),
    releaseDate: cellString(cells["Release Date"]),
    modelType: cellString(cells["Model Type"]),
    contextTokens: cellNumber(cells["Context Tokens"]),
    maxOutputTokens: cellNumber(cells["Max Output Tokens"]),
    speedRating: cellString(cells["Speed Rating"]),
    codingSpecialization: cellString(cells["Coding Specialization"]),
    bestUse: cellString(cells["Best Use"]),
    avoidFor: cellString(cells["Avoid For"]),
    visionSupport: parseTriState(cells["Vision Support"]),
    reasoningSupport: cellString(cells["Reasoning Support"]),
    toolSupport: cellString(cells["Parallel-Agent Support"]),
    knowledgeCutoff: cellString(cells["Knowledge Cutoff"]),
    subscriptionUsdMo: cellNumber(cells["Subscription USD/mo"]),
    introPriceUsd: cellNumber(cells["Intro Price USD"]),
    providerModelId: modelId,
    sourceSheet: row.provenance[0]?.sheet ?? null,
    sourceRow: row.provenance[0]?.row ?? null,
    verifiedOn: cellString(cells["Verified On"]),
    needsRecheck: parseNeedsRecheck(cells["Needs Recheck"]),
  };
}

// ── Cell value helpers ────────────────────────────────────────────

function cellString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function cellNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseNeedsRecheck(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "y" || v === "true" || v === "1") return true;
  if (v === "no" || v === "n" || v === "false" || v === "0") return false;
  return null;
}
