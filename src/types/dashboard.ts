export type PeriodPreset = 'TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'|'WTD'|'MTD'|'YTD'|'CUSTOM';

export interface DateRange { start: string; end: string; label: string; preset: PeriodPreset }
export interface SourceFreshness { source: 'SLA'|'LM'|'FM'|'MM'; maxDate: string|null }
export interface MetricSummary { key:string; label:string; value:number|null; unit:'percent'|'number'; target?:number|null; previous?:number|null }
export interface KpiDetail { key:string; label:string; actual:number|null; target:number; targetLabel:string; tier:string; weight:number; score:number }
export interface KpiDaily { date:string; numerator:number; denominator:number; actual:number|null; target:number; targetLabel:string; gap:number|null; tier:string }
export interface KpiDetailDaily { key:string; label:string; targetLabel:string; daily:KpiDaily[] }
export interface PenaltyDetail { key:string; label:string; actual:number|null; targetLabel:string; tier:string; maxPenalty:number; penalty:number }
export interface OperationalTrendPoint { date:string; volume:number; backlog:number; failedDelivery:number; codTransfer:number }
export interface BranchOperations { volume:number; backlog:number; backlogRate:number|null; failedDelivery:number; failedDeliveryRate:number|null; codTransfer:number; codTransferRate:number|null; comparison:{label:string;volume:number;backlogRate:number|null;failedDeliveryRate:number|null;codTransferRate:number|null} }
export interface BranchMaster { id:string; code:string; name:string; function:string; city:string; sla?:number|null; slaPrevious?:number|null; kpiScore?:number|null; kpiScorePrevious?:number|null; penalty?:number|null; penaltyPrevious?:number|null; productivity?:number|null; productivityPrevious?:number|null; productivityPreviousPrevious?:number|null; trend?:TrendPoint[]; kpiDetails?:KpiDetail[]; penaltyDetails?:PenaltyDetail[]; kpiDailyDetails?:KpiDetailDaily[]; operations?:BranchOperations; operationalTrend?:OperationalTrendPoint[] }
export interface AreaPerformance { id:string; name:string; sla:number|null; slaPrevious?:number|null; kpiLm:number|null; kpiFm:number|null; kpiMm:number|null; productivity:number|null; productivityPrevious?:number|null; status:string; trend?:TrendPoint[]; branches?:BranchMaster[] }
export interface KpiPenalties { lm:number|null; fm:number|null; mm:number|null }
export interface TrendPoint { date:string; sla:number|null; productivity?:number|null; productivityVolume?:number|null; productivityManpower?:number|null; kpiLm:number|null; kpiFm:number|null; kpiMm:number|null }
export interface RegionDashboard { range:DateRange|null; freshness:SourceFreshness[]; metrics:MetricSummary[]; penalties?:KpiPenalties; trend?:TrendPoint[]; areas:AreaPerformance[] }
