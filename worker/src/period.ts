export type PeriodPreset='TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'|'WTD'|'MTD'|'YTD';

const iso=(d:Date)=>d.toISOString().slice(0,10);
const fromIso=(v:string)=>new Date(v+'T00:00:00Z');
const shift=(d:Date,days:number)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+days);return x};

export function defaultPeriod(maxDate:string, now=new Date()) {
  const max=fromIso(maxDate);
  const current=max.getUTCFullYear()===now.getUTCFullYear() && max.getUTCMonth()===now.getUTCMonth();
  const start=new Date(Date.UTC(max.getUTCFullYear(),max.getUTCMonth(),1));
  return {start:iso(start),end:maxDate,label:current?'MTD':'Last Data',preset:'MTD' as const};
}

export function resolvePreset(preset:PeriodPreset,maxDate:string){
  const end=fromIso(maxDate);
  if(preset==='MTD') return defaultPeriod(maxDate);
  if(preset==='TODAY') return {start:maxDate,end:maxDate,label:'Hari Ini',preset};
  if(preset==='YESTERDAY'){const d=shift(end,-1);return {start:iso(d),end:iso(d),label:'Kemarin',preset}}
  if(preset==='LAST_7') return {start:iso(shift(end,-6)),end:maxDate,label:'7 Hari Terakhir',preset};
  if(preset==='LAST_30') return {start:iso(shift(end,-29)),end:maxDate,label:'30 Hari Terakhir',preset};
  if(preset==='YTD') return {start:`${end.getUTCFullYear()}-01-01`,end:maxDate,label:'YTD',preset};
  const day=(end.getUTCDay()+6)%7;
  return {start:iso(shift(end,-day)),end:maxDate,label:'WTD',preset};
}
