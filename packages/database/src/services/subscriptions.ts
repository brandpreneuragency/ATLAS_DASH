import {
  and,
  asc,
  desc,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";
import type { z } from "zod";
import type { subscriptionResponseSchema } from "@model-monitor/schemas";
import {
  subscriptionWriteSchema,
  subscriptionListQuerySchema,
  subscriptionDetailResponseSchema,
  subscriptionLimitRuleWriteSchema,
  subscriptionLimitRuleResponseSchema,
  usageSnapshotResponseSchema,
  pathUuidSchema,
} from "@model-monitor/schemas";
import * as schema from "../schema/index";
import type {
  Db,
  DbOrTx,
  AuditContext,
} from "./audit";
import {
  writeAudit,
  ModelServiceError,
  jsonSafe,
  asNumber,
} from "./audit";

// ── Helpers ──────────────────────────────────────────────────

function requireUuid(value: string, field: string): string {
  const parsed = pathUuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ModelServiceError("VALIDATION_ERROR", `Invalid ${field}`, 400, {
      [field]: ["Must be a valid UUID"],
    });
  }
  return parsed.data;
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

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

// ── Owner resolution ─────────────────────────────────────────

async function resolveOwnerUserId(db: DbOrTx, ctx: AuditContext): Promise<string> {
  if (ctx.actorUserId) return ctx.actorUserId;
  const [owner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "owner@model-monitor.local"))
    .limit(1);
  if (!owner) {
    throw new ModelServiceError("NOT_FOUND", "Seed owner user not found", 500);
  }
  return owner.id;
}

// ── Row mapping ──────────────────────────────────────────────

function mapSubscriptionRow(
  row: typeof schema.subscriptions.$inferSelect,
  extras?: {
    plan?: {
      id: string;
      name: string;
      slug: string;
      accessProviderId: string;
      accessProviderName: string;
      accessProviderSlug: string;
    };
  },
) {
  return {
    id: row.id,
    planId: row.planId,
    accountLabel: row.accountLabel,
    status: row.status,
    startedAt: row.startedAt ?? null,
    nextBillingDate: row.nextBillingDate ?? null,
    autoRenews: row.autoRenews ?? null,
    actualPrice: asNumber(row.actualPrice),
    currency: row.currency ?? null,
    billingInterval: row.billingInterval ?? null,
    usageTrackingMode: row.usageTrackingMode,
    usageCheckUrl: row.usageCheckUrl ?? null,
    usageCheckInstructions: row.usageCheckInstructions ?? null,
    importance: asNumber(row.importance),
    notes: row.notes ?? null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    archivedAt: toIso(row.archivedAt),
    ...(extras?.plan
      ? {
          cancelledAt: row.cancelledAt ?? null,
          privateNotes: row.privateNotes ?? null,
          plan: extras.plan,
        }
      : {}),
  };
}

type UsageSnapshotRow = {
  id: string;
  subscriptionId: string;
  modelId: string | null;
  modelName: string | null;
  source: string;
  isMock: boolean;
  periodLabel: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  usedAmount: string | null;
  remainingAmount: string | null;
  totalAmount: string | null;
  unit: string | null;
  usedPercent: string | null;
  confidence: string | null;
  capturedAt: Date;
  createdAt: Date;
  seedKey: string | null;
  rawPayload: unknown;
};

function mapUsageSnapshotRow(row: UsageSnapshotRow) {
  return usageSnapshotResponseSchema.parse({
    id: row.id,
    subscriptionId: row.subscriptionId,
    modelId: row.modelId ?? null,
    modelName: row.modelName ?? null,
    source: row.source,
    isMock: row.isMock,
    periodLabel: row.periodLabel ?? null,
    periodStart: row.periodStart ? toIso(row.periodStart) : null,
    periodEnd: row.periodEnd ? toIso(row.periodEnd) : null,
    usedAmount: asNumber(row.usedAmount),
    remainingAmount: asNumber(row.remainingAmount),
    totalAmount: asNumber(row.totalAmount),
    unit: row.unit ?? null,
    usedPercent: asNumber(row.usedPercent),
    confidence: asNumber(row.confidence),
    capturedAt: toIso(row.capturedAt)!,
  });
}

