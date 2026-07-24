/**
 * Unit tests for import service pure logic.
 * Tests validation schemas and helper functions.
 */
import { describe, expect, it } from "vitest";
import {
  importJobResponseSchema,
  importPreviewSummarySchema,
  importCommitSummarySchema,
  importBatchResolutionSchema,
  importConflictTypeSchema,
  importResolutionActionSchema,
  neutralizeExportRow,
  neutralizeFormulaText,
  isFormulaLike,
  type ImportJobResponse,
} from "@model-monitor/schemas";

describe("Import schemas", () => {
  it("importJobResponseSchema parses valid data", () => {
    const data: ImportJobResponse = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      filename: "test.xlsx",
      storedPath: "/tmp/test.xlsx",
      sha256: "a".repeat(64),
      parserVersion: "1.0.0",
      status: "uploaded",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = importJobResponseSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it("importJobResponseSchema rejects missing required fields", () => {
    const parsed = importJobResponseSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("importPreviewSummarySchema defaults zero values", () => {
    const parsed = importPreviewSummarySchema.parse({});
    expect(parsed.unchangedCount).toBe(0);
    expect(parsed.createCount).toBe(0);
    expect(parsed.totalSourceRows).toBeUndefined();
  });

  it("importCommitSummarySchema defaults zero values", () => {
    const parsed = importCommitSummarySchema.parse({});
    expect(parsed.modelsCreated).toBe(0);
    expect(parsed.committedAt).toBeUndefined();
  });

  it("importBatchResolutionSchema rejects empty resolutions", () => {
    const parsed = importBatchResolutionSchema.safeParse({
      importJobId: crypto.randomUUID(),
      resolutions: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("importConflictTypeSchema has expected values", () => {
    expect(importConflictTypeSchema.options).toContain("canonical_identity_collision");
    expect(importConflictTypeSchema.options).toContain("destructive_blank_overwrite");
    expect(importConflictTypeSchema.options.length).toBe(13);
  });

  it("importResolutionActionSchema has expected values", () => {
    expect(importResolutionActionSchema.options).toContain("keep_existing");
    expect(importResolutionActionSchema.options).toContain("defer");
    expect(importResolutionActionSchema.options.length).toBe(6);
  });
});

describe("Formula neutralization", () => {
  it("isFormulaLike detects formula prefixes", () => {
    expect(isFormulaLike("=SUM(A1)")).toBe(true);
    expect(isFormulaLike("+FORMULA")).toBe(true);
    expect(isFormulaLike("-FORMULA")).toBe(true);
    expect(isFormulaLike("@FORMULA")).toBe(true);
    expect(isFormulaLike("plain text")).toBe(false);
    expect(isFormulaLike("")).toBe(false);
  });

  it("neutralizeFormulaText prepends quote to formula-like text", () => {
    expect(neutralizeFormulaText("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(neutralizeFormulaText("plain")).toBe("plain");
    expect(neutralizeFormulaText(null)).toBeNull();
    expect(neutralizeFormulaText(undefined)).toBeNull();
  });

  it("neutralizeExportRow recursively neutrallizes", () => {
    const row = {
      name: "Test",
      value: "=DANGER",
      nested: { formula: "+EVIL" },
    };
    const result = neutralizeExportRow(row);
    expect(result.name).toBe("Test");
    expect(result.value).toBe("'=DANGER");
    const nested = result.nested as Record<string, unknown>;
    expect(nested.formula).toBe("'+EVIL");
  });
});
