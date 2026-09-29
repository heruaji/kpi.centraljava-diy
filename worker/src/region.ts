import { readSheet, type EnvSource, type Row } from './data-source';
import { defaultPeriod, resolvePreset, type PeriodPreset } from './period';
import { penaltyScore, positiveScore, tier, type TierRule } from './calculation';
import { querySla, queryLm, queryFm, queryMm, getMaxDate, type QueryEnv, querySlaNeon, queryLmNeon, queryFmNeon, queryMmNeon, getNeonMaxDate, type NeonQueryEnv } from './query';

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
  };

  // Fallback hanya dijalankan untuk row yang District Area-nya kosong
  const mmMissingArea=mmDated.filter(r=>!r.__area);
  if(mmMissingArea.length>0){
    mmMissingArea.forEach(r=>{r.__area=resolveStoArea(r);});
  }

  const maxDate=bounds.sourceMaxDate;
  const maxSourceDate=(rows:Row[],key:string)=>{
    let max:string|null=null;
    for(const row of rows){
      const date=excelDate(row[key]);
      if(date&&(max===null||date>max)) max=date;
    }
    return max;
  };
  const lmMaxDate=maxSourceDate(lm,'GRANULAR_DATE');
  const fmMaxDate=maxSourceDate(fm,'GRANULAR_DATE');
  const mmMaxDate=maxSourceDate(mm,'GRANULAR_DATE');
  const {range,previousRange}=bounds;
  const selected=dated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const previousSelected=dated.filter(r=>(r.__date as string)>=previousRange.start && (r.__date as string)<=previousRange.end);
  const lmSelected=lmDated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const lmPreviousSelected=lmDated.filter(r=>(r.__date as string)>=previousRange.start && (r.__date as string)<=previousRange.end);
  const fmSelected=fmDated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const fmPreviousSelected=fmDated.filter(r=>(r.__date as string)>=previousRange.start && (r.__date as string)<=previousRange.end);
  const mmSelected=mmDated.filter(r=>(r.__date as string)>=range.start && (r.__date as string)<=range.end);
  const mmPreviousSelected=mmDated.filter(r=>(r.__date as string)>=previousRange.start && (r.__date as string)<=previousRange.end);

const aggregate=(items:Row[])=>{
    const s=(key:string)=>sum(items,key);
    // Rule: 0 manpower dianggap 1 orang (konsisten dengan productivitySet)
    const prod=(vol:number,mp:number)=>ratio(vol,mp>0?mp:1);
    return {
      sla:pct(ratio(s('VOLUME_SLA_MEET'),s('VOLUME_SLA_ALL'))),
      productivityLm:prod(s('TOTAL_PAKET_LM_SIGESIT'),s('TOTAL_MP_LM_SIGESIT')),
      productivityFm:prod(s('TOTAL_PAKET_FM_SIGESIT'),s('TOTAL_MP_FM_SIGESIT')),
      productivitySorterLm:prod(s('TOTAL_PAKET_LM_SORTER'),s('TOTAL_MP_LM_SORTER')),
      productivitySorterFm:prod(s('TOTAL_PAKET_FM_SORTER'),s('TOTAL_MP_FM_SORTER')),
    };
  };
