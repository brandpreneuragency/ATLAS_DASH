import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  accessMergeKey,
  formatCapabilityDisplay,
  formatScoreDisplay,
  modelListQuerySchema,
  modelMergeSchema,
  modelUpdateSchema,
  modelWriteSchema,
  normalizeAlias,
  parseSortParam,
  planAccessMerge,
  planAliasMerge,
  slugifyModelName,
  type ModelListQuery,
} from "@model-monitor/schemas";
import * as schema from "../schema/index";

export type Db = PostgresJsDatabase<typeof schema>;

export class ModelServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ModelServiceError";
  }
}

function fieldErrorsFromZod(
  errors: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (value && value.length > 0) out[key] = value;
  }
  return out;
}

export interface AuditContext {
  actorUserId?: string | null;
  requestId?: string | null;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type AuditAction = (typeof schema.auditAction.enumValues)[number];

function asNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

async function writeAudit(
  db: Db | Tx,
  input: {
    entityType: string;
    entityId: string | null;
    action: AuditAction;
    beforeData?: unknown;
    afterData?: unknown;
    metadata?: unknown;
    ctx?: AuditContext;
  },
) {
  const [row] = await db
    .insert(schema.auditEvents)
    .values({
      actorUserId: input.ctx?.actorUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeData: input.beforeData ?? null,
      afterData: input.afterData ?? null,
      metadata: input.metadata ?? null,
      requestId: input.ctx?.requestId ?? null,
    })
    .returning({ id: schema.auditEvents.id });
  return row;
}

async function ensureUniqueSlug(db: Db | Tx, base: string, excludeId?: string) {
  let slug = slugifyModelName(base) || "model";
  let attempt = 0;
  while (attempt < 50) {
    const existing = await db
      .select({ id: schema.models.id })
      .from(schema.models)
      .where(eq(schema.models.slug, slug))
      .limit(1);
    if (!existing[0] || existing[0].id === excludeId) return slug;
    attempt += 1;
    slug = `${slugifyModelName(base)}-${attempt}`;
  }
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

function mapModelRow(
  row: typeof schema.models.$inferSelect,
  extras: {
    developerName?: string | null;
    developerSlug?: string | null;
    capabilities?: typeof schema.modelCapabilities.$inferSelect | null;
    scores?: Array<{
      scoreType: string;
      scoreValue: string | null;
      rankValue: number | null;
      methodologyVersion?: string | null;
      methodologyName?: string | null;
    }>;
    accessProviders?: string[];
    aliases?: Array<{ id: string; alias: string; aliasType: string }>;
  } = {},
) {
  const scoreMap: Record<
    string,
    { value: number | null; display: string; rank: number | null; methodologyVersion: string | null }
  > = {};
  for (const s of extras.scores ?? []) {
    const value = asNumber(s.scoreValue);
    scoreMap[s.scoreType] = {
      value,
      display: formatScoreDisplay(value),
      rank: s.rankValue,
      methodologyVersion: s.methodologyVersion ?? null,
    };
  }

  const caps = extras.capabilities;
  return {
    id: row.id,
    canonicalId: row.canonicalId,
    name: row.name,
    slug: row.slug,
    developerId: row.developerId,
    developerName: extras.developerName ?? null,
    developerSlug: extras.developerSlug ?? null,
    family: row.family,
    generation: row.generation,
    lifecycle: row.lifecycle,
    lifecycleRaw: row.lifecycleRaw,
    releaseDate: row.releaseDate,
    knowledgeCutoff: row.knowledgeCutoff,
    modelType: row.modelType,
    description: row.description,
    codingSpecialization: row.codingSpecialization,
    bestUse: row.bestUse,
    avoidFor: row.avoidFor,
    contextTokens: row.contextTokens,
    maxOutputTokens: row.maxOutputTokens,
    speedRating: row.speedRating,
    verifiedTps: asNumber(row.verifiedTps),
    verificationStatus: row.verificationStatus,
    verifiedAt: toIso(row.verifiedAt),
    needsRecheck: row.needsRecheck,
    status: row.status,
    archivedAt: toIso(row.archivedAt),
    mergedIntoModelId: row.mergedIntoModelId,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    capabilities: caps
      ? {
          vision: caps.vision,
          reasoning: caps.reasoning,
          toolUse: caps.toolUse,
          parallelAgents: caps.parallelAgents,
          computerUse: caps.computerUse,
          audioInput: caps.audioInput,
          videoInput: caps.videoInput,
          imageInput: caps.imageInput,
          structuredOutput: caps.structuredOutput,
          functionCalling: caps.functionCalling,
          details: caps.details,
          display: {
            vision: formatCapabilityDisplay(caps.vision),
            reasoning: formatCapabilityDisplay(caps.reasoning),
            toolUse: formatCapabilityDisplay(caps.toolUse),
          },
        }
      : null,
    scores: scoreMap,
    accessProviders: extras.accessProviders ?? [],
    aliases: extras.aliases ?? [],
  };
}

export function parseModelListQuery(input: unknown): ModelListQuery {
  const parsed = modelListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid model list query",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  return parsed.data;
}

export async function listModels(db: Db, rawQuery: unknown) {
  const query = parseModelListQuery(rawQuery);
  const { field, direction } = parseSortParam(query.sort);
  const limit = query.limit ?? 50;
  const page = query.page ?? 1;
  const offset = query.cursor
    ? Number.parseInt(Buffer.from(query.cursor, "base64url").toString("utf8"), 10) || 0
    : (page - 1) * limit;

  const conditions: SQL[] = [];

  if (query.archived === true) {
    conditions.push(eq(schema.models.status, "archived"));
  } else if (query.archived === false || query.archived === undefined) {
    // default: active only
    conditions.push(eq(schema.models.status, "active"));
  }

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    conditions.push(
      sql`(
        ${schema.models.name} ILIKE ${term}
        OR ${schema.models.canonicalId} ILIKE ${term}
        OR ${schema.models.family} ILIKE ${term}
        OR EXISTS (
          SELECT 1 FROM model_aliases ma
          WHERE ma.model_id = ${schema.models.id}
            AND (ma.alias ILIKE ${term} OR ma.normalized_alias ILIKE ${term})
        )
        OR EXISTS (
          SELECT 1 FROM developers d2
          WHERE d2.id = ${schema.models.developerId}
            AND (d2.name ILIKE ${term} OR d2.slug ILIKE ${term})
        )
        OR EXISTS (
          SELECT 1 FROM model_access mac
          JOIN plans p ON p.id = mac.plan_id
          JOIN access_providers ap ON ap.id = p.access_provider_id
          WHERE mac.model_id = ${schema.models.id}
            AND mac.status = 'active'
            AND (ap.name ILIKE ${term} OR ap.slug ILIKE ${term})
        )
      )`,
    );
  }

  if (query.developer?.trim()) {
    const d = query.developer.trim();
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM developers d
        WHERE d.id = ${schema.models.developerId}
          AND (d.slug = ${d} OR d.name ILIKE ${`%${d}%`} OR d.id::text = ${d})
      )`,
    );
  }

  if (query.family?.trim()) {
    conditions.push(ilike(schema.models.family, query.family.trim()));
  }

  if (query.lifecycle?.trim()) {
    conditions.push(eq(schema.models.lifecycle, query.lifecycle.trim() as typeof schema.models.$inferSelect.lifecycle));
  }

  if (query.needsRecheck !== undefined) {
    conditions.push(eq(schema.models.needsRecheck, query.needsRecheck));
  }

  if (query.accessProvider?.trim()) {
    const ap = query.accessProvider.trim();
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM model_access mac
        JOIN plans p ON p.id = mac.plan_id
        JOIN access_providers prov ON prov.id = p.access_provider_id
        WHERE mac.model_id = ${schema.models.id}
          AND mac.status = 'active'
          AND (prov.slug = ${ap} OR prov.name ILIKE ${`%${ap}%`})
      )`,
    );
  }

  if (query.subscription?.trim()) {
    const sub = query.subscription.trim();
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM model_access mac
        JOIN plans p ON p.id = mac.plan_id
        JOIN subscriptions s ON s.plan_id = p.id
        WHERE mac.model_id = ${schema.models.id}
          AND mac.status = 'active'
          AND (s.id::text = ${sub} OR s.account_label ILIKE ${`%${sub}%`} OR s.external_seed_id = ${sub})
      )`,
    );
  }

  if (query.accessible === true) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM model_access mac
        WHERE mac.model_id = ${schema.models.id}
          AND mac.status = 'active'
          AND mac.availability = 'confirmed'
      )`,
    );
  } else if (query.accessible === false) {
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM model_access mac
        WHERE mac.model_id = ${schema.models.id}
          AND mac.status = 'active'
          AND mac.availability = 'confirmed'
      )`,
    );
  }

  if (query.vision !== undefined) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM model_capabilities mc
        WHERE mc.model_id = ${schema.models.id}
          AND mc.vision = ${query.vision}
      )`,
    );
  }
  if (query.reasoning !== undefined) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM model_capabilities mc
        WHERE mc.model_id = ${schema.models.id}
          AND mc.reasoning = ${query.reasoning}
      )`,
    );
  }
  if (query.toolSupport !== undefined) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM model_capabilities mc
        WHERE mc.model_id = ${schema.models.id}
          AND mc.tool_use = ${query.toolSupport}
      )`,
    );
  }

  const whereExpr = conditions.length ? and(...conditions) : undefined;

  const dirFn = direction === "desc" ? desc : asc;
  let orderBy: SQL;
  switch (field) {
    case "developer":
      orderBy = dirFn(schema.developers.name);
      break;
    case "family":
      orderBy = dirFn(schema.models.family);
      break;
    case "lifecycle":
      orderBy = dirFn(schema.models.lifecycle);
      break;
    case "context":
      orderBy = dirFn(schema.models.contextTokens);
      break;
    case "updatedAt":
      orderBy = dirFn(schema.models.updatedAt);
      break;
    case "verifiedAt":
      orderBy = dirFn(schema.models.verifiedAt);
      break;
    case "name":
    default:
      orderBy = dirFn(schema.models.name);
      break;
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.models)
    .innerJoin(schema.developers, eq(schema.models.developerId, schema.developers.id))
    .where(whereExpr);
  const total = countRows[0]?.count ?? 0;

  const rows = await db
    .select({
      model: schema.models,
      developerName: schema.developers.name,
      developerSlug: schema.developers.slug,
      capabilities: schema.modelCapabilities,
    })
    .from(schema.models)
    .innerJoin(schema.developers, eq(schema.models.developerId, schema.developers.id))
    .leftJoin(schema.modelCapabilities, eq(schema.modelCapabilities.modelId, schema.models.id))
    .where(whereExpr)
    .orderBy(orderBy, asc(schema.models.id))
    .limit(limit + 1)
    .offset(offset);

  const pageRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const modelIds = pageRows.map((r) => r.model.id);

  const scoreRows =
    modelIds.length === 0
      ? []
      : await db
          .select({
            modelId: schema.modelScores.modelId,
            scoreType: schema.modelScores.scoreType,
            scoreValue: schema.modelScores.scoreValue,
            rankValue: schema.modelScores.rankValue,
            calculatedAt: schema.modelScores.calculatedAt,
            methodologyVersion: schema.scoreMethodologies.version,
            methodologyName: schema.scoreMethodologies.name,
          })
          .from(schema.modelScores)
          .innerJoin(
            schema.scoreMethodologies,
            eq(schema.modelScores.methodologyId, schema.scoreMethodologies.id),
          )
          .where(inArray(schema.modelScores.modelId, modelIds))
          .orderBy(desc(schema.modelScores.calculatedAt));

  const latestScores = new Map<string, typeof scoreRows>();
  for (const s of scoreRows) {
    const list = latestScores.get(s.modelId) ?? [];
    if (list.some((x) => x.scoreType === s.scoreType)) continue;
    list.push(s);
    latestScores.set(s.modelId, list);
  }

  const accessRows =
    modelIds.length === 0
      ? []
      : await db
          .select({
            modelId: schema.modelAccess.modelId,
            providerName: schema.accessProviders.name,
          })
          .from(schema.modelAccess)
          .innerJoin(schema.plans, eq(schema.modelAccess.planId, schema.plans.id))
          .innerJoin(
            schema.accessProviders,
            eq(schema.plans.accessProviderId, schema.accessProviders.id),
          )
          .where(
            and(
              inArray(schema.modelAccess.modelId, modelIds),
              eq(schema.modelAccess.status, "active"),
            ),
          );

  const accessMap = new Map<string, string[]>();
  for (const a of accessRows) {
    const list = accessMap.get(a.modelId) ?? [];
    if (!list.includes(a.providerName)) list.push(a.providerName);
    accessMap.set(a.modelId, list);
  }

  const aliasRows =
    modelIds.length === 0
      ? []
      : await db
          .select({
            id: schema.modelAliases.id,
            modelId: schema.modelAliases.modelId,
            alias: schema.modelAliases.alias,
            aliasType: schema.modelAliases.aliasType,
          })
          .from(schema.modelAliases)
          .where(inArray(schema.modelAliases.modelId, modelIds));

  const aliasMap = new Map<string, Array<{ id: string; alias: string; aliasType: string }>>();
  for (const a of aliasRows) {
    const list = aliasMap.get(a.modelId) ?? [];
    list.push({ id: a.id, alias: a.alias, aliasType: a.aliasType });
    aliasMap.set(a.modelId, list);
  }

  const data = pageRows.map((r) =>
    mapModelRow(r.model, {
      developerName: r.developerName,
      developerSlug: r.developerSlug,
      capabilities: r.capabilities,
      scores: latestScores.get(r.model.id) ?? [],
      accessProviders: accessMap.get(r.model.id) ?? [],
      aliases: aliasMap.get(r.model.id) ?? [],
    }),
  );

  // Optional in-memory score sorts (capability/balanced/value) after fetch of page is imperfect;
  // for MVP we re-sort the current page when requested.
  if (field === "capability" || field === "balanced" || field === "value") {
    const scoreKey = field;
    data.sort((a, b) => {
      const av = a.scores[scoreKey]?.value;
      const bv = b.scores[scoreKey]?.value;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return direction === "asc" ? av - bv : bv - av;
    });
  }

  const nextOffset = offset + limit;
  const nextCursor = hasMore
    ? Buffer.from(String(nextOffset), "utf8").toString("base64url")
    : null;

  return {
    data,
    page: {
      nextCursor,
      hasMore,
      total,
      page,
      pageSize: limit,
    },
  };
}

