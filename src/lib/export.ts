// src/lib/export.ts
import * as XLSX from 'xlsx';

export type ExportColumn<T = any> = {
  header: string;
  value: keyof T | ((row: T, index: number) => unknown);
  format?: (value: unknown, row: T, index: number) => string | number | null;
};

export type ExportOptions = {
  filename: string;
  sheetName: string;
  meta?: Array<{ label: string; value: string }>;
};

export function exportToExcel<T = any>(
  columns: ExportColumn<T>[],
  rows: T[],
  options: ExportOptions,
): void {
  const headers = columns.map((c) => c.header);

  const dataRows = rows.map((row, rowIndex) => {
    return columns.map((col) => {
      let raw: unknown;
      if (typeof col.value === 'function') {
        raw = (col.value as (r: T, i: number) => unknown)(row, rowIndex);
      } else {
        raw = row[col.value as keyof T];
      }

      if (col.format) {
        return col.format(raw, row, rowIndex);
      }

      if (raw === null || raw === undefined) return '';
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'boolean') return raw ? 'Ya' : 'Tidak';
      return String(raw);
    });
  });

  const aoa: (string | number | null)[][] = [];

  if (options.meta && options.meta.length > 0) {
    options.meta.forEach((m) => {
      aoa.push([m.label, m.value]);
    });
    aoa.push([]);
  }

  aoa.push(headers);
  dataRows.forEach((r) => aoa.push(r));

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName);

  const maxWidths: number[] = headers.map((h) => String(h).length);
  dataRows.forEach((row) => {
    row.forEach((cell, idx) => {
      const len = cell == null ? 0 : String(cell).length;
      if (len > (maxWidths[idx] ?? 0)) maxWidths[idx] = len;
    });
  });
  worksheet['!cols'] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 40) }));

  const filename = options.filename.endsWith('.xlsx')
    ? options.filename
    : `${options.filename}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function buildExportFilename(params: {
  module: string;
  scope?: string;
  period?: string | null;
}): string {
  const parts: string[] = [params.module];
  if (params.scope) parts.push(params.scope);
  if (params.period) parts.push(params.period);

  const now = new Date();
  const stamp =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}`;
  parts.push(stamp);

  return parts
    .join('-')
    .replace(/[^a-zA-Z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}
