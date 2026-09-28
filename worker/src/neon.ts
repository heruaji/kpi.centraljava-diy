// worker/src/neon.ts
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export interface NeonEnv {
  NEON_DATABASE_URL?: string;
}

let cachedClient: NeonQueryFunction<false, false> | null = null;
let cachedUrl: string | null = null;

export function getNeonClient(env: NeonEnv): NeonQueryFunction<false, false> {
  if (!env.NEON_DATABASE_URL) {
    throw new Error('NEON_DATABASE_URL is not configured');
  }
  // Reuse client kalau URL sama (dalam 1 invocation Worker)
  if (cachedClient && cachedUrl === env.NEON_DATABASE_URL) {
    return cachedClient;
  }
  cachedClient = neon(env.NEON_DATABASE_URL);
  cachedUrl = env.NEON_DATABASE_URL;
  return cachedClient;
}

export async function testNeonConnection(env: NeonEnv) {
  const sql = getNeonClient(env);
  const result = await sql`
    SELECT 
      NOW() as now,
      current_database() as database,
      current_user as user,
      version() as version
  `;
  return result[0];
}

export async function getNeonTableCounts(env: NeonEnv) {
  const sql = getNeonClient(env);
  const result = await sql`
    SELECT 
      'sla_rows' as table_name, COUNT(*)::int as count FROM sla_rows
    UNION ALL
    SELECT 'lm_rows', COUNT(*)::int FROM lm_rows
    UNION ALL
    SELECT 'fm_rows', COUNT(*)::int FROM fm_rows
    UNION ALL
    SELECT 'mm_rows', COUNT(*)::int FROM mm_rows
  `;
  return result;
}