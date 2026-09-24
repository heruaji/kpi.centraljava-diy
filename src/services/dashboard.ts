import type { RegionDashboard } from '../types/dashboard';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type DashboardPeriod = 'TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'|'WTD'|'MTD'|'YTD';

export async function getRegionDashboard(period: DashboardPeriod = 'MTD', custom?: {start:string;end:string}): Promise<RegionDashboard> {
  const query=custom?`start=${encodeURIComponent(custom.start)}&end=${encodeURIComponent(custom.end)}`:`period=${period}`;
  const endpoint = `${API_BASE}/api/dashboard/region?${query}`;
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
  return body as RegionDashboard;
}

export function latestFreshness(data: RegionDashboard | null) {
  const dates = (data?.freshness || []).map(x => x.maxDate).filter(Boolean) as string[];
  return dates.length ? dates.sort().at(-1)! : null;
}
