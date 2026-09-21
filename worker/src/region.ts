import { readSheet, type EnvSource, type Row } from './data-source';
import { defaultPeriod } from './period';
import { penaltyScore, positiveScore, tier, type TierRule } from './calculation';

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

const MM_POSITIVE:{num:string;den:string;rule:TierRule;weight:number}[]=[
  {num:'MIDDLE_MILE_SERVICE_VOLUME_SDOB04',den:'MIDDLE_MILE_SERVICE_VOLUME_INBOUND_04',rule:{direction:'HIGHER',tier1:.80,tier2:.50},weight:15},
  {num:'MIDDLE_MILE_SERVICE_VOLUME_SDOB06',den:'MIDDLE_MILE_SERVICE_VOLUME_INBOUND_06',rule:{direction:'HIGHER',tier1:.98,tier2:.90},weight:15},
  // Result MM baseline uses Detail MM I/J for SDOB10.
  {num:'MIDDLE_MILE_SERVICE_VOLUME_SDOB10',den:'MIDDLE_MILE_SERVICE_VOLUME_INBOUND_00_06',rule:{direction:'HIGHER',tier1:.95,tier2:.90},weight:15},
  {num:'MIDDLE_MILE_QUALITY_VOLUME_LEADTIME_06HR',den:'MIDDLE_MILE_QUALITY_VOLUME_DO',rule:{direction:'HIGHER',tier1:.95,tier2:.90},weight:15},
  {num:'MIDDLE_MILE_QUALITY_VOLUME_SCAN_BY_APPS',den:'MIDDLE_MILE_QUALITY_VOLUME_SCAN_MM',rule:{direction:'HIGHER',tier1:.99,tier2:.90},weight:15},
  {num:'MIDDLE_MILE_COST_VOLUME_LOST_MM',den:'MIDDLE_MILE_COST_VOLUME_H28',rule:{direction:'LOWER',tier1:.0001,tier2:.0002},weight:10},
  {num:'MIDDLE_MILE_QUALITY_VOLUME_CC_MM',den:'MIDDLE_MILE_QUALITY_VOLUME_H1',rule:{direction:'LOWER',tier1:.005,tier2:.008},weight:10},
  {num:'VOLUME_TICKET_COMPLY',den:'VOLUME_TICKET_COMPLAINT',rule:{direction:'HIGHER',tier1:.95,tier2:.90},weight:5},
];

const FM_POSITIVE:{num?:string;den?:string;calc?:(items:Row[])=>number|null;rule:TierRule;weight:number}[]=[
  {num:'VOLUME_SDOB22',den:'VOLUME_ALL_FM',rule:{direction:'HIGHER',tier1:.85,tier2:.50},weight:20},
  {num:'VOLUME_SDOB00',den:'VOLUME_ALL_FM',rule:{direction:'HIGHER',tier1:.99,tier2:.90},weight:20},
  {num:'VOLUME_SDOB02',den:'VOLUME_ALL_FM',rule:{direction:'HIGHER',tier1:.999,tier2:.90},weight:15},
  {num:'VOLUME_N0_ATTEMPT',den:'VOLUME_RPU',rule:{direction:'HIGHER',tier1:.999,tier2:.99},weight:10},
  {num:'VOLUME_N0_PICK',den:'VOLUME_RPU',rule:{direction:'HIGHER',tier1:.95,tier2:.90},weight:10},
  {num:'VOLUME_LOST_FM',den:'LOST_VOLUME_ALL_FM',rule:{direction:'LOWER',tier1:.0001,tier2:.0002},weight:5},
  {num:'VOLUME_RETURN_LESS_1_DAY',den:'VOLUME_RETURN',rule:{direction:'HIGHER',tier1:.95,tier2:.90},weight:5},
  {calc:(items)=>{const a=ratio(sum(items,'VOLUME_POP_BY_APPS'),sum(items,'VOLUME_PICK'));const b=ratio(sum(items,'VOLUME_OUTBRANCH_BY_APPS'),sum(items,'VOLUME_SCAN_FM'));return a===null||b===null?null:(a+b)/2},rule:{direction:'HIGHER',tier1:.98,tier2:.95},weight:5},
  {num:'VOLUME_TICKET_COMPLY',den:'VOLUME_TICKET_COMPLAINT',rule:{direction:'HIGHER',tier1:.95,tier2:.90},weight:5},
  {num:'VOLUME_TMT_RTS',den:'VOLUME_RTS',rule:{direction:'LOWER',tier1:.005,tier2:.009},weight:5},
];

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
function lmPenalty(items:Row[]){
  if(!items.length) return null;
  const so=penaltyScore(tier(ratio(sum(items,'LAST_MILE_QUALITY_VOLUME_SO_DONE'),sum(items,'LAST_MILE_QUALITY_VOLUME_SO')),{direction:'HIGHER',tier1:.75,tier2:.70}),20);
  const stuck=penaltyScore(tier(ratio(sum(items,'LAST_MILE_QUALITY_STUCK_IN_WEDNESDAY'),sum(items,'LAST_MILE_QUALITY_VOLUME')),{direction:'LOWER',tier1:0,tier2:.0005}),20);
  const rosteringRaw=ratio(sum(items,'IDEAL_SORTER'),sum(items,'ACTUAL_SORTER'));
  const rostering=penaltyScore(tier(rosteringRaw===null?1:Math.min(1,rosteringRaw),{direction:'HIGHER',tier1:1,tier2:.90}),20);
  const unloading=penaltyScore(tier(ratio(sum(items,'AVG_LOADING_TIME'),sum(items,'VOLUME_ARRIVE')),{direction:'HIGHER',tier1:.98,tier2:.90}),20);
  return so+stuck+rostering+unloading;
}

