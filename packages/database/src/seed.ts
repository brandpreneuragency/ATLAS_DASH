import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgresql://modelmonitor:modelmonitor@localhost:5433/modelmonitor";
const sql = postgres(url, { max: 1 });

const SEED_DIR = join(import.meta.dirname, "..", "..", "..", "docs", "implementation-package", "data");

interface CanonicalModelSeed {
  canonicalId: string;
  name: string;
  developer: string;
  family?: string | null;
  generation?: string | number | null;
  lifecycle?: string | null;
  releaseDate?: string | null;
  knowledgeCutoff?: string | null;
  modelType?: string | null;
  codingSpecialization?: string | null;
  bestUse?: string | null;
  avoidFor?: string | null;
  contextTokens?: number | null;
  maxOutputTokens?: number | null;
  speedRating?: string | null;
  verifiedTps?: number | string | null;
  needsRecheck?: boolean | null;
  verifiedOn?: string | null;
  visionSupport?: string | null;
  reasoningSupport?: string | null;
  toolSupport?: string | null;
}

interface SubscriptionSeed {
  id: string;
  accessProvider: string;
  plan: string;
  accountLabel: string;
  status?: string | null;
  nextBillingDate?: string | null;
  autoRenews?: boolean | null;
  currentPrice?: number | null;
  regularPrice?: number | null;
  introductoryPrice?: number | null;
  currency?: string | null;
  billingInterval?: string | null;
  apiAccessType?: string | null;
  authenticationType?: string | null;
  usageTrackingMode?: string | null;
  usageCheckInstructions?: string | null;
  notes?: string | null;
}

interface ModelAccessSeed {
  modelCanonicalId: string;
  subscriptionId: string;
  availability?: string | null;
  accessMethod?: string | null;
  includedInPlan?: boolean | null;
  cliOnly?: boolean | null;
  webOnly?: boolean | null;
  apiCompatible?: boolean | null;
}

interface AliasSeed {
  canonicalId: string;
  alias: string;
  type?: string | null;
}

interface BenchmarkSeed {
  Benchmark: string;
  Category?: string | null;
  "Version / Setting"?: string | null;
  "Comparable Group"?: string | null;
  Unit?: string | null;
  "Higher Better"?: string | boolean | null;
  Model: string;
  Score?: string | number | null;
  "Verified On"?: string | null;
  "Source URL"?: string | null;
  Notes?: string | null;
}

interface MockUsageSeed {
  subscriptionId: string;
  periodLabel?: string | null;
  usedPercent?: number | null;
  capturedAt?: string | null;
}


interface IdRow {
  id: string;
}

interface PlanIdRow {
  plan_id: string;
}

interface CountRow {
  models: string | number;
  subscriptions: string | number;
  model_access: string | number;
  benchmarks: string | number;
  developers: string | number;
  providers: string | number;
  aliases: string | number;
  capabilities: string | number;
}

interface TotalRow {
  total: string | number;
}

