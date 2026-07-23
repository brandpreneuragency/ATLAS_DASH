import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema/index";
import { ModelServiceError, type AuditContext } from "./models";

export { ModelServiceError };
export type { AuditContext };

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

type AuditAction = (typeof schema.auditAction.enumValues)[number];

export async function writeAudit(
  db: DbOrTx,
  input: {
    entityType: string;
    entityId: string | null;
    action: AuditAction;
    beforeData?: unknown;
    afterData?: unknown;
    metadata?: unknown;
    ctx?: AuditContext;
  },
): Promise<{ id: string }> {
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

/** Explicit sensitive keys only — do not substring-match domain fields like contextTokens. */
export const SENSITIVE_AUDIT_KEYS = new Set([
  "password",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "apiToken",
  "apiKey",
  "authorization",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "clientSecret",
  "privateKey",
  "tokenHash",
  "tokenPrefix",
]);

export function isSensitiveAuditKey(key: string): boolean {
  const compact = key.trim().toLowerCase().replace(/[_-]/g, "");
  // Domain capacity fields contain "tokens" but are not credentials.
  if (["contexttokens", "maxoutputtokens", "verifiedtps"].includes(compact)) return false;
  if (SENSITIVE_AUDIT_KEYS.has(key)) return true;
  return (
    /^(password|passwd|secret|token|accesstoken|refreshtoken|idtoken|apitoken|apikey|authorization|cookie|cookies|credential|credentials|clientsecret|privatekey|tokenhash|tokenprefix)$/.test(
      compact,
    ) ||
    /(password|passwd|secret|tokenhash|tokenprefix|apikey|clientsecret|privatekey)$/.test(compact)
  );
}

export function jsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((v) => jsonSafe(v));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveAuditKey(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = jsonSafe(v);
    }
    return out;
  }
  return value;
}

function sortKeyPart(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

export function snapshotSortedRows(rows: readonly unknown[]): unknown {
  const sorted = [...rows].sort((a, b) => {
    const ar = (a ?? {}) as Record<string, unknown>;
    const br = (b ?? {}) as Record<string, unknown>;
    const ai = sortKeyPart(ar.id ?? ar.entityId ?? ar.modelId);
    const bi = sortKeyPart(br.id ?? br.entityId ?? br.modelId);
    const c = ai.localeCompare(bi);
    if (c !== 0) return c;
    return JSON.stringify(ar).localeCompare(JSON.stringify(br));
  });
  return jsonSafe(sorted);
}

export function asNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}