export async function getModelById(db: Db, modelId: string) {
  const rows = await db
    .select({
      model: schema.models,
      developerName: schema.developers.name,
      developerSlug: schema.developers.slug,
      capabilities: schema.modelCapabilities,
    })
    .from(schema.models)
    .innerJoin(schema.developers, eq(schema.models.developerId, schema.developers.id))
    .leftJoin(schema.modelCapabilities, eq(schema.modelCapabilities.modelId, schema.models.id))
    .where(eq(schema.models.id, modelId))
    .limit(1);

  if (!rows[0]) {
    throw new ModelServiceError("NOT_FOUND", "Model not found", 404);
  }

  const aliases = await db
    .select()
    .from(schema.modelAliases)
    .where(eq(schema.modelAliases.modelId, modelId));

  const scores = await db
    .select({
      id: schema.modelScores.id,
      scoreType: schema.modelScores.scoreType,
      scoreValue: schema.modelScores.scoreValue,
      rankValue: schema.modelScores.rankValue,
      eligibleCount: schema.modelScores.eligibleCount,
      confidence: schema.modelScores.confidence,
      isManualOverride: schema.modelScores.isManualOverride,
      overrideReason: schema.modelScores.overrideReason,
      calculatedAt: schema.modelScores.calculatedAt,
      methodologyId: schema.modelScores.methodologyId,
      methodologyName: schema.scoreMethodologies.name,
      methodologyVersion: schema.scoreMethodologies.version,
    })
    .from(schema.modelScores)
    .innerJoin(
      schema.scoreMethodologies,
      eq(schema.modelScores.methodologyId, schema.scoreMethodologies.id),
    )
    .where(eq(schema.modelScores.modelId, modelId))
    .orderBy(desc(schema.modelScores.calculatedAt));

  const benchmarks = await db
    .select({
      id: schema.modelBenchmarkResults.id,
      score: schema.modelBenchmarkResults.score,
      scoreText: schema.modelBenchmarkResults.scoreText,
      setting: schema.modelBenchmarkResults.setting,
      harness: schema.modelBenchmarkResults.harness,
      resultDate: schema.modelBenchmarkResults.resultDate,
      sourceUrl: schema.modelBenchmarkResults.sourceUrl,
      sourceType: schema.modelBenchmarkResults.sourceType,
      verifiedAt: schema.modelBenchmarkResults.verifiedAt,
      notes: schema.modelBenchmarkResults.notes,
      benchmarkName: schema.benchmarks.name,
      category: schema.benchmarks.category,
      comparableGroup: schema.benchmarks.comparableGroup,
      scoreUnit: schema.benchmarks.scoreUnit,
      higherIsBetter: schema.benchmarks.higherIsBetter,
    })
    .from(schema.modelBenchmarkResults)
    .innerJoin(
      schema.benchmarks,
      eq(schema.modelBenchmarkResults.benchmarkId, schema.benchmarks.id),
    )
    .where(eq(schema.modelBenchmarkResults.modelId, modelId))
    .orderBy(asc(schema.benchmarks.category), asc(schema.benchmarks.name));

  const access = await db
    .select({
      id: schema.modelAccess.id,
      availability: schema.modelAccess.availability,
      accessMethod: schema.modelAccess.accessMethod,
      providerModelId: schema.modelAccess.providerModelId,
      cliOnly: schema.modelAccess.cliOnly,
      webOnly: schema.modelAccess.webOnly,
      apiCompatible: schema.modelAccess.apiCompatible,
      includedInPlan: schema.modelAccess.includedInPlan,
      limitations: schema.modelAccess.limitations,
      status: schema.modelAccess.status,
      planName: schema.plans.name,
      providerName: schema.accessProviders.name,
      providerSlug: schema.accessProviders.slug,
    })
    .from(schema.modelAccess)
    .innerJoin(schema.plans, eq(schema.modelAccess.planId, schema.plans.id))
    .innerJoin(
      schema.accessProviders,
      eq(schema.plans.accessProviderId, schema.accessProviders.id),
    )
    .where(eq(schema.modelAccess.modelId, modelId));

  const sources = await db
    .select()
    .from(schema.sources)
    .where(and(eq(schema.sources.entityType, "model"), eq(schema.sources.entityId, modelId)))
    .orderBy(desc(schema.sources.createdAt));

  const history = await db
    .select()
    .from(schema.auditEvents)
    .where(
      and(eq(schema.auditEvents.entityType, "model"), eq(schema.auditEvents.entityId, modelId)),
    )
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(100);

  const base = mapModelRow(rows[0].model, {
    developerName: rows[0].developerName,
    developerSlug: rows[0].developerSlug,
    capabilities: rows[0].capabilities,
    scores: scores.map((s) => ({
      scoreType: s.scoreType,
      scoreValue: s.scoreValue,
      rankValue: s.rankValue,
      methodologyVersion: s.methodologyVersion,
      methodologyName: s.methodologyName,
    })),
    accessProviders: [...new Set(access.map((a) => a.providerName))],
    aliases: aliases.map((a) => ({ id: a.id, alias: a.alias, aliasType: a.aliasType })),
  });

  return {
    ...base,
    aliases: aliases.map((a) => ({
      id: a.id,
      alias: a.alias,
      aliasType: a.aliasType,
      normalizedAlias: a.normalizedAlias,
      accessProviderId: a.accessProviderId,
    })),
    scoreRecords: scores.map((s) => {
      const value = asNumber(s.scoreValue);
      return {
        id: s.id,
        scoreType: s.scoreType,
        scoreValue: value,
        scoreDisplay: formatScoreDisplay(value),
        rankValue: s.rankValue,
        eligibleCount: s.eligibleCount,
        confidence: asNumber(s.confidence),
        isManualOverride: s.isManualOverride,
        overrideReason: s.overrideReason,
        calculatedAt: toIso(s.calculatedAt),
        methodologyId: s.methodologyId,
        methodologyName: s.methodologyName,
        methodologyVersion: s.methodologyVersion,
      };
    }),
    benchmarks: benchmarks.map((b) => {
      const score = asNumber(b.score);
      return {
        id: b.id,
        benchmarkName: b.benchmarkName,
        category: b.category,
        comparableGroup: b.comparableGroup,
        setting: b.setting,
        harness: b.harness,
        score,
        scoreDisplay: b.scoreText ?? formatScoreDisplay(score),
        scoreUnit: b.scoreUnit,
        higherIsBetter: b.higherIsBetter,
        resultDate: b.resultDate,
        sourceUrl: b.sourceUrl,
        sourceType: b.sourceType,
        verifiedAt: toIso(b.verifiedAt),
        notes: b.notes,
      };
    }),
    access: access.map((a) => ({
      id: a.id,
      availability: a.availability,
      accessMethod: a.accessMethod,
      providerModelId: a.providerModelId,
      cliOnly: a.cliOnly,
      webOnly: a.webOnly,
      apiCompatible: a.apiCompatible,
      includedInPlan: a.includedInPlan,
      limitations: a.limitations,
      status: a.status,
      planName: a.planName,
      providerName: a.providerName,
      providerSlug: a.providerSlug,
    })),
    sources: sources.map((s) => ({
      id: s.id,
      sourceType: s.sourceType,
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      retrievedAt: toIso(s.retrievedAt),
      verifiedAt: toIso(s.verifiedAt),
      notes: s.notes,
    })),
    history: history.map((h) => ({
      id: h.id,
      action: h.action,
      beforeData: h.beforeData,
      afterData: h.afterData,
      metadata: h.metadata,
      requestId: h.requestId,
      createdAt: toIso(h.createdAt),
    })),
  };
}

