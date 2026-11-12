type ProductivityDeltaProps = {
  current: number | null | undefined;
  previous: number | null | undefined;
};

export function ProductivityDelta({ current, previous }: ProductivityDeltaProps) {
  const delta = current == null || previous == null ? null : current - previous;
  const className = delta == null ? 'productivity-delta neutral' : delta >= 0 ? 'productivity-delta good' : 'productivity-delta review';
  const label = delta == null ? '—' : `${delta >= 0 ? '▲ +' : '▼ '}${Math.abs(delta).toFixed(2)}`;

  return <span className={className}>{label}</span>;
}
