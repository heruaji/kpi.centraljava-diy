import { useEffect, useState } from 'react';
import type { RegionDashboard } from './types/dashboard';
import { getRegionDashboard, latestFreshness, type DashboardPeriod } from './services/dashboard';
import { BarChart3, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Gauge, Menu, Moon, Route, Sun, Target, TrendingUp, X } from 'lucide-react';

const navigation = [
  { label: 'Control Tower', icon: Gauge, active: true },
  { label: 'SLA Performance', icon: Target },
  { label: 'KPI Performance', icon: BarChart3 },
  { label: 'Productivity', icon: TrendingUp },
  { label: 'Performance Drivers', icon: Route },
];

const fmtPercent = (value: number | null) => value == null ? '—' : `${value.toFixed(2)}%`;
const fmtDate = (value: string | null) => value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '—';
const fmtMonth = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`)) : 'periode lalu';

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'>(() => (localStorage.getItem('kpi-dashboard-theme') as 'light'|'dark') || 'dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<DashboardPeriod>(() => (localStorage.getItem('kpi-dashboard-period') as DashboardPeriod) || 'MTD');
  const [customRange, setCustomRange] = useState<{start:string;end:string}|null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [trendMetric, setTrendMetric] = useState<'sla'|'kpiLm'|'kpiFm'|'kpiMm'>('sla');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedKpiKey, setSelectedKpiKey] = useState<string | null>(null);
  const [branchFunctionFilter, setBranchFunctionFilter] = useState<'ALL'|'LM'|'FM'|'MM'>('ALL');
  const [selectedDriver, setSelectedDriver] = useState<'volume'|'backlog'|'failedDelivery'|'codTransfer'|null>(null);
  const [activeModule, setActiveModule] = useState<'control'|'sla'|'kpi'>(() => (localStorage.getItem('kpi-dashboard-module') as 'control'|'sla'|'kpi') || 'control');
  const [kpiFunction, setKpiFunction] = useState<'LM'|'FM'|'MM'>('LM');
  const [kpiAreaQuery, setKpiAreaQuery] = useState('');
  const [kpiAreaSort, setKpiAreaSort] = useState<'score-desc'|'score-asc'|'name'>('score-desc');
  const [kpiAreaId, setKpiAreaId] = useState<string | null>(null);
  const [kpiBranchQuery, setKpiBranchQuery] = useState('');
  const [kpiBranchSort, setKpiBranchSort] = useState<'score-desc'|'score-asc'|'name'>('score-desc');
  const [kpiBranchDetailId, setKpiBranchDetailId] = useState<string | null>(null);
  const [kpiDailyDate, setKpiDailyDate] = useState<string | null>(null);
  const [slaAreaId, setSlaAreaId] = useState<string | null>(null);
  const [slaAreaQuery, setSlaAreaQuery] = useState('');
  const [slaStatusFilter, setSlaStatusFilter] = useState<'ALL'|'ACHIEVED'|'REVIEW'>('ALL');
  const [slaBranchQuery, setSlaBranchQuery] = useState('');
  const [slaBranchStatus, setSlaBranchStatus] = useState<'ALL'|'ACHIEVED'|'REVIEW'>('ALL');
  const [slaAreaSort, setSlaAreaSort] = useState<'sla-desc'|'sla-asc'|'decline'>('sla-desc');
  const [slaBranchSort, setSlaBranchSort] = useState<'sla-desc'|'sla-asc'|'decline'>('sla-desc');
  const [slaBranchDetailId, setSlaBranchDetailId] = useState<string | null>(null);
  const [areaQuery, setAreaQuery] = useState('');
  const [areaSort, setAreaSort] = useState<'name'|'sla'|'lm'|'fm'|'mm'>('name');
  const [branchQuery, setBranchQuery] = useState('');
  const [dashboard, setDashboard] = useState<RegionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getRegionDashboard(periodPreset, customRange ?? undefined)
      .then(setDashboard)
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat dashboard'))
      .finally(() => setLoading(false));
  }, [periodPreset, customRange]);

  useEffect(() => { localStorage.setItem('kpi-dashboard-period', periodPreset); }, [periodPreset]);
  useEffect(() => { localStorage.setItem('kpi-dashboard-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('kpi-dashboard-module', activeModule); }, [activeModule]);
  useEffect(() => {
    if (!mobileOpen && !periodOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); setPeriodOpen(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, periodOpen]);

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
  const selectedBranch = selectedArea?.branches?.find(branch => branch.id === selectedBranchId) ?? null;
  useEffect(() => { if(selectedBranchId && selectedArea && !selectedBranch) { setSelectedBranchId(null); setSelectedKpiKey(null); setSelectedDriver(null); } }, [selectedArea, selectedBranchId, selectedBranch]);
  const filteredBranches = selectedArea?.branches?.filter(branch => (branchFunctionFilter === 'ALL' || branch.function === branchFunctionFilter) && (!branchQuery.trim() || `${branch.name} ${branch.code} ${branch.city}`.toLowerCase().includes(branchQuery.trim().toLowerCase()))) ?? [];
  const filteredAreas = [...(dashboard?.areas ?? [])].filter(area => !areaQuery.trim() || area.name.toLowerCase().includes(areaQuery.trim().toLowerCase())).sort((a,b)=>areaSort==='name'?a.name.localeCompare(b.name,'id'):((b[areaSort==='sla'?'sla':areaSort==='lm'?'kpiLm':areaSort==='fm'?'kpiFm':'kpiMm']??-1)-(a[areaSort==='sla'?'sla':areaSort==='lm'?'kpiLm':areaSort==='fm'?'kpiFm':'kpiMm']??-1)));
  const selectedKpi = selectedBranch?.kpiDailyDetails?.find(kpi => kpi.key === selectedKpiKey) ?? null;
  const trend = selectedBranch?.trend ?? selectedArea?.trend ?? dashboard?.trend ?? [];
  const branchTrendMetric = selectedBranch?.function === 'FM' ? 'kpiFm' : selectedBranch?.function === 'MM' ? 'kpiMm' : 'kpiLm';
  const activeTrendMetric = selectedBranch ? branchTrendMetric : trendMetric;
  const driverLabels={volume:'Volume',backlog:'Backlog',failedDelivery:'Failed Delivery',codTransfer:'COD Transfer'} as const;
  const driverDaily=selectedBranch?.operationalTrend ?? [];
  const driverMax=selectedDriver?Math.max(1,...driverDaily.map(d=>d[selectedDriver])):1;
  const kpiTrendMax = selectedKpi ? Math.max(100,...selectedKpi.daily.map(d=>d.actual ?? 0),selectedKpi.daily[0]?.target ?? 0) : 100;
  const trendLabels: Record<typeof trendMetric,string> = {sla:'SLA',kpiLm:'KPI LM',kpiFm:'KPI FM',kpiMm:'KPI MM'};
  const trendValues=trend.map(p=>p[activeTrendMetric]).filter((v):v is number=>v!=null);
  const trendMax=Math.max(100,...trendValues);
  const trendTarget = selectedBranch ? (selectedBranch.function==='FM'?99:selectedBranch.function==='MM'?96.5:95) : activeTrendMetric==='sla'?98:activeTrendMetric==='kpiLm'?95:activeTrendMetric==='kpiFm'?99:96.5;
  const cardTargets: Record<string,{value:number;label:string;direction:'HIGHER'|'LOWER'}> = {
    sla:{value:98,label:'98%',direction:'HIGHER'},lm:{value:95,label:'95%',direction:'HIGHER'},fm:{value:99,label:'99%',direction:'HIGHER'},mm:{value:96.5,label:'96.5%',direction:'HIGHER'},
    kpi:{value:95,label:'95%',direction:'HIGHER'},productivity:{value:100,label:'100%',direction:'HIGHER'},penalty:{value:.5,label:'0.5%',direction:'LOWER'}
  };
  const visibleCards = selectedBranch ? [
    {key:'sla',label:'SLA Performance',value:selectedBranch.sla ?? null,unit:'percent' as const},
    {key:'kpi',label:`KPI ${selectedBranch.function}`,value:selectedBranch.kpiScore ?? null,unit:'percent' as const},
    {key:'penalty',label:'Pengurang KPI',value:selectedBranch.penalty ?? null,unit:'percent' as const},
    {key:'productivity',label:'Productivity',value:selectedBranch.productivity ?? null,unit:'percent' as const},
  ] : selectedArea ? [
    {key:'sla',label:'SLA Performance',value:selectedArea.sla,unit:'percent' as const},
    {key:'lm',label:'KPI LM',value:selectedArea.kpiLm,unit:'percent' as const},
    {key:'fm',label:'KPI FM',value:selectedArea.kpiFm,unit:'percent' as const},
    {key:'mm',label:'KPI MM',value:selectedArea.kpiMm,unit:'percent' as const},
    {key:'productivity',label:'Productivity',value:selectedArea.productivity,unit:'percent' as const},
  ] : cards;
  const slaAreaTotal = dashboard?.areas?.length ?? 0;
  const slaAreaAchieved = dashboard?.areas?.filter(a=>a.sla!=null&&a.sla>=98).length ?? 0;
  const slaAreaReview = dashboard?.areas?.filter(a=>a.sla!=null&&a.sla<98).length ?? 0;
  const slaAreaNoData = dashboard?.areas?.filter(a=>a.sla==null).length ?? 0;
  const slaRegion = dashboard?.metrics?.find(m=>m.key==='sla')?.value ?? null;
  const slaRegionGap = slaRegion==null ? null : slaRegion-98;
  const slaAchievedShare = slaAreaTotal ? (slaAreaAchieved/slaAreaTotal)*100 : 0;
  const slaReviewShare = slaAreaTotal ? (slaAreaReview/slaAreaTotal)*100 : 0;
  const slaSelectedArea = dashboard?.areas?.find(a=>a.id===slaAreaId) ?? null;
  const slaSelectedBranch = slaSelectedArea?.branches?.find(b=>b.id===slaBranchDetailId) ?? null;
  useEffect(()=>{if(slaAreaId&&dashboard&&!slaSelectedArea){setSlaAreaId(null);setSlaBranchDetailId(null)}},[dashboard,slaAreaId,slaSelectedArea]);
  useEffect(()=>{if(slaBranchDetailId&&slaSelectedArea&&!slaSelectedBranch)setSlaBranchDetailId(null)},[slaSelectedArea,slaBranchDetailId,slaSelectedBranch]);
  const slaFilteredAreas = [...(dashboard?.areas ?? [])].filter(area => (!slaAreaQuery.trim() || area.name.toLowerCase().includes(slaAreaQuery.trim().toLowerCase())) && (slaStatusFilter==='ALL' || (slaStatusFilter==='ACHIEVED' ? area.sla!=null&&area.sla>=98 : area.sla!=null&&area.sla<98))).sort((a,b)=>slaAreaSort==='sla-asc'?(a.sla??999)-(b.sla??999):slaAreaSort==='decline'?((a.sla??0)-(a.slaPrevious??a.sla??0))-((b.sla??0)-(b.slaPrevious??b.sla??0)):(b.sla??-1)-(a.sla??-1));
  const kpiMetricKey = kpiFunction==='LM'?'kpiLm':kpiFunction==='FM'?'kpiFm':'kpiMm';
  const kpiSummaryKey = kpiFunction.toLowerCase();
  const kpiRegionMetric = dashboard?.metrics?.find(m=>m.key===kpiSummaryKey);
  const kpiRegionValue = kpiRegionMetric?.value ?? null;
  const kpiTarget = kpiRegionMetric?.target ?? null;
  const kpiAreaValues = (dashboard?.areas??[]).map(a=>({area:a,value:a[kpiMetricKey]}));
  const kpiAreaWithData = kpiAreaValues.filter(x=>x.value!=null);
  const kpiAreaExcellent = kpiAreaWithData.filter(x=>kpiTarget!=null&&(x.value??0)>=kpiTarget).length;
  const kpiAreaGood = kpiAreaWithData.filter(x=>kpiTarget!=null&&(x.value??0)<kpiTarget&&(x.value??0)>=Math.max(0,kpiTarget-10)).length;
  const kpiAreaReview = kpiAreaWithData.filter(x=>kpiTarget!=null&&(x.value??0)<Math.max(0,kpiTarget-10)).length;
  const kpiFilteredAreas = kpiAreaValues.filter(x=>!kpiAreaQuery.trim()||x.area.name.toLowerCase().includes(kpiAreaQuery.trim().toLowerCase())).sort((a,b)=>kpiAreaSort==='name'?a.area.name.localeCompare(b.area.name,'id'):kpiAreaSort==='score-asc'?(a.value??999)-(b.value??999):(b.value??-1)-(a.value??-1));
  const kpiSelectedArea = dashboard?.areas?.find(a=>a.id===kpiAreaId) ?? null;
  const kpiAreaBranches = (kpiSelectedArea?.branches??[]).filter(b=>b.function===kpiFunction);
  const kpiFilteredBranches = [...kpiAreaBranches].filter(b=>!kpiBranchQuery.trim()||`${b.name} ${b.code} ${b.city}`.toLowerCase().includes(kpiBranchQuery.trim().toLowerCase())).sort((a,b)=>kpiBranchSort==='name'?a.name.localeCompare(b.name,'id'):kpiBranchSort==='score-asc'?(a.kpiScore??999)-(b.kpiScore??999):(b.kpiScore??-1)-(a.kpiScore??-1));
  const kpiSelectedBranch = kpiBranchDetailId ? kpiAreaBranches.find(b=>b.id===kpiBranchDetailId) ?? null : null;
  const kpiBranchWithData = kpiAreaBranches.filter(b=>b.kpiScore!=null);
  const kpiBranchExcellent = kpiBranchWithData.filter(b=>kpiTarget!=null&&(b.kpiScore??0)>=kpiTarget).length;
  const kpiBranchReview = kpiBranchWithData.filter(b=>kpiTarget!=null&&(b.kpiScore??0)<Math.max(0,kpiTarget-10)).length;
  useEffect(()=>{if(kpiAreaId&&dashboard&&!kpiSelectedArea){setKpiAreaId(null);setKpiBranchDetailId(null)}},[dashboard,kpiAreaId,kpiSelectedArea]);
  useEffect(()=>{if(kpiBranchDetailId&&kpiSelectedArea&&!kpiSelectedBranch){setKpiBranchDetailId(null);setKpiDailyDate(null)}},[kpiSelectedArea,kpiBranchDetailId,kpiSelectedBranch]);
  const periodLabel = activeRange
    ? `${activeRange.label} • ${fmtDate(activeRange.start)}–${fmtDate(activeRange.end)}`
    : 'MTD • Memuat...';

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Navigasi utama">
        <div className="brand">
          <div className="brand-mark"><img src="/sicepat-icon.svg" alt="SiCepat"/></div>
          <div className="brand-copy" aria-hidden={collapsed}><strong>Control Tower</strong><span>Central Java - DIY</span></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20}/></button>
        </div>
        <nav>
          <span className="nav-section-label">CORE MODULES</span>
          {navigation.map(({ label, icon: Icon }) => { const key=label==='SLA Performance'?'sla':label==='KPI Performance'?'kpi':'control'; const enabled=label==='Control Tower'||label==='SLA Performance'||label==='KPI Performance'; return (
            <button key={label} disabled={!enabled} className={enabled && activeModule===key ? 'nav-item active' : 'nav-item'} title={collapsed ? label : undefined} onClick={()=>{if(!enabled)return;setActiveModule(key);setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null);setSlaAreaId(null);setSlaBranchDetailId(null);setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null);setMobileOpen(false)}}>
              <Icon size={18}/><span className="nav-label">{label}</span>
            </button>
          )})}
          <span className="nav-section-label nav-region-label">NAVIGASI WILAYAH</span>
          <button title={collapsed?'Region Overview':undefined} className={!selectedArea ? 'nav-item active' : 'nav-item'} onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null);setMobileOpen(false)}}><BarChart3 size={18}/><span className="nav-label">Region Overview</span></button>
          <button title={collapsed?'Area Control Tower':undefined} className={selectedArea && !selectedBranch ? 'nav-item active' : 'nav-item'} disabled={!selectedArea} onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setMobileOpen(false)}}><Target size={18}/><span className="nav-label">Area Control Tower</span></button>
          <button title={collapsed?'Branch Command':undefined} className={selectedBranch ? 'nav-item active' : 'nav-item'} disabled={!selectedBranch} onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setMobileOpen(false)}}><Route size={18}/><span className="nav-label">Branch Command</span></button>
        </nav>
        <button className="collapse-btn" aria-label={collapsed?'Buka menu':'Tutup menu'} title={collapsed?'Buka menu':'Tutup menu'} onClick={() => setCollapsed(v => !v)}>
          <span className="collapse-icon">{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</span><span className="collapse-label">Collapse Menu</span>
        </button>
      </aside>

      {mobileOpen && <button className="scrim" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}/>}

      <main className="main" onClick={()=>{if(periodOpen)setPeriodOpen(false)}}>
        <header className="topbar">
          <div className="title-row">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={22}/></button>
            <div>
              {activeModule==='kpi'?<><div className="breadcrumb"><button onClick={()=>{setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null)}}>KPI Performance</button><span>/</span><button onClick={()=>{setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null)}}>{kpiFunction}</button>{kpiSelectedArea&&<><span>/</span><button onClick={()=>{setKpiBranchDetailId(null);setKpiDailyDate(null)}}>{kpiSelectedArea.name}</button></>}{kpiSelectedBranch&&<><span>/</span><strong>{kpiSelectedBranch.name}</strong></>}</div><h1>{kpiSelectedBranch?'Detail KPI Gerai':kpiSelectedArea?'Area KPI Performance':'KPI Performance'}</h1><p className="page-subtitle">{kpiSelectedBranch?`Detail KPI ${kpiFunction} gerai pada periode aktif`:kpiSelectedArea?`Daftar gerai ${kpiFunction} dan performa KPI area terpilih`:`Monitoring KPI ${kpiFunction} dari region hingga area dan branch pada periode aktif`}</p></>:activeModule==='sla'?<><div className="breadcrumb"><button onClick={()=>{setSlaAreaId(null);setSlaBranchDetailId(null)}}>SLA Performance</button>{slaSelectedArea&&<><span>/</span><button onClick={()=>setSlaBranchDetailId(null)}>{slaSelectedArea.name}</button></>}{slaSelectedBranch&&<><span>/</span><strong>{slaSelectedBranch.name}</strong></>}</div><h1>{slaSelectedBranch?'Detail Gerai':slaSelectedArea?'Area SLA Performance':'SLA Performance'}</h1><p className="page-subtitle">{slaSelectedBranch?'Detail SLA harian gerai sesuai periode aktif':slaSelectedArea?'Pantau SLA seluruh gerai LM dalam area terpilih':'Pantau pencapaian SLA region, area, dan gerai'}</p></>:<><div className="breadcrumb"><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null)}}>Central Java - DIY</button><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null)}}>Region</button>{selectedArea&&<><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null)}}>{selectedArea.name}</button></>}{selectedBranch&&<><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null)}}>{selectedBranch.name}</button></>}{selectedKpi&&<><span>/</span><strong>{selectedKpi.label}</strong></>}</div><h1>{selectedKpi ? 'KPI Detail' : selectedBranch ? 'Branch Command Center' : selectedArea ? 'Area Control Tower' : 'Region Control Tower'}</h1><p className="page-subtitle">{selectedKpi ? 'Detail performa KPI berdasarkan periode aktif' : selectedBranch ? 'Pantau performa operasional dan KPI unit terpilih' : selectedArea ? 'Pantau performa seluruh branch dalam area' : 'Pantau kinerja seluruh wilayah dalam satu tampilan'}</p></>}
            </div>
          </div>
          <div className="topbar-actions" onClick={e=>e.stopPropagation()}><button className="theme-toggle" onClick={()=>setTheme(v=>v==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={15}/>:<Moon size={15}/>}<span>{theme==='dark'?'Mode Terang':'Mode Gelap'}</span></button><div className="period-wrap">
            <button className={`period-button ${periodOpen?'open':''}`} aria-expanded={periodOpen} aria-haspopup="dialog" onClick={() => setPeriodOpen(v => !v)}>
              <CalendarDays size={17}/><span><small>Periode Aktif</small><strong>{periodLabel}</strong></span><ChevronDown size={14} className="period-chevron"/>
            </button>
            {periodOpen && (
              <div className="period-popover">
                <div className="period-popover-head"><div className="period-icon"><CalendarDays size={19}/></div><div><strong>Pilih Periode</strong><small>Data dihitung berdasarkan tanggal data terbaru</small></div></div>
                <div className="period-presets">
                {([
                  ['TODAY','Hari Ini','Hanya tanggal terbaru'],['YESTERDAY','Kemarin','1 hari sebelumnya'],['LAST_7','7 Hari Terakhir','7 hari terakhir'],['LAST_30','30 Hari Terakhir','30 hari terakhir'],['WTD','WTD','Week to Date'],['MTD','MTD','Month to Date'],['YTD','YTD','Year to Date']
                ] as [DashboardPeriod,string,string][]).map(([value,label,desc]) =>
                  <button key={value} className={value === periodPreset && !customRange ? 'selected' : ''} onClick={() => {setCustomRange(null);setPeriodPreset(value);setPeriodOpen(false);setSelectedKpiKey(null);setSelectedDriver(null);setSlaBranchDetailId(null);setKpiDailyDate(null)}}><span>{label}</span><small>{desc}</small></button>
                )}
                </div>
                <div className="custom-range"><div className="custom-range-title"><CalendarDays size={17}/><div><strong>Custom Range</strong><small>Pilih tanggal awal dan akhir secara manual</small></div></div><div className="custom-date-fields"><label><span>Tanggal Awal</span><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></label><b>—</b><label><span>Tanggal Akhir</span><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></label></div><button disabled={!customStart||!customEnd||customStart>customEnd} onClick={()=>{setCustomRange({start:customStart,end:customEnd});setPeriodOpen(false);setSelectedKpiKey(null);setSelectedDriver(null);setSlaBranchDetailId(null);setKpiDailyDate(null)}}>Terapkan</button></div>
                <div className="period-note"><span>Preset mengikuti tanggal data terbaru.</span><span>Custom Range memakai tanggal pilihan.</span></div>
              </div>
            )}
          </div></div>
        </header>

        <section className="content">
          {activeModule==='kpi' && <div className="module-intro"><div><p className="eyebrow">KPI PERFORMANCE</p><h2>Key Performance Indicator</h2><small>Monitoring performa KPI LM, FM, dan MM pada periode aktif.</small></div><span className="module-target">Function: {kpiFunction}</span></div>}
          {activeModule==='kpi' && <div className="kpi-module">
            <div className="kpi-function-tabs">{(['LM','FM','MM'] as const).map(fn=><button key={fn} className={kpiFunction===fn?'active':''} onClick={()=>{setKpiFunction(fn);setKpiAreaId(null);setKpiBranchDetailId(null);setKpiDailyDate(null);setKpiBranchQuery('');setKpiBranchSort('score-desc')}}>KPI {fn}</button>)}</div>
            {!kpiAreaId&&<><div className="kpi-summary-grid">
              <article className="metric-card"><div className="metric-card-head"><span>KPI {kpiFunction} Region</span><span className="metric-target">Periode aktif</span></div><strong>{fmtPercent(kpiRegionValue)}</strong><small>Central Java - DIY • {activeRange?.label??'Periode aktif'}</small></article>
              <article className="metric-card"><div className="metric-card-head"><span>Excellent Area</span><span className="metric-target">≥ 95%</span></div><strong>{kpiAreaExcellent}<em> / {kpiAreaWithData.length}</em></strong><small>Area memenuhi target KPI {kpiFunction}</small></article>
              <article className="metric-card"><div className="metric-card-head"><span>Need Attention</span><span className="metric-target warning">&lt; 85%</span></div><strong>{kpiAreaReview}<em> / {kpiAreaWithData.length}</em></strong><small>Area belum memenuhi target KPI {kpiFunction}</small></article>
            </div>
            <div className="kpi-analysis-grid">
              <article className="panel"><div className="panel-title"><div><span>KPI HEALTH</span><h3>Area Performance Distribution</h3><small>Distribusi KPI {kpiFunction} berdasarkan score area</small></div><span className="area-count">{kpiAreaWithData.length} area</span></div><div className="kpi-health-list"><div><span><i className="excellent"/>Achieved</span><strong>{kpiAreaExcellent}</strong></div><div><span><i className="good"/>Near Target</span><strong>{kpiAreaGood}</strong></div><div><span><i className="review"/>Need Review</span><strong>{kpiAreaReview}</strong></div></div></article>
              <article className="panel"><div className="panel-title"><div><span>REGION TREND</span><h3>KPI {kpiFunction} Daily</h3><small>Pergerakan KPI region pada periode aktif</small></div></div><div className="kpi-region-trend">{(dashboard?.trend??[]).map(p=>{const value=p[kpiMetricKey];return <div key={p.date} title={`${fmtDate(p.date)} • ${fmtPercent(value)}`}><strong>{value==null?'—':value.toFixed(1)}</strong><span><i style={{height:value==null?'0%':`${Math.max(2,Math.min(100,value))}%`}}/></span><small>{new Date(`${p.date}T00:00:00`).getDate()}</small></div>})}</div></article>
            </div>
            <article className="panel kpi-area-panel"><div className="panel-title kpi-area-title"><div><span>AREA COMPARISON</span><h3>KPI {kpiFunction} Performance by Area</h3><small>Perbandingan score KPI seluruh area pada periode aktif</small></div><div className="kpi-area-tools"><input className="table-search" type="search" placeholder="Cari area..." value={kpiAreaQuery} onChange={e=>setKpiAreaQuery(e.target.value)}/><select className="table-sort" value={kpiAreaSort} onChange={e=>setKpiAreaSort(e.target.value as typeof kpiAreaSort)}><option value="score-desc">Score tertinggi</option><option value="score-asc">Score terendah</option><option value="name">Nama area</option></select><span className="area-count">{kpiFilteredAreas.length} area</span></div></div><div className="table-wrap kpi-area-table"><table><thead><tr><th>No</th><th>Area</th><th>KPI {kpiFunction}</th><th>Status</th></tr></thead><tbody>{kpiFilteredAreas.length?kpiFilteredAreas.map((x,index)=><tr key={x.area.id} className="clickable-row" onClick={()=>{setKpiAreaId(x.area.id);setKpiBranchQuery('');setKpiBranchSort('score-desc')}}><td>{index+1}</td><td><strong>{x.area.name}</strong></td><td><strong>{fmtPercent(x.value)}</strong></td><td><span className={`kpi-health-chip ${x.value==null?'nodata':kpiTarget!=null&&x.value>=kpiTarget?'excellent':kpiTarget!=null&&x.value>=Math.max(0,kpiTarget-10)?'good':'review'}`}>{x.value==null?'No Data':kpiTarget!=null&&x.value>=kpiTarget?'Achieved':kpiTarget!=null&&x.value>=Math.max(0,kpiTarget-10)?'Near Target':'Need Review'}</span></td></tr>):<tr><td colSpan={4}>Tidak ada area sesuai pencarian.</td></tr>}</tbody></table></div></article></>}
            {kpiAreaId&&kpiSelectedArea&&<article className="panel kpi-branch-panel">{kpiSelectedBranch?(()=>{const b=kpiSelectedBranch;const target=kpiTarget??100;const gap=b.kpiScore==null?null:b.kpiScore-target;const daily=(b.trend??[]).map(p=>({date:p.date,value:p[kpiMetricKey]}));return <div className="kpi-gerai-detail"><div className="kpi-gerai-head"><div><span>GERAI KPI PERFORMANCE</span><h3>{b.name} — KPI {kpiFunction}</h3><small>{kpiSelectedArea.name} • {b.code||'—'} • {activeRange?.label??'Periode aktif'}</small></div><button className="back-scope" onClick={()=>{setKpiBranchDetailId(null);setKpiDailyDate(null)}}>← Kembali ke Daftar Gerai</button></div><div className="kpi-gerai-summary"><span><small>KPI {kpiFunction}</small><strong>{fmtPercent(b.kpiScore??null)}</strong><em className={gap!=null&&gap>=0?'good':'review'}>{gap==null?'—':`${gap>=0?'+':''}${gap.toFixed(2)} pp vs target`}</em></span><span><small>Target KPI</small><strong>{target.toFixed(1)}%</strong><em>Target fungsi {kpiFunction}</em></span><span><small>SLA</small><strong>{fmtPercent(b.sla??null)}</strong><em>Periode aktif</em></span><span><small>Productivity</small><strong>{fmtPercent(b.productivity??null)}</strong><em>Periode aktif</em></span><span><small>Penalty</small><strong>{fmtPercent(b.penalty??null)}</strong><em>Pengurang KPI</em></span></div><div className="kpi-performance-matrix"><div className="kpi-gerai-chart-title"><div><span>PERFORMANCE DETAIL</span><strong>KPI {kpiFunction} per Tanggal</strong></div><small>Terbaru → terlama</small></div><div className="table-wrap kpi-matrix-wrap"><table><thead><tr><th>KPI</th>{[...daily].sort((a,b)=>b.date.localeCompare(a.date)).map(d=><th key={d.date}><button type="button" className={kpiDailyDate===d.date?'selected':''} onClick={()=>setKpiDailyDate(d.date)}>{fmtDate(d.date)}</button></th>)}</tr></thead><tbody><tr className="kpi-matrix-total"><td><strong>KPI {kpiFunction}</strong><small>Target {target}%</small></td>{[...daily].sort((a,b)=>b.date.localeCompare(a.date)).map(d=><td key={d.date} className={d.value!=null&&d.value>=target?'good':'review'}>{fmtPercent(d.value)}</td>)}</tr>{(b.kpiDailyDetails??[]).map(k=><tr key={k.key}><td><strong>{k.label}</strong><small>{k.targetLabel}</small></td>{[...daily].sort((a,b)=>b.date.localeCompare(a.date)).map(d=>{const point=k.daily.find(x=>x.date===d.date);return <td key={d.date}>{fmtPercent(point?.actual??null)}</td>})}</tr>)}<tr><td><strong>Penalty</strong><small>Pengurang KPI</small></td>{[...daily].sort((a,b)=>b.date.localeCompare(a.date)).map(d=><td key={d.date}>{fmtPercent((b.penaltyDetails??[]).length?null:b.penalty??null)}</td>)}</tr></tbody></table></div></div>{kpiDailyDate&&(()=>{const day=daily.find(d=>d.date===kpiDailyDate);const details=(b.kpiDailyDetails??[]).map(k=>({key:k.key,label:k.label,targetLabel:k.targetLabel,day:k.daily.find(d=>d.date===kpiDailyDate)})).filter(x=>x.day);const dayGap=day?.value==null?null:day.value-target;return <div className="kpi-daily-detail"><div className="kpi-daily-detail-head"><div><span>DAILY KPI DETAIL</span><h4>{fmtDate(kpiDailyDate)} — KPI {kpiFunction}</h4><small>{b.name} • {kpiSelectedArea.name}</small></div><button className="back-scope" onClick={()=>setKpiDailyDate(null)}>Tutup Detail Hari</button></div><div className="kpi-daily-cards"><span><small>Actual KPI</small><strong>{fmtPercent(day?.value??null)}</strong></span><span><small>Target KPI</small><strong>{target.toFixed(1)}%</strong></span><span><small>Gap</small><strong className={dayGap!=null&&dayGap>=0?'good':'review'}>{dayGap==null?'—':`${dayGap>=0?'+':''}${dayGap.toFixed(2)} pp`}</strong></span><span><small>Status</small><strong>{day?.value==null?'No Data':day.value>=target?'Achieved':'Need Review'}</strong></span></div><div className="table-wrap kpi-daily-breakdown"><table><thead><tr><th>Komponen KPI</th><th>Actual</th><th>Target</th><th>Gap</th><th>Tier</th></tr></thead><tbody>{details.length?details.map(x=><tr key={x.key}><td><strong>{x.label}</strong></td><td>{fmtPercent(x.day!.actual)}</td><td>{x.day!.targetLabel}</td><td>{x.day!.gap==null?'—':`${x.day!.gap!>=0?'+':''}${x.day!.gap!.toFixed(2)} pp`}</td><td>{x.day!.tier||'—'}</td></tr>):<tr><td colSpan={5}>Detail komponen KPI pada tanggal ini belum tersedia.</td></tr>}</tbody></table></div></div>})()}</div>})():<><div className="panel-title kpi-branch-title"><div><span>AREA KPI PERFORMANCE</span><h3>{kpiSelectedArea.name} — KPI {kpiFunction}</h3><small>Daftar gerai {kpiFunction} dan score KPI pada periode aktif.</small></div><button className="back-scope" onClick={()=>{setKpiAreaId(null);setKpiBranchDetailId(null);setKpiBranchQuery('');setKpiBranchSort('score-desc')}}>← Kembali ke KPI Region</button></div><div className="kpi-branch-summary"><span><small>Gerai {kpiFunction}</small><strong>{kpiAreaBranches.length}</strong></span><span><small>Achieved</small><strong>{kpiBranchExcellent}</strong></span><span><small>Need Review</small><strong>{kpiBranchReview}</strong></span></div><div className="kpi-branch-tools"><input className="table-search" type="search" placeholder="Cari gerai..." value={kpiBranchQuery} onChange={e=>setKpiBranchQuery(e.target.value)}/><select className="table-sort" value={kpiBranchSort} onChange={e=>setKpiBranchSort(e.target.value as typeof kpiBranchSort)}><option value="score-desc">Score tertinggi</option><option value="score-asc">Score terendah</option><option value="name">Nama gerai</option></select><span className="area-count">{kpiFilteredBranches.length} gerai</span></div><div className="table-wrap kpi-branch-table"><table><thead><tr><th>No</th><th>Gerai</th><th>Kode</th><th>Kota/Kab.</th><th>KPI {kpiFunction}</th><th>Penalty</th><th>Status</th></tr></thead><tbody>{kpiFilteredBranches.length?kpiFilteredBranches.map((b,index)=><tr key={b.id} className="clickable-row" onClick={()=>{setKpiBranchDetailId(b.id);setKpiDailyDate(null)}}><td>{index+1}</td><td><strong>{b.name}</strong></td><td>{b.code||'—'}</td><td>{b.city}</td><td><strong>{fmtPercent(b.kpiScore??null)}</strong></td><td>{fmtPercent(b.penalty??null)}</td><td><span className={`kpi-health-chip ${b.kpiScore==null?'nodata':kpiTarget!=null&&b.kpiScore>=kpiTarget?'excellent':kpiTarget!=null&&b.kpiScore>=Math.max(0,kpiTarget-10)?'good':'review'}`}>{b.kpiScore==null?'No Data':kpiTarget!=null&&b.kpiScore>=kpiTarget?'Achieved':kpiTarget!=null&&b.kpiScore>=Math.max(0,kpiTarget-10)?'Near Target':'Need Review'}</span></td></tr>):<tr><td colSpan={7}>Tidak ada gerai {kpiFunction} pada area ini.</td></tr>}</tbody></table></div></>}</article>}
          </div>}
          {activeModule==='sla' && <div className="module-intro"><div><p className="eyebrow">SLA PERFORMANCE</p><h2>{slaBranchDetailId?'Detail Gerai':slaAreaId?'Area SLA Performance':'Service Level Performance'}</h2><small>{slaBranchDetailId?'Detail SLA harian gerai sesuai periode aktif.':slaAreaId?'Daftar gerai LM dan pencapaian SLA pada area terpilih.':'Monitoring pencapaian SLA dari region hingga area dan branch pada periode aktif.'}</small></div><span className="module-target">Target ≥ 98%</span></div>}
          {activeModule==='sla' && <div className="sla-module">
            {!slaAreaId && <>
            <div className="sla-summary-grid">
              <article className="metric-card sla-region-card"><div className="metric-card-head"><span>SLA Region</span><span className="metric-target">Target: 98%</span></div><strong>{fmtPercent(slaRegion)}</strong><div className="sla-region-context"><span className={slaRegionGap!=null&&slaRegionGap>=0?'good':'review'}>{slaRegionGap==null?'—':`${slaRegionGap>=0?'▲ +':'▼ '}${Math.abs(slaRegionGap).toFixed(2)} pp vs target`}</span><small>{activeRange?.label ?? 'Periode aktif'} • Central Java - DIY</small></div></article>
              <article className="metric-card sla-summary-card"><div className="metric-card-head"><span>Area Achieved</span><span className="metric-target">≥ 98%</span></div><strong>{slaAreaAchieved}<em> / {slaAreaTotal}</em></strong><div className="sla-summary-progress good"><i style={{width:`${slaAchievedShare}%`}}/></div><small>{slaAchievedShare.toFixed(1)}% area memenuhi target SLA</small></article>
              <article className="metric-card sla-summary-card"><div className="metric-card-head"><span>Area Need Review</span><span className="metric-target warning">&lt; 98%</span></div><strong>{slaAreaReview}<em> / {slaAreaTotal}</em></strong><div className="sla-summary-progress review"><i style={{width:`${slaReviewShare}%`}}/></div><small>{slaReviewShare.toFixed(1)}% area di bawah target SLA</small></article>
            </div>
            <div className="sla-analysis-grid">
              <article className="panel sla-trend-panel"><div className="panel-title"><div><span>SLA TREND</span><h3>Region Daily SLA</h3><small>Pergerakan SLA harian pada periode aktif</small></div><span className="module-target">Target ≥ 98%</span></div>
                {dashboard?.trend?.length ? <><div className="sla-trend-bars">{dashboard.trend.map(p=>{const v=p.sla;return <div className="sla-trend-col" key={p.date} title={`${fmtDate(p.date)}: ${fmtPercent(v)}`}><div className={`sla-trend-value ${v!=null&&v>=98?'good':'review'}`}>{v==null?'—':v.toFixed(1)}</div><div className="sla-trend-track"><span className="sla-target-line"/><i className={v!=null&&v>=98?'achieved':'review'} style={{height:v==null?'0%':`${Math.max(2,Math.min(100,v))}%`}}/></div><small>{new Date(`${p.date}T00:00:00`).getDate()}</small></div>})}</div><div className="sla-trend-legend"><span><i className="good"/>Achieved</span><span><i className="review"/>Need Review</span><span><i className="target"/>Target 98%</span></div></> : <div className="placeholder compact">Data SLA trend belum tersedia</div>}
              </article>
              <article className="panel sla-health-panel"><div className="panel-title"><div><span>SLA HEALTH</span><h3>Area Target Status</h3><small>Status pencapaian SLA seluruh area</small></div><span className="area-count">{slaAreaTotal} area</span></div><div className="sla-health-list"><div><span><i className="good"/>Achieved</span><strong>{slaAreaAchieved}</strong><em>{slaAchievedShare.toFixed(1)}%</em></div><div><span><i className="review"/>Need Review</span><strong>{slaAreaReview}</strong><em>{slaReviewShare.toFixed(1)}%</em></div><div><span><i/>No Data</span><strong>{slaAreaNoData}</strong><em>{slaAreaTotal?(slaAreaNoData/slaAreaTotal*100).toFixed(1):'0.0'}%</em></div></div></article>
            </div>
            {(()=>{const areas=[...(dashboard?.areas??[])];const reviewAreas=areas.filter(a=>a.sla!=null&&a.sla<98).sort((a,b)=>(a.sla??999)-(b.sla??999));const lmBranches=areas.flatMap(a=>(a.branches??[]).filter(b=>b.function==='LM').map(b=>({...b,areaName:a.name,areaId:a.id})));const reviewLm=lmBranches.filter(b=>b.sla!=null&&b.sla<98).sort((a,b)=>(a.sla??999)-(b.sla??999));const declining=lmBranches.filter(b=>b.sla!=null&&b.slaPrevious!=null&&b.sla<b.slaPrevious).sort((a,b)=>(a.sla!-a.slaPrevious!)-(b.sla!-b.slaPrevious!));return <div className="sla-priority-grid">
              <article className="panel sla-priority-panel"><div className="panel-title"><div><span>PRIORITY ATTENTION</span><h3>Area Below Target</h3><small>Area dengan gap SLA terbesar terhadap target 98%</small></div><span className="branch-panel-count">{reviewAreas.length} area</span></div><div className="sla-priority-list">{reviewAreas.slice(0,5).map((a,i)=><button key={a.id} onClick={()=>{setSlaAreaId(a.id);setSlaBranchDetailId(null);setSlaBranchQuery('');setSlaBranchStatus('REVIEW')}}><b>{i+1}</b><span><strong>{a.name}</strong><small>{a.slaPrevious==null?'Pembanding belum tersedia':`Bulan lalu ${fmtPercent(a.slaPrevious)}`}</small></span><em>{fmtPercent(a.sla)}</em><i>{a.sla==null?'—':`${(a.sla-98).toFixed(2)} pp`}</i></button>)}{!reviewAreas.length&&<div className="sla-priority-empty">Semua area memenuhi target SLA.</div>}</div></article>
              <article className="panel sla-priority-panel"><div className="panel-title"><div><span>LM ATTENTION</span><h3>Gerai LM Need Review</h3><small>Gerai LM dengan SLA terendah pada periode aktif</small></div><span className="branch-panel-count">{reviewLm.length} gerai</span></div><div className="sla-priority-list">{reviewLm.slice(0,5).map((b,i)=><button className="sla-priority-row" key={b.id} onClick={()=>{setSlaAreaId(b.areaId);setSlaBranchDetailId(null);setSlaBranchQuery(b.name);setSlaBranchStatus('REVIEW')}}><b>{i+1}</b><span><strong>{b.name}</strong><small>{b.areaName}</small></span><em>{fmtPercent(b.sla??null)}</em><i>{b.sla==null?'—':`${(b.sla-98).toFixed(2)} pp`}</i></button>)}{!reviewLm.length&&<div className="sla-priority-empty">Semua gerai LM memenuhi target SLA.</div>}</div></article>
              <article className="panel sla-movement-panel"><div className="panel-title"><div><span>PERFORMANCE MOVEMENT</span><h3>Largest LM Decline</h3><small>Penurunan terbesar dibanding periode bulan sebelumnya</small></div><span className="branch-panel-count">{declining.length} turun</span></div><div className="sla-movement-list">{declining.slice(0,4).map(b=><button key={b.id} onClick={()=>{setSlaAreaId(b.areaId);setSlaBranchDetailId(null);setSlaBranchQuery(b.name);setSlaBranchStatus('ALL')}}><span><strong>{b.name}</strong><small>{b.areaName}</small></span><em>▼ {Math.abs((b.sla??0)-(b.slaPrevious??0)).toFixed(2)} pp</em></button>)}{!declining.length&&<div className="sla-priority-empty">Tidak ada penurunan pada data pembanding.</div>}</div></article>
            </div>})()}
            <article className="panel sla-area-panel"><div className="panel-title sla-area-title"><div><span>AREA COMPARISON</span><h3>SLA Performance by Area</h3><small>Klik area untuk membuka detail SLA branch / gerai</small></div><div className="sla-area-tools"><input className="table-search" type="search" placeholder="Cari area..." value={slaAreaQuery} onChange={e=>setSlaAreaQuery(e.target.value)}/><select className="table-sort" value={slaAreaSort} onChange={e=>setSlaAreaSort(e.target.value as typeof slaAreaSort)}><option value="sla-desc">SLA tertinggi</option><option value="sla-asc">SLA terendah</option><option value="decline">Penurunan terbesar</option></select><div className="sla-status-filter">{(['ALL','ACHIEVED','REVIEW'] as const).map(status=><button key={status} className={slaStatusFilter===status?'active':''} onClick={()=>setSlaStatusFilter(status)}>{status==='ALL'?'Semua':status==='ACHIEVED'?'Achieved':'Need Review'}</button>)}</div><span className="area-count">{slaFilteredAreas.length} area</span></div></div>
              <div className="table-wrap sla-area-table"><table><thead><tr><th>No</th><th>Area</th><th>SLA Aktif</th><th>SLA Bulan Lalu</th><th>Perubahan</th><th>Target</th><th>Gap</th><th>Status</th></tr></thead><tbody>{slaFilteredAreas.length?slaFilteredAreas.map((area,index)=>{const gap=area.sla==null?null:area.sla-98;return <tr key={area.id} className="clickable-row" onClick={()=>{setSlaAreaId(area.id);setSlaBranchDetailId(null);setSlaBranchQuery('');setSlaBranchStatus('ALL');setSlaBranchSort('sla-desc')}}><td>{index+1}</td><td><strong>{area.name}</strong></td><td className={area.sla!=null&&area.sla>=98?'metric-good':''}><strong>{fmtPercent(area.sla)}</strong></td><td>{fmtPercent(area.slaPrevious??null)}</td><td className={area.sla!=null&&area.slaPrevious!=null&&area.sla>=area.slaPrevious?'sla-gap-good':'sla-gap-review'}>{area.sla==null||area.slaPrevious==null?'—':`${area.sla-area.slaPrevious>=0?'▲ +':'▼ '}${Math.abs(area.sla-area.slaPrevious).toFixed(2)} pp`}</td><td>98.00%</td><td className={gap!=null&&gap>=0?'sla-gap-good':'sla-gap-review'}>{gap==null?'—':`${gap>=0?'+':''}${gap.toFixed(2)} pp`}</td><td><span className={`sla-status ${area.sla!=null&&area.sla>=98?'good':'review'}`}>{area.sla==null?'No Data':area.sla>=98?'Achieved':'Need Review'}</span></td></tr>}):<tr><td colSpan={8}>Tidak ada area sesuai filter SLA.</td></tr>}</tbody></table></div>
            </article>
            </>}
            {slaAreaId && (()=>{const area=dashboard?.areas?.find(a=>a.id===slaAreaId);if(!area)return null;const allBranches=[...(area.branches??[])].filter(b=>b.function==='LM').sort((a,b)=>(b.sla??-1)-(a.sla??-1));const achieved=allBranches.filter(b=>b.sla!=null&&b.sla>=98).length;const review=allBranches.filter(b=>b.sla!=null&&b.sla<98).length;const branches=allBranches.filter(b=>(!slaBranchQuery.trim()||`${b.name} ${b.code}`.toLowerCase().includes(slaBranchQuery.trim().toLowerCase()))&&(slaBranchStatus==='ALL'||(slaBranchStatus==='ACHIEVED'?b.sla!=null&&b.sla>=98:b.sla!=null&&b.sla<98))).sort((a,b)=>slaBranchSort==='sla-asc'?(a.sla??999)-(b.sla??999):slaBranchSort==='decline'?((a.sla??0)-(a.slaPrevious??a.sla??0))-((b.sla??0)-(b.slaPrevious??b.sla??0)):(b.sla??-1)-(a.sla??-1));const detailBranch=slaBranchDetailId?allBranches.find(b=>b.id===slaBranchDetailId):null;
return <article className="panel sla-branch-panel">{detailBranch?(()=>{const branch=detailBranch;const daily=[...(branch.trend??[])].filter(p=>p.date>=(dashboard?.range?.start??'')&&p.date<=(dashboard?.range?.end??'')).sort((a,b)=>a.date.localeCompare(b.date));const valid=daily.filter(p=>p.sla!=null);const achievedDays=valid.filter(p=>(p.sla??0)>=98).length;const reviewDays=valid.length-achievedDays;return <div className="sla-branch-detail-page"><div className="sla-daily-head"><div><span>GERAI DETAIL</span><h3>{branch.name} — SLA Performance</h3><small>{area.name} • {branch.code} • {dashboard?.range?.label??'Periode aktif'} • {fmtDate(dashboard?.range?.start??'')}–{fmtDate(dashboard?.range?.end??'')}</small></div><button className="back-scope" onClick={()=>setSlaBranchDetailId(null)}>← Kembali ke Daftar Gerai</button></div><div className="sla-daily-summary"><span><small>SLA Gerai</small><strong>{fmtPercent(branch.sla??null)}</strong></span><span><small>Hari Achieved</small><strong>{achievedDays}</strong><em>dari {valid.length} hari</em></span><span><small>Hari Need Review</small><strong>{reviewDays}</strong><em>dari {valid.length} hari</em></span></div><div className="sla-daily-layout"><div className="sla-daily-chart"><div className="sla-daily-chart-title"><strong>Trend SLA Harian</strong><small>Target ≥ 98%</small></div>{daily.length?<><div className="sla-daily-bars">{daily.map(point=><div className="sla-daily-bar-col" key={point.date} title={`${fmtDate(point.date)} • ${fmtPercent(point.sla)}`}><div className="sla-daily-bar-value">{point.sla==null?'—':point.sla.toFixed(1)}</div><div className="sla-daily-bar-track"><span/><i className={point.sla!=null&&point.sla>=98?'good':'review'} style={{height:point.sla==null?'0%':`${Math.max(2,Math.min(100,point.sla))}%`}}/></div><small>{new Date(`${point.date}T00:00:00`).getDate()}</small></div>)}</div><div className="sla-trend-legend"><span><i className="good"/>Achieved</span><span><i className="review"/>Need Review</span><span><i className="target"/>Target 98%</span></div></>:<div className="placeholder compact">Data SLA harian belum tersedia</div>}</div><div className="table-wrap sla-daily-table"><table><thead><tr><th>No</th><th>Tanggal</th><th>SLA</th><th>Target</th><th>Gap</th><th>Status</th></tr></thead><tbody>{daily.length?daily.map((point,index)=>{const gap=point.sla==null?null:point.sla-98;return <tr key={point.date}><td>{index+1}</td><td><strong>{fmtDate(point.date)}</strong></td><td><strong>{fmtPercent(point.sla)}</strong></td><td>98.00%</td><td className={gap!=null&&gap>=0?'sla-gap-good':'sla-gap-review'}>{gap==null?'—':`${gap>=0?'+':''}${gap.toFixed(2)} pp`}</td><td><span className={`sla-status ${point.sla!=null&&point.sla>=98?'good':'review'}`}>{point.sla==null?'No Data':point.sla>=98?'Achieved':'Need Review'}</span></td></tr>}):<tr><td colSpan={6}>Tidak ada data SLA harian pada periode filter aktif.</td></tr>}</tbody></table></div></div></div>})():<><div className="panel-title sla-branch-title"><div><span>AREA DRILL-DOWN</span><h3>{area.name} — Branch SLA</h3><small>{achieved} dari {allBranches.length} gerai LM memenuhi target SLA</small></div><button className="back-scope" onClick={()=>{setSlaAreaId(null);setSlaBranchQuery('');setSlaBranchStatus('ALL');setSlaBranchSort('sla-desc');setSlaBranchDetailId(null)}}>Tutup Detail</button></div><div className="sla-branch-summary"><span><small>SLA Area</small><strong>{fmtPercent(area.sla)}</strong></span><span><small>Achieved</small><strong>{achieved}</strong><em>{allBranches.length?(achieved/allBranches.length*100).toFixed(1):'0.0'}%</em></span><span><small>Need Review</small><strong>{review}</strong><em>{allBranches.length?(review/allBranches.length*100).toFixed(1):'0.0'}%</em></span></div><div className="sla-branch-tools"><input className="table-search" type="search" placeholder="Cari branch / kode..." value={slaBranchQuery} onChange={e=>setSlaBranchQuery(e.target.value)}/><select className="table-sort" value={slaBranchSort} onChange={e=>setSlaBranchSort(e.target.value as typeof slaBranchSort)}><option value="sla-desc">SLA tertinggi</option><option value="sla-asc">SLA terendah</option><option value="decline">Penurunan terbesar</option></select><div className="sla-status-filter">{(['ALL','ACHIEVED','REVIEW'] as const).map(status=><button key={status} className={slaBranchStatus===status?'active':''} onClick={()=>setSlaBranchStatus(status)}>{status==='ALL'?'Semua':status==='ACHIEVED'?'Achieved':'Need Review'}</button>)}</div><span className="area-count">{branches.length} gerai</span></div><div className="table-wrap sla-branch-table"><table><thead><tr><th>No</th><th>Branch / Gerai</th><th>Fungsi</th><th>SLA Aktif</th><th>SLA Bulan Lalu</th><th>Perubahan</th><th>Target</th><th>Gap</th><th>Status</th></tr></thead><tbody>{branches.length?branches.map((branch,index)=>{const gap=branch.sla==null?null:branch.sla-98;return <tr key={branch.id} className="clickable-row" onClick={()=>setSlaBranchDetailId(branch.id)}><td>{index+1}</td><td><div className="sla-branch-name"><strong>{branch.name}</strong><small>{branch.code}</small></div></td><td><span className="branch-function-chip">{branch.function}</span></td><td><strong>{fmtPercent(branch.sla??null)}</strong></td><td>{fmtPercent(branch.slaPrevious??null)}</td><td className={branch.sla!=null&&branch.slaPrevious!=null&&branch.sla>=branch.slaPrevious?'sla-gap-good':'sla-gap-review'}>{branch.sla==null||branch.slaPrevious==null?'—':`${branch.sla-branch.slaPrevious>=0?'▲ +':'▼ '}${Math.abs(branch.sla-branch.slaPrevious).toFixed(2)} pp`}</td><td>98.00%</td><td className={gap!=null&&gap>=0?'sla-gap-good':'sla-gap-review'}>{gap==null?'—':`${gap>=0?'+':''}${gap.toFixed(2)} pp`}</td><td><span className={`sla-status ${branch.sla!=null&&branch.sla>=98?'good':'review'}`}>{branch.sla==null?'No Data':branch.sla>=98?'Achieved':'Need Review'}</span></td></tr>}):<tr><td colSpan={9}>Tidak ada gerai sesuai pencarian / filter SLA.</td></tr>}</tbody></table></div></>}</article>})()}
          </div>}
          <div className={activeModule==='control'?'':'module-hidden'}>
          <div className="section-heading">
            <div className="scope-heading"><p className="eyebrow">{selectedKpi ? 'KPI PERFORMANCE DETAIL' : selectedBranch ? 'BRANCH PERFORMANCE' : selectedArea ? 'AREA PERFORMANCE' : 'EXECUTIVE OVERVIEW'}</p><h2>{selectedKpi ? selectedKpi.label : selectedBranch ? selectedBranch.name : selectedArea ? selectedArea.name : 'Control Tower Performance Summary'}</h2>{selectedKpi ? <button className="back-scope" onClick={()=>setSelectedKpiKey(null)}>← Kembali ke Branch</button> : selectedBranch ? <button className="back-scope" onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null)}}>← Kembali ke Area</button> : selectedArea && <button className="back-scope" onClick={()=>setSelectedAreaId(null)}>← Kembali ke Region</button>}</div>
            <span className="freshness" title="Tanggal data terbaru yang tersedia"><i></i>{error ? `Error: ${error}` : loading ? 'Memuat data...' : `Data Freshness: ${fmtDate(freshDate)}`}{!error&&!loading&&<b>Live</b>}</span>
          </div>

          {!selectedKpi && <div className="metric-grid">
            {visibleCards.length ? visibleCards.map(metric => (
              <article className={`metric-card ${metric.key === 'penalty' ? 'metric-card-penalty' : ''}`} key={metric.key}>
                {(()=>{const target=cardTargets[metric.key];const achieved=metric.value!=null&&target?(target.direction==='HIGHER'?metric.value>=target.value:metric.value<=target.value):false;const progress=metric.value==null?0:target?(target.direction==='HIGHER'?Math.min(100,(metric.value/target.value)*100):Math.min(100,(target.value/Math.max(metric.value,.001))*100)):Math.min(100,metric.value);return <>
                  <div className="metric-card-head"><span>{metric.label}</span>{target&&<span className={`metric-target ${metric.key==='penalty'?'warning':''}`}>Target: {target.label}</span>}</div>
                  <strong>{fmtPercent(metric.value)}</strong>
                  <div className={`metric-progress ${achieved?'achieved':'review'}`}><i style={{width:`${progress}%`}}/></div>
                  <div className="metric-card-foot"><small>{activeRange ? `${activeRange.label} ${new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(activeRange.end+'T00:00:00'))}` : 'Periode aktif'}</small><span className={achieved?'status-achieved':'status-review'}>{metric.value==null?'—':achieved?'↗ Achieved':'↘ Needs Review'}</span></div>
                </>})()}
              </article>
            )) : ['SLA Performance','KPI LM','KPI FM','KPI MM'].map(label => (
              <article className="metric-card" key={label}><span>{label}</span><strong>—</strong><small>{error || 'Memuat data...'}</small></article>
            ))}
          </div>}

          <div className="dashboard-grid">
            {!selectedKpi && <article className={`panel wide performance-trend-panel ${selectedArea ? 'scope-wide' : ''}`}><div className="panel-title"><div><span>PERFORMANCE TREND</span><h3>{selectedBranch ? `KPI ${selectedBranch.function} — ${selectedBranch.name}` : selectedArea ? `${selectedArea.name} Trend` : 'Region Trend'}</h3><small>{selectedBranch ? 'Performa KPI fungsi unit terpilih' : selectedArea ? 'Performa harian area pada periode aktif' : 'Performa harian seluruh region pada periode aktif'}</small></div>{!selectedBranch && <select className="trend-select" value={trendMetric} onChange={e=>setTrendMetric(e.target.value as typeof trendMetric)}><option value="sla">SLA</option><option value="kpiLm">KPI LM</option><option value="kpiFm">KPI FM</option><option value="kpiMm">KPI MM</option></select>}</div>
              {trend.length ? <div className="trend-chart-shell">
                <div className="trend-plot" aria-label={`${selectedBranch ? `KPI ${selectedBranch.function}` : trendLabels[trendMetric]} daily trend`}>
                  <div className="trend-y-label y100">100%</div><div className="trend-y-label y75">75%</div><div className="trend-y-label y50">50%</div><div className="trend-y-label y25">25%</div><div className="trend-y-label y0">0%</div>
                  <div className="trend-grid-line grid100"/><div className="trend-grid-line grid75"/><div className="trend-grid-line grid50"/><div className="trend-grid-line grid25"/><div className="trend-grid-line grid0"/>
                  <div className="trend-target-scale"><div className="trend-target-line" style={{bottom:`${trendTarget}%`}}><span>Target {trendTarget}%</span></div></div>
                  <div className="trend-bars">{trend.map(point=>{const value=point[activeTrendMetric];const achieved=value!=null&&value>=trendTarget;const height=value==null?0:Math.max(2,Math.min(100,value));return <div className="trend-column" key={point.date} title={`${fmtDate(point.date)}: ${fmtPercent(value)}`}><div className="trend-track">{value!=null&&<div className="trend-value" style={{bottom:`calc(${height}% + 4px)`}}>{value.toFixed(0)}</div>}<div className={`trend-bar ${achieved?'trend-achieved':'trend-below'}`} style={{height:`${height}%`}}/></div><small>{new Date(`${point.date}T00:00:00`).getDate()}</small></div>})}</div>
                </div>
                <div className="trend-legend"><span><i className="legend-good"/>Target tercapai</span><span><i className="legend-review"/>Di bawah target</span><span><i className="legend-target"/>Target ({trendTarget}%)</span></div>
              </div> : <div className="placeholder">Data trend belum tersedia</div>}
            </article>}
            {!selectedArea && !selectedBranch && !selectedKpi && <article className="panel performance-health-panel"><div className="panel-title"><div><span>REGION HEALTH</span><h3>Performance Health</h3><small>Distribusi status seluruh area pada periode aktif</small></div><span className="health-scope-chip">{dashboard?.areas?.length ?? 0} area</span></div>
              <div className="health-list">
                {['Excellent','Good','Fair','Bad','Unsatisfactory'].map(status=>{const count=healthCounts[status]||0;const meta=healthMeta[status];const share=(count/healthTotal)*100;return <div className={`health-row health-${meta.tone}`} key={status}><span className="health-name"><i/>{meta.label} <small>({status})</small></span><span className="health-share"><i style={{width:`${share}%`}}/></span><span className="health-stat"><strong>{count}</strong><small>area</small><b>{share.toFixed(1)}%</b></span></div>})}
              </div>
              <div className="penalty-block"><div className="penalty-block-head"><span>PENGURANG KPI REGION</span><small>Terpisah dari KPI Score</small></div><div className="penalty-grid">
                <div><small>LM</small><strong>{fmtPercent(penalties?.lm ?? null)}</strong></div>
                <div><small>FM</small><strong>{fmtPercent(penalties?.fm ?? null)}</strong></div>
                <div><small>MM</small><strong>{fmtPercent(penalties?.mm ?? null)}</strong></div>
              </div></div>
            </article>}
            {!selectedArea && !selectedBranch && <article className="panel full area-comparison"><div className="panel-title"><div><span>PERBANDINGAN KINERJA AREA</span><h3>Area Performance Comparison</h3><small>Daftar kinerja area di wilayah Central Java – DIY</small></div><div className="area-table-tools"><input className="table-search" type="search" placeholder="Cari area..." value={areaQuery} onChange={e=>setAreaQuery(e.target.value)}/><select className="table-sort" value={areaSort} onChange={e=>setAreaSort(e.target.value as typeof areaSort)}><option value="name">Nama Area</option><option value="sla">SLA tertinggi</option><option value="lm">KPI LM tertinggi</option><option value="fm">KPI FM tertinggi</option><option value="mm">KPI MM tertinggi</option></select><span className="area-count">{filteredAreas.length} area</span></div></div><div className="table-wrap area-performance-table"><table><thead><tr><th>No</th><th>Nama Area</th><th>SLA (≥ 98%)</th><th>KPI Last Mile</th><th>KPI First Mile</th><th>KPI Middle Mile</th><th>Productivity</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filteredAreas.length ? filteredAreas.map((area,index) => (
               <tr key={area.id} className="clickable-row" onClick={()=>setSelectedAreaId(area.id)}>
                 <td>{index+1}</td><td><strong>{area.name}</strong></td><td className={area.sla!=null&&area.sla>=98?'metric-good':''}>{fmtPercent(area.sla)}</td><td>{fmtPercent(area.kpiLm)}</td>
                 <td>{fmtPercent(area.kpiFm)}</td><td>{fmtPercent(area.kpiMm)}</td>
                 <td>{fmtPercent(area.productivity)}</td><td><span className={`status-pill status-${area.status.toLowerCase()}`}>{area.status}</span></td>
                 <td><button className="open-area-btn" onClick={(e)=>{e.stopPropagation();setSelectedAreaId(area.id)}}>Detail →</button></td>
               </tr>
             )) : <tr><td colSpan={9}>{error || 'Memuat data sumber...'}</td></tr>}</tbody></table></div></article>}
            {selectedBranch && !selectedKpi && <article className="panel full"><div className="panel-title"><div><span>OPERATIONAL DRIVERS</span><h3>Branch Operations</h3><small>Ringkasan operasional periode aktif dibanding periode sebelumnya</small></div><span className="branch-function-chip">{selectedBranch.function}</span></div>
              <div className="driver-grid">
                <button className="driver-card" onClick={()=>setSelectedDriver('volume')}><span>Volume</span><strong>{selectedBranch.operations?.volume?.toLocaleString('id-ID') ?? '—'}</strong><small>Paket periode aktif {(()=>{const prev=selectedBranch.operations?.comparison?.volume;const current=selectedBranch.operations?.volume;const delta=prev&&current!=null?(current-prev)/prev*100:null;return <em className={`driver-compare ${delta==null?'neutral':delta===0?'neutral':delta>0?'good':'review'}`}>{delta==null?'—':`${delta===0?'→':delta>0?'↗':'↘'} ${Math.abs(delta).toFixed(1)}% vs ${fmtMonth(selectedBranch.operations?.comparison?.label)}`}</em>})()}</small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('backlog')}><span>Backlog</span><strong>{selectedBranch.operations?.backlog?.toLocaleString('id-ID') ?? '—'}</strong><small>{fmtPercent(selectedBranch.operations?.backlogRate ?? null)} backlog rate {(()=>{const prev=selectedBranch.operations?.comparison?.backlogRate;const current=selectedBranch.operations?.backlogRate;const delta=prev!=null&&current!=null?current-prev:null;return <em className={`driver-compare ${delta==null||delta===0?'neutral':delta<0?'good':'review'}`}>{delta==null?'—':`${delta===0?'→':delta<0?'↘':'↗'} ${Math.abs(delta).toFixed(2)} pp vs ${fmtMonth(selectedBranch.operations?.comparison?.label)}`}</em>})()}</small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('failedDelivery')}><span>Failed Delivery</span><strong>{selectedBranch.operations?.failedDelivery?.toLocaleString('id-ID') ?? '—'}</strong><small>{fmtPercent(selectedBranch.operations?.failedDeliveryRate ?? null)} failed delivery rate {(()=>{const prev=selectedBranch.operations?.comparison?.failedDeliveryRate;const current=selectedBranch.operations?.failedDeliveryRate;const delta=prev!=null&&current!=null?current-prev:null;return <em className={`driver-compare ${delta==null||delta===0?'neutral':delta<0?'good':'review'}`}>{delta==null?'—':`${delta===0?'→':delta<0?'↘':'↗'} ${Math.abs(delta).toFixed(2)} pp vs ${fmtMonth(selectedBranch.operations?.comparison?.label)}`}</em>})()}</small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('codTransfer')}><span>COD Transfer</span><strong>{selectedBranch.operations?.codTransfer?.toLocaleString('id-ID') ?? '—'}</strong><small>{fmtPercent(selectedBranch.operations?.codTransferRate ?? null)} transferred rate {(()=>{const prev=selectedBranch.operations?.comparison?.codTransferRate;const current=selectedBranch.operations?.codTransferRate;const delta=prev!=null&&current!=null?current-prev:null;return <em className={`driver-compare ${delta==null||delta===0?'neutral':delta>0?'good':'review'}`}>{delta==null?'—':`${delta===0?'→':delta>0?'↗':'↘'} ${Math.abs(delta).toFixed(2)} pp vs ${fmtMonth(selectedBranch.operations?.comparison?.label)}`}</em>})()}</small></button>
              </div>
            </article>}
            {selectedDriver && selectedBranch && !selectedKpi && <article className="panel full operational-detail-panel"><div className="panel-title"><div><span>OPERATIONAL DETAIL</span><h3>{driverLabels[selectedDriver]} — Daily Trend</h3><small>Pergerakan harian berdasarkan periode aktif</small></div><div className="operational-detail-actions"><span className="branch-function-chip">{selectedBranch.function}</span><button className="back-scope" onClick={()=>setSelectedDriver(null)}>Tutup Detail</button></div></div>
              <div className="driver-trend">{driverDaily.map(day=><div className="driver-trend-col" key={day.date} title={`${fmtDate(day.date)}: ${day[selectedDriver].toLocaleString('id-ID')}`}><strong>{day[selectedDriver].toLocaleString('id-ID')}</strong><div className="driver-trend-track"><div className="driver-trend-bar" style={{height:`${Math.max(2,(day[selectedDriver]/driverMax)*100)}%`}}/></div><small>{new Date(`${day.date}T00:00:00`).getDate()}</small></div>)}</div>
              <div className="operational-daily-head"><div><strong>Daily Detail</strong><small>Nilai aktual {driverLabels[selectedDriver].toLowerCase()} per tanggal</small></div><span>{driverDaily.length} hari</span></div><div className="table-wrap operational-daily-table"><table><thead><tr><th>Tanggal</th><th>{driverLabels[selectedDriver]}</th></tr></thead><tbody>{driverDaily.map(day=><tr key={day.date}><td><strong>{fmtDate(day.date)}</strong></td><td><strong>{day[selectedDriver].toLocaleString('id-ID')}</strong></td></tr>)}</tbody></table></div>
            </article>}
            {selectedBranch && !selectedKpi && <article className="panel full branch-kpi-panel"><div className="panel-title"><div><span>KPI PERFORMANCE</span><h3>KPI {selectedBranch.function} Breakdown</h3><small>Klik indikator untuk membuka performa harian</small></div><div className="branch-panel-meta"><span className="branch-function-chip">{selectedBranch.function}</span><span className="branch-panel-count">{selectedBranch.kpiDetails?.length ?? 0} KPI</span></div></div>
              <div className="table-wrap kpi-breakdown-table"><table><thead><tr><th>KPI</th><th>Actual</th><th>Target T1</th><th>Tier</th><th>Weight</th><th>Score</th><th>Aksi</th></tr></thead><tbody>
                {selectedBranch.kpiDetails?.length ? selectedBranch.kpiDetails.map(kpi=><tr key={kpi.key} className="clickable-row" onClick={()=>setSelectedKpiKey(kpi.key)}><td><strong>{kpi.label}</strong></td><td>{fmtPercent(kpi.actual)}</td><td>{kpi.targetLabel}</td><td><span className={`tier-badge tier-${kpi.tier.toLowerCase()}`}>{kpi.tier}</span></td><td>{kpi.weight}%</td><td><strong>{kpi.score.toFixed(1)}</strong></td><td><button className="detail-row-btn" onClick={(e)=>{e.stopPropagation();setSelectedKpiKey(kpi.key)}}>Detail →</button></td></tr>) : <tr><td colSpan={7}>Detail KPI belum tersedia untuk unit ini.</td></tr>}
              </tbody></table></div>
            </article>}
            {selectedKpi && <article className="panel full kpi-detail-panel">
              <div className="panel-title">
                <div><span>KPI DETAIL</span><h3>{selectedKpi.label} — Daily Performance</h3><small>Actual harian dibandingkan dengan target T1 pada periode aktif</small></div>
                <div className="kpi-detail-actions"><span className="branch-function-chip">{selectedBranch?.function}</span><button className="back-scope" onClick={()=>setSelectedKpiKey(null)}>← KPI Summary</button></div>
              </div>
              <div className="kpi-detail-chart-wrap">
                <div className="kpi-detail-chart" aria-label={`${selectedKpi.label} daily chart`}>
                  {selectedKpi.daily.map(day=>{const achieved=day.gap!=null&&day.gap>=0;return <div className="kpi-detail-col" key={day.date} title={`${fmtDate(day.date)}: ${fmtPercent(day.actual)}`}><div className={`kpi-detail-value ${achieved?'value-good':'value-review'}`}>{day.actual==null?'—':day.actual.toFixed(1)}</div><div className="kpi-detail-track"><div className="kpi-target-line" style={{bottom:`${Math.min(100,(day.target/kpiTrendMax)*100)}%`}}/><div className={`kpi-detail-bar ${achieved?'bar-good':'bar-review'}`} style={{height:day.actual==null?'0%':`${Math.max(2,(day.actual/kpiTrendMax)*100)}%`}}/></div><small>{new Date(`${day.date}T00:00:00`).getDate()}</small></div>})}
                </div>
                <div className="kpi-chart-legend"><span><i className="legend-good"/>Target tercapai</span><span><i className="legend-review"/>Perlu review</span><span><i className="legend-target"/>Target T1 ({selectedKpi.targetLabel})</span></div>
              </div>
              <div className="kpi-daily-table-head"><div><strong>Daily Detail</strong><small>Numerator, denominator, actual, gap dan tier per tanggal</small></div><span>{selectedKpi.daily.length} hari</span></div>
              <div className="table-wrap kpi-daily-table"><table><thead><tr><th>Tanggal</th><th className="num-col">Numerator</th><th className="num-col">Denominator</th><th className="num-col">Actual</th><th className="num-col">Target</th><th className="num-col">Gap</th><th className="tier-col">Tier</th></tr></thead><tbody>
                {selectedKpi.daily.map(day=>{const achieved=day.gap!=null&&day.gap>=0;return <tr key={day.date}><td><strong>{fmtDate(day.date)}</strong></td><td className="num-col">{day.numerator.toLocaleString('id-ID')}</td><td className="num-col">{day.denominator.toLocaleString('id-ID')}</td><td className={`num-col daily-actual ${achieved?'actual-good':'actual-review'}`}><strong>{fmtPercent(day.actual)}</strong></td><td className="num-col">{day.targetLabel}</td><td className={`num-col daily-gap ${achieved?'gap-good':'gap-review'}`}>{day.gap==null?'—':`${day.gap>=0?'+':''}${day.gap.toFixed(2)}%`}</td><td className="tier-col"><span className={`tier-badge tier-${day.tier.toLowerCase()}`}>{day.tier}</span></td></tr>})}
              </tbody></table></div>
            </article>}
            {selectedBranch && !selectedKpi && <article className="panel full branch-penalty-panel"><div className="panel-title"><div><span>PENGURANG KPI</span><h3>Penalty Breakdown</h3><small>Indikator pengurang KPI untuk {selectedBranch.function} pada periode aktif</small></div><div className="branch-panel-meta"><span className="branch-panel-count">{selectedBranch.penaltyDetails?.length ?? 0} indikator</span><div className="penalty-total-card"><small>Total Penalty</small><strong>{fmtPercent(selectedBranch.penalty ?? null)}</strong></div></div></div>
              <div className="table-wrap penalty-detail-table"><table><thead><tr><th>Indicator</th><th>Actual</th><th>Target T1</th><th>Tier</th><th>Max Penalty</th><th>Penalty</th></tr></thead><tbody>
                {selectedBranch.penaltyDetails?.length ? selectedBranch.penaltyDetails.map(item=><tr key={item.key}><td><strong>{item.label}</strong></td><td>{fmtPercent(item.actual)}</td><td>{item.targetLabel}</td><td><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span></td><td>{item.maxPenalty}%</td><td><strong>{item.penalty.toFixed(1)}</strong></td></tr>) : <tr><td colSpan={6}>Penalty detail belum tersedia untuk unit ini.</td></tr>}
              </tbody></table></div>
            </article>}
            {selectedArea && !selectedBranch && <article className="panel full branch-directory-panel"><div className="panel-title branch-directory-title"><div><span>BRANCH / GERAI</span><h3>Branch Directory</h3><small>Pilih unit untuk membuka Branch Command Center</small></div><div className="branch-directory-tools"><input className="table-search branch-search" type="search" placeholder="Cari branch / kode..." value={branchQuery} onChange={e=>setBranchQuery(e.target.value)}/><span className="branch-filter-label">Filter Fungsi</span><div className="branch-function-filter">{(['ALL','LM','FM','MM'] as const).map(fn=><button key={fn} className={branchFunctionFilter===fn?'active':''} onClick={()=>setBranchFunctionFilter(fn)}>{fn==='ALL'?'Semua':fn}</button>)}</div><span className="branch-count">{filteredBranches.length} unit</span></div></div>
              <div className="table-wrap branch-directory-table"><table><thead><tr><th>Kode</th><th>Branch / Gerai</th><th>Fungsi</th><th>Kab/Kota</th><th>Aksi</th></tr></thead><tbody>
                {filteredBranches.length ? filteredBranches.map(branch=><tr key={branch.id} className="clickable-row" onClick={()=>setSelectedBranchId(branch.id)}><td>{branch.code}</td><td><strong>{branch.name}</strong></td><td><span className="branch-function-chip">{branch.function}</span></td><td>{branch.city}</td><td><button className="detail-row-btn" onClick={(e)=>{e.stopPropagation();setSelectedBranchId(branch.id)}}>Detail →</button></td></tr>) : <tr><td colSpan={5}>Tidak ada unit {branchFunctionFilter==='ALL'?'':branchFunctionFilter} di area ini.</td></tr>}
              </tbody></table></div>
            </article>}
          </div>
          </div>
        </section>
      </main>
    </div>
  );
}