export async function listDevelopers(db: Db) {
  return db
    .select({
      id: schema.developers.id,
      name: schema.developers.name,
      slug: schema.developers.slug,
    })
    .from(schema.developers)
    .where(eq(schema.developers.status, "active"))
    .orderBy(asc(schema.developers.name));
}

export async function createModel(
  db: Db,
  rawInput: unknown,
  ctx: AuditContext = {},
) {
  const parsed = modelWriteSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid model payload",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  const input = parsed.data;

  const [dev] = await db
    .select({ id: schema.developers.id })
    .from(schema.developers)
    .where(eq(schema.developers.id, input.developerId))
    .limit(1);
  if (!dev) {
    throw new ModelServiceError("VALIDATION_ERROR", "Developer not found", 400, {
      developerId: ["Developer not found"],
    });
  }

  const [existingCanonical] = await db
    .select({ id: schema.models.id })
    .from(schema.models)
    .where(eq(schema.models.canonicalId, input.canonicalId))
    .limit(1);
  if (existingCanonical) {
    throw new ModelServiceError(
      "CONFLICT",
      "A model with this canonical ID already exists",
      409,
      { canonicalId: ["Canonical ID must be unique"] },
    );
  }

  const createdId = await db.transaction(async (tx) => {
    const slug = await ensureUniqueSlug(tx, input.name);
    const [created] = await tx
      .insert(schema.models)
      .values({
        developerId: input.developerId,
        canonicalId: input.canonicalId,
        name: input.name,
        slug,
        family: input.family ?? null,
        generation: input.generation ?? null,
        lifecycle: input.lifecycle,
        lifecycleRaw: input.lifecycleRaw ?? null,
        releaseDate: input.releaseDate ?? null,
        knowledgeCutoff: input.knowledgeCutoff ?? null,
        modelType: input.modelType ?? null,
        description: input.description ?? null,
        codingSpecialization: input.codingSpecialization ?? null,
        bestUse: input.bestUse ?? null,
        avoidFor: input.avoidFor ?? null,
        contextTokens: input.contextTokens ?? null,
        maxOutputTokens: input.maxOutputTokens ?? null,
        speedRating: input.speedRating ?? null,
        needsRecheck: input.needsRecheck,
        status: "active",
      })
      .returning();

    const caps = input.capabilities ?? {};
    await tx.insert(schema.modelCapabilities).values({
      modelId: created.id,
      vision: caps.vision ?? null,
      reasoning: caps.reasoning ?? null,
      toolUse: caps.toolUse ?? null,
      parallelAgents: caps.parallelAgents ?? null,
      computerUse: caps.computerUse ?? null,
      audioInput: caps.audioInput ?? null,
      videoInput: caps.videoInput ?? null,
      imageInput: caps.imageInput ?? null,
      structuredOutput: caps.structuredOutput ?? null,
      functionCalling: caps.functionCalling ?? null,
      details: caps.details ?? {},
    });

    if (input.aliases?.length) {
      for (const alias of input.aliases) {
        await tx.insert(schema.modelAliases).values({
          modelId: created.id,
          alias: alias.alias,
          normalizedAlias: normalizeAlias(alias.alias),
          aliasType: alias.aliasType,
          accessProviderId: alias.accessProviderId ?? null,
        });
      }
    }

    await writeAudit(tx, {
      entityType: "model",
      entityId: created.id,
      action: "create",
      afterData: { id: created.id, canonicalId: created.canonicalId, name: created.name },
      ctx,
    });

    return created.id;
  });

  return getModelById(db, createdId);
}

