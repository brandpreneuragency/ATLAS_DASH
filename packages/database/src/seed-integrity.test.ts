import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgresql://modelmonitor:modelmonitor@localhost:5433/modelmonitor";
const sql = postgres(url, { max: 1 });

async function assertEqual(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ ${label}: ${actual}`);
}

async function main() {
  console.log("Running seed integrity tests...");

  const [counts] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM models WHERE status = 'active') as models,
      (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'active') as subscriptions,
      (SELECT COUNT(*)::int FROM model_access WHERE status = 'active') as model_access,
      (SELECT COUNT(*)::int FROM model_benchmark_results) as benchmarks,
      (SELECT COUNT(*)::int FROM model_capabilities) as capabilities,
      (SELECT COUNT(*)::int FROM usage_snapshots WHERE is_mock = true) as mock_usage
  `;

  const [cost] = await sql`
    SELECT COALESCE(SUM(p.regular_price), 0)::float8 as total
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.status = 'active'
  `;

  await assertEqual("canonical models", Number(counts.models), 51);
  await assertEqual("subscriptions", Number(counts.subscriptions), 4);
  await assertEqual("model access", Number(counts.model_access), 19);
  await assertEqual("benchmark rows", Number(counts.benchmarks), 276);
  await assertEqual("capabilities", Number(counts.capabilities), 51);
  await assertEqual("mock usage snapshots", Number(counts.mock_usage), 4);
  await assertEqual("regular monthly cost USD", Number(cost.total), 61);

  // No duplicate canonical IDs
  const [dupes] = await sql`
    SELECT COUNT(*)::int as c FROM (
      SELECT canonical_id FROM models GROUP BY canonical_id HAVING COUNT(*) > 1
    ) d
  `;
  await assertEqual("duplicate canonical IDs", Number(dupes.c), 0);

  // Access records must point at real models and plans
  const [orphans] = await sql`
    SELECT COUNT(*)::int as c
    FROM model_access ma
    LEFT JOIN models m ON m.id = ma.model_id
    LEFT JOIN plans p ON p.id = ma.plan_id
    WHERE m.id IS NULL OR p.id IS NULL
  `;
  await assertEqual("orphan access records", Number(orphans.c), 0);

  console.log("\n✓ ALL SEED INTEGRITY TESTS PASS");
  await sql.end();
}

main().catch(async (err) => {
  console.error("\n✗ SEED INTEGRITY TESTS FAILED");
  console.error(err);
  await sql.end({ timeout: 1 }).catch(() => undefined);
  process.exit(1);
});
