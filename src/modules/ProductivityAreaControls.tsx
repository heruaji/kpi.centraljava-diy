type ProductivitySortMode = 'current-desc' | 'current-asc' | 'change-desc' | 'change-asc';
type ProductivityMovement = 'ALL' | 'UP' | 'DOWN' | 'STABLE';

type ProductivityAreaControlsProps = {
  movement: ProductivityMovement;
  onMovementChange: (value: ProductivityMovement) => void;
  sort: ProductivitySortMode;
  onSortChange: (value: ProductivitySortMode) => void;
  areaCount: number;
};

export function ProductivityAreaControls({
  movement,
  onMovementChange,
  sort,
  onSortChange,
  areaCount,
}: ProductivityAreaControlsProps) {
  return (
    <>
      <select
        className="productivity-sort productivity-movement-filter"
        value={movement}
        onChange={event => onMovementChange(event.target.value as ProductivityMovement)}
        aria-label="Filter perubahan area"
      >
        <option value="ALL">Semua perubahan</option>
        <option value="UP">▲ Naik</option>
        <option value="DOWN">▼ Turun</option>
        <option value="STABLE">• Tetap</option>
      </select>
      <select
        className="productivity-sort"
        value={sort}
        onChange={event => onSortChange(event.target.value as ProductivitySortMode)}
        aria-label="Urutkan area"
      >
        <option value="current-desc">Productivity tertinggi</option>
        <option value="current-asc">Productivity terendah</option>
        <option value="change-desc">Kenaikan terbesar</option>
        <option value="change-asc">Penurunan terbesar</option>
      </select>
      <span className="area-count">{areaCount} area</span>
    </>
  );
}
