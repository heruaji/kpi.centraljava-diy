import { buildRegionDashboard } from './region';
import type { PeriodPreset } from './period';

export interface Env {
  ALLOWED_ORIGIN?: string;
  SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  DASHBOARD_CACHE?: KVNamespace;
}
const json=(body:unknown,status=200,origin='*',extra:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin,...extra}});
const cacheKey=(preset?:string,start?:string|null,end?:string|null)=>`region:${preset||'MTD'}:${start||''}:${end||''}`;
const SNAPSHOT_TTL=60*60*24*7;
const FRESH_MS=5*60*1000;

type Snapshot={updatedAt:string;data:unknown};

async function readSnapshot(env:Env,key:string):Promise<Snapshot|null>{
  if(!env.DASHBOARD_CACHE) return null;
  return env.DASHBOARD_CACHE.get<Snapshot>(key,'json');
}
async function saveSnapshot(env:Env,key:string,data:unknown){
  if(!env.DASHBOARD_CACHE) return;
  await env.DASHBOARD_CACHE.put(key,JSON.stringify({updatedAt:new Date().toISOString(),data}),{expirationTtl:SNAPSHOT_TTL});
}

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url); const origin=env.ALLOWED_ORIGIN||'*';
    if(request.method==='OPTIONS') return new Response(null,{headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}});
    if(url.pathname==='/api/health') return json({ok:true,service:'kpi-centraljava-diy-api',cache:!!env.DASHBOARD_CACHE},200,origin);
    if(url.pathname==='/api/dashboard/region'){
      const preset=url.searchParams.get('period') as PeriodPreset|null;
      const start=url.searchParams.get('start'); const end=url.searchParams.get('end');
      const validDate=(v:string|null)=>!!v&&/^\d{4}-\d{2}-\d{2}$/.test(v);
      if((start||end)&&(!validDate(start)||!validDate(end)||start!>end!)) return json({ok:false,error:'Custom range tidak valid'},400,origin);
      const key=cacheKey(preset||undefined,start,end);
      const force=url.searchParams.get('refresh')==='1';
      const snapshot=await readSnapshot(env,key);
      const fresh=snapshot && Date.now()-Date.parse(snapshot.updatedAt)<FRESH_MS;
      if(snapshot && fresh && !force) return json(snapshot.data,200,origin,{'x-dashboard-cache':'HIT','x-dashboard-updated-at':snapshot.updatedAt});

      const rebuild=async()=>{
        const data=await buildRegionDashboard(env,preset||undefined,start&&end?{start,end}:undefined);
        await saveSnapshot(env,key,data);
        return data;
      };

      // When a valid snapshot exists, never make the browser wait for the heavy
      // Google Sheets rebuild. Refresh it in the background and serve last-good.
      if(snapshot && !force){
        ctx.waitUntil(rebuild().catch(()=>undefined));
        return json(snapshot.data,200,origin,{'x-dashboard-cache':'STALE','x-dashboard-updated-at':snapshot.updatedAt});
      }

      try{
        const data=await rebuild();
        return json(data,200,origin,{'x-dashboard-cache':env.DASHBOARD_CACHE?'MISS':'BYPASS','x-dashboard-updated-at':new Date().toISOString()});
      }catch(error){
        if(snapshot) return json(snapshot.data,200,origin,{'x-dashboard-cache':'STALE-ERROR','x-dashboard-updated-at':snapshot.updatedAt});
        return json({ok:false,error:error instanceof Error?error.message:'Unknown error'},500,origin);
      }
    }
    return json({ok:false,error:'Not found'},404,origin);
  }
};