import type {
  MatchResult,
  MatchRegistry,
  CanonicalIdentity,
} from "./types";
import { normalizeCase, createSlugFromId } from "./normalize";
import { normalizeAlias } from "@model-monitor/schemas";

// ── Match registry builder ────────────────────────────────────────

/**
 * Build a MatchRegistry from an array of known canonical identities.
 */
export function buildMatchRegistry(
  identities: CanonicalIdentity[],
): MatchRegistry {
  const byCanonicalId = new Map<string, CanonicalIdentity>();
  const byAlias = new Map<string, string>();
  const byNameDeveloper = new Map<string, string>();
  const byFamilyGenDeveloper = new Map<string, string[]>();

  for (const identity of identities) {
    byCanonicalId.set(identity.canonicalId, identity);

    // Name + developer
    const nameDevKey = buildNameDevKey(identity.name, identity.developer);
    byNameDeveloper.set(nameDevKey, identity.canonicalId);

    // Family + generation + developer
    if (identity.family && identity.generation) {
      const fgdKey = buildFamilyGenDevKey(
        identity.family,
        identity.generation,
        identity.developer,
      );
      const existing = byFamilyGenDeveloper.get(fgdKey) ?? [];
      existing.push(identity.canonicalId);
      byFamilyGenDeveloper.set(fgdKey, existing);
    }

    // Aliases
    if (identity.aliases) {
      for (const alias of identity.aliases) {
        const normalized = normalizeAlias(alias);
        if (normalized) {
          byAlias.set(normalized, identity.canonicalId);
        }
      }
    }

    // sourceModelId → alias (for access-endpoint matching)
    if (identity.sourceModelId) {
      const normalized = normalizeAlias(identity.sourceModelId);
      if (normalized) {
        byAlias.set(normalized, identity.canonicalId);
      }
    }
  }

  return { byCanonicalId, byAlias, byNameDeveloper, byFamilyGenDeveloper };
}

// ── Key builders ──────────────────────────────────────────────────

function buildNameDevKey(name: string, developer: string): string {
  return `${normalizeCase(name)}::${normalizeCase(developer)}`;
}

function buildFamilyGenDevKey(
  family: string,
  generation: string,
  developer: string,
): string {
  return `${normalizeCase(family)}::${normalizeCase(generation)}::${normalizeCase(developer)}`;
}

// ── Matching ──────────────────────────────────────────────────────

/**
 * Match an imported row against the registry using deterministic
 * precedence:
 *
 * 1. exact canonical ID
 * 2. normalized alias
 * 3. name + developer
 * 4. family + generation + developer
 * 5. manual review
 *
 * Supports access endpoint matching by provider_model_id.
 */
