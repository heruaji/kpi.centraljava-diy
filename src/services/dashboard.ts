import type { RegionDashboard } from '../types/dashboard';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type DashboardPeriod = 'TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'|'WTD'|'MTD'|'YTD';
export type DashboardFetchResult = { data:RegionDashboard; updatedAt:string|null; checkedAt:string|null; changed:boolean };
type RefreshStart={ok:boolean;jobId:string;status:'PROCESSING';startedAt:string};
type RefreshStatus={ok:boolean;jobId:string;status:'PROCESSING'|'READY'|'ERROR';startedAt:string;finishedAt:string|null;changed:boolean;error:string|null};

const sleep=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));
async function readJson(response:Response){
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('application/json')){
    const preview=(await response.text()).slice(0,120).replace(/\s+/g,' ');
    throw new Error(`API dashboard tidak terhubung (${response.status}). Periksa VITE_API_BASE_URL / Worker. ${preview.startsWith('<!DOCTYPE')?'Endpoint mengembalikan halaman web, bukan API.':preview}`);
  }
  return response.json();
}
async function fetchSnapshot(query:string):Promise<DashboardFetchResult>{
  const response=await fetch(`${API_BASE}/api/dashboard/region?${query}`);
  const body=await readJson(response);
  if(!response.ok){
    const message=body&&typeof body==='object'&&'error' in body?String(body.error):`API ${response.status}`;
    throw new Error(message);
  }
  return {data:body as RegionDashboard,updatedAt:response.headers.get('x-dashboard-updated-at'),checkedAt:response.headers.get('x-dashboard-checked-at'),changed:response.headers.get('x-dashboard-changed')==='1'};
}

export async function getRegionDashboard(period:DashboardPeriod='MTD',custom?:{start:string;end:string},refresh=false):Promise<DashboardFetchResult>{
  const query=custom?`start=${encodeURIComponent(custom.start)}&end=${encodeURIComponent(custom.end)}`:`period=${period}`;
  if(!refresh) return fetchSnapshot(query);

  const startResponse=await fetch(`${API_BASE}/api/dashboard/region?${query}&refresh=1`);
  const startBody=await readJson(startResponse) as RefreshStart & {error?:string};
  if(!(startResponse.status===202&&startBody.jobId)) throw new Error(startBody.error||`API ${startResponse.status}`);

  const deadline=Date.now()+180_000;
  while(Date.now()<deadline){
    await sleep(2000);
    const statusResponse=await fetch(`${API_BASE}/api/dashboard/refresh-status?jobId=${encodeURIComponent(startBody.jobId)}`);
    const status=await readJson(statusResponse) as RefreshStatus;
    if(!statusResponse.ok) throw new Error(status.error||`API ${statusResponse.status}`);
    if(status.status==='ERROR') throw new Error(status.error||'Refresh data gagal');
    if(status.status==='READY'){
      const result=await fetchSnapshot(query);
      return {...result,changed:status.changed};
    }
  }
  throw new Error('Proses refresh masih berjalan terlalu lama. Data terakhir tetap dapat digunakan; coba cek kembali beberapa saat lagi.');
}

export function latestFreshness(data:RegionDashboard|null){
  const dates=(data?.freshness||[]).map(x=>x.maxDate).filter(Boolean) as string[];
  return dates.length?dates.sort().at(-1)!:null;
}
