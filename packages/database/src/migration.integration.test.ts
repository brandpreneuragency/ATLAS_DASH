/**
 * Migration ledger safety — temporary databases on the same Postgres instance.
 * Guaranteed cleanup of mm_mig_% databases.
 */
import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";

function adminUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
    return process.env.DATABASE_URL;
  }
  const user = process.env.POSTGRES_USER ?? "modelmonitor";
  const pass = process.env.POSTGRES_PASSWORD ?? user;
  const host = process.env.POSTGRES_HOST ?? "127.0.0.1";
  const port = process.env.POSTGRES_PORT ?? "5433";
  const database = process.env.POSTGRES_DB ?? "modelmonitor";
  return ["postgresql://", user, ":", pass, "@", host, ":", port, "/", database].join("");
}

function dbUrl(name: string): string {
  const base = new URL(adminUrl());
  base.pathname = `/${name}`;
  return base.toString();
}

const createdDbs: string[] = [];
const migrationsDir = join(import.meta.dirname, "..", "migrations");
const migrateScript = join(import.meta.dirname, "migrate.ts");
const execFileAsync = promisify(execFile);

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function runMigrate(databaseUrl: string, extraEnv: Record<string, string> = {}): string {
  return execFileSync("pnpm", ["exec", "tsx", migrateScript], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl, ...extraEnv },
  });
}

function runMigrateCatch(databaseUrl: string): { ok: boolean; out: string } {
  try {
    const out = runMigrate(databaseUrl);
    return { ok: true, out };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    return { ok: false, out };
  }
}

function runMigrateAsync(databaseUrl: string, barrier: number) {
  return execFileAsync("pnpm", ["exec", "tsx", migrateScript], {
    cwd: join(import.meta.dirname, ".."),
    env: { ...process.env, DATABASE_URL: databaseUrl, MM_MIGRATION_START_BARRIER: String(barrier) },
    encoding: "utf8",
  });
}

