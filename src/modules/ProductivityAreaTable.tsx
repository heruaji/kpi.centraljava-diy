import { ProductivityDelta } from './ProductivityDelta';
import { ProductivityTierBadge } from './ProductivityTierBadge';

type ProductivityAreaRow = {
  id: string;
  name: string;
  productivity?: number | null;
  productivityPrevious?: number | null;
};

type ProductivityAreaTableProps = {
  areas: ProductivityAreaRow[];
  getTier: (value: number | null | undefined) => string | null;
  formatNumber: (value: number | null | undefined) => string;
  onSelectArea: (id: string) => void;
};

export function ProductivityAreaTable({
  areas,
  getTier,
  formatNumber,
  onSelectArea,
}: ProductivityAreaTableProps) {
  return (
    <div className="table-wrap productivity-area-table">
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Area</th>
            <th>Productivity</th>
            <th>Performa Sebelumnya</th>
            <th>Perubahan</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {areas.length ? areas.map((area, index) => (
            <tr key={area.id} className="clickable-row" onClick={() => onSelectArea(area.id)}>
              <td>{index + 1}</td>
              <td><strong>{area.name}</strong></td>
              <td><strong>{formatNumber(area.productivity ?? null)}</strong></td>
              <td>{formatNumber(area.productivityPrevious ?? null)}</td>
              <td><ProductivityDelta current={area.productivity} previous={area.productivityPrevious}/></td>
              <td><ProductivityTierBadge tier={getTier(area.productivity)}/></td>
            </tr>
          )) : (
            <tr><td colSpan={6}>Data productivity belum tersedia.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
