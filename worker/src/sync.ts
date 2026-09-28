// worker/src/sync.ts
import { readSheet, readRangeRaw, type EnvSource, type Row } from './data-source'; import { neonUpsertBatch, type NeonSyncEnv } from './neon-sync';

export interface SyncEnv extends EnvSource {
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

const BATCH_SIZE = 100;

async function upsertBatch(
  env: SyncEnv,
  def: SheetDef,
  rows: Row[],
): Promise<number> {
  const syncedAt = new Date().toISOString();
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const stmts = chunk
      .map((row) => {
        const key = def.extractKey(row);
        const date = def.extractDate(row);
        if (!key || !date) return null;
        return env.DB.prepare(
          `INSERT INTO ${def.table} (row_key, date, payload, synced_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(row_key) DO UPDATE SET
             date = excluded.date,
             payload = excluded.payload,
             synced_at = excluded.synced_at
           WHERE payload != excluded.payload`,
        ).bind(key, date, JSON.stringify(row), syncedAt);
      })
      .filter((s): s is D1PreparedStatement => s !== null);

    if (stmts.length) {
      await env.DB.batch(stmts);
      total += stmts.length;
    }
  }
  return total;
}

async function fullSyncOne(env: SyncEnv, def: SheetDef) {
  const rows = await readSheet(env, def.sheet, `A:${def.maxColumn}`);
  await upsertBatch(env, def, rows);
  await env.DB.prepare(
    `UPDATE sheet_sync_state SET last_row = ?, total_rows = ?, last_synced_at = ?, last_status = 'OK', last_error = NULL WHERE sheet = ?`,
  )
    .bind(rows.length + 1, rows.length, new Date().toISOString(), def.sheet)
    .run();
}

export async function fullSync(
  env: SyncEnv,
): Promise<{ sheet: string; rows: number }[]> {
  const results: { sheet: string; rows: number }[] = [];

  for (const def of SHEETS) {
    try {
      const rows = await readSheet(env, def.sheet, `A:${def.maxColumn}`);
      const upserted = await upsertBatch(env, def, rows); console.log(`[sync] ${def.sheet}: input=${rows.length}, written=${upserted}`);

      await env.DB.prepare(
        `INSERT INTO sheet_sync_state (sheet, last_row, total_rows, last_synced_at, last_status, last_error)
         VALUES (?, ?, ?, ?, 'OK', NULL)
         ON CONFLICT(sheet) DO UPDATE SET
           last_row = excluded.last_row,
           total_rows = excluded.total_rows,
           last_synced_at = excluded.last_synced_at,
           last_status = 'OK',
           last_error = NULL`,
      )
        .bind(def.sheet, rows.length + 1, rows.length, new Date().toISOString())
        .run();

      results.push({ sheet: def.sheet, rows: upserted });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await env.DB.prepare(
        `INSERT INTO sheet_sync_state (sheet, last_row, total_rows, last_synced_at, last_status, last_error)
         VALUES (?, 1, 0, ?, 'ERROR', ?)
         ON CONFLICT(sheet) DO UPDATE SET
           last_synced_at = excluded.last_synced_at,
           last_status = 'ERROR',
           last_error = excluded.last_error`,
      )
        .bind(def.sheet, new Date().toISOString(), message)
        .run();
      results.push({ sheet: def.sheet, rows: 0 });
    }
  }

  return results;
}

/**
 * Incremental sync — HANYA baca baris baru (setelah last_row) + header sekali.
 *
 * Optimasi:
 * - Tidak baca kolom A seluruh sheet (yang tadinya 32k baris per sheet).
 * - Hanya baca header (1 baris) + baris baru.
 * - Total API call: 2 per sheet (header + data baru).
 *
 * Fix bug lama:
 * - Sebelumnya pakai `readSheet()` yang treat baris pertama sebagai header.
 *   Karena range mulai dari `A{last_row+1}:...`, baris pertama data dianggap
 *   header dan ikut ter-skip. Sekarang baca header terpisah.
 */
export async function incrementalSync(
  env: SyncEnv,
): Promise<{ sheet: string; newRows: number }[]> {
  const results: { sheet: string; newRows: number }[] = [];

  for (const def of SHEETS) {
    try {
      const state = await env.DB.prepare(
        `SELECT last_row FROM sheet_sync_state WHERE sheet = ?`,
      )
        .bind(def.sheet)
        .first<{ last_row: number }>();

      const lastRow = state?.last_row ?? 1;

      // Baca HANYA baris baru (dari lastRow + 1) + header terpisah
      const [headerValues, newValues] = await Promise.all([
        readRangeRaw(env, def.sheet, `A1:${def.maxColumn}1`),
        readRangeRaw(env, def.sheet, `A${lastRow + 1}:${def.maxColumn}`),
      ]);

      // Kalau tidak ada baris baru, skip
      if (newValues.length === 0) {
        results.push({ sheet: def.sheet, newRows: 0 });
        continue;
      }

      const header = (headerValues[0] || []).map(String);
      const rows: Row[] = newValues
        .filter((r) => r.some((v) => v !== '' && v != null))
        .map((r) =>
          Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])),
        );

      const upserted = await upsertBatch(env, def, rows); console.log(`[sync] ${def.sheet}: input=${rows.length}, written=${upserted}`);
      const currentCount = lastRow + newValues.length;

      await env.DB.prepare(
        `UPDATE sheet_sync_state
         SET last_row = ?, total_rows = ?, last_synced_at = ?, last_status = 'OK', last_error = NULL
         WHERE sheet = ?`,
      )
        .bind(
          currentCount,
          currentCount - 1,
          new Date().toISOString(),
          def.sheet,
        )
        .run();

      results.push({ sheet: def.sheet, newRows: upserted });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await env.DB.prepare(
        `UPDATE sheet_sync_state SET last_status = 'ERROR', last_error = ? WHERE sheet = ?`,
      )
        .bind(message, def.sheet)
        .run();
      results.push({ sheet: def.sheet, newRows: 0 });
    }
  }

  return results;
}

