// worker/src/query.ts
import type { Row } from './data-source';
import { getNeonClient, type NeonEnv } from './neon';

export interface QueryEnv {
  DB: D1Database;
}

// ============================================================
// D1 QUERY SOURCE (existing)
// ============================================================

async function queryTable(
  env: QueryEnv,
  table: string,
  start: string,
  end: string,
): Promise<Row[]> {
  const result = await env.DB.prepare(
    `SELECT payload FROM ${table} WHERE date BETWEEN ? AND ? ORDER BY date`,
  )
    .bind(start, end)
    .all<{ payload: string }>();

  return (result.results || []).map((r) => JSON.parse(r.payload) as Row);
}

export function querySla(env: QueryEnv, start: string, end: string) {
  return queryTable(env, 'sla_rows', start, end);
}
export function queryLm(env: QueryEnv, start: string, end: string) {
  return queryTable(env, 'lm_rows', start, end);
}
export function queryFm(env: QueryEnv, start: string, end: string) {
  return queryTable(env, 'fm_rows', start, end);
}
export function queryMm(env: QueryEnv, start: string, end: string) {
  return queryTable(env, 'mm_rows', start, end);
}

export async function getMaxDate(env: QueryEnv): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT MAX(date) AS max FROM sla_rows`,
  ).first<{ max: string | null }>();
  return row?.max ?? null;
}

export async function hasD1Data(env: QueryEnv): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM sla_rows`,
  ).first<{ c: number }>();
  return (row?.c ?? 0) > 0;
}

// ============================================================
// NEON QUERY SOURCE (Fase 5)
// ============================================================

export type NeonQueryEnv = NeonEnv;

const parseNeonRow = (r: { payload: unknown }): Row => {
  const p = r.payload;
  if (typeof p === 'string') return JSON.parse(p) as Row;
  return p as Row;
};

type NeonTable = 'sla_rows' | 'lm_rows' | 'fm_rows' | 'mm_rows';

async function queryNeonTable(
  env: NeonQueryEnv,
  table: NeonTable,
  start: string,
  end: string,
): Promise<Row[]> {
  const sql = getNeonClient(env);
  // Whitelist via switch — aman dari SQL injection
  let rows: { payload: unknown }[];
  switch (table) {
    case 'sla_rows':
      rows = (await sql`
        SELECT payload FROM sla_rows
        WHERE date BETWEEN ${start} AND ${end}
        ORDER BY date
      `) as { payload: unknown }[];
      break;
    case 'lm_rows':
      rows = (await sql`
        SELECT payload FROM lm_rows
        WHERE date BETWEEN ${start} AND ${end}
        ORDER BY date
      `) as { payload: unknown }[];
      break;
    case 'fm_rows':
      rows = (await sql`
        SELECT payload FROM fm_rows
        WHERE date BETWEEN ${start} AND ${end}
        ORDER BY date
      `) as { payload: unknown }[];
      break;
    case 'mm_rows':
      rows = (await sql`
        SELECT payload FROM mm_rows
        WHERE date BETWEEN ${start} AND ${end}
        ORDER BY date
      `) as { payload: unknown }[];
      break;
    default:
      throw new Error(`Unknown Neon table: ${table as string}`);
  }
  return rows.map(parseNeonRow);
}

export function querySlaNeon(env: NeonQueryEnv, start: string, end: string) {
  return queryNeonTable(env, 'sla_rows', start, end);
}
export function queryLmNeon(env: NeonQueryEnv, start: string, end: string) {
  return queryNeonTable(env, 'lm_rows', start, end);
}
export function queryFmNeon(env: NeonQueryEnv, start: string, end: string) {
  return queryNeonTable(env, 'fm_rows', start, end);
}
export function queryMmNeon(env: NeonQueryEnv, start: string, end: string) {
  return queryNeonTable(env, 'mm_rows', start, end);
}

export async function getNeonMaxDate(env: NeonQueryEnv): Promise<string | null> {
  const sql = getNeonClient(env);
  const rows = (await sql`
    SELECT MAX(date) AS max FROM sla_rows
  `) as { max: string | Date | null }[];
  const v = rows[0]?.max;
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export async function hasNeonData(env: NeonQueryEnv): Promise<boolean> {
  const sql = getNeonClient(env);
  const rows = (await sql`
    SELECT COUNT(*)::int AS c FROM sla_rows
  `) as { c: number }[];
  return (rows[0]?.c ?? 0) > 0;
}
