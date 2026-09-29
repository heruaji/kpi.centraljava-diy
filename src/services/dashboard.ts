// src/services/dashboard.ts
import type { RegionDashboard } from '../types/dashboard';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type DashboardPeriod =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7'
  | 'LAST_30'
  | 'WTD'
  | 'MTD'
  | 'YTD';

export type DashboardFetchResult = {
  data: RegionDashboard;
  updatedAt: string | null;
  checkedAt: string | null;
  changed: boolean;
};

type RefreshStart = {
  ok: boolean;
  jobId: string;
  status: 'PROCESSING';
  startedAt: string;
};

type RefreshStatus = {
  ok: boolean;
  jobId: string;
  status: 'PROCESSING' | 'READY' | 'ERROR';
  startedAt: string;
  finishedAt: string | null;
  changed: boolean;
  error: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function readJson(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(
      `API dashboard tidak terhubung (${response.status}). Periksa VITE_API_BASE_URL / Worker. ${
        preview.startsWith('<!DOCTYPE') ? 'Endpoint mengembalikan halaman web, bukan API.' : preview
      }`,
    );
  }
  return response.json();
}

async function fetchSnapshot(query: string): Promise<DashboardFetchResult> {
  const response = await fetch(`${API_BASE}/api/dashboard/region?${query}`);
  const body = await readJson(response);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String(body.error)
        : `API ${response.status}`;
    throw new Error(message);
  }
  return {
    data: body as RegionDashboard,
    updatedAt: response.headers.get('x-dashboard-updated-at'),
    checkedAt: response.headers.get('x-dashboard-checked-at'),
    changed: response.headers.get('x-dashboard-changed') === '1',
  };
}

/**
 * Ambil dashboard region.
 *
 * Perilaku:
 * - Kalau snapshot sudah ada di KV/D1 → fetch langsung (< 100ms).
 * - Kalau belum ada → trigger background refresh, poll status dengan
 *   exponential backoff (mulai 300ms) supaya perceived latency kecil.
 * - Kalau `refresh=true` dan snapshot sudah ada, coba non-refresh dulu.
 *   Kalau berhasil → langsung return tanpa freshness probe.
 *
 * Fix performa:
 * - Tidak selalu kirim `refresh=1` ke server (menghindari freshness probe
 *   yang memanggil Google Sheets API 4x).
 * - Polling pertama 300ms (bukan 2000ms) → kelihatan jauh lebih responsif.
 */
export async function getRegionDashboard(
  period: DashboardPeriod = 'MTD',
  custom?: { start: string; end: string },
  refresh = false,
): Promise<DashboardFetchResult> {
  const query = custom
    ? `start=${encodeURIComponent(custom.start)}&end=${encodeURIComponent(custom.end)}`
    : `period=${period}`;

  // Fast path: HANYA dipakai kalau user TIDAK minta refresh.
  // Kalau refresh=true (mis. ganti preset, atau klik Refresh Data),
  // kita skip fast path supaya snapshot di-rebuild dari source terbaru.
  if (!refresh) {
    try {
      return await fetchSnapshot(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const needsSnapshot = message.toLowerCase().includes('belum memiliki snapshot');
      // Kalau bukan karena snapshot belum ada, ini error lain → lempar.
      if (!needsSnapshot) throw err;
      // Kalau snapshot belum ada, tetap lanjut ke refresh path.
    }
  }

  // Snapshot belum ada → trigger background refresh.
  const startResponse = await fetch(
    `${API_BASE}/api/dashboard/region?${query}&refresh=1`,
  );
  const startBody = (await readJson(startResponse)) as
    | (RefreshStart & { error?: string })
    | { ok: boolean; status: 'LATEST'; changed: false; updatedAt: string; error?: string };

  // Server bilang data sudah terbaru (LATEST) → fetch snapshot yang ada.
  if (startResponse.ok && (startBody as { status?: string }).status === 'LATEST') {
    const result = await fetchSnapshot(query);
    return { ...result, changed: false };
  }

  if (
    !(
      startResponse.status === 202 &&
      'jobId' in startBody &&
      startBody.jobId
    )
  ) {
    throw new Error(startBody.error || `API ${startResponse.status}`);
  }

  const jobId = (startBody as RefreshStart).jobId;
  const deadline = Date.now() + 180_000;

  // Exponential backoff: mulai 300ms, naik perlahan sampai maks 1500ms.
  // Responsif untuk job yang selesai cepat (3-4 dtk) tanpa hammer server.
  let delay = 300;

  while (Date.now() < deadline) {
    await sleep(delay);
    delay = Math.min(delay * 1.4, 1500);

    const statusResponse = await fetch(
      `${API_BASE}/api/dashboard/refresh-status?jobId=${encodeURIComponent(jobId)}`,
    );
    const status = (await readJson(statusResponse)) as RefreshStatus;

    if (!statusResponse.ok) {
      throw new Error(status.error || `API ${statusResponse.status}`);
    }
    if (status.status === 'ERROR') {
      throw new Error(status.error || 'Refresh data gagal');
    }
    if (status.status === 'READY') {
      const result = await fetchSnapshot(query);
      return { ...result, changed: status.changed };
    }
  }

  throw new Error(
    'Proses refresh masih berjalan terlalu lama. Data terakhir tetap dapat digunakan; coba cek kembali beberapa saat lagi.',
  );
}

export function latestFreshness(data: RegionDashboard | null) {
  const dates = (data?.freshness || [])
    .map((x) => x.maxDate)
    .filter(Boolean) as string[];
  return dates.length ? dates.sort().at(-1)! : null;
}
