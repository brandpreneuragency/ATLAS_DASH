import { z } from "zod";

// ── Enums ──────────────────────────────────────────────────────

export const recordStatusSchema = z.enum(["active", "archived"]);
export const subscriptionStatusSchema = z.enum([
  "active",
  "paused",
  "cancelled",
  "expired",
  "trial",
  "archived",
]);
export const lifecycleStatusSchema = z.enum([
  "current",
  "ga",
  "preview",
  "beta",
  "legacy",
  "deprecated",
  "retired",
  "unavailable",
  "unknown",
]);
export const availabilityStatusSchema = z.enum([
  "confirmed",
  "unconfirmed",
  "unavailable",
  "removed",
]);
export const accessMethodSchema = z.enum([
  "oauth",
  "provider_api",
  "direct_api",
  "cli",
  "consumer_app",
  "web",
  "self_hosted",
  "other",
]);
export const authenticationTypeSchema = z.enum([
  "oauth_subscription",
  "api_key",
  "consumer_subscription",
  "cli_session",
  "none",
  "other",
]);
export const apiAccessTypeSchema = z.enum([
  "included",
  "separate_billing",
  "restricted_provider_api",
  "none_included",
  "none",
  "unknown",
]);
export const usageTrackingModeSchema = z.enum([
  "manual",
  "mock",
  "estimated",
  "provider_reported",
  "hybrid",
]);
export const sourceTypeSchema = z.enum([
  "official_docs",
  "official_model_card",
  "official_pricing",
  "benchmark_report",
  "vendor_blog",
  "third_party",
  "workbook",
  "manual",
  "other",
]);
export const auditActionSchema = z.enum([
  "create",
  "update",
  "archive",
  "restore",
  "merge",
  "import",
  "export",
  "token_create",
  "token_revoke",
  "settings_change",
  "delete",
]);

/** Tri-state capability: true | false | null (unknown). Never coerce null → false. */
export const triStateBooleanSchema = z.boolean().nullable();

export const modelCapabilityKeys = [
  "vision",
  "reasoning",
  "toolUse",
  "parallelAgents",
  "computerUse",
  "audioInput",
  "videoInput",
  "imageInput",
  "structuredOutput",
  "functionCalling",
] as const;

export type ModelCapabilityKey = (typeof modelCapabilityKeys)[number];

export const modelCapabilitiesWriteSchema = z.object({
  vision: triStateBooleanSchema.optional(),
  reasoning: triStateBooleanSchema.optional(),
  toolUse: triStateBooleanSchema.optional(),
  parallelAgents: triStateBooleanSchema.optional(),
  computerUse: triStateBooleanSchema.optional(),
  audioInput: triStateBooleanSchema.optional(),
  videoInput: triStateBooleanSchema.optional(),
  imageInput: triStateBooleanSchema.optional(),
  structuredOutput: triStateBooleanSchema.optional(),
  functionCalling: triStateBooleanSchema.optional(),
  details: z.record(z.unknown()).optional(),
});

export const modelAliasWriteSchema = z.object({
  alias: z.string().min(1),
  aliasType: z.string().min(1).default("display"),
  accessProviderId: z.string().uuid().nullable().optional(),
});

// ── Model write schema ─────────────────────────────────────────

const emptyToNull = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

export const modelWriteSchema = z.object({
  canonicalId: z.string().min(1),
  name: z.string().min(1),
  developerId: z.string().uuid(),
  family: z.preprocess(emptyToNull, z.string().nullable().optional()),
  generation: z.preprocess(emptyToNull, z.string().nullable().optional()),
  lifecycle: lifecycleStatusSchema.default("unknown"),
  lifecycleRaw: z.preprocess(emptyToNull, z.string().nullable().optional()),
  releaseDate: z.preprocess(emptyToNull, z.string().date().nullable().optional()),
  knowledgeCutoff: z.preprocess(emptyToNull, z.string().nullable().optional()),
  modelType: z.preprocess(emptyToNull, z.string().nullable().optional()),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  codingSpecialization: z.preprocess(emptyToNull, z.string().nullable().optional()),
  bestUse: z.preprocess(emptyToNull, z.string().nullable().optional()),
  avoidFor: z.preprocess(emptyToNull, z.string().nullable().optional()),
  contextTokens: z.number().int().nonnegative().nullable().optional(),
  maxOutputTokens: z.number().int().nonnegative().nullable().optional(),
  speedRating: z.preprocess(emptyToNull, z.string().nullable().optional()),
  needsRecheck: z.boolean().default(true),
  capabilities: modelCapabilitiesWriteSchema.optional(),
  aliases: z.array(modelAliasWriteSchema).optional(),
});

