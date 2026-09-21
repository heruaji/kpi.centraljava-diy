export type PeriodPreset = 'TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'|'WTD'|'MTD'|'YTD'|'CUSTOM';

export interface DateRange { start: string; end: string; label: string; preset: PeriodPreset }
export interface SourceFreshness { source: 'SLA'|'LM'|'FM'|'MM'; maxDate: string|null }
export interface MetricSummary { key:string; label:string; value:number|null; unit:'percent'|'number'; target?:number|null; previous?:number|null }
export interface BranchMaster { id:string; code:string; name:string; function:string; city:string }
export interface AreaPerformance { id:string; name:string; sla:number|null; kpiLm:number|null; kpiFm:number|null; kpiMm:number|null; productivity:number|null; status:string; trend?:TrendPoint[]; branches?:BranchMaster[] }
export interface KpiPenalties { lm:number|null; fm:number|null; mm:number|null }
export interface TrendPoint { date:string; sla:number|null; kpiLm:number|null; kpiFm:number|null; kpiMm:number|null }
export interface RegionDashboard { range:DateRange|null; freshness:SourceFreshness[]; metrics:MetricSummary[]; penalties?:KpiPenalties; trend?:TrendPoint[]; areas:AreaPerformance[] }
