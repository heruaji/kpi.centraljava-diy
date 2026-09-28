import { readSheet, type EnvSource, type Row } from './data-source';
import { defaultPeriod, resolvePreset, type PeriodPreset } from './period';
import { penaltyScore, positiveScore, tier, type TierRule } from './calculation';
import { querySla, queryLm, queryFm, queryMm, getMaxDate, type QueryEnv } from './query';

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
const normHub=(v:unknown)=>String(v||'').trim().toLowerCase().replace(/^t?\d+\s*-\s*/,'');
const matchesBranch=(r:Row,name:string,code:string)=>{
  const candidates=[r.Nama_Hub,r['Hub Name'],r['Nama Hub'],r['Sortation Name']].map(normHub).filter(Boolean);
  const target=normHub(name);
  const codeKey=String(code||'').toLowerCase();
  return candidates.some(v=>v===target||v.includes(target)||target.includes(v)||(codeKey&&String(r['Hub Name']||r['Nama Hub']||r['Sortation Name']||'').toLowerCase().includes(codeKey)));
};
type KpiDetail={key:string;label:string;actual:number|null;target:number;targetLabel:string;tier:string;weight:number;score:number};
const tierLabel=(v:ReturnType<typeof tier>)=>v??'—';
type KpiDaily={date:string;numerator:number;denominator:number;actual:number|null;target:number;targetLabel:string;gap:number|null;tier:string};
type KpiDetailDaily={key:string;label:string;targetLabel:string;daily:KpiDaily[]};
const dailyRatio=(items:Row[],num:string,den:string,rule:TierRule,targetLabel:string):KpiDaily[]=>{
  const dates=[...new Set(items.map(r=>r.__date as string).filter(Boolean))].sort();
  return dates.map(date=>{const day=items.filter(r=>r.__date===date);const numerator=sum(day,num);const denominator=sum(day,den);const raw=ratio(numerator,denominator);return {date,numerator,denominator,actual:pct(raw),target:pct(rule.tier1)!,targetLabel,gap:raw===null?null:pct(rule.direction==='HIGHER'?raw-rule.tier1:rule.tier1-raw),tier:tierLabel(tier(raw,rule))}});
};
function lmDailyDetails(items:Row[]):KpiDetailDaily[]{
  const defs=[
    ['codFas','COD FAS','LAST_MILE_SERVICE_COD_VOLUME_FAS_DLV','LAST_MILE_SERVICE_COD_VOLUME_ANT',{direction:'HIGHER',tier1:.95,tier2:.92},'≥95%'],
    ['nonCodFas','Non-COD FAS','LAST_MILE_SERVICE_NON_COD_VOLUME_FAS_DLV','LAST_MILE_SERVICE_NON_COD_VOLUME_ANT',{direction:'HIGHER',tier1:.98,tier2:.96},'≥98%'],
    ['edc','Early Delivery Completion','LAST_MILE_SERVICE_VOLUME_EARLY_DELIVERY_COMPLETION','LAST_MILE_SERVICE_VOLUME_AWB_INBOUND',{direction:'HIGHER',tier1:.85,tier2:.80},'≥85%'],
    ['codFd','COD FD','LAST_MILE_SERVICE_VOLUME_COD_FD','LAST_MILE_SERVICE_VOLUME_COD_IN_LM',{direction:'LOWER',tier1:.045,tier2:.05},'≤4.5%'],
    ['hd','HD Completion','LAST_MILE_SERVICE_VOLUME_TICKET_COMPLY','LAST_MILE_SERVICE_VOLUME_TICKET_COMPLAINT',{direction:'HIGHER',tier1:.95,tier2:.90},'≥95%'],
    ['lost','Lost Rate','LAST_MILE_QUALITY_VOLUME_LOST_LM','LAST_MILE_QUALITY_VOLUME_FIRST_INLM',{direction:'LOWER',tier1:.0001,tier2:.0002},'≤0.01%'],
    ['tmt','TMT DLV','LAST_MILE_QUALITY_VOLUME_TMT_DLV','LAST_MILE_QUALITY_VOLUME_DLV',{direction:'LOWER',tier1:.0005,tier2:.0008},'≤0.05%'],
    ['fraud','Fraud COD','LAST_MILE_QUALITY_VOLUME_COD_FRAUD','LAST_MILE_QUALITY_VOLUME_COD_DLV_FRAUD',{direction:'LOWER',tier1:0,tier2:.0005},'0%'],
    ['remittance','COD Remittance','LAST_MILE_QUALITY_VOLUME_COD_TERIMA_ADMIN_H0','LAST_MILE_QUALITY_VOLUME_COD_DLV',{direction:'HIGHER',tier1:.98,tier2:.95},'≥98%'],
  ] as const;
  return defs.map(([key,label,num,den,rule,targetLabel])=>{
    if(key!=='hd') return {key,label,targetLabel,daily:dailyRatio(items,num,den,rule as TierRule,targetLabel)};
    const dates=[...new Set(items.map(r=>r.__date as string).filter(Boolean))].sort();
    const daily=dates.map(date=>{const day=items.filter(r=>r.__date===date);const numerator=sum(day,num);const denominator=sum(day,den);const raw=denominator===0?1:ratio(numerator,denominator);return {date,numerator,denominator,actual:pct(raw),target:pct((rule as TierRule).tier1)!,targetLabel,gap:raw===null?null:pct(raw-(rule as TierRule).tier1),tier:tierLabel(tier(raw,rule as TierRule))}});
    return {key,label,targetLabel,daily};
  });
}
function fmDailyDetails(items:Row[]):KpiDetailDaily[]{
  const labels=['SDOB 10 PM','SDOB 00 AM','SDOB 02 AM','N0 Pickup Attempt','N0 Pickup Success','Lost Rate','FAS Retur','Scanning Compliance','HD Completion','TMT RTS'];
  return FM_POSITIVE.map((kpi,i)=>{
    const targetLabel=`${kpi.rule.direction==='HIGHER'?'≥':'≤'}${pct(kpi.rule.tier1)}%`;
    if(!kpi.calc){
      if(i!==8) return {key:`fm-${i}`,label:labels[i],targetLabel,daily:dailyRatio(items,kpi.num!,kpi.den!,kpi.rule,targetLabel)};
      const dates=[...new Set(items.map(r=>r.__date as string).filter(Boolean))].sort();
      const daily=dates.map(date=>{const day=items.filter(r=>r.__date===date);const numerator=sum(day,kpi.num!);const denominator=sum(day,kpi.den!);const raw=denominator===0?1:ratio(numerator,denominator);return {date,numerator,denominator,actual:pct(raw),target:pct(kpi.rule.tier1)!,targetLabel,gap:raw===null?null:pct(raw-kpi.rule.tier1),tier:tierLabel(tier(raw,kpi.rule))}});
      return {key:`fm-${i}`,label:labels[i],targetLabel,daily};
    }
    const dates=[...new Set(items.map(r=>r.__date as string).filter(Boolean))].sort();
    const daily=dates.map(date=>{
      const day=items.filter(r=>r.__date===date);
      const popNum=sum(day,'VOLUME_POP_BY_APPS'),popDen=sum(day,'VOLUME_PICK');
      const outNum=sum(day,'VOLUME_OUTBRANCH_BY_APPS'),outDen=sum(day,'VOLUME_SCAN_FM');
      const a=ratio(popNum,popDen),b=ratio(outNum,outDen);
      const raw=a===null||b===null?null:(a+b)/2;
      return {date,numerator:popNum+outNum,denominator:popDen+outDen,actual:pct(raw),target:pct(kpi.rule.tier1)!,targetLabel,gap:raw===null?null:pct(raw-kpi.rule.tier1),tier:tierLabel(tier(raw,kpi.rule))};
    });
    return {key:`fm-${i}`,label:labels[i],targetLabel,daily};
  });
}
function mmActual(items:Row[],kpi:(typeof MM_POSITIVE)[number],index:number){
  const denominator=sum(items,kpi.den);
  if(index===7 && denominator===0) return 1;
  return ratio(sum(items,kpi.num),denominator);
}
function mmDailyDetails(items:Row[]):KpiDetailDaily[]{
  const labels=['SDOB 04','SDOB 06','SDOB 10','Inbound Lead Time','Scanning Compliance','Lost Rate','CC Rate','HD Completion'];
  return MM_POSITIVE.map((kpi,i)=>{
    const targetLabel=`${kpi.rule.direction==='HIGHER'?'≥':'≤'}${pct(kpi.rule.tier1)}%`;
    if(i!==7) return {key:`mm-${i}`,label:labels[i],targetLabel,daily:dailyRatio(items,kpi.num,kpi.den,kpi.rule,targetLabel)};
    const dates=[...new Set(items.map(r=>r.__date as string).filter(Boolean))].sort();
    const daily=dates.map(date=>{const day=items.filter(r=>r.__date===date);const numerator=sum(day,kpi.num);const denominator=sum(day,kpi.den);const raw=mmActual(day,kpi,i);return {date,numerator,denominator,actual:pct(raw),target:pct(kpi.rule.tier1)!,targetLabel,gap:raw===null?null:pct(raw-kpi.rule.tier1),tier:tierLabel(tier(raw,kpi.rule))}});
    return {key:`mm-${i}`,label:labels[i],targetLabel,daily};
  });
}

