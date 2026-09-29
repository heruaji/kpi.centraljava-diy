// worker/src/neon-sync.ts
import type { Row } from './data-source';
import { getNeonClient, type NeonEnv } from './neon';

export interface NeonSyncEnv extends NeonEnv {
  SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
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

export export export type SheetDef = {
  sheet: string;
  table: string;
  maxColumn: string;
  extractKey: (row: Row) => string | null;
  extractDate: (row: Row) => string | null;
};

export export export const SHEETS: SheetDef[] = [
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
 * Batch upsert rows ke Neon pakai tagged template + UNNEST.
 * Kompatibel dengan @neondatabase/serverless v0.9+.
 */
/**
 * Batch upsert rows ke Neon pakai JSON array + jsonb_array_elements.
 * Lebih robust dari UNNEST multi-array karena:
 * - Tidak ada mismatch panjang array
 * - Handling payload JSON dengan karakter spesial
 * - Hanya 1 parameter untuk N rows
 */
export async function neonUpsertBatch(
  env: NeonSyncEnv,
  table: string,
  rows: Row[],
  keyFn: (r: Row) => string | null,
  dateFn: (r: Row) => string | null,
): Promise<number> {
  if (!rows.length) return 0;

  const sql = getNeonClient(env);
  const syncedAt = new Date().toISOString();

  // Prepare + filter valid rows
  const prepared = rows
    .map((r) => {
      const key = keyFn(r);
      const date = dateFn(r);
      if (!key || !date) return null;
      return {
        key,
        date,
        payload: r as Record<string, unknown>,
      };
    })
    .filter(
      (x): x is { key: string; date: string; payload: Record<string, unknown> } =>
        x !== null,
    );

  if (!prepared.length) return 0;

  // Chunk per 100 rows (lebih kecil, lebih aman)
  const CHUNK = 100;
  let total = 0;

  for (let i = 0; i < prepared.length; i += CHUNK) {
    const chunk = prepared.slice(i, i + CHUNK);

    // Bikin array JSON untuk parameter tunggal
    const items = chunk.map((x) => ({
      key: x.key,
      date: x.date,
      payload: x.payload,
    }));

    // Insert via jsonb_array_elements — 1 parameter saja
    if (table === 'sla_rows') {
      await sql`
        INSERT INTO sla_rows (row_key, date, payload, synced_at)
        SELECT 
          (item->>'key'),
          (item->>'date')::date,
          item->'payload',
          ${syncedAt}::timestamptz
        FROM jsonb_array_elements(${JSON.stringify(items)}::jsonb) AS item
        ON CONFLICT (row_key) DO UPDATE SET
          date = EXCLUDED.date,
          payload = EXCLUDED.payload,
          synced_at = EXCLUDED.synced_at
        WHERE sla_rows.payload IS DISTINCT FROM EXCLUDED.payload
      `;
    } else if (table === 'lm_rows') {
      await sql`
        INSERT INTO lm_rows (row_key, date, payload, synced_at)
        SELECT 
          (item->>'key'),
          (item->>'date')::date,
          item->'payload',
          ${syncedAt}::timestamptz
        FROM jsonb_array_elements(${JSON.stringify(items)}::jsonb) AS item
        ON CONFLICT (row_key) DO UPDATE SET
          date = EXCLUDED.date,
          payload = EXCLUDED.payload,
          synced_at = EXCLUDED.synced_at
        WHERE lm_rows.payload IS DISTINCT FROM EXCLUDED.payload
      `;
    } else if (table === 'fm_rows') {
      await sql`
        INSERT INTO fm_rows (row_key, date, payload, synced_at)
        SELECT 
          (item->>'key'),
          (item->>'date')::date,
          item->'payload',
          ${syncedAt}::timestamptz
        FROM jsonb_array_elements(${JSON.stringify(items)}::jsonb) AS item
        ON CONFLICT (row_key) DO UPDATE SET
          date = EXCLUDED.date,
          payload = EXCLUDED.payload,
          synced_at = EXCLUDED.synced_at
        WHERE fm_rows.payload IS DISTINCT FROM EXCLUDED.payload
      `;
    } else if (table === 'mm_rows') {
      await sql`
        INSERT INTO mm_rows (row_key, date, payload, synced_at)
        SELECT 
          (item->>'key'),
          (item->>'date')::date,
          item->'payload',
          ${syncedAt}::timestamptz
        FROM jsonb_array_elements(${JSON.stringify(items)}::jsonb) AS item
        ON CONFLICT (row_key) DO UPDATE SET
          date = EXCLUDED.date,
          payload = EXCLUDED.payload,
          synced_at = EXCLUDED.synced_at
        WHERE mm_rows.payload IS DISTINCT FROM EXCLUDED.payload
      `;
    } else {
      throw new Error(`Unknown table: ${table}`);
    }
    total += chunk.length;
  }

  return total;
}

export async function neonGetSyncStateForSheet(
  env: NeonSyncEnv,
  sheet: string,
) {
  const sql = getNeonClient(env);
  const rows = await sql`
    SELECT sheet, last_row, total_rows, last_synced_at, last_status, last_error
    FROM sheet_sync_state
    WHERE sheet = ${sheet}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function neonSetSyncState(
  env: NeonSyncEnv,
  sheet: string,
  state: {
    lastRow?: number;
    totalRows?: number;
    status?: string;
    error?: string | null;
  },
): Promise<void> {
  const sql = getNeonClient(env);
  const current = await neonGetSyncStateForSheet(env, sheet);
  const lastRow = state.lastRow ?? current?.last_row ?? 1;
  const totalRows = state.totalRows ?? current?.total_rows ?? Math.max(0, lastRow - 1);
  const status = state.status ?? current?.last_status ?? 'OK';
  const error = state.error === undefined ? current?.last_error ?? null : state.error;

  await sql`
    INSERT INTO sheet_sync_state
      (sheet, last_row, total_rows, last_synced_at, last_status, last_error)
    VALUES
      (${sheet}, ${lastRow}, ${totalRows}, NOW(), ${status}, ${error})
    ON CONFLICT (sheet) DO UPDATE SET
      last_row = EXCLUDED.last_row,
      total_rows = EXCLUDED.total_rows,
      last_synced_at = EXCLUDED.last_synced_at,
      last_status = EXCLUDED.last_status,
      last_error = EXCLUDED.last_error
  `;
}

export async function neonGetSyncState(env: NeonSyncEnv) {
  const sql = getNeonClient(env);
  return await sql`
    SELECT sheet, last_row, total_rows, last_synced_at, last_status, last_error
    FROM sheet_sync_state
    ORDER BY sheet
  `;
}
