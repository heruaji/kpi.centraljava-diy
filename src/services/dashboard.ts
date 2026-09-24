import type { RegionDashboard } from '../types/dashboard';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type DashboardPeriod = 'TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'|'WTD'|'MTD'|'YTD';

export type DashboardFetchResult = { data:RegionDashboard; updatedAt:string|null; checkedAt:string|null; changed:boolean };
export async function getRegionDashboard(period: DashboardPeriod = 'MTD', custom?: {start:string;end:string}, refresh=false): Promise<DashboardFetchResult> {
  const query=custom?`start=${encodeURIComponent(custom.start)}&end=${encodeURIComponent(custom.end)}`:`period=${period}`;
  const endpoint = `${API_BASE}/api/dashboard/region?${query}${refresh?'&refresh=1':''}`;
  const response = await fetch(endpoint);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).slice(0,120).replace(/\\s+/g,' ');
    throw new Error(`API dashboard tidak terhubung (${response.status}). Periksa VITE_API_BASE_URL / Worker. ${preview.startsWith("<!DOCTYPE") ? "Endpoint mengembalikan halaman web, bukan API." : preview}`);
  }
  const body = await response.json();
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String(body.error) : `API ${response.status}`;
    throw new Error(message);
  }
  return {
    data: body as RegionDashboard,
    updatedAt: response.headers.get('x-dashboard-updated-at'),
    checkedAt: response.headers.get('x-dashboard-checked-at'),
    changed: response.headers.get('x-dashboard-changed') === '1'
  };
}

export function latestFreshness(data: RegionDashboard | null) {
  const dates = (data?.freshness || []).map(x => x.maxDate).filter(Boolean) as string[];
  return dates.length ? dates.sort().at(-1)! : null;
}
