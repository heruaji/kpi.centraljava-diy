import { useEffect, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import type { RegionDashboard } from './types/dashboard';
import { getRegionDashboard, latestFreshness, type DashboardPeriod } from './services/dashboard';
import { BarChart3, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Gauge, Route, Target, TrendingUp, X, CircleHelp } from 'lucide-react';
import { ExportButton } from './components/ExportButton';
import { DashboardTopbar } from './components/DashboardTopbar';
import { productivitySort, movementMatch } from './modules/productivityUtils';
import { ProductivityTierBadge } from './modules/ProductivityTierBadge';
import { ProductivityDetailCards } from './modules/ProductivityDetailCards';
import { ProductivityDelta } from './modules/ProductivityDelta';
import { ProductivitySummaryCards } from './modules/ProductivitySummaryCards';
import { ProductivityRegionTrend } from './modules/ProductivityRegionTrend';
import { ProductivityAreaControls } from './modules/ProductivityAreaControls';
import { ProductivityAreaTable } from './modules/ProductivityAreaTable';
import { ProductivityBranchTable } from './modules/ProductivityBranchTable';
import { ProductivityBranchControls } from './modules/ProductivityBranchControls';
import { ProductivityBranchDetailHeader } from './modules/ProductivityBranchDetailHeader';
import { ProductivityDailyTable } from './modules/ProductivityDailyTable';
import { ProductivityDailyHeader } from './modules/ProductivityDailyHeader';
import { ProductivityTrendLegend } from './modules/ProductivityTrendLegend';
import { ProductivityTrendHeader } from './modules/ProductivityTrendHeader';
import { ProductivityTrendChart } from './modules/ProductivityTrendChart';
import { ProductivityAreaTrend } from './modules/ProductivityAreaTrend';
import { ProductivityAreaPanelHeader } from './modules/ProductivityAreaPanelHeader';
import { ProductivityAreaExport } from './modules/ProductivityAreaExport';
import { ProductivityDailyExport } from './modules/ProductivityDailyExport';
import { ProductivityBranchExport } from './modules/ProductivityBranchExport';

const DriverApexChart=({daily,metric,label}:{daily:any[];metric:'volume'|'backlog'|'failedDelivery'|'codTransfer';label:string})=>{
  const rateKey=metric==='backlog'?'backlogRate':metric==='failedDelivery'?'failedDeliveryRate':'codTransferRate';
  const isRate=metric!=='volume';
  const points=daily.map(d=>({date:d.date,value:Number(isRate?d[rateKey]:d.volume)})).filter(p=>Number.isFinite(p.value));
  const tier=(v:number)=>metric==='backlog'?v<=1.5?'tier-1':v<=2?'tier-2':'tier-3':metric==='failedDelivery'?v<=1?'tier-1':v<=1.5?'tier-2':'tier-3':metric==='codTransfer'?v>=99.5?'tier-1':v>=99?'tier-2':'tier-3':'volume';
  const maxValue=Math.max(...points.map(p=>p.value),0);
  const max=metric==='codTransfer'?100:metric==='backlog'||metric==='failedDelivery'?Math.max(metric==='backlog'?2:1.5,Math.ceil((maxValue+2.5)*10)/10):niceAxisMax(maxValue);
  const thresholds=metric==='backlog'?[[1.5,'Tier 1-1.5%','tier1'],[2,'Tier 2-2%','tier2']]:metric==='failedDelivery'?[[1,'Tier 1-1%','tier1'],[1.5,'Tier 2-1.5%','tier2']]:metric==='codTransfer'?[[99.5,'Tier 1-99.5%','tier1'],[99,'Tier 2-99%','tier2']]:[];
  const axis=(v:number)=>isRate?`${v.toFixed(metric==='codTransfer'?0:1)}%`:new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(v);
  const valueLabel=(v:number)=>isRate?`${v.toFixed(2)}%`:new Intl.NumberFormat('id-ID').format(v);
  return points.length?<div className={`trend-chart-shell drivers-master-chart ${metric==='volume'?'drivers-volume-chart':''}`}><div className="trend-plot drivers-control-plot" aria-label={`${label} daily trend`}><div className="trend-y-label y100">{axis(max)}</div><div className="trend-y-label y75">{axis(max*.75)}</div><div className="trend-y-label y50">{axis(max*.5)}</div><div className="trend-y-label y25">{axis(max*.25)}</div><div className="trend-y-label y0">{axis(0)}</div><div className="trend-grid-line grid100"/><div className="trend-grid-line grid75"/><div className="trend-grid-line grid50"/><div className="trend-grid-line grid25"/><div className="trend-grid-line grid0"/>{thresholds.length>0&&<div className="trend-target-scale">{thresholds.map(([value,text,kind])=><div key={String(text)} className={kind==='tier1'?'trend-target-line':'trend-tier2-line'} style={{bottom:`${Math.min(100,(Number(value)/max)*100)}%`}}><span>{text}</span></div>)}</div>}<div className="trend-bars">{points.map(p=>{const height=Math.max(2,Math.min(100,(p.value/max)*100));const tone=tier(p.value);return <div className="trend-column" key={p.date} title={`${fmtDate(p.date)}: ${label} ${valueLabel(p.value)}`}><div className="trend-track"><div className={`trend-value ${tone}`} style={{bottom:`calc(${height}% + 4px)`}}>{valueLabel(p.value)}</div><div className={`trend-bar ${tone}`} style={{height:`${height}%`}}/></div><small>{new Date(`${p.date}T00:00:00`).getDate()}</small></div>})}</div></div>{isRate&&<div className="trend-legend drivers-tier-legend"><span><i className="legend-tier-1"/>Tier 1</span><span><i className="legend-tier-2"/>Tier 2</span><span><i className="legend-tier-3"/>Tier 3</span></div>}</div>:<div className="placeholder compact">Data trend {label.toLowerCase()} belum tersedia</div>;
};

const KpiDailyTrend=({data,metricKey,label}:{data:any[];metricKey:'kpiLm'|'kpiFm'|'kpiMm';label:string})=>{
  const points=(data??[]).filter(p=>p[metricKey]!=null);
  const band=(v:number)=>v>=95?'excellent':v>=85?'good':v>=60?'fair':v>=40?'bad':'unsatisfactory';
  return points.length?<div className="trend-chart-shell kpi-daily-trend-master"><div className="trend-plot kpi-category-plot" aria-label={`${label} daily trend`}><div className="trend-y-label y100">100%</div><div className="trend-y-label y75">75%</div><div className="trend-y-label y50">50%</div><div className="trend-y-label y25">25%</div><div className="trend-y-label y0">0%</div><div className="trend-grid-line grid100"/><div className="trend-grid-line grid75"/><div className="trend-grid-line grid50"/><div className="trend-grid-line grid25"/><div className="trend-grid-line grid0"/><div className="kpi-category-scale"><div className="kpi-category-line kpi-category-excellent" style={{bottom:'95%'}}><span>Excellent-95%</span></div></div><div className="trend-bars">{points.map(p=>{const value=Number(p[metricKey]);const height=Math.max(2,Math.min(100,value));const tone=band(value);return <div className="trend-column" key={p.date} title={`${fmtDate(p.date)}: ${fmtPercent(value)} • ${tone}`}><div className="trend-track"><div className={`trend-value ${tone}`} style={{bottom:`calc(${height}% + 4px)`}}>{value.toFixed(1)}</div><div className={`trend-bar kpi-band-bar ${tone}`} style={{height:`${height}%`}}/></div><small>{new Date(`${p.date}T00:00:00`).getDate()}</small></div>})}</div></div><div className="trend-legend kpi-category-legend"><span><i className="kpi-legend excellent"/>Excellent ≥95%</span><span><i className="kpi-legend good"/>Good ≥85%</span><span><i className="kpi-legend fair"/>Fair ≥60%</span><span><i className="kpi-legend bad"/>Bad ≥40%</span><span><i className="kpi-legend unsatisfactory"/>Unsatisfactory &lt;40%</span></div></div>:<div className="placeholder">Data trend KPI belum tersedia</div>;
};

const kpiCategory=(value:number|null|undefined)=>value==null?{label:'No Data',tone:'nodata'}:value>=95?{label:'Excellent',tone:'excellent'}:value>=85?{label:'Good',tone:'good'}:value>=60?{label:'Fair',tone:'fair'}:value>=40?{label:'Bad',tone:'bad'}:{label:'Unsatisfactory',tone:'unsatisfactory'};

const navigation = [
  { label: 'Control Tower', icon: Gauge, active: true },
  { label: 'SLA Performance', icon: Target },
  { label: 'KPI Performance', icon: BarChart3 },
  { label: 'Productivity', icon: TrendingUp },
];

const fmtPercent = (value: number | null | undefined) => value == null ? '—' : `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)}%`;
const fmtNumber = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
const fmtSigned = (value: number | null | undefined) => value == null ? '—' : `${value >= 0 ? '+' : ''}${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const niceAxisMax = (value:number) => { const raw=Math.max(1,value); const magnitude=10**Math.floor(Math.log10(raw)); const normalized=raw/magnitude; const nice=normalized<=1?1:normalized<=2?2:normalized<=2.5?2.5:normalized<=5?5:10; return nice*magnitude; };
const fmtDate = (value: string | null) => value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '—';
const fmtMonth = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`)) : 'periode lalu';

const PAGE_SIZE = 10;
function TablePager({page,total,onPage}:{page:number;total:number;onPage:(page:number)=>void}) {
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  if(total<=PAGE_SIZE) return null;
  const safe=Math.min(page,pages);
  const start=(safe-1)*PAGE_SIZE+1;
  const end=Math.min(safe*PAGE_SIZE,total);
  return <div className="table-pagination"><span>{start}–{end} dari {total}</span><div><button type="button" disabled={safe===1} onClick={()=>onPage(safe-1)} aria-label="Halaman sebelumnya">‹</button>{Array.from({length:pages},(_,i)=>i+1).map(p=><button type="button" key={p} className={p===safe?'active':''} onClick={()=>onPage(p)}>{p}</button>)}<button type="button" disabled={safe===pages} onClick={()=>onPage(safe+1)} aria-label="Halaman berikutnya">›</button></div></div>;
}

