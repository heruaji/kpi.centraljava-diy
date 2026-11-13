import { useEffect, useMemo, useState } from 'react';
import { getRegionDashboard } from '../services/dashboard';
import type { AreaPerformance, KpiDetail } from '../types/dashboard';

type Props = { areas: AreaPerformance[] };
type MonthRow = { month: number; label: string; area: AreaPerformance | null; error?: string };

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const number = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(v);
const percent = (v: number | null | undefined) => v == null ? '—' : `${number(v)}%`;

export function MonthlyPerformance({ areas }: Props) {
  const [year,setYear] = useState(new Date().getFullYear());
  const [areaId,setAreaId] = useState(areas[0]?.id ?? '');
  const [division,setDivision] = useState<'LM'|'FM'|'MM'>('LM');
  const [selectedMetric,setSelectedMetric] = useState('score');
  const [rows,setRows] = useState<MonthRow[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');

  useEffect(()=>{ if(!areas.some(a=>a.id===areaId) && areas[0]) setAreaId(areas[0].id); },[areas,areaId]);

  useEffect(()=>{
    let active=true;
    if(!areaId){setRows([]);setLoading(false);return ()=>{active=false;};}
    setLoading(true); setError('');
    const load=async()=>{
      const result:MonthRow[]=[];
      for(let index=0;index<MONTHS.length;index++){
        const label=MONTHS[index];
        const month=index+1;
        const start=`${year}-${String(month).padStart(2,'0')}-01`;
        const end=`${year}-${String(month).padStart(2,'0')}-${String(new Date(year,month,0).getDate()).padStart(2,'0')}`;
        try {
          const snapshot=await getRegionDashboard('MTD',{start,end});
          const area=snapshot.data.areas.find(item=>item.id===areaId) ?? null;
          result.push({month,label,area});
        } catch(err) {
          result.push({month,label,area:null,error:err instanceof Error?err.message:'Gagal memuat bulan'});
        }
        if(!active)return;
      }
      if(active) {
        setRows(result);
        const failed=result.filter(item=>item.error).length;
        if(failed===12) setError('Data bulanan belum dapat dimuat. Periksa endpoint API dan snapshot periode.');
      }
    };
    void load().finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[year,areaId]);

  const detailsKey=division==='LM'?'kpiDetailsLm':division==='FM'?'kpiDetailsFm':'kpiDetailsMm';
  const scoreKey=division==='LM'?'kpiLm':division==='FM'?'kpiFm':'kpiMm';
  const details=(area:AreaPerformance|null):KpiDetail[] => area ? ((area[detailsKey] as KpiDetail[]|undefined) ?? []) : [];
  const metricOptions=useMemo(()=>{
    const first=rows.find(r=>r.area);
    return [{key:'score',label:`KPI ${division} Score`},...details(first?.area??null).map(d=>({key:d.key,label:d.label}))];
  },[rows,division]);
  useEffect(()=>{if(!metricOptions.some(x=>x.key===selectedMetric))setSelectedMetric('score');},[metricOptions,selectedMetric]);

  const values=rows.map(row=>{
    const value=selectedMetric==='score'?(row.area?.[scoreKey] as number|null|undefined)??null:details(row.area).find(d=>d.key===selectedMetric)?.actual??null;
    const point=details(row.area).find(d=>d.key===selectedMetric);
    return {...row,value,tier:point?.tier??null};
  });
  const available=values.filter(v=>v.value!=null);
  const best=available.length?[...available].sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity))[0]:null;
  const worst=available.length?[...available].sort((a,b)=>(a.value??Infinity)-(b.value??Infinity))[0]:null;
  const selectedArea=areas.find(a=>a.id===areaId);

  return <section className="monthly-performance">
    <div className="monthly-heading"><div><span className="eyebrow">ANALISIS TAHUNAN</span><h2>Monthly Performance</h2><p>Agregasi KPI Area per bulan dalam satu tahun kalender.</p></div><span className="monthly-status">{loading?'Memuat snapshot bulanan…':error?'Perlu pemeriksaan':'12 periode diperiksa'}</span></div>
    <div className="monthly-filters">
      <label>Tahun<select value={year} onChange={e=>setYear(Number(e.target.value))}>{[new Date().getFullYear(),new Date().getFullYear()-1,new Date().getFullYear()-2].map(y=><option key={y} value={y}>{y}</option>)}</select></label>
      <label>Area<select value={areaId} onChange={e=>setAreaId(e.target.value)}>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>Divisi<select value={division} onChange={e=>setDivision(e.target.value as typeof division)}>{(['LM','FM','MM'] as const).map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Indikator<select value={selectedMetric} onChange={e=>setSelectedMetric(e.target.value)}>{metricOptions.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
    </div>
    {error&&<div className="monthly-error">{error}</div>}
    <div className="monthly-summary">
      <article><small>Area Terpilih</small><strong>{selectedArea?.name??'—'}</strong><span>{division} • {year}</span></article>
      <article><small>Bulan dengan Data</small><strong>{available.length} / 12</strong><span>Periode tersedia</span></article>
      <article><small>Performa Tertinggi</small><strong>{best?best.label:'—'}</strong><span>{best?percent(best.value):'Belum tersedia'}</span></article>
      <article><small>Performa Terendah</small><strong>{worst?worst.label:'—'}</strong><span>{worst?percent(worst.value):'Belum tersedia'}</span></article>
    </div>
    <article className="monthly-panel">
      <div className="monthly-panel-head"><div><span>MONTHLY TREND</span><h3>{metricOptions.find(m=>m.key===selectedMetric)?.label??'KPI Trend'}</h3><small>{selectedArea?.name??'Area'} • {division} • {year}</small></div><span className="monthly-unit">{selectedMetric==='score'||metricOptions.find(m=>m.key===selectedMetric)?.key!=='score'?'Actual':''}</span></div>
      <div className="monthly-chart">
        {values.map(item=><div className="monthly-bar-column" key={item.month} title={`${item.label}: ${percent(item.value)} ${item.tier??''}`}>
          <div className="monthly-bar-value">{item.value==null?'—':percent(item.value)}</div>
          <div className="monthly-bar-track"><i style={{height:item.value==null?'0%':`${Math.max(2,Math.min(100,item.value))}%`}}/></div>
          <small>{item.label}</small>
        </div>)}
      </div>
      <div className="monthly-legend"><span><i/>Actual bulanan</span><small>Data kosong ditampilkan sebagai —, bukan nol.</small></div>
    </article>
    <article className="monthly-panel">
      <div className="monthly-panel-head"><div><span>MONTHLY KPI MATRIX</span><h3>Ringkasan Indikator per Bulan</h3><small>Aktual dan Tier untuk setiap indikator {division}</small></div></div>
      <div className="monthly-table-wrap"><table><thead><tr><th>Indikator</th>{MONTHS.map(m=><th key={m}>{m}</th>)}</tr></thead><tbody>
        <tr><td><strong>KPI {division} Score</strong></td>{rows.map(r=><td key={r.month}>{percent((r.area?.[scoreKey] as number|null|undefined)??null)}</td>)}</tr>
        {metricOptions.filter(m=>m.key!=='score').map(metric=><tr key={metric.key}><td>{metric.label}</td>{rows.map(r=>{const d=details(r.area).find(x=>x.key===metric.key);return <td key={r.month} title={d?.tier??'No Data'}>{percent(d?.actual??null)}{d?.tier&&<small className="monthly-tier">{d.tier.replace('Tier ','T')}</small>}</td>})}</tr>)}
      </tbody></table></div>
    </article>
    <article className="monthly-panel">
      <div className="monthly-panel-head"><div><span>MONTHLY BREAKDOWN</span><h3>Detail Indikator Terpilih</h3><small>{metricOptions.find(m=>m.key===selectedMetric)?.label??'KPI'} • {selectedArea?.name??'Area'}</small></div></div>
      <div className="monthly-table-wrap"><table><thead><tr><th>Bulan</th><th>Actual</th><th>Tier</th><th>Status Data</th></tr></thead><tbody>{values.map(v=><tr key={v.month}><td><strong>{v.label} {year}</strong></td><td>{percent(v.value)}</td><td>{v.tier??'—'}</td><td>{v.error?'Gagal dimuat':v.value==null?'Belum ada data':'Tersedia'}</td></tr>)}</tbody></table></div>
      <p className="monthly-note">Catatan: angka aktual dan Tier diambil dari snapshot rentang tanggal masing-masing bulan. Numerator dan denominator tingkat Area belum disediakan oleh kontrak data dashboard saat ini; keduanya tidak direkayasa dari persentase. Sebelum final, bagian audit numerator/denominator perlu ditambahkan di API.</p>
    </article>
  </section>;
}
