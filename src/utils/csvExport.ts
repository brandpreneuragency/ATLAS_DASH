// CSV export utility (RFC 4180 compliant).
// Used by crmService (leads export) and formsService (submissions export).
// Uses file-saver (already a dependency) for downloads.

import { saveAs } from 'file-saver';

/**
 * Quote a single CSV cell per RFC 4180: wrap in double quotes if the value
 * contains a comma, double quote, newline, or carriage return; escape inner
 * double quotes by doubling them.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = String(value);
  } else {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from a list of row objects. If `columns` is omitted, the
 * union of all row keys (in first-seen order) is used as the header.
 */
export function toCsvString(
  rows: Record<string, unknown>[],
  columns?: string[],
): string {
  if (rows.length === 0 && (!columns || columns.length === 0)) {
    return '';
  }
  const cols = columns ?? deriveColumns(rows);
  const header = cols.map(escapeCsvCell).join(',');
  const body = rows
    .map((row) => cols.map((col) => escapeCsvCell(row[col])).join(','))
    .join('\r\n');
  return cols.length === 0 ? '' : `${header}\r\n${body}`;
}

/**
 * Export rows to a CSV file download via file-saver.
 */
export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: string[],
): void {
  const csv = toCsvString(rows, columns);
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

function deriveColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }
  return ordered;
}
