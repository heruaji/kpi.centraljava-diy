import { ProductivityDelta } from './ProductivityDelta';
import { ProductivityTierBadge } from './ProductivityTierBadge';

type ProductivityBranchRow = {
  id: string;
  name: string;
  productivity?: number | null;
  productivityPrevious?: number | null;
};

type ProductivityBranchTableProps = {
  branches: ProductivityBranchRow[];
  getTier: (value: number | null | undefined) => string | null;
  formatNumber: (value: number | null | undefined) => string;
  onSelectBranch: (id: string) => void;
};

export function ProductivityBranchTable({
  branches,
  getTier,
  formatNumber,
  onSelectBranch,
}: ProductivityBranchTableProps) {
  return (
    <div className="table-wrap productivity-branch-table">
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Gerai</th>
            <th>Productivity</th>
            <th>Performa Sebelumnya</th>
            <th>Perubahan</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {branches.length ? branches.map((branch, index) => (
            <tr key={branch.id} className="clickable-row" onClick={() => onSelectBranch(branch.id)}>
              <td>{index + 1}</td>
              <td><strong>{branch.name}</strong></td>
              <td><strong>{formatNumber(branch.productivity ?? null)}</strong></td>
              <td>{formatNumber(branch.productivityPrevious ?? null)}</td>
              <td><ProductivityDelta current={branch.productivity} previous={branch.productivityPrevious}/></td>
              <td><ProductivityTierBadge tier={getTier(branch.productivity)}/></td>
            </tr>
          )) : (
            <tr><td colSpan={6}>Data gerai productivity belum tersedia.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