function mapLimitRuleRow(row: typeof schema.subscriptionLimitRules.$inferSelect) {
  return subscriptionLimitRuleResponseSchema.parse({
    id: row.id,
    subscriptionId: row.subscriptionId,
    name: row.name,
    limitType: row.limitType,
    amountMin: asNumber(row.amountMin),
    amountMax: asNumber(row.amountMax),
    unit: row.unit ?? null,
    periodMinutes: asNumber(row.periodMinutes),
    resetStrategy: row.resetStrategy ?? null,
    appliesTo: row.appliesTo ?? null,
    includedCredit: row.includedCredit ?? null,
    notes: row.notes ?? null,
    rawText: row.rawText ?? null,
    status: row.status,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
  });
}

// ── Detail loader (shared by get detail and create/update return) ──

async function loadSubscriptionDetail(
  db: DbOrTx,
  id: string,
): Promise<z.infer<typeof subscriptionDetailResponseSchema>> {
  const rows = await db
    .select({
      subscription: schema.subscriptions,
      planId: schema.plans.id,
      planName: schema.plans.name,
      planSlug: schema.plans.slug,
      accessProviderId: schema.accessProviders.id,
      accessProviderName: schema.accessProviders.name,
      accessProviderSlug: schema.accessProviders.slug,
    })
    .from(schema.subscriptions)
    .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
    .innerJoin(
      schema.accessProviders,
      eq(schema.plans.accessProviderId, schema.accessProviders.id),
    )
    .where(eq(schema.subscriptions.id, id))
    .limit(1);

  if (!rows[0]) {
    throw new ModelServiceError("NOT_FOUND", "Subscription not found", 404);
  }

  const r = rows[0];

  const snapshots = (await db
    .select({
      id: schema.usageSnapshots.id,
      subscriptionId: schema.usageSnapshots.subscriptionId,
      modelId: schema.usageSnapshots.modelId,
      source: schema.usageSnapshots.source,
      isMock: schema.usageSnapshots.isMock,
      periodLabel: schema.usageSnapshots.periodLabel,
      periodStart: schema.usageSnapshots.periodStart,
      periodEnd: schema.usageSnapshots.periodEnd,
      usedAmount: schema.usageSnapshots.usedAmount,
      remainingAmount: schema.usageSnapshots.remainingAmount,
      totalAmount: schema.usageSnapshots.totalAmount,
      unit: schema.usageSnapshots.unit,
      usedPercent: schema.usageSnapshots.usedPercent,
      confidence: schema.usageSnapshots.confidence,
      capturedAt: schema.usageSnapshots.capturedAt,
      createdAt: schema.usageSnapshots.createdAt,
      seedKey: schema.usageSnapshots.seedKey,
      rawPayload: schema.usageSnapshots.rawPayload,
      modelName: schema.models.name,
    })
    .from(schema.usageSnapshots)
    .leftJoin(schema.models, eq(schema.usageSnapshots.modelId, schema.models.id))
    .where(eq(schema.usageSnapshots.subscriptionId, id))
    .orderBy(desc(schema.usageSnapshots.capturedAt))
    .limit(12)) as UsageSnapshotRow[];

  const limitRules = await db
    .select()
    .from(schema.subscriptionLimitRules)
    .where(
      and(
        eq(schema.subscriptionLimitRules.subscriptionId, id),
        eq(schema.subscriptionLimitRules.status, "active"),
      ),
    );

  const base = mapSubscriptionRow(r.subscription, {
    plan: {
      id: r.planId,
      name: r.planName,
      slug: r.planSlug,
      accessProviderId: r.accessProviderId,
      accessProviderName: r.accessProviderName,
      accessProviderSlug: r.accessProviderSlug,
    },
  });

  return subscriptionDetailResponseSchema.parse({
    ...base,
    usageSnapshots: snapshots.map(mapUsageSnapshotRow),
    limitRules: limitRules.map(mapLimitRuleRow),
  });
}

// ── Exports ──────────────────────────────────────────────────

