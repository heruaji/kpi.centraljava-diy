export interface RatioInput { numerator:number; denominator:number }
export const ratio=({numerator,denominator}:RatioInput)=>denominator>0 ? numerator/denominator : null;

export type Direction='HIGHER'|'LOWER';
export interface TierRule { direction:Direction; tier1:number; tier2:number }
export function tier(value:number|null,rule:TierRule){
  if(value===null) return null;
  if(rule.direction==='HIGHER') return value>=rule.tier1?'T1':value>=rule.tier2?'T2':'T3';
  return value<=rule.tier1?'T1':value<=rule.tier2?'T2':'T3';
}
export function positiveScore(t:'T1'|'T2'|'T3'|null,weight:number){
  return t==='T1'?weight:t==='T2'?weight*.5:0;
}
export function penaltyScore(t:'T1'|'T2'|'T3'|null,maxPenalty:number){
  return t==='T1'?0:t==='T2'?maxPenalty*.5:maxPenalty;
}
