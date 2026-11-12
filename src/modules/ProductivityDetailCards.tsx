type ProductivityDetailCardsProps = {
  current: number | null | undefined;
  previous: number | null | undefined;
  previousPrevious: number | null | undefined;
  formatNumber: (value: number | null | undefined) => string;
};

export function ProductivityDetailCards({
  current,
  previous,
  previousPrevious,
  formatNumber,
}: ProductivityDetailCardsProps) {
  const delta = current == null || previous == null ? null : current - previous;
  const movement = delta == null ? 'neutral' : delta > 0 ? 'good' : delta < 0 ? 'review' : 'neutral';
  const priorDelta = previous == null || previousPrevious == null ? null : previous - previousPrevious;
  const priorMovement = priorDelta == null ? 'neutral' : priorDelta > 0 ? 'good' : priorDelta < 0 ? 'review' : 'neutral';

  return (
    <div className="productivity-detail-cards">
      <article className="metric-card productivity-current-card">
        <span>PRODUCTIVITY</span>
        <strong>{formatNumber(current)}</strong>
        <div className="productivity-card-context">
          <small>Periode aktif</small>
          <em className={movement}>
            {delta == null ? 'Pembanding belum tersedia' : delta > 0 ? `▲ +${Math.abs(delta).toFixed(2)} vs bulan lalu` : delta < 0 ? `▼ ${Math.abs(delta).toFixed(2)} vs bulan lalu` : '• Tetap vs bulan lalu'}
          </em>
        </div>
      </article>
      <article className="metric-card">
        <span>BULAN LALU</span>
        <strong>{formatNumber(previous)}</strong>
        <div className="productivity-card-context">
          <small>vs bulan sebelumnya</small>
          <em className={priorMovement}>
            {priorDelta == null ? 'Pembanding belum tersedia' : priorDelta > 0 ? `▲ +${Math.abs(priorDelta).toFixed(2)} vs sebelumnya` : priorDelta < 0 ? `▼ ${Math.abs(priorDelta).toFixed(2)} vs sebelumnya` : '• Tetap vs sebelumnya'}
          </em>
        </div>
      </article>
      <article className="metric-card">
        <span>PERUBAHAN</span>
        <strong className={movement}>{delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`}</strong>
        <div className="productivity-card-context">
          <small>vs bulan lalu</small>
          <em className={movement}>{delta == null ? 'Belum ada pembanding' : delta > 0 ? '▲ Naik' : delta < 0 ? '▼ Turun' : '• Tetap'}</em>
        </div>
      </article>
    </div>
  );
}