export const modelUpdateSchema = modelWriteSchema.partial().extend({
  canonicalId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  developerId: z.string().uuid().optional(),
});

export const modelResponseSchema = modelWriteSchema.extend({
  id: z.string().uuid(),
  slug: z.string(),
  status: recordStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ── List / filter query ────────────────────────────────────────

const booleanQuery = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === "boolean") return v;
    return v === "true";
  });

export const modelListQuerySchema = z.object({
  search: z.string().optional(),
  developer: z.string().optional(),
  family: z.string().optional(),
  lifecycle: z.string().optional(),
  accessProvider: z.string().optional(),
  subscription: z.string().optional(),
  archived: booleanQuery,
  accessible: booleanQuery,
  vision: booleanQuery,
  reasoning: booleanQuery,
  toolSupport: booleanQuery,
  needsRecheck: booleanQuery,
  sort: z.string().optional().default("name"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  page: z.coerce.number().int().min(1).optional(),
});

export type ModelListQuery = z.infer<typeof modelListQuerySchema>;

export const modelMergeSchema = z.object({
  sourceModelId: z.string().uuid(),
  targetModelId: z.string().uuid(),
  resolutions: z.record(z.unknown()).optional(),
});

export const modelScoreWriteSchema = z.object({
  methodologyId: z.string().uuid(),
  scoreType: z.string().min(1),
  /** null means unknown/blank — never coerce to 0 */
  scoreValue: z.number().nullable(),
  rankValue: z.number().int().positive().nullable().optional(),
  eligibleCount: z.number().int().positive().nullable().optional(),
  confidence: z.number().min(0).max(100).nullable().optional(),
  isManualOverride: z.boolean().default(false),
  overrideReason: z.string().nullable().optional(),
  calculatedAt: z.string().datetime().optional(),
}).superRefine((val, ctx) => {
  if (val.isManualOverride && (!val.overrideReason || val.overrideReason.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Manual override requires a reason",
      path: ["overrideReason"],
    });
  }
});

export const sourceWriteSchema = z.object({
  sourceType: sourceTypeSchema,
  url: z.preprocess(emptyToNull, z.string().url().nullable().optional()),
  title: z.preprocess(emptyToNull, z.string().nullable().optional()),
  publisher: z.preprocess(emptyToNull, z.string().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
  verifiedAt: z.preprocess(emptyToNull, z.string().datetime().nullable().optional()),
});

// ── Subscription write schema ──────────────────────────────────

export const subscriptionWriteSchema = z.object({
  planId: z.string().uuid(),
  accountLabel: z.string().min(1),
  status: subscriptionStatusSchema.default("active"),
  startedAt: z.string().date().nullable().optional(),
  nextBillingDate: z.string().date().nullable().optional(),
  autoRenews: z.boolean().nullable().optional(),
  actualPrice: z.number().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  billingInterval: z.string().nullable().optional(),
  usageTrackingMode: usageTrackingModeSchema.default("manual"),
  usageCheckUrl: z.string().url().nullable().optional(),
  usageCheckInstructions: z.string().nullable().optional(),
  importance: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const subscriptionResponseSchema = subscriptionWriteSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ── Model access write schema ──────────────────────────────────

export const modelAccessWriteSchema = z.object({
  modelId: z.string().uuid(),
  planId: z.string().uuid(),
  providerModelId: z.string().nullable().optional(),
  availability: availabilityStatusSchema.default("unconfirmed"),
  accessMethod: accessMethodSchema,
  authenticationType: authenticationTypeSchema.default("other"),
  includedInPlan: z.boolean().nullable().optional(),
  apiCompatible: z.boolean().nullable().optional(),
  cliOnly: z.boolean().default(false),
  webOnly: z.boolean().default(false),
  oauthSupported: z.boolean().nullable().optional(),
  priority: z.number().int().nullable().optional(),
  limitations: z.string().nullable().optional(),
});

export const modelAccessResponseSchema = modelAccessWriteSchema.extend({
  id: z.string().uuid(),
});

// ── Developer write schema ─────────────────────────────────────

export const developerWriteSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  websiteUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Access provider write schema ───────────────────────────────

export const accessProviderWriteSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  providerType: z.string().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Plan write schema ──────────────────────────────────────────

export const planWriteSchema = z.object({
  accessProviderId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  planType: z.string().nullable().optional(),
  regularPrice: z.number().nullable().optional(),
  introductoryPrice: z.number().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  billingInterval: z.string().nullable().optional(),
  apiAccessType: apiAccessTypeSchema.default("unknown"),
  authenticationType: authenticationTypeSchema.default("other"),
  usageMeasurementType: z.string().nullable().optional(),
  termsSummary: z.string().nullable().optional(),
});

// ── API error schema ───────────────────────────────────────────

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    fieldErrors: z.record(z.array(z.string())).optional(),
  }),
});