const productivitySet=(items:Row[],previousItems:Row[],previousPreviousItems:Row[],role:'courier'|'sorter',mile:'lm'|'fm')=>{
    const suffix=role==='courier'?'SIGESIT':'SORTER';
    const m=mile.toUpperCase();
    const volumeKey=`TOTAL_PAKET_${m}_${suffix}`;
    const manpowerKey=`TOTAL_MP_${m}_${suffix}`;
    // Total productivity: sum volume ÷ sum effective manpower (0→1 per hari)
    const calc=(rows:Row[])=>{
      if(!rows.length) return null;
      const byDate=new Map<string,{v:number;m:number}>();
      for(const r of rows){
        const d=String(r.__date??'');
        if(!d) continue;
        const cur=byDate.get(d)??{v:0,m:0};
        cur.v+=Number(r[volumeKey])||0;
        cur.m+=Number(r[manpowerKey])||0;
        byDate.set(d,cur);
      }
      if(!byDate.size) return null;
      let totalV=0, totalM=0;
      for(const {v,m} of byDate.values()){ totalV+=v; totalM+=m>0?m:1; }
      return totalM>0?totalV/totalM:null;
    };
    // Daily productivity: volume hari itu ÷ effective manpower hari itu
    const calcDay=(rows:Row[])=>{
      if(!rows.length) return null;
      const v=sum(rows,volumeKey);
      const m=sum(rows,manpowerKey);
      return ratio(v,m>0?m:1);
    };
    const dates=[...new Set(items.map(r=>r.__date as string).filter(Boolean))].sort();
    return {value:calc(items),previous:calc(previousItems),previousPrevious:calc(previousPreviousItems),volume:sum(items,volumeKey),manpower:sum(items,manpowerKey),trend:dates.map(date=>{const day=items.filter(r=>r.__date===date);return {date,value:calcDay(day),volume:sum(day,volumeKey),manpower:sum(day,manpowerKey)}})};
  };
    const dates=[...new Set(items.map(r=>r.__date as string).filter(Boolean))].sort();
    return {value:calc(items),previous:calc(previousItems),previousPrevious:calc(previousPreviousItems),volume:sum(items,volumeKey),manpower:sum(items,manpowerKey),trend:dates.map(date=>{const day=items.filter(r=>r.__date===date);return {date,value:calc(day),volume:sum(day,volumeKey),manpower:sum(day,manpowerKey)}})};
  };
  const productivityBundle=(items:Row[],previousItems:Row[],previousPreviousItems:Row[])=>({
    courier:{lm:productivitySet(items,previousItems,previousPreviousItems,'courier','lm'),fm:productivitySet(items,previousItems,previousPreviousItems,'courier','fm')},
    sorter:{lm:productivitySet(items,previousItems,previousPreviousItems,'sorter','lm'),fm:productivitySet(items,previousItems,previousPreviousItems,'sorter','fm')}
  });
  const rankingMetric=(key:string,label:string,actual:number|null,tier1:number,tier2:number,maxScore:number,direction:'HIGHER'|'LOWER')=>{
    if(actual==null) return {key,label,actual,tier:'No Data' as const,score:0,maxScore};
    const isTier1=direction==='HIGHER'?actual>=tier1:actual<=tier1;
    const isTier2=direction==='HIGHER'?actual>=tier2:actual<=tier2;
    return {key,label,actual,tier:isTier1?'Tier 1' as const:isTier2?'Tier 2' as const:'Tier 3' as const,score:isTier1?maxScore:isTier2?maxScore/2:0,maxScore};
  };
  const areaRanking=(items:Row[])=>{
    const a=aggregate(items);
    const cod=pct(ratio(sum(items,'VOLUME_COD_TF'),sum(items,'VOLUME_COD_ALL')));
    const failed=pct(ratio(sum(items,'VOLUME_FD'),sum(items,'VOLUME_FD_ALL')));
    const backlog=pct(ratio(sum(items,'VOLUME_BACKLOG'),sum(items,'VOLUME_BACKLOG_ALL')));
    const details=[
      rankingMetric('sla','SLA Performance',a.sla,96,95,30,'HIGHER'),
      rankingMetric('cod','COD Transferred',cod,99.5,99,5,'HIGHER'),
      rankingMetric('failed','Failed Delivery',failed,1,1.5,20,'LOWER'),
      rankingMetric('backlog','Backlog Rate',backlog,1.5,2,10,'LOWER'),
      rankingMetric('sorterFm','Productivity Sorter FM',a.productivitySorterFm,980,750,5,'HIGHER'),
      rankingMetric('sorterLm','Productivity Sorter LM',a.productivitySorterLm,780,550,5,'HIGHER'),
      rankingMetric('courierFm','Productivity Kurir FM',a.productivityFm,115,88,10,'HIGHER'),
      rankingMetric('courierLm','Productivity Kurir LM',a.productivityLm,51,40,15,'HIGHER'),
    ];
    return {score:details.reduce((total,item)=>total+item.score,0),details};
  };
  const previousPreviousSelected=dated.filter(r=>(r.__date as string)>=bounds.windowStart&&(r.__date as string)<previousRange.start);
  const overall=aggregate(selected);
  const overallLm=lmScore(lmSelected);
  const overallFm=fmScore(fmSelected);
  const overallMm=mmScore(mmSelected);
  const dayKeys=[...new Set(selected.map(r=>r.__date as string))].sort();
  const trend=dayKeys.map(date=>{
    const slaDay=selected.filter(r=>r.__date===date);
    const lmDay=lmSelected.filter(r=>r.__date===date);
    const fmDay=fmSelected.filter(r=>r.__date===date);
    const mmDay=mmSelected.filter(r=>r.__date===date);
    const dayAggregate=aggregate(slaDay);
    return {
      date,
      sla:dayAggregate.sla,
      volume:sum(slaDay,'VOLUME_SLA_ALL'),
      codTransferRate:pct(ratio(sum(slaDay,'VOLUME_COD_TF'),sum(slaDay,'VOLUME_COD_ALL'))),
      codTransferVolume:sum(slaDay,'VOLUME_COD_TF'),
      failedDeliveryRate:pct(ratio(sum(slaDay,'VOLUME_FD'),sum(slaDay,'VOLUME_FD_ALL'))),
      backlogRate:pct(ratio(sum(slaDay,'VOLUME_BACKLOG'),sum(slaDay,'VOLUME_BACKLOG_ALL'))),
      productivitySorterFm:dayAggregate.productivitySorterFm,
      productivitySorterLm:dayAggregate.productivitySorterLm,
      productivityCourierFm:dayAggregate.productivityFm,
      productivityCourierLm:dayAggregate.productivityLm,
      productivity:dayAggregate.productivityLm,
      productivityVolume:sum(slaDay,'TOTAL_PAKET_LM_SIGESIT'),
      productivityManpower:sum(slaDay,'TOTAL_MP_LM_SIGESIT'),
      kpiLm:lmScore(lmDay),
      kpiFm:fmScore(fmDay),
      kpiMm:mmScore(mmDay),
    };
  });
  const penalties={lm:lmPenalty(lmSelected),fm:fmPenalty(fmSelected),mm:mmPenalty(mmSelected)};

  // Filter district yang valid — buang kosong dan placeholder umum
  const INVALID_DISTRICTS = new Set([
    '', 'tidak ditemukan', 'tidak ditemukan.', 'n/a', 'na', '-', '--',
    'null', 'undefined', '#n/a', '#value!', '#ref!',
  ]);
  const isValidDistrict = (v: string) => {
    const clean = v.trim().toLowerCase();
    return clean.length > 0 && !INVALID_DISTRICTS.has(clean);
  };

  const districts = [...new Set([
    ...dated.map(r => String(r.District || '').trim()),
    ...lmDated.map(r => String(r.__area || '').trim()),
    ...fmDated.map(r => String(r.__area || '').trim()),
    ...mmDated.map(r => String(r.__area || '').trim()),
  ].filter(isValidDistrict))].sort();

  const areas=districts.map((name,index)=>{
    const items=selected.filter(r=>String(r.District||'')===name);
    const previousItems=previousSelected.filter(r=>String(r.District||'')===name);
    const lmItems=lmSelected.filter(r=>String(r.__area||'')===name);
    const fmItems=fmSelected.filter(r=>String(r.__area||'')===name);
    const lmPreviousItems=lmPreviousSelected.filter(r=>String(r.__area||'')===name);
    const fmPreviousItems=fmPreviousSelected.filter(r=>String(r.__area||'')===name);
    const mmItems=mmSelected.filter(r=>String(r.__area||'')===name);
    const mmPreviousItems=mmPreviousSelected.filter(r=>String(r.__area||'')===name);
    const a=aggregate(items);
    const kpiLm=lmScore(lmItems);
    const kpiFm=fmScore(fmItems);
    const kpiMm=mmScore(mmItems);
    const health=kpiLm??kpiFm??kpiMm;
    const nativeBranches=new Map<string,{name:string;function:string;code:string;city:string}>();
    const addNative=(branchName:string,fn:string)=>{
      const clean=branchName.trim(); if(!clean) return;
      const key=`${fn}|${normHub(clean)}`;
      if(!nativeBranches.has(key)) nativeBranches.set(key,{name:clean,function:fn,code:'',city:'—'});
    };
    // SLA / LM / FM: native membership dari kolom sheet masing-masing
    items.forEach(r=>addNative(String(r.Nama_Hub||'').trim(),String(r.Mile||'').trim().toUpperCase()||'LM'));
    lmItems.forEach(r=>addNative(String(r.__branch||''),'LM'));
    fmItems.forEach(r=>addNative(String(r.__branch||''),'FM'));

    // MM membership sekarang dari kolom Sortation Name di sheet MM sendiri.
    mmItems.forEach(r=>addNative(String(r.__branch||''),'MM'));
    sto.filter(r=>String(r.Fungsi||'').toUpperCase()==='MM').forEach(r=>{
      const stoBranchName=String(r['Nama Cabang/Gerai']||r.Nama||'').trim();
      if(!stoBranchName) return;
      const key=`MM|${normHub(stoBranchName)}`;
      const entry=nativeBranches.get(key);
      if(!entry) return;
      if(!entry.code&&r['Kode Analytic']) entry.code=String(r['Kode Analytic']);
      if(entry.city==='—'&&r['KAB/ KOTA']) entry.city=String(r['KAB/ KOTA']);
    });

    const branches=[...nativeBranches.values()].map((r,branchIndex)=>{
      const code=r.code;
      const branchName=r.name;
      const fn=r.function;
      const slaItems=items.filter(x=>matchesBranch(x,branchName,code));
      const previousSlaItems=previousSelected.filter(x=>String(x.District||'')===name && matchesBranch(x,branchName,code));
      const lmBranch=lmItems.filter(x=>matchesBranch(x,branchName,code));
      const fmBranch=fmItems.filter(x=>matchesBranch(x,branchName,code));
      const mmBranch=mmItems.filter(x=>matchesBranch(x,branchName,code));
      const lmPreviousBranch=lmPreviousItems.filter(x=>matchesBranch(x,branchName,code));
      const fmPreviousBranch=fmPreviousItems.filter(x=>matchesBranch(x,branchName,code));
      const mmPreviousBranch=mmPreviousItems.filter(x=>matchesBranch(x,branchName,code));
      const previousSourceItems=fn==='LM'?lmPreviousBranch:fn==='FM'?fmPreviousBranch:mmPreviousBranch;
      const sourceItems=fn==='LM'?lmBranch:fn==='FM'?fmBranch:mmBranch;
      const score=fn==='LM'?lmScore(lmBranch):fn==='FM'?fmScore(fmBranch):fn==='MM'?mmScore(mmBranch):null;
      const penalty=fn==='LM'?lmPenalty(lmBranch):fn==='FM'?fmPenalty(fmBranch):fn==='MM'?mmPenalty(mmBranch):null;
      const kpiScorePrevious=fn==='LM'?lmScore(lmPreviousBranch):fn==='FM'?fmScore(fmPreviousBranch):fn==='MM'?mmScore(mmPreviousBranch):null;
      const penaltyPrevious=fn==='LM'?lmPenalty(lmPreviousBranch):fn==='FM'?fmPenalty(fmPreviousBranch):fn==='MM'?mmPenalty(mmPreviousBranch):null;
      const branchDayKeys=[...new Set([...sourceItems.map(x=>x.__date as string),...slaItems.map(x=>x.__date as string)].filter(Boolean))].sort();
      const branchTrend=branchDayKeys.map(date=>{
        const day=sourceItems.filter(x=>x.__date===date);
        const slaDay=slaItems.filter(x=>x.__date===date);
        const dailyAgg=aggregate(slaDay);
        return {date,sla:dailyAgg.sla,slaMeet:sum(slaDay,'VOLUME_SLA_MEET'),slaAll:sum(slaDay,'VOLUME_SLA_ALL'),productivity:fn==='LM'?dailyAgg.productivityLm:null,productivityVolume:fn==='LM'?sum(slaDay,'TOTAL_PAKET_LM_SIGESIT'):null,productivityManpower:fn==='LM'?sum(slaDay,'TOTAL_MP_LM_SIGESIT'):null,kpiLm:fn==='LM'?lmScore(day):null,kpiFm:fn==='FM'?fmScore(day):null,kpiMm:fn==='MM'?mmScore(day):null};
      });
      const operationalTrend=branchDayKeys.map(date=>{
        const day=slaItems.filter(x=>x.__date===date);
        return {
          date,
          volume:sum(day,'VOLUME_SLA_ALL'),
          backlog:sum(day,'VOLUME_BACKLOG'),
          backlogRate:pct(ratio(sum(day,'VOLUME_BACKLOG'),sum(day,'VOLUME_BACKLOG_ALL'))),
          failedDelivery:sum(day,'VOLUME_FD'),
          failedDeliveryRate:pct(ratio(sum(day,'VOLUME_FD'),sum(day,'VOLUME_FD_ALL'))),
          codTransfer:sum(day,'VOLUME_COD_TF'),
          codTransferRate:pct(ratio(sum(day,'VOLUME_COD_TF'),sum(day,'VOLUME_COD_ALL')))
        };
      });
      return {
        id:code||`branch-${index+1}-${branchIndex+1}`,code,name:branchName,function:fn,city:r.city,
        sla:aggregate(slaItems).sla,slaPrevious:aggregate(previousSlaItems).sla,kpiScore:score,kpiScorePrevious,penalty,penaltyPrevious,productivity:aggregate(slaItems).productivityLm??aggregate(slaItems).productivityFm,productivityPrevious:aggregate(previousSlaItems).productivityLm??aggregate(previousSlaItems).productivityFm,productivityByRole:productivityBundle(slaItems,previousSlaItems,previousPreviousSelected.filter(x=>String(x.District||'')===name&&matchesBranch(x,branchName,code))),
        operations:{
          volume:sum(slaItems,'VOLUME_SLA_ALL'),
          backlog:sum(slaItems,'VOLUME_BACKLOG'),
          backlogRate:pct(ratio(sum(slaItems,'VOLUME_BACKLOG'),sum(slaItems,'VOLUME_BACKLOG_ALL'))),
          failedDelivery:sum(slaItems,'VOLUME_FD'),
          failedDeliveryRate:pct(ratio(sum(slaItems,'VOLUME_FD'),sum(slaItems,'VOLUME_FD_ALL'))),
          codTransfer:sum(slaItems,'VOLUME_COD_TF'),
          codTransferRate:pct(ratio(sum(slaItems,'VOLUME_COD_TF'),sum(slaItems,'VOLUME_COD_ALL'))),
          comparison:{
            label:previousRange.start.slice(0,7),
            volume:sum(previousSlaItems,'VOLUME_SLA_ALL'),
            backlogRate:pct(ratio(sum(previousSlaItems,'VOLUME_BACKLOG'),sum(previousSlaItems,'VOLUME_BACKLOG_ALL'))),
            failedDeliveryRate:pct(ratio(sum(previousSlaItems,'VOLUME_FD'),sum(previousSlaItems,'VOLUME_FD_ALL'))),
            codTransferRate:pct(ratio(sum(previousSlaItems,'VOLUME_COD_TF'),sum(previousSlaItems,'VOLUME_COD_ALL'))),
          },
        },
        kpiDetails:fn==='LM'?lmDetails(lmBranch):fn==='FM'?fmDetails(fmBranch):fn==='MM'?mmDetails(mmBranch):[],
        penaltyDetails:fn==='LM'?lmPenaltyDetails(lmBranch):fn==='FM'?fmPenaltyDetails(fmBranch):fn==='MM'?mmPenaltyDetails(mmBranch):[],
        kpiDailyDetails:fn==='LM'?lmDailyDetails(lmBranch):fn==='FM'?fmDailyDetails(fmBranch):fn==='MM'?mmDailyDetails(mmBranch):[],operationalTrend,trend:branchTrend
      };
    });
    const areaDayKeys=[...new Set(items.map(r=>r.__date as string))].sort();
    const areaTrend=areaDayKeys.map(date=>{
      const slaDay=items.filter(r=>r.__date===date);
      const lmDay=lmItems.filter(r=>r.__date===date);
      const fmDay=fmItems.filter(r=>r.__date===date);
      const mmDay=mmItems.filter(r=>r.__date===date);
      return {date,sla:aggregate(slaDay).sla,volume:sum(slaDay,'VOLUME_SLA_ALL'),backlogRate:pct(ratio(sum(slaDay,'VOLUME_BACKLOG'),sum(slaDay,'VOLUME_BACKLOG_ALL'))),failedDeliveryRate:pct(ratio(sum(slaDay,'VOLUME_FD'),sum(slaDay,'VOLUME_FD_ALL'))),codTransferRate:pct(ratio(sum(slaDay,'VOLUME_COD_TF'),sum(slaDay,'VOLUME_COD_ALL'))),kpiLm:lmScore(lmDay),kpiFm:fmScore(fmDay),kpiMm:mmScore(mmDay)};
    });
    const kpiDetailsLm=lmDetails(lmItems);
    const kpiDetailsFm=fmDetails(fmItems);
    const kpiDetailsMm=mmDetails(mmItems);
    const penaltyDetailsLm=lmPenaltyDetails(lmItems);
    const penaltyDetailsFm=fmPenaltyDetails(fmItems);
    const penaltyDetailsMm=mmPenaltyDetails(mmItems);
    const penaltyLm=lmPenalty(lmItems);
    const penaltyFm=fmPenalty(fmItems);
    const penaltyMm=mmPenalty(mmItems);
    return {id:`area-${index+1}`,name,operations:{volume:sum(items,'VOLUME_SLA_ALL'),backlog:sum(items,'VOLUME_BACKLOG'),backlogRate:pct(ratio(sum(items,'VOLUME_BACKLOG'),sum(items,'VOLUME_BACKLOG_ALL'))),failedDelivery:sum(items,'VOLUME_FD'),failedDeliveryRate:pct(ratio(sum(items,'VOLUME_FD'),sum(items,'VOLUME_FD_ALL'))),codTransfer:sum(items,'VOLUME_COD_TF'),codTransferRate:pct(ratio(sum(items,'VOLUME_COD_TF'),sum(items,'VOLUME_COD_ALL'))),comparison:{label:previousRange.start.slice(0,7),volume:sum(previousItems,'VOLUME_SLA_ALL'),backlogRate:pct(ratio(sum(previousItems,'VOLUME_BACKLOG'),sum(previousItems,'VOLUME_BACKLOG_ALL'))),failedDeliveryRate:pct(ratio(sum(previousItems,'VOLUME_FD'),sum(previousItems,'VOLUME_FD_ALL'))),codTransferRate:pct(ratio(sum(previousItems,'VOLUME_COD_TF'),sum(previousItems,'VOLUME_COD_ALL')))}},ranking:areaRanking(items),sla:a.sla,slaPrevious:aggregate(previousItems).sla,kpiLm,kpiFm,kpiMm,productivity:a.productivityLm,productivityPrevious:aggregate(previousItems).productivityLm,productivityByRole:productivityBundle(items,previousItems,previousPreviousSelected.filter(r=>String(r.District||'')===name)),status:health===null?'—':health>=95?'Excellent':health>=85?'Good':health>=60?'Fair':health>=40?'Bad':'Unsatisfactory',trend:areaTrend,branches,kpiDetailsLm,kpiDetailsFm,kpiDetailsMm,penaltyLm,penaltyFm,penaltyMm,penaltyDetailsLm,penaltyDetailsFm,penaltyDetailsMm};
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
    operations:{
      volume:sum(selected,'VOLUME_SLA_ALL'),
      backlog:sum(selected,'VOLUME_BACKLOG'),
      backlogRate:pct(ratio(sum(selected,'VOLUME_BACKLOG'),sum(selected,'VOLUME_BACKLOG_ALL'))),
      failedDelivery:sum(selected,'VOLUME_FD'),
      failedDeliveryRate:pct(ratio(sum(selected,'VOLUME_FD'),sum(selected,'VOLUME_FD_ALL'))),
      codTransfer:sum(selected,'VOLUME_COD_TF'),
      codTransferRate:pct(ratio(sum(selected,'VOLUME_COD_TF'),sum(selected,'VOLUME_COD_ALL'))),
      comparison:{
        label:previousRange.end,
        volume:sum(previousSelected,'VOLUME_SLA_ALL'),
        backlog:sum(previousSelected,'VOLUME_BACKLOG'),
        backlogRate:pct(ratio(sum(previousSelected,'VOLUME_BACKLOG'),sum(previousSelected,'VOLUME_BACKLOG_ALL'))),
        failedDelivery:sum(previousSelected,'VOLUME_FD'),
        failedDeliveryRate:pct(ratio(sum(previousSelected,'VOLUME_FD'),sum(previousSelected,'VOLUME_FD_ALL'))),
        codTransfer:sum(previousSelected,'VOLUME_COD_TF'),
        codTransferRate:pct(ratio(sum(previousSelected,'VOLUME_COD_TF'),sum(previousSelected,'VOLUME_COD_ALL')))
      }
    },
    productivityByRole:productivityBundle(selected,previousSelected,previousPreviousSelected),
    areas
  };
}


