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

const sql = postgres(resolveDatabaseUrl(), { max: 1 });
try {
  const checks: Array<{ label: string; c: number }> = [];

  const [models] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM models
    WHERE canonical_id LIKE 'mmtest:%' OR canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "models", c: Number(models.c) });

  const [aliases] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM model_aliases ma
    JOIN models m ON m.id = ma.model_id
    WHERE m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "aliases", c: Number(aliases.c) });

  const [caps] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM model_capabilities mc
    JOIN models m ON m.id = mc.model_id
    WHERE m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "capabilities", c: Number(caps.c) });

  const [access] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM model_access ma
    JOIN models m ON m.id = ma.model_id
    WHERE m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "access", c: Number(access.c) });

  const [pricing] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM model_access_pricing p
    JOIN model_access ma ON ma.id = p.model_access_id
    JOIN models m ON m.id = ma.model_id
    WHERE m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "pricing", c: Number(pricing.c) });

  const [scores] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM model_scores ms
    LEFT JOIN models m ON m.id = ms.model_id
    LEFT JOIN score_methodologies sm ON sm.id = ms.methodology_id
    WHERE m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
       OR sm.name LIKE 'mmtest:%' OR sm.name LIKE 'mme2e:%'
  `;
  checks.push({ label: "scores", c: Number(scores.c) });

  const [keys] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM idempotency_keys
    WHERE key LIKE 'mmtest:%' OR key LIKE 'mme2e:%'
  `;
  checks.push({ label: "idempotency_keys", c: Number(keys.c) });

  const [meth] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM score_methodologies
    WHERE name LIKE 'mmtest:%' OR name LIKE 'mme2e:%'
  `;
  checks.push({ label: "score_methodologies", c: Number(meth.c) });

  const [jobs] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM import_jobs
    WHERE filename LIKE 'mmtest:%' OR filename LIKE 'mme2e:%'
  `;
  checks.push({ label: "import_jobs", c: Number(jobs.c) });

  const [conflicts] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM import_conflicts ic
    JOIN import_jobs j ON j.id = ic.import_job_id
    WHERE j.filename LIKE 'mmtest:%' OR j.filename LIKE 'mme2e:%'
  `;
  checks.push({ label: "import_conflicts", c: Number(conflicts.c) });

  const [prov] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM import_provenance ip
    LEFT JOIN import_jobs j ON j.id = ip.import_job_id
    LEFT JOIN models m ON m.id = ip.entity_id
    LEFT JOIN model_access ma ON ip.entity_type = 'model_access' AND ma.id = ip.entity_id
    WHERE j.filename LIKE 'mmtest:%' OR j.filename LIKE 'mme2e:%'
       OR m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
       OR EXISTS (SELECT 1 FROM models mx WHERE mx.id = ma.model_id AND (mx.canonical_id LIKE 'mmtest:%' OR mx.canonical_id LIKE 'mme2e:%'))
  `;
  checks.push({ label: "import_provenance", c: Number(prov.c) });

  const [benchDefs] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM benchmarks
    WHERE name LIKE 'mmtest:%' OR name LIKE 'mme2e:%'
  `;
  checks.push({ label: "benchmarks", c: Number(benchDefs.c) });

  const [benchProbes] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM model_benchmark_results
    LEFT JOIN models m ON m.id = model_benchmark_results.model_id
    WHERE notes LIKE 'mmtest:%' OR notes LIKE 'mme2e:%'
       OR setting LIKE 'mmtest:%' OR setting LIKE 'mme2e:%'
       OR m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "benchmark_probes", c: Number(benchProbes.c) });

  const [sources] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM sources s
    LEFT JOIN models m ON s.entity_type = 'model' AND m.id = s.entity_id
    LEFT JOIN model_access ma ON s.entity_type = 'model_access' AND ma.id = s.entity_id
    LEFT JOIN model_benchmark_results br ON s.entity_type = 'model_benchmark_result' AND br.id = s.entity_id
    WHERE title LIKE 'mmtest:%' OR title LIKE 'mme2e:%'
       OR m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
       OR EXISTS (SELECT 1 FROM models mx WHERE mx.id = ma.model_id AND (mx.canonical_id LIKE 'mmtest:%' OR mx.canonical_id LIKE 'mme2e:%'))
       OR EXISTS (SELECT 1 FROM models mx WHERE mx.id = br.model_id AND (mx.canonical_id LIKE 'mmtest:%' OR mx.canonical_id LIKE 'mme2e:%'))
  `;
  checks.push({ label: "sources", c: Number(sources.c) });

  const [usageProbes] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM usage_snapshots
    LEFT JOIN models m ON m.id = usage_snapshots.model_id
    WHERE period_label LIKE 'mmtest:%' OR period_label LIKE 'mme2e:%'
       OR m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "usage_probes", c: Number(usageProbes.c) });

  const [audit] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM audit_events ae
    JOIN models m ON m.id = ae.entity_id
    WHERE m.canonical_id LIKE 'mmtest:%' OR m.canonical_id LIKE 'mme2e:%'
  `;
  checks.push({ label: "audit_rows", c: Number(audit.c) });

  const [fn] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fail_test_alias_audit', 'fail_test_merge_midway')
  `;
  checks.push({ label: "test_functions", c: Number(fn.c) });

  const [triggers] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal
      AND c.relnamespace = 'public'::regnamespace
      AND t.tgname IN ('trg_fail_alias_audit', 'trg_fail_merge_midway')
  `;
  checks.push({ label: "test_triggers", c: Number(triggers.c) });

  const [tempDbs] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c FROM pg_database WHERE datname LIKE 'mm_mig_%'
  `;
  checks.push({ label: "mm_mig_databases", c: Number(tempDbs.c) });

  const [orphanedTestRelationships] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c FROM (
      SELECT s.id FROM sources s
      LEFT JOIN models m ON s.entity_type = 'model' AND m.id = s.entity_id
      LEFT JOIN model_access a ON s.entity_type = 'model_access' AND a.id = s.entity_id
      LEFT JOIN model_benchmark_results b ON s.entity_type = 'model_benchmark_result' AND b.id = s.entity_id
      WHERE (s.title LIKE 'mmtest:%' OR s.title LIKE 'mme2e:%')
        AND ((s.entity_type = 'model' AND m.id IS NULL)
          OR (s.entity_type = 'model_access' AND a.id IS NULL)
          OR (s.entity_type = 'model_benchmark_result' AND b.id IS NULL))
      UNION ALL
      SELECT ip.id FROM import_provenance ip
      JOIN import_jobs j ON j.id = ip.import_job_id
      WHERE (j.filename LIKE 'mmtest:%' OR j.filename LIKE 'mme2e:%')
        AND NOT EXISTS (
          SELECT 1 FROM models m WHERE ip.entity_type = 'model' AND m.id = ip.entity_id
          UNION ALL
          SELECT 1 FROM model_access a WHERE ip.entity_type = 'model_access' AND a.id = ip.entity_id
        )
    ) orphaned
  `;
  checks.push({ label: "orphaned_test_relationships", c: Number(orphanedTestRelationships.c) });

  const leaked = checks.filter((c) => c.c !== 0);
  if (leaked.length > 0) {
    console.error(
      "leftover fixtures: " + leaked.map((l) => `${l.label}=${l.c}`).join(" "),
    );
    process.exit(1);
  }
  console.log("zero test fixtures ok");
} finally {
  await sql.end({ timeout: 1 }).catch(() => undefined);
}