export async function updateModel(
  db: Db,
  modelId: string,
  rawInput: unknown,
  ctx: AuditContext = {},
) {
  const parsed = modelUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid model payload",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  const input = parsed.data;

  const [before] = await db
    .select()
    .from(schema.models)
    .where(eq(schema.models.id, modelId))
    .limit(1);
  if (!before) {
    throw new ModelServiceError("NOT_FOUND", "Model not found", 404);
  }

  if (input.canonicalId && input.canonicalId !== before.canonicalId) {
    const [clash] = await db
      .select({ id: schema.models.id })
      .from(schema.models)
      .where(eq(schema.models.canonicalId, input.canonicalId))
      .limit(1);
    if (clash) {
      throw new ModelServiceError("CONFLICT", "Canonical ID already in use", 409, {
        canonicalId: ["Canonical ID must be unique"],
      });
    }
  }

  await db.transaction(async (tx) => {
    const patch: Partial<typeof schema.models.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.canonicalId !== undefined) patch.canonicalId = input.canonicalId;
    if (input.name !== undefined) {
      patch.name = input.name;
      patch.slug = await ensureUniqueSlug(tx, input.name, modelId);
    }
    if (input.developerId !== undefined) patch.developerId = input.developerId;
    if (input.family !== undefined) patch.family = input.family;
    if (input.generation !== undefined) patch.generation = input.generation;
    if (input.lifecycle !== undefined) patch.lifecycle = input.lifecycle;
    if (input.lifecycleRaw !== undefined) patch.lifecycleRaw = input.lifecycleRaw;
    if (input.releaseDate !== undefined) patch.releaseDate = input.releaseDate;
    if (input.knowledgeCutoff !== undefined) patch.knowledgeCutoff = input.knowledgeCutoff;
    if (input.modelType !== undefined) patch.modelType = input.modelType;
    if (input.description !== undefined) patch.description = input.description;
    if (input.codingSpecialization !== undefined) {
      patch.codingSpecialization = input.codingSpecialization;
    }
    if (input.bestUse !== undefined) patch.bestUse = input.bestUse;
    if (input.avoidFor !== undefined) patch.avoidFor = input.avoidFor;
    if (input.contextTokens !== undefined) patch.contextTokens = input.contextTokens;
    if (input.maxOutputTokens !== undefined) patch.maxOutputTokens = input.maxOutputTokens;
    if (input.speedRating !== undefined) patch.speedRating = input.speedRating;
    if (input.needsRecheck !== undefined) patch.needsRecheck = input.needsRecheck;

    const [updated] = await tx
      .update(schema.models)
      .set(patch)
      .where(eq(schema.models.id, modelId))
      .returning();

    if (input.capabilities) {
      const caps = input.capabilities;
      await tx
        .insert(schema.modelCapabilities)
        .values({
          modelId,
          vision: caps.vision ?? null,
          reasoning: caps.reasoning ?? null,
          toolUse: caps.toolUse ?? null,
          parallelAgents: caps.parallelAgents ?? null,
          computerUse: caps.computerUse ?? null,
          audioInput: caps.audioInput ?? null,
          videoInput: caps.videoInput ?? null,
          imageInput: caps.imageInput ?? null,
          structuredOutput: caps.structuredOutput ?? null,
          functionCalling: caps.functionCalling ?? null,
          details: caps.details ?? {},
        })
        .onConflictDoUpdate({
          target: schema.modelCapabilities.modelId,
          set: {
            vision: caps.vision === undefined ? sql`${schema.modelCapabilities.vision}` : caps.vision,
            reasoning:
              caps.reasoning === undefined
                ? sql`${schema.modelCapabilities.reasoning}`
                : caps.reasoning,
            toolUse:
              caps.toolUse === undefined ? sql`${schema.modelCapabilities.toolUse}` : caps.toolUse,
            parallelAgents:
              caps.parallelAgents === undefined
                ? sql`${schema.modelCapabilities.parallelAgents}`
                : caps.parallelAgents,
            computerUse:
              caps.computerUse === undefined
                ? sql`${schema.modelCapabilities.computerUse}`
                : caps.computerUse,
            audioInput:
              caps.audioInput === undefined
                ? sql`${schema.modelCapabilities.audioInput}`
                : caps.audioInput,
            videoInput:
              caps.videoInput === undefined
                ? sql`${schema.modelCapabilities.videoInput}`
                : caps.videoInput,
            imageInput:
              caps.imageInput === undefined
                ? sql`${schema.modelCapabilities.imageInput}`
                : caps.imageInput,
            structuredOutput:
              caps.structuredOutput === undefined
                ? sql`${schema.modelCapabilities.structuredOutput}`
                : caps.structuredOutput,
            functionCalling:
              caps.functionCalling === undefined
                ? sql`${schema.modelCapabilities.functionCalling}`
                : caps.functionCalling,
            details: caps.details ?? sql`${schema.modelCapabilities.details}`,
            updatedAt: new Date(),
          },
        });
    }

    if (input.aliases) {
      await tx.delete(schema.modelAliases).where(eq(schema.modelAliases.modelId, modelId));
      for (const alias of input.aliases) {
        await tx.insert(schema.modelAliases).values({
          modelId,
          alias: alias.alias,
          normalizedAlias: normalizeAlias(alias.alias),
          aliasType: alias.aliasType,
          accessProviderId: alias.accessProviderId ?? null,
        });
      }
    }

    await writeAudit(tx, {
      entityType: "model",
      entityId: modelId,
      action: "update",
      beforeData: {
        canonicalId: before.canonicalId,
        name: before.name,
        lifecycle: before.lifecycle,
      },
      afterData: {
        canonicalId: updated.canonicalId,
        name: updated.name,
        lifecycle: updated.lifecycle,
      },
      ctx,
    });
  });

  return getModelById(db, modelId);
}

