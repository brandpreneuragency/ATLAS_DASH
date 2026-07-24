import * as XLSX from "xlsx";
import type { WorkBook, WorkSheet, CellObject, Range } from "xlsx";
import type {
  ParsedSheet,
  ParsedRow,
  ParseResult,
  ParseError,
  CellProvenance,
} from "./types";
import { isFormulaLike } from "@model-monitor/schemas";

// ── Cell lookup (isolated XLSX boundary) ─────────────────────────
// WorkSheet's string indexer returns `any`, so all cell access routes
// through this narrow helper to contain the unsafe boundary cast.

function lookupCell(
  sheet: WorkSheet,
  row: number,
  col: number,
): CellObject | undefined {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[addr] as CellObject | undefined;
}

// ── Config ────────────────────────────────────────────────────────

/** Known production sheet names. */
const KNOWN_SHEETS = new Set([
  "Master Models",
  "Google Model Data",
  "Benchmarks",
  "Provider Limits",
  "Methodology & Sources",
  "Model Router",
  "Expansion Scope",
  "Baseline Reference",
  "Mistral & Nemotron Data",
  "Session 5 Model Data",
  "Session 6 Normalization",
]);

/** Column letter from zero-based index. */
function colIndexToLetter(i: number): string {
  let letter = "";
  let n = i;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Convert an Excel serial date number to an ISO date string.
 * Excel serial date 1 = 1900-01-01 (with the known Lotus 123 bug).
 */
export function excelSerialDateToIso(serial: number): string {
  // Excel epoch: 1899-12-30 (accounts for the Lotus 123 leap-year bug)
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + serial * 86_400_000);
  return date.toISOString().split("T")[0]!;
}

const DATE_COLUMN_NAMES = new Set([
  "release date",
  "verified on",
  "result date",
  "verified date",
]);

function isDateColumn(header: string): boolean {
  return DATE_COLUMN_NAMES.has(header.toLowerCase().trim());
}

/**
 * Parse a single cell value, converting serial dates and handling
 * empty/null cells. Formula cells are detected but not evaluated.
 */
function parseCellValue(
  cell: CellObject | undefined,
  header: string,
): { value: unknown; isFormula: boolean } {
  if (!cell) return { value: null, isFormula: false };

  // Detect formula cells (type 'f' = formula)
  // Formula cells are detected by the presence of cell.f (formula text)
  if (cell.f) {
    return { value: cell.v ?? null, isFormula: true };
  }

  // Handle string-like-formula detection (cells that start with =, +, -, @)
  if (typeof cell.v === "string" && isFormulaLike(cell.v)) {
    return { value: cell.v, isFormula: true };
  }

  let value = cell.v;

  // Normalize empty/undefined to null
  if (value === undefined || value === null) {
    return { value: null, isFormula: false };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { value: null, isFormula: false };
  }

  // Convert Excel serial dates
  if (typeof value === "number" && isDateColumn(header)) {
    value = excelSerialDateToIso(value);
  }

  return { value, isFormula: false };
}

/**
 * Find the header row by scanning for a row that looks like column
 * headers (non-empty strings, at least 2 populated columns).
 */
function findHeaderRow(
  sheet: WorkSheet,
  maxScan: number,
): { row: number; range: Range } | null {
  const ref = sheet["!ref"];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);

  for (let r = range.s.r; r <= Math.min(range.s.r + maxScan, range.e.r); r++) {
    let headerCount = 0;
    for (let c = range.s.c; c <= Math.min(range.s.c + 5, range.e.c); c++) {
      const cell = lookupCell(sheet, r, c);
      if (
        cell &&
        typeof cell.v === "string" &&
        cell.v.trim().length > 0
      ) {
        headerCount++;
      }
    }
    if (headerCount >= 2) {
      return { row: r, range };
    }
  }
  return null;
}

/**
 * Parse a single sheet into typed rows.
 */
function parseSheet(
  sheet: WorkSheet,
  sheetName: string,
): ParsedSheet {
  const ref = sheet["!ref"];
  const errors: ParseError[] = [];

  if (!ref) {
    return { name: sheetName, headers: [], rows: [], errors };
  }

  const range = XLSX.utils.decode_range(ref);
  const headerInfo = findHeaderRow(sheet, 10);
  if (!headerInfo) {
    return { name: sheetName, headers: [], rows: [], errors };
  }

  const headerRow = headerInfo.row;

  // Extract headers
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = lookupCell(sheet, headerRow, c);
    headers.push(cell ? String(cell.v).trim() : "");
  }

  // Parse data rows
  const rows: ParsedRow[] = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const cells: Record<string, unknown> = {};
    const provenance: CellProvenance[] = [];
    let hasContent = false;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const header = headers[c - range.s.c];
      if (!header || header.trim() === "") continue;

      const cell = lookupCell(sheet, r, c);
      const column = colIndexToLetter(c);
      const { value, isFormula } = parseCellValue(cell, header);

      cells[header] = value;

      if (value !== null && value !== undefined) {
        hasContent = true;
        provenance.push({ sheet: sheetName, row: r, column });
      }

      if (isFormula) {
        errors.push({
          sheet: sheetName,
          row: r,
          column,
          message: `Formula cell at ${sheetName}[${column}${r + 1}] — not evaluated; using cached value`,
        });
      }
    }

    if (!hasContent) continue;

    rows.push({ cells, provenance, isEmpty: false });
  }

  return { name: sheetName, headers, rows, errors };
}

/**
 * Parse an entire workbook.
 * - Reads only known production sheets.
 * - Reports skipped unknown sheets.
 * - Never evaluates macros or formulas.
 */
export function parseWorkbook(workbook: WorkBook): ParseResult {
  const skippedSheets: string[] = [];
  const sheets: ParsedSheet[] = [];
  let totalRows = 0;
  let totalErrors = 0;

  for (const sheetName of workbook.SheetNames) {
    if (!KNOWN_SHEETS.has(sheetName)) {
      skippedSheets.push(sheetName);
      continue;
    }

    const rawSheet = workbook.Sheets[sheetName];
    if (!rawSheet) {
      skippedSheets.push(sheetName);
      continue;
    }

    const parsed = parseSheet(rawSheet, sheetName);
    sheets.push(parsed);
    totalRows += parsed.rows.length;
    totalErrors += parsed.errors.length;
  }

  return { sheets, skippedSheets, totalRows, totalErrors };
}

/**
 * Load a workbook from a buffer, without evaluating macros or formulas.
 * The xlsx library is configured to read cell values as data only.
 */
export function loadWorkbook(buffer: Buffer): WorkBook {
  return XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    raw: true,
    cellDates: false,
    sheetStubs: false,
    dense: false,
  });
}
