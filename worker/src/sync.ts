// worker/src/sync.ts
import { getSheetGridRowCount, readRangeRaw, readSheet, type EnvSource, type Row } from './data-source';
import {
  neonGetSyncStateForSheet,
  neonSetSyncState,
  neonUpsertBatch,
  type NeonSyncEnv,
  getSheetDef,
  type SheetDef,
} from './neon-sync';

export interface SyncEnv extends EnvSource, NeonSyncEnv {
  DB: D1Database;
}

function requireNeon(env: SyncEnv): NeonSyncEnv {
  if (!env.NEON_DATABASE_URL) {
    throw new Error('NEON_DATABASE_URL is not configured');
  }
  return env;
}

function rowsFromRaw(headerValues: unknown[][], dataValues: unknown[][]): Row[] {
  const header = (headerValues[0] || []).map(String);
  return dataValues
    .filter((r) => r.some((v) => v !== '' && v != null))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
}

async function syncRowsToNeon(
  env: SyncEnv,
  def: SheetDef,
  rows: Row[],
): Promise<number> {
  return neonUpsertBatch(
    requireNeon(env),
    def.table,
    rows,
    def.extractKey,
    def.extractDate,
  );
}

/**
 * Full raw sync: Google Sheets -> Neon.
 * Neon is the only raw-data destination and sync-state authority.
 */
export async function fullSync(
  env: SyncEnv,
): Promise<{ sheet: string; rows: number }[]> {
  requireNeon(env);

  const results: { sheet: string; rows: number }[] = [];

  for (const sheetName of ['SLA', 'KPI LM', 'KPI FM', 'KPI MM']) {
    const def = getSheetDef(sheetName);

    try {
      const rows = await readSheet(env, def.sheet, `A:${def.maxColumn}`);
      const written = await syncRowsToNeon(env, def, rows);

      await neonSetSyncState(env, def.sheet, {
        lastRow: rows.length + 1,
        totalRows: rows.length,
        status: 'OK',
        error: null,
      });

      console.log(
        `[sync] ${def.sheet}: input=${rows.length}, neonWritten=${written}`,
      );
      results.push({ sheet: def.sheet, rows: written });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      try {
        await neonSetSyncState(env, def.sheet, {
          status: 'ERROR',
          error: message,
        });
      } catch (stateErr) {
        console.error(`[sync] ${def.sheet} state update failed:`, stateErr);
      }
      results.push({ sheet: def.sheet, rows: 0 });
    }
  }

  return results;
}

/**
 * Incremental sync — only reads rows after the last Neon sync position.
 *
 * Invariant:
 * 1. Read last_row from Neon.
 * 2. Read new rows from Google Sheets.
 * 3. Write raw rows to Neon.
 * 4. Advance Neon last_row only after the raw write succeeds.
 *
 * D1 is intentionally not involved in raw sync or sync-state authority.
 */
export async function incrementalSync(
  env: SyncEnv,
): Promise<
  {
    sheet: string;
    newRows: number;
    validRows: number;
    neonWritten: number;
    lastRow: number;
  }[]
> {
  requireNeon(env);

  const results: {
    sheet: string;
    newRows: number;
    validRows: number;
    neonWritten: number;
    lastRow: number;
  }[] = [];

  for (const sheetName of ['SLA', 'KPI LM', 'KPI FM', 'KPI MM']) {
    const def = getSheetDef(sheetName);

    try {
      const state = await neonGetSyncStateForSheet(env, def.sheet);
      const lastRow = state?.last_row ?? 1;
      const rowCount = await getSheetGridRowCount(env, def.sheet);

      if (lastRow >= rowCount) {
        await neonSetSyncState(env, def.sheet, {
          status: 'OK',
          error: null,
        });
        results.push({
          sheet: def.sheet,
          newRows: 0,
          validRows: 0,
          neonWritten: 0,
          lastRow,
        });
        continue;
      }

      const [headerValues, newValues] = await Promise.all([
        readRangeRaw(env, def.sheet, `A1:${def.maxColumn}1`),
        readRangeRaw(env, def.sheet, `A${lastRow + 1}:${def.maxColumn}${rowCount}`),
      ]);

      if (newValues.length === 0) {
        results.push({
          sheet: def.sheet,
          newRows: 0,
          validRows: 0,
          neonWritten: 0,
          lastRow,
        });
        continue;
      }

      const rows = rowsFromRaw(headerValues, newValues);
      const neonWritten = await syncRowsToNeon(env, def, rows);
      const currentLastRow = lastRow + newValues.length;

      await neonSetSyncState(env, def.sheet, {
        lastRow: currentLastRow,
        totalRows: currentLastRow - 1,
        status: 'OK',
        error: null,
      });

      console.log(
        `[sync] ${def.sheet}: sourceRows=${newValues.length}, validRows=${rows.length}, neonWritten=${neonWritten}, lastRow=${currentLastRow}`,
      );

      results.push({
        sheet: def.sheet,
        newRows: newValues.length,
        validRows: rows.length,
        neonWritten,
        lastRow: currentLastRow,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      try {
        await neonSetSyncState(env, def.sheet, {
          status: 'ERROR',
          error: message,
        });
      } catch (stateErr) {
        console.error(`[sync] ${def.sheet} state update failed:`, stateErr);
      }
      console.error(`[sync] ${def.sheet} failed:`, err);
      results.push({
        sheet: def.sheet,
        newRows: 0,
        validRows: 0,
        neonWritten: 0,
        lastRow: 0,
      });
    }
  }

  return results;
}

/**
 * Read a raw sheet chunk into Neon.
 * Kept as the main implementation for initial backfill/recovery.
 */
export async function syncChunk(
  env: SyncEnv,
  sheetName: string,
  startRow: number,
  maxRows = 1000,
): Promise<{
  sheet: string;
  synced: number;
  hasMore: boolean;
  nextRow: number;
}> {
  requireNeon(env);

  const def = getSheetDef(sheetName);
  const rowCount = await getSheetGridRowCount(env, def.sheet);
  if (startRow > rowCount) {
    await neonSetSyncState(env, def.sheet, {
      lastRow: rowCount,
      totalRows: Math.max(0, rowCount - 1),
      status: 'OK',
      error: null,
    });
    return { sheet: def.sheet, synced: 0, hasMore: false, nextRow: startRow };
  }

  const endRow = Math.min(startRow + maxRows - 1, rowCount);

  const [headerValues, dataValues] = await Promise.all([
    readRangeRaw(env, def.sheet, `A1:${def.maxColumn}1`),
    readRangeRaw(env, def.sheet, `A${startRow}:${def.maxColumn}${endRow}`),
  ]);

  const rows = rowsFromRaw(headerValues, dataValues);
  const synced = await syncRowsToNeon(env, def, rows);
  const hasMore = endRow < rowCount && dataValues.length === maxRows;
  const nextRow = endRow + 1;

  await neonSetSyncState(env, def.sheet, {
    lastRow: endRow,
    totalRows: endRow - 1,
    status: 'OK',
    error: null,
  });

  return { sheet: def.sheet, synced, hasMore, nextRow };
}