function lmDetails(items:Row[]):KpiDetail[]{
  const defs=[
    ['codFas','COD FAS','LAST_MILE_SERVICE_COD_VOLUME_FAS_DLV','LAST_MILE_SERVICE_COD_VOLUME_ANT',{direction:'HIGHER',tier1:.95,tier2:.92},20,'≥95%'],
    ['nonCodFas','Non-COD FAS','LAST_MILE_SERVICE_NON_COD_VOLUME_FAS_DLV','LAST_MILE_SERVICE_NON_COD_VOLUME_ANT',{direction:'HIGHER',tier1:.98,tier2:.96},20,'≥98%'],
    ['edc','Early Delivery Completion','LAST_MILE_SERVICE_VOLUME_EARLY_DELIVERY_COMPLETION','LAST_MILE_SERVICE_VOLUME_AWB_INBOUND',{direction:'HIGHER',tier1:.85,tier2:.80},20,'≥85%'],
    ['codFd','COD FD','LAST_MILE_SERVICE_VOLUME_COD_FD','LAST_MILE_SERVICE_VOLUME_COD_IN_LM',{direction:'LOWER',tier1:.045,tier2:.05},15,'≤4.5%'],
    ['hd','HD Completion','LAST_MILE_SERVICE_VOLUME_TICKET_COMPLY','LAST_MILE_SERVICE_VOLUME_TICKET_COMPLAINT',{direction:'HIGHER',tier1:.95,tier2:.90},5,'≥95%'],
    ['lost','Lost Rate','LAST_MILE_QUALITY_VOLUME_LOST_LM','LAST_MILE_QUALITY_VOLUME_FIRST_INLM',{direction:'LOWER',tier1:.0001,tier2:.0002},5,'≤0.01%'],
    ['tmt','TMT DLV','LAST_MILE_QUALITY_VOLUME_TMT_DLV','LAST_MILE_QUALITY_VOLUME_DLV',{direction:'LOWER',tier1:.0005,tier2:.0008},5,'≤0.05%'],
    ['fraud','Fraud COD','LAST_MILE_QUALITY_VOLUME_COD_FRAUD','LAST_MILE_QUALITY_VOLUME_COD_DLV_FRAUD',{direction:'LOWER',tier1:0,tier2:.0005},5,'0%'],
    ['remittance','COD Remittance','LAST_MILE_QUALITY_VOLUME_COD_TERIMA_ADMIN_H0','LAST_MILE_QUALITY_VOLUME_COD_DLV',{direction:'HIGHER',tier1:.98,tier2:.95},5,'≥98%'],
  ] as const;
  return defs.map(([key,label,num,den,rule,weight,targetLabel])=>{const denominator=sum(items,den);const actual=key==='hd'&&denominator===0?1:ratio(sum(items,num),denominator);const tr=tier(actual,rule as TierRule);return {key,label,actual:pct(actual),target:pct(rule.tier1)!,targetLabel,tier:tierLabel(tr),weight,score:positiveScore(tr,weight)}});
}
function fmDetails(items:Row[]):KpiDetail[]{
  return FM_POSITIVE.map((kpi,i)=>{const labels=['SDOB 10 PM','SDOB 00 AM','SDOB 02 AM','N0 Pickup Attempt','N0 Pickup Success','Lost Rate','FAS Retur','Scanning Compliance','HD Completion','TMT RTS'];const denominator=kpi.calc?0:sum(items,kpi.den!);const actual=kpi.calc?kpi.calc(items):i===8&&denominator===0?1:ratio(sum(items,kpi.num!),denominator);const tr=tier(actual,kpi.rule);return {key:`fm-${i}`,label:labels[i],actual:pct(actual),target:pct(kpi.rule.tier1)!,targetLabel:`${kpi.rule.direction==='HIGHER'?'≥':'≤'}${pct(kpi.rule.tier1)}%`,tier:tierLabel(tr),weight:kpi.weight,score:positiveScore(tr,kpi.weight)}});
}
function mmDetails(items:Row[]):KpiDetail[]{
  const labels=['SDOB 04','SDOB 06','SDOB 10','Inbound Lead Time','Scanning Compliance','Lost Rate','CC Rate','HD Completion'];
  return MM_POSITIVE.map((kpi,i)=>{const actual=mmActual(items,kpi,i);const tr=tier(actual,kpi.rule);return {key:`mm-${i}`,label:labels[i],actual:pct(actual),target:pct(kpi.rule.tier1)!,targetLabel:`${kpi.rule.direction==='HIGHER'?'≥':'≤'}${pct(kpi.rule.tier1)}%`,tier:tierLabel(tr),weight:kpi.weight,score:positiveScore(tr,kpi.weight)}});
}

