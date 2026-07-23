import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { usageSnapshotResponseSchema } from "@model-monitor/schemas";
import * as schema from "../schema/index";
import { asNumber } from "./audit";
import type { Db } from "./audit";

// Shape returned by the joined usage-snapshot select. Drizzle does not infer a
// precise row type for multi-table selects, so we annotate at this boundary.
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
};

// ── Query params helpers ────────────────────────────────────────

interface ListSnapshotsParams {
  subscriptionId?: string;
  modelId?: string;
  isMock?: boolean;
  limit: number;
  sort: "capturedAt";
}

function parseListSnapshotsParams(raw: unknown): ListSnapshotsParams {
  if (!raw || typeof raw !== "object") {
    return { limit: 50, sort: "capturedAt" };
  }
  const obj = raw as Record<string, unknown>;
  const subscriptionId =
    typeof obj.subscriptionId === "string" && obj.subscriptionId.length > 0
      ? obj.subscriptionId
      : undefined;
  const modelId =
    typeof obj.modelId === "string" && obj.modelId.length > 0 ? obj.modelId : undefined;
  let isMock: boolean | undefined;
  if (obj.isMock === true || obj.isMock === "true") isMock = true;
  else if (obj.isMock === false || obj.isMock === "false") isMock = false;
  let limit = 50;
  if (typeof obj.limit === "number" && Number.isInteger(obj.limit) && obj.limit >= 1) {
    limit = Math.min(obj.limit, 200);
  } else if (typeof obj.limit === "string") {
    const n = Number.parseInt(obj.limit, 10);
    if (!Number.isNaN(n) && n >= 1) limit = Math.min(n, 200);
  }
  return { subscriptionId, modelId, isMock, limit, sort: "capturedAt" };
}

// ── getMonthlyRegularTotal ──────────────────────────────────────

/**
 * SUM(actual_price) for active subscriptions.
 * Seed: 20 (ChatGPT Plus) + 10 (OpenCode Go) + 30 (SuperGrok) + 1 (Command Code Go) = 61 USD.
 */
export async function getMonthlyRegularTotal(
  db: Db,
): Promise<{
  total: number;
  currency: string;
  subscriptionCount: number;
  byStatus: Record<string, number>;
}> {
  const activeRows = await db
    .select({
      currency: schema.subscriptions.currency,
      actualPrice: schema.subscriptions.actualPrice,
    })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.status, "active"));

  let total = 0;
  let dominantCurrency = "USD";
  for (const row of activeRows) {
    total += asNumber(row.actualPrice) ?? 0;
    if (row.currency) dominantCurrency = row.currency;
  }

  // Count per status for transparency
  const statusCounts = await db
    .select({
      status: schema.subscriptions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.subscriptions)
    .groupBy(schema.subscriptions.status);

  const byStatus: Record<string, number> = {};
  for (const s of statusCounts) {
    byStatus[s.status] = s.count;
  }

  return {
    total,
    currency: dominantCurrency,
    subscriptionCount: activeRows.length,
    byStatus,
  };
}

// ── listUsageSnapshots ──────────────────────────────────────────

/**
 * Paginated usage snapshots with joined model name.
 * Filters by subscriptionId / modelId / isMock; sorted by capturedAt DESC.
 */
export async function listUsageSnapshots(
  db: Db,
  raw: unknown,
) {
  const { subscriptionId, modelId, isMock, limit } = parseListSnapshotsParams(raw);

  const conditions: SQL[] = [];
  if (subscriptionId) conditions.push(eq(schema.usageSnapshots.subscriptionId, subscriptionId));
  if (modelId) conditions.push(eq(schema.usageSnapshots.modelId, modelId));
  if (isMock !== undefined) conditions.push(eq(schema.usageSnapshots.isMock, isMock));

  const rows = (await db
    .select({
      id: schema.usageSnapshots.id,
      subscriptionId: schema.usageSnapshots.subscriptionId,
      modelId: schema.usageSnapshots.modelId,
      modelName: schema.models.name,
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
    })
    .from(schema.usageSnapshots)
    .leftJoin(schema.models, eq(schema.usageSnapshots.modelId, schema.models.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.usageSnapshots.capturedAt))
    .limit(limit)) as UsageSnapshotRow[];

  return rows.map(mapUsageSnapshotRow);
}

function mapUsageSnapshotRow(r: UsageSnapshotRow) {
  return usageSnapshotResponseSchema.parse({
    id: r.id,
    subscriptionId: r.subscriptionId,
    modelId: r.modelId ?? null,
    modelName: r.modelName ?? null,
    source: r.source,
    isMock: r.isMock,
    periodLabel: r.periodLabel ?? null,
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    usedAmount: asNumber(r.usedAmount),
    remainingAmount: asNumber(r.remainingAmount),
    totalAmount: asNumber(r.totalAmount),
    unit: r.unit ?? null,
    usedPercent: asNumber(r.usedPercent),
    confidence: asNumber(r.confidence),
    capturedAt: r.capturedAt.toISOString(),
  });
}

// ── getUsageSummary ─────────────────────────────────────────────

/**
 * Count usage snapshots grouped by source and is_mock.
 * Returns per-source counts and whether any mock data exists.
 */
export async function getUsageSummary(db: Db): Promise<{
  total: number;
  mock: number;
  manual: number;
  estimated: number;
  providerReported: number;
  withMock: boolean;
}> {
  const rows: { source: string; isMock: boolean; count: number }[] = await db
    .select({
      source: schema.usageSnapshots.source,
      isMock: schema.usageSnapshots.isMock,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.usageSnapshots)
    .groupBy(schema.usageSnapshots.source, schema.usageSnapshots.isMock);

  let total = 0;
  let mock = 0;
  let manual = 0;
  let estimated = 0;
  let providerReported = 0;
  let withMock = false;

  for (const r of rows) {
    total += r.count;
    if (r.isMock) withMock = true;
    switch (r.source) {
      case "mock":
        mock += r.count;
        break;
      case "manual":
        manual += r.count;
        break;
      case "estimated":
        estimated += r.count;
        break;
      case "provider_reported":
        providerReported += r.count;
        break;
    }
  }

  return { total, mock, manual, estimated, providerReported, withMock };
}
