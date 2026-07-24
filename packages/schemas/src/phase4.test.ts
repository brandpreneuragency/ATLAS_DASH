import { describe, expect, it } from "vitest";
import {
  importUploadSchema,
  sheetSummarySchema,
  importPreviewSummarySchema,
  importCommitSummarySchema,
  importErrorSummarySchema,
  importConflictTypeSchema,
  importConflictDtoSchema,
  importResolutionActionSchema,
  importBatchResolutionSchema,
  importProvenanceDtoSchema,
  importJobResponseSchema,
  importPreviewResponseSchema,
  exportFormatSchema,
  exportRequestSchema,
  exportModelRowSchema,
  exportPayloadSchema,
  isFormulaLike,
  neutralizeFormulaText,
  neutralizeExportRow,
} from "./index";

// ── isFormulaLike ────────────────────────────────────────────────

describe("isFormulaLike", () => {
  it("detects = prefix", () => {
    expect(isFormulaLike("=SUM(A1:A10)")).toBe(true);
  });

  it("detects + prefix", () => {
    expect(isFormulaLike("+B3+C3")).toBe(true);
  });

  it("detects - prefix", () => {
    expect(isFormulaLike("-D4")).toBe(true);
  });

  it("detects @ prefix", () => {
    expect(isFormulaLike("@INDIRECT('A1')")).toBe(true);
  });

  it("detects tab prefix", () => {
    expect(isFormulaLike("\t=1+1")).toBe(true);
  });

  it("rejects plain text", () => {
    expect(isFormulaLike("plain text")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isFormulaLike("")).toBe(false);
  });

  it("rejects numeric string", () => {
    expect(isFormulaLike("42")).toBe(false);
  });
});

// ── neutralizeFormulaText ────────────────────────────────────────

describe("neutralizeFormulaText", () => {
  it("prepends single quote to formula-like strings", () => {
    expect(neutralizeFormulaText("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(neutralizeFormulaText("+B2")).toBe("'+B2");
    expect(neutralizeFormulaText("-C3")).toBe("'-C3");
    expect(neutralizeFormulaText("@D4")).toBe("'@D4");
  });

  it("passes through safe strings unchanged", () => {
    expect(neutralizeFormulaText("plain text")).toBe("plain text");
    expect(neutralizeFormulaText("42")).toBe("42");
    expect(neutralizeFormulaText("")).toBe("");
  });

  it("returns null for null/undefined", () => {
    expect(neutralizeFormulaText(null)).toBeNull();
    expect(neutralizeFormulaText(undefined)).toBeNull();
  });
});

// ── neutralizeExportRow ──────────────────────────────────────────

describe("neutralizeExportRow", () => {
  it("neutralizes all string values in a flat row", () => {
    const row = { name: "Test", formula: "=SUM(A1)", safe: "OK", count: 42, flag: true, empty: "" };
    const result = neutralizeExportRow(row);
    expect(result.name).toBe("Test");
    expect(result.formula).toBe("'=SUM(A1)");
    expect(result.safe).toBe("OK");
    expect(result.count).toBe(42);
    expect(result.flag).toBe(true);
    expect(result.empty).toBe("");
  });

  it("neutralizes strings in nested objects", () => {
    const row = { model: { name: "GPT", formula: "=DDE()" }, meta: { note: "safe" } };
    const result = neutralizeExportRow(row);
    expect((result.model as Record<string, unknown>).formula).toBe("'=DDE()");
    expect((result.meta as Record<string, unknown>).note).toBe("safe");
  });

  it("neutralizes strings inside arrays", () => {
    const row = { items: [{ label: "=HYPERLINK()" }, { label: "safe" }] };
    const result = neutralizeExportRow(row);
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0]?.label).toBe("'=HYPERLINK()");
    expect(items[1]?.label).toBe("safe");
  });

  it("handles null values", () => {
    const result = neutralizeExportRow({ field: null, other: "=1+1" });
    expect(result.field).toBeNull();
    expect(result.other).toBe("'=1+1");
  });
});

// ── importUploadSchema ───────────────────────────────────────────