export async function archiveModel(db: Db, modelId: string, ctx: AuditContext = {}) {
  const [before] = await db
    .select()
    .from(schema.models)
    .where(eq(schema.models.id, modelId))
    .limit(1);
  if (!before) throw new ModelServiceError("NOT_FOUND", "Model not found", 404);
  if (before.status === "archived") {
    return getModelById(db, modelId);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.models)
      .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.models.id, modelId));
    await writeAudit(tx, {
      entityType: "model",
      entityId: modelId,
      action: "archive",
      beforeData: { status: before.status },
      afterData: { status: "archived" },
      ctx,
    });
  });

  return getModelById(db, modelId);
}

export async function restoreModel(db: Db, modelId: string, ctx: AuditContext = {}) {
  const [before] = await db
    .select()
    .from(schema.models)
    .where(eq(schema.models.id, modelId))
    .limit(1);
  if (!before) throw new ModelServiceError("NOT_FOUND", "Model not found", 404);
  if (before.mergedIntoModelId) {
    throw new ModelServiceError(
      "CONFLICT",
      "Merged models cannot be restored; use the target model",
      409,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.models)
      .set({
        status: "active",
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.models.id, modelId));
    await writeAudit(tx, {
      entityType: "model",
      entityId: modelId,
      action: "restore",
      beforeData: { status: before.status },
      afterData: { status: "active" },
      ctx,
    });
  });

  return getModelById(db, modelId);
}

