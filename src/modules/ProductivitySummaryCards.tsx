type ProductivityAreaSummaryItem = {
  name?: string;
  productivity?: number | null;
  productivityPrevious?: number | null;
};

type ProductivitySummaryCardsProps = {
  region: number | null | undefined;
  regionDelta: number | null | undefined;
  periodLabel: string;
  top: ProductivityAreaSummaryItem | null;
  low: ProductivityAreaSummaryItem | null;
  formatNumber: (value: number | null | undefined) => string;
};

function AreaComparison({ item }: { item: ProductivityAreaSummaryItem }) {
  const current = item.productivity ?? null;
  const previous = item.productivityPrevious ?? null;
  const delta = current == null || previous == null ? null : current - previous;
  const tone = delta == null ? 'neutral' : delta > 0 ? 'good' : delta < 0 ? 'review' : 'neutral';

  return (
    <>
      <small>{item.name ?? 'Belum ada data'}</small>
      <em className={tone}>
        {delta == null ? 'Belum ada pembanding' : delta > 0 ? `▲ +${delta.toFixed(2)}` : delta < 0 ? `▼ ${Math.abs(delta).toFixed(2)}` : '• Tetap'}
      </em>
    </>
  );
}

export function ProductivitySummaryCards({
  region,
  regionDelta,
  periodLabel,
  top,
  low,
  formatNumber,
}: ProductivitySummaryCardsProps) {
  const regionTone = regionDelta == null ? 'neutral' : regionDelta > 0 ? 'good' : regionDelta < 0 ? 'review' : 'neutral';

  return (
    <div className="productivity-summary-grid">
      <article className="metric-card">
        <span>PRODUCTIVITY REGION</span>
        <strong>{formatNumber(region)}</strong>
        <div className="productivity-card-context">
          <small>Central Java - DIY • {periodLabel}</small>
          <em className={regionTone}>
            {regionDelta == null ? 'Pembanding belum tersedia' : regionDelta > 0 ? `▲ +${Math.abs(regionDelta).toFixed(2)} vs sebelumnya` : regionDelta < 0 ? `▼ ${Math.abs(regionDelta).toFixed(2)} vs sebelumnya` : '• Tetap vs sebelumnya'}
          </em>
        </div>
      </article>
      <article className="metric-card">
        <span>AREA TERTINGGI</span>
        <strong>{top ? formatNumber(top.productivity ?? null) : '—'}</strong>
        <div className="productivity-card-context">{top ? <AreaComparison item={top} /> : <small>Belum ada data</small>}</div>
      </article>
      <article className="metric-card">
        <span>AREA PERLU PERHATIAN</span>
        <strong>{low ? formatNumber(low.productivity ?? null) : '—'}</strong>
        <div className="productivity-card-context">{low ? <AreaComparison item={low} /> : <small>Belum ada data</small>}</div>
      </article>
    </div>
  );
}
