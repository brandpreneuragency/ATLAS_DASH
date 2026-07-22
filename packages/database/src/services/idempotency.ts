import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { idempotencyKeySchema } from "@model-monitor/schemas";
import * as schema from "../schema/index";
import { ModelServiceError, type Db } from "./models";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | Tx;

export type IdempotencyStatus = "pending" | "completed" | "failed";

export interface IdempotencyRecord {
  id: string;
  key: string;
  operation: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: unknown;
  createdAt: Date;
  completedAt: Date | null;
}

export interface IdempotencyReplay {
  replay: true;
  status: number;
  body: unknown;
  record: IdempotencyRecord;
}

export interface IdempotencyFreshResult<T> {
  replay: false;
  status: number;
  body: T;
  record: IdempotencyRecord;
}


export function parseIdempotencyKeyHeader(raw: string | null | undefined): string {
  const parsed = idempotencyKeySchema.safeParse(raw ?? "");
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Idempotency-Key header is required and must be 1–128 non-blank characters",
      400,
      { "Idempotency-Key": parsed.error.flatten().formErrors },
    );
  }
  return parsed.data;
}

/** Stable hash of the request payload used to detect key reuse with different bodies. */
export function hashIdempotencyPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function mapRow(row: typeof schema.idempotencyKeys.$inferSelect): IdempotencyRecord {
  return {
    id: row.id,
    key: row.key,
    operation: row.operation,
    requestHash: row.requestHash,
    status: row.status as IdempotencyStatus,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

/** Lock the idempotency row (if any) inside the caller's transaction. */
async function loadKeyForUpdate(
  tx: Tx,
  key: string,
  operation: string,
): Promise<IdempotencyRecord | null> {
  const rows = await tx
    .select()
    .from(schema.idempotencyKeys)
    .where(
      and(eq(schema.idempotencyKeys.key, key), eq(schema.idempotencyKeys.operation, operation)),
    )
    .for("update");
  return rows[0] ? mapRow(rows[0]) : null;
}

function assertHashMatch(record: IdempotencyRecord, requestHash: string) {
  if (record.requestHash !== requestHash) {
    throw new ModelServiceError(
      "CONFLICT",
      "Idempotency-Key was reused with a different request payload",
      409,
      { "Idempotency-Key": ["Key reuse with different body is not allowed"] },
    );
  }
}

export async function completeIdempotencyKey(
  db: DbOrTx,
  input: {
    id: string;
    responseStatus: number;
    responseBody: unknown;
  },
): Promise<IdempotencyRecord> {
  const [updated] = await db
    .update(schema.idempotencyKeys)
    .set({
      status: "completed",
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      completedAt: new Date(),
    })
    .where(eq(schema.idempotencyKeys.id, input.id))
    .returning();
  if (!updated) {
    throw new ModelServiceError("INTERNAL_ERROR", "Idempotency record missing during complete", 500);
  }
  return mapRow(updated);
}

/**
 * Execute `producer` under a single DB transaction that also claims and completes
 * the idempotency key. Side effects and key completion commit atomically, so a crash
 * cannot leave a successful merge with a permanently pending key.
 *
 * Concurrent same-key callers serialize on row locks; waiters replay the original body.
 * Same key + different payload → 409. Failures roll back the claim so retries can proceed.
 */
export async function withIdempotency<T>(
  db: Db,
  input: {
    key: string;
    operation: string;
    requestHash: string;
    successStatus?: number;
  },
  producer: (tx: Tx) => Promise<T>,
): Promise<IdempotencyReplay | IdempotencyFreshResult<T>> {
  const successStatus = input.successStatus ?? 200;

  return db.transaction(async (tx) => {
    let record = await loadKeyForUpdate(tx, input.key, input.operation);

    if (!record) {
      // ON CONFLICT avoids aborting the transaction (unique violations are not catchable
      // without a savepoint once postgres marks the tx aborted).
      const inserted = await tx
        .insert(schema.idempotencyKeys)
        .values({
          key: input.key,
          operation: input.operation,
          requestHash: input.requestHash,
          status: "pending",
        })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        record = mapRow(inserted[0]);
      } else {
        record = await loadKeyForUpdate(tx, input.key, input.operation);
        if (!record) {
          throw new ModelServiceError(
            "INTERNAL_ERROR",
            "Failed to claim idempotency key after conflict",
            500,
          );
        }
      }
    }

    assertHashMatch(record, input.requestHash);

    if (record.status === "completed" && record.responseStatus != null) {
      return {
        replay: true,
        status: record.responseStatus,
        body: record.responseBody,
        record,
      };
    }

    // Reclaim failed under the row lock.
    if (record.status === "failed") {
      const [updated] = await tx
        .update(schema.idempotencyKeys)
        .set({
          status: "pending",
          requestHash: input.requestHash,
          responseStatus: null,
          responseBody: null,
          completedAt: null,
        })
        .where(eq(schema.idempotencyKeys.id, record.id))
        .returning();
      record = mapRow(updated);
    }

    const body = await producer(tx);
    const completed = await completeIdempotencyKey(tx, {
      id: record.id,
      responseStatus: successStatus,
      responseBody: body,
    });
    return {
      replay: false,
      status: successStatus,
      body,
      record: completed,
    };
  });
}

export async function failIdempotencyKey(
  db: DbOrTx,
  input: { id: string; responseStatus?: number; responseBody?: unknown },
): Promise<void> {
  await db
    .update(schema.idempotencyKeys)
    .set({
      status: "failed",
      responseStatus: input.responseStatus ?? null,
      responseBody: input.responseBody ?? null,
      completedAt: new Date(),
    })
    .where(eq(schema.idempotencyKeys.id, input.id));
}
