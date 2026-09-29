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

/** Convert raw cell value: number untuk angka murni, string untuk % dan teks. */
function toCellValue(raw: unknown): string | number {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : '';
  if (typeof raw === 'boolean') return raw ? 'Ya' : 'Tidak';
  if (typeof raw !== 'string') return String(raw);

  const s = raw.trim();
  if (!s || s === '—' || s === '-' || s === '–' || s === 'n/a' || s === 'N/A') return '';

  // String dengan % → tetap string
  if (s.endsWith('%')) return s;

  // Handle prefix + (mis. "+2.50")
  let normalized = s.startsWith('+') ? s.slice(1) : s;

  // Format ID dengan titik ribuan: "1.234" atau "1.234,56"
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(',', '.');
  }

  // Parse sebagai number kalau numeric murni
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    if (Number.isFinite(n)) return n;
  }

  return s;
}

/** Kolom persen: 98.32 → "98.32%" */
export function fmtPct(v: unknown): string {
  if (v === null || v === undefined || v === '—') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(2)}%`;
}

/** Kolom persen bertanda (+/-): 2.5 → "+2.50%", -1.2 → "-1.20%" */
export function fmtSignedPct(v: unknown): string {
  if (v === null || v === undefined || v === '—') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/** Kolom angka murni: 582.75 → 582.75 (number type) */
export function fmtNum(v: unknown): string | number {
  if (v === null || v === undefined || v === '—') return '';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : '';
}

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
      const formatted = col.format ? col.format(raw, row, rowIndex) : raw;
      return toCellValue(formatted);
    });
  });

  const aoa: (string | number)[][] = [];

  if (options.meta && options.meta.length > 0) {
    options.meta.forEach((m) => aoa.push([m.label, m.value]));
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
