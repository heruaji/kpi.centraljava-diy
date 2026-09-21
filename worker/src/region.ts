import { readSheet, type EnvSource, type Row } from './data-source';
import { defaultPeriod } from './period';

const n=(v:unknown)=>typeof v==='number'?v:Number(v)||0;
const excelDate=(v:unknown)=>{
  if(typeof v==='number'){
    const d=new Date(Date.UTC(1899,11,30)+v*86400000);
    return d.toISOString().slice(0,10);
  }
  const d=new Date(String(v)); return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);
};
const ratio=(a:number,b:number)=>b>0?a/b:null;
const pct=(v:number|null)=>v===null?null:v*100;

export async function buildRegionDashboard(env:EnvSource){
  const [sla,sto]=await Promise.all([readSheet(env,'SLA','A:AC'),readSheet(env,'STO','A:I')]);
  const dated=sla.map(r=>({...r,__date:excelDate(r.PERIODE)})).filter(r=>r.__date);
  const maxDate=dated.map(r=>r.__date as string).sort().at(-1) || null;
  if(!maxDate) throw new Error('No valid SLA date');
  const range=defaultPeriod(maxDate);
  const selected=dated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);

  const aggregate=(items:Row[])=>{
    const sum=(key:string)=>items.reduce((a,r)=>a+n(r[key]),0);
    return {
      sla:pct(ratio(sum('VOLUME_SLA_MEET'),sum('VOLUME_SLA_ALL'))),
      productivityLm:ratio(sum('TOTAL_PAKET_LM_SIGESIT'),sum('TOTAL_MP_LM_SIGESIT')),
      productivityFm:ratio(sum('TOTAL_PAKET_FM_SIGESIT'),sum('TOTAL_MP_FM_SIGESIT')),
    };
  };
  const overall=aggregate(selected);
  const districts=[...new Set(sto.map(r=>String(r.District||'')).filter(Boolean))].sort();
  const areas=districts.map((name,index)=>{
    const items=selected.filter(r=>String(r.District||'')===name);
    const a=aggregate(items);
    return {id:`area-${index+1}`,name,sla:a.sla,kpiLm:null,kpiFm:null,kpiMm:null,productivity:a.productivityLm??a.productivityFm,status:'—'};
  });

  return {
    connected:true,range,
    freshness:[{source:'SLA',maxDate},{source:'LM',maxDate:null},{source:'FM',maxDate:null},{source:'MM',maxDate:null}],
    metrics:[
      {key:'sla',label:'SLA Performance',value:overall.sla,unit:'percent'},
      {key:'lm',label:'KPI LM',value:null,unit:'percent'},
      {key:'fm',label:'KPI FM',value:null,unit:'percent'},
      {key:'mm',label:'KPI MM',value:null,unit:'percent'}
    ],
    areas
  };
}