describe("importUploadSchema", () => {
  it("accepts a minimal upload payload", () => {
    const parsed = importUploadSchema.parse({ filename: "models.xlsx" });
    expect(parsed.filename).toBe("models.xlsx");
    expect(parsed.expectedSizeBytes).toBeUndefined();
    expect(parsed.sha256).toBeUndefined();
  });

  it("accepts optional fields", () => {
    const parsed = importUploadSchema.parse({
      filename: "  models.xlsx  ",
      expectedSizeBytes: 102400,
      sha256: "a".repeat(64),
    });
    expect(parsed.filename).toBe("models.xlsx");
    expect(parsed.expectedSizeBytes).toBe(102400);
    expect(parsed.sha256).toBe("a".repeat(64));
  });

  it("rejects empty filename", () => {
    expect(importUploadSchema.safeParse({ filename: "" }).success).toBe(false);
  });

  it("rejects invalid sha256 length", () => {
    expect(
      importUploadSchema.safeParse({ filename: "x.xlsx", sha256: "short" }).success,
    ).toBe(false);
  });
});

// ── sheetSummarySchema ───────────────────────────────────────────

describe("sheetSummarySchema", () => {
  it("accepts minimal valid summary", () => {
    const parsed = sheetSummarySchema.parse({
      sheetName: "Master Models",
      rowCount: 31,
      columnCount: 76,
    });
    expect(parsed.sheetName).toBe("Master Models");
    expect(parsed.skippedRows).toBeUndefined();
  });

  it("accepts full summary with all fields", () => {
    const parsed = sheetSummarySchema.parse({
      sheetName: "Benchmarks",
      rowCount: 276,
      columnCount: 12,
      columns: ["model", "benchmark", "score"],
      skippedRows: 2,
      errorCount: 0,
    });
    expect(parsed.columns).toEqual(["model", "benchmark", "score"]);
    expect(parsed.skippedRows).toBe(2);
    expect(parsed.errorCount).toBe(0);
  });
});

// ── importPreviewSummarySchema ───────────────────────────────────

describe("importPreviewSummarySchema", () => {
  it("defaults all count fields to zero", () => {
    const parsed = importPreviewSummarySchema.parse({});
    expect(parsed.unchangedCount).toBe(0);
    expect(parsed.createCount).toBe(0);
    expect(parsed.updateCount).toBe(0);
    expect(parsed.conflictCount).toBe(0);
    expect(parsed.errorCount).toBe(0);
    expect(parsed.skipCount).toBe(0);
    expect(parsed.duplicateCount).toBe(0);
  });

  it("accepts full preview summary", () => {
    const parsed = importPreviewSummarySchema.parse({
      unchangedCount: 20,
      createCount: 10,
      updateCount: 5,
      duplicateCount: 3,
      conflictCount: 2,
      errorCount: 1,
      skipCount: 4,
      sheets: [
        { sheetName: "Master Models", rowCount: 31, columnCount: 76 },
      ],
    });
    expect(parsed.unchangedCount).toBe(20);
    expect(parsed.createCount).toBe(10);
    expect(parsed.totalSourceRows).toBeUndefined();
  });

  it("rejects negative counts", () => {
    expect(
      importPreviewSummarySchema.safeParse({ createCount: -1 }).success,
    ).toBe(false);
  });
});

// ── importCommitSummarySchema ────────────────────────────────────

describe("importCommitSummarySchema", () => {
  it("defaults all fields to zero", () => {
    const parsed = importCommitSummarySchema.parse({});
    expect(parsed.modelsCreated).toBe(0);
    expect(parsed.modelsUpdated).toBe(0);
    expect(parsed.conflictsResolved).toBe(0);
    expect(parsed.committedAt).toBeUndefined();
  });

  it("accepts full commit summary", () => {
    const parsed = importCommitSummarySchema.parse({
      modelsCreated: 5,
      modelsUpdated: 3,
      accessCreated: 12,
      benchmarkRowsCreated: 200,
      conflictsResolved: 1,
      rowsSkipped: 2,
      committedAt: "2026-07-23T12:00:00Z",
    });
    expect(parsed.modelsCreated).toBe(5);
    expect(parsed.committedAt).toBe("2026-07-23T12:00:00Z");
  });
});

// ── importErrorSummarySchema ─────────────────────────────────────

describe("importErrorSummarySchema", () => {
  it("defaults to empty error list", () => {
    const parsed = importErrorSummarySchema.parse({});
    expect(parsed.totalErrors).toBe(0);
    expect(parsed.errors).toEqual([]);
  });

  it("accepts error entries", () => {
    const parsed = importErrorSummarySchema.parse({
      totalErrors: 2,
      errors: [
        { code: "PARSE_ERROR", message: "Invalid date", sheetName: "Sheet1", row: 5 },
        { code: "TYPE_ERROR", message: "Expected number" },
      ],
    });
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0]?.code).toBe("PARSE_ERROR");
    expect(parsed.errors[1]?.code).toBe("TYPE_ERROR");
  });
});