type FaqFn='LM'|'FM'|'MM';
const FAQ_DATA:Record<FaqFn,{metrics:string[][];penalty:string[][]}> = {
LM:{metrics:[
['COD FAS','Paket COD yang sukses pertama kali ANT','≥95%','≥92% - <95%','<92%'],['NON COD FAS','Paket NON COD yang sukses pertama kali ANT','≥98%','≥96% - <98%','<96%'],['EDC','Paket sukses sebelum jam 2 siang','≥85%','≥80% - <85%','<80%'],['COD ED','Paket COD yang GAGAL Kirim','≤4.5%','>4.5% - ≤5%','>5%'],['HD','Tiket Helpdesk Resolve 2x 24 Jam','≥95%','≥90% - <95%','<90%'],['LOST','Paket status LOST','≤0.01%','>0.01% - ≤0.02%','>0.02%'],['TMT','Paket Buyer komplain belum menerima','≤0.05%','>0.05% - ≤0.08%','>0.08%'],['FRAUD','Kasus FRAUD','0%','>0% - <0.05%','>0.05%'],['REMITTANCE','Setoran dihari yang sama','≥98%','≥95% - <98%','<95%']],penalty:[
['SO','Paket yang sudah status STOCK OPNAME','≥75%','≥70% - <75%','<70%'],['STUCK','Paket gantung lebih dari 6 hari, terhitung tiap hari selasa','0%','>0% - <0.05%','>0.05%'],['UNLOADING TIME','Waktu Bongkaran sejak Driver Slide di aplikasi','100%','≥90% - <100%','<90%'],['ROSTERING','Jumlah Ideal Sorter yang masuk','98%','≥90% - <98%','<90%']]},
FM:{metrics:[
['SDOB 10 PM','Sameday Outbound (SDOB) 10PM','≥85%','<85% - ≥50%','<50%'],['SDOB 00 AM','Sameday Outbound (SDOB) 00AM','≥99%','<99% - ≥90%','<90%'],['SDOB 02 AM','Sameday Outbound (SDOB) 02AM','≥99.9%','<99.9% - ≥90%','<90%'],['N+0 PICKUP ATTEMPT','Total volume PICK & UNPICK (N+0) / Total RPU volume (Adj RPU < 17.00)','≥99.9%','<99.9% - ≥99%','<99%'],['N+0 PICKUP SUCCESS','Total volume PICK (N+0) / Total RPU volume (Adj RPU < 17.00)','≥95%','<95% - ≥90%','<90%'],['LOST RATE','Paket status LOST','≤0.01%','>0.01% - ≤0.02%','>0.02%'],['FAS RETURN','Total Resi RTS H+1 / Total IN/FM','≥95%','<95% - ≥90%','<90%'],['SCANNING COMPLIANCE','Compliance POP + Compliance Out','≥98%','<98% - ≥95%','<95%'],['HD COMPLETION','Tiket Helpdesk Resolve 2x 24 Jam','≥95%','<95% - ≥90%','<90%'],['TMT RTS','Paket Seller komplain belum menerima','≤0.5%','>0.5% - ≤0.9%','>0.9%']],penalty:[
['SO','Paket yang sudah status STOCK OPNAME','≥75%','≥70% - <75%','<70%'],['ROSTERING','Jumlah Ideal Sorter yang masuk','≥100%','≥90% - <100%','<90%']]},
MM:{metrics:[
['SDOB 04 AM','Sort outbound 4AM the next day / Total inbound (00.00 - 23.59)','≥80%','<80% - ≥50%','<50%'],['SDOB 06 AM','Sort outbound 6AM the next day / Total inbound (00.00 - 23.59)','≥98%','<98% - ≥90%','<90%'],['SDOB 10 AM','Sort Outbound 10am / Total inbound (00.01 - 06.00)','≥95%','<95% - ≥90%','<90%'],['INBOUND LEAD TIME','Duration DO hub to INHUB (Gabungan Sortir) in hours. Max 6 Hours','≥95%','<95% - ≥90%','<90%'],['SCANNING COMPLIANCE','Scan by Non Superadmin (DO, IN, OUT HUB) / Total volume scan','≥99%','<99% - ≥90%','<90%'],['LOST RATE','Total volume LOST Sortation / Total volume inbound sortation (H-28)','≤0.01%','>0.01% - ≤0.02%','>0.02%'],['CC','Total volume CC IN LM / Total volume inbound sortation (H-1)','≥0.50','<0.50 - ≥0.80','<0.80%'],['HD COMPLETION','Total Close HD ON SLA / Total Complain','≥95%','<95% - ≥90%','<90%']],penalty:[
['UNLOADING TIME','Duration Arrive to DO/IN MM in minutes & max 60 minutes','0 poin','10 poin','20 poin'],['SO','Total Berhasil SO / Total Harus SO','0 poin','10 poin','20 poin'],['PAKET STUCK','Total Stuck >8 hari di hari Rabu / Avg Volume Masuk Last Week','0 poin','20 poin','40 poin']]}
};
function FaqReference({fn}:{fn:FaqFn}){const d=FAQ_DATA[fn];const table=(rows:string[][],title:string)=><article className={'panel faq-card faq-'+fn.toLowerCase()}><div className="panel-title"><div><span>{title}</span><h3>{title==='PENGURANG'?'Pengurang KPI '+fn:'KPI '+fn}</h3></div></div><div className="table-wrap faq-table"><table><thead><tr><th>Metric KPI</th><th>Deskripsi</th><th>Tier 1</th><th>Tier 2</th><th>Tier 3</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td><span className="faq-tier tier-1">{r[2]}</span></td><td><span className="faq-tier tier-2">{r[3]}</span></td><td><span className="faq-tier tier-3">{r[4]}</span></td></tr>)}</tbody></table></div></article>;return <div className="faq-stack">{table(d.metrics,'METRICS KPI')}{table(d.penalty,'PENGURANG')}</div>;}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'>(() => (localStorage.getItem('kpi-dashboard-theme') as 'light'|'dark') || 'dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [trendMetric, setTrendMetric] = useState<'sla'|'cod'|'failed'|'backlog'|'sorterFm'|'sorterLm'|'courierFm'|'courierLm'>('sla');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [controlAreaCategory, setControlAreaCategory] = useState<'sla'|'kpi'|'productivity'|'drivers'>('sla');
  const [controlAreaKpiFunction, setControlAreaKpiFunction] = useState<'LM'|'FM'|'MM'>('LM');
  const [controlAreaProductivityFunction, setControlAreaProductivityFunction] = useState<'LM'|'FM'>('LM');
  const [controlTablePage, setControlTablePage] = useState(1);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [controlGeraiKpiFunction, setControlGeraiKpiFunction] = useState<'LM'|'FM'|'MM'>('LM');
  const [selectedKpiKey, setSelectedKpiKey] = useState<string | null>(null);
  const [branchFunctionFilter, setBranchFunctionFilter] = useState<'ALL'|'LM'|'FM'|'MM'>('ALL');
  const [selectedDriver, setSelectedDriver] = useState<'volume'|'backlog'|'failedDelivery'|'codTransfer'|null>(null);
  const [driversAreaId, setDriversAreaId] = useState<string | null>(null);
  const [driversBranchId, setDriversBranchId] = useState<string | null>(null);
  const [driversBranchQuery, setDriversBranchQuery] = useState('');
  const [driversBranchPage, setDriversBranchPage] = useState(1);
  const [driversTrendMetric, setDriversTrendMetric] = useState<'volume'|'backlog'|'failedDelivery'|'codTransfer'>('volume');
  const [faqOpen, setFaqOpen] = useState(false);
  const [faqFunction, setFaqFunction] = useState<'LM'|'FM'|'MM'>('LM');
  type DashboardModule = 'control'|'sla'|'kpi'|'productivity'|'drivers';
  type ModulePeriodSelection = { preset: DashboardPeriod; customRange: {start:string;end:string}|null };
  type DashboardContextState = {
    activeModule: DashboardModule;
    modulePeriods: Record<DashboardModule, ModulePeriodSelection>;
  };
  const [dashboardContext, setDashboardContext] = useState<DashboardContextState>(() => {
    const defaults: Record<DashboardModule, ModulePeriodSelection> = {
      control: { preset: 'MTD', customRange: null },
      sla: { preset: 'MTD', customRange: null },
      kpi: { preset: 'MTD', customRange: null },
      productivity: { preset: 'MTD', customRange: null },
      drivers: { preset: 'MTD', customRange: null },
    };
    const validPresets: DashboardPeriod[] = ['TODAY','YESTERDAY','LAST_7','LAST_30','LAST_MONTH','WTD','MTD','YTD'];
    try {
      const savedModule = localStorage.getItem('kpi-dashboard-module') as DashboardModule | null;
      const savedPeriods = JSON.parse(localStorage.getItem('kpi-dashboard-module-periods') || '{}');
      (Object.keys(defaults) as DashboardModule[]).forEach(module => {
        const item = savedPeriods?.[module];
        if (!item || typeof item !== 'object') return;
        const preset = validPresets.includes(item.preset) ? item.preset : 'MTD';
        const range = item.customRange;
        const customRange = range && /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end) && range.start <= range.end
          ? { start: range.start, end: range.end }
          : null;
        defaults[module] = { preset, customRange };
      });
      const activeModule: DashboardModule = savedModule && Object.prototype.hasOwnProperty.call(defaults, savedModule) ? savedModule : 'control';
      return { activeModule, modulePeriods: defaults };
    } catch {
      return { activeModule: 'control', modulePeriods: defaults };
    }
  });
  const { activeModule, modulePeriods } = dashboardContext;
  const setActiveModule = (nextModule: DashboardModule) => setDashboardContext(current => ({
    ...current,
    activeModule: nextModule,
  }));
  const periodPreset = modulePeriods[activeModule].preset;
  const customRange = modulePeriods[activeModule].customRange;
  const dashboardRequestKey = JSON.stringify([
    activeModule,
    periodPreset,
    customRange?.start ?? null,
    customRange?.end ?? null,
  ]);
  const setPeriodPreset = (preset: DashboardPeriod) => setDashboardContext(current => ({
    ...current,
    modulePeriods: {
      ...current.modulePeriods,
      [current.activeModule]: { ...current.modulePeriods[current.activeModule], preset },
    },
  }));
  const setCustomRange = (range: {start:string;end:string}|null) => setDashboardContext(current => ({
    ...current,
    modulePeriods: {
      ...current.modulePeriods,
      [current.activeModule]: { ...current.modulePeriods[current.activeModule], customRange: range },
    },
  }));
  const [kpiFunction, setKpiFunction] = useState<'LM'|'FM'|'MM'>('LM');
  const [kpiAreaQuery, setKpiAreaQuery] = useState('');
  const [kpiAreaSort, setKpiAreaSort] = useState<'score-desc'|'score-asc'|'name'>('score-desc');
  const [kpiAreaId, setKpiAreaId] = useState<string | null>(null);
  const [kpiBranchQuery, setKpiBranchQuery] = useState('');
  const [kpiBranchSort, setKpiBranchSort] = useState<'score-desc'|'score-asc'|'name'>('score-desc');
  const [kpiBranchDetailId, setKpiBranchDetailId] = useState<string | null>(null);
  const [kpiDailyDate, setKpiDailyDate] = useState<string | null>(null);
  const [productivityRole, setProductivityRole] = useState<'courier'|'sorter'>('courier');
  const [productivityMile, setProductivityMile] = useState<'lm'|'fm'>('lm');
  const [productivityAreaId, setProductivityAreaId] = useState<string | null>(null);
  const [productivityBranchId, setProductivityBranchId] = useState<string | null>(null);
  const [productivityBranchQuery, setProductivityBranchQuery] = useState('');
  const [productivityAreaSort, setProductivityAreaSort] = useState<'current-desc'|'current-asc'|'change-desc'|'change-asc'>('current-desc');
  const [productivityBranchSort, setProductivityBranchSort] = useState<'current-desc'|'current-asc'|'change-desc'|'change-asc'>('current-desc');
  const [productivityAreaMovement, setProductivityAreaMovement] = useState<'ALL'|'UP'|'DOWN'|'STABLE'>('ALL');
  const [productivityBranchMovement, setProductivityBranchMovement] = useState<'ALL'|'UP'|'DOWN'|'STABLE'>('ALL');
  const [slaAreaId, setSlaAreaId] = useState<string | null>(null);
  const [slaAreaQuery, setSlaAreaQuery] = useState('');
  const [slaStatusFilter, setSlaStatusFilter] = useState<'ALL'|'ACHIEVED'|'REVIEW'>('ALL');
  const [slaAttentionMode, setSlaAttentionMode] = useState<'AREA'|'GERAI'|'DECLINE'>('AREA');
  const [slaBranchQuery, setSlaBranchQuery] = useState('');
  const [slaBranchStatus, setSlaBranchStatus] = useState<'ALL'|'ACHIEVED'|'REVIEW'>('ALL');
  const [slaAreaSort, setSlaAreaSort] = useState<'sla-desc'|'sla-asc'|'decline'>('sla-desc');
  const [slaBranchSort, setSlaBranchSort] = useState<'sla-desc'|'sla-asc'|'decline'>('sla-desc');
  const [slaBranchDetailId, setSlaBranchDetailId] = useState<string | null>(null);
  const [areaQuery, setAreaQuery] = useState('');
  const [areaSort, setAreaSort] = useState<'ranking'|'name'|'sla'|'lm'|'fm'|'mm'>('ranking');
  const [branchQuery, setBranchQuery] = useState('');
  const [dashboardSnapshot, setDashboardSnapshot] = useState<{
    requestKey: string;
    data: RegionDashboard;
    updatedAt: string | null;
    checkedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<{kind:'updated'|'latest';text:string}|null>(null);
  const [dashboardError, setDashboardError] = useState<{requestKey:string;message:string}|null>(null);
  const dashboard = dashboardSnapshot?.requestKey === dashboardRequestKey ? dashboardSnapshot.data : null;
  const dashboardUpdatedAt = dashboardSnapshot?.requestKey === dashboardRequestKey ? dashboardSnapshot.updatedAt : null;
  const dashboardCheckedAt = dashboardSnapshot?.requestKey === dashboardRequestKey ? dashboardSnapshot.checkedAt : null;
  const error = dashboardError?.requestKey === dashboardRequestKey ? dashboardError.message : null;
  const dashboardLoading = loading || (!dashboard && !error);

  const refreshSeq = useRef(0);
  const noticeTimer = useRef<number | null>(null);
  const showRefreshNotice = (notice:{kind:'updated'|'latest';text:string}) => {
    setRefreshNotice(notice);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setRefreshNotice(null), 3500);
  };
  const currentRequestKey = useRef(dashboardRequestKey);
  currentRequestKey.current = dashboardRequestKey;

  const refreshDashboard = async (showLoading = false, manual = false) => {
    const requestKey = dashboardRequestKey;
    const seq = ++refreshSeq.current;
    if (showLoading) setLoading(true);
    if (manual) setRefreshing(true);
    else setRefreshing(false);
    setDashboardError(null);
    try {
      const result = await getRegionDashboard(periodPreset, customRange ?? undefined, manual);
      if (seq === refreshSeq.current && requestKey === currentRequestKey.current) {
        setDashboardSnapshot({
          requestKey,
          data: result.data,
          updatedAt: result.updatedAt,
          checkedAt: result.checkedAt,
        });
        if (manual) {
          const stamp=result.updatedAt?new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(result.updatedAt)):'—';
          showRefreshNotice(result.changed
            ? {kind:'updated',text:`Data baru ditemukan dan dashboard diperbarui • ${stamp}`}
            : {kind:'latest',text:`Tidak ada perubahan data • Terakhir diperbarui ${stamp}`});
        }
      }
    } catch (err) {
      if (seq === refreshSeq.current && requestKey === currentRequestKey.current) {
        setDashboardError({
          requestKey,
          message: err instanceof Error ? err.message : 'Gagal memuat dashboard',
        });
      }
    } finally {
      if (seq === refreshSeq.current && requestKey === currentRequestKey.current) setLoading(false);
      if (manual) window.setTimeout(() => {
        if (seq === refreshSeq.current) setRefreshing(false);
      }, 450);
    }
  };

  useEffect(() => {
    void refreshDashboard(true, false);
  }, [dashboardRequestKey]);

  useEffect(() => { localStorage.setItem('kpi-dashboard-module-periods', JSON.stringify(modulePeriods)); }, [modulePeriods]);
  useEffect(() => { localStorage.setItem('kpi-dashboard-theme', theme); }, [theme]);
  const historyReady = useRef(false);
  const restoringHistory = useRef(false);
  const navSnapshot = {
    activeModule, selectedAreaId, selectedBranchId, selectedKpiKey,
    slaAreaId, slaBranchDetailId, kpiAreaId, kpiBranchDetailId, kpiDailyDate,
    productivityAreaId, productivityBranchId, driversAreaId, driversBranchId
  };
  const navKey = JSON.stringify(navSnapshot);

  useEffect(() => {
    const restore = (state:any) => {
      const n=state?.kpiNav;
      if(!n)return;
      restoringHistory.current=true;
      setActiveModule(n.activeModule??'control');
      setSelectedAreaId(n.selectedAreaId??null); setSelectedBranchId(n.selectedBranchId??null); setSelectedKpiKey(n.selectedKpiKey??null);
      setSlaAreaId(n.slaAreaId??null); setSlaBranchDetailId(n.slaBranchDetailId??null);
      setKpiAreaId(n.kpiAreaId??null); setKpiBranchDetailId(n.kpiBranchDetailId??null); setKpiDailyDate(n.kpiDailyDate??null);
      setProductivityAreaId(n.productivityAreaId??null); setProductivityBranchId(n.productivityBranchId??null);
      setDriversAreaId(n.driversAreaId??null); setDriversBranchId(n.driversBranchId??null);
      setMobileOpen(false);
    };
    const onPop=(e:PopStateEvent)=>{
      if(e.state?.kpiNav){restore(e.state);return}
      restoringHistory.current=true;
      setMobileOpen(false);
      setSelectedKpiKey(null); setSelectedDriver(null);
      setSelectedBranchId(null); setSelectedAreaId(null);
      setSlaBranchDetailId(null); setSlaAreaId(null);
      setKpiDailyDate(null); setKpiBranchDetailId(null); setKpiAreaId(null);
      setProductivityBranchId(null); setProductivityAreaId(null);
      setDriversBranchId(null); setDriversAreaId(null);
      window.history.replaceState({...window.history.state,kpiNav:{activeModule}},'');
    };
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);

  useEffect(() => {
    if(!historyReady.current){
      window.history.replaceState({...window.history.state,kpiNav:navSnapshot},'');
      historyReady.current=true;
      return;
    }
    if(restoringHistory.current){restoringHistory.current=false;return}
    window.history.pushState({...window.history.state,kpiNav:navSnapshot},'');
  },[navKey]);

  useEffect(() => { localStorage.setItem('kpi-dashboard-module', activeModule); }, [activeModule]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [
    activeModule,
    selectedAreaId, selectedBranchId, selectedKpiKey,
    slaAreaId, slaBranchDetailId,
    kpiAreaId, kpiBranchDetailId, kpiDailyDate,
    productivityAreaId, productivityBranchId,
    driversAreaId, driversBranchId
  ]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const cards = dashboard?.metrics ?? [];
  const penalties = dashboard?.penalties;
  const healthCounts = (dashboard?.areas ?? []).reduce<Record<string, number>>((acc, area) => { acc[area.status] = (acc[area.status] || 0) + 1; return acc; }, {});
  const healthTotal = Math.max(1, Object.values(healthCounts).reduce((sum, count) => sum + count, 0));
  const healthMeta: Record<string,{label:string;tone:string}> = {
    Excellent:{label:'Prima',tone:'excellent'},
    Good:{label:'Baik',tone:'good'},
    Fair:{label:'Cukup',tone:'fair'},
    Bad:{label:'Kritis',tone:'bad'},
    Unsatisfactory:{label:'Unsatisfactory',tone:'poor'},
  };
  const freshDate = latestFreshness(dashboard);
  const activeRange = dashboard?.range ?? null;
  const selectedArea = dashboard?.areas.find(area => area.id === selectedAreaId) ?? null;
  useEffect(() => { if(selectedAreaId && dashboard && !selectedArea) { setSelectedAreaId(null); setSelectedBranchId(null); setSelectedKpiKey(null); setSelectedDriver(null); } }, [dashboard, selectedAreaId, selectedArea]);
  const selectedBranchBase = selectedArea?.branches?.find(branch => branch.id === selectedBranchId) ?? null;
  const selectedBranch = selectedBranchBase && controlAreaCategory==='kpi' ? (selectedArea?.branches?.find(branch=>branch.name.trim().toLowerCase()===selectedBranchBase.name.trim().toLowerCase()&&branch.function===controlGeraiKpiFunction) ?? selectedBranchBase) : selectedBranchBase;
  useEffect(() => { if(selectedBranchId && selectedArea && !selectedBranch) { setSelectedBranchId(null); setSelectedKpiKey(null); setSelectedDriver(null); } }, [selectedArea, selectedBranchId, selectedBranch]);
  const filteredBranches = selectedArea?.branches?.filter(branch => (branchFunctionFilter === 'ALL' || branch.function === branchFunctionFilter) && (!branchQuery.trim() || `${branch.name} ${branch.code} ${branch.city}`.toLowerCase().includes(branchQuery.trim().toLowerCase()))) ?? [];
  const filteredAreas = [...(dashboard?.areas ?? [])].filter(area => !areaQuery.trim() || area.name.toLowerCase().includes(areaQuery.trim().toLowerCase())).sort((a,b)=>areaSort==='ranking'?((b.ranking?.score??-1)-(a.ranking?.score??-1)):areaSort==='name'?a.name.localeCompare(b.name,'id'):((b[areaSort==='sla'?'sla':areaSort==='lm'?'kpiLm':areaSort==='fm'?'kpiFm':'kpiMm']??-1)-(a[areaSort==='sla'?'sla':areaSort==='lm'?'kpiLm':areaSort==='fm'?'kpiFm':'kpiMm']??-1)));
  const selectedKpi = selectedBranch?.kpiDailyDetails?.find(kpi => kpi.key === selectedKpiKey) ?? null;
  const trend = selectedBranch?.trend ?? selectedArea?.trend ?? dashboard?.trend ?? [];
  const branchTrendMetric = selectedBranch?.function === 'FM' ? 'kpiFm' : selectedBranch?.function === 'MM' ? 'kpiMm' : 'kpiLm';
  const driverLabels={volume:'Volume',backlog:'Backlog',failedDelivery:'Failed Delivery',codTransfer:'COD Transfer'} as const;
  const driverDaily=selectedBranch?.operationalTrend ?? [];
  const driverMax=selectedDriver?Math.max(1,...driverDaily.map(d=>d[selectedDriver])):1;
  const kpiTrendMax = selectedKpi ? Math.max(100,...selectedKpi.daily.map(d=>d.actual ?? 0),selectedKpi.daily[0]?.target ?? 0) : 100;
  const controlTrendConfig = {
    sla:{label:'SLA Performance',field:'sla',target:96,tier2:95,direction:'HIGHER',percent:true},
    cod:{label:'COD Transferred',field:'codTransferRate',target:99.5,tier2:99,direction:'HIGHER',percent:true},
    failed:{label:'Failed Delivery',field:'failedDeliveryRate',target:1,tier2:1.5,direction:'LOWER',percent:true},
    backlog:{label:'Backlog Rate',field:'backlogRate',target:1.5,tier2:2,direction:'LOWER',percent:true},
    sorterFm:{label:'Sorter FM',field:'productivitySorterFm',target:820,tier2:750,direction:'HIGHER',percent:false},
    sorterLm:{label:'Sorter LM',field:'productivitySorterLm',target:650,tier2:550,direction:'HIGHER',percent:false},
    courierFm:{label:'Kurir FM',field:'productivityCourierFm',target:115,tier2:88,direction:'HIGHER',percent:false},
    courierLm:{label:'Kurir LM',field:'productivityCourierLm',target:51,tier2:40,direction:'HIGHER',percent:false},
  } as const;
  const activeControlTrend=controlTrendConfig[trendMetric];
  const controlTrendValues=trend.map(point=>point[activeControlTrend.field] as number|null|undefined).filter((v):v is number=>v!=null);
  const controlTrendPeak=Math.max(activeControlTrend.target,activeControlTrend.tier2,...controlTrendValues);
  const controlTrendAdaptivePercent=trendMetric==='backlog'||trendMetric==='failed';
  const controlTrendScaleMax=controlTrendAdaptivePercent
    ? niceAxisMax(controlTrendPeak*1.25)
    : activeControlTrend.percent?100:niceAxisMax(controlTrendPeak);
  const controlTrendTargetPosition=Math.min(100,(activeControlTrend.target/controlTrendScaleMax)*100);
  const controlTrendTier2Position=Math.min(100,(activeControlTrend.tier2/controlTrendScaleMax)*100);
  const controlTrendTier=(value:number|null|undefined)=>{
    if(value==null) return null;
    const tier1=activeControlTrend.direction==='HIGHER'?value>=activeControlTrend.target:value<=activeControlTrend.target;
    const tier2=activeControlTrend.direction==='HIGHER'?value>=activeControlTrend.tier2:value<=activeControlTrend.tier2;
    return tier1?'Tier 1':tier2?'Tier 2':'Tier 3';
  };
  const controlRegionRanking = (dashboard?.areas ?? []).flatMap(area=>area.ranking?.details ?? []);
  const controlMetricCards = (['sla','cod','failed','backlog','sorterFm','sorterLm','courierFm','courierLm'] as const).map(key=>{
    const cfg=controlTrendConfig[key];
    const values=controlRegionRanking.filter(item=>item.key===key&&item.actual!=null);
    let value:number|null=null;
    if(key==='sla') value=dashboard?.metrics?.find(m=>m.key==='sla')?.value ?? null;
    else if(key==='sorterFm') value=dashboard?.productivityByRole?.sorter.fm.value ?? null;
    else if(key==='sorterLm') value=dashboard?.productivityByRole?.sorter.lm.value ?? null;
    else if(key==='courierFm') value=dashboard?.productivityByRole?.courier.fm.value ?? null;
    else if(key==='courierLm') value=dashboard?.productivityByRole?.courier.lm.value ?? null;
    else if(values.length){
      const weighted=values.reduce((sum,item)=>sum+(item.actual??0),0)/values.length;
      value=weighted;
    }
    return {key,label:cfg.label,value,unit:cfg.percent?'percent' as const:'number' as const,target:cfg.target,direction:cfg.direction};
  });
  const cardTargets: Record<string,{value:number;label:string;direction:'HIGHER'|'LOWER'}> = {
    sla:{value:96,label:'96%',direction:'HIGHER'},cod:{value:99.5,label:'99.5%',direction:'HIGHER'},failed:{value:1,label:'1%',direction:'LOWER'},backlog:{value:1.5,label:'1.5%',direction:'LOWER'},
    sorterFm:{value:820,label:'820',direction:'HIGHER'},sorterLm:{value:650,label:'650',direction:'HIGHER'},courierFm:{value:115,label:'115',direction:'HIGHER'},courierLm:{value:51,label:'51',direction:'HIGHER'},
    lm:{value:95,label:'95%',direction:'HIGHER'},fm:{value:99,label:'99%',direction:'HIGHER'},mm:{value:96.5,label:'96.5%',direction:'HIGHER'},
    kpi:{value:95,label:'95%',direction:'HIGHER'},productivity:{value:100,label:'100%',direction:'HIGHER'},penalty:{value:.5,label:'0.5%',direction:'LOWER'}
  };
  const areaControlMetricCards = selectedArea ? (['sla','cod','failed','backlog','sorterFm','sorterLm','courierFm','courierLm'] as const).map(key=>{
    const cfg=controlTrendConfig[key];
    const detail=selectedArea.ranking?.details?.find(item=>item.key===key);
    const value=key==='sla'?selectedArea.sla??null:key==='sorterFm'?selectedArea.productivityByRole?.sorter.fm.value??null:key==='sorterLm'?selectedArea.productivityByRole?.sorter.lm.value??null:key==='courierFm'?selectedArea.productivityByRole?.courier.fm.value??null:key==='courierLm'?selectedArea.productivityByRole?.courier.lm.value??null:detail?.actual??null;
    return {key,label:cfg.label,value,unit:cfg.percent?'percent' as const:'number' as const,target:cfg.target,direction:cfg.direction};
  }) : [];
  const visibleCards = !selectedArea && !selectedBranch ? controlMetricCards : selectedBranch ? [
    {key:'sla',label:'SLA Performance',value:selectedBranch.sla ?? null,unit:'percent' as const},
    {key:'kpi',label:`KPI ${selectedBranch.function}`,value:selectedBranch.kpiScore ?? null,unit:'percent' as const},
    {key:'penalty',label:'Pengurang KPI',value:selectedBranch.penalty ?? null,unit:'percent' as const},
    {key:'productivity',label:'Productivity',value:selectedBranch.productivity ?? null,unit:'percent' as const},
  ] : selectedArea ? areaControlMetricCards : [];
  const slaAreaTotal = dashboard?.areas?.length ?? 0;
  const slaAreaAchieved = dashboard?.areas?.filter(a=>a.sla!=null&&a.sla>=96).length ?? 0;
  const slaAreaReview = dashboard?.areas?.filter(a=>a.sla!=null&&a.sla<96).length ?? 0;
  const slaAreaNoData = dashboard?.areas?.filter(a=>a.sla==null).length ?? 0;
  const slaRegion = dashboard?.metrics?.find(m=>m.key==='sla')?.value ?? null;
  const slaRegionGap = slaRegion==null ? null : slaRegion-96;
  const slaAchievedShare = slaAreaTotal ? (slaAreaAchieved/slaAreaTotal)*100 : 0;
  const slaReviewShare = slaAreaTotal ? (slaAreaReview/slaAreaTotal)*100 : 0;
  const slaSelectedArea = dashboard?.areas?.find(a=>a.id===slaAreaId) ?? null;
  const slaSelectedBranch = slaSelectedArea?.branches?.find(b=>b.id===slaBranchDetailId) ?? null;
  useEffect(()=>{if(slaAreaId&&dashboard&&!slaSelectedArea){setSlaAreaId(null);setSlaBranchDetailId(null)}},[dashboard,slaAreaId,slaSelectedArea]);
  useEffect(()=>{if(slaBranchDetailId&&slaSelectedArea&&!slaSelectedBranch)setSlaBranchDetailId(null)},[slaSelectedArea,slaBranchDetailId,slaSelectedBranch]);
  const slaFilteredAreas = [...(dashboard?.areas ?? [])].filter(area => (!slaAreaQuery.trim() || area.name.toLowerCase().includes(slaAreaQuery.trim().toLowerCase())) && (slaStatusFilter==='ALL' || (slaStatusFilter==='ACHIEVED' ? area.sla!=null&&area.sla>=96 : area.sla!=null&&area.sla<96))).sort((a,b)=>slaAreaSort==='sla-asc'?(a.sla??999)-(b.sla??999):slaAreaSort==='decline'?((a.sla??0)-(a.slaPrevious??a.sla??0))-((b.sla??0)-(b.slaPrevious??b.sla??0)):(b.sla??-1)-(a.sla??-1));
  const kpiMetricKey = kpiFunction==='LM'?'kpiLm':kpiFunction==='FM'?'kpiFm':'kpiMm';
  const kpiSummaryKey = kpiFunction.toLowerCase();
  const kpiRegionMetric = dashboard?.metrics?.find(m=>m.key===kpiSummaryKey);
  const kpiRegionValue = kpiRegionMetric?.value ?? null;
  const kpiTarget = kpiRegionMetric?.target ?? null;
  const kpiAreaValues = (dashboard?.areas??[]).map(a=>({area:a,value:a[kpiMetricKey]}));
  const kpiAreaWithData = kpiAreaValues.filter(x=>x.value!=null);
  const kpiAreaExcellent = kpiAreaWithData.filter(x=>(x.value??0)>=95).length;
  const kpiAreaGood = kpiAreaWithData.filter(x=>(x.value??0)>=85&&(x.value??0)<95).length;
  const kpiAreaFair = kpiAreaWithData.filter(x=>(x.value??0)>=60&&(x.value??0)<85).length;
  const kpiAreaBad = kpiAreaWithData.filter(x=>(x.value??0)>=40&&(x.value??0)<60).length;
  const kpiAreaUnsatisfactory = kpiAreaWithData.filter(x=>(x.value??0)<40).length;
  const kpiFilteredAreas = kpiAreaValues.filter(x=>!kpiAreaQuery.trim()||x.area.name.toLowerCase().includes(kpiAreaQuery.trim().toLowerCase())).sort((a,b)=>kpiAreaSort==='name'?a.area.name.localeCompare(b.area.name,'id'):kpiAreaSort==='score-asc'?(a.value??999)-(b.value??999):(b.value??-1)-(a.value??-1));
  const kpiSelectedArea = dashboard?.areas?.find(a=>a.id===kpiAreaId) ?? null;
  const kpiPointLabels = (kpiFunction==='LM'
    ? ['COD FAS','NON COD FAS','EDC','COD FD','HD','LOST','TMT','FRAUD','REMITTANCE']
    : kpiFunction==='FM'
      ? ['SDOB 10 PM','SDOB 00 AM','SDOB 02 AM','N0 PICKUP ATTEMPT','N0 PICKUP SUCCESS','LOST','FAS RETUR','SCANNING','HD','TMT RTS']
      : ['SDOB 04','SDOB 06','SDOB 10','INBOUND','SCANNING','LOST RATE','CC RATE','HD']) as string[];
  const branchKpiValue=(b:typeof kpiSelectedBranch,key:string)=>b?.kpiDetails?.find(k=>k.key===key)?.actual??null;
  const branchKpiStatus=(b:typeof kpiSelectedBranch,key:string)=>b?.kpiDetails?.find(k=>k.key===key)?.tier??'—';
  const kpiTierTone=(tier:string|null|undefined)=>tier==='T1'||tier==='Tier 1'?'tier1':tier==='T2'||tier==='Tier 2'?'tier2':tier==='T3'||tier==='Tier 3'?'tier3':'no-data';
  const kpiTierValue=(value:number|null|undefined,tier:string|null|undefined)=><span className={`kpi-tier-value ${kpiTierTone(tier)}`}>{fmtPercent(value??null)}</span>;
  const renderPenaltyMatrix=(details:any[]|undefined)=>{
    const rows=details??[];
    const dates=[...new Set(rows.flatMap(item=>(item.daily??[]).map((day:any)=>day.date)))].sort((a,b)=>b.localeCompare(a));
    return <div className="table-wrap kpi-matrix-wrap penalty-daily-matrix"><table><thead><tr><th>KPI</th>{dates.map(date=><th key={date}>{fmtDate(date)}</th>)}</tr></thead><tbody>
      {rows.length?rows.map(item=><tr key={item.key}><td><strong>{item.label}</strong><small>{item.targetLabel}</small></td>{dates.map(date=>{const point=(item.daily??[]).find((day:any)=>day.date===date);return <td key={date}>{kpiTierValue(point?.actual,point?.tier)}</td>})}</tr>):<tr><td colSpan={Math.max(1,dates.length+1)}>Penalty detail belum tersedia.</td></tr>}
    </tbody></table></div>;
  };
  const areaPenaltyDetails=(a:NonNullable<typeof kpiSelectedArea>)=>kpiFunction==='LM'?(a.penaltyDetailsLm??[]):kpiFunction==='FM'?(a.penaltyDetailsFm??[]):(a.penaltyDetailsMm??[]);
  const areaKpiDetails=(a:NonNullable<typeof kpiSelectedArea>)=>kpiFunction==='LM'?(a.kpiDetailsLm??[]):kpiFunction==='FM'?(a.kpiDetailsFm??[]):(a.kpiDetailsMm??[]);
  const areaPenaltyTotal=(a:NonNullable<typeof kpiSelectedArea>)=>kpiFunction==='LM'?(a.penaltyLm??null):kpiFunction==='FM'?(a.penaltyFm??null):(a.penaltyMm??null);
  const kpiPenaltyLabels = [...new Set((dashboard?.areas??[]).flatMap(a=>areaPenaltyDetails(a).map(p=>p.label)))];
  const controlKpiPointLabels = (controlAreaKpiFunction==='LM'?['COD FAS','NON COD FAS','EDC','COD FD','HD','LOST','TMT','FRAUD','REMITTANCE']:controlAreaKpiFunction==='FM'?['SDOB 10 PM','SDOB 00 AM','SDOB 02 AM','N0 PICKUP ATTEMPT','N0 PICKUP SUCCESS','LOST','FAS RETUR','SCANNING','HD','TMT RTS']:['SDOB 04','SDOB 06','SDOB 10','INBOUND','SCANNING','LOST RATE','CC RATE','HD']) as string[];
  const controlKpiPenaltyLabels = [...new Set((selectedArea?.branches??[]).filter(b=>b.function===controlAreaKpiFunction).flatMap(b=>(b.penaltyDetails??[]).map(p=>p.label)))];
  const kpiAreaAllBranches = kpiSelectedArea?.branches??[];
  const kpiAreaBranchRows = [...kpiAreaAllBranches.reduce((map,b)=>{
    const key=b.name.trim().toLowerCase();
    const row=map.get(key)??{id:key,name:b.name,lm:null as number|null,fm:null as number|null,mm:null as number|null};
    if(b.function==='LM') row.lm=b.kpiScore??null;
    if(b.function==='FM') row.fm=b.kpiScore??null;
    if(b.function==='MM') row.mm=b.kpiScore??null;
    map.set(key,row);
    return map;
  },new Map<string,{id:string;name:string;lm:number|null;fm:number|null;mm:number|null}>()).values()];
  const kpiAreaBranchRowsFiltered = kpiAreaBranchRows
    .filter(r=>!kpiBranchQuery.trim()||r.name.toLowerCase().includes(kpiBranchQuery.trim().toLowerCase()))
    .sort((a,b)=>{
      if(kpiBranchSort==='name') return a.name.localeCompare(b.name,'id');
      const av=kpiFunction==='LM'?a.lm:kpiFunction==='FM'?a.fm:a.mm;
      const bv=kpiFunction==='LM'?b.lm:kpiFunction==='FM'?b.fm:b.mm;
      return kpiBranchSort==='score-asc'?(av??999)-(bv??999):(bv??-1)-(av??-1);
    });
  const kpiAreaBranches = (kpiSelectedArea?.branches??[]).filter(b=>b.function===kpiFunction);
  const kpiFilteredBranches = [...kpiAreaBranches].filter(b=>!kpiBranchQuery.trim()||`${b.name} ${b.code} ${b.city}`.toLowerCase().includes(kpiBranchQuery.trim().toLowerCase())).sort((a,b)=>kpiBranchSort==='name'?a.name.localeCompare(b.name,'id'):kpiBranchSort==='score-asc'?(a.kpiScore??999)-(b.kpiScore??999):(b.kpiScore??-1)-(a.kpiScore??-1));
  const kpiSelectedBranch = kpiBranchDetailId ? kpiAreaBranches.find(b=>b.id===kpiBranchDetailId) ?? null : null;
  const kpiBranchWithData = kpiAreaBranches.filter(b=>b.kpiScore!=null);
  const kpiBranchExcellent = kpiBranchWithData.filter(b=>(b.kpiScore??0)>=95).length;
  const kpiBranchGood = kpiBranchWithData.filter(b=>(b.kpiScore??0)>=85&&(b.kpiScore??0)<95).length;
  const kpiBranchFair = kpiBranchWithData.filter(b=>(b.kpiScore??0)>=60&&(b.kpiScore??0)<85).length;
  const kpiBranchBad = kpiBranchWithData.filter(b=>(b.kpiScore??0)>=40&&(b.kpiScore??0)<60).length;
  const kpiBranchUnsatisfactory = kpiBranchWithData.filter(b=>(b.kpiScore??0)<40).length;
  useEffect(()=>{if(kpiAreaId&&dashboard&&!kpiSelectedArea){setKpiAreaId(null);setKpiBranchDetailId(null)}},[dashboard,kpiAreaId,kpiSelectedArea]);
  useEffect(()=>{if(kpiBranchDetailId&&kpiSelectedArea&&!kpiSelectedBranch){setKpiBranchDetailId(null);setKpiDailyDate(null)}},[kpiSelectedArea,kpiBranchDetailId,kpiSelectedBranch]);
  const periodPresetLabels: Record<DashboardPeriod, string> = {
    TODAY: 'Hari Ini',
    YESTERDAY: 'Kemarin',
    LAST_7: '7 Hari Terakhir',
    LAST_30: '30 Hari Terakhir',
    LAST_MONTH: 'Bulan Lalu',
    WTD: 'WTD',
    MTD: 'MTD',
    YTD: 'YTD',
  };
  const periodLabel = customRange
    ? `Custom • ${fmtDate(customRange.start)}–${fmtDate(customRange.end)}`
    : periodPresetLabels[periodPreset];
  const periodSlug = activeRange ? `${activeRange.start}_${activeRange.end}` : null;

  const territoryNav = (() => {
    if (activeModule === 'sla') return {
      areaId: slaAreaId, branchId: slaBranchDetailId, areaLabel: 'Area SLA', branchLabel: 'Gerai SLA',
      region: () => { setSlaBranchDetailId(null); setSlaAreaId(null); },
      area: () => setSlaBranchDetailId(null)
    };
    if (activeModule === 'kpi') return {
      areaId: kpiAreaId, branchId: kpiBranchDetailId, areaLabel: `Area KPI ${kpiFunction}`, branchLabel: `Gerai KPI ${kpiFunction}`,
      region: () => { setKpiDailyDate(null); setKpiBranchDetailId(null); setKpiAreaId(null); },
      area: () => { setKpiDailyDate(null); setKpiBranchDetailId(null); }
    };
    if (activeModule === 'productivity') return {
      areaId: productivityAreaId, branchId: productivityBranchId, areaLabel: 'Area Productivity', branchLabel: 'Gerai Productivity',
      region: () => { setProductivityBranchId(null); setProductivityAreaId(null); },
      area: () => setProductivityBranchId(null)
    };
    if (activeModule === 'drivers') return {
      areaId: driversAreaId, branchId: driversBranchId, areaLabel: 'Area Drivers', branchLabel: 'Gerai Drivers',
      region: () => { setDriversBranchId(null); setDriversAreaId(null); },
      area: () => setDriversBranchId(null)
    };
    return {
      areaId: selectedAreaId, branchId: selectedBranchId, areaLabel: 'Area Control Tower', branchLabel: 'Gerai Control Tower',
      region: () => { setSelectedKpiKey(null); setSelectedDriver(null); setSelectedBranchId(null); setSelectedAreaId(null); },
      area: () => { setSelectedKpiKey(null); setSelectedDriver(null); setSelectedBranchId(null); }
    };
  })();
  const controlSlaBridge = activeModule==='control' && !!selectedAreaId && controlAreaCategory==='sla';
  const controlKpiBridge = activeModule==='control' && !!selectedAreaId && controlAreaCategory==='kpi';
  const controlProductivityBridge = activeModule==='control' && !!selectedAreaId && controlAreaCategory==='productivity';
  const controlDriversBridge = activeModule==='control' && !!selectedAreaId && controlAreaCategory==='drivers';
  const controlAreaBridge = controlSlaBridge || controlKpiBridge || controlProductivityBridge || controlDriversBridge;
  const showSlaModule = activeModule==='sla' || controlSlaBridge;
  const showKpiModule = activeModule==='kpi' || controlKpiBridge;
  const showProductivityModule = activeModule==='productivity' || controlProductivityBridge;
  const showDriversModule = activeModule==='drivers' || controlDriversBridge;
  useEffect(()=>{
    if(controlSlaBridge){
      if(slaAreaId!==selectedAreaId)setSlaAreaId(selectedAreaId);
      setSlaBranchDetailId(null);
    }
  },[controlSlaBridge,selectedAreaId]);
  useEffect(()=>{
    if(controlKpiBridge){
      if(kpiAreaId!==selectedAreaId)setKpiAreaId(selectedAreaId);
      if(kpiFunction!==controlAreaKpiFunction)setKpiFunction(controlAreaKpiFunction);
      setKpiBranchDetailId(null);
      setKpiDailyDate(null);
    }
  },[controlKpiBridge,selectedAreaId,controlAreaKpiFunction]);
  useEffect(()=>{
    if(controlProductivityBridge){
      if(productivityAreaId!==selectedAreaId)setProductivityAreaId(selectedAreaId);
      const mile=controlAreaProductivityFunction.toLowerCase() as 'lm'|'fm';
      if(productivityMile!==mile)setProductivityMile(mile);
      setProductivityBranchId(null);
    }
  },[controlProductivityBridge,selectedAreaId,controlAreaProductivityFunction]);
  useEffect(()=>{
    if(controlDriversBridge){
      if(driversAreaId!==selectedAreaId)setDriversAreaId(selectedAreaId);
      setDriversBranchId(null);
    }
  },[controlDriversBridge,selectedAreaId]);
  const controlDetailKind = controlAreaCategory==='kpi' ? controlAreaKpiFunction : 'SLA';
  const controlDetailBranches = selectedArea?.branches?.filter(b=>controlAreaCategory==='kpi'?b.function===controlAreaKpiFunction:controlAreaCategory==='sla'?b.function==='LM':controlAreaCategory==='productivity'?b.function===controlAreaProductivityFunction:true) ?? [];
  const controlGeraiRankingBranches = [...new Map((selectedArea?.branches??[]).filter(b=>b.ranking).map(b=>[b.name.trim().toLowerCase().replace(/\s+/g,' '),b])).values()].sort((a,b)=>(b.ranking?.score??-1)-(a.ranking?.score??-1)||a.name.localeCompare(b.name));
  const controlPagedBranches = controlDetailBranches.slice((controlTablePage-1)*PAGE_SIZE,controlTablePage*PAGE_SIZE);
  useEffect(()=>{setControlTablePage(1)},[selectedAreaId,controlAreaCategory,controlAreaKpiFunction,controlAreaProductivityFunction]);
  useEffect(()=>{const pages=Math.max(1,Math.ceil(controlDetailBranches.length/PAGE_SIZE));if(controlTablePage>pages)setControlTablePage(pages)},[controlDetailBranches.length,controlTablePage]);
  const openControlDetailBranch = (branchId:string) => {
    const branch=selectedArea?.branches?.find(item=>item.id===branchId); if(branch&&(branch.function==='LM'||branch.function==='FM'||branch.function==='MM')) setControlGeraiKpiFunction(branch.function); setSelectedBranchId(branchId); setSelectedKpiKey(null); setSelectedDriver(null);
  };
  const territoryClose = () => setMobileOpen(false);

  return (
    <div className={`app-shell theme-${theme} ${collapsed?'sidebar-is-collapsed':''}`}>
      {refreshNotice && <div className={`refresh-toast ${refreshNotice.kind}`} role="status" aria-live="polite"><span className="refresh-toast-dot"/><div><strong>{refreshNotice.kind==='updated'?'Data Diperbarui':'Data Sudah Terbaru'}</strong><small>{refreshNotice.text}</small></div><button onClick={()=>setRefreshNotice(null)} aria-label="Tutup notifikasi">×</button></div>}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Navigasi utama">
        <div className="brand">
          <div className="brand-mark"><img src="/sicepat-icon.svg" alt="SiCepat"/></div>
          <div className="brand-copy" aria-hidden={collapsed}><strong>Control Tower</strong><span>Central Java - DIY</span></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20}/></button>
        </div>
        <nav>
          <span className="nav-section-label">CORE MODULES</span>
          {navigation.map(({ label, icon: Icon }) => { const key=label==='SLA Performance'?'sla':label==='KPI Performance'?'kpi':label==='Productivity'?'productivity':label==='Performance Drivers'?'drivers':'control'; const enabled=true; return (
            <button key={label} disabled={!enabled} className={enabled && !faqOpen && activeModule===key ? 'nav-item active' : 'nav-item'} title={collapsed ? label : undefined} onClick={()=>{if(!enabled)return;setFaqOpen(false);setActiveModule(key);setDriversAreaId(null);setDriversBranchId(null);setDriversBranchQuery('');setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null);setSlaAreaId(null);setSlaBranchDetailId(null);setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null);setMobileOpen(false)}}>
              <Icon size={18}/><span className="nav-label">{label}</span>
            </button>
          )})}
          <span className="nav-section-label nav-region-label">NAVIGASI WILAYAH</span>
          <button title={collapsed?'Region Overview':undefined} className={!faqOpen && !territoryNav.areaId ? 'nav-item active' : 'nav-item'} onClick={()=>{setFaqOpen(false);territoryNav.region();territoryClose()}}><BarChart3 size={18}/><span className="nav-label">Region Overview</span></button>
          <button title={collapsed?territoryNav.areaLabel:undefined} className={!faqOpen && territoryNav.areaId && !territoryNav.branchId ? 'nav-item active' : 'nav-item'} disabled={!territoryNav.areaId} onClick={()=>{setFaqOpen(false);territoryNav.area();territoryClose()}}><Target size={18}/><span className="nav-label">{territoryNav.areaLabel}</span></button>
          <button title={collapsed?territoryNav.branchLabel:undefined} className={!faqOpen && territoryNav.branchId ? 'nav-item active' : 'nav-item'} disabled={!territoryNav.branchId} onClick={territoryClose}><Route size={18}/><span className="nav-label">{territoryNav.branchLabel}</span></button>
        </nav>
        <div className="sidebar-faq-section">
          <button className={faqOpen?'nav-item faq-nav active':'nav-item faq-nav'} title={collapsed?'FAQ':undefined} onClick={()=>{setFaqOpen(true);setMobileOpen(false)}}><CircleHelp size={18}/><span className="nav-label">FAQ</span></button>
        </div>
        <button className="collapse-btn" aria-label={collapsed?'Buka menu':'Tutup menu'} title={collapsed?'Buka menu':'Tutup menu'} onClick={() => setCollapsed(v => !v)}>
          <span className="collapse-icon">{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</span><span className="collapse-label">Collapse Menu</span>
        </button>
      </aside>

      {mobileOpen && <button className="scrim" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}/>}

      <main className="main">
        <DashboardTopbar
          titleContent={<div className="title-row">
            <div>
              {faqOpen?<><h1>FAQ</h1><div className="breadcrumb"><strong>Panduan KPI, Tier & Pengurang</strong></div></>:activeModule==='productivity'?<><h1>Productivity</h1><div className="breadcrumb"><button onClick={()=>{setProductivityAreaId(null);setProductivityBranchId(null)}}>Productivity</button><span>/</span><strong>{productivityRole==='courier'?'Kurir':'Sorter'} {productivityMile.toUpperCase()}</strong></div></>:activeModule==='drivers'?<><h1>Performance Drivers</h1><div className="breadcrumb"><button>Performance Drivers</button><span>/</span><strong>Region</strong></div></>:activeModule==='kpi'?<><h1>{kpiSelectedBranch?'Detail KPI Gerai':kpiSelectedArea?'Area KPI Performance':'KPI Performance'}</h1><div className="breadcrumb"><button onClick={()=>{setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null)}}>KPI Performance</button><span>/</span><button onClick={()=>{setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null)}}>{kpiFunction}</button>{kpiSelectedArea&&<><span>/</span><button onClick={()=>{setKpiBranchDetailId(null);setKpiDailyDate(null)}}>{kpiSelectedArea.name}</button></>}{kpiSelectedBranch&&<><span>/</span><strong>{kpiSelectedBranch.name}</strong></>}</div></>:activeModule==='sla'?<><h1>{slaSelectedBranch?'Detail Gerai':slaSelectedArea?'Area SLA Performance':'SLA Performance'}</h1><div className="breadcrumb"><button onClick={()=>{setSlaAreaId(null);setSlaBranchDetailId(null)}}>Central Java - DIY</button><span>/</span><button onClick={()=>{setSlaAreaId(null);setSlaBranchDetailId(null)}}>Region</button>{slaSelectedArea&&<><span>/</span><button onClick={()=>setSlaBranchDetailId(null)}>{slaSelectedArea.name}</button></>}{slaSelectedBranch&&<><span>/</span><strong>{slaSelectedBranch.name}</strong></>}</div>:<><h1>{selectedKpi ? 'KPI REGION Detail' : selectedBranch ? 'Gerai KPI REGION' : selectedArea ? 'Area KPI REGION' : 'KPI REGION'}</h1><div className="breadcrumb"><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null)}}>Central Java - DIY</button><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null)}}>Region</button>{selectedArea&&<><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null)}}>{selectedArea.name}</button></>}{selectedBranch&&<><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null)}}>{selectedBranch.name}</button></>}{selectedKpi&&<><span>/</span><strong>{selectedKpi.label}</strong></>}</div>}
            </div>
          </div>}
          faqOpen={faqOpen}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onRefresh={() => void refreshDashboard(false, true)}
          loading={dashboardLoading}
          refreshing={refreshing}
          theme={theme}
          onToggleTheme={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
          activeModule={activeModule}
          periodPreset={periodPreset}
          customRange={customRange}
          periodLabel={periodLabel}
          onPeriodChange={(preset, custom) => {
            setCustomRange(custom);
            setPeriodPreset(preset);
          }}
        />

        <section className="content">
          {faqOpen && <div className="faq-module"><div className="kpi-function-tabs faq-tabs">{(['LM','FM','MM'] as const).map(fn=><button key={fn} className={faqFunction===fn?'active':''} onClick={()=>setFaqFunction(fn)}>KPI {fn}</button>)}</div><FaqReference fn={faqFunction}/></div>}
          {!faqOpen && activeModule==='productivity' && <><div className="productivity-context-switch"><div className="productivity-switch-group"><small>JENIS PRODUCTIVITY</small><div className="function-switch">{(['courier','sorter'] as const).map(v=><button key={v} className={productivityRole===v?'active':''} onClick={()=>{setProductivityRole(v);setProductivityAreaId(null);setProductivityBranchId(null)}}>{v==='courier'?'Kurir':'Sorter'}</button>)}</div></div><div className="productivity-switch-group"><small>MILE</small><div className="function-switch">{(['lm','fm'] as const).map(v=><button key={v} className={productivityMile===v?'active':''} onClick={()=>{setProductivityMile(v);setProductivityAreaId(null);setProductivityBranchId(null)}}>{v.toUpperCase()}</button>)}</div></div></div></>}
          {!faqOpen && controlAreaBridge && <div className="control-area-bridge-head"><div className="metric-grid">{visibleCards.length ? visibleCards.map(metric => <article className={`metric-card ${metric.key === 'penalty' ? 'metric-card-penalty' : ''}`} key={metric.key}>{(()=>{const target=cardTargets[metric.key];const achieved=metric.value!=null&&target?(target.direction==='HIGHER'?metric.value>=target.value:metric.value<=target.value):false;const progress=metric.value==null?0:target?(target.direction==='HIGHER'?Math.min(100,(metric.value/target.value)*100):Math.min(100,(target.value/Math.max(metric.value,.001))*100)):Math.min(100,metric.value);return <><div className="metric-card-head"><span>{metric.label}</span>{target&&<span className={`metric-target ${metric.key==='penalty'?'warning':''}`}>Target: {target.label}</span>}</div><strong>{metric.unit==='percent'?fmtPercent(metric.value):fmtNumber(metric.value)}</strong><div className={`metric-progress ${achieved?'achieved':'review'}`}><i style={{width:`${progress}%`}}/></div><div className="metric-card-foot"><small>{activeRange ? `${activeRange.label} ${new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(activeRange.end+'T00:00:00'))}` : 'Periode aktif'}</small><span className={achieved?'status-achieved':'status-review'}>{metric.value==null?'—':achieved?'↗ Achieved':'↘ Needs Review'}</span></div></>})()}</article>) : null}</div><div className="control-area-nav-row"><div className="control-area-nav-actions"><button className="back-scope back-nav" onClick={()=>{setSlaAreaId(null);setKpiAreaId(null);setProductivityAreaId(null);setDriversAreaId(null);setSelectedAreaId(null);setControlAreaCategory('sla')}}>← Kembali ke KPI REGION</button></div></div></div>}
          {showProductivityModule && <div className="productivity-module">{(()=>{const productivityTarget=productivityRole==='courier'?(productivityMile==='lm'?51:115):(productivityMile==='lm'?650:820);const productivityTier2Target=productivityRole==='courier'?(productivityMile==='lm'?40:88):(productivityMile==='lm'?550:750);const productivityTier=(value:number|null|undefined)=>value==null?null:value>=productivityTarget?'Tier 1':value>=productivityTier2Target?'Tier 2':'Tier 3';const adaptProductivity=<T extends {productivityByRole?:any;productivity?:number|null;productivityPrevious?:number|null;productivityPreviousPrevious?:number|null;trend?:any[]}>(x:T)=>{const p=x.productivityByRole?.[productivityRole]?.[productivityMile];return {...x,productivity:p?.value??null,productivityPrevious:p?.previous??null,productivityPreviousPrevious:p?.previousPrevious??null,trend:p?.trend?.map((d:any)=>({date:d.date,productivity:d.value,productivityVolume:d.volume,productivityManpower:d.manpower}))??[]}};const areas=[...(dashboard?.areas??[])].map(a=>({...adaptProductivity(a),branches:(a.branches??[]).map(adaptProductivity)}));const selectedArea=productivityAreaId?areas.find(a=>a.id===productivityAreaId)??null:null;const branches=(selectedArea?.branches??[]).filter(b=>b.function===productivityMile.toUpperCase()&&b.productivity!=null);const selectedBranch=productivityBranchId?branches.find(b=>b.id===productivityBranchId)??null:null;const filteredBranches=branches.filter(b=>(!productivityBranchQuery.trim()||`${b.name} ${b.code} ${b.city}`.toLowerCase().includes(productivityBranchQuery.trim().toLowerCase()))&&movementMatch(b.productivity,b.productivityPrevious,productivityBranchMovement)).sort((a,b)=>productivitySort(a,b,productivityBranchSort));const values=areas.map(a=>a.productivity).filter((v):v is number=>v!=null);const previousValues=areas.map(a=>a.productivityPrevious).filter((v):v is number=>v!=null);const regionSet=dashboard?.productivityByRole?.[productivityRole]?.[productivityMile];const region=regionSet?.value??null;const regionPrevious=regionSet?.previous??null;const regionDelta=region==null||regionPrevious==null?null:region-regionPrevious;const ranked=[...areas].filter(a=>movementMatch(a.productivity,a.productivityPrevious,productivityAreaMovement)).sort((a,b)=>productivitySort(a,b,productivityAreaSort));const withData=areas.filter(a=>a.productivity!=null);const currentRanked=[...withData].sort((a,b)=>(b.productivity??-1)-(a.productivity??-1));const top=currentRanked[0]??null;const low=currentRanked.length?currentRanked[currentRanked.length-1]:null;if(selectedArea)return <article className="panel productivity-branch-panel">{selectedBranch?(()=>{const daily=[...(selectedBranch.trend??[])].sort((a,b)=>b.date.localeCompare(a.date));return <div className="productivity-gerai-detail"><ProductivityBranchDetailHeader branchName={selectedBranch.name} areaName={selectedArea.name} branchCode={selectedBranch.code} periodLabel={activeRange?.label??'Periode aktif'} onBack={()=>setProductivityBranchId(null)}/><ProductivityDetailCards current={selectedBranch.productivity} previous={selectedBranch.productivityPrevious} previousPrevious={selectedBranch.productivityPreviousPrevious} formatNumber={fmtNumber}/><ProductivityTrendChart daily={daily} productivityMile={productivityMile.toUpperCase()} productivityTarget={productivityTarget} productivityTier2Target={productivityTier2Target} productivityTier={productivityTier} fmtNumber={fmtNumber} fmtDate={fmtDate}/><div className="productivity-daily-head"><ProductivityDailyHeader/><ProductivityDailyExport role={productivityRole} mile={productivityMile.toUpperCase()} period={periodSlug} branchName={selectedBranch.name} areaName={selectedArea.name} periodLabel={activeRange?.label} data={daily} getTier={productivityTier}/></div><ProductivityDailyTable daily={daily} mile={productivityMile.toUpperCase()} getTier={productivityTier} formatDate={fmtDate} formatNumber={fmtNumber}/></div>})():<><div className="panel-title productivity-detail-head"><div><span>AREA PRODUCTIVITY</span><h3>{selectedArea.name}</h3><small>Daftar gerai dan productivity pada periode aktif.</small></div>{!controlProductivityBridge&&<button className="back-scope back-nav" onClick={()=>{setProductivityAreaId(null);setProductivityBranchId(null);setProductivityBranchQuery('')}}>← Kembali ke Productivity Region</button>}</div><ProductivityAreaTrend areaName={selectedArea.name} trend={selectedArea.trend??[]} target={productivityTarget} tier2Target={productivityTier2Target} getTier={productivityTier} formatDate={fmtDate} formatNumber={fmtNumber} getAxisMax={niceAxisMax}/><div className="productivity-branch-tools"><ProductivityBranchControls query={productivityBranchQuery} onQueryChange={setProductivityBranchQuery} movement={productivityBranchMovement} onMovementChange={setProductivityBranchMovement} sort={productivityBranchSort} onSortChange={setProductivityBranchSort} branchCount={filteredBranches.length}/><ProductivityBranchExport role={productivityRole} mile={productivityMile.toUpperCase()} period={periodSlug} areaName={selectedArea.name} periodLabel={activeRange?.label} activeRange={activeRange} data={filteredBranches} formatSigned={fmtSigned} getTier={productivityTier}/></div><ProductivityBranchTable branches={filteredBranches} getTier={productivityTier} formatNumber={fmtNumber} onSelectBranch={id=>setProductivityBranchId(id)}/></>}</article>;return <><ProductivitySummaryCards region={region} regionDelta={regionDelta} periodLabel={activeRange?.label??"Periode aktif"} top={top} low={low} formatNumber={fmtNumber}/><ProductivityRegionTrend trend={dashboard?.productivityByRole?.[productivityRole]?.[productivityMile]?.trend??[]} target={productivityTarget} tier2Target={productivityTier2Target} getTier={productivityTier} formatDate={fmtDate} formatNumber={fmtNumber} getAxisMax={niceAxisMax}/><article className="panel productivity-area-panel"><div className="panel-title"><ProductivityAreaPanelHeader/><div className="productivity-panel-tools"><ProductivityAreaControls movement={productivityAreaMovement} onMovementChange={setProductivityAreaMovement} sort={productivityAreaSort} onSortChange={setProductivityAreaSort} areaCount={withData.length}/><ProductivityAreaExport role={productivityRole} mile={productivityMile} period={periodSlug} activeRangeLabel={activeRange?.label} activeRange={activeRange} data={ranked} formatSigned={fmtSigned} getTier={productivityTier}/></div></div><ProductivityAreaTable areas={ranked} getTier={productivityTier} formatNumber={fmtNumber} onSelectArea={id=>{setProductivityAreaId(id);setProductivityBranchId(null);setProductivityBranchQuery('')}}/></article></>})()}</div>}
          {!faqOpen && showDriversModule && (()=>{const areas=[...(dashboard?.areas??[])];const area=driversAreaId?areas.find(a=>a.id===driversAreaId)??null:null;const branches=(area?.branches??[]).filter(b=>b.function==='LM').filter(b=>!driversBranchQuery.trim()||`${b.name} ${b.code} ${b.city}`.toLowerCase().includes(driversBranchQuery.trim().toLowerCase()));const pagedBranches=branches.slice((driversBranchPage-1)*PAGE_SIZE,driversBranchPage*PAGE_SIZE);const branch=driversBranchId?branches.find(b=>b.id===driversBranchId)??null:null;const val=(b:typeof branches[number],k:'volume'|'backlog'|'failedDelivery'|'codTransfer')=>b.operations?.[k]??null;const summaryOps=area?.operations??dashboard?.operations??null;const summaryCmp=summaryOps?.comparison;const driverCards=[{key:'volume',label:'VOLUME',current:summaryOps?.volume??null,previous:summaryCmp?.volume??null,target:null,direction:'high' as const},{key:'backlog',label:'BACKLOG',current:summaryOps?.backlogRate??null,previous:summaryCmp?.backlogRate??null,target:1.5,direction:'low' as const},{key:'failedDelivery',label:'FAILED DELIVERY',current:summaryOps?.failedDeliveryRate??null,previous:summaryCmp?.failedDeliveryRate??null,target:1,direction:'low' as const},{key:'codTransfer',label:'COD TRANSFER',current:summaryOps?.codTransferRate??null,previous:summaryCmp?.codTransferRate??null,target:99.5,direction:'high' as const}];return <>{!branch&&<div className="drivers-summary-grid">{driverCards.map(card=>{const gap=card.current!=null&&card.previous!=null?card.current-card.previous:null;const improved=gap==null||gap===0?null:card.direction==='high'?gap>0:gap<0;const achieved=card.target==null?null:card.current!=null&&(card.direction==='high'?card.current>=card.target:card.current<=card.target);const progress=card.target==null?null:card.current==null?0:card.direction==='high'?Math.min(100,card.current/card.target*100):card.current<=card.target?100:Math.max(0,card.target/card.current*100);return <article className={`metric-card driver-summary-card ${achieved==null?'':achieved?'achieved':'needs-review'}`} key={card.key}><div className="driver-summary-head"><span>{card.label}</span>{card.target!=null&&<em>Target: {card.direction==='high'?'≥':'≤'} {card.target}%</em>}</div><strong>{card.current==null?'—':card.key==='volume'?card.current.toLocaleString('id-ID'):fmtPercent(card.current)}</strong>{card.target!=null&&<div className="driver-summary-progress"><i style={{width:`${progress}%`}} /></div>}<div className="driver-summary-foot"><small>{activeRange?.label??'Periode aktif'}</small><b className={improved==null?'neutral':improved?'good':'review'}>{gap==null?'—':`${gap>0?'▲':'▼'} ${card.key==='volume'?Math.abs(gap).toLocaleString('id-ID'):fmtPercent(Math.abs(gap))}`}{card.target!=null&&<span>{achieved?'Achieved':'Needs Review'}</span>}</b></div></article>})}</div>}<div className="drivers-module">{branch?<article className="panel drivers-detail-panel"><div className="panel-title"><div><span>GERAI DRIVER DETAIL</span><h3>{branch.name}</h3><small>{area?.name} • {branch.code||'—'} • {activeRange?.label??'Periode aktif'}</small></div><button className="back-scope back-nav" onClick={()=>setDriversBranchId(null)}>← Kembali ke Daftar Gerai</button></div><div className="drivers-metric-grid">{(['volume','backlog','failedDelivery','codTransfer'] as const).map(k=>{const current=k==='volume'?val(branch,k):k==='backlog'?branch.operations?.backlogRate??null:k==='failedDelivery'?branch.operations?.failedDeliveryRate??null:branch.operations?.codTransferRate??null;const cmp=branch.operations?.comparison;const prev=k==='volume'?cmp?.volume??null:k==='backlog'?cmp?.backlogRate??null:k==='failedDelivery'?cmp?.failedDeliveryRate??null:cmp?.codTransferRate??null;const delta=prev!=null&&prev!==0&&current!=null?(current-prev)/prev*100:null;const favorable=k==='volume'||k==='codTransfer'?delta!=null&&delta>0:delta!=null&&delta<0;const target=k==='backlog'?1.5:k==='failedDelivery'?1:k==='codTransfer'?99.5:null;const direction=k==='backlog'||k==='failedDelivery'?'low':'high';const achieved=target==null?null:current!=null&&(direction==='high'?current>=target:current<=target);const progress=target==null?null:current==null?0:direction==='high'?Math.min(100,current/target*100):current<=target?100:Math.max(0,target/current*100);return <article className={`metric-card driver-metric-card driver-summary-card ${achieved==null?'':achieved?'achieved':'needs-review'}`} key={k}><div className="driver-summary-head"><span>{{volume:'VOLUME',backlog:'BACKLOG',failedDelivery:'FAILED DELIVERY',codTransfer:'COD TRANSFER'}[k]}</span>{target!=null&&<em>Target: {direction==='high'?'≥':'≤'} {target}%</em>}</div><strong>{current==null?'—':k==='volume'?current.toLocaleString('id-ID'):fmtPercent(current)}</strong>{target!=null&&<div className="driver-summary-progress"><i style={{width:`${progress}%`}} /></div>}<div className="driver-summary-foot"><small>{activeRange?.label??'Periode aktif'}</small><b className={delta==null||delta===0?'neutral':favorable?'good':'review'}>{delta==null?'—':`${delta>0?'▲':'▼'} ${Math.abs(delta).toFixed(1)}%`}{target!=null&&<span>{achieved?'Achieved':'Needs Review'}</span>}</b></div></article>})}</div><div className="panel-title drivers-daily-title"><div><span>DAILY OPERATION</span><h3>Operational Drivers per Tanggal</h3><small>Detail aktual harian sesuai periode aktif.</small></div><ExportButton<any> module="drivers-lm" scope="daily" period={periodSlug} sheetName={`Operational Daily — ${branch.name}`} data={branch.operationalTrend??[]} meta={[{label:'Gerai',value:branch.name},{label:'Area',value:area?.name??'—'},{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Jumlah Hari',value:String((branch.operationalTrend??[]).length)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'Tanggal',value:'date',format:(v:unknown)=>v==null?'—':new Date(`${String(v)}T00:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})},{header:'Volume',value:'volume',format:(v:unknown)=>(v==null?'—':Number(v).toLocaleString('id-ID'))},{header:'Backlog',value:'backlog',format:(v:unknown)=>(v==null?'—':Number(v).toLocaleString('id-ID'))},{header:'Backlog Rate',value:'backlogRate',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Failed Delivery',value:'failedDelivery',format:(v:unknown)=>(v==null?'—':Number(v).toLocaleString('id-ID')),type:'number'},{header:'Failed Delivery Rate',value:'failedDeliveryRate',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'COD Transfer',value:'codTransfer',format:(v:unknown)=>(v==null?'—':Number(v).toLocaleString('id-ID')),type:'number'},{header:'COD Transfer Rate',value:'codTransferRate',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))}]}/></div>{(()=>{const daily=branch.operationalTrend??[];const labels={volume:'Volume',backlog:'Backlog',failedDelivery:'Failed Delivery',codTransfer:'COD Transfer'} as const;return <div className="drivers-unified-trend"><div className="drivers-trend-toolbar"><strong>Daily Trend</strong><select className="trend-select drivers-trend-select" value={driversTrendMetric} onChange={e=>setDriversTrendMetric(e.target.value as typeof driversTrendMetric)}><option value="volume">Volume</option><option value="backlog">Backlog</option><option value="failedDelivery">Failed Delivery</option><option value="codTransfer">COD Transfer</option></select></div><DriverApexChart daily={daily} metric={driversTrendMetric} label={labels[driversTrendMetric]}/></div>})()}<div className="table-wrap drivers-daily-table"><table><thead><tr><th>Tanggal</th><th>Volume</th><th>Backlog</th><th>Failed Delivery</th><th>COD Transfer</th></tr></thead><tbody>{(branch.operationalTrend??[]).length?(branch.operationalTrend??[]).map(d=><tr key={d.date}><td><strong>{fmtDate(d.date)}</strong></td><td>{d.volume.toLocaleString('id-ID')}</td><td>{d.backlogRate==null?'—':fmtPercent(d.backlogRate)}</td><td>{d.failedDeliveryRate==null?'—':fmtPercent(d.failedDeliveryRate)}</td><td>{d.codTransferRate==null?'—':fmtPercent(d.codTransferRate)}</td></tr>):<tr><td colSpan={5}>Data operasional harian belum tersedia.</td></tr>}</tbody></table></div></article>:area?<article className="panel drivers-branch-panel"><div className="panel-title"><div><span>AREA DRILL-DOWN</span><h3>{area.name} — Operational Drivers</h3><small>Klik gerai untuk membuka detail driver operasional harian.</small></div><button className="back-scope back-nav" onClick={()=>{setDriversAreaId(null);setDriversBranchId(null);setDriversBranchQuery('')}}>← Kembali ke Region</button></div>{(()=>{const daily=area.trend??[];const labels={volume:'Volume',backlog:'Backlog',failedDelivery:'Failed Delivery',codTransfer:'COD Transfer'} as const;return <div className="drivers-unified-trend"><div className="drivers-trend-toolbar"><div><strong>Daily Trend</strong><small>Pergerakan driver area pada periode aktif</small></div><select className="trend-select drivers-trend-select" value={driversTrendMetric} onChange={e=>setDriversTrendMetric(e.target.value as typeof driversTrendMetric)}><option value="volume">Volume</option><option value="backlog">Backlog</option><option value="failedDelivery">Failed Delivery</option><option value="codTransfer">COD Transfer</option></select></div><DriverApexChart daily={daily} metric={driversTrendMetric} label={labels[driversTrendMetric]}/></div>})()}<div className="drivers-tools"><input className="table-search" type="search" placeholder="Cari gerai / kode..." value={driversBranchQuery} onChange={e=>{setDriversBranchQuery(e.target.value);setDriversBranchPage(1)}}/><span className="area-count">{branches.length} gerai LM</span><ExportButton<any> module="drivers-lm" scope="gerai" period={periodSlug} sheetName={`Operational Drivers Gerai — ${area.name}`} data={branches} meta={[{label:'Area',value:area.name},{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Range',value:activeRange?`${activeRange.start} s/d ${activeRange.end}`:'—'},{label:'Jumlah Gerai',value:String(branches.length)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'No',value:(_row:any,i:number)=>i+1},{header:'Gerai',value:'name'},{header:'Kode',value:(row:any)=>row.code??'—'},{header:'Volume',value:(row:any)=>val(row,'volume'),format:(v:unknown)=>(v==null?'—':Number(v).toLocaleString('id-ID'))},{header:'Backlog Rate',value:(row:any)=>row.operations?.backlogRate??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Failed Delivery',value:(row:any)=>row.operations?.failedDeliveryRate??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'COD Transfer',value:(row:any)=>row.operations?.codTransferRate??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))}]}/></div><div className="table-wrap drivers-area-table"><table><thead><tr><th>No</th><th>Gerai</th><th>Volume</th><th>Backlog</th><th>Failed Delivery</th><th>COD Transfer</th></tr></thead><tbody>{branches.length?pagedBranches.map((b,i)=><tr key={b.id} className="clickable-row" onClick={()=>setDriversBranchId(b.id)}><td>{(driversBranchPage-1)*PAGE_SIZE+i+1}</td><td><strong>{b.name}</strong></td><td><strong>{val(b,'volume')?.toLocaleString('id-ID')??'—'}</strong></td><td>{b.operations?.backlogRate==null?'—':fmtPercent(b.operations.backlogRate)}</td><td>{b.operations?.failedDeliveryRate==null?'—':fmtPercent(b.operations.failedDeliveryRate)}</td><td>{b.operations?.codTransferRate==null?'—':fmtPercent(b.operations.codTransferRate)}</td></tr>):<tr><td colSpan={6}>Tidak ada gerai LM sesuai pencarian.</td></tr>}</tbody></table></div><TablePager page={driversBranchPage} total={branches.length} onPage={setDriversBranchPage}/></article>:<article className="panel drivers-overview-panel"><div className="panel-title"><div><span>DRIVER OVERVIEW</span><h3>Operational Drivers by Area</h3><small>Klik area untuk membuka detail seluruh gerai LM.</small></div><div className="drivers-panel-tools"><span className="area-count">{areas.length} area</span><ExportButton<any> module="drivers-lm" scope="area" period={periodSlug} sheetName="Operational Drivers by Area" data={areas} meta={[{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Range',value:activeRange?`${activeRange.start} s/d ${activeRange.end}`:'—'},{label:'Jumlah Area',value:String(areas.length)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'No',value:(_row:any,i:number)=>i+1},{header:'Area',value:'name'},{header:'Jumlah Gerai LM',value:(row:any)=>(row.branches??[]).filter((b:any)=>b.function==='LM').length},{header:'Volume',value:(row:any)=>{const lm=(row.branches??[]).filter((b:any)=>b.function==='LM');return row.operations?.volume??lm.reduce((n:number,b:any)=>n+(b.operations?.volume??0),0);},format:(v:unknown)=>(v==null?'—':Number(v).toLocaleString('id-ID'))},{header:'Backlog Rate',value:(row:any)=>row.operations?.backlogRate??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Failed Delivery',value:(row:any)=>row.operations?.failedDeliveryRate??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'COD Transfer',value:(row:any)=>row.operations?.codTransferRate??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))}]}/></div></div>{(()=>{const daily=dashboard?.trend??[];const labels={volume:'Volume',backlog:'Backlog',failedDelivery:'Failed Delivery',codTransfer:'COD Transfer'} as const;return <div className="drivers-unified-trend"><div className="drivers-trend-toolbar"><div><strong>Daily Trend</strong><small>Pergerakan driver region pada periode aktif</small></div><select className="trend-select drivers-trend-select" value={driversTrendMetric} onChange={e=>setDriversTrendMetric(e.target.value as typeof driversTrendMetric)}><option value="volume">Volume</option><option value="backlog">Backlog</option><option value="failedDelivery">Failed Delivery</option><option value="codTransfer">COD Transfer</option></select></div><DriverApexChart daily={daily} metric={driversTrendMetric} label={labels[driversTrendMetric]}/></div>})()}<div className="table-wrap drivers-area-table"><table><thead><tr><th>No</th><th>Area</th><th>Volume</th><th>Backlog</th><th>Failed Delivery</th><th>COD Transfer</th></tr></thead><tbody>{areas.length?areas.map((a,i)=>{const lm=(a.branches??[]).filter(b=>b.function==='LM');const volume=a.operations?.volume??lm.reduce((n,b)=>n+(b.operations?.volume??0),0);return <tr key={a.id} className="clickable-row" onClick={()=>{setDriversAreaId(a.id);setDriversBranchId(null);setDriversBranchQuery('')}}><td>{i+1}</td><td><strong>{a.name}</strong><small>{lm.length} gerai LM</small></td><td><strong>{volume.toLocaleString('id-ID')}</strong></td><td>{a.operations?.backlogRate==null?'—':fmtPercent(a.operations.backlogRate)}</td><td>{a.operations?.failedDeliveryRate==null?'—':fmtPercent(a.operations.failedDeliveryRate)}</td><td>{a.operations?.codTransferRate==null?'—':fmtPercent(a.operations.codTransferRate)}</td></tr>}):<tr><td colSpan={6}>Data Performance Drivers belum tersedia.</td></tr>}</tbody></table></div></article>}</div></>})()}

          {!faqOpen && showKpiModule && <div className="kpi-module">
            {!controlKpiBridge&&<div className="kpi-function-tabs">{(['LM','FM','MM'] as const).map(fn=><button key={fn} className={kpiFunction===fn?'active':''} onClick={()=>{setKpiFunction(fn);setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null);setKpiBranchQuery('');setKpiBranchSort('score-desc')}}>KPI {fn}</button>)}</div>}
            {!kpiAreaId&&<><div className="kpi-summary-grid kpi-area-category-summary">
              <article className="metric-card"><div className="metric-card-head"><span>KPI {kpiFunction} Region</span><span className="metric-target">Periode aktif</span></div><strong>{fmtPercent(kpiRegionValue)}</strong><small>Central Java - DIY • {activeRange?.label??'Periode aktif'}</small></article>
              <article className="metric-card excellent"><div className="metric-card-head"><span>Excellent</span><span className="metric-target">≥ 95%</span></div><strong>{kpiAreaExcellent}<em> / {kpiAreaWithData.length}</em></strong><small>Area kategori Excellent</small></article>
              <article className="metric-card good"><div className="metric-card-head"><span>Good</span><span className="metric-target">85–&lt;95%</span></div><strong>{kpiAreaGood}<em> / {kpiAreaWithData.length}</em></strong><small>Area kategori Good</small></article>
              <article className="metric-card fair"><div className="metric-card-head"><span>Fair</span><span className="metric-target">60–&lt;85%</span></div><strong>{kpiAreaFair}<em> / {kpiAreaWithData.length}</em></strong><small>Area kategori Fair</small></article>
              <article className="metric-card bad"><div className="metric-card-head"><span>Bad</span><span className="metric-target">40–&lt;60%</span></div><strong>{kpiAreaBad}<em> / {kpiAreaWithData.length}</em></strong><small>Area kategori Bad</small></article>
              <article className="metric-card unsatisfactory"><div className="metric-card-head"><span>Unsatisfactory</span><span className="metric-target">&lt; 40%</span></div><strong>{kpiAreaUnsatisfactory}<em> / {kpiAreaWithData.length}</em></strong><small>Area kategori Unsatisfactory</small></article>
            </div>
            <div className="kpi-analysis-grid">
              <article className="panel"><div className="panel-title"><div><span>KPI HEALTH</span><h3>Area Performance Distribution</h3><small>Distribusi KPI {kpiFunction} berdasarkan score area</small></div><span className="area-count">{kpiAreaWithData.length} area</span></div><div className="kpi-health-list"><div><span><i className="excellent"/>Excellent</span><strong>{kpiAreaExcellent}</strong></div><div><span><i className="good"/>Good</span><strong>{kpiAreaGood}</strong></div><div><span><i className="fair"/>Fair</span><strong>{kpiAreaFair}</strong></div><div><span><i className="bad"/>Bad</span><strong>{kpiAreaBad}</strong></div><div><span><i className="unsatisfactory"/>Unsatisfactory</span><strong>{kpiAreaUnsatisfactory}</strong></div></div></article>
              <article className="panel performance-trend-panel kpi-control-trend"><div className="panel-title"><div><h3>KPI {kpiFunction} Daily</h3><small>Pergerakan KPI region pada periode aktif</small></div></div><KpiDailyTrend data={dashboard?.trend??[]} metricKey={kpiMetricKey} label={`KPI ${kpiFunction}`}/></article>
            </div>
            <article className="panel kpi-area-panel"><div className="panel-title kpi-area-title"><div><h3>KPI {kpiFunction} Performance by Area</h3><small>Perbandingan score KPI seluruh area pada periode aktif</small></div><div className="kpi-area-tools"><input className="table-search" type="search" placeholder="Cari area..." value={kpiAreaQuery} onChange={e=>setKpiAreaQuery(e.target.value)}/><select className="table-sort" value={kpiAreaSort} onChange={e=>setKpiAreaSort(e.target.value as typeof kpiAreaSort)}><option value="score-desc">Score tertinggi</option><option value="score-asc">Score terendah</option><option value="name">Nama area</option></select><span className="area-count">{kpiFilteredAreas.length} area</span><ExportButton<any> module={`kpi-${kpiFunction.toLowerCase()}`} scope="area" period={periodSlug} sheetName={`KPI ${kpiFunction} by Area`} data={kpiFilteredAreas} meta={[{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Range',value:activeRange?`${activeRange.start} s/d ${activeRange.end}`:'—'},{label:'Fungsi',value:kpiFunction},{label:'Jumlah Area',value:String(kpiFilteredAreas.length)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'No',value:(_row:any,i:number)=>i+1},{header:'Area',value:(row:any)=>row.area.name},...kpiPointLabels.map((label,idx)=>({header:`KPI ${label}`,value:(row:any)=>areaKpiDetails(row.area)[idx]?.actual??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))})),{header:'Total Score',value:(row:any)=>row.value,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Status',value:(row:any)=>kpiCategory(row.value).label}]}/></div></div><div className="table-wrap kpi-area-table kpi-points-matrix"><table><thead><tr><th>No</th><th>Area</th>{kpiPointLabels.map(label=><th key={label}>KPI {label}</th>)}<th>Total Score</th><th>Status</th></tr></thead><tbody>{kpiFilteredAreas.length?kpiFilteredAreas.map((x,index)=>{const areaBranches=(x.area.branches??[]).filter(b=>b.function===kpiFunction);return <tr key={x.area.id} className="clickable-row" onClick={()=>{setKpiAreaId(x.area.id);setKpiBranchQuery('');setKpiBranchSort('score-desc')}}><td>{index+1}</td><td><strong>{x.area.name}</strong></td>{kpiPointLabels.map((_,i)=>{const detail=areaKpiDetails(x.area)[i];const vals=areaBranches.map(b=>b.kpiDetails?.[i]?.actual).filter((v):v is number=>v!=null);const fallback=vals.length?vals.reduce((a,n)=>a+n,0)/vals.length:null;const actual=detail?.actual??fallback;const tier=detail?.tier??null;return <td key={i}>{tier?kpiTierValue(actual,tier):fmtPercent(actual)}</td>})}<td><strong>{fmtPercent(x.value)}</strong></td><td><span className={`kpi-health-chip ${kpiCategory(x.value).tone}`}>{kpiCategory(x.value).label}</span></td></tr>}):<tr><td colSpan={kpiPointLabels.length+4}>Tidak ada area sesuai pencarian.</td></tr>}</tbody></table></div>
              <div className="kpi-penalty-section"><div className="kpi-penalty-section-head"><div><span>PENGURANG KPI</span><h4>Penalty by Area</h4><small>Data pengurang KPI {kpiFunction} pada periode aktif</small></div><ExportButton<any> module={`kpi-${kpiFunction.toLowerCase()}`} scope="penalty-area" period={periodSlug} sheetName={`Penalty KPI ${kpiFunction} by Area`} data={kpiFilteredAreas} meta={[{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Range',value:activeRange?`${activeRange.start} s/d ${activeRange.end}`:'—'},{label:'Fungsi',value:kpiFunction},{label:'Jumlah Area',value:String(kpiFilteredAreas.length)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'No',value:(_row:any,i:number)=>i+1},{header:'Area',value:(row:any)=>row.area.name},...kpiPenaltyLabels.flatMap(label=>[{header:`${label} (Pencapaian)`,value:(row:any)=>{const p=areaPenaltyDetails(row.area).find((item:any)=>item.label===label);return p?.actual??null;},format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:`${label} (Penalty)`,value:(row:any)=>{const p=areaPenaltyDetails(row.area).find((item:any)=>item.label===label);return p?.penalty??null;},format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))}]),{header:'Total Penalty',value:(row:any)=>areaPenaltyTotal(row.area),format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))}]}/></div>
              <div className="table-wrap kpi-points-matrix kpi-penalty-matrix"><table><thead><tr><th rowSpan={2}>No</th><th rowSpan={2}>Area</th>{kpiPenaltyLabels.map(label=><th key={label} colSpan={2}>{label}</th>)}<th rowSpan={2}>Total Penalty</th></tr><tr>{kpiPenaltyLabels.flatMap(label=>[<th key={label+'-actual'} className="penalty-subhead">Pencapaian</th>,<th key={label+'-penalty'} className="penalty-subhead">Penalty</th>])}</tr></thead><tbody>{kpiFilteredAreas.length?kpiFilteredAreas.map((x,index)=>{const areaBranches=(x.area.branches??[]).filter(b=>b.function===kpiFunction);return <tr key={x.area.id} className="clickable-row" onClick={()=>{setKpiAreaId(x.area.id);setKpiBranchQuery('');setKpiBranchSort('score-desc')}}><td>{index+1}</td><td><strong>{x.area.name}</strong></td>{kpiPenaltyLabels.flatMap(label=>{const p=areaPenaltyDetails(x.area).find(item=>item.label===label);const tone=kpiTierTone(p?.tier);return [<td key={label+'-actual'}><span className={`kpi-tier-value ${tone}`}>{p?.actual==null?'—':fmtPercent(p.actual)}</span></td>,<td key={label+'-penalty'}>{p?fmtNumber(p.penalty):'—'}</td>]})}<td><strong>{areaPenaltyTotal(x.area)==null?'—':fmtNumber(areaPenaltyTotal(x.area)!) }</strong></td></tr>}):<tr><td colSpan={kpiPenaltyLabels.length*2+3}>Data pengurang KPI belum tersedia.</td></tr>}</tbody></table></div></div></article></>}
            {kpiAreaId&&kpiSelectedArea&&<article className="panel kpi-branch-panel">{kpiSelectedBranch?(()=>{const b=kpiSelectedBranch;const target=kpiTarget??100;const gap=b.kpiScore==null?null:b.kpiScore-target;const daily=(b.trend??[]).map(p=>({date:p.date,value:p[kpiMetricKey]}));return <div className="kpi-gerai-detail"><div className="kpi-gerai-summary"><article className="kpi-gerai-metric primary"><small>KPI {kpiFunction}</small><strong>{fmtPercent(b.kpiScore??null)}</strong><em className={gap!=null&&gap>=0?'good':'review'}>{gap==null?'—':`${gap>=0?'▲ +':'▼ '}${Math.abs(gap).toFixed(2)}% vs target`}</em><span>Target {target.toFixed(1)}%</span></article><article className="kpi-gerai-metric target"><small>Target KPI</small><strong>{target.toFixed(1)}%</strong><em className="neutral">Acuan KPI {kpiFunction}</em><span>Target fungsi aktif</span></article><article className="kpi-gerai-metric sla"><small>SLA</small><strong>{fmtPercent(b.sla??null)}</strong><em className={b.sla!=null&&b.slaPrevious!=null?(b.sla>=b.slaPrevious?'good':'review'):'neutral'}>{b.sla==null||b.slaPrevious==null?'Pembanding belum tersedia':`${b.sla>=b.slaPrevious?'▲ +':'▼ '}${Math.abs(b.sla-b.slaPrevious).toFixed(2)}% vs bulan lalu`}</em><span>Periode aktif</span></article><article className="kpi-gerai-metric productivity"><small>Productivity</small><strong>{fmtNumber(b.productivity??null)}</strong><em className={b.productivity!=null&&b.productivityPrevious!=null?(b.productivity>=b.productivityPrevious?'good':'review'):'neutral'}>{b.productivity==null||b.productivityPrevious==null?'Pembanding belum tersedia':`${b.productivity>=b.productivityPrevious?'▲ +':'▼ '}${Math.abs(b.productivity-b.productivityPrevious).toFixed(2)}% vs bulan lalu`}</em><span>Periode aktif</span></article><article className="kpi-gerai-metric penalty"><small>Penalty</small><strong>{fmtPercent(b.penalty??null)}</strong><em className={b.penalty!=null&&b.penaltyPrevious!=null?(b.penalty<=b.penaltyPrevious?'good':'review'):'neutral'}>{b.penalty==null||b.penaltyPrevious==null?'Pembanding belum tersedia':`${b.penalty<=b.penaltyPrevious?'▼ -':'▲ +'}${Math.abs(b.penalty-b.penaltyPrevious).toFixed(2)}% vs bulan lalu`}</em><span>Pengurang KPI</span></article></div><div className="kpi-scope-daily-trend"><div className="kpi-gerai-chart-title"><div><strong>KPI {kpiFunction} Daily — {b.name}</strong><small>Pergerakan total score KPI harian</small></div><button className="back-scope back-nav" onClick={()=>{setKpiBranchDetailId(null);setKpiDailyDate(null)}}>← Kembali</button></div><KpiDailyTrend data={b.trend??[]} metricKey={kpiMetricKey} label={`KPI ${kpiFunction} ${b.name}`}/></div><div className="kpi-performance-matrix"><div className="kpi-gerai-chart-title"><div><span>PERFORMANCE DETAIL</span><strong>KPI {kpiFunction} per Tanggal</strong></div><div className="kpi-daily-matrix-tools"><small>Terbaru → terlama</small><ExportButton<any> module={`kpi-${kpiFunction.toLowerCase()}`} scope="daily-matrix" period={periodSlug} sheetName={`KPI ${kpiFunction} Daily — ${b.name}`} data={(()=>{const rows:{date:string;kpi:string;target:string;actual:number|null;tier:string}[]=[];const sortedDaily=[...daily].sort((a,b)=>a.date.localeCompare(b.date));for(const day of sortedDaily){for(const k of (b.kpiDailyDetails??[])){const point=k.daily.find(x=>x.date===day.date);rows.push({date:day.date,kpi:k.label,target:k.targetLabel,actual:point?.actual??null,tier:point?.tier??'—'});}}return rows;})()} meta={[{label:'Gerai',value:b.name},{label:'Area',value:kpiSelectedArea.name},{label:'Fungsi',value:kpiFunction},{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Range',value:activeRange?`${activeRange.start} s/d ${activeRange.end}`:'—'},{label:'Jumlah Hari',value:String(daily.length)},{label:'Jumlah KPI',value:String((b.kpiDailyDetails??[]).length)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'Tanggal',value:'date',format:(v:unknown)=>v==null?'—':new Date(`${String(v)}T00:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})},{header:'KPI',value:'kpi'},{header:'Target',value:'target'},{header:'Actual',value:'actual',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Tier',value:'tier'}]}/></div></div><div className="table-wrap kpi-matrix-wrap"><table><thead><tr><th>KPI</th>{[...daily].sort((a,b)=>b.date.localeCompare(a.date)).map(d=><th key={d.date}><button type="button" className={kpiDailyDate===d.date?'selected':''} onClick={()=>setKpiDailyDate(d.date)}>{fmtDate(d.date)}</button></th>)}</tr></thead><tbody>{(b.kpiDailyDetails??[]).map(k=><tr key={k.key}><td><strong>{k.label}</strong><small>{k.targetLabel}</small></td>{[...daily].sort((a,b)=>b.date.localeCompare(a.date)).map(d=>{const point=k.daily.find(x=>x.date===d.date);return <td key={d.date}>{kpiTierValue(point?.actual,point?.tier)}</td>})}</tr>)}</tbody></table></div></div> <div className="kpi-penalty-section" style={{marginTop:16}}><div className="kpi-penalty-section-head"><div><span>PENGURANG KPI</span><h4>Penalty KPI {kpiFunction} — {b.name}</h4><small>Data pengurang KPI {kpiFunction} pada periode aktif</small></div><ExportButton<any> module={`kpi-${kpiFunction.toLowerCase()}`} scope="penalty-gerai-detail" period={periodSlug} sheetName={`Penalty KPI ${kpiFunction} — ${b.name}`} data={b.penaltyDetails??[]} meta={[{label:'Gerai',value:b.name},{label:'Area',value:kpiSelectedArea.name},{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Range',value:activeRange?`${activeRange.start} s/d ${activeRange.end}`:'—'},{label:'Fungsi',value:kpiFunction},{label:'Total Penalty',value:b.penalty==null?'—':b.penalty.toFixed(2)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'No',value:(_row:any,i:number)=>i+1},{header:'Indicator',value:'label'},{header:'Actual',value:'actual',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Target T1',value:'targetLabel'},{header:'Tier',value:'tier'},{header:'Max Penalty',value:'maxPenalty',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Penalty',value:'penalty',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))}]}/></div>{renderPenaltyMatrix(b.penaltyDetails)}</div> {kpiDailyDate&&(()=>{const day=daily.find(d=>d.date===kpiDailyDate);const details=(b.kpiDailyDetails??[]).map(k=>({key:k.key,label:k.label,targetLabel:k.targetLabel,day:k.daily.find(d=>d.date===kpiDailyDate)})).filter(x=>x.day);const dayGap=day?.value==null?null:day.value-target;return <div className="kpi-daily-detail"><div className="kpi-daily-detail-head"><div><span>DAILY KPI DETAIL</span><h4>{fmtDate(kpiDailyDate)} — KPI {kpiFunction}</h4><small>{b.name} • {kpiSelectedArea.name}</small></div><div className="kpi-daily-detail-actions"><ExportButton<any> module={`kpi-${kpiFunction.toLowerCase()}`} scope="daily-detail" period={periodSlug} sheetName={`Daily KPI Detail ${kpiDailyDate} — ${b.name}`} data={details} meta={[{label:'Tanggal',value:fmtDate(kpiDailyDate)},{label:'Gerai',value:b.name},{label:'Area',value:kpiSelectedArea.name},{label:'Fungsi',value:kpiFunction},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'Komponen KPI',value:'label'},{header:'Actual',value:(row:any)=>row.day?.actual??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Target',value:'targetLabel'},{header:'Gap',value:(row:any)=>row.day?.gap??null,format:(v:unknown)=>fmtSigned(v==null?null:Number(v))},{header:'Tier',value:(row:any)=>row.day?.tier??'—'}]}/><button className="back-scope back-nav" onClick={()=>setKpiDailyDate(null)}>Tutup Detail Hari</button></div></div><div className="kpi-daily-cards"><span><small>Actual KPI</small><strong>{fmtPercent(day?.value??null)}</strong></span><span><small>Target KPI</small><strong>{target.toFixed(1)}%</strong></span><span><small>Gap</small><strong className={dayGap!=null&&dayGap>=0?'good':'review'}>{dayGap==null?'—':`${dayGap>=0?'+':''}${dayGap.toFixed(2)}`}</strong></span><span><small>Status</small><strong>{day?.value==null?'No Data':day.value>=target?'Achieved':'Need Review'}</strong></span></div><div className="table-wrap kpi-daily-breakdown"><table><thead><tr><th>Komponen KPI</th><th>Actual</th><th>Target</th><th>Gap</th><th>Tier</th></tr></thead><tbody>{details.length?details.map(x=><tr key={x.key}><td><strong>{x.label}</strong></td><td>{kpiTierValue(x.day!.actual,x.day!.tier)}</td><td>{x.day!.targetLabel}</td><td>{x.day!.gap==null?'—':`${x.day!.gap!>=0?'+':''}${x.day!.gap!.toFixed(2)}`}</td><td>{x.day!.tier||'—'}</td></tr>):<tr><td colSpan={5}>Detail komponen KPI pada tanggal ini belum tersedia.</td></tr>}</tbody></table></div></div>})()}</div>})():<><div className="kpi-scope-daily-trend"><div className="kpi-gerai-chart-title"><div><strong>KPI {kpiFunction} Daily</strong><small>Pergerakan KPI harian area</small></div><button className="back-scope back-nav" onClick={()=>{setKpiAreaId(null);setKpiBranchDetailId(null);setKpiBranchQuery('');setKpiBranchSort('score-desc')}}>← Kembali</button></div><KpiDailyTrend data={kpiSelectedArea.trend??[]} metricKey={kpiMetricKey} label={`KPI ${kpiFunction} ${kpiSelectedArea.name}`}/></div><div className="kpi-branch-summary kpi-branch-category-summary"><span><small>Gerai {kpiFunction}</small><strong>{kpiAreaBranches.length}</strong></span><span className="excellent"><small>Excellent</small><strong>{kpiBranchExcellent}</strong><em>≥ 95%</em></span><span className="good"><small>Good</small><strong>{kpiBranchGood}</strong><em>85–&lt;95%</em></span><span className="fair"><small>Fair</small><strong>{kpiBranchFair}</strong><em>60–&lt;85%</em></span><span className="bad"><small>Bad</small><strong>{kpiBranchBad}</strong><em>40–&lt;60%</em></span><span className="unsatisfactory"><small>Unsatisfactory</small><strong>{kpiBranchUnsatisfactory}</strong><em>&lt; 40%</em></span></div><div className="kpi-branch-tools"><input className="table-search" type="search" placeholder="Cari gerai..." value={kpiBranchQuery} onChange={e=>setKpiBranchQuery(e.target.value)}/><select className="table-sort" value={kpiBranchSort} onChange={e=>setKpiBranchSort(e.target.value as typeof kpiBranchSort)}><option value="score-desc">Score tertinggi</option><option value="score-asc">Score terendah</option><option value="name">Nama gerai</option></select><span className="area-count">{kpiFilteredBranches.length} gerai</span><ExportButton<any> module={`kpi-${kpiFunction.toLowerCase()}`} scope="gerai" period={periodSlug} sheetName={`KPI ${kpiFunction} by Gerai`} data={kpiFilteredBranches} meta={[{label:'Area',value:kpiSelectedArea.name},{label:'Periode',value:activeRange?.label??'Periode aktif'},{label:'Range',value:activeRange?`${activeRange.start} s/d ${activeRange.end}`:'—'},{label:'Fungsi',value:kpiFunction},{label:'Jumlah Gerai',value:String(kpiFilteredBranches.length)},{label:'Diekspor',value:new Date().toLocaleString('id-ID')}]} columns={[{header:'No',value:(_row:any,i:number)=>i+1},{header:'Gerai',value:'name'},...kpiPointLabels.map((label,idx)=>({header:`KPI ${label}`,value:(row:any)=>row.kpiDetails?.[idx]?.actual??null,format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))})),{header:'Total Score',value:'kpiScore',format:(v:unknown)=>(v==null?'—':Number(v).toFixed(2))},{header:'Status',value:(row:any)=>kpiCategory(row.kpiScore).label}]}/></div><div className="table-wrap kpi-branch-table kpi-points-matrix"><table><thead><tr><th>No</th><th>Gerai</th>{kpiPointLabels.map(label=><th key={label}>KPI {label}</th>)}<th>Total Score</th><th>Status</th></tr></thead><tbody>{kpiFilteredBranches.length?kpiFilteredBranches.map((b,index)=><tr key={b.id} className="clickable-row" onClick={()=>{setKpiBranchDetailId(b.id);setKpiDailyDate(null)}}><td>{index+1}</td><td><strong>{b.name}</strong></td>{(b.kpiDetails??[]).map(k=><td key={k.key} title={`${k.label} • Target ${k.targetLabel} • ${k.tier}`}>{kpiTierValue(k.actual,k.tier)}</td>)}<td><strong>{fmtPercent(b.kpiScore??null)}</strong></td><td><span className={`kpi-health-chip ${kpiCategory(b.kpiScore).tone}`}>{kpiCategory(b.kpiScore).label}</span></td></tr>):<tr><td colSpan={kpiPointLabels.length+4}>Tidak ada gerai sesuai pencarian.</td></tr>}</tbody></table></div></>}</article>}
          </div>}
        </section>
      </main>
    </div>
  );
}
