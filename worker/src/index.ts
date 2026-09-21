import { buildRegionDashboard } from './region';

export interface Env {
  ALLOWED_ORIGIN?: string;
  SHEET_ID?: string;
  GOOGLE_SHEETS_API_KEY?: string;
}
const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin}});
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url); const origin=env.ALLOWED_ORIGIN||'*';
    if(request.method==='OPTIONS') return new Response(null,{headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}});
    if(url.pathname==='/api/health') return json({ok:true,service:'kpi-centraljava-diy-api'},200,origin);
    if(url.pathname==='/api/dashboard/region'){
      try{return json(await buildRegionDashboard(env),200,origin)}
      catch(error){return json({ok:false,error:error instanceof Error?error.message:'Unknown error'},500,origin)}
    }
    return json({ok:false,error:'Not found'},404,origin);
  }
};