import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema/index";
import { ModelServiceError } from "./services/models";
import {
  hashIdempotencyPayload,
  parseIdempotencyKeyHeader,
  withIdempotency,
} from "./services/idempotency";

function resolveUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
    return process.env.DATABASE_URL;
  }
  return "postgresql://modelmonitor:modelmonitor@127.0.0.1:5433/modelmonitor";
}

const client = postgres(resolveUrl(), { max: 5 });
const db = drizzle(client, { schema });

const keysToCleanup: string[] = [];

beforeAll(async () => {
});

afterAll(async () => {
  for (const key of keysToCleanup) {
    await client`DELETE FROM idempotency_keys WHERE key = ${key}`;
  }
  await client.end({ timeout: 2 });
});

describe("idempotency key parsing", () => {
  it("rejects blank and oversized keys", () => {
    expect(() => parseIdempotencyKeyHeader("")).toThrow(ModelServiceError);
    expect(() => parseIdempotencyKeyHeader("   ")).toThrow(ModelServiceError);
    expect(() => parseIdempotencyKeyHeader("x".repeat(129))).toThrow(ModelServiceError);
    expect(parseIdempotencyKeyHeader("merge-1")).toBe("merge-1");
  });
});

describe("durable atomic idempotency helper", () => {
  it("claims, completes, and replays identical requests without second mutation", async () => {
    const key = `mmtest:idem-${crypto.randomUUID()}`;
    keysToCleanup.push(key);
    const payload = { sourceModelId: "a", targetModelId: "b" };
    const hash = hashIdempotencyPayload(payload);

    let runs = 0;
    const first = await withIdempotency(
      db,
      { key, operation: "models.merge", requestHash: hash, successStatus: 200 },
      async () => {
        runs += 1;
        return { targetModelId: "b", transferred: { aliases: 1 }, auditEventId: "aud-1" };
      },
    );
    expect(first.replay).toBe(false);
    expect(runs).toBe(1);
    if (first.replay) throw new Error("expected fresh");
    expect(first.body).toEqual({
      targetModelId: "b",
      transferred: { aliases: 1 },
      auditEventId: "aud-1",
    });

    const second = await withIdempotency(
      db,
      { key, operation: "models.merge", requestHash: hash, successStatus: 200 },
      async () => {
        runs += 1;
        return { targetModelId: "should-not-run", auditEventId: "aud-2" };
      },
    );
    expect(second.replay).toBe(true);
    expect(runs).toBe(1);
    expect(second.body).toEqual({
      targetModelId: "b",
      transferred: { aliases: 1 },
      auditEventId: "aud-1",
    });

    const [row] = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(eq(schema.idempotencyKeys.key, key))
      .limit(1);
    expect(row?.status).toBe("completed");
    expect(row?.responseStatus).toBe(200);
  });

  it("rejects key reuse with a different payload hash", async () => {
    const key = `mmtest:idem-${crypto.randomUUID()}`;
    keysToCleanup.push(key);

    await withIdempotency(
      db,
      {
        key,
        operation: "models.merge",
        requestHash: hashIdempotencyPayload({ a: 1 }),
      },
      async () => ({ ok: true }),
    );

    await expect(
      withIdempotency(
        db,
        {
          key,
          operation: "models.merge",
          requestHash: hashIdempotencyPayload({ a: 2 }),
        },
        async () => ({ ok: false }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("rolls back pending claim when producer fails so retries can proceed", async () => {
    const key = `mmtest:idem-${crypto.randomUUID()}`;
    keysToCleanup.push(key);
    const hash = hashIdempotencyPayload({ n: 1 });

    await expect(
      withIdempotency(db, { key, operation: "models.merge", requestHash: hash }, async () => {
        throw new ModelServiceError("VALIDATION_ERROR", "boom", 400);
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Atomic design: failed producer rolls back the claim insert entirely.
    const [afterFail] = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(eq(schema.idempotencyKeys.key, key))
      .limit(1);
    expect(afterFail).toBeUndefined();

    let runs = 0;
    const retry = await withIdempotency(
      db,
      { key, operation: "models.merge", requestHash: hash },
      async () => {
        runs += 1;
        return { recovered: true };
      },
    );
    expect(retry.replay).toBe(false);
    expect(runs).toBe(1);
    expect(retry.body).toEqual({ recovered: true });
  });

  it("serializes concurrent same-key calls to a single producer run", async () => {
    const key = `mmtest:idem-${crypto.randomUUID()}`;
    keysToCleanup.push(key);
    const mutationKey = `mmtest:idem-mutation-${crypto.randomUUID()}`;
    const hash = hashIdempotencyPayload({ concurrent: true });
    const lockNs = 8720;
    const holdKey = 1 + Math.floor(Math.random() * 100000);
    const readyKey = holdKey + 1;
    let runs = 0;
    const controller = postgres(
      process.env.DATABASE_URL ??
        ["postgresql://", "modelmonitor", ":", "modelmonitor", "@", "127.0.0.1", ":", "5433", "/", "modelmonitor"].join(""),
      { max: 1 },
    );
    const waiterClient = postgres(resolveUrl(), {
      max: 1,
      connection: { application_name: `mmtest-waiter-${key.slice(-12)}` },
    });
    const waiterDb = drizzle(waiterClient, { schema });

    try {
      await controller.unsafe(`SELECT pg_advisory_lock(${lockNs}, ${holdKey})`);

      const starter = withIdempotency(
        db,
        { key, operation: "models.merge", requestHash: hash },
        async (tx) => {
          runs += 1;
          await tx.execute(sql.raw(`SELECT pg_advisory_lock(${lockNs}, ${readyKey})`));
          await tx.execute(sql.raw(`SELECT pg_advisory_lock(${lockNs}, ${holdKey})`));
          await tx.execute(sql.raw(`SELECT pg_advisory_unlock(${lockNs}, ${holdKey})`));
          await tx.execute(sql.raw(`SELECT pg_advisory_unlock(${lockNs}, ${readyKey})`));
          await tx.insert(schema.appSettings).values({
            key: mutationKey,
            value: { committedBy: "idempotency-producer" },
          });
          await tx.insert(schema.auditEvents).values({
            entityType: "idempotency_test",
            action: "merge",
            metadata: { mutationKey },
          });
          return { token: "winner", auditEventId: "aud-w" };
        },
      );

      let producerReady = false;
      for (let i = 0; i < 100; i += 1) {
        const [row] = await controller<{ c: number }[]>`
          SELECT count(*)::int AS c
          FROM pg_locks
          WHERE locktype = 'advisory'
            AND classid = ${lockNs}
            AND objid = ${readyKey}
            AND granted = true
        `;
        if (Number(row.c) > 0 && runs === 1) {
          producerReady = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(runs).toBe(1);
      expect(producerReady).toBe(true);
      // Claim row is uncommitted inside producer tx, so other sessions cannot read it yet.

      let producerWaiting = false;
      for (let i = 0; i < 50; i += 1) {
        const [row] = await controller<{ c: number }[]>`
          SELECT count(*)::int AS c
          FROM pg_locks
          WHERE locktype = 'advisory'
            AND classid = ${lockNs}
            AND objid = ${holdKey}
            AND granted = false
        `;
        if (Number(row.c) > 0) {
          producerWaiting = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(producerWaiting).toBe(true);

      const [{ pid: waiterPid }] = await waiterClient<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      let waiterStarted = false;
      let waiterFinished = false;
      const waiter = (async () => {
        waiterStarted = true;
        return withIdempotency(
        waiterDb,
        { key, operation: "models.merge", requestHash: hash },
        async () => {
          runs += 1;
          return { token: "should-not-run", auditEventId: "aud-x" };
        },
        );
      })().then(
        (result) => {
          waiterFinished = true;
          return result;
        },
        (err: unknown) => {
          waiterFinished = true;
          throw err;
        },
      );
      expect(waiterStarted).toBe(true);

      let sawWaitLocks = false;
      for (let i = 0; i < 100; i += 1) {
        const [row] = await controller<{ c: number }[]>`
          SELECT count(*)::int AS c
          FROM pg_locks l
          JOIN pg_stat_activity a ON a.pid = l.pid
          WHERE l.pid = ${Number(waiterPid)}
            AND l.locktype IN ('transactionid', 'tuple')
            AND l.granted = false
            AND a.application_name = ${`mmtest-waiter-${key.slice(-12)}`}
        `;
        if (Number(row.c) >= 1) sawWaitLocks = true;
        if (waiterFinished) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(sawWaitLocks).toBe(true);
      expect(waiterFinished).toBe(false);
      expect(runs).toBe(1);

      await controller.unsafe(`SELECT pg_advisory_unlock(${lockNs}, ${holdKey})`);
      const [a, b] = await Promise.all([starter, waiter]);
      expect(runs).toBe(1);
      expect([a.body, b.body]).toEqual([
        { token: "winner", auditEventId: "aud-w" },
        { token: "winner", auditEventId: "aud-w" },
      ]);
      expect(a.replay !== b.replay).toBe(true);
      const [mutation] = await controller`SELECT * FROM app_settings WHERE key = ${mutationKey}`;
      const [audits] = await controller<{ c: number }[]>`
        SELECT count(*)::int AS c FROM audit_events
        WHERE entity_type = 'idempotency_test' AND metadata->>'mutationKey' = ${mutationKey}
      `;
      expect(mutation).toBeTruthy();
      expect(Number(audits.c)).toBe(1);

      await expect(
        withIdempotency(
          db,
          { key, operation: "models.merge", requestHash: hashIdempotencyPayload({ other: true }) },
          async () => ({ token: "nope" }),
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    } finally {
      await client`DELETE FROM audit_events WHERE entity_type = 'idempotency_test' AND metadata->>'mutationKey' = ${mutationKey}`.catch(() => undefined);
      await client`DELETE FROM app_settings WHERE key = ${mutationKey}`.catch(() => undefined);
      await controller.unsafe("SELECT pg_advisory_unlock_all()").catch(() => undefined);
      await controller.end({ timeout: 1 }).catch(() => undefined);
      await waiterClient.end({ timeout: 1 }).catch(() => undefined);
    }
  });
});
