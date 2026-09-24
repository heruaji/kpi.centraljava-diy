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
const LEGACY_CACHE_VERSION='v2-native-area';
const cacheKey=(preset?:string,start?:string|null,end?:string|null,version=CACHE_VERSION)=>`${version}:region:${preset||'MTD'}:${start||''}:${end||''}`;
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

async function rebuildAndPersist(env:Env,key:string,period:string,start:string|null,end:string|null,previous:Snapshot|null=null){
  const data=await buildRegionDashboard(env,period as PeriodPreset,start&&end?{start,end}:undefined);
  const changed=!previous || JSON.stringify(previous.data)!==JSON.stringify(data);
  if(changed){
    await saveDbSnapshot(env,key,period,start,end,data);
    await saveSnapshot(env,key,data);
    return {data,changed:true,updatedAt:new Date().toISOString()};
  }
  return {data:previous.data,changed:false,updatedAt:previous.updatedAt};
}

export default {
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
      let kvSnapshot:Snapshot|null=null; let dbSnapshot:Snapshot|null=null;
      try{kvSnapshot=await readSnapshot(env,key)}catch{}
      if(!kvSnapshot){try{dbSnapshot=await readDbSnapshot(env,key)}catch{}}
      let snapshot=kvSnapshot??dbSnapshot;
      if(!snapshot){
        const legacyKey=cacheKey(preset||undefined,start,end,LEGACY_CACHE_VERSION);
        try{snapshot=await readSnapshot(env,legacyKey)}catch{}
        if(!snapshot){try{snapshot=await readDbSnapshot(env,legacyKey)}catch{}}
      }
      if(dbSnapshot && env.DASHBOARD_CACHE) ctx.waitUntil(saveSnapshot(env,key,dbSnapshot.data));
      const checkedAt=new Date().toISOString();

      // Normal dashboard loads are read-only: never rebuild, write D1/KV, or touch Sheets.
      if(!force){
        if(snapshot) return json(snapshot.data,200,origin,{'x-dashboard-cache':'HIT','x-dashboard-updated-at':snapshot.updatedAt,'x-dashboard-checked-at':checkedAt,'x-dashboard-changed':'0'});
        return json({ok:false,error:'Dashboard belum memiliki snapshot. Klik Refresh Data untuk membuat data awal.'},503,origin,{'x-dashboard-checked-at':checkedAt});
      }

      // Only an explicit Refresh Data click reads Sheets. Persist only when calculated content changed.
      try{
        const result=await rebuildAndPersist(env,key,preset||'MTD',start,end,snapshot);
        return json(result.data,200,origin,{'x-dashboard-cache':result.changed?'REFRESHED':'UNCHANGED','x-dashboard-updated-at':result.updatedAt,'x-dashboard-checked-at':checkedAt,'x-dashboard-changed':result.changed?'1':'0'});
      }catch(error){
        if(snapshot) return json(snapshot.data,200,origin,{'x-dashboard-cache':'REFRESH-ERROR','x-dashboard-updated-at':snapshot.updatedAt,'x-dashboard-checked-at':checkedAt,'x-dashboard-changed':'0'});
        return json({ok:false,error:error instanceof Error?error.message:'Unknown error'},500,origin,{'x-dashboard-checked-at':checkedAt});
      }
    }
    return json({ok:false,error:'Not found'},404,origin);
  }
};