async function withAdmin<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(adminUrl(), { max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

async function createTempDb(suffix: string): Promise<string> {
  const name = `mm_mig_${suffix.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 24)}`;
  await withAdmin(async (sql) => {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${name}`);
    await sql.unsafe(`CREATE DATABASE ${name}`);
  });
  createdDbs.push(name);
  return name;
}

async function dropAllTempDbs(): Promise<void> {
  await withAdmin(async (sql) => {
    const rows = await sql<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname LIKE 'mm_mig_%'
    `;
    for (const row of rows) {
      await sql
        .unsafe(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${row.datname}' AND pid <> pg_backend_pid()`,
        )
        .catch(() => undefined);
      await sql.unsafe(`DROP DATABASE IF EXISTS ${row.datname}`).catch(() => undefined);
    }
    for (const name of createdDbs) {
      await sql.unsafe(`DROP DATABASE IF EXISTS ${name}`).catch(() => undefined);
    }
  });
  createdDbs.length = 0;
}

afterAll(async () => {
  await dropAllTempDbs();
});

describe("migration ledger safety", () => {
  it("serializes two fresh runners and applies each migration exactly once", async () => {
    const name = await createTempDb(`concurrent_${Date.now()}`);
    const url = dbUrl(name);
    const barrier = 740001;
    const controller = postgres(url, { max: 1 });
    try {
      await controller`SELECT pg_advisory_lock(${barrier})`;
      const first = runMigrateAsync(url, barrier);
      const second = runMigrateAsync(url, barrier);
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const rows = await controller<{ c: number }[]>`
          SELECT count(*)::int AS c FROM pg_locks
          WHERE locktype = 'advisory' AND objid = ${barrier} AND granted = false
        `;
        if (Number(rows[0]?.c ?? 0) >= 2) { ready = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(ready).toBe(true);
      await controller`SELECT pg_advisory_unlock(${barrier})`;
      await Promise.all([first, second]);
      const rows = await controller<{ filename: string }[]>`
        SELECT filename FROM schema_migrations ORDER BY filename
      `;
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
      expect(rows.map((row) => row.filename)).toEqual(files);
      const [schema] = await controller<{ c: number }[]>`
        SELECT count(*)::int AS c FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'models'
      `;
      expect(Number(schema.c)).toBe(1);
      expect(runMigrate(url)).toMatch(/All migrations already applied/);
    } finally {
      await controller`SELECT pg_advisory_unlock_all()`.catch(() => undefined);
      await controller.end({ timeout: 1 }).catch(() => undefined);
    }
  });

  it("fresh DB applies all migrations and second run is no-op", async () => {
    const name = await createTempDb(`fresh_${Date.now()}`);
    const url = dbUrl(name);
    const first = runMigrate(url);
    expect(first).toMatch(/Applied \d+ migration/);
    const second = runMigrate(url);
    expect(second).toMatch(/All migrations already applied/);

    const sql = postgres(url, { max: 1 });
    try {
      const rows = await sql<{ filename: string; checksum: string }[]>`
        SELECT filename, checksum FROM schema_migrations ORDER BY filename
      `;
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
      expect(rows.map((r) => r.filename)).toEqual(files);
      for (const row of rows) {
        const disk = checksum(readFileSync(join(migrationsDir, row.filename), "utf8"));
        expect(row.checksum).toBe(disk);
      }
      const [seedCol] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='model_benchmark_results' AND column_name='seed_key'
        ) AS exists
      `;
      expect(seedCol.exists).toBe(true);
    } finally {
      await sql.end({ timeout: 1 });
    }
  });

  it("complete pre-ledger schema fails closed with zero ledger rows", async () => {
    const name = await createTempDb(`complete_${Date.now()}`);
    const url = dbUrl(name);
    const sql = postgres(url, { max: 1 });
    try {
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
      for (const file of files) {
        await sql.unsafe(readFileSync(join(migrationsDir, file), "utf8"));
      }
      await sql.unsafe(`DROP TABLE IF EXISTS schema_migrations`);
    } finally {
      await sql.end({ timeout: 1 });
    }

    const { ok, out } = runMigrateCatch(url);
    expect(ok).toBe(false);
    expect(out).toMatch(/ledger is empty|application schema objects|Refusing/i);

    // Recreate ledger check: ensureLedger may create empty table, but must insert zero rows.
    const check = postgres(url, { max: 1 });
    try {
      const [exists] = await check<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='schema_migrations'
        ) AS exists
      `;
      if (exists.exists) {
        const rows = await check`SELECT filename FROM schema_migrations`;
        expect(rows.length).toBe(0);
      }
    } finally {
      await check.end({ timeout: 1 });
    }
  });

  it("partial pre-ledger schema fails closed with zero ledger rows", async () => {
    const name = await createTempDb(`partial_${Date.now()}`);
    const url = dbUrl(name);
    const sql = postgres(url, { max: 1 });
    try {
      for (const file of ["0000_initial.sql", "0001_subscriptions_models.sql"]) {
        await sql.unsafe(readFileSync(join(migrationsDir, file), "utf8"));
      }
      await sql.unsafe(`DROP TABLE IF EXISTS schema_migrations`);
    } finally {
      await sql.end({ timeout: 1 });
    }

    const { ok, out } = runMigrateCatch(url);
    expect(ok).toBe(false);
    expect(out).toMatch(/ledger is empty|application schema objects|Refusing/i);

    const check = postgres(url, { max: 1 });
    try {
      const [exists] = await check<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='schema_migrations'
        ) AS exists
      `;
      if (exists.exists) {
        const rows = await check`SELECT filename FROM schema_migrations`;
        expect(rows.length).toBe(0);
      }
    } finally {
      await check.end({ timeout: 1 });
    }
  });

  it("malformed pre-ledger schema fails closed with zero ledger rows", async () => {
    const name = await createTempDb(`malformed_${Date.now()}`);
    const url = dbUrl(name);
    const sql = postgres(url, { max: 1 });
    try {
      await sql.unsafe(`CREATE TYPE record_status AS ENUM ('active', 'archived')`);
      await sql.unsafe(`CREATE TABLE users (id uuid PRIMARY KEY, email text)`);
      // Missing most columns/constraints — still application schema.
    } finally {
      await sql.end({ timeout: 1 });
    }

    const { ok, out } = runMigrateCatch(url);
    expect(ok).toBe(false);
    expect(out).toMatch(/ledger is empty|application schema objects|Refusing/i);

    const check = postgres(url, { max: 1 });
    try {
      const [exists] = await check<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='schema_migrations'
        ) AS exists
      `;
      if (exists.exists) {
        const rows = await check`SELECT filename FROM schema_migrations`;
        expect(rows.length).toBe(0);
      }
    } finally {
      await check.end({ timeout: 1 });
    }
  });

  it("fails clearly on checksum drift for applied migrations", async () => {
    const name = await createTempDb(`drift_${Date.now()}`);
    const url = dbUrl(name);
    runMigrate(url);
    const sql = postgres(url, { max: 1 });
    try {
      const bad = "0".repeat(64);
      await sql`
        UPDATE schema_migrations
        SET checksum = ${bad}
        WHERE filename = '0000_initial.sql'
      `;
    } finally {
      await sql.end({ timeout: 1 });
    }

    const { ok, out } = runMigrateCatch(url);
    expect(ok).toBe(false);
    expect(out).toMatch(/checksum mismatch|Migration failed/i);
  });

  it("fails on unknown ledger filename not present on disk", async () => {
    const name = await createTempDb(`unknown_ledger_${Date.now()}`);
    const url = dbUrl(name);
    runMigrate(url);
    const sql = postgres(url, { max: 1 });
    try {
      await sql`
        INSERT INTO schema_migrations (filename, checksum)
        VALUES ('9998_not_on_disk.sql', ${"a".repeat(64)})
      `;
    } finally {
      await sql.end({ timeout: 1 });
    }
    const { ok, out } = runMigrateCatch(url);
    expect(ok).toBe(false);
    expect(out).toMatch(/unknown file|not present on disk|Migration failed/i);
  });

  it("applies a temporary unknown future migration file normally (never silent baseline)", async () => {
    const name = await createTempDb(`future_${Date.now()}`);
    const url = dbUrl(name);
    runMigrate(url);

    const futureFile = "9999_temp_future_probe.sql";
    const futurePath = join(migrationsDir, futureFile);
    try {
      writeFileSync(
        futurePath,
        `-- temporary future migration for test
CREATE TABLE IF NOT EXISTS mm_temp_future_probe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note text NOT NULL DEFAULT 'ok'
);
`,
        "utf8",
      );

      const out = runMigrate(url);
      expect(out).toMatch(/applying 9999_temp_future_probe\.sql/);
      expect(out).toMatch(/Applied 1 migration/);
      expect(out).not.toMatch(/baselined 9999/);

      const check = postgres(url, { max: 1 });
      try {
        const rows = await check<{ filename: string }[]>`
          SELECT filename FROM schema_migrations WHERE filename = ${futureFile}
        `;
        expect(rows.length).toBe(1);
        const [table] = await check<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='mm_temp_future_probe'
          ) AS exists
        `;
        expect(table.exists).toBe(true);
      } finally {
        await check.end({ timeout: 1 });
      }
    } finally {
      if (existsSync(futurePath)) unlinkSync(futurePath);
    }
  });
});
