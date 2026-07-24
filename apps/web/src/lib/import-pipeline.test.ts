import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildImportPlanFromParsed } from "./import-pipeline";
import { loadWorkbook, parseWorkbook, normalizeMasterRow } from "@model-monitor/excel-import";
import type { ParseResult } from "@model-monitor/excel-import";

const fixture = resolve(process.cwd(), "../../docs/implementation-package/source/LLM_MASTER_v2.xlsm");
const parsed = parseWorkbook(loadWorkbook(readFileSync(fixture)));
const master = parsed.sheets.find((sheet) => sheet.name === "Master Models")!;

function rosterOf51() {
  const normalized = master.rows.map(normalizeMasterRow);
  const identities = normalized.filter((row) => row.modelId).map((row) => ({
    canonicalId: row.modelId!, name: row.name!, developer: row.developer ?? "",
    family: row.family, generation: row.generation,
    aliases: row.providerModelId ? [row.providerModelId] : undefined,
  }));
  const benchmark = parsed.sheets.find((sheet) => sheet.name === "Benchmarks")!.rows.map((row) => ({
    canonicalId: `benchmark-${String(row.cells.Model).toLowerCase().replace(/ /g, "-")}`,
    name: String(row.cells.Model), developer: String(row.cells.Provider), family: null, generation: null,
  }));
  const unique = Array.from(new Map([...identities, ...benchmark].map((identity) => [identity.name.toLowerCase(), identity])).values());
  while (unique.length < 51) unique.push({ canonicalId: `synthetic-${unique.length}`, name: `Synthetic ${unique.length}`, developer: "Synthetic", family: null, generation: null });
  return unique.slice(0, 51);
}

describe("C2 fixture-backed import pipeline", () => {
  it("plans the fixture without evaluating formulas", () => {
    expect(master.rows).toHaveLength(31);
    expect(master.headers).toHaveLength(76);
    const result = buildImportPlanFromParsed(parsed, rosterOf51());
    expect(result.summary.rosterModelCount).toBe(51);
    expect(result.summary.benchmarkRowCount).toBe(276);
    expect(result.errors.every((error) => error.code === "PARSE_ERROR")).toBe(true);
    expect(result.errors.every((error) => !error.message.includes("evaluated"))).toBe(false);
  });

  it("does not duplicate canonical models for access endpoint rows", () => {
    const result = buildImportPlanFromParsed(parsed, rosterOf51());
    const ids = result.plan.modelRows.map((row) => row.canonicalId).filter((id): id is string => id !== null);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("flags a synthetic blank model ID as a typed unmatched conflict", () => {
    const synthetic: ParseResult = { ...parsed, sheets: parsed.sheets.map((sheet) => sheet.name === "Master Models" ? {
      ...sheet, rows: [...sheet.rows, { cells: { "Model ID": null, Model: "Synthetic Blank", Provider: "Synthetic" }, provenance: [{ sheet: "Master Models", row: 999, column: "D" }], isEmpty: false }],
    } : sheet) };
    const result = buildImportPlanFromParsed(synthetic, rosterOf51());
    expect(result.conflicts).toContainEqual(expect.objectContaining({ conflictType: "unmatched_model_id", entityType: "model", sourceRow: 999 }));
    expect(result.plan.modelRows.at(-1)?.classification).toBe("error");
  });

  it("preserves model provenance and null subscription semantics", () => {
    const result = buildImportPlanFromParsed(parsed, rosterOf51());
    const source = result.plan.modelRows.find((row) => row.sourceSheet === "Master Models" && row.subscriptionUsdMo === null);
    expect(source?.sourceRow).toBeTypeOf("number");
    expect(source?.subscriptionUsdMo).toBeNull();
  });

  it("preserves benchmark setting, comparable group, URL, and result date", () => {
    const result = buildImportPlanFromParsed(parsed, rosterOf51());
    const row = result.plan.benchmarkRows.find((benchmark) => benchmark.setting || benchmark.comparableGroup || benchmark.sourceUrl || benchmark.resultDate);
    expect(row).toBeDefined();
    expect(row?.setting).not.toBeNull();
    expect(row?.comparableGroup).not.toBeNull();
    expect(row?.sourceUrl).not.toBeNull();
    expect(row?.resultDate).not.toBeNull();
  });
});