export async function listSubscriptions(
  db: Db,
  raw: unknown,
): Promise<{
  data: z.infer<typeof subscriptionResponseSchema>[];
  page: { page: number; pageSize: number; total: number; hasMore: boolean; nextCursor: null };
}> {
  const query = subscriptionListQuerySchema.safeParse(raw);
  if (!query.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid subscription list query",
      400,
      fieldErrorsFromZod(query.error.flatten().fieldErrors),
    );
  }

  const { search, status, accessProvider, plan, archived, sort, limit, page } = query.data;
  const conditions: SQL[] = [];

  if (archived === true) {
    conditions.push(eq(schema.subscriptions.status, "archived"));
  } else if (archived === false || archived === undefined) {
    conditions.push(sql`${schema.subscriptions.status} != 'archived'`);
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      sql`(${schema.subscriptions.accountLabel} ILIKE ${term} OR ${schema.subscriptions.notes} ILIKE ${term})`,
    );
  }

  if (status) {
    conditions.push(eq(schema.subscriptions.status, status));
  }

  if (accessProvider?.trim()) {
    const ap = accessProvider.trim();
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM plans p2
        JOIN access_providers ap2 ON ap2.id = p2.access_provider_id
        WHERE p2.id = ${schema.subscriptions.planId}
          AND ap2.slug = ${ap}
      )`,
    );
  }

  if (plan?.trim()) {
    const p = plan.trim();
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM plans p2
        WHERE p2.id = ${schema.subscriptions.planId}
          AND p2.slug = ${p}
      )`,
    );
  }

  const whereExpr = conditions.length ? and(...conditions) : undefined;

  // Sort
  const rawSort = (sort ?? "accountLabel").trim();
  const sortDirection: "asc" | "desc" = rawSort.startsWith("-") ? "desc" : "asc";
  const sortKey = rawSort.replace(/^-/, "");
  const dirFn = sortDirection === "desc" ? desc : asc;
  let orderBy: SQL;
  switch (sortKey) {
    case "status":
      orderBy = dirFn(schema.subscriptions.status);
      break;
    case "nextBillingDate":
      orderBy = dirFn(schema.subscriptions.nextBillingDate);
      break;
    case "actualPrice":
      orderBy = dirFn(schema.subscriptions.actualPrice);
      break;
    case "accountLabel":
    default:
      orderBy = dirFn(schema.subscriptions.accountLabel);
      break;
  }

  const offsetPage = page ?? 1;
  const pageSize = limit ?? 50;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.subscriptions)
    .where(whereExpr);
  const total = countRow?.count ?? 0;

  const rows = (await db
    .select()
    .from(schema.subscriptions)
    .where(whereExpr)
    .orderBy(orderBy, asc(schema.subscriptions.id))
    .limit(pageSize + 1)
    .offset((offsetPage - 1) * pageSize)) as (typeof schema.subscriptions.$inferSelect)[];

  const pageRows = rows.slice(0, pageSize);
  const hasMore = rows.length > pageSize;

  return {
    data: pageRows.map(
      (r) => mapSubscriptionRow(r) as z.infer<typeof subscriptionResponseSchema>,
    ),
    page: {
      page: offsetPage,
      pageSize,
      total,
      hasMore,
      nextCursor: null,
    },
  };
}

export async function getSubscription(
  db: Db,
  id: string,
): Promise<z.infer<typeof subscriptionDetailResponseSchema>> {
  const uuid = requireUuid(id, "id");
  return loadSubscriptionDetail(db, uuid);
}

export async function createSubscription(
  db: Db,
  raw: unknown,
  ctx: AuditContext = {},
): Promise<z.infer<typeof subscriptionDetailResponseSchema>> {
  const parsed = subscriptionWriteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid subscription payload",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  const input = parsed.data;
  const ownerUserId = await resolveOwnerUserId(db, ctx);

  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.subscriptions)
      .values({
        ownerUserId,
        planId: input.planId,
        accountLabel: input.accountLabel,
        status: input.status,
        startedAt: input.startedAt ?? null,
        nextBillingDate: input.nextBillingDate ?? null,
        autoRenews: input.autoRenews ?? null,
        actualPrice: input.actualPrice?.toString() ?? null,
        currency: input.currency ?? null,
        billingInterval: input.billingInterval ?? null,
        usageTrackingMode: input.usageTrackingMode,
        usageCheckUrl: input.usageCheckUrl ?? null,
        usageCheckInstructions: input.usageCheckInstructions ?? null,
        importance: input.importance ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    await writeAudit(tx, {
      entityType: "subscription",
      entityId: created.id,
      action: "create",
      beforeData: null,
      afterData: jsonSafe(created),
      ctx,
    });

    return created.id;
  });

  return loadSubscriptionDetail(db, newId);
}

