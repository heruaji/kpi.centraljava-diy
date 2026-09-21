import { useState } from 'react';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Gauge, Menu, Route, Target, TrendingUp, X } from 'lucide-react';

const navigation = [
  { label: 'Control Tower', icon: Gauge, active: true },
  { label: 'SLA Performance', icon: Target },
  { label: 'KPI Performance', icon: BarChart3 },
  { label: 'Productivity', icon: TrendingUp },
  { label: 'Performance Drivers', icon: Route },
];

const cards = [
  ['SLA Performance', '—', 'Menunggu data'],
  ['KPI LM', '—', 'Menunggu data'],
  ['KPI FM', '—', 'Menunggu data'],
  ['KPI MM', '—', 'Menunggu data'],
];

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);

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
              <CalendarDays size={18}/><span>MTD • Periode aktif</span>
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
            <span className="freshness">Data terakhir: menunggu koneksi sumber</span>
          </div>

          <div className="metric-grid">
            {cards.map(([label,value,note]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
          </div>

          <div className="dashboard-grid">
            <article className="panel wide"><div className="panel-title"><div><span>PERFORMANCE TREND</span><h3>Region Trend</h3></div><button>SLA ▾</button></div><div className="placeholder">Chart akan terisi dari calculation engine</div></article>
            <article className="panel"><div className="panel-title"><div><span>HEALTH</span><h3>Performance Health</h3></div></div><div className="placeholder compact">Excellent · Good · Fair · Bad</div></article>
            <article className="panel full"><div className="panel-title"><div><span>AREA PERFORMANCE</span><h3>Area Comparison</h3></div></div><div className="table-wrap"><table><thead><tr><th>Area</th><th>SLA</th><th>KPI LM</th><th>KPI FM</th><th>KPI MM</th><th>Productivity</th><th>Status</th></tr></thead><tbody><tr><td colSpan={7}>Menunggu data sumber</td></tr></tbody></table></div></article>
          </div>
        </section>
      </main>
    </div>
  );
}