import type { AreaPerformance, TrendPoint } from '../types/dashboard';

export type ControlTrendKey = 'sla'|'cod'|'failed'|'backlog'|'sorterFm'|'sorterLm'|'courierFm'|'courierLm';
export type ControlTrendDefinition = {
  label: string;
  field: keyof TrendPoint;
  target: number;
  tier2: number;
  direction: 'HIGHER'|'LOWER';
  percent: boolean;
};

type Props = {
  area: AreaPerformance;
  selectedBranchId: string | null;
  trendMetric: ControlTrendKey;
  activeTrend: ControlTrendDefinition;
  onMetricChange: (key: ControlTrendKey) => void;
  onBranchSelect: (id: string) => void;
  onBack: () => void;
  formatPercent: (value: number | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null) => string;
  niceAxisMax: (value: number) => number;
};

const METRICS: {key:ControlTrendKey;label:string}[] = [
  {key:'sla',label:'SLA Performance'},
  {key:'cod',label:'COD Transferred'},
  {key:'failed',label:'Failed Delivery'},
  {key:'backlog',label:'Backlog Rate'},
  {key:'sorterFm',label:'Sorter FM'},
  {key:'sorterLm',label:'Sorter LM'},
  {key:'courierFm',label:'Kurir FM'},
  {key:'courierLm',label:'Kurir LM'},
];

function TrendChart({data,metric,definition,formatPercent,formatNumber,formatDate,niceAxisMax}:{
  data:TrendPoint[];
  metric:ControlTrendKey;
  definition:ControlTrendDefinition;
  formatPercent:Props['formatPercent'];
  formatNumber:Props['formatNumber'];
  formatDate:Props['formatDate'];
  niceAxisMax:Props['niceAxisMax'];
}) {
  const values=data.map(point=>point[definition.field] as number|null|undefined).filter((value):value is number=>value!=null);
  const peak=Math.max(definition.target,definition.tier2,...values);
  const adaptive=metric==='backlog'||metric==='failed';
  const max=adaptive?niceAxisMax(peak*1.25):definition.percent?100:niceAxisMax(peak);
  const targetPosition=Math.min(100,definition.target/max*100);
  const tier2Position=Math.min(100,definition.tier2/max*100);
  const getTier=(value:number|null|undefined)=>{
    if(value==null) return null;
    const tier1=definition.direction==='HIGHER'?value>=definition.target:value<=definition.target;
    const tier2=definition.direction==='HIGHER'?value>=definition.tier2:value<=definition.tier2;
    return tier1?'Tier 1':tier2?'Tier 2':'Tier 3';
  };
  if(!data.length) return <div className="placeholder">Data trend belum tersedia</div>;
  return <div className="trend-chart-shell kpi-region-large-chart">
    <div className="trend-plot">
      <div className="trend-y-label y100">{definition.percent?formatPercent(max):formatNumber(max)}</div>
      <div className="trend-y-label y75">{definition.percent?formatPercent(max*.75):formatNumber(max*.75)}</div>
      <div className="trend-y-label y50">{definition.percent?formatPercent(max*.5):formatNumber(max*.5)}</div>
      <div className="trend-y-label y25">{definition.percent?formatPercent(max*.25):formatNumber(max*.25)}</div>
      <div className="trend-y-label y0">{definition.percent?'0%':'0'}</div>
      <div className="trend-grid-line grid100"/><div className="trend-grid-line grid75"/>
      <div className="trend-grid-line grid50"/><div className="trend-grid-line grid25"/>
      <div className="trend-grid-line grid0"/>
      <div className="trend-target-scale">
        <div className="trend-target-line" style={{bottom:targetPosition+'%'}}>
          <span>Tier 1-{definition.percent?definition.target+'%':definition.target}</span>
        </div>
        <div className="control-tier2-line" style={{bottom:tier2Position+'%'}}>
          <span>Tier 2-{definition.percent?definition.tier2+'%':definition.tier2}</span>
        </div>
      </div>
      <div className="trend-bars">
        {data.map(point=>{
          const value=point[definition.field] as number|null|undefined;
          const tier=getTier(value);
          const tone=tier==='Tier 1'?'tier-1':tier==='Tier 2'?'tier-2':'tier-3';
          const height=value==null?0:Math.max(2,Math.min(100,value/max*100));
          const label=definition.percent?formatPercent(value):formatNumber(value);
          return <div className="trend-column" key={point.date} title={formatDate(point.date)+': '+label+' • '+(tier??'No Data')}>
            <div className="trend-track">
              {value!=null&&<div className={'trend-value '+tone} style={{bottom:'calc('+height+'% + 4px)'}}>{definition.percent?value.toFixed(1):formatNumber(value)}</div>}
              <div className={'trend-bar '+tone} style={{height:height+'%'}}/>
            </div>
            <small>{new Date(point.date+'T00:00:00').getDate()}</small>
          </div>;
        })}
      </div>
    </div>
    <div className="trend-legend control-tier-legend">
      <span><i className="legend-tier-1"/>Tier 1</span>
      <span><i className="legend-tier-2"/>Tier 2</span>
      <span><i className="legend-tier-3"/>Tier 3</span>
    </div>
  </div>;
}