export async function updateSubscription(
  db: Db,
  id: string,
  raw: unknown,
  ctx: AuditContext = {},
): Promise<z.infer<typeof subscriptionDetailResponseSchema>> {
  const uuid = requireUuid(id, "id");

  const [existing] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, uuid))
    .limit(1);
  if (!existing) {
    throw new ModelServiceError("NOT_FOUND", "Subscription not found", 404);
  }

  const parsed = subscriptionWriteSchema.partial().safeParse(raw);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid subscription update payload",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  const input = parsed.data;

  await db.transaction(async (tx) => {
    const before = existing;
    const patch: Partial<typeof schema.subscriptions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.planId !== undefined) patch.planId = input.planId;
    if (input.accountLabel !== undefined) patch.accountLabel = input.accountLabel;
    if (input.status !== undefined) patch.status = input.status;
    if (input.startedAt !== undefined) patch.startedAt = input.startedAt;
    if (input.nextBillingDate !== undefined) patch.nextBillingDate = input.nextBillingDate;
    if (input.autoRenews !== undefined) patch.autoRenews = input.autoRenews;
    if (input.actualPrice !== undefined) patch.actualPrice = input.actualPrice?.toString() ?? null;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.billingInterval !== undefined) patch.billingInterval = input.billingInterval;
    if (input.usageTrackingMode !== undefined) patch.usageTrackingMode = input.usageTrackingMode;
    if (input.usageCheckUrl !== undefined) patch.usageCheckUrl = input.usageCheckUrl;
    if (input.usageCheckInstructions !== undefined) patch.usageCheckInstructions = input.usageCheckInstructions;
    if (input.importance !== undefined) patch.importance = input.importance;
    if (input.notes !== undefined) patch.notes = input.notes;

    const [updated] = await tx
      .update(schema.subscriptions)
      .set(patch)
      .where(eq(schema.subscriptions.id, uuid))
      .returning();

    await writeAudit(tx, {
      entityType: "subscription",
      entityId: uuid,
      action: "update",
      beforeData: jsonSafe(before),
      afterData: jsonSafe(updated),
      ctx,
    });
  });

  return loadSubscriptionDetail(db, uuid);
}

export async function archiveSubscription(
  db: Db,
  id: string,
  ctx: AuditContext = {},
): Promise<z.infer<typeof subscriptionDetailResponseSchema>> {
  const uuid = requireUuid(id, "id");

  const [existing] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, uuid))
    .limit(1);
  if (!existing) {
    throw new ModelServiceError("NOT_FOUND", "Subscription not found", 404);
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(schema.subscriptions)
      .set({ status: "archived", archivedAt: now, updatedAt: now })
      .where(eq(schema.subscriptions.id, uuid))
      .returning();

    await writeAudit(tx, {
      entityType: "subscription",
      entityId: uuid,
      action: "archive",
      beforeData: jsonSafe(existing),
      afterData: jsonSafe(updated),
      ctx,
    });
  });

  return loadSubscriptionDetail(db, uuid);
}

export async function restoreSubscription(
  db: Db,
  id: string,
  ctx: AuditContext = {},
): Promise<z.infer<typeof subscriptionDetailResponseSchema>> {
  const uuid = requireUuid(id, "id");

  const [existing] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, uuid))
    .limit(1);
  if (!existing) {
    throw new ModelServiceError("NOT_FOUND", "Subscription not found", 404);
  }

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.subscriptions)
      .set({
        status: existing.status === "cancelled" ? "paused" : "active",
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.id, uuid))
      .returning();

    await writeAudit(tx, {
      entityType: "subscription",
      entityId: uuid,
      action: "restore",
      beforeData: jsonSafe(existing),
      afterData: jsonSafe(updated),
      ctx,
    });
  });

  return loadSubscriptionDetail(db, uuid);
}