function loadSeed<T>(filename: string): T {
  const content = readFileSync(join(SEED_DIR, filename), "utf-8");
  return JSON.parse(content) as T;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  console.log("Seeding database...");

  // Load seed data
  const canonicalModels = loadSeed<CanonicalModelSeed[]>("canonical-models.seed.json");
  const subscriptionsSeed = loadSeed<SubscriptionSeed[]>("subscriptions.seed.json");
  const modelAccessSeed = loadSeed<ModelAccessSeed[]>("model-access.seed.json");
  const aliasesSeed = loadSeed<AliasSeed[]>("model-aliases.seed.json");
  const benchmarksSeed = loadSeed<BenchmarkSeed[]>("benchmarks.seed.json");
  const mockUsageSeed = loadSeed<MockUsageSeed[]>("mock-usage.seed.json");

  // 1. Create owner user
  const [user] = await sql<IdRow[]>`
    INSERT INTO users (email, display_name, role)
    VALUES ('owner@model-monitor.local', 'Owner', 'owner')
    ON CONFLICT (email) DO UPDATE SET updated_at = now()
    RETURNING id
  `;
  if (!user) throw new Error("Failed to upsert owner user");
  const userId = user.id;
  console.log(`  ✓ User: ${userId}`);

  // 2. Create developers from canonical models
  const developerNames = Array.from(new Set(canonicalModels.map((m: { developer: string }) => m.developer)));
  const devMap = new Map<string, string>();
  for (const name of developerNames) {
    const slug = slugify(name);
    const [dev] = await sql<IdRow[]>`
      INSERT INTO developers (name, slug)
      VALUES (${name}, ${slug})
      ON CONFLICT (slug) DO UPDATE SET updated_at = now()
      RETURNING id
    `;
    if (!dev) throw new Error(`Failed to upsert developer: ${name}`);
    devMap.set(name, dev.id);
  }
  console.log(`  ✓ Developers: ${devMap.size}`);

  // 3. Create access providers from subscriptions
  const providerMap = new Map<string, string>();
  for (const sub of subscriptionsSeed) {
    const name = sub.accessProvider;
    const slug = slugify(name);
    const [prov] = await sql<IdRow[]>`
      INSERT INTO access_providers (name, slug)
      VALUES (${name}, ${slug})
      ON CONFLICT (slug) DO UPDATE SET updated_at = now()
      RETURNING id
    `;
    if (!prov) throw new Error(`Failed to upsert access provider: ${name}`);
    providerMap.set(name, prov.id);
  }
  console.log(`  ✓ Access providers: ${providerMap.size}`);

  // 4. Create plans from subscriptions
  const planMap = new Map<string, string>();
  for (const sub of subscriptionsSeed) {
    const providerId = providerMap.get(sub.accessProvider)!;
    const slug = slugify(sub.plan);
    const [plan] = await sql<IdRow[]>`
      INSERT INTO plans (access_provider_id, name, slug, regular_price, introductory_price, currency, billing_interval, api_access_type, authentication_type)
      VALUES (${providerId}, ${sub.plan}, ${slug}, ${sub.regularPrice ?? null}, ${sub.introductoryPrice ?? null}, ${sub.currency ?? 'USD'}, ${sub.billingInterval ?? 'monthly'}, ${sub.apiAccessType ?? 'unknown'}, ${sub.authenticationType ?? 'other'})
      ON CONFLICT (access_provider_id, slug) DO UPDATE SET updated_at = now()
      RETURNING id
    `;
    if (!plan) throw new Error(`Failed to upsert plan for subscription seed: ${sub.id}`);
    planMap.set(sub.id, plan.id);
  }
  console.log(`  ✓ Plans: ${planMap.size}`);

  // 5. Create subscriptions
  for (const sub of subscriptionsSeed) {
    const planId = planMap.get(sub.id)!;
    await sql`
      INSERT INTO subscriptions (owner_user_id, plan_id, external_seed_id, account_label, status, next_billing_date, auto_renews, actual_price, currency, billing_interval, usage_tracking_mode, usage_check_instructions, notes)
      VALUES (${userId}, ${planId}, ${sub.id}, ${sub.accountLabel}, ${sub.status ?? 'active'}, ${sub.nextBillingDate ?? null}, ${sub.autoRenews ?? null}, ${sub.currentPrice ?? null}, ${sub.currency ?? 'USD'}, ${sub.billingInterval ?? 'monthly'}, ${sub.usageTrackingMode ?? 'manual'}, ${sub.usageCheckInstructions ?? null}, ${sub.notes ?? null})
      ON CONFLICT (external_seed_id) DO UPDATE SET updated_at = now()
    `;
  }
  console.log(`  ✓ Subscriptions: ${subscriptionsSeed.length}`);

  // 6. Create canonical models
  const modelMap = new Map<string, string>(); // canonicalId -> uuid
  const modelByName = new Map<string, string>(); // name -> uuid
  for (const m of canonicalModels) {
    const devId = devMap.get(m.developer)!;
    const slug = slugify(m.name);
    const [model] = await sql<IdRow[]>`
      INSERT INTO models (developer_id, canonical_id, name, slug, family, generation, lifecycle, lifecycle_raw, release_date, knowledge_cutoff, model_type, coding_specialization, best_use, avoid_for, context_tokens, max_output_tokens, speed_rating, verified_tps, needs_recheck, verified_at)
      VALUES (${devId}, ${m.canonicalId}, ${m.name}, ${slug}, ${m.family ?? null}, ${m.generation?.toString() ?? null}, 'unknown', ${m.lifecycle ?? null}, ${m.releaseDate ?? null}, ${m.knowledgeCutoff ?? null}, ${m.modelType ?? null}, ${m.codingSpecialization ?? null}, ${m.bestUse ?? null}, ${m.avoidFor ?? null}, ${m.contextTokens ?? null}, ${m.maxOutputTokens ?? null}, ${m.speedRating ?? null}, ${m.verifiedTps ?? null}, ${m.needsRecheck ?? true}, ${m.verifiedOn ?? null})
      ON CONFLICT (canonical_id) DO UPDATE SET updated_at = now()
      RETURNING id
    `;
    if (!model) throw new Error(`Failed to upsert model: ${m.canonicalId}`);
    modelMap.set(m.canonicalId, model.id);
    modelByName.set(m.name, model.id);
  }
  console.log(`  ✓ Canonical models: ${modelMap.size}`);

  // 7. Create model capabilities
  for (const m of canonicalModels) {
    const modelId = modelMap.get(m.canonicalId)!;
    const vision = m.visionSupport ? m.visionSupport.toLowerCase().startsWith("yes") : null;
    const reasoning = m.reasoningSupport ? m.reasoningSupport.toLowerCase().startsWith("yes") : null;
    const toolUse = m.toolSupport ? m.toolSupport.toLowerCase().startsWith("yes") : null;
    await sql`
      INSERT INTO model_capabilities (model_id, vision, reasoning, tool_use)
      VALUES (${modelId}, ${vision}, ${reasoning}, ${toolUse})
      ON CONFLICT (model_id) DO UPDATE SET updated_at = now()
    `;
  }
  console.log(`  ✓ Model capabilities: ${canonicalModels.length}`);

  // 8. Create model aliases
  for (const a of aliasesSeed) {
    const modelId = modelMap.get(a.canonicalId);
    if (!modelId) continue;
    const normalized = slugify(a.alias);
    await sql`
      INSERT INTO model_aliases (model_id, alias, normalized_alias, alias_type)
      VALUES (${modelId}, ${a.alias}, ${normalized}, ${a.type ?? 'display_name'})
      ON CONFLICT (normalized_alias) DO NOTHING
    `;
  }
  console.log(`  ✓ Aliases: ${aliasesSeed.length}`);

  // 9. Create model access records
  for (const acc of modelAccessSeed) {
    const modelId = modelMap.get(acc.modelCanonicalId);
    if (!modelId) continue;
    // Find plan via subscription's external_seed_id
    const [sub] = await sql<PlanIdRow[]>`SELECT plan_id FROM subscriptions WHERE external_seed_id = ${acc.subscriptionId}`;
    if (!sub) continue;
    await sql`
      INSERT INTO model_access (model_id, plan_id, availability, access_method, included_in_plan, cli_only, web_only, api_compatible)
      VALUES (${modelId}, ${sub.plan_id}, ${acc.availability ?? 'unconfirmed'}, ${acc.accessMethod ?? 'other'}, ${acc.includedInPlan ?? null}, ${acc.cliOnly ?? false}, ${acc.webOnly ?? false}, ${acc.apiCompatible ?? null})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  ✓ Model access records: ${modelAccessSeed.length}`);

  // 10. Create benchmarks and benchmark results
  const benchMap = new Map<string, string>();
  const unmatchedBenchModels = new Set<string>();
  let benchRowsInserted = 0;
  for (const b of benchmarksSeed) {
    const benchKey = `${b.Benchmark}|${b['Version / Setting'] ?? ''}|${b['Comparable Group'] ?? ''}`;
    if (!benchMap.has(benchKey)) {
      const [bench] = await sql<IdRow[]>`
        INSERT INTO benchmarks (name, category, version, comparable_group, score_unit, higher_is_better)
        VALUES (${b.Benchmark}, ${b.Category ?? 'general'}, ${b['Version / Setting'] ?? null}, ${b['Comparable Group'] ?? null}, ${b.Unit ?? null}, ${b['Higher Better']?.toString().toLowerCase().startsWith('yes') ?? null})
        ON CONFLICT (name, version, comparable_group) DO UPDATE SET status = 'active'
        RETURNING id
      `;
      if (!bench) throw new Error(`Failed to upsert benchmark: ${benchKey}`);
      benchMap.set(benchKey, bench.id);
    }
    const benchId = benchMap.get(benchKey)!;
    const modelId = modelByName.get(b.Model) ?? modelMap.get(b.Model) ?? null;
    if (!modelId) {
      unmatchedBenchModels.add(b.Model);
      continue;
    }
    const scoreNum = parseFloat(String(b.Score));
    await sql`
      INSERT INTO model_benchmark_results (model_id, benchmark_id, setting, score, score_text, result_date, source_type, source_url, notes, verified_at)
      VALUES (${modelId}, ${benchId}, ${b['Version / Setting'] ?? null}, ${Number.isNaN(scoreNum) ? null : scoreNum}, ${b.Score != null ? String(b.Score) : null}, ${b['Verified On'] ?? null}, 'workbook', ${b['Source URL'] ?? null}, ${b.Notes ?? null}, ${b['Verified On'] ?? null})
    `;
    benchRowsInserted += 1;
  }
  if (unmatchedBenchModels.size > 0) {
    console.log(`  ! Unmatched benchmark models: ${Array.from(unmatchedBenchModels).join(", ")}`);
  }
  console.log(`  ✓ Benchmark evidence rows inserted: ${benchRowsInserted} (seed file: ${benchmarksSeed.length})`);

  // 11. Create mock usage snapshots
  for (const u of mockUsageSeed) {
    const [sub] = await sql<IdRow[]>`SELECT id FROM subscriptions WHERE external_seed_id = ${u.subscriptionId}`;
    if (!sub) continue;
    await sql`
      INSERT INTO usage_snapshots (subscription_id, source, is_mock, period_label, used_percent, captured_at)
      VALUES (${sub.id}, 'mock', true, ${u.periodLabel ?? null}, ${u.usedPercent ?? null}, ${u.capturedAt ?? new Date().toISOString()})
    `;
  }
  console.log(`  ✓ Mock usage snapshots: ${mockUsageSeed.length}`);

  // ── Verification ──
  const counts = await sql<CountRow[]>`
    SELECT
      (SELECT COUNT(*) FROM models) as models,
      (SELECT COUNT(*) FROM subscriptions) as subscriptions,
      (SELECT COUNT(*) FROM model_access) as model_access,
      (SELECT COUNT(*) FROM model_benchmark_results) as benchmarks,
      (SELECT COUNT(*) FROM developers) as developers,
      (SELECT COUNT(*) FROM access_providers) as providers,
      (SELECT COUNT(*) FROM model_aliases) as aliases,
      (SELECT COUNT(*) FROM model_capabilities) as capabilities
  `;
  const c = counts[0];
  if (!c) throw new Error("Failed to read seed verification counts");
  const costResult = await sql<TotalRow[]>`
    SELECT COALESCE(SUM(p.regular_price), 0) as total
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.status = 'active'
  `;
  const costRow = costResult[0];
  if (!costRow) throw new Error("Failed to read monthly cost total");
  const models = Number(c.models);
  const subscriptions = Number(c.subscriptions);
  const modelAccess = Number(c.model_access);
  const benchmarks = Number(c.benchmarks);
  const monthlyCost = Number(costRow.total);

  console.log("\n── Seed verification ──");
  console.log(`  Models:         ${models} (expected 51)`);
  console.log(`  Subscriptions:  ${subscriptions} (expected 4)`);
  console.log(`  Model access:   ${modelAccess} (expected 19)`);
  console.log(`  Benchmarks:     ${benchmarks} (expected 276)`);
  console.log(`  Developers:     ${c.developers}`);
  console.log(`  Providers:      ${c.providers}`);
  console.log(`  Aliases:        ${c.aliases}`);
  console.log(`  Capabilities:   ${c.capabilities}`);
  console.log(`  Monthly cost:   $${monthlyCost} (expected 61)`);

  const allCorrect =
    models === 51 &&
    subscriptions === 4 &&
    modelAccess === 19 &&
    benchmarks === 276 &&
    monthlyCost === 61;
  if (allCorrect) {
    console.log("\n✓ ALL SEED ASSERTIONS PASS");
  } else {
    console.log("\n✗ SEED ASSERTIONS FAILED — see counts above");
    process.exitCode = 1;
  }

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
