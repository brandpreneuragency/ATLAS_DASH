import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { models } from "./models";
import { subscriptions } from "./subscriptions";
import { users } from "./core";
import { importStatus, usageSource, auditAction } from "./enums";

// ── Import Jobs ────────────────────────────────────────────────

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  storedPath: text("stored_path").notNull(),
  sha256: text("sha256").notNull(),
  parserVersion: text("parser_version").notNull(),
  status: importStatus("status").notNull().default("uploaded"),
  sheetSummary: jsonb("sheet_summary"),
  previewSummary: jsonb("preview_summary"),
  commitSummary: jsonb("commit_summary"),
  errorSummary: jsonb("error_summary"),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  committedAt: timestamp("committed_at", { withTimezone: true }),
});

// ── Import Conflicts ───────────────────────────────────────────

export const importConflicts = pgTable("import_conflicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  importJobId: uuid("import_job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  conflictType: text("conflict_type").notNull(),
  sourceSheet: text("source_sheet"),
  sourceRow: integer("source_row"),
  sourceColumn: text("source_column"),
  entityType: text("entity_type"),
  candidateEntityId: uuid("candidate_entity_id"),
  currentValue: jsonb("current_value"),
  importedValue: jsonb("imported_value"),
  resolution: text("resolution"),
  resolutionPayload: jsonb("resolution_payload"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Import Provenance ──────────────────────────────────────────

export const importProvenance = pgTable("import_provenance", {
  id: uuid("id").primaryKey().defaultRandom(),
  importJobId: uuid("import_job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  sourceSheet: text("source_sheet"),
  sourceRow: integer("source_row"),
  sourceColumn: text("source_column"),
  rawValue: jsonb("raw_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("import_provenance_entity_idx").on(t.entityType, t.entityId),
}));

// ── Usage Snapshots ────────────────────────────────────────────

export const usageSnapshots = pgTable("usage_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  modelId: uuid("model_id").references(() => models.id),
  source: usageSource("source").notNull(),
  isMock: boolean("is_mock").notNull().default(false),
  periodLabel: text("period_label"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  usedAmount: numeric("used_amount", { precision: 18, scale: 6 }),
  remainingAmount: numeric("remaining_amount", { precision: 18, scale: 6 }),
  totalAmount: numeric("total_amount", { precision: 18, scale: 6 }),
  unit: text("unit"),
  usedPercent: numeric("used_percent", { precision: 6, scale: 3 }),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  rawPayload: jsonb("raw_payload"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  subIdx: index("usage_snapshots_subscription_idx").on(t.subscriptionId, t.capturedAt),
}));

// ── API Tokens ─────────────────────────────────────────────────

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  tokenPrefix: text("token_prefix").notNull().unique(),
  tokenHash: text("token_hash").notNull(),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Audit Events ───────────────────────────────────────────────

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  actorTokenId: uuid("actor_token_id"),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  action: auditAction("action").notNull(),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  metadata: jsonb("metadata"),
  requestId: text("request_id"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("audit_events_entity_idx").on(t.entityType, t.entityId, t.createdAt),
  createdIdx: index("audit_events_created_idx").on(t.createdAt),
}));

// ── App Settings ───────────────────────────────────────────────

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
