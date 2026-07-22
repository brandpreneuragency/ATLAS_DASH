import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { models } from "./models";
import { users, accessProviders } from "./core";
import { sourceType, auditAction, importStatus, usageSource } from "./enums";

// ── Score Methodologies ────────────────────────────────────────

export const scoreMethodologies = pgTable("score_methodologies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  factors: jsonb("factors").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Model Scores ───────────────────────────────────────────────

export const modelScores = pgTable("model_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  methodologyId: uuid("methodology_id").notNull().references(() => scoreMethodologies.id),
  scoreType: text("score_type").notNull(),
  scoreValue: numeric("score_value", { precision: 8, scale: 4 }),
  rankValue: integer("rank_value"),
  eligibleCount: integer("eligible_count"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  overrideReason: text("override_reason"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull(),
  sourceImportJobId: uuid("source_import_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  lookupIdx: index("model_scores_lookup_idx").on(t.modelId, t.scoreType, t.calculatedAt),
}));

// ── Benchmarks ─────────────────────────────────────────────────

export const benchmarks = pgTable("benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  version: text("version"),
  comparableGroup: text("comparable_group"),
  scoreUnit: text("score_unit"),
  higherIsBetter: boolean("higher_is_better"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Model Benchmark Results ────────────────────────────────────

export const modelBenchmarkResults = pgTable("model_benchmark_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  benchmarkId: uuid("benchmark_id").notNull().references(() => benchmarks.id),
  setting: text("setting"),
  harness: text("harness"),
  score: numeric("score", { precision: 16, scale: 6 }),
  scoreText: text("score_text"),
  resultDate: date("result_date"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  sourceType: sourceType("source_type"),
  sourceUrl: text("source_url"),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  importJobId: uuid("import_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  modelIdx: index("benchmark_results_model_idx").on(t.modelId),
  benchmarkIdx: index("benchmark_results_benchmark_idx").on(t.benchmarkId),
}));

// ── Sources ────────────────────────────────────────────────────

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  sourceType: sourceType("source_type").notNull(),
  url: text("url"),
  title: text("title"),
  publisher: text("publisher"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  notes: text("notes"),
  importJobId: uuid("import_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("sources_entity_idx").on(t.entityType, t.entityId),
}));
