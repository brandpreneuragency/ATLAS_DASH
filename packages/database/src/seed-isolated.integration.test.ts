import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";
import { mergeModels, type Db } from "./services/models";

function baseUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://modelmonitor:modelmonitor@127.0.0.1:5433/modelmonitor";
}

function databaseUrl(name: string): string {
  const url = new URL(baseUrl());
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTempDatabase<T>(prefix: string, fn: (url: string, sql: postgres.Sql) => Promise<T>): Promise<T> {
  const name = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`.replace(/[^a-zA-Z0-9_]/g, "_");
  const adminUrl = new URL(baseUrl());
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  const url = databaseUrl(name);
  const sql = postgres(url, { max: 2 });
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    const env = { ...process.env, DATABASE_URL: url };
    execFileSync("pnpm", ["exec", "tsx", "src/migrate.ts"], { cwd: join(import.meta.dirname, ".."), env, stdio: "pipe" });
    execFileSync("pnpm", ["exec", "tsx", "src/seed.ts"], { cwd: join(import.meta.dirname, ".."), env, stdio: "pipe" });
    return await fn(url, sql);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
    await admin.unsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}' AND pid <> pg_backend_pid()`);
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`).catch(() => undefined);
    await admin.end({ timeout: 2 }).catch(() => undefined);
  }
}

function canonicalJson(rows: Iterable<unknown>): string {
  return JSON.stringify([...rows], (_key: string, value: unknown): unknown => (value instanceof Date ? value.toISOString() : value)) ?? "";
}

async function stateSnapshot(sql: postgres.Sql, sourceId: string, targetId: string): Promise<Record<string, string>> {
  const ids = [sourceId, targetId];
  const out: Record<string, string> = {};
  out.models = canonicalJson(await sql`SELECT * FROM models WHERE id = ANY(${sql.array(ids)}::uuid[]) ORDER BY id`);
  out.aliases = canonicalJson(await sql`SELECT * FROM model_aliases WHERE model_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY id`);
  out.capabilities = canonicalJson(await sql`SELECT * FROM model_capabilities WHERE model_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY model_id`);
  out.access = canonicalJson(await sql`SELECT * FROM model_access WHERE model_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY id`);
  out.scores = canonicalJson(await sql`SELECT * FROM model_scores WHERE model_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY id`);
  out.benchmarks = canonicalJson(await sql`SELECT * FROM model_benchmark_results WHERE model_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY id`);
  out.sources = canonicalJson(await sql`SELECT * FROM sources WHERE (entity_type = 'model' AND entity_id = ANY(${sql.array(ids)}::uuid[])) OR (entity_type = 'model_access' AND entity_id IN (SELECT id FROM model_access WHERE model_id = ANY(${sql.array(ids)}::uuid[])) ) ORDER BY id`);
  out.provenance = canonicalJson(await sql`SELECT * FROM import_provenance WHERE (entity_type = 'model' AND entity_id = ANY(${sql.array(ids)}::uuid[])) OR (entity_type = 'model_access' AND entity_id IN (SELECT id FROM model_access WHERE model_id = ANY(${sql.array(ids)}::uuid[])) ) ORDER BY id`);
  out.usage = canonicalJson(await sql`SELECT * FROM usage_snapshots WHERE model_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY id`);
  out.pricing = canonicalJson(await sql`SELECT p.* FROM model_access_pricing p JOIN model_access a ON a.id = p.model_access_id WHERE a.model_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY p.id`);
  return out;
}

function expectSameState(before: Record<string, string>, after: Record<string, string>) {
  expect(after).toEqual(before);
}

describe("isolated seed destructive regressions", () => {
  it("rolls back observable model, plan cost, benchmark, and usage rewrites in a temporary database", async () => {
    await withTempDatabase("mm_seed_rollback", async (url, sql) => {
      const [model] = await sql<{ id: string }[]>`SELECT id FROM models WHERE canonical_id = 'alibaba/qwen3.6-plus'`;
      const [sub] = await sql<{ id: string; plan_id: string }[]>`SELECT id, plan_id FROM subscriptions ORDER BY id LIMIT 1`;
      const [bench] = await sql<{ id: string }[]>`SELECT id FROM model_benchmark_results WHERE seed_key LIKE 'mm-baseline:bench:%' ORDER BY seed_key LIMIT 1`;
      const [usage] = await sql<{ id: string }[]>`SELECT id FROM usage_snapshots WHERE seed_key LIKE 'mm-baseline:usage:%' ORDER BY seed_key LIMIT 1`;
      await sql`UPDATE models SET name = 'CORRUPTED MODEL', description = 'corrupted' WHERE id = ${model.id}::uuid`;
      await sql`UPDATE plans SET regular_price = regular_price + 17 WHERE id = ${sub.plan_id}::uuid`;
      await sql`UPDATE model_benchmark_results SET score = 1, score_text = '1' WHERE id = ${bench.id}::uuid`;
      await sql`UPDATE usage_snapshots SET used_percent = 99, raw_payload = '{"corrupted":true}'::jsonb WHERE id = ${usage.id}::uuid`;
      const before = {
        model: canonicalJson(await sql`SELECT * FROM models WHERE id = ${model.id}::uuid`),
        plan: canonicalJson(await sql`SELECT * FROM plans WHERE id = ${sub.plan_id}::uuid`),
        benchmark: canonicalJson(await sql`SELECT * FROM model_benchmark_results WHERE id = ${bench.id}::uuid`),
        usage: canonicalJson(await sql`SELECT * FROM usage_snapshots WHERE id = ${usage.id}::uuid`),
      };
      expect(() => execFileSync("pnpm", ["exec", "tsx", "src/seed.ts"], {
        cwd: join(import.meta.dirname, ".."),
        env: { ...process.env, DATABASE_URL: url, MM_SEED_EXPECT_MODELS: "999" },
        stdio: "pipe",
      })).toThrow();
      const after = {
        model: canonicalJson(await sql`SELECT * FROM models WHERE id = ${model.id}::uuid`),
        plan: canonicalJson(await sql`SELECT * FROM plans WHERE id = ${sub.plan_id}::uuid`),
        benchmark: canonicalJson(await sql`SELECT * FROM model_benchmark_results WHERE id = ${bench.id}::uuid`),
        usage: canonicalJson(await sql`SELECT * FROM usage_snapshots WHERE id = ${usage.id}::uuid`),
      };
      expectSameState(before, after);
    });
  });

  it("preserves every moved relationship when isolated seed rejects an explicit baseline tombstone", async () => {
    await withTempDatabase("mm_seed_tombstone", async (url, sql) => {
      const isolatedDb = drizzle(sql, { schema }) as Db;
      const [baseline] = await sql<{ id: string; canonical_id: string }[]>`SELECT id, canonical_id FROM models WHERE canonical_id = 'alibaba/qwen3.6-plus'`;
      const [developer] = await sql<{ id: string }[]>`SELECT id FROM developers ORDER BY id LIMIT 1`;
      const [target] = await sql<{ id: string }[]>`
        INSERT INTO models (developer_id, canonical_id, name, slug, lifecycle, status)
        VALUES (${developer.id}::uuid, 'mmtest:isolated-target', 'Isolated target', 'isolated-target', 'unknown', 'active') RETURNING id
      `;
      await mergeModels(isolatedDb, { sourceModelId: baseline.id, targetModelId: target.id }, { requestId: "mmtest:isolated-tombstone" });
      const before = await stateSnapshot(sql, baseline.id, target.id);
      expect(() => execFileSync("pnpm", ["exec", "tsx", "src/seed.ts"], {
        cwd: join(import.meta.dirname, ".."),
        env: { ...process.env, DATABASE_URL: url, MM_SEED_EXPECT_MODELS: "51" },
        stdio: "pipe",
      })).toThrow(new RegExp(`baseline canonical ID ${baseline.canonical_id} is a merged tombstone`));
      const after = await stateSnapshot(sql, baseline.id, target.id);
      expectSameState(before, after);
    });
  });
});
