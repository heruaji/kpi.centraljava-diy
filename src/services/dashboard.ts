import type { RegionDashboard } from '../types/dashboard';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type DashboardPeriod = 'TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'|'WTD'|'MTD'|'YTD';

export async function getRegionDashboard(period: DashboardPeriod = 'MTD'): Promise<RegionDashboard> {
  const response = await fetch(`${API_BASE}/api/dashboard/region?period=${period}`);
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
