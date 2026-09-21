import { useEffect, useState } from 'react';
import type { RegionDashboard } from './types/dashboard';
import { getRegionDashboard, latestFreshness } from './services/dashboard';
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
  const [dashboard, setDashboard] = useState<RegionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRegionDashboard()
      .then(setDashboard)
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const cards = dashboard?.metrics ?? [];
  const penalties = dashboard?.penalties;
  const healthCounts = (dashboard?.areas ?? []).reduce<Record<string, number>>((acc, area) => { acc[area.status] = (acc[area.status] || 0) + 1; return acc; }, {});
  const freshDate = latestFreshness(dashboard);
  const activeRange = dashboard?.range ?? null;
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
              <div className="breadcrumb">Central Java - DIY / Region</div>
              <h1>Region Control Tower</h1>
            </div>
          </div>
          <div className="period-wrap">
            <button className="period-button" onClick={() => setPeriodOpen(v => !v)}>
              <CalendarDays size={18}/><span>{periodLabel}</span>
            </button>
            {periodOpen && (
              <div className="period-popover">
                <strong>Pilih Periode</strong>
                {['Hari Ini','Kemarin','7 Hari Terakhir','30 Hari Terakhir','WTD','MTD','YTD','Custom Range'].map(x =>
                  <button key={x} className={x === 'MTD' ? 'selected' : ''} onClick={() => setPeriodOpen(false)}>{x}</button>
                )}
                <small>Periode final akan mengikuti MAX_DATE sumber data.</small>
              </div>
            )}
          </div>
        </header>

        <section className="content">
          <div className="section-heading">
            <div><p className="eyebrow">EXECUTIVE OVERVIEW</p><h2>Performance Summary</h2></div>
            <span className="freshness">{error ? `Error: ${error}` : loading ? 'Memuat data...' : `Data terakhir: ${fmtDate(freshDate)}`}</span>
          </div>

          <div className="metric-grid">
            {cards.length ? cards.map(metric => (
              <article className="metric-card" key={metric.key}>
                <span>{metric.label}</span>
                <strong>{fmtPercent(metric.value)}</strong>
                <small>{metric.value == null ? 'Data belum terhubung' : (activeRange?.label ?? 'Periode aktif')}</small>
              </article>
            )) : ['SLA Performance','KPI LM','KPI FM','KPI MM'].map(label => (
              <article className="metric-card" key={label}><span>{label}</span><strong>—</strong><small>{error || 'Memuat data...'}</small></article>
            ))}
          </div>

          <div className="dashboard-grid">
            <article className="panel wide"><div className="panel-title"><div><span>PERFORMANCE TREND</span><h3>Region Trend</h3></div><button>SLA ▾</button></div><div className="placeholder">Chart akan terisi dari calculation engine</div></article>
            <article className="panel"><div className="panel-title"><div><span>HEALTH</span><h3>Performance Health</h3></div></div>
              <div className="health-list">
                {['Excellent','Good','Fair','Bad','Unsatisfactory'].map(status => <div className="health-row" key={status}><span>{status}</span><strong>{healthCounts[status] || 0}</strong></div>)}
              </div>
              <div className="penalty-block"><span>PENGURANG KPI</span><div className="penalty-grid">
                <div><small>LM</small><strong>{fmtPercent(penalties?.lm ?? null)}</strong></div>
                <div><small>FM</small><strong>{fmtPercent(penalties?.fm ?? null)}</strong></div>
                <div><small>MM</small><strong>{fmtPercent(penalties?.mm ?? null)}</strong></div>
              </div><small className="penalty-note">Ditampilkan terpisah dari KPI Score sesuai baseline.</small></div>
            </article>
            <article className="panel full"><div className="panel-title"><div><span>AREA PERFORMANCE</span><h3>Area Comparison</h3></div></div><div className="table-wrap"><table><thead><tr><th>Area</th><th>SLA</th><th>KPI LM</th><th>KPI FM</th><th>KPI MM</th><th>Productivity</th><th>Status</th></tr></thead><tbody>{dashboard?.areas?.length ? dashboard.areas.map(area => (
              <tr key={area.id}>
                <td>{area.name}</td><td>{fmtPercent(area.sla)}</td><td>{fmtPercent(area.kpiLm)}</td>
                <td>{fmtPercent(area.kpiFm)}</td><td>{fmtPercent(area.kpiMm)}</td>
                <td>{fmtPercent(area.productivity)}</td><td>{area.status}</td>
              </tr>
            )) : <tr><td colSpan={7}>{error || 'Memuat data sumber...'}</td></tr>}</tbody></table></div></article>
          </div>
        </section>
      </main>
    </div>
  );
}