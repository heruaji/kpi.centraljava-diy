import { defaultPeriod } from './period';

export interface Env {
  ALLOWED_ORIGIN?: string;
}

const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin}
});

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    const origin=env.ALLOWED_ORIGIN || '*';
    if(request.method==='OPTIONS') return new Response(null,{headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}});
    if(url.pathname==='/api/health') return json({ok:true,service:'kpi-centraljava-diy-api'},200,origin);
    if(url.pathname==='/api/dashboard/region'){
      return json({
        connected:false,
        range:null,
        freshness:[{source:'SLA',maxDate:null},{source:'LM',maxDate:null},{source:'FM',maxDate:null},{source:'MM',maxDate:null}],
        metrics:[
          {key:'sla',label:'SLA Performance',value:null,unit:'percent'},
          {key:'lm',label:'KPI LM',value:null,unit:'percent'},
          {key:'fm',label:'KPI FM',value:null,unit:'percent'},
          {key:'mm',label:'KPI MM',value:null,unit:'percent'}
        ],
        areas:[]
      },200,origin);
    }
    return json({ok:false,error:'Not found'},404,origin);
  }
};

export { defaultPeriod };