// ── importConflictTypeSchema ─────────────────────────────────────

describe("importConflictTypeSchema", () => {
  it("accepts every known conflict type", () => {
    const types = [
      "canonical_identity_collision",
      "alias_collision",
      "developer_mismatch",
      "lifecycle_mismatch",
      "newer_local_value",
      "older_imported_value",
      "access_provider_mismatch",
      "duplicate_plan_model",
      "benchmark_group_mismatch",
      "score_methodology_mismatch",
      "destructive_blank_overwrite",
      "unmatched_model_id",
      "manual_review_required",
    ] as const;
    for (const t of types) {
      expect(importConflictTypeSchema.parse(t)).toBe(t);
    }
  });

  it("rejects unknown conflict types", () => {
    expect(importConflictTypeSchema.safeParse("unknown_type").success).toBe(false);
  });
});

// ── importConflictDtoSchema ──────────────────────────────────────

describe("importConflictDtoSchema", () => {
  const validConflict = {
    id: "11111111-1111-1111-1111-111111111111",
    importJobId: "22222222-2222-2222-2222-222222222222",
    conflictType: "developer_mismatch",
    createdAt: "2026-07-23T12:00:00Z",
  };

  it("parses a minimal conflict DTO", () => {
    const parsed = importConflictDtoSchema.parse(validConflict);
    expect(parsed.conflictType).toBe("developer_mismatch");
    expect(parsed.sourceSheet).toBeUndefined();
  });

  it("parses a conflict with resolution", () => {
    const parsed = importConflictDtoSchema.parse({
      ...validConflict,
      resolution: "use_imported",
      resolvedAt: "2026-07-23T13:00:00Z",
    });
    expect(parsed.resolution).toBe("use_imported");
    expect(parsed.resolvedAt).toBe("2026-07-23T13:00:00Z");
  });
});

// ── importResolutionActionSchema ─────────────────────────────────

describe("importResolutionActionSchema", () => {
  it("accepts every resolution action", () => {
    const actions = [
      "keep_existing",
      "use_imported",
      "merge",
      "create_separate_access",
      "ignore_row",
      "defer",
    ] as const;
    for (const a of actions) {
      expect(importResolutionActionSchema.parse(a)).toBe(a);
    }
  });
});

// ── importBatchResolutionSchema ──────────────────────────────────

describe("importBatchResolutionSchema", () => {
  it("accepts a batch with one resolution", () => {
    const parsed = importBatchResolutionSchema.parse({
      importJobId: "11111111-1111-1111-1111-111111111111",
      resolutions: [
        { conflictId: "22222222-2222-2222-2222-222222222222", action: "keep_existing" },
      ],
    });
    expect(parsed.resolutions).toHaveLength(1);
  });

  it("rejects empty resolutions array", () => {
    expect(
      importBatchResolutionSchema.safeParse({
        importJobId: "11111111-1111-1111-1111-111111111111",
        resolutions: [],
      }).success,
    ).toBe(false);
  });
});

// ── importJobResponseSchema ──────────────────────────────────────

describe("importJobResponseSchema", () => {
  const valid = {
    id: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    filename: "models.xlsx",
    storedPath: "/data/uploads/models.xlsx",
    sha256: "a".repeat(64),
    parserVersion: "1.0",
    status: "uploaded",
    createdAt: "2026-07-23T12:00:00Z",
    updatedAt: "2026-07-23T12:00:00Z",
  };

  it("parses a minimal import job response", () => {
    const parsed = importJobResponseSchema.parse(valid);
    expect(parsed.status).toBe("uploaded");
    expect(parsed.previewSummary).toBeUndefined();
    expect(parsed.committedAt).toBeUndefined();
  });

  it("parses an import job with summaries", () => {
    const parsed = importJobResponseSchema.parse({
      ...valid,
      status: "committed",
      previewSummary: { unchangedCount: 20, createCount: 5, updateCount: 3 },
      commitSummary: { modelsCreated: 5, modelsUpdated: 3 },
      committedAt: "2026-07-23T13:00:00Z",
    });
    expect(parsed.previewSummary?.unchangedCount).toBe(20);
    expect(parsed.commitSummary?.modelsCreated).toBe(5);
    expect(parsed.committedAt).toBe("2026-07-23T13:00:00Z");
  });

  it("rejects unknown status", () => {
    expect(
      importJobResponseSchema.safeParse({ ...valid, status: "unknown" }).success,
    ).toBe(false);
  });
});

// ── importPreviewResponseSchema ──────────────────────────────────