// ── Collection response helper ─────────────────────────────────

export const collectionSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    page: z.object({
      nextCursor: z.string().nullable(),
      hasMore: z.boolean(),
      total: z.number().int().optional(),
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
    }),
    meta: z
      .object({
        requestId: z.string(),
      })
      .optional(),
  });

// ── Domain helpers (pure) ──────────────────────────────────────

/** Normalize alias for uniqueness / search matching. */
export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Slugify a model name for URL convenience fields. */
export function slugifyModelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Format a score for display. Blank/null never becomes "0".
 * Verified numeric zero remains "0".
 */
export function formatScoreDisplay(
  scoreValue: number | string | null | undefined,
): string {
  if (scoreValue === null || scoreValue === undefined || scoreValue === "") {
    return "—";
  }
  const n = typeof scoreValue === "number" ? scoreValue : Number(scoreValue);
  if (Number.isNaN(n)) return "—";
  return String(n);
}

/**
 * Format capability tri-state for UI.
 * unknown (null) is never shown as false/unsupported.
 */
export function formatCapabilityDisplay(
  value: boolean | null | undefined,
): "yes" | "no" | "unknown" {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

/** Parse loose capability labels from imports without coercing unknown → false. */
export function parseTriState(raw: unknown): boolean | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "unknown" || v === "n/a" || v === "na" || v === "?") {
    return null;
  }
  if (["true", "yes", "y", "1", "supported", "full"].includes(v)) return true;
  if (["false", "no", "n", "0", "unsupported", "none"].includes(v)) return false;
  return null;
}

export type ModelSortField =
  | "name"
  | "developer"
  | "family"
  | "lifecycle"
  | "context"
  | "updatedAt"
  | "verifiedAt"
  | "capability"
  | "balanced"
  | "value";

export function parseSortParam(sort: string | undefined): {
  field: ModelSortField;
  direction: "asc" | "desc";
} {
  const raw = (sort ?? "name").trim();
  const direction: "asc" | "desc" = raw.startsWith("-") ? "desc" : "asc";
  const key = raw.replace(/^-/, "").replace(/^scores\./, "");
  const allowed: ModelSortField[] = [
    "name",
    "developer",
    "family",
    "lifecycle",
    "context",
    "updatedAt",
    "verifiedAt",
    "capability",
    "balanced",
    "value",
  ];
  const field = (allowed.includes(key as ModelSortField) ? key : "name") as ModelSortField;
  return { field, direction };
}

/**
 * Plan alias transfers for merge: drop source aliases that collide with target
 * after normalization.
 */
export function planAliasMerge(
  targetNormalized: string[],
  sourceAliases: Array<{ alias: string; normalizedAlias: string }>,
): {
  transfer: Array<{ alias: string; normalizedAlias: string }>;
  skippedDuplicates: string[];
} {
  const existing = new Set(targetNormalized.map((a) => a.toLowerCase()));
  const transfer: Array<{ alias: string; normalizedAlias: string }> = [];
  const skippedDuplicates: string[] = [];
  for (const row of sourceAliases) {
    const key = row.normalizedAlias.toLowerCase();
    if (existing.has(key)) {
      skippedDuplicates.push(row.alias);
      continue;
    }
    existing.add(key);
    transfer.push(row);
  }
  return { transfer, skippedDuplicates };
}

/**
 * Access merge key: model already on target plan+providerModelId should not
 * create a second row when source is merged in.
 */
export function accessMergeKey(row: {
  planId: string;
  providerModelId: string | null;
}): string {
  return `${row.planId}::${row.providerModelId ?? ""}`;
}

export function planAccessMerge(
  targetKeys: string[],
  sourceRows: Array<{ id: string; planId: string; providerModelId: string | null }>,
): { transferIds: string[]; skippedDuplicateIds: string[] } {
  const existing = new Set(targetKeys);
  const transferIds: string[] = [];
  const skippedDuplicateIds: string[] = [];
  for (const row of sourceRows) {
    const key = accessMergeKey(row);
    if (existing.has(key)) {
      skippedDuplicateIds.push(row.id);
      continue;
    }
    existing.add(key);
    transferIds.push(row.id);
  }
  return { transferIds, skippedDuplicateIds };
}
