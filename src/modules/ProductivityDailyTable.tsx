import { ProductivityTierBadge } from './ProductivityTierBadge';

type ProductivityDailyRow = {
  date: string;
  productivityVolume?: number | null;
  productivityManpower?: number | null;
  productivity?: number | null;
};

type ProductivityDailyTableProps = {
  daily: ProductivityDailyRow[];
  mile: string;
  getTier: (value: number | null | undefined) => string | null;
  formatDate: (value: string) => string;
  formatNumber: (value: number | null | undefined) => string;
};

export function ProductivityDailyTable({
  daily,
  mile,
  getTier,
  formatDate,
  formatNumber,
}: ProductivityDailyTableProps) {
  return (
    <div className="table-wrap productivity-daily-table">
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Volume Paket {mile}</th>
            <th>Manpower {mile}</th>
            <th>Productivity</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {daily.length ? daily.map((item, index) => (
            <tr key={item.date}>
              <td>{index + 1}</td>
              <td>{formatDate(item.date)}</td>
              <td>{formatNumber(item.productivityVolume ?? null)}</td>
              <td>{formatNumber(item.productivityManpower ?? null)}</td>
              <td><strong>{formatNumber(item.productivity ?? null)}</strong></td>
              <td><ProductivityTierBadge tier={getTier(item.productivity)}/></td>
            </tr>
          )) : (
            <tr><td colSpan={6}>Data productivity harian belum tersedia.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