export function matchRow(
  registry: MatchRegistry,
  params: {
    /** The Model ID from the workbook (may be null for access-only rows). */
    modelId: string | null;
    /** The provider model ID (may differ from canonical ID). */
    providerModelId: string | null;
    /** Normalized model name. */
    name: string | null;
    /** Resolved developer name. */
    developer: string | null;
    /** Model family. */
    family: string | null;
    /** Model generation. */
    generation: string | null;
    /** Normalized aliases to try. */
    aliases?: string[];
  },
): MatchResult {
  const {
    modelId,
    providerModelId,
    name,
    developer,
    family,
    generation,
    aliases = [],
  } = params;

  // ── Level 1: exact canonical ID ──────────────────────────────────
  if (modelId) {
    const exact = registry.byCanonicalId.get(modelId);
    if (exact) {
      return {
        candidateCanonicalId: exact.canonicalId,
        matchLevel: "exact_canonical_id",
        confidence: 1,
        conflicts: [],
        note: `Exact match by canonical ID "${modelId}"`,
      };
    }

    // Also try as a provider_model_id for access matching
    // (provider model IDs like "opencode-go/glm-5.2" may differ from
    // canonical IDs like "z-ai/glm-5.2")
    for (const [, identity] of registry.byCanonicalId) {
      if (
        providerModelId &&
        identity.aliases?.some(
          (a) => normalizeAlias(a) === normalizeAlias(providerModelId),
        )
      ) {
        return {
          candidateCanonicalId: identity.canonicalId,
          matchLevel: "exact_canonical_id",
          confidence: 0.95,
          conflicts: [],
          note: `Access match: provider_model_id "${providerModelId}" matches alias of "${identity.canonicalId}"`,
        };
      }
    }

    // Try slugified model ID against canonical IDs
    const slug = createSlugFromId(modelId);
    for (const [, identity] of registry.byCanonicalId) {
      const idSlug = createSlugFromId(identity.canonicalId);
      if (slug === idSlug) {
        return {
          candidateCanonicalId: identity.canonicalId,
          matchLevel: "exact_canonical_id",
          confidence: 0.9,
          conflicts: [],
          note: `Near match by slug: "${modelId}" → "${identity.canonicalId}"`,
        };
      }
    }
  }

  // ── Level 2: normalized alias ────────────────────────────────────
  for (const alias of aliases) {
    const normalized = normalizeAlias(alias);
    if (!normalized) continue;
    const found = registry.byAlias.get(normalized);
    if (found) {
      return {
        candidateCanonicalId: found,
        matchLevel: "normalized_alias",
        confidence: 0.9,
        conflicts: [],
        note: `Match by normalized alias "${normalized}" → "${found}"`,
      };
    }
  }

  // Also try modelId as an alias
  if (modelId) {
    const normalizedModelId = normalizeAlias(modelId);
    const found = registry.byAlias.get(normalizedModelId);
    if (found) {
      return {
        candidateCanonicalId: found,
        matchLevel: "normalized_alias",
        confidence: 0.9,
        conflicts: [],
        note: `Match by model ID as alias "${normalizedModelId}" → "${found}"`,
      };
    }
  }

  // Also try providerModelId as an alias
  if (providerModelId && providerModelId !== modelId) {
    const normalizedPmi = normalizeAlias(providerModelId);
    const found = registry.byAlias.get(normalizedPmi);
    if (found) {
      return {
        candidateCanonicalId: found,
        matchLevel: "normalized_alias",
        confidence: 0.9,
        conflicts: [],
        note: `Match by provider model ID as alias "${normalizedPmi}" → "${found}"`,
      };
    }
  }

  // ── Level 3: name + developer ────────────────────────────────────
  if (name) {
    // Try name + developer pair when developer is known
    if (developer) {
      const nameDevKey = buildNameDevKey(name, developer);
      const found = registry.byNameDeveloper.get(nameDevKey);
      if (found) {
        return {
          candidateCanonicalId: found,
          matchLevel: "name_plus_developer",
          confidence: 0.85,
          conflicts: [],
          note: `Match by name "${name}" + developer "${developer}" → "${found}"`,
        };
      }
    }

    // Also try just the name against all identities
    const normalizedName = normalizeCase(name);
    const candidates: string[] = [];
    for (const [, identity] of registry.byCanonicalId) {
      if (normalizeCase(identity.name) === normalizedName) {
        candidates.push(identity.canonicalId);
      }
    }
    if (candidates.length === 1) {
      return {
        candidateCanonicalId: candidates[0]!,
        matchLevel: "name_plus_developer",
        confidence: 0.75,
        conflicts: [],
        note: `Match by name "${name}" (single candidate) → "${candidates[0]}"`,
      };
    }
    if (candidates.length > 1) {
      // Multiple models share the name but different developers
      return {
        candidateCanonicalId: null,
        matchLevel: "manual_review",
        confidence: 0,
        conflicts: candidates,
        note: developer
          ? `Multiple candidates found for name "${name}": ${candidates.join(", ")}; developer "${developer}" did not narrow`
          : `Multiple candidates found for name "${name}": ${candidates.join(", ")}; no developer provided to narrow`,
      };
    }
  }

  // ── Level 4: family + generation + developer ─────────────────────
  if (family && generation && developer) {
    const fgdKey = buildFamilyGenDevKey(family, generation, developer);
    const found = registry.byFamilyGenDeveloper.get(fgdKey);
    if (found && found.length === 1) {
      return {
        candidateCanonicalId: found[0]!,
        matchLevel: "family_plus_generation_plus_developer",
        confidence: 0.8,
        conflicts: [],
        note: `Match by family "${family}" + generation "${generation}" + developer "${developer}" → "${found[0]}"`,
      };
    }
    if (found && found.length > 1) {
      return {
        candidateCanonicalId: null,
        matchLevel: "manual_review",
        confidence: 0,
        conflicts: found,
        note: `Multiple candidates for family "${family}" + generation "${generation}" + developer "${developer}"`,
      };
    }
  }

  // ── Level 5: manual review ───────────────────────────────────────
  return {
    candidateCanonicalId: null,
    matchLevel: "manual_review",
    confidence: 0,
    conflicts: [],
    note: name
      ? `No match found for "${name}" (Model ID: ${modelId ?? "none"}) — requires manual review`
      : `No match found (no name provided) — requires manual review`,
  };
}
