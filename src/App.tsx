import { useEffect, useState } from 'react';
import type { RegionDashboard } from './types/dashboard';
import { getRegionDashboard, latestFreshness, type DashboardPeriod } from './services/dashboard';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Gauge, Menu, Route, Target, TrendingUp, X } from 'lucide-react';

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

  const cards = dashboard?.metrics ?? [];
  const penalties = dashboard?.penalties;
  const healthCounts = (dashboard?.areas ?? []).reduce<Record<string, number>>((acc, area) => { acc[area.status] = (acc[area.status] || 0) + 1; return acc; }, {});
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
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">K</div>
          {!collapsed && <div><strong>KPI</strong><span>Central Java - DIY</span></div>}
          <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20}/></button>
        </div>
        <nav>
          {navigation.map(({ label, icon: Icon, active }) => (
            <button key={label} className={active ? 'nav-item active' : 'nav-item'} title={collapsed ? label : undefined}>
              <Icon size={19}/>{!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <button className="collapse-btn" onClick={() => setCollapsed(v => !v)}>
          {collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/><span>Collapse</span></>}
        </button>
      </aside>

      {mobileOpen && <button className="scrim" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}/>}

      <main className="main">
        <header className="topbar">
          <div className="title-row">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={22}/></button>
            <div>
              <div className="breadcrumb">{selectedKpi ? `Central Java - DIY / Region / ${selectedArea?.name} / ${selectedBranch?.name} / ${selectedKpi.label}` : selectedBranch ? `Central Java - DIY / Region / ${selectedArea?.name} / ${selectedBranch.name}` : selectedArea ? `Central Java - DIY / Region / ${selectedArea.name}` : 'Central Java - DIY / Region'}</div>
              <h1>{selectedKpi ? 'KPI Detail' : selectedBranch ? 'Branch Command Center' : selectedArea ? 'Area Control Tower' : 'Region Control Tower'}</h1>
            </div>
          </div>
          <div className="period-wrap">
            <button className="period-button" onClick={() => setPeriodOpen(v => !v)}>
              <CalendarDays size={18}/><span>{periodLabel}</span>
            </button>
            {periodOpen && (
              <div className="period-popover">
                <strong>Pilih Periode</strong>
                {([
                  ['TODAY','Hari Ini'],['YESTERDAY','Kemarin'],['LAST_7','7 Hari Terakhir'],['LAST_30','30 Hari Terakhir'],['WTD','WTD'],['MTD','MTD'],['YTD','YTD']
                ] as [DashboardPeriod,string][]).map(([value,label]) =>
                  <button key={value} className={value === periodPreset ? 'selected' : ''} onClick={() => {setCustomRange(null);setPeriodPreset(value);setPeriodOpen(false);setSelectedKpiKey(null);setSelectedDriver(null)}}>{label}</button>
                )}
                <div className="custom-range"><span>Custom Range</span><div><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/><span>—</span><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></div><button disabled={!customStart||!customEnd||customStart>customEnd} onClick={()=>{setCustomRange({start:customStart,end:customEnd});setPeriodOpen(false);setSelectedKpiKey(null);setSelectedDriver(null)}}>Terapkan</button></div>
                <small>Preset dihitung terhadap tanggal data terbaru. Custom Range memakai tanggal yang dipilih.</small>
              </div>
            )}
          </div>
        </header>

        <section className="content">
          <div className="section-heading">
            <div><p className="eyebrow">{selectedKpi ? 'KPI PERFORMANCE DETAIL' : 'EXECUTIVE OVERVIEW'}</p><h2>{selectedKpi ? selectedKpi.label : selectedBranch ? selectedBranch.name : selectedArea ? selectedArea.name : 'Performance Summary'}</h2>{selectedKpi ? <button className="back-scope" onClick={()=>setSelectedKpiKey(null)}>← Kembali ke Branch</button> : selectedBranch ? <button className="back-scope" onClick={()=>{setSelectedKpiKey(null);setSelectedBranchId(null)}}>← Kembali ke Area</button> : selectedArea && <button className="back-scope" onClick={()=>setSelectedAreaId(null)}>← Kembali ke Region</button>}</div>
            <span className="freshness">{error ? `Error: ${error}` : loading ? 'Memuat data...' : `Data terakhir: ${fmtDate(freshDate)}`}</span>
          </div>

          {!selectedKpi && <div className="metric-grid">
            {visibleCards.length ? visibleCards.map(metric => (
              <article className="metric-card" key={metric.key}>
                <span>{metric.label}</span>
                <strong>{fmtPercent(metric.value)}</strong>
                <small>{metric.value == null ? 'Data belum terhubung' : (activeRange?.label ?? 'Periode aktif')}</small>
              </article>
            )) : ['SLA Performance','KPI LM','KPI FM','KPI MM'].map(label => (
              <article className="metric-card" key={label}><span>{label}</span><strong>—</strong><small>{error || 'Memuat data...'}</small></article>
            ))}
          </div>}

          <div className="dashboard-grid">
            {!selectedKpi && <article className="panel wide"><div className="panel-title"><div><span>PERFORMANCE TREND</span><h3>{selectedBranch ? `KPI ${selectedBranch.function} — ${selectedBranch.name}` : selectedArea ? `${selectedArea.name} Trend` : 'Region Trend'}</h3></div>{!selectedBranch && <select className="trend-select" value={trendMetric} onChange={e=>setTrendMetric(e.target.value as typeof trendMetric)}><option value="sla">SLA</option><option value="kpiLm">KPI LM</option><option value="kpiFm">KPI FM</option><option value="kpiMm">KPI MM</option></select>}</div>
              {trend.length ? <div className="trend-chart" aria-label={`${selectedBranch ? `KPI ${selectedBranch.function}` : trendLabels[trendMetric]} daily trend`}>
                {trend.map(point=>{const value=point[activeTrendMetric]; return <div className="trend-column" key={point.date} title={`${fmtDate(point.date)}: ${fmtPercent(value)}`}><div className="trend-value">{value==null?'':value.toFixed(0)}</div><div className="trend-track"><div className="trend-bar" style={{height:value==null?'0%':`${Math.max(2,(value/trendMax)*100)}%`}}/></div><small>{new Date(`${point.date}T00:00:00`).getDate()}</small></div>})}
              </div> : <div className="placeholder">Data trend belum tersedia</div>}
            </article>}
            {!selectedKpi && <article className="panel"><div className="panel-title"><div><span>HEALTH</span><h3>Performance Health</h3></div></div>
              <div className="health-list">
                {['Excellent','Good','Fair','Bad','Unsatisfactory'].map(status => <div className="health-row" key={status}><span>{status}</span><strong>{healthCounts[status] || 0}</strong></div>)}
              </div>
              <div className="penalty-block"><span>PENGURANG KPI</span><div className="penalty-grid">
                <div><small>LM</small><strong>{fmtPercent(penalties?.lm ?? null)}</strong></div>
                <div><small>FM</small><strong>{fmtPercent(penalties?.fm ?? null)}</strong></div>
                <div><small>MM</small><strong>{fmtPercent(penalties?.mm ?? null)}</strong></div>
              </div><small className="penalty-note">Ditampilkan terpisah dari KPI Score sesuai baseline.</small></div>
            </article>}
            {!selectedArea && !selectedBranch && <article className="panel full"><div className="panel-title"><div><span>AREA PERFORMANCE</span><h3>Area Comparison</h3></div></div><div className="table-wrap"><table><thead><tr><th>Area</th><th>SLA</th><th>KPI LM</th><th>KPI FM</th><th>KPI MM</th><th>Productivity</th><th>Status</th></tr></thead><tbody>{dashboard?.areas?.length ? dashboard.areas.map(area => (
              <tr key={area.id} className="clickable-row" onClick={()=>setSelectedAreaId(area.id)}>
                <td><button className="area-link" onClick={()=>setSelectedAreaId(area.id)}>{area.name}</button></td><td>{fmtPercent(area.sla)}</td><td>{fmtPercent(area.kpiLm)}</td>
                <td>{fmtPercent(area.kpiFm)}</td><td>{fmtPercent(area.kpiMm)}</td>
                <td>{fmtPercent(area.productivity)}</td><td>{area.status}</td>
              </tr>
            )) : <tr><td colSpan={7}>{error || 'Memuat data sumber...'}</td></tr>}</tbody></table></div></article>}
            {selectedBranch && !selectedKpi && <article className="panel full"><div className="panel-title"><div><span>OPERATIONAL DRIVERS</span><h3>Branch Operations</h3></div></div>
              <div className="driver-grid">
                <button className="driver-card" onClick={()=>setSelectedDriver('volume')}><span>Volume</span><strong>{selectedBranch.operations?.volume?.toLocaleString('id-ID') ?? '—'}</strong><small>Paket periode aktif</small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('backlog')}><span>Backlog</span><strong>{selectedBranch.operations?.backlog?.toLocaleString('id-ID') ?? '—'}</strong><small>Outstanding package</small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('failedDelivery')}><span>Failed Delivery</span><strong>{selectedBranch.operations?.failedDelivery?.toLocaleString('id-ID') ?? '—'}</strong><small>Gagal delivery</small></button>
                <button className="driver-card" onClick={()=>setSelectedDriver('codTransfer')}><span>COD Transfer</span><strong>{selectedBranch.operations?.codTransfer?.toLocaleString('id-ID') ?? '—'}</strong><small>Transfer COD</small></button>
              </div>
            </article>}
            {selectedDriver && selectedBranch && !selectedKpi && <article className="panel full"><div className="panel-title"><div><span>OPERATIONAL DETAIL</span><h3>{driverLabels[selectedDriver]} — Daily Trend</h3></div><button className="back-scope" onClick={()=>setSelectedDriver(null)}>Tutup Detail</button></div>
              <div className="driver-trend">{driverDaily.map(day=><div className="driver-trend-col" key={day.date} title={`${fmtDate(day.date)}: ${day[selectedDriver].toLocaleString('id-ID')}`}><strong>{day[selectedDriver].toLocaleString('id-ID')}</strong><div className="driver-trend-track"><div className="driver-trend-bar" style={{height:`${Math.max(2,(day[selectedDriver]/driverMax)*100)}%`}}/></div><small>{new Date(`${day.date}T00:00:00`).getDate()}</small></div>)}</div>
              <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>{driverLabels[selectedDriver]}</th></tr></thead><tbody>{driverDaily.map(day=><tr key={day.date}><td>{fmtDate(day.date)}</td><td><strong>{day[selectedDriver].toLocaleString('id-ID')}</strong></td></tr>)}</tbody></table></div>
            </article>}
            {selectedBranch && !selectedKpi && <article className="panel full"><div className="panel-title"><div><span>KPI PERFORMANCE</span><h3>KPI ${selectedBranch.function} Breakdown</h3></div></div>
              <div className="table-wrap"><table><thead><tr><th>KPI</th><th>Actual</th><th>Target T1</th><th>Tier</th><th>Weight</th><th>Score</th></tr></thead><tbody>
                {selectedBranch.kpiDetails?.length ? selectedBranch.kpiDetails.map(kpi=><tr key={kpi.key} className="clickable-row" onClick={()=>setSelectedKpiKey(kpi.key)}><td><strong>{kpi.label}</strong></td><td>{fmtPercent(kpi.actual)}</td><td>{kpi.targetLabel}</td><td><span className={`tier-badge tier-${kpi.tier.toLowerCase()}`}>{kpi.tier}</span></td><td>{kpi.weight}%</td><td><strong>{kpi.score.toFixed(1)}</strong></td></tr>) : <tr><td colSpan={6}>Detail KPI belum tersedia untuk unit ini.</td></tr>}
              </tbody></table></div>
            </article>}
            {selectedKpi && <article className="panel full kpi-detail-panel"><div className="panel-title"><div><span>KPI DETAIL</span><h3>{selectedKpi.label} — Daily Performance</h3></div><button className="back-scope" onClick={()=>setSelectedKpiKey(null)}>← KPI Summary</button></div>
              <div className="kpi-detail-chart" aria-label={`${selectedKpi.label} daily chart`}>
                {selectedKpi.daily.map(day=><div className="kpi-detail-col" key={day.date} title={`${fmtDate(day.date)}: ${fmtPercent(day.actual)}`}><div className="kpi-detail-value">{day.actual==null?'—':day.actual.toFixed(1)}</div><div className="kpi-detail-track"><div className="kpi-target-line" style={{bottom:`${Math.min(100,(day.target/kpiTrendMax)*100)}%`}}/><div className="kpi-detail-bar" style={{height:day.actual==null?'0%':`${Math.max(2,(day.actual/kpiTrendMax)*100)}%`}}/></div><small>{new Date(`${day.date}T00:00:00`).getDate()}</small></div>)}
              </div>
              <div className="kpi-chart-legend"><span>Bar = Actual</span><span>Line = Target T1 ({selectedKpi.targetLabel})</span></div>
              <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Numerator</th><th>Denominator</th><th>Actual</th><th>Target</th><th>Gap</th><th>Tier</th></tr></thead><tbody>
                {selectedKpi.daily.map(day=><tr key={day.date}><td>{fmtDate(day.date)}</td><td>{day.numerator.toLocaleString('id-ID')}</td><td>{day.denominator.toLocaleString('id-ID')}</td><td><strong>{fmtPercent(day.actual)}</strong></td><td>{day.targetLabel}</td><td>{day.gap==null?'—':`${day.gap>=0?'+':''}${day.gap.toFixed(2)} pp`}</td><td><span className={`tier-badge tier-${day.tier.toLowerCase()}`}>{day.tier}</span></td></tr>)}
              </tbody></table></div>
            </article>}
            {selectedBranch && !selectedKpi && <article className="panel full"><div className="panel-title"><div><span>PENGURANG KPI</span><h3>Penalty Breakdown</h3></div><strong className="penalty-total">Total {fmtPercent(selectedBranch.penalty ?? null)}</strong></div>
              <div className="table-wrap"><table><thead><tr><th>Indicator</th><th>Actual</th><th>Target T1</th><th>Tier</th><th>Max Penalty</th><th>Penalty</th></tr></thead><tbody>
                {selectedBranch.penaltyDetails?.length ? selectedBranch.penaltyDetails.map(item=><tr key={item.key}><td><strong>{item.label}</strong></td><td>{fmtPercent(item.actual)}</td><td>{item.targetLabel}</td><td><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span></td><td>{item.maxPenalty}%</td><td><strong>{item.penalty.toFixed(1)}</strong></td></tr>) : <tr><td colSpan={6}>Penalty detail belum tersedia untuk unit ini.</td></tr>}
              </tbody></table></div>
            </article>}
            {selectedArea && !selectedBranch && <article className="panel full"><div className="panel-title branch-directory-title"><div><span>BRANCH / GERAI</span><h3>Branch Directory</h3></div><div className="branch-directory-tools"><div className="branch-function-filter">{(['ALL','LM','FM','MM'] as const).map(fn=><button key={fn} className={branchFunctionFilter===fn?'active':''} onClick={()=>setBranchFunctionFilter(fn)}>{fn==='ALL'?'Semua':fn}</button>)}</div><span className="branch-count">{filteredBranches.length} unit</span></div></div>
              <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Branch / Gerai</th><th>Fungsi</th><th>Kab/Kota</th><th></th></tr></thead><tbody>
                {filteredBranches.length ? filteredBranches.map(branch=><tr key={branch.id} className="clickable-row" onClick={()=>setSelectedBranchId(branch.id)}><td>{branch.code}</td><td><strong>{branch.name}</strong></td><td>{branch.function}</td><td>{branch.city}</td><td><button className="area-link" onClick={()=>setSelectedBranchId(branch.id)}>Buka →</button></td></tr>) : <tr><td colSpan={5}>Tidak ada unit {branchFunctionFilter==='ALL'?'':branchFunctionFilter} di area ini.</td></tr>}
              </tbody></table></div>
            </article>}
          </div>
        </section>
      </main>
    </div>
  );
}