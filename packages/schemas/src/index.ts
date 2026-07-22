import { z } from "zod";

// ── Enums ──────────────────────────────────────────────────────

export const recordStatusSchema = z.enum(["active", "archived"]);
export const subscriptionStatusSchema = z.enum(["active", "paused", "cancelled", "expired", "trial", "archived"]);
export const lifecycleStatusSchema = z.enum(["current", "ga", "preview", "beta", "legacy", "deprecated", "retired", "unavailable", "unknown"]);
export const availabilityStatusSchema = z.enum(["confirmed", "unconfirmed", "unavailable", "removed"]);
export const accessMethodSchema = z.enum(["oauth", "provider_api", "direct_api", "cli", "consumer_app", "web", "self_hosted", "other"]);
export const authenticationTypeSchema = z.enum(["oauth_subscription", "api_key", "consumer_subscription", "cli_session", "none", "other"]);
export const apiAccessTypeSchema = z.enum(["included", "separate_billing", "restricted_provider_api", "none_included", "none", "unknown"]);
export const usageTrackingModeSchema = z.enum(["manual", "mock", "estimated", "provider_reported", "hybrid"]);
export const sourceTypeSchema = z.enum(["official_docs", "official_model_card", "official_pricing", "benchmark_report", "vendor_blog", "third_party", "workbook", "manual", "other"]);

// ── Model write schema ─────────────────────────────────────────

export const modelWriteSchema = z.object({
  canonicalId: z.string().min(1),
  name: z.string().min(1),
  developerId: z.string().uuid(),
  family: z.string().nullable().optional(),
  generation: z.string().nullable().optional(),
  lifecycle: lifecycleStatusSchema.default("unknown"),
  lifecycleRaw: z.string().nullable().optional(),
  releaseDate: z.string().date().nullable().optional(),
  knowledgeCutoff: z.string().nullable().optional(),
  modelType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  codingSpecialization: z.string().nullable().optional(),
  bestUse: z.string().nullable().optional(),
  avoidFor: z.string().nullable().optional(),
  contextTokens: z.number().int().nonnegative().nullable().optional(),
  maxOutputTokens: z.number().int().nonnegative().nullable().optional(),
  speedRating: z.string().nullable().optional(),
  needsRecheck: z.boolean().default(true),
});

export const modelResponseSchema = modelWriteSchema.extend({
  id: z.string().uuid(),
  status: recordStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
    }),
    meta: z.object({
      requestId: z.string(),
    }).optional(),
  });
