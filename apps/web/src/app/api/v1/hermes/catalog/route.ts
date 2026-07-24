import { createHash } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  hashApiToken,
  isApiTokenUsable,
  schema,
} from "@model-monitor/database";
import {
  serializeHermesCatalog,
  type HermesCatalog,
  type HermesModelInput,
} from "@model-monitor/hermes-contract";
import { ModelServiceError } from "@model-monitor/database";
import { getRequestId, jsonError, jsonOk } from "@/lib/api";

type CatalogCacheEntry = {
  body: string;
  catalog: HermesCatalog;
  etag: string;
  expiresAt: number;
  generatedAt: string;
};

const catalogCache = new Map<number, CatalogCacheEntry>();
const CATALOG_REVISION = 1;
const CACHE_TTL_MS = 60_000;

function bearer(request: Request): string {
  const value = request.headers.get("authorization");
  if (!value || !/^Bearer\s+\S+$/i.test(value)) {
    throw new ModelServiceError("UNAUTHORIZED", "Bearer token required", 401);
  }
  return value.replace(/^Bearer\s+/i, "");
}

function notModifiedResponse(requestId: string, entry: CatalogCacheEntry): Response {
  return new Response(null, {
    status: 304,
    headers: {
      ETag: entry.etag,
      "Last-Modified": entry.generatedAt,
      "Cache-Control": "private, max-age=60",
      "x-request-id": requestId,
    },
  });
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const plaintext = bearer(request);
    const [tokenRow] = await db
      .select()
      .from(schema.apiTokens)
      .where(eq(schema.apiTokens.tokenHash, hashApiToken(plaintext)));
    if (!tokenRow || !isApiTokenUsable(tokenRow)) {
      throw new ModelServiceError("UNAUTHORIZED", "Invalid or unusable bearer token", 401);
    }

    const now = Date.now();
    let entry = catalogCache.get(CATALOG_REVISION);
    if (!entry || entry.expiresAt <= now) {
      const [models, capabilities, accesses, scores, usageSnapshots] = await Promise.all([
        db
          .select({ model: schema.models, developer: schema.developers.name })
          .from(schema.models)
          .innerJoin(schema.developers, eq(schema.models.developerId, schema.developers.id))
          .where(eq(schema.models.status, "active"))
          .orderBy(asc(schema.models.canonicalId)),
        db.select().from(schema.modelCapabilities),
        db
          .select({
            access: schema.modelAccess,
            provider: schema.accessProviders.name,
            plan: schema.plans.name,
            subscriptionId: schema.subscriptions.id,
          })
          .from(schema.modelAccess)
          .innerJoin(schema.plans, eq(schema.modelAccess.planId, schema.plans.id))
          .innerJoin(
            schema.accessProviders,
            eq(schema.plans.accessProviderId, schema.accessProviders.id),
          )
          .leftJoin(
            schema.subscriptions,
            and(
              eq(schema.subscriptions.planId, schema.plans.id),
              eq(schema.subscriptions.status, "active"),
            ),
          )
          .where(eq(schema.modelAccess.status, "active")),
        db
          .select({
            score: schema.modelScores,
            methodologyVersion: schema.scoreMethodologies.version,
          })
          .from(schema.modelScores)
          .innerJoin(
            schema.scoreMethodologies,
            eq(schema.modelScores.methodologyId, schema.scoreMethodologies.id),
          ),
        db
          .select({
            modelId: schema.usageSnapshots.modelId,
            subscriptionId: schema.usageSnapshots.subscriptionId,
            source: schema.usageSnapshots.source,
            isMock: schema.usageSnapshots.isMock,
            usedPercent: schema.usageSnapshots.usedPercent,
            capturedAt: schema.usageSnapshots.capturedAt,
          })
          .from(schema.usageSnapshots)
          .orderBy(desc(schema.usageSnapshots.capturedAt)),
      ]);

      const capByModel = new Map(capabilities.map((capability) => [capability.modelId, capability]));
      const usageByAccess = new Map<
        string,
        NonNullable<HermesModelInput["access"][number]["usage"]>
      >();
      for (const snapshot of usageSnapshots) {
        if (!snapshot.modelId) continue;
        const key = `${snapshot.modelId}:${snapshot.subscriptionId}`;
        if (usageByAccess.has(key)) continue;
        usageByAccess.set(key, {
          source: snapshot.source,
          isMock: snapshot.isMock,
          usedPercent: snapshot.usedPercent === null ? null : Number(snapshot.usedPercent),
          capturedAt: snapshot.capturedAt.toISOString(),
        });
      }

      const accessByModel = new Map<string, HermesModelInput["access"]>();
      for (const row of accesses) {
        const access = row.access;
        const list = accessByModel.get(access.modelId) ?? [];
        list.push({
          subscriptionId: row.subscriptionId,
          provider: row.provider,
          plan: row.plan,
          providerModelId: access.providerModelId,
          available:
            Boolean(row.subscriptionId) && access.availability === "confirmed",
          availability: access.availability,
          accessMethod: access.accessMethod,
          apiCompatible: access.apiCompatible,
          cliOnly: access.cliOnly,
          webOnly: access.webOnly,
          limitations: access.limitations,
          usage: row.subscriptionId
            ? usageByAccess.get(`${access.modelId}:${row.subscriptionId}`) ?? null
            : null,
        });
        accessByModel.set(access.modelId, list);
      }

      const scoreByModel = new Map<string, HermesModelInput["scores"]>();
      for (const row of scores) {
        const score = row.score;
        const list = scoreByModel.get(score.modelId) ?? {};
        if (!(score.scoreType in list)) {
          list[score.scoreType] = {
            value: score.scoreValue === null ? null : Number(score.scoreValue),
            rank: score.rankValue,
            methodologyVersion: row.methodologyVersion,
            confidence: score.confidence === null ? null : Number(score.confidence),
          };
        }
        scoreByModel.set(score.modelId, list);
      }

      const generatedAt = new Date().toISOString();
      const catalog = serializeHermesCatalog({
        generatedAt,
        catalogRevision: CATALOG_REVISION,
        models: models.map(({ model, developer }) => {
          const capability = capByModel.get(model.id);
          return {
            model: {
              canonicalId: model.canonicalId,
              name: model.name,
              developer,
              family: model.family,
              lifecycle: model.lifecycle,
              contextTokens: model.contextTokens,
              maxOutputTokens: model.maxOutputTokens,
              speedRating: model.speedRating,
              verifiedTps: model.verifiedTps === null ? null : Number(model.verifiedTps),
              verifiedAt: model.verifiedAt,
              needsRecheck: model.needsRecheck,
              vision: capability?.vision ?? null,
              reasoning: capability?.reasoning ?? null,
              toolUse: capability?.toolUse ?? null,
              parallelAgents: capability?.parallelAgents ?? null,
              computerUse: capability?.computerUse ?? null,
            },
            scores: scoreByModel.get(model.id) ?? {},
            access: accessByModel.get(model.id) ?? [],
          };
        }),
      });
      const body = JSON.stringify(catalog);
      entry = {
        body,
        catalog,
        etag: `"${createHash("sha256").update(body).digest("hex")}"`,
        expiresAt: now + CACHE_TTL_MS,
        generatedAt,
      };
      catalogCache.set(CATALOG_REVISION, entry);
    }

    if (request.headers.get("if-none-match") === entry.etag) {
      return notModifiedResponse(requestId, entry);
    }
    const response = jsonOk(entry.catalog, { requestId });
    response.headers.set("ETag", entry.etag);
    response.headers.set("Cache-Control", "private, max-age=60");
    response.headers.set("Last-Modified", entry.generatedAt);
    return response;
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export function POST() {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}