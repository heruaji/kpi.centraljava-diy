import { buildRegionDashboard } from './region';
import type { PeriodPreset } from './period';

export interface Env {
  ALLOWED_ORIGIN?: string;
  SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  DASHBOARD_CACHE?: KVNamespace;
  DB?: D1Database;
}
const json=(body:unknown,status=200,origin='*',extra:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin,...extra}});
const CACHE_VERSION='v3-native-sheet-lookup';
const cacheKey=(preset?:string,start?:string|null,end?:string|null)=>`${CACHE_VERSION}:region:${preset||'MTD'}:${start||''}:${end||''}`;
const SNAPSHOT_TTL=60*60*24*7;
const FRESH_MS=5*60*1000;

async function ensureDb(env:Env){
  if(!env.DB) return;
  // Keep D1 lightweight: only calculated dashboard snapshots belong here.
  // Remove the temporary raw-source ingestion schema introduced during the experiment.
  const statements=[
    `CREATE TABLE IF NOT EXISTS dashboard_snapshots (cache_key TEXT PRIMARY KEY,period TEXT NOT NULL,range_start TEXT,range_end TEXT,updated_at TEXT NOT NULL,payload TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_updated_at ON dashboard_snapshots(updated_at)`,
    `DROP TABLE IF EXISTS source_rows`,
    `DROP TABLE IF EXISTS source_sync_state`,
    `DROP TABLE IF EXISTS dashboard_sync_runs`
  ];
  await env.DB.batch(statements.map(sql=>env.DB!.prepare(sql)));
}
async function readDbSnapshot(env:Env,key:string):Promise<Snapshot|null>{
  if(!env.DB) return null;
  await ensureDb(env);
  const row=await env.DB.prepare('SELECT updated_at, payload FROM dashboard_snapshots WHERE cache_key = ?').bind(key).first<{updated_at:string;payload:string}>();
  if(!row) return null;
  try{return {updatedAt:row.updated_at,data:JSON.parse(row.payload)}}catch{return null}
}
async function saveDbSnapshot(env:Env,key:string,period:string,start:string|null,end:string|null,data:unknown){
  if(!env.DB) return;
  await ensureDb(env);
  const updatedAt=new Date().toISOString();
  const payload=JSON.stringify(data);
  // D1/SQLite has a per-value size ceiling. Dashboard snapshots can exceed it,
  // so D1 is metadata/status storage only; the full snapshot lives in KV.
  const bytes=new TextEncoder().encode(payload).byteLength;
  if(bytes>1_500_000) return;
  await env.DB.prepare(`INSERT INTO dashboard_snapshots(cache_key,period,range_start,range_end,updated_at,payload)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(cache_key) DO UPDATE SET period=excluded.period,range_start=excluded.range_start,range_end=excluded.range_end,updated_at=excluded.updated_at,payload=excluded.payload`)
    .bind(key,period,start,end,updatedAt,payload).run();
}


type Snapshot={updatedAt:string;data:unknown};

async function readSnapshot(env:Env,key:string):Promise<Snapshot|null>{
  if(!env.DASHBOARD_CACHE) return null;
  return env.DASHBOARD_CACHE.get<Snapshot>(key,'json');
}
async function saveSnapshot(env:Env,key:string,data:unknown){
  if(!env.DASHBOARD_CACHE) return;
  await env.DASHBOARD_CACHE.put(key,JSON.stringify({updatedAt:new Date().toISOString(),data}),{expirationTtl:SNAPSHOT_TTL});
}

async function readD1Source(env:Env,source:SourceSegment):Promise<Row[]>{
  if(!env.DB) return [];
  await ensureSourceDb(env);
  const result=await env.DB.prepare('SELECT row_json FROM source_rows WHERE source=? ORDER BY row_no').bind(source).all<{row_json:string}>();
  return (result.results||[]).map(r=>{try{return JSON.parse(r.row_json) as Row}catch{return {}}}).filter(r=>Object.keys(r).length);
}
async function d1SourcesReady(env:Env){
  if(!env.DB) return false;
  await ensureSourceDb(env);
  const result=await env.DB.prepare("SELECT source,status FROM source_sync_state WHERE source IN ('SLA','STO','LM','FM','MM')").all<{source:string;status:string}>();
  const ready=new Set((result.results||[]).filter(r=>r.status==='READY').map(r=>r.source));
  return ['SLA','STO','LM','FM','MM'].every(x=>ready.has(x));
}

const SYNC_ORDER:SourceSegment[]=['SLA','LM','FM','MM','STO'];
async function syncAllSourcesSequentially(env:Env){
  const results:{source:SourceSegment;status:string;rowCount?:number;error?:string}[]=[];
  for(const source of SYNC_ORDER){
    try{
      const result=await syncSourceSegment(env,source);
      results.push(result);
    }catch(error){
      results.push({source,status:'FAILED',error:error instanceof Error?error.message:'Unknown error'});
      // Do not aggregate a mixed-generation dataset.
      return {ok:false,results};
    }
  }
  return {ok:true,results};
}


async function rebuildAndPersist(env:Env,key:string,period:string,start:string|null,end:string|null){
  const data=await buildRegionDashboard(env,period as PeriodPreset,start&&end?{start,end}:undefined);
  await saveDbSnapshot(env,key,period,start,end,data);
  await saveSnapshot(env,key,data);
  return data;
}

export default {
  async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){
    const period='MTD';
    ctx.waitUntil(rebuildAndPersist(env,cacheKey(period,null,null),period,null,null).catch(()=>undefined));
  },
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url); const origin=env.ALLOWED_ORIGIN||'*';
    if(request.method==='OPTIONS') return new Response(null,{headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}});
    if(url.pathname==='/api/health') return json({ok:true,service:'kpi-centraljava-diy-api',cache:!!env.DASHBOARD_CACHE,d1:!!env.DB,cacheVersion:CACHE_VERSION},200,origin);
    if(url.pathname==='/api/dashboard/region'){
      const preset=url.searchParams.get('period') as PeriodPreset|null;
      const start=url.searchParams.get('start'); const end=url.searchParams.get('end');
      const validDate=(v:string|null)=>!!v&&/^\d{4}-\d{2}-\d{2}$/.test(v);
      if((start||end)&&(!validDate(start)||!validDate(end)||start!>end!)) return json({ok:false,error:'Custom range tidak valid'},400,origin);
      const key=cacheKey(preset||undefined,start,end);
      const force=url.searchParams.get('refresh')==='1';
      let kvSnapshot:Snapshot|null=null;
      let dbSnapshot:Snapshot|null=null;
      try{kvSnapshot=await readSnapshot(env,key)}catch{}
      if(!kvSnapshot){try{dbSnapshot=await readDbSnapshot(env,key)}catch{}}
      const snapshot=kvSnapshot??dbSnapshot;
      if(dbSnapshot && env.DASHBOARD_CACHE) ctx.waitUntil(saveSnapshot(env,key,dbSnapshot.data));
      const fresh=snapshot && Date.now()-Date.parse(snapshot.updatedAt)<FRESH_MS;
      if(snapshot && fresh && !force) return json(snapshot.data,200,origin,{'x-dashboard-cache':'HIT','x-dashboard-updated-at':snapshot.updatedAt});
      const rebuild=()=>rebuildAndPersist(env,key,preset||'MTD',start,end);
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