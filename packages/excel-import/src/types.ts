// ── Intake types ──────────────────────────────────────────────────

export interface IntakeResult {
  /** Absolute path where the file was stored (caller-chosen location). */
  storedPath: string;
  /** SHA-256 hex digest of the file. */
  sha256: string;
  /** Size in bytes. */
  byteSize: number;
  /** Parser version that processed this file. */
  parserVersion: string;
  /** Per-sheet summaries after parsing. */
  sheetSummaries: SheetSummary[];
}

export interface IntakeOptions {
  /** Max file size in bytes (default 50 MB). */
  maxBytes?: number;
  /** Callback that receives the raw bytes and returns a storage path. */
  storeFile: (buffer: Buffer, originalName: string) => string | Promise<string>;
}

// ── Parse types ───────────────────────────────────────────────────

export interface SheetSummary {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  skippedRows: number;
  errorCount: number;
}

export interface CellProvenance {
  sheet: string;
  row: number;
  column: string;
}

/** Raw cell representation after parsing. */
export interface RawCell {
  /** The raw value as stored in the workbook. */
  value: unknown;
  /** Provenance info. */
  provenance: CellProvenance;
  /** True when the cell contained a formula (which was not evaluated). */
  isFormula: boolean;
}

/** A parsed row: keyed by column header, with provenance metadata. */
export interface ParsedRow {
  /** Column-header → raw cell value (null for blanks). */
  cells: Record<string, unknown>;
  /** Provenance for every populated cell. */
  provenance: CellProvenance[];
  /** True if the row contains only null/blank values. */
  isEmpty: boolean;
}

/** Result of parsing a single sheet. */
export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: ParsedRow[];
  errors: ParseError[];
}

export interface ParseError {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

/** Full parse result across all sheets. */
export interface ParseResult {
  sheets: ParsedSheet[];
  skippedSheets: string[];
  totalRows: number;
  totalErrors: number;
}

// ── Normalize types ───────────────────────────────────────────────

export interface NormalizedModelRow {
  /** From the "Model ID" column — may be null for access-only rows. */
  modelId: string | null;
  /** Normalized canonical ID derived from Model ID or matched identity. */
  resolvedCanonicalId: string | null;
  /** Model name. */
  name: string | null;
  /** Developer (not access provider). */
  developer: string | null;
  /** Access provider (e.g. "OpenCode Go", "CommandCode CLI"). */
  accessProvider: string | null;
  /** Package / plan name. */
  plan: string | null;
  /** Subscription label. */
  subscription: string | null;
  /** Family. */
  family: string | null;
  /** Generation. */
  generation: string | null;
  /** Lifecycle label (raw, preserved). */
  lifecycleRaw: string | null;
  /** Release date as ISO string or null. */
  releaseDate: string | null;
  /** Model type description. */
  modelType: string | null;
  /** Context window size. */
  contextTokens: number | null;
  /** Max output tokens. */
  maxOutputTokens: number | null;
  /** Speed rating label. */
  speedRating: string | null;
  /** Coding specialization text. */
  codingSpecialization: string | null;
  /** Best use guidance. */
  bestUse: string | null;
  /** Avoid for guidance. */
  avoidFor: string | null;
  /** Vision support tri-state. */
  visionSupport: boolean | null;
  /** Reasoning support text. */
  reasoningSupport: string | null;
  /** Tool / agent support text. */
  toolSupport: string | null;
  /** Knowledge cutoff. */
  knowledgeCutoff: string | null;
  /** Subscription price in USD (must not be stored on model). */
  subscriptionUsdMo: number | null;
  /** Intro price in USD. */
  introPriceUsd: number | null;
  /** Provider model ID for access mapping. */
  providerModelId: string | null;
  /** Source sheet name. */
  sourceSheet: string | null;
  /** Source row. */
  sourceRow: number | null;
  /** Verified on date. */
  verifiedOn: string | null;
  /** Needs recheck flag. */
  needsRecheck: boolean | null;
}

// ── Match types ───────────────────────────────────────────────────

export type MatchLevel =
  | "exact_canonical_id"
  | "normalized_alias"
  | "name_plus_developer"
  | "family_plus_generation_plus_developer"
  | "manual_review";

export interface MatchResult {
  /** The matched candidate canonical ID, or null for manual review. */
  candidateCanonicalId: string | null;
  /** How the match was determined. */
  matchLevel: MatchLevel;
  /** Confidence (0–1) of the match. */
  confidence: number;
  /** When multiple candidates were found, list them here. */
  conflicts: string[];
  /** Human-readable note about the match. */
  note: string;
}

export interface CanonicalIdentity {
  canonicalId: string;
  name: string;
  developer: string;
  family: string | null;
  generation: string | null;
  /** Normalized aliases for matching. */
  aliases?: string[];
  /** Provider-specific model ID (e.g. "opencode-go/mimo-v2.5") for access matching. */
  sourceModelId?: string;
}

/** Match registry: the set of known canonical models to match against. */
export interface MatchRegistry {
  byCanonicalId: Map<string, CanonicalIdentity>;
  byAlias: Map<string, string>; // normalized alias → canonicalId
  byNameDeveloper: Map<string, string>; // "name::developer" → canonicalId
  byFamilyGenDeveloper: Map<string, string[]>; // "family::gen::developer" → canonicalId[]
}
