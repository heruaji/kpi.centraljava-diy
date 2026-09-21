import type { RegionDashboard } from '../types/dashboard';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function getRegionDashboard(): Promise<RegionDashboard|null> {
  if (!API_BASE) return null;
  const response = await fetch(`${API_BASE}/api/dashboard/region`);
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

export function latestFreshness(data: RegionDashboard|null) {
  const dates=(data?.freshness || []).map(x=>x.maxDate).filter(Boolean) as string[];
  return dates.length ? dates.sort().at(-1)! : null;
}