export async function readDashboardFreshness(env:EnvSource){
  const [sla,lm,fm,mm]=await Promise.all([
    readSheet(env,'SLA','A:A'),
    readSheet(env,'KPI LM','A:A'),
    readSheet(env,'KPI FM','A:A'),
    readSheet(env,'KPI MM','A:A')
  ]);
  const info=(source:string,items:Row[],key:string)=>({
    source,
    rowCount:items.length,
    maxDate:items.map(r=>excelDate(r[key])).filter((v):v is string=>!!v).sort().at(-1)||null
  });
  return [
    info('SLA',sla,'PERIODE'),
    info('LM',lm,'GRANULAR_DATE'),
    info('FM',fm,'GRANULAR_DATE'),
    info('MM',mm,'GRANULAR_DATE')
  ];
}

export async function buildRegionDashboard(env:EnvSource,preset?:PeriodPreset,customRange?:{start:string;end:string}){
  const sla=await readSheet(env,'SLA','A:AC');
  const sto=await readSheet(env,'STO','A:I');
  const lm=await readSheet(env,'KPI LM','A:AQ');
  const fm=await readSheet(env,'KPI FM','A:AO');
  const mm=await readSheet(env,'KPI MM','A:AK');
  return buildRegionDashboardFromSources(env,{sla,sto,lm,fm,mm},preset,customRange);
}

