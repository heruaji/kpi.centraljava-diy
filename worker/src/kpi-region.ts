import type { Row } from './data-source';
import { querySla, type QueryEnv } from './query';

type Direction = 'HIGHER' | 'LOWER';
type KpiDefinition = {
  key: string; label: string; numerator: string; denominator?: string;
  tier1: number; tier2: number; direction: Direction; weight: number; unit: 'percent' | 'number';
};
const KPI_DEFINITIONS: KpiDefinition[] = [
  { key:'sla', label:'SLA Performance', numerator:'VOLUME_SLA_MEET', denominator:'VOLUME_SLA_ALL', tier1:96, tier2:95, direction:'HIGHER', weight:30, unit:'percent' },
  { key:'cod', label:'COD Transferred', numerator:'VOLUME_COD_TF', denominator:'VOLUME_COD_ALL', tier1:99.5, tier2:99, direction:'HIGHER', weight:5, unit:'percent' },
  { key:'failed', label:'Failed Delivery', numerator:'VOLUME_FD', denominator:'VOLUME_FD_ALL', tier1:1, tier2:1.5, direction:'LOWER', weight:20, unit:'percent' },
  { key:'backlog', label:'Backlog Rate', numerator:'VOLUME_BACKLOG', denominator:'VOLUME_BACKLOG_ALL', tier1:1.5, tier2:2, direction:'LOWER', weight:10, unit:'percent' },
  { key:'sorterFm', label:'Productivity Sorter FM', numerator:'TOTAL_PAKET_FM_SORTER', denominator:'TOTAL_MP_FM_SORTER', tier1:820, tier2:750, direction:'HIGHER', weight:5, unit:'number' },
  { key:'sorterLm', label:'Productivity Sorter LM', numerator:'TOTAL_PAKET_LM_SORTER', denominator:'TOTAL_MP_LM_SORTER', tier1:650, tier2:550, direction:'HIGHER', weight:5, unit:'number' },
  { key:'sigesitFm', label:'Productivity Sigesit FM', numerator:'TOTAL_PAKET_FM_SIGESIT', denominator:'TOTAL_MP_FM_SIGESIT', tier1:115, tier2:88, direction:'HIGHER', weight:10, unit:'number' },
  { key:'sigesitLm', label:'Productivity Sigesit LM', numerator:'TOTAL_PAKET_LM_SIGESIT', denominator:'TOTAL_MP_LM_SIGESIT', tier1:51, tier2:40, direction:'HIGHER', weight:15, unit:'number' },
];
const num=(value:unknown)=>typeof value==='number'?value:Number(value)||0;
function isoDate(value:unknown):string|null {
  if (typeof value==='number' && Number.isFinite(value)) return new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10);
  const text=String(value??'').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0,10);
  const parsed=new Date(text);
  return Number.isNaN(parsed.getTime())?null:parsed.toISOString().slice(0,10);
}
function sum(rows:Row[], key:string){return rows.reduce((total,row)=>total+num(row[key]),0);}
function productivity(rows:Row[], volumeKey:string, manpowerKey:string):number|null {
  if (!rows.length) return null;
  const byDate=new Map<string,{volume:number;manpower:number}>();
  for (const row of rows) {
    const date=isoDate(row.PERIODE);
    if (!date) continue;
    const current=byDate.get(date)??{volume:0,manpower:0};
    current.volume+=num(row[volumeKey]);
    current.manpower+=num(row[manpowerKey]);
    byDate.set(date,current);
  }
  let volume=0, manpower=0;
  for (const day of byDate.values()) {
    if (day.volume===0 && day.manpower===0) continue;
    volume+=day.volume;
    manpower+=day.manpower>0?day.manpower:1;
  }
  return manpower>0?volume/manpower:null;
}
function tier(actual:number|null, definition:KpiDefinition):'Tier 1'|'Tier 2'|'Tier 3'|'No Data' {
  if (actual===null || !Number.isFinite(actual)) return 'No Data';
  const tier1=definition.direction==='HIGHER'?actual>=definition.tier1:actual<=definition.tier1;
  if (tier1) return 'Tier 1';
  const tier2=definition.direction==='HIGHER'?actual>=definition.tier2:actual<=definition.tier2;
  return tier2?'Tier 2':'Tier 3';
}
function actualFor(rows:Row[], definition:KpiDefinition):number|null {
  if (definition.key==='sorterFm') return productivity(rows,'TOTAL_PAKET_FM_SORTER','TOTAL_MP_FM_SORTER');
  if (definition.key==='sorterLm') return productivity(rows,'TOTAL_PAKET_LM_SORTER','TOTAL_MP_LM_SORTER');
  if (definition.key==='sigesitFm') return productivity(rows,'TOTAL_PAKET_FM_SIGESIT','TOTAL_MP_FM_SIGESIT');
  if (definition.key==='sigesitLm') return productivity(rows,'TOTAL_PAKET_LM_SIGESIT','TOTAL_MP_LM_SIGESIT');
  const denominator=sum(rows,definition.denominator!);
  return denominator>0?sum(rows,definition.numerator)/denominator*100:null;
}
function monthLabel(month:string){const [year,m]=month.split('-').map(Number);return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,m-1,1)));}
function scoreMonth(month:string, rows:Row[]) {
  const details=KPI_DEFINITIONS.map(definition=>{
    const actual=actualFor(rows,definition);
    const currentTier=tier(actual,definition);
    const score=currentTier==='Tier 1'?definition.weight:currentTier==='Tier 2'?definition.weight/2:0;
    return {key:definition.key,label:definition.label,actual,tier:currentTier,weight:definition.weight,score,tier1:definition.tier1,tier2:definition.tier2,direction:definition.direction,unit:definition.unit};
  });
  const totalScore=details.reduce((total,item)=>total+item.score,0);
  return {month,label:monthLabel(month),periodStart:`${month}-01`,periodEnd:rows.map(r=>isoDate(r.PERIODE)).filter((v):v is string=>!!v).sort().at(-1)??null,totalScore,maxScore:100,details};
}
export type KpiRegionMonth = ReturnType<typeof scoreMonth>;
export async function buildKpiRegionDashboard(env:QueryEnv) {
  const rows=await querySla(env,'0000-01-01','9999-12-31');
  const dated=rows.map(row=>({row,date:isoDate(row.PERIODE)})).filter((item):item is {row:Row;date:string}=>!!item.date);
  if (!dated.length) throw new Error('Data SLA belum tersedia di D1.');
  const groups=new Map<string,Row[]>();
  for (const item of dated) {
    const month=item.date.slice(0,7);
    const list=groups.get(month)??[];
    list.push(item.row);
    groups.set(month,list);
  }
  const months=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,items])=>scoreMonth(month,items));
  return {updatedAt:new Date().toISOString(),latestDate:dated.map(x=>x.date).sort().at(-1),months};
}
