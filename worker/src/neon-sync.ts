// worker/src/neon-sync.ts
import { readRangeRaw, type Row } from './data-source';
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

type SheetDef = {
  sheet: string;
  table: string;
  maxColumn: string;
  extractKey: (row: Row) => string | null;
  extractDate: (row: Row) => string | null;
};

const SHEETS: SheetDef[] = [
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

/**
 * Batch upsert rows ke Neon pakai multi-row INSERT.
 * Max ~500 rows per call untuk hindari query terlalu panjang.
 */
async function neonUpsertBatch(
  env: NeonSyncEnv,
  table: string,
  rows: Row[],
  keyFn: (r: Row) => string | null,
  dateFn: (r: Row) => string | null,
): Promise<number> {
  if (!rows.length) return 0;

  const sql = getNeonClient(env);
  const syncedAt = new Date().toISOString();

  // Filter valid rows + build values
  const prepared = rows
    .map((r) => {
      const key = keyFn(r);
      const date = dateFn(r);
      if (!key || !date) return null;
      return { key, date, payload: JSON.stringify(r) };
    })
    .filter((x): x is { key: string; date: string; payload: string } => x !== null);

  if (!prepared.length) return 0;

  // Chunk into sub-batches of 200 (Neon: max 65535 parameter per query)
  const CHUNK = 200;
  let total = 0;

  for (let i = 0; i < prepared.length; i += CHUNK) {
    const chunk = prepared.slice(i, i + CHUNK);

    // Build multi-row VALUES: ($1, $2, $3::jsonb, $4::timestamptz), ($5, $6, $7, $8), ...
    const valueClauses: string[] = [];
    const params: unknown[] = [];

    chunk.forEach((row, idx) => {
      const base = idx * 4;
      valueClauses.push(
        `($${base + 1}, $${base + 2}::date, $${base + 3}::jsonb, $${base + 4}::timestamptz)`,
      );
      params.push(row.key, row.date, row.payload, syncedAt);
    });

    const query = `
      INSERT INTO ${table} (row_key, date, payload, synced_at)
      VALUES ${valueClauses.join(', ')}
      ON CONFLICT (row_key) DO UPDATE SET
        date = EXCLUDED.date,
        payload = EXCLUDED.payload,
        synced_at = EXCLUDED.synced_at
      WHERE ${table}.payload IS DISTINCT FROM EXCLUDED.payload
    `;

    // Pakai sql.query untuk dynamic SQL
    await (sql as any).query(query, params);
    total += chunk.length;
  }

  return total;
}

/**
 * Sync chunk dari 1 sheet → Neon.
 * Baca startRow..startRow+maxRows-1, write ke Neon, update sheet_sync_state.
 */
export async function neonSyncChunk(
  env: NeonSyncEnv,
  sheetName: string,
  startRow: number,
  maxRows: number = 1000,
): Promise<{
  sheet: string;
  synced: number;
  hasMore: boolean;
  nextRow: number;
}> {
  const def = SHEETS.find((s) => s.sheet === sheetName);
  if (!def) throw new Error(`Sheet tidak dikenal: ${sheetName}`);

  const endRow = startRow + maxRows - 1;

  // Baca header + data paralel
  const [headerValues, dataValues] = await Promise.all([
    readRangeRaw(env, def.sheet, `A1:${def.maxColumn}1`),
    readRangeRaw(env, def.sheet, `A${startRow}:${def.maxColumn}${endRow}`),
  ]);

  const header = (headerValues[0] || []).map(String);
  const rows: Row[] = dataValues
    .filter((r) => r.some((v) => v !== '' && v != null))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));

  // Upsert ke Neon
  const synced = await neonUpsertBatch(env, def.table, rows, def.extractKey, def.extractDate);

  // hasMore = dataValues.length === maxRows (kemungkinan masih ada lagi)
  const hasMore = dataValues.length === maxRows;
  const nextRow = endRow + 1;

  // Update sheet_sync_state di Neon
  const sql = getNeonClient(env);
  await (sql as any).query(
    `INSERT INTO sheet_sync_state (sheet, last_row, total_rows, last_synced_at, last_status, last_error)
     VALUES ($1, $2, $3, NOW(), 'OK', NULL)
     ON CONFLICT (sheet) DO UPDATE SET
       last_row = EXCLUDED.last_row,
       total_rows = EXCLUDED.total_rows,
       last_synced_at = EXCLUDED.last_synced_at,
       last_status = 'OK',
       last_error = NULL`,
    [def.sheet, endRow, endRow - 1],
  );

  return { sheet: def.sheet, synced, hasMore, nextRow };
}

export async function neonGetSyncState(env: NeonSyncEnv) {
  const sql = getNeonClient(env);
  const result = await (sql as any).query(
    `SELECT sheet, last_row, total_rows, last_synced_at, last_status, last_error 
     FROM sheet_sync_state 
     ORDER BY sheet`,
  );
  return result;
}