type ProductivityAreaTrendProps = {
  areaName: string;
  trend: Array<{date: string; productivity?: number | null}>;
  target: number;
  tier2Target: number;
  getTier: (value: number | null | undefined) => string | null;
  formatDate: (value: string | null) => string;
  formatNumber: (value: number | null | undefined) => string;
  getAxisMax: (value: number) => number;
};

export function ProductivityAreaTrend({
  areaName,
  trend,
  target,
  tier2Target,
  getTier,
  formatDate,
  formatNumber,
  getAxisMax,
}: ProductivityAreaTrendProps) {
  return (
    <div className="productivity-area-trend"><div className="productivity-daily-head"><div><span>AREA TREND</span><strong>Productivity Daily — {areaName}</strong></div><small>Target {target}</small></div>{(()=>{const data=[...(trend??[])].filter(d=>d.productivity!=null);const max=getAxisMax(Math.max(target*1.1,...data.map(d=>d.productivity??0)));const targetHeight=Math.min(100,(target/max)*100);return data.length?<div className="trend-chart-shell"><div className="trend-plot productivity-control-plot" aria-label={`Productivity daily trend ${areaName}`}><div className="trend-y-label y100">{max.toFixed(0)}</div><div className="trend-y-label y75">{(max*.75).toFixed(0)}</div><div className="trend-y-label y50">{(max*.5).toFixed(0)}</div><div className="trend-y-label y25">{(max*.25).toFixed(0)}</div><div className="trend-y-label y0">0</div><div className="trend-grid-line grid100"/><div className="trend-grid-line grid75"/><div className="trend-grid-line grid50"/><div className="trend-grid-line grid25"/><div className="trend-grid-line grid0"/><div className="trend-target-scale"><div className="trend-target-line" style={{bottom:`${targetHeight}%`}}><span>Tier 1-{target}</span></div><div className="trend-tier2-line" style={{bottom:`${Math.min(100,(tier2Target/max)*100)}%`}}><span>Tier 2-{tier2Target}</span></div></div><div className="trend-bars">{data.map(d=>{const value=d.productivity??null;const height=value==null?0:Math.max(2,Math.min(100,(value/max)*100));const tier=getTier(value);const tierClass=tier==='Tier 1'?'tier-1':tier==='Tier 2'?'tier-2':'tier-3';return <div className="trend-column" key={d.date} title={`${formatDate(d.date)}: Productivity ${formatNumber(value)} • ${tier??'No Data'}`}><div className="trend-track">{value!=null&&<div className={`trend-value ${tierClass}`} style={{bottom:`calc(${height}% + 4px)`}}>{value.toFixed(1)}</div>}<div className={`trend-bar ${tierClass}`} style={{height:`${height}%`}}/></div><small>{new Date(`${d.date}T00:00:00`).getDate()}</small></div>})}</div></div><div className="trend-legend productivity-tier-legend"><span><i className="legend-tier-1"/>Tier 1</span><span><i className="legend-tier-2"/>Tier 2</span><span><i className="legend-tier-3"/>Tier 3</span></div></div>:<div className="placeholder">Data trend productivity area belum tersedia</div>})()}</div>
  );
}
