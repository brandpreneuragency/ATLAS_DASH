import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL ?? "postgresql://modelmonitor:modelmonitor@localhost:5433/modelmonitor";

async function main() {
  const sql = postgres(url, { max: 1 });
  const migrationsDir = join(import.meta.dirname, "..", "migrations");
  const files = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

  console.log(`Running ${files.length} migration files...`);

  for (const file of files) {
    const content = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`  → ${file}`);
    await sql.unsafe(content);
  }

  console.log("✓ All migrations applied successfully");
  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
