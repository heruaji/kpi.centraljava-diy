import { buildRegionDashboard } from './region';
import type { PeriodPreset } from './period';

export interface Env {
  ALLOWED_ORIGIN?: string;
  SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
}
const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin}});
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url); const origin=env.ALLOWED_ORIGIN||'*';
    if(request.method==='OPTIONS') return new Response(null,{headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}});
    if(url.pathname==='/api/health') return json({ok:true,service:'kpi-centraljava-diy-api'},200,origin);
    if(url.pathname==='/api/dashboard/region'){
      try{const preset=url.searchParams.get('period') as PeriodPreset|null;const start=url.searchParams.get('start');const end=url.searchParams.get('end');const validDate=(v:string|null)=>!!v&&/^\\d{4}-\\d{2}-\\d{2}$/.test(v);if((start||end)&&(!validDate(start)||!validDate(end)||start!>end!)) return json({ok:false,error:'Custom range tidak valid'},400,origin);return json(await buildRegionDashboard(env,preset||undefined,start&&end?{start,end}:undefined),200,origin)}
      catch(error){return json({ok:false,error:error instanceof Error?error.message:'Unknown error'},500,origin)}
    }
    return json({ok:false,error:'Not found'},404,origin);
  }
};