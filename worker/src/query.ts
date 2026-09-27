// worker/src/query.ts
import type { Row } from './data-source';

export interface QueryEnv {
  DB: D1Database;
}

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
