// worker/src/sync.ts
import { getSheetGridRowCount, readRangeRaw, readSheet, type EnvSource, type Row } from './data-source';
import {
  d1GetSyncStateForSheet,
  d1SetSyncState,
  d1UpsertBatch,
  getSheetDef,
  type SheetDef,
} from './d1-sync';

export interface SyncEnv extends EnvSource {
  DB: D1Database;
}

function rowsFromRaw(headerValues: unknown[][], dataValues: unknown[][]): Row[] {
  const header = (headerValues[0] || []).map(String);
  return dataValues
    .filter((r) => r.some((v) => v !== '' && v != null))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
}

async function syncRowsToD1(env: SyncEnv, def: SheetDef, rows: Row[]): Promise<number> {
  return d1UpsertBatch(env, def.table, rows, def.extractKey, def.extractDate);
}

export async function fullSync(env: SyncEnv): Promise<{ sheet: string; rows: number }[]> {
  const results: { sheet: string; rows: number }[] = [];

  for (const sheetName of ['SLA', 'KPI LM', 'KPI FM', 'KPI MM']) {
    const def = getSheetDef(sheetName);
    try {
      const rows = await readSheet(env, def.sheet, `A:${def.maxColumn}`);
      const written = await syncRowsToD1(env, def, rows);
      await d1SetSyncState(env, def.sheet, {
        lastRow: rows.length + 1,
        totalRows: rows.length,
        status: 'OK',
        error: null,
      });
      console.log(`[sync] ${def.sheet}: input=${rows.length}, d1Written=${written}`);
      results.push({ sheet: def.sheet, rows: written });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      try { await d1SetSyncState(env, def.sheet, { status: 'ERROR', error: message }); } catch {}
      console.error(`[sync] ${def.sheet} failed:`, err);
      results.push({ sheet: def.sheet, rows: 0 });
    }
  }
  return results;
}

export async function incrementalSync(env: SyncEnv): Promise<
  { sheet: string; newRows: number; validRows: number; d1Written: number; lastRow: number }[]
> {
  const results: { sheet: string; newRows: number; validRows: number; d1Written: number; lastRow: number }[] = [];

  for (const sheetName of ['SLA', 'KPI LM', 'KPI FM', 'KPI MM']) {
    const def = getSheetDef(sheetName);
    try {
      const state = await d1GetSyncStateForSheet(env, def.sheet);
      const lastRow = state?.last_row ?? 1;
      const rowCount = await getSheetGridRowCount(env, def.sheet);

      if (lastRow >= rowCount) {
        await d1SetSyncState(env, def.sheet, { status: 'OK', error: null });
        results.push({ sheet: def.sheet, newRows: 0, validRows: 0, d1Written: 0, lastRow });
        continue;
      }

      const [headerValues, newValues] = await Promise.all([
        readRangeRaw(env, def.sheet, `A1:${def.maxColumn}1`),
        readRangeRaw(env, def.sheet, `A${lastRow + 1}:${def.maxColumn}${rowCount}`),
      ]);

      if (newValues.length === 0) {
        results.push({ sheet: def.sheet, newRows: 0, validRows: 0, d1Written: 0, lastRow });
        continue;
      }

      const rows = rowsFromRaw(headerValues, newValues);
      const d1Written = await syncRowsToD1(env, def, rows);
      const currentLastRow = lastRow + newValues.length;

      await d1SetSyncState(env, def.sheet, {
        lastRow: currentLastRow,
        totalRows: currentLastRow - 1,
        status: 'OK',
        error: null,
      });

      console.log(`[sync] ${def.sheet}: newRows=${newValues.length}, validRows=${rows.length}, d1Written=${d1Written}, lastRow=${currentLastRow}`);
      results.push({ sheet: def.sheet, newRows: newValues.length, validRows: rows.length, d1Written, lastRow: currentLastRow });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      try { await d1SetSyncState(env, def.sheet, { status: 'ERROR', error: message }); } catch {}
      console.error(`[sync] ${def.sheet} failed:`, err);
      results.push({ sheet: def.sheet, newRows: 0, validRows: 0, d1Written: 0, lastRow: 0 });
    }
  }
  return results;
}

export async function syncChunk(
  env: SyncEnv,
  sheetName: string,
  startRow: number,
  maxRows = 1000,
): Promise<{ sheet: string; synced: number; hasMore: boolean; nextRow: number }> {
  const def = getSheetDef(sheetName);
  const rowCount = await getSheetGridRowCount(env, def.sheet);
  if (startRow > rowCount) {
    await d1SetSyncState(env, def.sheet, { lastRow: rowCount, totalRows: Math.max(0, rowCount - 1), status: 'OK', error: null });
    return { sheet: def.sheet, synced: 0, hasMore: false, nextRow: startRow };
  }
  const endRow = Math.min(startRow + maxRows - 1, rowCount);
  const [headerValues, dataValues] = await Promise.all([
    readRangeRaw(env, def.sheet, `A1:${def.maxColumn}1`),
    readRangeRaw(env, def.sheet, `A${startRow}:${def.maxColumn}${endRow}`),
  ]);
  const rows = rowsFromRaw(headerValues, dataValues);
  const synced = await syncRowsToD1(env, def, rows);
  const hasMore = endRow < rowCount && dataValues.length === maxRows;
  const nextRow = endRow + 1;
  await d1SetSyncState(env, def.sheet, { lastRow: endRow, totalRows: endRow - 1, status: 'OK', error: null });
  return { sheet: def.sheet, synced, hasMore, nextRow };
}
