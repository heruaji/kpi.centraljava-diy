type ProductivityBranchDetailHeaderProps = {
  branchName: string;
  areaName: string;
  branchCode?: string | null;
  periodLabel: string;
  onBack: () => void;
};

export function ProductivityBranchDetailHeader({
  branchName,
  areaName,
  branchCode,
  periodLabel,
  onBack,
}: ProductivityBranchDetailHeaderProps) {
  return (
    <div className="productivity-detail-head">
      <div>
        <span>GERAI PRODUCTIVITY</span>
        <h3>{branchName}</h3>
        <small>{areaName} • {branchCode || '—'} • {periodLabel}</small>
      </div>
      <button className="back-scope back-nav" onClick={onBack}>
        ← Kembali ke Daftar Gerai
      </button>
    </div>
  );
}
