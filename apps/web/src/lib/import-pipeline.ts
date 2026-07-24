import {
  readFileBuffer, loadWorkbook, parseWorkbook, normalizeMasterRow,
  buildMatchRegistry, matchRow,
} from "@model-monitor/excel-import";
import type { CanonicalIdentity, NormalizedModelRow, MatchResult, ParseResult, ParsedRow } from "@model-monitor/excel-import";
import type { ImportPlan, ImportPlanModelRow, ImportPlanBenchmarkRow } from "@model-monitor/database";
import { listExportModels } from "@model-monitor/database";
import { db } from "@/lib/db";

type PreviewConflict = { conflictType: string; sourceSheet?: string | null; sourceRow?: number | null; entityType?: string | null; importedValue?: unknown };
type PreviewError = { code: string; message: string; sheetName?: string; row?: number; column?: string };
type PreviewSheet = { sheetName: string; rowCount: number; columnCount: number; columns: string[]; skippedRows: number; errorCount: number };
export interface ImportPlanBuild { plan: ImportPlan; summary: Record<string, unknown>; conflicts: PreviewConflict[]; errors: PreviewError[]; sheets: PreviewSheet[] }

function text(row: ParsedRow, key: string): string | null { const v = row.cells[key]; if (v == null || (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean")) return null; const value = String(v).trim(); return value === "" ? null : value; }
function numberValue(row: ParsedRow, key: string): number | null { const v = row.cells[key]; if (typeof v === "number") return Number.isFinite(v) ? v : null; if (typeof v !== "string" || v.trim() === "") return null; const parsed = Number(v); return Number.isFinite(parsed) ? parsed : null; }
function benchmarkModelMatch(row: ParsedRow, registry: ReturnType<typeof buildMatchRegistry>): MatchResult {
  return matchRow(registry, { modelId: null, providerModelId: null, name: text(row, "Model"), developer: text(row, "Provider"), family: null, generation: null });
}

export function buildImportPlanFromParsed(parsed: ParseResult, roster: Array<{ canonicalId: string; name: string; developer?: string | null; family?: string | null; generation?: string | null }>): ImportPlanBuild {
  const identities: CanonicalIdentity[] = roster.map((m) => ({ canonicalId: m.canonicalId, name: m.name, developer: m.developer ?? "", family: m.family ?? null, generation: m.generation ?? null }));
  const registry = buildMatchRegistry(identities);
  const conflicts: PreviewConflict[] = [];
  const modelSheet = parsed.sheets.find((s) => s.name === "Master Models");
  const normalized = modelSheet?.rows.map(normalizeMasterRow) ?? [];
  let createCount = 0; let unchangedCount = 0; let duplicateCount = 0;
  const modelRows: ImportPlanModelRow[] = normalized.map((row: NormalizedModelRow) => {
    const match = matchRow(registry, { modelId: row.modelId, providerModelId: row.providerModelId, name: row.name, developer: row.developer, family: row.family, generation: row.generation });
    const canonicalId = row.modelId ?? match.candidateCanonicalId;
    const classification = row.modelId === null && match.candidateCanonicalId === null ? "error" : match.conflicts.length > 0 ? "duplicate" : match.candidateCanonicalId ? "unchanged" : "create";
    if (classification === "create") createCount++; else if (classification === "unchanged") unchangedCount++; else if (classification === "duplicate") duplicateCount++;
    if (!canonicalId) conflicts.push({ conflictType: "unmatched_model_id", sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, entityType: "model", importedValue: row.name });
    if (match.conflicts.length > 0) conflicts.push({ conflictType: "manual_review_required", sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, entityType: "model", importedValue: row.name });
    return { classification, canonicalId, developerName: row.developer, name: row.name, family: row.family, generation: row.generation, lifecycleRaw: row.lifecycleRaw, releaseDate: row.releaseDate, modelType: row.modelType, contextTokens: row.contextTokens, maxOutputTokens: row.maxOutputTokens, speedRating: row.speedRating, codingSpecialization: row.codingSpecialization, bestUse: row.bestUse, avoidFor: row.avoidFor, visionSupport: row.visionSupport, reasoningSupport: row.reasoningSupport, toolSupport: row.toolSupport, knowledgeCutoff: row.knowledgeCutoff, needsRecheck: row.needsRecheck, accessProviderName: row.accessProvider, planName: row.plan, providerModelId: row.providerModelId, subscriptionUsdMo: row.subscriptionUsdMo, sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, verifiedOn: row.verifiedOn };
  });
  const benchmarkRows: ImportPlanBenchmarkRow[] = [];
  const benchmarkSheet = parsed.sheets.find((s) => s.name === "Benchmarks");
  for (const row of benchmarkSheet?.rows ?? []) {
    const match = benchmarkModelMatch(row, registry);
    if (!match.candidateCanonicalId) { conflicts.push({ conflictType: "unmatched_model_id", sourceSheet: "Benchmarks", sourceRow: row.provenance[0]?.row, entityType: "benchmark", importedValue: { provider: text(row, "Provider"), model: text(row, "Model") } }); continue; }
    benchmarkRows.push({ modelCanonicalId: match.candidateCanonicalId, benchmarkName: text(row, "Benchmark") ?? "", category: text(row, "Category") ?? "", version: text(row, "Version / Setting"), comparableGroup: text(row, "Comparable Group"), score: numberValue(row, "Score"), scoreText: typeof row.cells.Score === "string" ? text(row, "Score") : null, setting: text(row, "Version / Setting"), harness: text(row, "Benchmark"), sourceType: text(row, "Source Type"), sourceUrl: text(row, "Source URL"), resultDate: text(row, "Verified On"), confidence: null });
  }
  const sheets = parsed.sheets.map((s) => ({ sheetName: s.name, rowCount: s.rows.length, columnCount: s.headers.length, columns: s.headers, skippedRows: 0, errorCount: s.errors.length }));
  const errors = parsed.sheets.flatMap((s) => s.errors.map((e) => ({ sheetName: e.sheet, row: e.row, column: e.column, code: "PARSE_ERROR", message: e.message })));
  return { plan: { modelRows, benchmarkRows }, summary: { unchangedCount, createCount, updateCount: 0, duplicateCount, conflictCount: conflicts.length, errorCount: parsed.totalErrors, skipCount: parsed.totalRows - normalized.length, totalSourceRows: parsed.totalRows, masterModelRowCount: normalized.length, rosterModelCount: roster.length, benchmarkRowCount: benchmarkRows.length, sheets }, conflicts, errors, sheets };
}

export async function buildImportPlan(storedPath: string): Promise<ImportPlanBuild> {
  const parsed = parseWorkbook(loadWorkbook(await readFileBuffer(storedPath)));
  const roster = await listExportModels(db, { neutralizeFormulas: false });
  return buildImportPlanFromParsed(parsed, roster.map((m) => ({ canonicalId: m.canonicalId, name: m.name, developer: m.developer, family: m.family, generation: m.generation })));
}
