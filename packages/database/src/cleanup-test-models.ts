import postgres from "postgres";

const url =
  process.env.DATABASE_URL ?? "postgresql://modelmonitor:modelmonitor@127.0.0.1:5433/modelmonitor";
const sql = postgres(url, { max: 1 });

async function main() {
  await sql`update models set merged_into_model_id = null where canonical_id like 'test:%' or canonical_id like 'e2e:%'`;
  await sql`delete from audit_events where entity_id in (select id from models where canonical_id like 'test:%' or canonical_id like 'e2e:%')`;
  await sql`delete from model_aliases where model_id in (select id from models where canonical_id like 'test:%' or canonical_id like 'e2e:%')`;
  await sql`delete from model_capabilities where model_id in (select id from models where canonical_id like 'test:%' or canonical_id like 'e2e:%')`;
  await sql`delete from sources where entity_id in (select id from models where canonical_id like 'test:%' or canonical_id like 'e2e:%')`;
  await sql`delete from model_access where model_id in (select id from models where canonical_id like 'test:%' or canonical_id like 'e2e:%')`;
  await sql`delete from model_scores where model_id in (select id from models where canonical_id like 'test:%' or canonical_id like 'e2e:%')`;
  await sql`delete from model_benchmark_results where model_id in (select id from models where canonical_id like 'test:%' or canonical_id like 'e2e:%')`;
  await sql`delete from models where canonical_id like 'test:%' or canonical_id like 'e2e:%'`;
  const [c] = await sql`select count(*)::int as c from models where status='active'`;
  console.log("active models", c.c);
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end({ timeout: 1 }).catch(() => undefined);
  process.exit(1);
});