export async function addModelAlias(
  db: Db,
  modelId: string,
  raw: { alias: string; aliasType?: string; accessProviderId?: string | null },
  ctx: AuditContext = {},
) {
  const [model] = await db
    .select({ id: schema.models.id })
    .from(schema.models)
    .where(eq(schema.models.id, modelId))
    .limit(1);
  if (!model) throw new ModelServiceError("NOT_FOUND", "Model not found", 404);

  const alias = raw.alias?.trim();
  if (!alias) {
    throw new ModelServiceError("VALIDATION_ERROR", "Alias is required", 400, {
      alias: ["Alias is required"],
    });
  }
  const normalized = normalizeAlias(alias);

  try {
    const [created] = await db
      .insert(schema.modelAliases)
      .values({
        modelId,
        alias,
        normalizedAlias: normalized,
        aliasType: raw.aliasType?.trim() || "display",
        accessProviderId: raw.accessProviderId ?? null,
      })
      .returning();

    await writeAudit(db, {
      entityType: "model",
      entityId: modelId,
      action: "update",
      afterData: { aliasAdded: created.alias },
      metadata: { aliasId: created.id },
      ctx,
    });
    return created;
  } catch {
    throw new ModelServiceError("CONFLICT", "Alias already exists", 409, {
      alias: ["Normalized alias must be unique"],
    });
  }
}

