import { readSheet, type EnvSource, type Row } from './data-source';
import { defaultPeriod } from './period';
import { positiveScore, tier, type TierRule } from './calculation';

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

const LM_POSITIVE:{num:string;den:string;rule:TierRule;weight:number}[]=[
  {num:'LAST_MILE_SERVICE_COD_VOLUME_FAS_DLV',den:'LAST_MILE_SERVICE_COD_VOLUME_ANT',rule:{direction:'HIGHER',tier1:.95,tier2:.92},weight:20},
  {num:'LAST_MILE_SERVICE_NON_COD_VOLUME_FAS_DLV',den:'LAST_MILE_SERVICE_NON_COD_VOLUME_ANT',rule:{direction:'HIGHER',tier1:.98,tier2:.96},weight:20},
  {num:'LAST_MILE_SERVICE_VOLUME_EARLY_DELIVERY_COMPLETION',den:'LAST_MILE_SERVICE_VOLUME_AWB_INBOUND',rule:{direction:'HIGHER',tier1:.85,tier2:.80},weight:20},
  {num:'LAST_MILE_SERVICE_VOLUME_COD_FD',den:'LAST_MILE_SERVICE_VOLUME_COD_IN_LM',rule:{direction:'LOWER',tier1:.045,tier2:.05},weight:15},
  {num:'LAST_MILE_SERVICE_VOLUME_TICKET_COMPLY',den:'LAST_MILE_SERVICE_VOLUME_TICKET_COMPLAINT',rule:{direction:'HIGHER',tier1:.95,tier2:.90},weight:5},
  {num:'LAST_MILE_QUALITY_VOLUME_LOST_LM',den:'LAST_MILE_QUALITY_VOLUME_FIRST_INLM',rule:{direction:'LOWER',tier1:.0001,tier2:.0002},weight:5},
  {num:'LAST_MILE_QUALITY_VOLUME_TMT_DLV',den:'LAST_MILE_QUALITY_VOLUME_DLV',rule:{direction:'LOWER',tier1:.0005,tier2:.0008},weight:5},
  {num:'LAST_MILE_QUALITY_VOLUME_COD_FRAUD',den:'LAST_MILE_QUALITY_VOLUME_COD_DLV_FRAUD',rule:{direction:'LOWER',tier1:0,tier2:.0005},weight:5},
  {num:'LAST_MILE_QUALITY_VOLUME_COD_TERIMA_ADMIN_H0',den:'LAST_MILE_QUALITY_VOLUME_COD_DLV',rule:{direction:'HIGHER',tier1:.98,tier2:.95},weight:5},
];

function sum(items:Row[],key:string){return items.reduce((a,r)=>a+n(r[key]),0)}
function lmScore(items:Row[]){
  if(!items.length) return null;
  return LM_POSITIVE.reduce((total,kpi)=>{
    const actual=ratio(sum(items,kpi.num),sum(items,kpi.den));
    return total+positiveScore(tier(actual,kpi.rule),kpi.weight);
  },0);
}

export async function buildRegionDashboard(env:EnvSource){
  const [sla,sto,lm]=await Promise.all([
    readSheet(env,'SLA','A:AC'),
    readSheet(env,'STO','A:I'),
    readSheet(env,'KPI LM','A:AQ')
  ]);
  const dated=sla.map(r=>({...r,__date:excelDate(r.PERIODE)})).filter(r=>r.__date);
  const lmDated=lm.map(r=>({...r,__date:excelDate(r.GRANULAR_DATE)})).filter(r=>r.__date);
  const maxDate=dated.map(r=>r.__date as string).sort().at(-1) || null;
  const lmMaxDate=lmDated.map(r=>r.__date as string).sort().at(-1) || null;
  if(!maxDate) throw new Error('No valid SLA date');
  const range=defaultPeriod(maxDate);
  const selected=dated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const lmSelected=lmDated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);

  const aggregate=(items:Row[])=>{
    const s=(key:string)=>sum(items,key);
    return {
      sla:pct(ratio(s('VOLUME_SLA_MEET'),s('VOLUME_SLA_ALL'))),
      productivityLm:ratio(s('TOTAL_PAKET_LM_SIGESIT'),s('TOTAL_MP_LM_SIGESIT')),
      productivityFm:ratio(s('TOTAL_PAKET_FM_SIGESIT'),s('TOTAL_MP_FM_SIGESIT')),
    };
  };
  const overall=aggregate(selected);
  const overallLm=lmScore(lmSelected);
  const districts=[...new Set(sto.map(r=>String(r.District||'')).filter(Boolean))].sort();
  const areas=districts.map((name,index)=>{
    const items=selected.filter(r=>String(r.District||'')===name);
    const lmItems=lmSelected.filter(r=>String(r['District Area']||'')===name);
    const a=aggregate(items);
    const kpiLm=lmScore(lmItems);
    return {id:`area-${index+1}`,name,sla:a.sla,kpiLm,kpiFm:null,kpiMm:null,productivity:a.productivityLm??a.productivityFm,status:kpiLm===null?'—':kpiLm>=95?'Excellent':kpiLm>=85?'Good':kpiLm>=60?'Fair':kpiLm>=40?'Bad':'Unsatisfactory'};
  });

  return {
    connected:true,range,
    freshness:[{source:'SLA',maxDate},{source:'LM',maxDate:lmMaxDate},{source:'FM',maxDate:null},{source:'MM',maxDate:null}],
    metrics:[
      {key:'sla',label:'SLA Performance',value:overall.sla,unit:'percent'},
      {key:'lm',label:'KPI LM',value:overallLm,unit:'percent'},
      {key:'fm',label:'KPI FM',value:null,unit:'percent'},
      {key:'mm',label:'KPI MM',value:null,unit:'percent'}
    ],
    areas
  };
}