type PenaltyDetail={key:string;label:string;actual:number|null;targetLabel:string;tier:string;maxPenalty:number;penalty:number};
const penaltyRow=(key:string,label:string,actual:number|null,rule:TierRule,maxPenalty:number,targetLabel:string):PenaltyDetail=>{
  const tr=tier(actual,rule);
  return {key,label,actual:pct(actual),targetLabel,tier:tierLabel(tr),maxPenalty,penalty:penaltyScore(tr,maxPenalty)};
};
function lmPenaltyDetails(items:Row[]):PenaltyDetail[]{
  const rosteringRaw=ratio(sum(items,'IDEAL_SORTER'),sum(items,'ACTUAL_SORTER'));
  return [
    penaltyRow('so','SO Quality',ratio(sum(items,'LAST_MILE_QUALITY_VOLUME_SO_DONE'),sum(items,'LAST_MILE_QUALITY_VOLUME_SO')),{direction:'HIGHER',tier1:.75,tier2:.70},20,'≥75%'),
    penaltyRow('stuck','Stuck Rate',ratio(sum(items,'LAST_MILE_QUALITY_STUCK_IN_WEDNESDAY'),sum(items,'LAST_MILE_QUALITY_VOLUME')),{direction:'LOWER',tier1:0,tier2:.0005},20,'0%'),
    penaltyRow('rostering','Rostering Compliance',rosteringRaw===null?1:Math.min(1,rosteringRaw),{direction:'HIGHER',tier1:1,tier2:.90},20,'100%'),
    penaltyRow('unloading','Unloading Time',ratio(sum(items,'AVG_LOADING_TIME'),sum(items,'VOLUME_ARRIVE')),{direction:'HIGHER',tier1:.98,tier2:.90},20,'≥98%'),
  ];
}
function fmPenaltyDetails(items:Row[]):PenaltyDetail[]{
  const rr=ratio(sum(items,'IDEAL_SORTER'),sum(items,'ACTUAL_SORTER'));
  return [
    penaltyRow('so','SO Quality',ratio(sum(items,'VOLUME_SO_DONE_FM'),sum(items,'VOLUME_NOB')),{direction:'HIGHER',tier1:.75,tier2:.70},50,'≥75%'),
    penaltyRow('rostering','Rostering Compliance',rr===null?1:Math.min(1,rr),{direction:'HIGHER',tier1:1,tier2:.90},30,'100%'),
  ];
}
function mmPenaltyDetails(items:Row[]):PenaltyDetail[]{
  const rates=items.map(r=>Number(r.KPI_MM_STUCK_RATE)).filter(Number.isFinite);
  const stuckActual=rates.length?rates.reduce((a,b)=>a+b,0)/rates.length:null;
  return [
    penaltyRow('unloading','Unloading Time',ratio(sum(items,'MIDDLE_MILE_COST_AVERAGE_LOADING_TIME'),sum(items,'MIDDLE_MILE_COST_VOLUME_ARRIVE')),{direction:'HIGHER',tier1:.98,tier2:.90},20,'≥98%'),
    penaltyRow('so','SO Quality',ratio(sum(items,'MIDDLE_MILE_QUALITY_VOLUME_SO_DONE'),sum(items,'MIDDLE_MILE_QUALITY_VOLUME_SO')),{direction:'HIGHER',tier1:.75,tier2:.70},20,'≥75%'),
    penaltyRow('stuck','Stuck Rate',stuckActual,{direction:'LOWER',tier1:0,tier2:.0005},20,'0%'),
  ];
}

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
  const rates=items.map(r=>Number(r.KPI_MM_STUCK_RATE)).filter(Number.isFinite);
  const stuckActual=rates.length?rates.reduce((a,b)=>a+b,0)/rates.length:null;
  const stuck=penaltyScore(tier(stuckActual,{direction:'LOWER',tier1:0,tier2:.0005}),20);
  return unloading+so+stuck;
}