/**
 * Build dashboard dari D1 (bukan Google Sheets).
 * Asumsi: D1 sudah terisi via sync.ts.
 */
export async function buildRegionDashboardFromD1(
  env: EnvSource & QueryEnv,
  preset?: PeriodPreset,
  customRange?: { start: string; end: string },
) {
  const sourceMaxDate = await getMaxDate(env);
  if (!sourceMaxDate) throw new Error('D1 belum memiliki data. Jalankan sync dulu.');

  const range = customRange
    ? {
        start: customRange.start,
        end: customRange.end,
        label: 'Custom',
        preset: 'CUSTOM' as const,
      }
    : preset
      ? resolvePreset(preset, sourceMaxDate)
      : defaultPeriod(sourceMaxDate);

  const shiftMonth = (isoDate: string, months: number) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  };

  const previousRange = {
    start: shiftMonth(range.start, -1),
    end: shiftMonth(range.end, -1),
  };

  const periodDays = Math.max(
    1,
    Math.round(
      (new Date(range.end + 'T00:00:00').getTime() -
        new Date(range.start + 'T00:00:00').getTime()) /
        86400000,
    ) + 1,
  );

  const prevPrevEndDate = new Date(
    new Date(previousRange.start + 'T00:00:00').getTime() - 86400000,
  );
  const prevPrevStartDate = new Date(
    prevPrevEndDate.getTime() - (periodDays - 1) * 86400000,
  );

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const windowStart = iso(prevPrevStartDate);
  const windowEnd = range.end;

  const [sla, lm, fm, mm] = await Promise.all([
    querySla(env, windowStart, windowEnd),
    queryLm(env, windowStart, windowEnd),
    queryFm(env, windowStart, windowEnd),
    queryMm(env, windowStart, windowEnd),
  ]);

  const sto = await readSheet(env, 'STO', 'A:I');

  return buildRegionDashboardFromSources(
    env,
    { sla, sto, lm, fm, mm },
    preset,
    customRange,
  );
}