// ── Subscription Limit Rules ─────────────────────────────────

export async function createSubscriptionLimitRule(
  db: Db,
  raw: unknown,
  ctx: AuditContext = {},
): Promise<z.infer<typeof subscriptionLimitRuleResponseSchema>> {
  const parsed = subscriptionLimitRuleWriteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid subscription limit rule payload",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.subscriptionLimitRules)
      .values({
        subscriptionId: input.subscriptionId,
        name: input.name,
        limitType: input.limitType,
        amountMin: input.amountMin?.toString() ?? null,
        amountMax: input.amountMax?.toString() ?? null,
        unit: input.unit ?? null,
        periodMinutes: input.periodMinutes ?? null,
        resetStrategy: input.resetStrategy ?? null,
        appliesTo: input.appliesTo ?? null,
        includedCredit: input.includedCredit ?? null,
        notes: input.notes ?? null,
        rawText: input.rawText ?? null,
      })
      .returning();

    await writeAudit(tx, {
      entityType: "subscription_limit_rule",
      entityId: created.id,
      action: "create",
      beforeData: null,
      afterData: jsonSafe(created),
      ctx,
    });

    return mapLimitRuleRow(created);
  });
}

export async function updateSubscriptionLimitRule(
  db: Db,
  id: string,
  raw: unknown,
  ctx: AuditContext = {},
): Promise<z.infer<typeof subscriptionLimitRuleResponseSchema>> {
  const uuid = requireUuid(id, "id");

  const [existing] = await db
    .select()
    .from(schema.subscriptionLimitRules)
    .where(eq(schema.subscriptionLimitRules.id, uuid))
    .limit(1);
  if (!existing) {
    throw new ModelServiceError("NOT_FOUND", "Subscription limit rule not found", 404);
  }

  const parsed = subscriptionLimitRuleWriteSchema.partial().safeParse(raw);
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Invalid subscription limit rule update payload",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const patch: Partial<typeof schema.subscriptionLimitRules.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.subscriptionId !== undefined) patch.subscriptionId = input.subscriptionId;
    if (input.name !== undefined) patch.name = input.name;
    if (input.limitType !== undefined) patch.limitType = input.limitType;
    if (input.amountMin !== undefined) patch.amountMin = input.amountMin?.toString() ?? null;
    if (input.amountMax !== undefined) patch.amountMax = input.amountMax?.toString() ?? null;
    if (input.unit !== undefined) patch.unit = input.unit;
    if (input.periodMinutes !== undefined) patch.periodMinutes = input.periodMinutes;
    if (input.resetStrategy !== undefined) patch.resetStrategy = input.resetStrategy;
    if (input.appliesTo !== undefined) patch.appliesTo = input.appliesTo;
    if (input.includedCredit !== undefined) patch.includedCredit = input.includedCredit;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.rawText !== undefined) patch.rawText = input.rawText;

    const [updated] = await tx
      .update(schema.subscriptionLimitRules)
      .set(patch)
      .where(eq(schema.subscriptionLimitRules.id, uuid))
      .returning();

    await writeAudit(tx, {
      entityType: "subscription_limit_rule",
      entityId: uuid,
      action: "update",
      beforeData: jsonSafe(existing),
      afterData: jsonSafe(updated),
      ctx,
    });

    return mapLimitRuleRow(updated);
  });
}

export async function deleteSubscriptionLimitRule(
  db: Db,
  id: string,
  ctx: AuditContext = {},
): Promise<{ success: true }> {
  const uuid = requireUuid(id, "id");

  const [existing] = await db
    .select()
    .from(schema.subscriptionLimitRules)
    .where(eq(schema.subscriptionLimitRules.id, uuid))
    .limit(1);
  if (!existing) {
    throw new ModelServiceError("NOT_FOUND", "Subscription limit rule not found", 404);
  }

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.subscriptionLimitRules)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(schema.subscriptionLimitRules.id, uuid))
      .returning();

    await writeAudit(tx, {
      entityType: "subscription_limit_rule",
      entityId: uuid,
      action: "update",
      beforeData: jsonSafe(existing),
      afterData: jsonSafe(updated),
      ctx,
    });
  });

  return { success: true };
}
