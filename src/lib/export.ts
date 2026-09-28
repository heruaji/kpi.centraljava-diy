// src/lib/export.ts
import * as XLSX from 'xlsx';

export type ExportColumn<T> = {
  /** Header yang tampil di kolom Excel */
  header: string;
  /** Ambil nilai dari row. Bisa string key atau fungsi */
  value: keyof T | ((row: T) => unknown);
  /** Format khusus (opsional) */
  format?: (value: unknown, row: T) => string | number | null;
};

export type ExportOptions = {
  /** Nama file tanpa ekstensi, mis: "kpi-lm-area-2026-09-01_2026-09-26-20260928" */
  filename: string;
  /** Nama sheet (tab) di Excel */
  sheetName: string;
  /** Metadata tambahan untuk baris atas (opsional) */
  meta?: Array<{ label: string; value: string }>;
};

/**
 * Export array of objects ke file .xlsx.
 *
 * - Baris 1..N: metadata (kalau ada)
 * - Baris N+1: header kolom
 * - Baris N+2..: data
 */
export function exportToExcel<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  options: ExportOptions,
): void {
  // 1. Bikin header row
  const headers = columns.map((c) => c.header);

  // 2. Bikin data rows
  const dataRows = rows.map((row) => {
    return columns.map((col) => {
      let raw: unknown;
      if (typeof col.value === 'function') {
        raw = col.value(row);
      } else {
        raw = row[col.value];
      }

      if (col.format) {
        return col.format(raw, row);
      }

      // Default formatting
      if (raw === null || raw === undefined) return '';
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'boolean') return raw ? 'Ya' : 'Tidak';
      return String(raw);
    });
  });

  // 3. Bikin array of arrays untuk worksheet
  const aoa: (string | number | null)[][] = [];

  // Metadata di atas
  if (options.meta && options.meta.length > 0) {
    options.meta.forEach((m) => {
      aoa.push([m.label, m.value]);
    });
    aoa.push([]); // baris kosong pemisah
  }

  // Header + data
  aoa.push(headers);
  dataRows.forEach((r) => aoa.push(r));

  // 4. Bikin worksheet + workbook
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName);

  // 5. Auto-set column widths berdasarkan panjang konten
  const maxWidths: number[] = headers.map((h) => String(h).length);
  dataRows.forEach((row) => {
    row.forEach((cell, idx) => {
      const len = cell == null ? 0 : String(cell).length;
      if (len > (maxWidths[idx] ?? 0)) maxWidths[idx] = len;
    });
  });
  worksheet['!cols'] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 40) }));

  // 6. Download
  const filename = options.filename.endsWith('.xlsx')
    ? options.filename
    : `${options.filename}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Helper untuk bikin nama file konsisten.
 * Format: {module}-{scope}-{periode}-{timestamp}.xlsx
 */
export function buildExportFilename(params: {
  module: string;
  scope?: string;
  period?: string | null;
}): string {
  const parts = [params.module];
  if (params.scope) parts.push(params.scope);
  if (params.period) parts.push(params.period);

  const now = new Date();
  const stamp =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  parts.push(stamp);

  return parts
    .join('-')
    .replace(/[^a-zA-Z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}







