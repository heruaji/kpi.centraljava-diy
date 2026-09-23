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
  const [activeModule, setActiveModule] = useState<'control'|'sla'>('control');
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
  const filteredBranches = selectedArea?.branches?.filter(branch => branchFunctionFilter === 'ALL' || branch.function === branchFunctionFilter) ?? [];
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
          {navigation.map(({ label, icon: Icon }) => { const key=label==='SLA Performance'?'sla':'control'; const enabled=label==='Control Tower'||label==='SLA Performance'; return (
            <button key={label} disabled={!enabled} className={enabled && activeModule===key ? 'nav-item active' : 'nav-item'} title={collapsed ? label : undefined} onClick={()=>{if(!enabled)return;setActiveModule(key);setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null);setMobileOpen(false)}}>
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
              <div className="breadcrumb"><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null)}}>Central Java - DIY</button><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null);setSelectedAreaId(null)}}>Region</button>{selectedArea&&<><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null);setSelectedBranchId(null)}}>{selectedArea.name}</button></>}{selectedBranch&&<><span>/</span><button onClick={()=>{setSelectedKpiKey(null);setSelectedDriver(null)}}>{selectedBranch.name}</button></>}{selectedKpi&&<><span>/</span><strong>{selectedKpi.label}</strong></>}</div>
              <h1>{selectedKpi ? 'KPI Detail' : selectedBranch ? 'Branch Command Center' : selectedArea ? 'Area Control Tower' : 'Region Control Tower'}</h1><p className="page-subtitle">{selectedKpi ? 'Detail performa KPI berdasarkan periode aktif' : selectedBranch ? 'Pantau performa operasional dan KPI unit terpilih' : selectedArea ? 'Pantau performa seluruh branch dalam area' : 'Pantau kinerja seluruh wilayah dalam satu tampilan'}</p>
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
                  <button key={value} className={value === periodPreset && !customRange ? 'selected' : ''} onClick={() => {setCustomRange(null);setPeriodPreset(value);setPeriodOpen(false);setSelectedKpiKey(null);setSelectedDriver(null)}}><span>{label}</span><small>{desc}</small></button>
                )}
                </div>
                <div className="custom-range"><div className="custom-range-title"><CalendarDays size={17}/><div><strong>Custom Range</strong><small>Pilih tanggal awal dan akhir secara manual</small></div></div><div className="custom-date-fields"><label><span>Tanggal Awal</span><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></label><b>—</b><label><span>Tanggal Akhir</span><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></label></div><button disabled={!customStart||!customEnd||customStart>customEnd} onClick={()=>{setCustomRange({start:customStart,end:customEnd});setPeriodOpen(false);setSelectedKpiKey(null);setSelectedDriver(null)}}>Terapkan</button></div>
                <div className="period-note"><span>Preset mengikuti tanggal data terbaru.</span><span>Custom Range memakai tanggal pilihan.</span></div>
              </div>
            )}
          </div></div>
        </header>

        <section className="content">
          {activeModule==='sla' && <div className="module-intro"><div><p className="eyebrow">SLA PERFORMANCE</p><h2>Service Level Performance</h2><small>Monitoring pencapaian SLA dari region hingga area dan branch pada periode aktif.</small></div><span className="module-target">Target ≥ 98%</span></div>}
          {activeModule==='sla' && <div className="sla-overview-grid"><article className="metric-card"><div className="metric-card-head"><span>SLA Performance</span><span className="metric-target">Target: 98%</span></div><strong>{fmtPercent(dashboard?.metrics?.find(m=>m.key==='sla')?.value ?? null)}</strong><small>{activeRange?.label ?? 'Periode aktif'} • Region Central Java - DIY</small></article><article className="panel sla-module-placeholder"><div className="panel-title"><div><span>NEXT DETAIL</span><h3>SLA Analysis Workspace</h3><small>Trend, perbandingan area, dan drill-down branch akan dibangun pada tahap berikutnya.</small></div></div></article></div>}
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
                {['Excellent','Good','Fair','Bad','Unsatisfactory'].map(status=>{const count=healthCounts[status]||0;const meta=healthMeta[status];return <div className={`health-row health-${meta.tone}`} key={status}><span className="health-name"><i/>{meta.label} <small>({status})</small></span><span className="health-stat"><strong>{count}</strong><small>area</small><b>{((count/healthTotal)*100).toFixed(1)}%</b><em>›</em></span></div>})}
              </div>
              <div className="penalty-block"><div className="penalty-block-head"><span>PENGURANG KPI REGION</span><small>Terpisah dari KPI Score</small></div><div className="penalty-grid">
                <div><small>LM</small><strong>{fmtPercent(penalties?.lm ?? null)}</strong></div>
                <div><small>FM</small><strong>{fmtPercent(penalties?.fm ?? null)}</strong></div>
                <div><small>MM</small><strong>{fmtPercent(penalties?.mm ?? null)}</strong></div>
              </div></div>
            </article>}
            {!selectedArea && !selectedBranch && <article className="panel full area-comparison"><div className="panel-title"><div><span>PERBANDINGAN KINERJA AREA</span><h3>Area Performance Comparison</h3><small>Daftar kinerja area di wilayah Central Java – DIY</small></div><div className="area-table-tools"><span className="area-count">{dashboard?.areas?.length ?? 0} area</span><div className="area-table-hint">PILIH AREA UNTUK DRILL-DOWN</div></div></div><div className="table-wrap area-performance-table"><table><thead><tr><th>No</th><th>Nama Area</th><th>SLA (≥ 98%)</th><th>KPI Last Mile</th><th>KPI First Mile</th><th>KPI Middle Mile</th><th>Productivity</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{dashboard?.areas?.length ? dashboard.areas.map((area,index) => (
               <tr key={area.id} className="clickable-row" onClick={()=>setSelectedAreaId(area.id)}>
                 <td>{index+1}</td><td><strong>{area.name}</strong></td><td className={area.sla!=null&&area.sla>=98?'metric-good':''}>{fmtPercent(area.sla)}</td><td>{fmtPercent(area.kpiLm)}</td>
                 <td>{fmtPercent(area.kpiFm)}</td><td>{fmtPercent(area.kpiMm)}</td>
                 <td>{fmtPercent(area.productivity)}</td><td><span className={`status-pill status-${area.status.toLowerCase()}`}>{area.status}</span></td>
                 <td><button className="open-area-btn" onClick={(e)=>{e.stopPropagation();setSelectedAreaId(area.id)}}>Detail →</button></td>
               </tr>
             )) : <tr><td colSpan={9}>{error || 'Memuat data sumber...'}</td></tr>}</tbody></table></div></article>}
            {selectedBranch && !selectedKpi && <article className="panel full"><div className="panel-title"><div><span>OPERATIONAL DRIVERS</span><h3>Branch Operations</h3><small>Ringkasan operasional periode aktif dibanding periode sebelumnya</small></div><span className="branch-function-chip">{selectedBranch.function}</span></div>
              <div className="driver-grid">
                <button className="driver-card" onClick={()=>setSelectedDriver('volume')}><span>Volume</span><strong>{selectedBranch.operations?.volume?.toLocaleString('id-ID') ?? '—'}</strong><small>Paket periode aktif <em className={`driver-compare ${(selectedBranch.operations?.volume??0)>=(selectedBranch.operations?.comparison?.volume??0)?'good':'review'}`}>{selectedBranch.operations?.comparison?.volume ? `${(selectedBranch.operations.volume-selectedBranch.operations.comparison.volume)>=0?'↗':'↘'} ${Math.abs((selectedBranch.operations.volume-selectedBranch.operations.comparison.volume)/selectedBranch.operations.comparison.volume*100).toFixed(1)}% vs prev` : '—'}</em></small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('backlog')}><span>Backlog</span><strong>{selectedBranch.operations?.backlog?.toLocaleString('id-ID') ?? '—'}</strong><small>{fmtPercent(selectedBranch.operations?.backlogRate ?? null)} backlog rate <em className={`driver-compare ${(selectedBranch.operations?.backlogRate??Infinity)<=(selectedBranch.operations?.comparison?.backlogRate??-Infinity)?'good':'review'}`}>{selectedBranch.operations?.comparison?.backlogRate!=null&&selectedBranch.operations?.backlogRate!=null ? `${selectedBranch.operations.backlogRate-selectedBranch.operations.comparison.backlogRate<=0?'↘':'↗'} ${Math.abs(selectedBranch.operations.backlogRate-selectedBranch.operations.comparison.backlogRate).toFixed(2)} pp vs prev` : '—'}</em></small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('failedDelivery')}><span>Failed Delivery</span><strong>{selectedBranch.operations?.failedDelivery?.toLocaleString('id-ID') ?? '—'}</strong><small>{fmtPercent(selectedBranch.operations?.failedDeliveryRate ?? null)} failed delivery rate <em className={`driver-compare ${(selectedBranch.operations?.failedDeliveryRate??Infinity)<=(selectedBranch.operations?.comparison?.failedDeliveryRate??-Infinity)?'good':'review'}`}>{selectedBranch.operations?.comparison?.failedDeliveryRate!=null&&selectedBranch.operations?.failedDeliveryRate!=null ? `${selectedBranch.operations.failedDeliveryRate-selectedBranch.operations.comparison.failedDeliveryRate<=0?'↘':'↗'} ${Math.abs(selectedBranch.operations.failedDeliveryRate-selectedBranch.operations.comparison.failedDeliveryRate).toFixed(2)} pp vs prev` : '—'}</em></small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('codTransfer')}><span>COD Transfer</span><strong>{selectedBranch.operations?.codTransfer?.toLocaleString('id-ID') ?? '—'}</strong><small>{fmtPercent(selectedBranch.operations?.codTransferRate ?? null)} transferred rate <em className={`driver-compare ${(selectedBranch.operations?.codTransferRate??-Infinity)>=(selectedBranch.operations?.comparison?.codTransferRate??Infinity)?'good':'review'}`}>{selectedBranch.operations?.comparison?.codTransferRate!=null&&selectedBranch.operations?.codTransferRate!=null ? `${selectedBranch.operations.codTransferRate-selectedBranch.operations.comparison.codTransferRate>=0?'↗':'↘'} ${Math.abs(selectedBranch.operations.codTransferRate-selectedBranch.operations.comparison.codTransferRate).toFixed(2)} pp vs prev` : '—'}</em></small></button>
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
                {selectedKpi.daily.map(day=>{const achieved=day.gap!=null&&day.gap>=0;return <tr key={day.date}><td><strong>{fmtDate(day.date)}</strong></td><td className="num-col">{day.numerator.toLocaleString('id-ID')}</td><td className="num-col">{day.denominator.toLocaleString('id-ID')}</td><td className={`num-col daily-actual ${achieved?'actual-good':'actual-review'}`}><strong>{fmtPercent(day.actual)}</strong></td><td className="num-col">{day.targetLabel}</td><td className={`num-col daily-gap ${achieved?'gap-good':'gap-review'}`}>{day.gap==null?'—':`${day.gap>=0?'+':''}${day.gap.toFixed(2)} pp`}</td><td className="tier-col"><span className={`tier-badge tier-${day.tier.toLowerCase()}`}>{day.tier}</span></td></tr>})}
              </tbody></table></div>
            </article>}
            {selectedBranch && !selectedKpi && <article className="panel full branch-penalty-panel"><div className="panel-title"><div><span>PENGURANG KPI</span><h3>Penalty Breakdown</h3><small>Indikator pengurang KPI untuk {selectedBranch.function} pada periode aktif</small></div><div className="branch-panel-meta"><span className="branch-panel-count">{selectedBranch.penaltyDetails?.length ?? 0} indikator</span><div className="penalty-total-card"><small>Total Penalty</small><strong>{fmtPercent(selectedBranch.penalty ?? null)}</strong></div></div></div>
              <div className="table-wrap penalty-detail-table"><table><thead><tr><th>Indicator</th><th>Actual</th><th>Target T1</th><th>Tier</th><th>Max Penalty</th><th>Penalty</th></tr></thead><tbody>
                {selectedBranch.penaltyDetails?.length ? selectedBranch.penaltyDetails.map(item=><tr key={item.key}><td><strong>{item.label}</strong></td><td>{fmtPercent(item.actual)}</td><td>{item.targetLabel}</td><td><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span></td><td>{item.maxPenalty}%</td><td><strong>{item.penalty.toFixed(1)}</strong></td></tr>) : <tr><td colSpan={6}>Penalty detail belum tersedia untuk unit ini.</td></tr>}
              </tbody></table></div>
            </article>}
            {selectedArea && !selectedBranch && <article className="panel full branch-directory-panel"><div className="panel-title branch-directory-title"><div><span>BRANCH / GERAI</span><h3>Branch Directory</h3><small>Pilih unit untuk membuka Branch Command Center</small></div><div className="branch-directory-tools"><span className="branch-filter-label">Filter Fungsi</span><div className="branch-function-filter">{(['ALL','LM','FM','MM'] as const).map(fn=><button key={fn} className={branchFunctionFilter===fn?'active':''} onClick={()=>setBranchFunctionFilter(fn)}>{fn==='ALL'?'Semua':fn}</button>)}</div><span className="branch-count">{filteredBranches.length} unit</span></div></div>
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