function mmScore(items:Row[]){
  if(!items.length) return null;
  return MM_POSITIVE.reduce((total,kpi,index)=>{
    const actual=mmActual(items,kpi,index);
    return total+positiveScore(tier(actual,kpi.rule),kpi.weight);
  },0);
}

function fmScore(items:Row[]){
  if(!items.length) return null;
  return FM_POSITIVE.reduce((total,kpi,index)=>{
    const denominator=kpi.calc?0:sum(items,kpi.den!);
    const actual=kpi.calc?kpi.calc(items):index===8&&denominator===0?1:ratio(sum(items,kpi.num!),denominator);
    return total+positiveScore(tier(actual,kpi.rule),kpi.weight);
  },0);
}

function lmScore(items:Row[]){
  if(!items.length) return null;
  return LM_POSITIVE.reduce((total,kpi,index)=>{
    const denominator=sum(items,kpi.den);
    const actual=index===4&&denominator===0?1:ratio(sum(items,kpi.num),denominator);
    return total+positiveScore(tier(actual,kpi.rule),kpi.weight);
  },0);
}

export type DashboardSources={sla:Row[];sto:Row[];lm:Row[];fm:Row[];mm:Row[]};

export async function buildRegionDashboardFromSources(env:EnvSource,sources:DashboardSources,preset?:PeriodPreset,customRange?:{start:string;end:string}){
  const {sla,sto,lm,fm,mm}=sources;

  // Resolve the dashboard range before expanding source rows.
  const sourceDateBounds=(preset?:PeriodPreset,customRange?:{start:string;end:string})=>{
    const firstDated=sla.map(r=>excelDate(r.PERIODE)).filter((v):v is string=>!!v).sort();
    const sourceMaxDate=firstDated.at(-1);
    if(!sourceMaxDate) throw new Error('No valid SLA date');
    const range=customRange?{start:customRange.start,end:customRange.end,label:'Custom',preset:'CUSTOM' as const}:preset?resolvePreset(preset,sourceMaxDate):defaultPeriod(sourceMaxDate);
    const shiftMonth=(isoDate:string,months:number)=>{
      const [year,month,day]=isoDate.split('-').map(Number);
      const target=new Date(Date.UTC(year,month-1+months,1));
      const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
      return `${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
    };
    const previousRange={start:shiftMonth(range.start,-1),end:shiftMonth(range.end,-1)};
    const periodDays=Math.max(1,Math.round((new Date(range.end+'T00:00:00').getTime()-new Date(range.start+'T00:00:00').getTime())/86400000)+1);
    const prevPrevEndDate=new Date(new Date(previousRange.start+'T00:00:00').getTime()-86400000);
    const prevPrevStartDate=new Date(prevPrevEndDate.getTime()-(periodDays-1)*86400000);
    const iso=(d:Date)=>d.toISOString().slice(0,10);
    return {sourceMaxDate,range,previousRange,windowStart:iso(prevPrevStartDate),windowEnd:range.end};
  };
  const bounds=sourceDateBounds(preset,customRange);
  const inWindow=(value:unknown)=>{const date=excelDate(value);return !!date&&date>=bounds.windowStart&&date<=bounds.windowEnd;};
  const dated=sla.filter(r=>inWindow(r.PERIODE)).map(r=>({...r,__date:excelDate(r.PERIODE)})).filter(r=>r.__date);

  // LM: pakai District Area + Hub Name dari sheet langsung
  const lmDated=lm.filter(r=>inWindow(r.GRANULAR_DATE)).map(r=>({...r,__date:excelDate(r.GRANULAR_DATE),__area:String(r['District Area']||'').trim(),__branch:String(r['Hub Name']||r['Nama Hub']||'').trim()})).filter(r=>r.__date);

  // FM: pakai District Area + Hub Name dari sheet langsung
  const fmDated=fm.filter(r=>inWindow(r.GRANULAR_DATE)).map(r=>({...r,__date:excelDate(r.GRANULAR_DATE),__area:String(r['District Area']||'').trim(),__branch:String(r['Hub Name']||r['Nama Hub']||'').trim()})).filter(r=>r.__date);

  // MM: pakai District Area + Sortation Name dari sheet langsung
  const mmDated=mm.filter(r=>inWindow(r.GRANULAR_DATE)).map(r=>({
    ...r,
    __date:excelDate(r.GRANULAR_DATE),
    __area:String(r['District Area']||'').trim(),
    __branch:String(r['Sortation Name']||'').trim()
  })).filter(r=>r.__date);

  // Fallback resolver (hanya dipakai untuk row legacy dengan District Area kosong)
  const resolveStoArea=(row:Row)=>{
    const identities=[
      row['Hub Name'],row['Nama Hub'],row.HUB_NAME,row.HUB,
      row['Sortation Name'],row['Sortation'],row['Nama Sortation'],
      row['Branch Name'],row['Nama Cabang/Gerai']
    ].map(normHub).filter(Boolean);
    if(!identities.length) return '';
    for(const master of sto){
      const masterNames=[master['Nama Cabang/Gerai'],master.Nama].map(normHub).filter(Boolean);
      if(identities.some(source=>masterNames.some(target=>source===target||source.includes(target)||target.includes(source)))){
        return String(master.District||'').trim();
      }
    }
    return '';
 
