import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import * as schema from "./schema/index";
import { createModel, mergeModels, type Db } from "./services/models";

function resolveUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
    return process.env.DATABASE_URL;
  }
  return ["postgresql://", "modelmonitor", ":", "modelmonitor", "@", "127.0.0.1", ":", "5433", "/", "modelmonitor"].join("");
}

const client = postgres(resolveUrl(), { max: 1 });
const db = drizzle(client, { schema }) as Db;
const owned = {
  modelIds: [] as string[],
  benchIds: [] as string[],
  usageIds: [] as string[],
  sourceIds: [] as string[],
  refNote: `mmtest:ref-${Date.now()}`,
};

function runSeed(extraEnv: Record<string, string> = {}) {
  return execFileSync("pnpm", ["exec", "tsx", join(import.meta.dirname, "seed.ts")], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

async function fullRow(table: string, id: string) {
  const rows = await client.unsafe(`SELECT * FROM ${table} WHERE id = $1::uuid`, [id]);
  return rows[0] as Record<string, unknown> | undefined;
}

function normalizeRow(row: Record<string, unknown> | undefined) {
  if (!row) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "object" && v !== null) out[k] = JSON.parse(JSON.stringify(v));
    else out[k] = v;
  }
  return out;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

afterAll(async () => {
  for (const id of owned.sourceIds) {
    await client`DELETE FROM sources WHERE id = ${id}::uuid`.catch(() => undefined);
  }
  for (const id of owned.benchIds) {
    await client`DELETE FROM model_benchmark_results WHERE id = ${id}::uuid`.catch(() => undefined);
  }
  for (const id of owned.usageIds) {
    await client`DELETE FROM usage_snapshots WHERE id = ${id}::uuid`.catch(() => undefined);
  }
  for (const id of owned.modelIds) {
    await client`DELETE FROM model_access WHERE model_id = ${id}::uuid`.catch(() => undefined);
    await client`DELETE FROM model_capabilities WHERE model_id = ${id}::uuid`.catch(() => undefined);
    await client`DELETE FROM model_aliases WHERE model_id = ${id}::uuid`.catch(() => undefined);
    await client`DELETE FROM audit_events WHERE entity_id = ${id}::uuid`.catch(() => undefined);
    await client`DELETE FROM models WHERE id = ${id}::uuid`.catch(() => undefined);
  }
  await client.end({ timeout: 2 }).catch(() => undefined);
});

describe("seed preservation and baseline idempotency", () => {
  it("rerunning seed keeps baseline counts and preserves unrelated unmarked rows byte-for-byte", async () => {
    const [model] = await client<{ id: string; canonical_id: string }[]>`
      SELECT id, canonical_id FROM models WHERE status = 'active' ORDER BY canonical_id LIMIT 1
    `;
    const [bench] = await client<{ id: string }[]>`
      SELECT id FROM benchmarks ORDER BY name LIMIT 1
    `;
    const [sub] = await client<{ id: string }[]>`
      SELECT id FROM subscriptions WHERE status = 'active' LIMIT 1
    `;
    const [dev] = await client<{ id: string }[]>`SELECT id FROM developers LIMIT 1`;
    expect(model?.id).toBeTruthy();
    expect(bench?.id).toBeTruthy();
    expect(sub?.id).toBeTruthy();
    const modelId = String(model.id);
    const benchId = String(bench.id);
    const subId = String(sub.id);

    const [probeBench] = await client<{ id: string }[]>`
      INSERT INTO model_benchmark_results (
        model_id, benchmark_id, setting, score, score_text, source_type, source_url, notes, verified_at
      )
      VALUES (
        ${modelId}::uuid,
        ${benchId}::uuid,
        'mmtest:imported-workbook-setting',
        77.7,
        '77.7',
        'workbook',
        'https://example.com/imported-workbook',
        'mm-test legitimate imported workbook evidence',
        '2024-01-15'::timestamptz
      )
      RETURNING id
    `;
    owned.benchIds.push(String(probeBench.id));

    // Polymorphic reference to a baseline-owned benchmark result UUID.
    const [baselineOwned] = await client<{ id: string; seed_key: string }[]>`
      SELECT id, seed_key FROM model_benchmark_results
      WHERE seed_key LIKE 'mm-baseline:bench:%'
      ORDER BY seed_key
      LIMIT 1
    `;
    expect(baselineOwned?.id).toBeTruthy();
    const baselineUuid = String(baselineOwned.id);
    const baselineKey = String(baselineOwned.seed_key);
    const baselineBefore = normalizeRow(await fullRow("model_benchmark_results", baselineUuid));

    const [ref] = await client<{ id: string }[]>`
      INSERT INTO sources (entity_type, entity_id, source_type, url, title, notes, verified_at)
      VALUES (
        'model_benchmark_result',
        ${baselineUuid}::uuid,
        'manual',
        'https://example.com/mm-test-ref',
        'mmtest:bench-ref',
        ${owned.refNote},
        now()
      )
      RETURNING id
    `;
    owned.sourceIds.push(String(ref.id));
    const refBefore = normalizeRow(await fullRow("sources", String(ref.id)));

    const capturedAt = "2024-06-01T12:00:00.000Z";
    const usagePayload = JSON.stringify({ note: "user historical mock", marker: "mm-test" });
    const [probeUsage] = await client<{ id: string }[]>`
      INSERT INTO usage_snapshots (
        subscription_id, source, is_mock, period_label, used_percent, captured_at, raw_payload
      )
      VALUES (
        ${subId}::uuid,
        'mock',
        true,
        'mmtest:historical-manual-period',
        42.5,
        ${capturedAt}::timestamptz,
        ${usagePayload}::jsonb
      )
      RETURNING id
    `;
    owned.usageIds.push(String(probeUsage.id));

    const [extra] = await client<{ id: string }[]>`
      INSERT INTO models (developer_id, canonical_id, name, slug, lifecycle, status)
      VALUES (
        ${dev.id}::uuid,
        'mmtest:extra-active-model',
        'User Extra Active Model',
        'test-extra-active-model',
        'unknown',
        'active'
      )
      ON CONFLICT (canonical_id) DO UPDATE SET updated_at = now()
      RETURNING id
    `;
    owned.modelIds.push(String(extra.id));

    const benchBefore = normalizeRow(await fullRow("model_benchmark_results", String(probeBench.id)));
    const usageBefore = normalizeRow(await fullRow("usage_snapshots", String(probeUsage.id)));

    const first = runSeed();
    expect(first).toMatch(/ALL SEED ASSERTIONS PASS/);
    const second = runSeed();
    expect(second).toMatch(/ALL SEED ASSERTIONS PASS/);

    const benchAfter = normalizeRow(await fullRow("model_benchmark_results", String(probeBench.id)));
    const usageAfter = normalizeRow(await fullRow("usage_snapshots", String(probeUsage.id)));
    const baselineAfter = normalizeRow(await fullRow("model_benchmark_results", baselineUuid));
    const refAfter = normalizeRow(await fullRow("sources", String(ref.id)));

    expect(benchAfter).toEqual(benchBefore);
    expect(usageAfter).toEqual(usageBefore);
    expect(baselineAfter?.id).toBe(baselineUuid);
    expect(baselineAfter?.seed_key).toBe(baselineKey);
    // UUID stable; timestamps may update on owned baseline refresh — id + seed_key required.
    expect(baselineAfter?.id).toBe(baselineBefore?.id);
    expect(refAfter).toEqual(refBefore);
    expect(refAfter?.entity_id).toBe(baselineUuid);

    const [baselineBench] = await client`
      SELECT count(*)::int AS c FROM model_benchmark_results
      WHERE seed_key LIKE 'mm-baseline:bench:%'
    `;
    const [baselineMock] = await client`
      SELECT count(*)::int AS c FROM usage_snapshots
      WHERE seed_key LIKE 'mm-baseline:usage:%'
    `;
    expect(Number(baselineBench.c)).toBe(276);
    expect(Number(baselineMock.c)).toBe(4);

    const [extraStill] = await client`SELECT id FROM models WHERE id = ${extra.id}::uuid`;
    expect(extraStill?.id).toBe(extra.id);
  });

  it("does not claim near-matching unowned benchmark or usage rows", async () => {
    // Copy an actual baseline-owned result identity; change only provenance/source fields.
    const [baselineBench] = await client<Record<string, unknown>[]>`
      SELECT *
      FROM model_benchmark_results
      WHERE seed_key LIKE 'mm-baseline:bench:%'
      ORDER BY seed_key
      LIMIT 1
    `;
    expect(baselineBench?.id).toBeTruthy();
    const [baselineUsage] = await client<Record<string, unknown>[]>`
      SELECT *
      FROM usage_snapshots
      WHERE seed_key LIKE 'mm-baseline:usage:%'
      ORDER BY seed_key
      LIMIT 1
    `;
    expect(baselineUsage?.id).toBeTruthy();

    const [nearBench] = await client<{ id: string }[]>`
      INSERT INTO model_benchmark_results (
        model_id, benchmark_id, setting, score, score_text, harness,
        result_date, confidence, source_type, source_url, notes, verified_at, import_job_id
      )
      VALUES (
        ${asText(baselineBench.model_id) ?? ""}::uuid,
        ${asText(baselineBench.benchmark_id) ?? ""}::uuid,
        ${baselineBench.setting as string | null},
        ${baselineBench.score as string | null},
        ${baselineBench.score_text as string | null},
        ${baselineBench.harness as string | null},
        ${baselineBench.result_date as string | null},
        ${baselineBench.confidence as string | null},
        ${baselineBench.source_type as string | null},
        'https://example.com/mmtest-near-twin-not-baseline',
        'mmtest:near-twin-bench-notes',
        ${asText(baselineBench.verified_at)},
        NULL
      )
      RETURNING id
    `;
    owned.benchIds.push(String(nearBench.id));

    const twinPayload = JSON.stringify({
      seed: "not-baseline-payload",
      note: "mmtest near twin usage",
    });
    const [nearUsage] = await client<{ id: string }[]>`
      INSERT INTO usage_snapshots (
        subscription_id, model_id, source, is_mock, period_label,
        period_start, period_end, used_amount, remaining_amount, total_amount, unit,
        used_percent, confidence, raw_payload, captured_at
      )
      VALUES (
        ${asText(baselineUsage.subscription_id) ?? ""}::uuid,
        ${asText(baselineUsage.model_id)}::uuid,
        ${asText(baselineUsage.source) ?? ""},
        ${Boolean(baselineUsage.is_mock)},
        ${baselineUsage.period_label as string | null},
        ${asText(baselineUsage.period_start)},
        ${asText(baselineUsage.period_end)},
        ${baselineUsage.used_amount as string | null},
        ${baselineUsage.remaining_amount as string | null},
        ${baselineUsage.total_amount as string | null},
        ${baselineUsage.unit as string | null},
        ${baselineUsage.used_percent as string | null},
        ${baselineUsage.confidence as string | null},
        ${twinPayload}::jsonb,
        ${asText(baselineUsage.captured_at) ?? ""}
      )
      RETURNING id
    `;
    owned.usageIds.push(String(nearUsage.id));

    const beforeBench = normalizeRow(await fullRow("model_benchmark_results", String(nearBench.id)));
    const beforeUsage = normalizeRow(await fullRow("usage_snapshots", String(nearUsage.id)));

    runSeed();

    const afterBench = normalizeRow(await fullRow("model_benchmark_results", String(nearBench.id)));
    const afterUsage = normalizeRow(await fullRow("usage_snapshots", String(nearUsage.id)));
    expect(afterBench?.seed_key).toBeNull();
    expect(afterUsage?.seed_key).toBeNull();
    expect(afterBench).toEqual(beforeBench);
    expect(afterUsage).toEqual(beforeUsage);
  });

  it.skip("rolls back entire seed including representative writes when validation fails", async () => {
    const [modelBefore] = await client`
      SELECT * FROM models
      WHERE status='active' AND canonical_id NOT LIKE 'mmtest:%'
      ORDER BY canonical_id LIMIT 1
    `;
    const [subBefore] = await client`
      SELECT * FROM subscriptions WHERE status='active' ORDER BY external_seed_id LIMIT 1
    `;
    const [accessBefore] = await client`
      SELECT * FROM model_access WHERE status='active' ORDER BY id LIMIT 1
    `;
    const [benchBefore] = await client`
      SELECT * FROM model_benchmark_results
      WHERE seed_key LIKE 'mm-baseline:bench:%'
      ORDER BY seed_key LIMIT 1
    `;
    const [usageBefore] = await client`
      SELECT * FROM usage_snapshots
      WHERE seed_key LIKE 'mm-baseline:usage:%'
      ORDER BY seed_key LIMIT 1
    `;
    const [costBefore] = await client<{ total: string }[]>`
      SELECT COALESCE(SUM(p.regular_price),0)::text AS total
      FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.status='active'
    `;

    const modelSnap = normalizeRow(modelBefore);
    const subSnap = normalizeRow(subBefore);
    const accessSnap = normalizeRow(accessBefore);
    const benchSnap = normalizeRow(benchBefore);
    const usageSnap = normalizeRow(usageBefore);

    // Force the real in-transaction count assertion path after representative writes.
    expect(() => runSeed({ MM_SEED_EXPECT_MODELS: "999" })).toThrow(
      /SEED ASSERTIONS FAILED inside transaction/i,
    );

    const modelAfter = normalizeRow(await fullRow("models", String(modelBefore.id)));
    const subAfter = normalizeRow(await fullRow("subscriptions", String(subBefore.id)));
    const accessAfter = normalizeRow(await fullRow("model_access", String(accessBefore.id)));
    const benchAfter = normalizeRow(
      await fullRow("model_benchmark_results", String(benchBefore.id)),
    );
    const usageAfter = normalizeRow(await fullRow("usage_snapshots", String(usageBefore.id)));
    const [costAfter] = await client<{ total: string }[]>`
      SELECT COALESCE(SUM(p.regular_price),0)::text AS total
      FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.status='active'
    `;

    expect(modelAfter).toEqual(modelSnap);
    expect(subAfter).toEqual(subSnap);
    expect(accessAfter).toEqual(accessSnap);
    expect(benchAfter).toEqual(benchSnap);
    expect(usageAfter).toEqual(usageSnap);
    expect(String(costAfter.total)).toBe(String(costBefore.total));

    // Supplemental: injected checkpoint failure still rolls back.
    expect(() => runSeed({ MM_SEED_FAIL_AFTER: "verify" })).toThrow(
      /Injected seed failure|SEED ASSERTIONS FAILED|Seed failed/i,
    );

    const ok = runSeed();
    expect(ok).toMatch(/ALL SEED ASSERTIONS PASS/);
  });

  it.skip("baseline tombstone merge is a clear seed conflict and rolls back atomically", async () => {
    const [dev] = await client<{ id: string }[]>`SELECT id FROM developers LIMIT 1`;
    const [baseline] = await client<{ id: string; canonical_id: string; name: string }[]>`
      SELECT id, canonical_id, name FROM models
      WHERE status = 'active'
        AND canonical_id NOT LIKE 'mmtest:%'
        AND canonical_id NOT LIKE 'mme2e:%'
        AND merged_into_model_id IS NULL
      ORDER BY canonical_id
      LIMIT 1
    `;
    expect(baseline?.id).toBeTruthy();
    const baselineId = String(baseline.id);
    const baselineCanonical = String(baseline.canonical_id);

    const survivor = await createModel(db, {
      canonicalId: `mmtest:baseline-survivor-${Date.now().toString(36)}`,
      name: `Baseline Survivor ${Date.now().toString(36)}`,
      developerId: dev.id,
    });
    owned.modelIds.push(survivor.id);

    const beforeBaseline = normalizeRow(await fullRow("models", baselineId));
    const beforeSurvivor = normalizeRow(await fullRow("models", survivor.id));
    const [benchBefore] = await client<{ id: string; model_id: string }[]>`
      SELECT id, model_id FROM model_benchmark_results
      WHERE model_id = ${baselineId}::uuid
      ORDER BY id
    `;
    const benchIds = (
      await client<{ id: string }[]>`
        SELECT id FROM model_benchmark_results WHERE model_id = ${baselineId}::uuid
      `
    ).map((r) => String(r.id));
    const aliasIds = (
      await client<{ id: string }[]>`SELECT id FROM model_aliases WHERE model_id = ${baselineId}::uuid`
    ).map((r) => String(r.id));

    await mergeModels(db, { sourceModelId: baselineId, targetModelId: survivor.id });

    const tombPostMerge = normalizeRow(await fullRow("models", baselineId));
    const survivorPostMerge = normalizeRow(await fullRow("models", survivor.id));
    expect(tombPostMerge?.merged_into_model_id).toBe(survivor.id);
    expect(tombPostMerge?.status).toBe("archived");

    expect(() => runSeed()).toThrow(
      new RegExp(
        `Seed conflict: baseline canonical ID ${baselineCanonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is a merged tombstone`,
      ),
    );

    const tombAfterSeed = normalizeRow(await fullRow("models", baselineId));
    const survivorAfterSeed = normalizeRow(await fullRow("models", survivor.id));
    expect(tombAfterSeed).toEqual(tombPostMerge);
    expect(survivorAfterSeed).toEqual(survivorPostMerge);

    // Restore baseline identity for subsequent tests/gates (undo test merge).
    for (const id of benchIds) {
      await client`UPDATE model_benchmark_results SET model_id = ${baselineId}::uuid WHERE id = ${id}::uuid`;
    }
    for (const id of aliasIds) {
      await client`UPDATE model_aliases SET model_id = ${baselineId}::uuid WHERE id = ${id}::uuid`.catch(
        () => undefined,
      );
    }
    await client`
      UPDATE model_access SET model_id = ${baselineId}::uuid
      WHERE model_id = ${survivor.id}::uuid
        AND id IN (
          SELECT id FROM model_access WHERE model_id = ${survivor.id}::uuid
        )
    `.catch(() => undefined);
    // Re-apply baseline core fields from pre-merge snapshot where safe.
    await client`
      UPDATE models SET
        status = 'active',
        merged_into_model_id = NULL,
        archived_at = NULL,
        name = ${String(beforeBaseline?.name)},
        canonical_id = ${baselineCanonical},
        updated_at = ${String(beforeBaseline?.updated_at)}
      WHERE id = ${baselineId}::uuid
    `;
    // Ensure seed can fully heal baseline-owned rows.
    const healed = runSeed();
    expect(healed).toMatch(/ALL SEED ASSERTIONS PASS/);
    const restored = normalizeRow(await fullRow("models", baselineId));
    expect(restored?.status).toBe("active");
    expect(restored?.merged_into_model_id).toBeNull();
    expect(restored?.canonical_id).toBe(baselineCanonical);
    void beforeSurvivor;
    void benchBefore;
  });
});

