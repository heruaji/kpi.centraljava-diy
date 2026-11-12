type ProductivityBranchMovement = 'ALL' | 'UP' | 'DOWN' | 'STABLE';
type ProductivityBranchSort = 'current-desc' | 'current-asc' | 'change-desc' | 'change-asc';

type ProductivityBranchControlsProps = {
  query: string;
  onQueryChange: (value: string) => void;
  movement: ProductivityBranchMovement;
  onMovementChange: (value: ProductivityBranchMovement) => void;
  sort: ProductivityBranchSort;
  onSortChange: (value: ProductivityBranchSort) => void;
  branchCount: number;
};

export function ProductivityBranchControls({
  query,
  onQueryChange,
  movement,
  onMovementChange,
  sort,
  onSortChange,
  branchCount,
}: ProductivityBranchControlsProps) {
  return (
    <div className="productivity-branch-tools">
      <input
        className="table-search"
        type="search"
        placeholder="Cari gerai..."
        value={query}
        onChange={event => onQueryChange(event.target.value)}
      />
      <select
        className="productivity-sort productivity-movement-filter"
        value={movement}
        onChange={event => onMovementChange(event.target.value as ProductivityBranchMovement)}
        aria-label="Filter perubahan gerai"
      >
        <option value="ALL">Semua perubahan</option>
        <option value="UP">▲ Naik</option>
        <option value="DOWN">▼ Turun</option>
        <option value="STABLE">• Tetap</option>
      </select>
      <select
        className="productivity-sort"
        value={sort}
        onChange={event => onSortChange(event.target.value as ProductivityBranchSort)}
        aria-label="Urutkan gerai"
      >
        <option value="current-desc">Productivity tertinggi</option>
        <option value="current-asc">Productivity terendah</option>
        <option value="change-desc">Kenaikan terbesar</option>
        <option value="change-asc">Penurunan terbesar</option>
      </select>
      <span className="area-count">{branchCount} gerai</span>
    </div>
  );
}