function fmPenalty(items:Row[]){
  if(!items.length) return null;
  const so=penaltyScore(tier(ratio(sum(items,'VOLUME_SO_DONE_FM'),sum(items,'VOLUME_NOB')),{direction:'HIGHER',tier1:.75,tier2:.70}),50);
  const rr=ratio(sum(items,'IDEAL_SORTER'),sum(items,'ACTUAL_SORTER'));
  const rostering=penaltyScore(tier(rr===null?1:Math.min(1,rr),{direction:'HIGHER',tier1:1,tier2:.90}),30);
  return so+rostering;
}

function mmPenalty(items:Row[]){
  if(!items.length) return null;
  const unloading=penaltyScore(tier(ratio(sum(items,'MIDDLE_MILE_COST_AVERAGE_LOADING_TIME'),sum(items,'MIDDLE_MILE_COST_VOLUME_ARRIVE')),{direction:'HIGHER',tier1:.98,tier2:.90}),20);
  const so=penaltyScore(tier(ratio(sum(items,'MIDDLE_MILE_QUALITY_VOLUME_SO_DONE'),sum(items,'MIDDLE_MILE_QUALITY_VOLUME_SO')),{direction:'HIGHER',tier1:.75,tier2:.70}),20);
  // Result MM uses AVERAGE(Detail MM!AF:AF), equivalent to the raw stuck-rate column.
  const rates=items.map(r=>Number(r.KPI_MM_STUCK_RATE)).filter(Number.isFinite);
  const stuckActual=rates.length?rates.reduce((a,b)=>a+b,0)/rates.length:null;
  const stuck=penaltyScore(tier(stuckActual,{direction:'LOWER',tier1:0,tier2:.0005}),20);
  return unloading+so+stuck;
}

function mmScore(items:Row[]){
  if(!items.length) return null;
  return MM_POSITIVE.reduce((total,kpi)=>{
    const actual=ratio(sum(items,kpi.num),sum(items,kpi.den));
    return total+positiveScore(tier(actual,kpi.rule),kpi.weight);
  },0);
}

function fmScore(items:Row[]){
  if(!items.length) return null;
  return FM_POSITIVE.reduce((total,kpi)=>{
    const actual=kpi.calc?kpi.calc(items):ratio(sum(items,kpi.num!),sum(items,kpi.den!));
    return total+positiveScore(tier(actual,kpi.rule),kpi.weight);
  },0);
}

function lmScore(items:Row[]){
  if(!items.length) return null;
  return LM_POSITIVE.reduce((total,kpi)=>{
    const actual=ratio(sum(items,kpi.num),sum(items,kpi.den));
    return total+positiveScore(tier(actual,kpi.rule),kpi.weight);
  },0);
}

