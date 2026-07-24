import { count, countDistinct, desc, eq, isNull, sql } from "drizzle-orm";
import { getMonthlyRegularTotal, getUsageSummary, listSubscriptions, schema } from "@model-monitor/database";
import { db } from "@/lib/db";
import { getRequestId, jsonError, jsonOk, requireApiSession } from "@/lib/api";

export async function GET(request: Request) { const requestId = getRequestId(request); try { await requireApiSession(requestId); const [cost, usage, subsResult, canonical, accessible, recheck, multiple, recent, unknownRenewals, unconfirmedAccess, missingMethodology, stale, conflicts] = await Promise.all([
 getMonthlyRegularTotal(db), getUsageSummary(db), listSubscriptions(db, { limit: 100 }),
 db.select({ value: count() }).from(schema.models).where(eq(schema.models.status, "active")),
 db.select({ value: countDistinct(schema.modelAccess.modelId) }).from(schema.modelAccess).where(eq(schema.modelAccess.availability, "confirmed")),
 db.select({ value: count() }).from(schema.models).where(eq(schema.models.needsRecheck, true)),
 db.select({ value: countDistinct(schema.modelAccess.modelId) }).from(schema.modelAccess).where(eq(schema.modelAccess.status, "active")),
 db.select({ id: schema.models.id, name: schema.models.name, updatedAt: schema.models.updatedAt }).from(schema.models).orderBy(desc(schema.models.updatedAt)).limit(10),
 db.select({ value: count() }).from(schema.subscriptions).where(isNull(schema.subscriptions.nextBillingDate)),
 db.select({ value: count() }).from(schema.modelAccess).where(eq(schema.modelAccess.availability, "unconfirmed")),
 db.select({ value: count() }).from(schema.models).where(isNull(schema.models.verificationStatus)),
 db.select({ value: count() }).from(schema.models).where(sql`${schema.models.verifiedAt} < now() - interval '30 days'`),
 db.select({ value: count() }).from(schema.importConflicts).where(isNull(schema.importConflicts.resolvedAt)),
 ]); const subscriptions = subsResult.data.map((s) => ({ id: s.id, accountLabel: s.accountLabel, status: s.status, nextBillingDate: s.nextBillingDate })); return jsonOk({ data: { monthlyRegularTotal: cost.total, currency: cost.currency, subscriptionCount: cost.subscriptionCount, byStatus: cost.byStatus, usage, subscriptions, kpis: { canonicalModelCount: canonical[0]?.value ?? null, accessibleModelCount: accessible[0]?.value ?? null, needsRecheckCount: recheck[0]?.value ?? null, upcomingRenewals: subscriptions.filter((s) => s.nextBillingDate !== null), multipleAccessCount: multiple[0]?.value ?? null, recentlyUpdatedRecords: recent }, warnings: { unknownRenewalDates: unknownRenewals[0]?.value ?? null, accessUnconfirmed: unconfirmedAccess[0]?.value ?? null, missingMethodology: missingMethodology[0]?.value ?? null, staleVerification: stale[0]?.value ?? null, unresolvedImportConflicts: conflicts[0]?.value ?? null } }, meta: { requestId } }, { requestId }); } catch (error) { return jsonError(error, requestId); } }
