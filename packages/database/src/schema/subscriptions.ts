import {
  pgTable,
  uuid,
  text,
  numeric,
  char,
  timestamp,
  boolean,
  date,
  integer,
  smallint,
  unique,
} from "drizzle-orm/pg-core";
import { accessProviders, users } from "./core";
import {
  apiAccessType,
  authenticationType,
  subscriptionStatus,
  usageTrackingMode,
} from "./enums";

// ── Plans ──────────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  accessProviderId: uuid("access_provider_id").notNull().references(() => accessProviders.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  planType: text("plan_type"),
  regularPrice: numeric("regular_price", { precision: 12, scale: 4 }),
  introductoryPrice: numeric("introductory_price", { precision: 12, scale: 4 }),
  currency: char("currency", { length: 3 }),
  billingInterval: text("billing_interval"),
  apiAccessType: apiAccessType("api_access_type").notNull().default("unknown"),
  authenticationType: authenticationType("authentication_type").notNull().default("other"),
  usageMeasurementType: text("usage_measurement_type"),
  termsSummary: text("terms_summary"),
  status: text("status").notNull().default("active"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueProviderSlug: unique().on(t.accessProviderId, t.slug),
}));

// ── Subscriptions ──────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  externalSeedId: text("external_seed_id").unique(),
  accountLabel: text("account_label").notNull(),
  status: subscriptionStatus("status").notNull().default("active"),
  startedAt: date("started_at"),
  nextBillingDate: date("next_billing_date"),
  cancelledAt: date("cancelled_at"),
  autoRenews: boolean("auto_renews"),
  actualPrice: numeric("actual_price", { precision: 12, scale: 4 }),
  currency: char("currency", { length: 3 }),
  billingInterval: text("billing_interval"),
  usageTrackingMode: usageTrackingMode("usage_tracking_mode").notNull().default("manual"),
  usageCheckUrl: text("usage_check_url"),
  usageCheckInstructions: text("usage_check_instructions"),
  importance: smallint("importance"),
  notes: text("notes"),
  privateNotes: text("private_notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Subscription Limit Rules ───────────────────────────────────

export const subscriptionLimitRules = pgTable("subscription_limit_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  limitType: text("limit_type").notNull(),
  amountMin: numeric("amount_min", { precision: 16, scale: 4 }),
  amountMax: numeric("amount_max", { precision: 16, scale: 4 }),
  unit: text("unit"),
  periodMinutes: integer("period_minutes"),
  resetStrategy: text("reset_strategy"),
  appliesTo: text("applies_to"),
  includedCredit: boolean("included_credit"),
  notes: text("notes"),
  rawText: text("raw_text"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
