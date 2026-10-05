// worker/src/d1-sync.ts
import type { Row } from './data-source';

export interface D1SyncEnv {
  DB: D1Database;
}

const excelDate = (v: unknown): string | null => {
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const normHub = (v: unknown) =>
  String(v || '').trim().toLowerCase().replace(/^t?\d+\s*-\s*/, '');

export type SheetDef = {
  sheet: string;
  table: string;
  maxColumn: string;
  extractKey: (row: Row) => string | null;
  extractDate: (row: Row) => string | null;
};

export const SHEETS: SheetDef[] = [
  {
    sheet: 'SLA',
    table: 'sla_rows',
    maxColumn: 'AC',
    extractDate: (r) => excelDate(r.PERIODE),
    extractKey: (r) => {
      const date = excelDate(r.PERIODE);
      const hub = normHub(r.Nama_Hub);
      const mile = String(r.Mile || '').trim().toUpperCase() || 'LM';
      if (!date || !hub) return null;
      return `${date}|${hub}|${mile}`;
    },
  },
  {
    sheet: 'KPI LM',
    table: 'lm_rows',
    maxColumn: 'AQ',
    extractDate: (r) => excelDate(r.GRANULAR_DATE),
    extractKey: (r) => {
      const date = excelDate(r.GRANULAR_DATE);
      const hub = normHub(r['Hub Name'] || r['Nama Hub']);
      if (!date || !hub) return null;
      return `${date}|${hub}`;
    },
  },
  {
    sheet: 'KPI FM',
    table: 'fm_rows',
    maxColumn: 'AO',
    extractDate: (r) => excelDate(r.GRANULAR_DATE),
    extractKey: (r) => {
      const date = excelDate(r.GRANULAR_DATE);
      const hub = normHub(r['Hub Name'] || r['Nama Hub']);
      if (!date || !hub) return null;
      return `${date}|${hub}`;
    },
  },
  {
    sheet: 'KPI MM',
    table: 'mm_rows',
    maxColumn: 'AK',
    extractDate: (r) => excelDate(r.GRANULAR_DATE),
    extractKey: (r) => {
      const date = excelDate(r.GRANULAR_DATE);
      const sortation = normHub(r['Sortation Name']);
      if (!date || !sortation) return null;
      return `${date}|${sortation}`;
    },
  },
];

export function getSheetDef(sheet: string): SheetDef {
  const def = SHEETS.find((item) => item.sheet === sheet);
  if (!def) throw new Error(`Sheet tidak dikenal: ${sheet}`);
  return def;
}

/**
 * Batch upsert rows ke D1.
 * D1 = SQLite. Pakai prepared statement + batch().
 */
export async function d1UpsertBatch(
  env: D1SyncEnv,
  table: string,
  rows: Row[],
  keyFn: (r: Row) => string | null,
  dateFn: (r: Row) => string | null,
): Promise<number> {
  if (!rows.length) return 0;

  const syncedAt = new Date().toISOString();

  const prepared = rows
    .map((r) => {
      const key = keyFn(r);
      const date = dateFn(r);
      if (!key || !date) return null;
      return { key, date, payload: JSON.stringify(r) };
    })
    .filter((x): x is { key: string; date: string; payload: string } => x !== null);

  if (!prepared.length) return 0;

  // D1 batch limit — aman 50 rows per batch
  const CHUNK = 50;
  let total = 0;

  for (let i = 0; i < prepared.length; i += CHUNK) {
    const chunk = prepared.slice(i, i + CHUNK);
    const stmts = chunk.map((x) =>
      env.DB.prepare(
        `INSERT INTO ${table} (row_key, date, payload, synced_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(row_key) DO UPDATE SET
           date = excluded.date,
           payload = excluded.payload,
           synced_at = excluded.synced_at
         WHERE ${table}.payload IS NOT excluded.payload`,
      ).bind(x.key, x.date, x.payload, syncedAt),
    );
    await env.DB.batch(stmts);
    total += chunk.length;
  }

  return total;
}

export async function d1GetSyncStateForSheet(
  env: D1SyncEnv,
  sheet: string,
): Promise<{ sheet: string; last_row: number; total_rows: number; last_synced_at: string; last_status: string; last_error: string | null } | null> {
  const row = await env.DB.prepare(
    `SELECT sheet, last_row, total_rows, last_synced_at, last_status, last_error
     FROM sheet_sync_state WHERE sheet = ? LIMIT 1`,
  ).bind(sheet).first();
  return (row as any) || null;
}

export async function d1SetSyncState(
  env: D1SyncEnv,
  sheet: string,
  state: {
    lastRow?: number;
    totalRows?: number;
    status?: string;
    error?: string | null;
  },
): Promise<void> {
  const current = await d1GetSyncStateForSheet(env, sheet);
  const lastRow = state.lastRow ?? current?.last_row ?? 1;
  const totalRows = state.totalRows ?? current?.total_rows ?? Math.max(0, lastRow - 1);
  const status = state.status ?? current?.last_status ?? 'OK';
  const error = state.error === undefined ? (current?.last_error ?? null) : state.error;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO sheet_sync_state (sheet, last_row, total_rows, last_synced_at, last_status, last_error)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(sheet) DO UPDATE SET
       last_row = excluded.last_row,
       total_rows = excluded.total_rows,
       last_synced_at = excluded.last_synced_at,
       last_status = excluded.last_status,
       last_error = excluded.last_error`,
  ).bind(sheet, lastRow, totalRows, now, status, error).run();
}

export async function d1GetSyncState(env: D1SyncEnv) {
  const rows = await env.DB.prepare(
    `SELECT sheet, last_row, total_rows, last_synced_at, last_status, last_error
     FROM sheet_sync_state ORDER BY sheet`,
  ).all();
  return rows.results || [];
}