// ============================================================
// CHUNKED SYNC
// ============================================================

const SHEET_TOTAL_KEY = (sheet: string) => `sync:total-rows:${sheet}`;
const SHEET_TOTAL_TTL = 300;

async function getSheetTotalRows(env: SyncEnv, sheet: string): Promise<number> {
  if (env.DASHBOARD_CACHE) {
    try {
      const cached = await env.DASHBOARD_CACHE.get(SHEET_TOTAL_KEY(sheet));
      if (cached) {
        const parsed = parseInt(cached, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    } catch {}
  }

  const dateColumn = await readRangeRaw(env, sheet, 'A:A');
  const count = dateColumn.length;

  if (env.DASHBOARD_CACHE) {
    try {
      await env.DASHBOARD_CACHE.put(SHEET_TOTAL_KEY(sheet), String(count), {
        expirationTtl: SHEET_TOTAL_TTL,
      });
    } catch {}
  }

  return count;
}

async function invalidateSheetTotal(env: SyncEnv, sheet: string) {
  if (env.DASHBOARD_CACHE) {
    try {
      await env.DASHBOARD_CACHE.delete(SHEET_TOTAL_KEY(sheet));
    } catch {}
  }
}

export async function syncChunk(
  env: SyncEnv,
  sheetName: string,
  startRow: number,
  maxRows: number = 1000,
): Promise<{
  sheet: string;
  synced: number;
  hasMore: boolean;
  nextRow: number;
  totalRows: number;
}> {
  const def = SHEETS.find((s) => s.sheet === sheetName);
  if (!def) throw new Error(`Sheet tidak dikenal: ${sheetName}`);

  const totalSheetRows = await getSheetTotalRows(env, def.sheet);

  if (startRow > totalSheetRows) {
    await env.DB.prepare(
      `UPDATE sheet_sync_state SET last_row = ?, last_synced_at = ?, last_status = 'OK', last_error = NULL WHERE sheet = ?`,
    )
      .bind(startRow, new Date().toISOString(), def.sheet)
      .run();
    await invalidateSheetTotal(env, def.sheet);
    return {
      sheet: def.sheet,
      synced: 0,
      hasMore: false,
      nextRow: startRow,
      totalRows: totalSheetRows,
    };
  }

  const endRow = Math.min(startRow + maxRows - 1, totalSheetRows);

  const [headerValues, dataValues] = await Promise.all([
    readRangeRaw(env, def.sheet, `A1:${def.maxColumn}1`),
    readRangeRaw(env, def.sheet, `A${startRow}:${def.maxColumn}${endRow}`),
  ]);

  const header = (headerValues[0] || []).map(String);
  const rows: Row[] = dataValues
    .filter((r) => r.some((v) => v !== '' && v != null))
    .map((r) =>
      Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])),
    );

  const upserted = await upsertBatch(env, def, rows); console.log(`[sync] ${def.sheet}: input=${rows.length}, written=${upserted}`);

  const existing = await env.DB.prepare(
    `SELECT total_rows FROM sheet_sync_state WHERE sheet = ?`,
  )
    .bind(def.sheet)
    .first<{ total_rows: number }>();

  const newTotal = Math.max(existing?.total_rows ?? 0, endRow - 1);

  await env.DB.prepare(
    `INSERT INTO sheet_sync_state (sheet, last_row, total_rows, last_synced_at, last_status, last_error)
     VALUES (?, ?, ?, ?, 'OK', NULL)
     ON CONFLICT(sheet) DO UPDATE SET
       last_row = excluded.last_row,
       total_rows = excluded.total_rows,
       last_synced_at = excluded.last_synced_at,
       last_status = 'OK',
       last_error = NULL`,
  )
    .bind(def.sheet, endRow, newTotal, new Date().toISOString())
    .run();

  const hasMore = endRow < totalSheetRows;
  if (!hasMore) {
    await invalidateSheetTotal(env, def.sheet);
  }

  return {
    sheet: def.sheet,
    synced: upserted,
    hasMore,
    nextRow: endRow + 1,
    totalRows: totalSheetRows,
  };
}
