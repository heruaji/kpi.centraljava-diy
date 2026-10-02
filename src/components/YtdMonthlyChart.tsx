// src/components/YtdMonthlyChart.tsx
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';

type YtdRow = {
  month: string;
  sla: number | null;
  codTransferRate: number | null;
  failedDeliveryRate: number | null;
  backlogRate: number | null;
  productivitySorterFm: number | null;
  productivitySorterLm: number | null;
  productivityCourierFm: number | null;
  productivityCourierLm: number | null;
};

type MetricKey = Exclude<keyof YtdRow, 'month'>;

type MetricCfg = {
  value: MetricKey;
  label: string;
  suffix: '%' | '';
  target: number;
  direction: 'HIGHER' | 'LOWER';
  color: string;
};

const ALL_METRICS: MetricCfg[] = [
  { value: 'sla', label: 'SLA Performance', suffix: '%', target: 96, direction: 'HIGHER', color: '#10b981' },
  { value: 'codTransferRate', label: 'COD Transferred', suffix: '%', target: 99.5, direction: 'HIGHER', color: '#3b82f6' },
  { value: 'failedDeliveryRate', label: 'Failed Delivery', suffix: '%', target: 1, direction: 'LOWER', color: '#f97316' },
  { value: 'backlogRate', label: 'Backlog Rate', suffix: '%', target: 1.5, direction: 'LOWER', color: '#eab308' },
  { value: 'productivitySorterFm', label: 'Sorter FM', suffix: '', target: 980, direction: 'HIGHER', color: '#8b5cf6' },
  { value: 'productivitySorterLm', label: 'Sorter LM', suffix: '', target: 780, direction: 'HIGHER', color: '#6366f1' },
  { value: 'productivityCourierFm', label: 'Kurir FM', suffix: '', target: 115, direction: 'HIGHER', color: '#ec4899' },
  { value: 'productivityCourierLm', label: 'Kurir LM', suffix: '', target: 51, direction: 'HIGHER', color: '#f43f5e' },
];

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function YtdMonthlyChart() {
  const [data, setData] = useState<YtdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>('sla');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    setLoading(true);
    if (force) setRefreshing(true);
    try {
      const r = await fetch(`${API_BASE}/api/dashboard/ytd-summary${force ? '?refresh=1' : ''}`);
      const d = await r.json();
      setData(Array.isArray(d) ? d : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      if (force) window.setTimeout(() => setRefreshing(false), 400);
    }
  };

  useEffect(() => { void load(false); }, []);

  // Detect YTD row (kalau ada) vs compute di frontend
  const ytdRowFromSheet = data[0]?.month?.toUpperCase() === 'YTD' ? data[0] : null;
  const monthlyRows = ytdRowFromSheet ? data.slice(1) : data;

  // Auto-hide metrics yang full null di semua bulan
  const activeMetrics = ALL_METRICS.filter(m =>
    monthlyRows.some(r => r[m.value] != null)
  );
  const safeMetric = activeMetrics.find(m => m.value === metric)?.value ?? activeMetrics[0]?.value ?? 'sla';
  const cfg = activeMetrics.find(m => m.value === safeMetric)!;

  // Compute YTD dari monthly kalau tidak ada di sheet (weighted by volume/den)
  const computeYtd = (key: MetricKey): number | null => {
    const vals = monthlyRows.map(r => r[key]).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length; // simple avg untuk display
  };

  const ytdValue = ytdRowFromSheet ? ytdRowFromSheet[cfg.value] : computeYtd(cfg.value);

  const categories = monthlyRows.map(r => r.month);
  const series = monthlyRows.map(r => {
    const v = r[cfg.value];
    return v == null ? null : Number(v.toFixed(2));
  });

  const options: ApexOptions = {
    chart: { type: 'line', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
    stroke: { curve: 'smooth', width: 3, colors: [cfg.color] },
    markers: { size: 5, colors: [cfg.color], strokeColors: '#0f172a', strokeWidth: 2, hover: { size: 7 } },
    dataLabels: {
      enabled: true,
      formatter: (v: number) => v == null ? '' : v.toFixed(1),
      style: { fontSize: '10px', fontWeight: 700, colors: [cfg.color] },
      offsetY: -8,
      background: { enabled: false },
    },
    grid: { borderColor: 'rgba(148,163,184,0.12)', strokeDashArray: 3, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    xaxis: { categories, labels: { style: { fontSize: '10px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: {
      labels: {
        style: { fontSize: '10px', colors: '#94a3b8' },
        formatter: (v: number) => cfg.suffix === '%' ? `${v.toFixed(0)}%` : v.toFixed(0),
      },
    },
    annotations: {
      yaxis: [{
        y: cfg.target,
        borderColor: '#f59e0b',
        strokeDashArray: 5,
        label: {
          text: `Target ${cfg.target}${cfg.suffix}`,
          style: { background: '#f59e0b', color: '#111827', fontSize: '9px', fontWeight: 700 },
        },
      }],
    },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => v == null ? '—' : `${v.toFixed(2)}${cfg.suffix}` } },
    legend: { show: false },
  };

  const seriesData = [{ name: cfg.label, data: series }];
  const achieved = ytdValue != null && (cfg.direction === 'HIGHER' ? ytdValue >= cfg.target : ytdValue <= cfg.target);

  return (
    <>
      <div className="ytd-summary-bar">
        <div>
          <small>YTD Aktual</small>
          <strong>{ytdValue == null ? '—' : `${ytdValue.toFixed(2)}${cfg.suffix}`}</strong>
        </div>
        <div>
          <small>Target</small>
          <strong>{cfg.target}{cfg.suffix}</strong>
        </div>
        <div>
          <small>Status</small>
          <strong className={achieved ? 'status-achieved' : 'status-review'}>
            {ytdValue == null ? '—' : achieved ? '↗ Achieved' : '↘ Needs Review'}
          </strong>
        </div>
        <button
          type="button"
          className="theme-toggle refresh-button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          title="Refresh dari sheet"
        >
          <RefreshCw size={14} className={refreshing ? 'refresh-spin' : ''} />
          <span>{refreshing ? 'Memperbarui...' : 'Refresh'}</span>
        </button>
      </div>

      <article className="panel full performance-trend-panel">
        <div className="panel-title">
          <div>
            <span>YTD MONTHLY TREND</span>
            <h3>{cfg.label} — Monthly Progress</h3>
            <small>Pergerakan {cfg.label.toLowerCase()} per bulan sepanjang tahun</small>
          </div>
          <select className="trend-select" value={safeMetric} onChange={e => setMetric(e.target.value as MetricKey)}>
            {activeMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {loading && <div className="placeholder compact">Memuat data...</div>}
        {error && <div className="placeholder compact">Error: {error}</div>}
        {!loading && !error && monthlyRows.length === 0 && (
          <div className="placeholder compact">Tidak ada data. Pastikan sheet "YTD Summary" sudah terisi.</div>
        )}

        {!loading && !error && monthlyRows.length > 0 && (
          <div className="ytd-chart-wrap">
            <Chart options={options} series={seriesData} type="line" height={320} />
          </div>
        )}
      </article>
    </>
  );
}
