import * as ExcelJS from "exceljs";
import {
  exportPayloadSchema,
  neutralizeExportRow,
  type ExportPayload,
  type ExportScope,
  type ExportFormat,
} from "@model-monitor/schemas";

type Row = Record<string, unknown>;

export function buildExportPayload(input: Omit<ExportPayload, "exportedAt"> & { exportedAt?: string }): ExportPayload {
  const payload = { ...input, exportedAt: input.exportedAt ?? new Date().toISOString() };
  return exportPayloadSchema.parse(payload);
}

function rowsFor(payload: ExportPayload): Array<[string, Row[]]> {
  const sections: Array<[string, Row[]]> = [];
  for (const key of ["models", "subscriptions", "access", "benchmarks", "scores", "sources", "provenance"] as const) {
    const rows = payload[key];
    if (rows && rows.length > 0) sections.push([key, rows]);
  }
  return sections;
}

function columnsFor(rows: Row[]): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (columns.indexOf(key) === -1) columns.push(key);
  }
  return columns;
}

function scalar(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
}

export function serializeCsv(payload: ExportPayload): string {
  const lines: string[] = [];
  for (const [section, rows] of rowsFor(payload)) {
    const columns = columnsFor(rows);
    lines.push([section, ...columns].map(escapeCsv).join(","));
    for (const row of rows) lines.push(columns.map((c) => escapeCsv(scalar(row[c]))).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function escapeCsv(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function serializeXlsx(payload: ExportPayload): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date(0);
  for (const [section, rows] of rowsFor(payload)) {
    const sheet = workbook.addWorksheet(section.slice(0, 31));
    const columns = columnsFor(rows);
    sheet.addRow(columns);
    for (const row of rows) sheet.addRow(columns.map((c) => scalar(row[c])));
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function serializeExport(payload: ExportPayload, format: ExportFormat): Promise<Uint8Array> {
  if (format === "json") return new TextEncoder().encode(JSON.stringify(payload, null, 2));
  if (format === "csv") return new TextEncoder().encode(serializeCsv(payload));
  return serializeXlsx(payload);
}

export function filename(scope: ExportScope, format: ExportFormat): string {
  return `model-monitor-${scope}.${format}`;
}

export const mimeTypes: Record<ExportFormat, string> = {
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function preparePayload(payload: ExportPayload): ExportPayload {
  return payload.formulasNeutralized ? payload : neutralizeExportRow(payload as unknown as Row) as ExportPayload;
}