// ============================================================
// NEON BUILD (Fase 5)
// ============================================================

export async function buildRegionDashboardFromNeon(
  env: EnvSource & NeonQueryEnv,
  preset?: PeriodPreset,
  customRange?: { start: string; end: string },
) {
  const sourceMaxDate = await getNeonMaxDate(env);
  if (!sourceMaxDate) throw new Error('Neon belum memiliki data. Jalankan sync dulu.');

  const range = customRange
    ? { start: customRange.start, end: customRange.end, label: 'Custom', preset: 'CUSTOM' as const }
    : preset
      ? resolvePreset(preset, sourceMaxDate)
      : defaultPeriod(sourceMaxDate);

  const shiftMonth = (isoDate: string, months: number) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  };

  const previousRange = {
    start: shiftMonth(range.start, -1),
    end: shiftMonth(range.end, -1),
  };

  const periodDays = Math.max(
    1,
    Math.round(
      (new Date(range.end + 'T00:00:00').getTime() - new Date(range.start + 'T00:00:00').getTime()) / 86400000,
    ) + 1,
  );

  const prevPrevEndDate = new Date(new Date(previousRange.start + 'T00:00:00').getTime() - 86400000);
  const prevPrevStartDate = new Date(prevPrevEndDate.getTime() - (periodDays - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const windowStart = iso(prevPrevStartDate);
  const windowEnd = range.end;

  const [sla, lm, fm, mm] = await Promise.all([
    querySlaNeon(env, windowStart, windowEnd),
    queryLmNeon(env, windowStart, windowEnd),
    queryFmNeon(env, windowStart, windowEnd),
    queryMmNeon(env, windowStart, windowEnd),
  ]);

  const sto = await readSheet(env, 'STO', 'A:I');

  return buildRegionDashboardFromSources(env, { sla, sto, lm, fm, mm }, preset, customRange);
}