export function KpiRegionDistrictView(props:Props) {
  const {area,selectedBranchId,trendMetric,activeTrend,onMetricChange,onBranchSelect,onBack,formatPercent,formatNumber,formatDate,niceAxisMax}=props;
  const branches=area.branches??[];
  const selectedBranch=branches.find(branch=>branch.id===selectedBranchId);
  const ranked=[...branches].filter(branch=>branch.ranking).sort((a,b)=>(b.ranking?.score??-1)-(a.ranking?.score??-1)||a.name.localeCompare(b.name));
  const formatValue=(value:number|null|undefined,isPercent:boolean)=>value==null?'—':isPercent?formatPercent(value):formatNumber(value);

  if(selectedBranch){
    const daily=selectedBranch.trend??[];
    return <div className="kpi-region-gerai-view">
      <div className="panel kpi-region-area-chart">
        <div className="panel-title">
          <div><span>GERAI KPI REGION</span><h3>{selectedBranch.name}</h3><small>Detail delapan indikator per tanggal pada periode aktif</small></div>
          <button className="back-scope back-nav" onClick={onBack}>← Kembali ke District</button>
        </div>
        <div className="kpi-region-selected-trend">
          <div className="panel-title">
            <div><span>PERFORMANCE TREND</span><h3>{activeTrend.label}</h3><small>Pergerakan harian pada periode aktif</small></div>
            <select className="trend-select" value={trendMetric} onChange={event=>onMetricChange(event.target.value as ControlTrendKey)}>
              {METRICS.map(metric=><option key={metric.key} value={metric.key}>{metric.label}</option>)}
            </select>
          </div>
          <TrendChart data={daily} metric={trendMetric} definition={activeTrend} formatPercent={formatPercent} formatNumber={formatNumber} formatDate={formatDate} niceAxisMax={niceAxisMax}/>
        </div>
        <div className="kpi-region-daily-table-wrap">
          <table><thead><tr><th>Tanggal</th><th>{activeTrend.label}</th><th>Tier</th></tr></thead>
            <tbody>{daily.length?daily.map(point=>{
              const value=point[activeTrend.field] as number|null|undefined;
              const tier=value==null?'No Data':(activeTrend.direction==='HIGHER'?value>=activeTrend.target:value<=activeTrend.target)?'Tier 1':(activeTrend.direction==='HIGHER'?value>=activeTrend.tier2:value<=activeTrend.tier2)?'Tier 2':'Tier 3';
              return <tr key={point.date}><td><strong>{formatDate(point.date)}</strong></td><td>{formatValue(value,activeTrend.percent)}</td><td>{tier}</td></tr>;
            }):<tr><td colSpan={3}>Data harian gerai belum tersedia.</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </div>;
  }

  const tierCounts=[1,2,3].map(number=>({
    label:'Tier '+number,
    count:branches.reduce((total,branch)=>total+(branch.ranking?.details.filter(detail=>detail.tier===('Tier '+number)).length??0),0),
  }));

  return <div className="kpi-region-area-view">
    <div className="kpi-region-selected-trend">
      <div className="panel-title">
        <div><span>PERFORMANCE TREND</span><h3>{activeTrend.label}</h3><small>Pergerakan harian pada periode aktif</small></div>
        <select className="trend-select" value={trendMetric} onChange={event=>onMetricChange(event.target.value as ControlTrendKey)}>
          {METRICS.map(metric=><option key={metric.key} value={metric.key}>{metric.label}</option>)}
        </select>
      </div>
      <TrendChart data={area.trend??[]} metric={trendMetric} definition={activeTrend} formatPercent={formatPercent} formatNumber={formatNumber} formatDate={formatDate} niceAxisMax={niceAxisMax}/>
    </div>
    <div className="kpi-region-health-strip">
      <strong>Distribusi Tier Gerai</strong>
      {tierCounts.map(item=><span key={item.label}>{item.label}: <b>{item.count}</b></span>)}
    </div>
    <div className="panel kpi-region-ranking">
      <div className="panel-title">
        <div><span>GERAI PERFORMANCE RANKING</span><h3>Ranking Gerai — {area.name}</h3><small>Urutan berdasarkan total poin delapan indikator KPI REGION</small></div>
        <span className="area-count">{ranked.length} gerai</span>
      </div>
      <div className="table-wrap area-performance-table">
        <table><thead><tr><th>Rank</th><th>Nama Gerai</th><th>SLA</th><th>COD Transferred</th><th>Failed Delivery</th><th>Backlog Rate</th><th>Sorter FM</th><th>Sorter LM</th><th>Kurir FM</th><th>Kurir LM</th><th>Ranking Point</th></tr></thead>
          <tbody>{ranked.length?ranked.map((branch,index)=>{
            const detail=(key:string)=>branch.ranking?.details.find(item=>item.key===key);
            const cell=(key:string,isPercent:boolean)=><td>{formatValue(detail(key)?.actual,isPercent)}</td>;
            return <tr key={branch.id} className="clickable-row" onClick={()=>onBranchSelect(branch.id)} title="Buka detail KPI REGION per tanggal">
              <td><strong>{index+1}</strong></td><td><strong>{branch.name}</strong></td>
              {cell('sla',true)}{cell('cod',true)}{cell('failed',true)}{cell('backlog',true)}
              {cell('sorterFm',false)}{cell('sorterLm',false)}{cell('courierFm',false)}{cell('courierLm',false)}
              <td><strong>{branch.ranking?.score.toFixed(1)??'—'}</strong><small className="ranking-max"> / 100</small></td>
            </tr>;
          }):<tr><td colSpan={11}>Data ranking gerai belum tersedia.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
