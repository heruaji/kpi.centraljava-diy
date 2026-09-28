// worker/src/index.ts
import { buildRegionDashboard, buildRegionDashboardFromD1, readDashboardFreshness } from './region';
import type { PeriodPreset } from './period';
import { fullSync, incrementalSync, syncChunk, type SyncEnv } from './sync';
import { hasD1Data, type QueryEnv } from './query';

export interface Env {
  ALLOWED_ORIGIN?: string;
  SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  DASHBOARD_CACHE?: KVNamespace;
  DB?: D1Database;
}

const json = (
  body: unknown,
  status = 200,
  origin = '*',
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      ...extra,
    },
  });

const CACHE_VERSION = 'v10-resync';
const LEGACY_CACHE_VERSION = CACHE_VERSION;
const cacheKey = (
  preset?: string,
  start?: string | null,
  end?: string | null,
  version = CACHE_VERSION,
) => `${version}:region:${preset || 'MTD'}:${start || ''}:${end || ''}`;
const SNAPSHOT_TTL = 60 * 60 * 24 * 7;

async function ensureDb(env: Env) {
  if (!env.DB) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS dashboard_snapshots (cache_key TEXT PRIMARY KEY,period TEXT NOT NULL,range_start TEXT,range_end TEXT,updated_at TEXT NOT NULL,payload TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_updated_at ON dashboard_snapshots(updated_at)`,
    `CREATE TABLE IF NOT EXISTS dashboard_refresh_jobs (job_id TEXT PRIMARY KEY,cache_key TEXT NOT NULL,status TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,changed INTEGER NOT NULL DEFAULT 0,error TEXT)`,
    `CREATE TABLE IF NOT EXISTS dashboard_source_state (source TEXT PRIMARY KEY,row_count INTEGER NOT NULL,max_date TEXT,updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_dashboard_refresh_jobs_key ON dashboard_refresh_jobs(cache_key,started_at)`,
  ];
  await env.DB.batch(statements.map((sql) => env.DB!.prepare(sql)));
}

async function readDbSnapshot(env: Env, key: string): Promise<Snapshot | null> {
  if (!env.DB) return null;
  await ensureDb(env);
  const row = await env.DB.prepare(
    'SELECT updated_at, payload FROM dashboard_snapshots WHERE cache_key = ?',
  )
    .bind(key)
    .first<{ updated_at: string; payload: string }>();
  if (!row) return null;
  try {
    return { updatedAt: row.updated_at, data: JSON.parse(row.payload) };
  } catch {
    return null;
  }
}

async function saveDbSnapshot(
  env: Env,
  key: string,
  period: string,
  start: string | null,
  end: string | null,
  data: unknown,
) {
  if (!env.DB) return;
  await ensureDb(env);
  const updatedAt = new Date().toISOString();
  const payload = JSON.stringify(data);
  const bytes = new TextEncoder().encode(payload).byteLength;
  if (bytes > 1_500_000) return;
  await env.DB.prepare(
    `INSERT INTO dashboard_snapshots(cache_key,period,range_start,range_end,updated_at,payload)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(cache_key) DO UPDATE SET period=excluded.period,range_start=excluded.range_start,range_end=excluded.range_end,updated_at=excluded.updated_at,payload=excluded.payload`,
  )
    .bind(key, period, start, end, updatedAt, payload)
    .run();
}

type Snapshot = { updatedAt: string; data: unknown };
type RefreshJob = {
  job_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  changed: number;
  error: string | null;
};

async function readSnapshot(env: Env, key: string): Promise<Snapshot | null> {
  if (!env.DASHBOARD_CACHE) return null;
  return env.DASHBOARD_CACHE.get<Snapshot>(key, 'json');
}

async function saveSnapshot(env: Env, key: string, data: unknown) {
  if (!env.DASHBOARD_CACHE) return;
  await env.DASHBOARD_CACHE.put(
    key,
    JSON.stringify({ updatedAt: new Date().toISOString(), data }),
    { expirationTtl: SNAPSHOT_TTL },
  );
}

async function rebuildAndPersist(
  env: Env,
  key: string,
  period: string,
  start: string | null,
  end: string | null,
  previous: Snapshot | null = null,
) {
  const d1Ready = env.DB
    ? await hasD1Data(env as QueryEnv).catch(() => false)
    : false;

  let data: unknown;
  if (d1Ready) {
    data = await buildRegionDashboardFromD1(
      env as Env & QueryEnv,
      period as PeriodPreset,
      start && end ? { start, end } : undefined,
    );
  } else {
    data = await buildRegionDashboard(
      env,
      period as PeriodPreset,
      start && end ? { start, end } : undefined,
    );
  }

  const changed =
    !previous || JSON.stringify(previous.data) !== JSON.stringify(data);
  if (changed) {
    await saveDbSnapshot(env, key, period, start, end, data);
    await saveSnapshot(env, key, data);
    return { data, changed: true, updatedAt: new Date().toISOString() };
  }
  return { data: previous!.data, changed: false, updatedAt: previous!.updatedAt };
}

type SourceFreshness = { source: string; maxDate: string | null; rowCount: number };

async function readSourceState(
  env: Env,
): Promise<Map<string, { rowCount: number; maxDate: string | null }>> {
  const state = new Map<string, { rowCount: number; maxDate: string | null }>();
  if (!env.DB) return state;
  await ensureDb(env);
  const rows = await env.DB.prepare(
    'SELECT source,row_count,max_date FROM dashboard_source_state',
  ).all<{ source: string; row_count: number; max_date: string | null }>();
  for (const row of rows.results || [])
    state.set(row.source, { rowCount: row.row_count, maxDate: row.max_date });
  return state;
}

async function saveSourceState(env: Env, freshness: SourceFreshness[]) {
  if (!env.DB || !freshness.length) return;
  await ensureDb(env);
  const now = new Date().toISOString();
  await env.DB.batch(
    freshness.map((x) =>
      env.DB!.prepare(
        `INSERT INTO dashboard_source_state(source,row_count,max_date,updated_at) VALUES(?,?,?,?) ON CONFLICT(source) DO UPDATE SET row_count=excluded.row_count,max_date=excluded.max_date,updated_at=excluded.updated_at`,
      ).bind(x.source, x.rowCount, x.maxDate, now),
    ),
  );
}

async function latestRunningJob(env: Env, key: string): Promise<RefreshJob | null> {
  if (!env.DB) return null;
  await ensureDb(env);
  const job = await env.DB.prepare(
    `SELECT job_id,status,started_at,finished_at,changed,error FROM dashboard_refresh_jobs WHERE cache_key=? AND status='PROCESSING' ORDER BY started_at DESC LIMIT 1`,
  )
    .bind(key)
    .first<RefreshJob>();
  if (!job) return null;
  const started = Date.parse(job.started_at);
  if (Number.isFinite(started) && Date.now() - started > 5 * 60 * 1000) {
    await env.DB.prepare(
      `UPDATE dashboard_refresh_jobs SET status='ERROR',finished_at=?,error=? WHERE job_id=? AND status='PROCESSING'`,
    )
      .bind(
        new Date().toISOString(),
        'Refresh job stale / interrupted; safe to retry.',
        job.job_id,
      )
      .run();
    return null;
  }
  return job;
}

async function runRefreshJob(
  env: Env,
  jobId: string,
  key: string,
  period: string,
  start: string | null,
  end: string | null,
  previous: Snapshot | null,
  sourceFreshness: SourceFreshness[],
) {
  try {
    const result = await rebuildAndPersist(
      env,
      key,
      period,
      start,
      end,
      previous,
    );
    await saveSourceState(env, sourceFreshness);
    if (env.DB)
      await env.DB.prepare(
        `UPDATE dashboard_refresh_jobs SET status='READY',finished_at=?,changed=?,error=NULL WHERE job_id=?`,
      )
        .bind(new Date().toISOString(), result.changed ? 1 : 0, jobId)
        .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (env.DB)
      await env.DB.prepare(
        `UPDATE dashboard_refresh_jobs SET status='ERROR',finished_at=?,error=? WHERE job_id=?`,
      )
        .bind(new Date().toISOString(), message, jobId)
        .run();
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS')
      return new Response(null, {
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET,OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });

    if (url.pathname === '/api/health')
      return json(
        {
          ok: true,
          service: 'kpi-centraljava-diy-api',
          cache: !!env.DASHBOARD_CACHE,
          d1: !!env.DB,
          cacheVersion: CACHE_VERSION,
        },
        200,
        origin,
      );

    // ============================================================
    // CHUNKED SYNC
    // ============================================================
    if (url.pathname === '/api/sync/sheet') {
      if (!env.DB)
        return json({ ok: false, error: 'D1 tidak tersedia' }, 503, origin);
      const sheetName = url.searchParams.get('sheet');
      const startRow = parseInt(url.searchParams.get('startRow') || '2', 10);
      const maxRows = parseInt(url.searchParams.get('maxRows') || '1000', 10);
      if (!sheetName)
        return json({ ok: false, error: 'sheet wajib diisi' }, 400, origin);
      if (startRow < 2 || maxRows < 1 || maxRows > 5000)
        return json(
          { ok: false, error: 'startRow >= 2 dan maxRows 1-5000' },
          400,
          origin,
        );
      try {
        const result = await syncChunk(
          env as SyncEnv,
          sheetName,
          startRow,
          maxRows,
        );
        return json({ ok: true, ...result }, 200, origin);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : 'Sync gagal',
          },
          500,
          origin,
        );
      }
    }

    // ============================================================
    // FULL / INCREMENTAL SYNC
    // ============================================================
    if (url.pathname === '/api/sync') {
      if (!env.DB)
        return json({ ok: false, error: 'D1 tidak tersedia' }, 503, origin);
      const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'incremental';
      try {
        const result =
          mode === 'full'
            ? await fullSync(env as SyncEnv)
            : await incrementalSync(env as SyncEnv);
        return json({ ok: true, mode, result }, 200, origin);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : 'Sync gagal',
          },
          500,
          origin,
        );
      }
    }

    // ============================================================
    // SYNC STATE
    // ============================================================
    if (url.pathname === '/api/sync/state') {
      if (!env.DB)
        return json({ ok: false, error: 'D1 tidak tersedia' }, 503, origin);
      try {
        const rows = await env.DB.prepare(
          `SELECT sheet, last_row, total_rows, last_synced_at, last_status, last_error FROM sheet_sync_state ORDER BY sheet`,
        ).all();
        return json({ ok: true, state: rows.results }, 200, origin);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : 'Gagal baca state',
          },
          500,
          origin,
        );
      }
    }

    // ============================================================
    // REFRESH STATUS
    // ============================================================
    if (url.pathname === '/api/dashboard/refresh-status') {
      const jobId = url.searchParams.get('jobId');
      if (!jobId)
        return json({ ok: false, error: 'jobId wajib diisi' }, 400, origin);
      if (!env.DB)
        return json({ ok: false, error: 'D1 tidak tersedia' }, 503, origin);
      await ensureDb(env);
      const job = await env.DB.prepare(
        'SELECT job_id,status,started_at,finished_at,changed,error FROM dashboard_refresh_jobs WHERE job_id=?',
      )
        .bind(jobId)
        .first<RefreshJob>();
      if (!job)
        return json(
          { ok: false, error: 'Refresh job tidak ditemukan' },
          404,
          origin,
        );
      return json(
        {
          ok: true,
          jobId: job.job_id,
          status: job.status,
          startedAt: job.started_at,
          finishedAt: job.finished_at,
          changed: job.changed === 1,
          error: job.error,
        },
        200,
        origin,
      );
    }

    // ============================================================
    // DASHBOARD REGION
    // ============================================================
    if (url.pathname === '/api/dashboard/region') {
      const preset = url.searchParams.get('period') as PeriodPreset | null;
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      const validDate = (v: string | null) =>
        !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
      if ((start || end) && (!validDate(start) || !validDate(end) || start! > end!))
        return json(
          { ok: false, error: 'Custom range tidak valid' },
          400,
          origin,
        );

      const key = cacheKey(preset || undefined, start, end);
      const force = url.searchParams.get('refresh') === '1';

      let kvSnapshot: Snapshot | null = null;
      let dbSnapshot: Snapshot | null = null;
      try {
        kvSnapshot = await readSnapshot(env, key);
      } catch {}
      if (!kvSnapshot) {
        try {
          dbSnapshot = await readDbSnapshot(env, key);
        } catch {}
      }
      let snapshot = kvSnapshot ?? dbSnapshot;
      if (!snapshot) {
        const legacyKey = cacheKey(
          preset || undefined,
          start,
          end,
          LEGACY_CACHE_VERSION,
        );
        try {
          snapshot = await readSnapshot(env, legacyKey);
        } catch {}
        if (!snapshot) {
          try {
            snapshot = await readDbSnapshot(env, legacyKey);
          } catch {}
        }
      }
      if (dbSnapshot && env.DASHBOARD_CACHE)
        ctx.waitUntil(saveSnapshot(env, key, dbSnapshot.data));
      const checkedAt = new Date().toISOString();

      if (!force) {
        if (snapshot)
          return json(snapshot.data, 200, origin, {
            'x-dashboard-cache': 'HIT',
            'x-dashboard-updated-at': snapshot.updatedAt,
            'x-dashboard-checked-at': checkedAt,
            'x-dashboard-changed': '0',
          });
        return json(
          {
            ok: false,
            error:
              'Dashboard belum memiliki snapshot. Klik Refresh Data untuk membuat data awal.',
          },
          503,
          origin,
          { 'x-dashboard-checked-at': checkedAt },
        );
      }

      if (!env.DB)
        return json(
          { ok: false, error: 'D1 diperlukan untuk background refresh' },
          503,
          origin,
          { 'x-dashboard-checked-at': checkedAt },
        );
      await ensureDb(env);

      // ============================================================
      // FIX 1: Freshness probe hanya jalan kalau snapshot SUDAH ADA.
      // Kalau snapshot null → kita tahu akan rebuild, tidak perlu probe.
      // Hemat 4 Google Sheets API call (~1-2 detik) per custom range baru.
      // ============================================================
      let sourceFreshness: SourceFreshness[] = [];
      if (snapshot) {
        try {
          sourceFreshness = await readDashboardFreshness(env);
          const stored = await readSourceState(env);
          if (stored.size > 0) {
            const hasNewData = sourceFreshness.some((x) => {
              const before = stored.get(x.source);
              return (
                !before ||
                x.rowCount > before.rowCount ||
                (x.maxDate ?? '') > (before.maxDate ?? '')
              );
            });
            if (!hasNewData) {
              return json(
                {
                  ok: true,
                  status: 'LATEST',
                  changed: false,
                  updatedAt: snapshot.updatedAt,
                },
                200,
                origin,
                {
                  'x-dashboard-cache': 'UNCHANGED',
                  'x-dashboard-updated-at': snapshot.updatedAt,
                  'x-dashboard-checked-at': checkedAt,
                  'x-dashboard-changed': '0',
                },
              );
            }
          }
        } catch {}
      }

      const running = await latestRunningJob(env, key);
      if (running)
        return json(
          {
            ok: true,
            jobId: running.job_id,
            status: 'PROCESSING',
            startedAt: running.started_at,
          },
          202,
          origin,
          { 'x-dashboard-checked-at': checkedAt },
        );

      const jobId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO dashboard_refresh_jobs(job_id,cache_key,status,started_at,changed) VALUES(?,?, 'PROCESSING',?,0)`,
      )
        .bind(jobId, key, startedAt)
        .run();
      ctx.waitUntil(
        runRefreshJob(
          env,
          jobId,
          key,
          preset || 'MTD',
          start,
          end,
          snapshot,
          sourceFreshness,
        ),
      );
      return json(
        { ok: true, jobId, status: 'PROCESSING', startedAt },
        202,
        origin,
        { 'x-dashboard-checked-at': checkedAt },
      );
    }

    // ============================================================
    // DEBUG — temporary, hapus kalau sudah selesai
    // ============================================================
    if (url.pathname === '/api/debug/lm') {
      if (!env.DB)
        return json({ ok: false, error: 'D1 tidak tersedia' }, 503, origin);
      const start = url.searchParams.get('start') || '2026-09-01';
      const end = url.searchParams.get('end') || '2026-09-15';
      const windowStart = url.searchParams.get('windowStart') || start;
      const windowEnd = url.searchParams.get('windowEnd') || end;

      try {
        const countIn = async (table: string, s: string, e: string) => {
          const r = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM ${table} WHERE date BETWEEN ? AND ?`,
          )
            .bind(s, e)
            .first<{ c: number }>();
          return r?.c ?? 0;
        };

        const lmInRange = await countIn('lm_rows', start, end);
        const lmInWindow = await countIn('lm_rows', windowStart, windowEnd);
        const fmInRange = await countIn('fm_rows', start, end);
        const mmInRange = await countIn('mm_rows', start, end);
        const slaInRange = await countIn('sla_rows', start, end);

        const sample = await env.DB.prepare(
          `SELECT date, payload FROM lm_rows WHERE date BETWEEN ? AND ? LIMIT 1`,
        )
          .bind(start, end)
          .first<{ date: string; payload: string }>();

        let sampleParsed = null;
        let sampleGranularDate = null;
        let sampleExcelDate = null;
        if (sample) {
          try {
            sampleParsed = JSON.parse(sample.payload);
            sampleGranularDate = sampleParsed.GRANULAR_DATE;
            if (typeof sampleGranularDate === 'number') {
              const d = new Date(Date.UTC(1899, 11, 30) + sampleGranularDate * 86400000);
              sampleExcelDate = d.toISOString().slice(0, 10);
            } else if (typeof sampleGranularDate === 'string') {
              const d = new Date(sampleGranularDate);
              sampleExcelDate = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
            }
          } catch (e) {
            sampleParsed = { error: String(e) };
          }
        }

        return json(
          {
            ok: true,
            range: { start, end },
            window: { start: windowStart, end: windowEnd },
            counts: {
              lm_in_range: lmInRange,
              lm_in_window: lmInWindow,
              fm_in_range: fmInRange,
              mm_in_range: mmInRange,
              sla_in_range: slaInRange,
            },
            sample: sample
              ? {
                  date_in_db: sample.date,
                  granular_date_raw: sampleGranularDate,
                  granular_date_type: typeof sampleGranularDate,
                  excel_date_converted: sampleExcelDate,
                  payload_preview: JSON.stringify(sampleParsed).slice(0, 400),
                }
              : null,
          },
          200,
          origin,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : 'Debug error',
          },
          500,
          origin,
        );
      }
    }

    return json({ ok: false, error: 'Not found' }, 404, origin);
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (!env.DB) return;
    ctx.waitUntil(
      incrementalSync(env as SyncEnv)
        .then((result) => {
          console.log('[sync] completed', JSON.stringify(result));
        })
        .catch((err) => {
          console.error('[sync] failed', err);
        }),
    );
  },
};
