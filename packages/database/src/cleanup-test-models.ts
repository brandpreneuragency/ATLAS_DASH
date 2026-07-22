import postgres from "postgres";

function resolveDatabaseUrl(): string {
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

/**
 * Reserved automated-fixture namespaces only:
 * - mmtest:  integration / unit DB fixtures
 * - mme2e:   Playwright E2E fixtures
 *
 * Never delete generic test-/e2e-/user: rows or production UI keys (mm:merge:*).
 */
const MODEL_NS = ["mmtest:%", "mme2e:%"] as const;
const KEY_NS = ["mmtest:%", "mme2e:%"] as const;
const METH_NS = ["mmtest:%", "mme2e:%"] as const;
const JOB_NS = ["mmtest:%", "mme2e:%"] as const;
const BENCH_NS = ["mmtest:%", "mme2e:%"] as const;
const TITLE_NS = ["mmtest:%", "mme2e:%"] as const;
const PERIOD_NS = ["mmtest:%", "mme2e:%"] as const;
const SETTING_NS = ["mmtest:%", "mme2e:%"] as const;

export async function cleanupTestModels(connectionString?: string): Promise<{
  removedModels: number;
  activeModels: number;
  removedIdempotencyKeys: number;
  removedMethodologies: number;
  removedImportJobs: number;
  removedBenchmarks: number;
  droppedTempDbs: number;
}> {
  const sql = postgres(connectionString ?? resolveDatabaseUrl(), { max: 1 });
  try {
    const result = await sql.begin(async (tx) => {
      await tx`
        UPDATE models AS m
        SET merged_into_model_id = null
        WHERE (m.canonical_id LIKE ${MODEL_NS[0]} OR m.canonical_id LIKE ${MODEL_NS[1]})
          AND m.merged_into_model_id IN (
            SELECT id FROM models
            WHERE canonical_id LIKE ${MODEL_NS[0]}
               OR canonical_id LIKE ${MODEL_NS[1]}
          )
      `;

      await tx`
        DELETE FROM audit_events
        WHERE entity_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
      `;
      await tx`
        DELETE FROM model_aliases
        WHERE model_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
      `;
      await tx`
        DELETE FROM model_capabilities
        WHERE model_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
      `;
      await tx`
        DELETE FROM sources
        WHERE entity_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
           OR entity_id IN (
          SELECT ma.id FROM model_access ma
          JOIN models m ON m.id = ma.model_id
          WHERE m.canonical_id LIKE ${MODEL_NS[0]} OR m.canonical_id LIKE ${MODEL_NS[1]}
        )
           OR entity_id IN (
          SELECT r.id FROM model_benchmark_results r
          JOIN models m ON m.id = r.model_id
          WHERE m.canonical_id LIKE ${MODEL_NS[0]} OR m.canonical_id LIKE ${MODEL_NS[1]}
        )
           OR title LIKE ${TITLE_NS[0]}
           OR title LIKE ${TITLE_NS[1]}
      `;
      await tx`
        DELETE FROM import_provenance
        WHERE entity_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
           OR entity_id IN (
          SELECT ma.id FROM model_access ma
          JOIN models m ON m.id = ma.model_id
          WHERE m.canonical_id LIKE ${MODEL_NS[0]} OR m.canonical_id LIKE ${MODEL_NS[1]}
        )
           OR import_job_id IN (
             SELECT id FROM import_jobs
             WHERE filename LIKE ${JOB_NS[0]} OR filename LIKE ${JOB_NS[1]}
           )
      `;
      await tx`
        DELETE FROM import_conflicts
        WHERE import_job_id IN (
          SELECT id FROM import_jobs
          WHERE filename LIKE ${JOB_NS[0]} OR filename LIKE ${JOB_NS[1]}
        )
      `;
      const deletedJobs = await tx`
        DELETE FROM import_jobs
        WHERE filename LIKE ${JOB_NS[0]} OR filename LIKE ${JOB_NS[1]}
        RETURNING id
      `;
      await tx`
        DELETE FROM model_access_pricing
        WHERE model_access_id IN (
          SELECT ma.id FROM model_access ma
          JOIN models m ON m.id = ma.model_id
          WHERE m.canonical_id LIKE ${MODEL_NS[0]} OR m.canonical_id LIKE ${MODEL_NS[1]}
        )
      `;
      await tx`
        DELETE FROM model_access
        WHERE model_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
      `;
      await tx`
        DELETE FROM model_scores
        WHERE model_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
           OR methodology_id IN (
          SELECT id FROM score_methodologies
          WHERE name LIKE ${METH_NS[0]} OR name LIKE ${METH_NS[1]}
        )
      `;
      await tx`
        DELETE FROM model_benchmark_results
        WHERE model_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
           OR notes LIKE ${SETTING_NS[0]}
           OR notes LIKE ${SETTING_NS[1]}
           OR setting LIKE ${SETTING_NS[0]}
           OR setting LIKE ${SETTING_NS[1]}
      `;
      const deletedBenchmarks = await tx`
        DELETE FROM benchmarks
        WHERE name LIKE ${BENCH_NS[0]} OR name LIKE ${BENCH_NS[1]}
        RETURNING id
      `;
      await tx`
        DELETE FROM usage_snapshots
        WHERE model_id IN (
          SELECT id FROM models
          WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        )
           OR period_label LIKE ${PERIOD_NS[0]}
           OR period_label LIKE ${PERIOD_NS[1]}
      `;

      // Only reserved fixture key namespaces. Never mm:merge:* production UI keys.
      const deletedKeys = await tx`
        DELETE FROM idempotency_keys
        WHERE key LIKE ${KEY_NS[0]} OR key LIKE ${KEY_NS[1]}
        RETURNING id
      `;

      const deletedMeth = await tx`
        DELETE FROM score_methodologies
        WHERE name LIKE ${METH_NS[0]} OR name LIKE ${METH_NS[1]}
        RETURNING id
      `;

      const deleted = await tx`
        DELETE FROM models
        WHERE canonical_id LIKE ${MODEL_NS[0]} OR canonical_id LIKE ${MODEL_NS[1]}
        RETURNING id
      `;

      await tx`
        UPDATE models
        SET merged_into_model_id = null
        WHERE merged_into_model_id IS NOT NULL
          AND merged_into_model_id NOT IN (SELECT id FROM models)
      `;

      await tx.unsafe(`
        DROP TRIGGER IF EXISTS trg_fail_alias_audit ON audit_events;
        DROP FUNCTION IF EXISTS fail_test_alias_audit();
        DROP TRIGGER IF EXISTS trg_fail_merge_midway ON models;
        DROP FUNCTION IF EXISTS fail_test_merge_midway();
      `);

      const [active] = await tx<{ c: number }[]>`
        SELECT count(*)::int AS c FROM models WHERE status = 'active'
      `;

      return {
        removedModels: deleted.length,
        activeModels: Number(active.c),
        removedIdempotencyKeys: deletedKeys.length,
        removedMethodologies: deletedMeth.length,
        removedImportJobs: deletedJobs.length,
        removedBenchmarks: deletedBenchmarks.length,
      };
    });

    let droppedTempDbs = 0;
    const admin = postgres(connectionString ?? resolveDatabaseUrl(), { max: 1 });
    try {
      const dbs = await admin<{ datname: string }[]>`
        SELECT datname FROM pg_database WHERE datname LIKE 'mm_mig_%'
      `;
      for (const row of dbs) {
        await admin
          .unsafe(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${row.datname}' AND pid <> pg_backend_pid()`,
          )
          .catch(() => undefined);
        await admin.unsafe(`DROP DATABASE IF EXISTS ${row.datname}`);
        droppedTempDbs += 1;
      }
    } finally {
      await admin.end({ timeout: 2 }).catch(() => undefined);
    }

    return { ...result, droppedTempDbs };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

async function main() {
  const result = await cleanupTestModels();
  console.log(
    `cleanup-test-models: removed=${result.removedModels} keys=${result.removedIdempotencyKeys} meth=${result.removedMethodologies} jobs=${result.removedImportJobs} benches=${result.removedBenchmarks} tempDbs=${result.droppedTempDbs} activeModels=${result.activeModels}`,
  );
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("cleanup-test-models.ts") ||
    process.argv[1].endsWith("cleanup-test-models.js"));

if (isDirect) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