export async function buildRegionDashboard(env:EnvSource){
  const [sla,sto,lm,fm,mm]=await Promise.all([
    readSheet(env,'SLA','A:AC'),
    readSheet(env,'STO','A:I'),
    readSheet(env,'KPI LM','A:AQ'),
    readSheet(env,'KPI FM','A:AO'),
    readSheet(env,'KPI MM','A:AJ')
  ]);
  const dated=sla.map(r=>({...r,__date:excelDate(r.PERIODE)})).filter(r=>r.__date);
  const stoAreaByHub=new Map<string,string>();
  for(const r of sto){
    const area=String(r.District||'').trim();
    const names=[r['Nama Cabang/Gerai'],r.Nama].map(v=>String(v||'').trim()).filter(Boolean);
    for(const name of names){stoAreaByHub.set(name,area);stoAreaByHub.set(name.replace(/^\d+\s*-\s*/,''),area)}
  }
  const lmDated=lm.map(r=>({...r,__date:excelDate(r.GRANULAR_DATE)})).filter(r=>r.__date);
  const fmDated=fm.map(r=>{
    const hub=String(r['Hub Name']||r['Nama Hub']||'').trim();
    const area=String(r['District Area']||'').trim()||stoAreaByHub.get(hub)||stoAreaByHub.get(hub.replace(/^\d+\s*-\s*/,''))||'';
    return {...r,__date:excelDate(r.GRANULAR_DATE),__area:area};
  }).filter(r=>r.__date);
  const mmDated=mm.map(r=>({...r,__date:excelDate(r.GRANULAR_DATE)})).filter(r=>r.__date);
  const maxDate=dated.map(r=>r.__date as string).sort().at(-1) || null;
  const lmMaxDate=lmDated.map(r=>r.__date as string).sort().at(-1) || null;
  const fmMaxDate=fmDated.map(r=>r.__date as string).sort().at(-1) || null;
  const mmMaxDate=mmDated.map(r=>r.__date as string).sort().at(-1) || null;
  if(!maxDate) throw new Error('No valid SLA date');
  const range=defaultPeriod(maxDate);
  const selected=dated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const lmSelected=lmDated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const fmSelected=fmDated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const mmSelected=mmDated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);

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
  const overallFm=fmScore(fmSelected);
  // Baseline v1 intentionally follows current Result MM behavior: positive MM score is regional/global.
  const overallMm=mmScore(mmSelected);
  const dayKeys=[...new Set(selected.map(r=>r.__date as string))].sort();
  const trend=dayKeys.map(date=>{
    const slaDay=selected.filter(r=>r.__date===date);
    const lmDay=lmSelected.filter(r=>r.__date===date);
    const fmDay=fmSelected.filter(r=>r.__date===date);
    const mmDay=mmSelected.filter(r=>r.__date===date);
    return {
      date,
      sla:aggregate(slaDay).sla,
      kpiLm:lmScore(lmDay),
      kpiFm:fmScore(fmDay),
      kpiMm:mmScore(mmDay),
    };
  });
  const penalties={lm:lmPenalty(lmSelected),fm:fmPenalty(fmSelected),mm:mmPenalty(mmSelected)};
  const districts=[...new Set(sto.map(r=>String(r.District||'')).filter(Boolean))].sort();
  const areas=districts.map((name,index)=>{
    const items=selected.filter(r=>String(r.District||'')===name);
    const lmItems=lmSelected.filter(r=>String(r['District Area']||'')===name);
    const fmItems=fmSelected.filter(r=>String(r.__area||'')===name);
    const a=aggregate(items);
    const kpiLm=lmScore(lmItems);
    const kpiFm=fmScore(fmItems);
    const health=kpiLm??kpiFm;
    const branches=sto.filter(r=>String(r.District||'')===name).map((r,branchIndex)=>({
      id:String(r['Kode Analytic']||`branch-${index+1}-${branchIndex+1}`),
      code:String(r['Kode Analytic']||''),
      name:String(r['Nama Cabang/Gerai']||r.Nama||'—'),
      function:String(r.Fungsi||'—'),
      city:String(r['KAB/ KOTA']||'—'),
    }));
    const areaDayKeys=[...new Set(items.map(r=>r.__date as string))].sort();
    const areaTrend=areaDayKeys.map(date=>{
      const slaDay=items.filter(r=>r.__date===date);
      const lmDay=lmItems.filter(r=>r.__date===date);
      const fmDay=fmItems.filter(r=>r.__date===date);
      const mmDay=mmSelected.filter(r=>r.__date===date);
      return {date,sla:aggregate(slaDay).sla,kpiLm:lmScore(lmDay),kpiFm:fmScore(fmDay),kpiMm:mmScore(mmDay)};
    });
    return {id:`area-${index+1}`,name,sla:a.sla,kpiLm,kpiFm,kpiMm:overallMm,productivity:a.productivityLm??a.productivityFm,status:health===null?'—':health>=95?'Excellent':health>=85?'Good':health>=60?'Fair':health>=40?'Bad':'Unsatisfactory',trend:areaTrend,branches};
  });

  return {
    connected:true,range,
    freshness:[{source:'SLA',maxDate},{source:'LM',maxDate:lmMaxDate},{source:'FM',maxDate:fmMaxDate},{source:'MM',maxDate:mmMaxDate}],
    metrics:[
      {key:'sla',label:'SLA Performance',value:overall.sla,unit:'percent'},
      {key:'lm',label:'KPI LM',value:overallLm,unit:'percent'},
      {key:'fm',label:'KPI FM',value:overallFm,unit:'percent'},
      {key:'mm',label:'KPI MM',value:overallMm,unit:'percent'}
    ],
    penalties,
    trend,
    areas
  };
}