export async function mergeModels(db: Db, rawInput: unknown, ctx: AuditContext = {}) {
  const parsed = modelMergeSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid merge payload",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  const { sourceModelId, targetModelId } = parsed.data;
  if (sourceModelId === targetModelId) {
    throw new ModelServiceError("VALIDATION_ERROR", "Source and target must differ", 400);
  }

  return db.transaction(async (tx) => {
    // Lock both rows via SELECT ... FOR UPDATE
    const locked = await tx.execute(sql`
      SELECT id, status, merged_into_model_id
      FROM models
      WHERE id IN (${sourceModelId}::uuid, ${targetModelId}::uuid)
      FOR UPDATE
    `);
    const rows = locked as unknown as Array<{
      id: string;
      status: string;
      merged_into_model_id: string | null;
    }>;

    const source = rows.find((r) => r.id === sourceModelId);
    const target = rows.find((r) => r.id === targetModelId);
    if (!source || !target) {
      throw new ModelServiceError("NOT_FOUND", "Source or target model not found", 404);
    }
    if (target.status !== "active") {
      throw new ModelServiceError("CONFLICT", "Target model must be active", 409);
    }
    if (source.merged_into_model_id) {
      throw new ModelServiceError("CONFLICT", "Source model was already merged", 409);
    }

    const targetAliases = await tx
      .select()
      .from(schema.modelAliases)
      .where(eq(schema.modelAliases.modelId, targetModelId));
    const sourceAliases = await tx
      .select()
      .from(schema.modelAliases)
      .where(eq(schema.modelAliases.modelId, sourceModelId));

    const aliasPlan = planAliasMerge(
      targetAliases.map((a) => a.normalizedAlias),
      sourceAliases.map((a) => ({ alias: a.alias, normalizedAlias: a.normalizedAlias })),
    );

    // Delete colliding source aliases, transfer the rest
    for (const a of sourceAliases) {
      if (aliasPlan.skippedDuplicates.includes(a.alias)) {
        await tx.delete(schema.modelAliases).where(eq(schema.modelAliases.id, a.id));
      } else {
        await tx
          .update(schema.modelAliases)
          .set({ modelId: targetModelId })
          .where(eq(schema.modelAliases.id, a.id));
      }
    }

    const targetAccess = await tx
      .select({
        id: schema.modelAccess.id,
        planId: schema.modelAccess.planId,
        providerModelId: schema.modelAccess.providerModelId,
      })
      .from(schema.modelAccess)
      .where(eq(schema.modelAccess.modelId, targetModelId));
    const sourceAccess = await tx
      .select({
        id: schema.modelAccess.id,
        planId: schema.modelAccess.planId,
        providerModelId: schema.modelAccess.providerModelId,
      })
      .from(schema.modelAccess)
      .where(eq(schema.modelAccess.modelId, sourceModelId));

    const accessPlan = planAccessMerge(
      targetAccess.map((a) => accessMergeKey(a)),
      sourceAccess,
    );

    // Drop source access rows that would duplicate target uniqueness; transfer the rest
    for (const id of accessPlan.skippedDuplicateIds) {
      await tx.delete(schema.modelAccess).where(eq(schema.modelAccess.id, id));
    }
    for (const id of accessPlan.transferIds) {
      await tx
        .update(schema.modelAccess)
        .set({ modelId: targetModelId, updatedAt: new Date() })
        .where(eq(schema.modelAccess.id, id));
    }

    const benchMoved = await tx
      .update(schema.modelBenchmarkResults)
      .set({ modelId: targetModelId })
      .where(eq(schema.modelBenchmarkResults.modelId, sourceModelId))
      .returning({ id: schema.modelBenchmarkResults.id });

    const scoresMoved = await tx
      .update(schema.modelScores)
      .set({ modelId: targetModelId })
      .where(eq(schema.modelScores.modelId, sourceModelId))
      .returning({ id: schema.modelScores.id });

    const sourcesMoved = await tx
      .update(schema.sources)
      .set({ entityId: targetModelId })
      .where(and(eq(schema.sources.entityType, "model"), eq(schema.sources.entityId, sourceModelId)))
      .returning({ id: schema.sources.id });

    // provenance
    const provMoved = await tx
      .update(schema.importProvenance)
      .set({ entityId: targetModelId })
      .where(
        and(
          eq(schema.importProvenance.entityType, "model"),
          eq(schema.importProvenance.entityId, sourceModelId),
        ),
      )
      .returning({ id: schema.importProvenance.id });

    // capabilities: keep target; drop source row
    await tx
      .delete(schema.modelCapabilities)
      .where(eq(schema.modelCapabilities.modelId, sourceModelId));

    await tx
      .update(schema.models)
      .set({
        status: "archived",
        archivedAt: new Date(),
        mergedIntoModelId: targetModelId,
        updatedAt: new Date(),
      })
      .where(eq(schema.models.id, sourceModelId));

    const transferred = {
      aliases: aliasPlan.transfer.length,
      aliasesSkipped: aliasPlan.skippedDuplicates.length,
      access: accessPlan.transferIds.length,
      accessSkipped: accessPlan.skippedDuplicateIds.length,
      benchmarks: benchMoved.length,
      scores: scoresMoved.length,
      sources: sourcesMoved.length,
      provenance: provMoved.length,
    };

    const audit = await writeAudit(tx, {
      entityType: "model",
      entityId: targetModelId,
      action: "merge",
      beforeData: { sourceModelId, targetModelId },
      afterData: { targetModelId, sourceArchived: true },
      metadata: { transferred, sourceModelId },
      ctx,
    });

    // Also record on source entity
    await writeAudit(tx, {
      entityType: "model",
      entityId: sourceModelId,
      action: "merge",
      afterData: { mergedIntoModelId: targetModelId },
      metadata: { transferred },
      ctx,
    });

    return {
      targetModelId,
      transferred,
      auditEventId: audit.id,
    };
  });
}

/** Used by unit tests for pure filter parsing without DB. */
export { formatScoreDisplay, formatCapabilityDisplay, normalizeAlias, planAliasMerge, planAccessMerge };