describe("importPreviewResponseSchema", () => {
  const base = {
    importJobId: "11111111-1111-1111-1111-111111111111",
    summary: {},
    rows: [],
    conflicts: [],
  };

  it("accepts empty preview", () => {
    const parsed = importPreviewResponseSchema.parse(base);
    expect(parsed.rows).toEqual([]);
    expect(parsed.conflicts).toEqual([]);
  });

  it("accepts preview with rows", () => {
    const parsed = importPreviewResponseSchema.parse({
      ...base,
      rows: [
        { classification: "create", entityType: "model", sourceSheet: "Master Models", sourceRow: 3 },
        { classification: "conflict", conflictId: "22222222-2222-2222-2222-222222222222" },
      ],
    });
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.classification).toBe("create");
    expect(parsed.rows[1]?.classification).toBe("conflict");
  });
});

// ── export schemas ───────────────────────────────────────────────

describe("exportFormatSchema", () => {
  it("accepts json, csv, xlsx", () => {
    expect(exportFormatSchema.parse("json")).toBe("json");
    expect(exportFormatSchema.parse("csv")).toBe("csv");
    expect(exportFormatSchema.parse("xlsx")).toBe("xlsx");
  });

  it("rejects unknown format", () => {
    expect(exportFormatSchema.safeParse("pdf").success).toBe(false);
  });
});

describe("exportScopeSchema", () => {
  it("defaults to full in export request", () => {
    const parsed = exportRequestSchema.parse({ format: "json" });
    expect(parsed.scope).toBe("full");
    expect(parsed.neutralizeFormulas).toBe(true);
  });

  it("accepts filtered export request", () => {
    const parsed = exportRequestSchema.parse({
      format: "csv",
      scope: "models",
      includeArchived: true,
      neutralizeFormulas: false,
      search: "gpt",
    });
    expect(parsed.scope).toBe("models");
    expect(parsed.neutralizeFormulas).toBe(false);
    expect(parsed.search).toBe("gpt");
  });
});

describe("exportModelRowSchema", () => {
  it("parses a model export row", () => {
    const parsed = exportModelRowSchema.parse({
      canonicalId: "openai:gpt-4.1",
      name: "GPT-4.1",
      slug: "gpt-4-1",
      lifecycle: "current",
      contextTokens: 128000,
    });
    expect(parsed.canonicalId).toBe("openai:gpt-4.1");
    expect(parsed.contextTokens).toBe(128000);
    expect(parsed.family).toBeUndefined();
  });

  it("keeps null capability as null", () => {
    const parsed = exportModelRowSchema.parse({
      canonicalId: "x:y",
      name: "Y",
      slug: "y",
      lifecycle: "unknown",
      capabilities: { vision: null, reasoning: true },
    });
    expect(parsed.capabilities?.vision).toBeNull();
    expect(parsed.capabilities?.reasoning).toBe(true);
  });
});

describe("exportPayloadSchema", () => {
  it("parses a full export payload", () => {
    const parsed = exportPayloadSchema.parse({
      exportedAt: "2026-07-23T12:00:00Z",
      format: "json",
      scope: "full",
      formulasNeutralized: true,
      models: [],
      subscriptions: [],
      access: [],
      benchmarks: [],
    });
    expect(parsed.models).toEqual([]);
    expect(parsed.subscriptions).toEqual([]);
    expect(parsed.formulasNeutralized).toBe(true);
  });
});

// ── importProvenanceDtoSchema ────────────────────────────────────

describe("importProvenanceDtoSchema", () => {
  it("parses a provenance record", () => {
    const parsed = importProvenanceDtoSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      importJobId: "22222222-2222-2222-2222-222222222222",
      entityType: "model",
      entityId: "33333333-3333-3333-3333-333333333333",
      createdAt: "2026-07-23T12:00:00Z",
    });
    expect(parsed.entityType).toBe("model");
    expect(parsed.sourceSheet).toBeUndefined();
  });

  it("parses with source tracking", () => {
    const parsed = importProvenanceDtoSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      importJobId: "22222222-2222-2222-2222-222222222222",
      entityType: "model",
      entityId: "33333333-3333-3333-3333-333333333333",
      sourceSheet: "Master Models",
      sourceRow: 5,
      sourceColumn: "B",
      rawValue: { name: "GPT-4.1" },
      createdAt: "2026-07-23T12:00:00Z",
    });
    expect(parsed.sourceSheet).toBe("Master Models");
    expect(parsed.sourceRow).toBe(5);
    expect(parsed.rawValue).toEqual({ name: "GPT-4.1" });
  });
});
