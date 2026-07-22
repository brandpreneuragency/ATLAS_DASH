import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  recordStatus,
  subscriptionStatus,
  lifecycleStatus,
} from "./schema/enums";
import * as schema from "./schema/index";

describe("schema barrel", () => {
  it("exports core enum constructors", () => {
    expect(recordStatus.enumValues).toEqual(["active", "archived"]);
    expect(subscriptionStatus.enumValues).toContain("active");
    expect(lifecycleStatus.enumValues).toContain("unknown");
  });

  it("exports expected high-value tables", () => {
    expect(schema.models).toBeDefined();
    expect(schema.subscriptions).toBeDefined();
    expect(schema.modelAccess).toBeDefined();
    expect(schema.modelBenchmarkResults).toBeDefined();
    expect(schema.plans).toBeDefined();
  });
});

describe("SQL migrations", () => {
  it("ships ordered hand-written migration files", () => {
    const dir = join(import.meta.dirname, "..", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(files).toEqual([
      "0000_initial.sql",
      "0001_subscriptions_models.sql",
      "0002_access_scores.sql",
      "0003_benchmarks_imports.sql",
      "0004_provenance_usage_tokens_audit.sql",
    ]);
  });
});
