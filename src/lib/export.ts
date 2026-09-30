// src/lib/export.ts
import * as XLSX from 'xlsx';

export type ExportCellType =
  | 'text'
  | 'number'
  | 'percent'
  | 'signed-percent'
  | 'signed-number'
  | 'date';

export type ExportColumn<T = any> = {
  header: string;
  value: keyof T | ((row: T, index: number) => unknown);
  format?: (value: unknown, row: T, index: number) => string | number | null;
  type?: ExportCellType;
};

export type ExportOptions = {
  filename: string;
  sheetName: string;
  meta?: Array<{ label: string; value: string }>;
};

// ================= Parsing helpers =================

function parseNum(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s === '—' || s === '-' || s === '–' || s === 'n/a' || s === 'N/A') return null;
  let n = s.startsWith('+') ? s.slice(1) : s;
  n = n.replace(/%$/, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(n)) {
    n = n.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d+$/.test(n)) {
    n = n.replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(n)) return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function parseDate(raw: unknown): Date | null {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Excel serial date (days since 1899-12-30). */
function toExcelSerial(d: Date): number {
  return d.getTime() / 86400000 + 25569;
}

// ================= Auto type detection =================

function detectType(header: string): ExportCellType {
  const h = String(header).toLowerCase().trim();

  if (h === 'tanggal' || h === 'date' || h === 'periode') return 'date';
  if (h === 'gap' || h === 'gap ke target' || h === 'perubahan') return 'signed-percent'; if (h === 'target') return 'percent';

  if (
    h === 'sla' || h === 'sla aktif' || h === 'sla bulan lalu' ||
    h === 'cod transferred' || h === 'total score' || h === 'actual' ||
    h === 'max penalty' || h === 'weight' ||
    h.startsWith('kpi ') || h.endsWith(' rate') ||
    h.includes('(pencapaian)')
  ) return 'percent';

  if (
    h === 'no' || h === 'rank' || h === 'volume' || h === 'backlog' ||
    h === 'productivity' || h === 'performa sebelumnya' ||
    h === 'sorter fm' || h === 'sorter lm' || h === 'kurir fm' || h === 'kurir lm' ||
    h === 'ranking point' || h === 'jumlah gerai lm' ||
    h === 'manpower lm' || h === 'manpower fm' ||
    h === 'penalty' || h === 'total penalty' || h === 'target' ||
    h === 'failed delivery' || h === 'cod transfer' ||
    h.startsWith('volume paket') || h.startsWith('manpower ') ||
    h.includes('(penalty)')
  ) return 'number';

  return 'text';
}

// ================= Main =================

export function exportToExcel<T = any>(
  columns: ExportColumn<T>[],
  rows: T[],
  options: ExportOptions,
): void {
  const headers = columns.map((c) => c.header);
  const types = columns.map((c) => c.type ?? detectType(c.header));

  const dataRows: (string | number)[][] = rows.map((row, rowIndex) =>
    columns.map((col, colIdx) => {
      let raw: unknown;
      if (typeof col.value === 'function') {
        raw = (col.value as (r: T, i: number) => unknown)(row, rowIndex);
      } else {
        raw = row[col.value as keyof T];
      }
      const formatted = col.format ? col.format(raw, row, rowIndex) : raw;
      const type = types[colIdx];
      const fallback = formatted === null || formatted === undefined ? '' : String(formatted);

      if (type === 'date') {
        const d = parseDate(raw) ?? parseDate(formatted);
        return d ? toExcelSerial(d) : '';
      }
      if (type === 'percent' || type === 'signed-percent') {
        const n = parseNum(formatted);
        return n === null ? fallback : n / 100;
      }
      if (type === 'number' || type === 'signed-number') {
        const n = parseNum(formatted);
        return n === null ? fallback : n;
      }
      return fallback;
    }),
  );

  const aoa: any[][] = [];
  if (options.meta && options.meta.length > 0) {
    options.meta.forEach((m) => aoa.push([m.label, m.value]));
    aoa.push([]);
  }
  const headerRowIdx = aoa.length;
  aoa.push(headers);
  dataRows.forEach((r) => aoa.push(r));

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  const dataStartRow = headerRowIdx + 1;
  const dataEndRow = dataStartRow + rows.length - 1;
  for (let R = dataStartRow; R <= dataEndRow; R++) {
    for (let C = 0; C < columns.length; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[addr] as XLSX.CellObject | undefined;
      if (!cell || cell.v === '' || cell.v === undefined || cell.v === null) continue;
      if (typeof cell.v !== 'number') continue;
      const type = types[C];
      switch (type) {
        case 'date':
          cell.t = 'n';
          cell.z = 'dd/mm/yyyy';
          break;
        case 'percent':
          cell.t = 'n';
          cell.z = '0.##%';
          break;
        case 'signed-percent':
          cell.t = 'n';
          cell.z = '+0.##%;-0.##%';
          break;
        case 'number':
          cell.t = 'n';
          const v = cell.v as number;
          cell.z = Number.isInteger(v) ? '#,##0' : '#,##0.##';
          break;
        case 'signed-number':
          cell.t = 'n';
          const v = cell.v as number;
          cell.z = Number.isInteger(v) ? '+#,##0;-#,##0' : '+#,##0.##;-#,##0.##';
          break;
        default:
          break;
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName);

  const maxWidths: number[] = headers.map((h) => Math.min(String(h).length, 22));
  dataRows.forEach((row) => {
    row.forEach((cell, idx) => {
      const len = cell == null || cell === '' ? 0 : String(cell).length;
      if (len > maxWidths[idx]) maxWidths[idx] = len;
    });
  });
  worksheet['!cols'] = maxWidths.map((w, i) => {
    const min = types[i] === 'date' ? 10 : 8;
    return { wch: Math.min(Math.max(w + 1, min), 20) };
  });

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
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  parts.push(stamp);
  return parts
    .join('-')
    .replace(/[^a-zA-Z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}
