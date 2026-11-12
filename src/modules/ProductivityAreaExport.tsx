import { ExportButton } from '../components/ExportButton';

type ProductivityAreaExportProps = {
  role: 'courier' | 'sorter';
  mile: string;
  period: string | null;
  activeRangeLabel?: string | null;
  activeRange?: { start: string; end: string } | null;
  data: any[];
  formatSigned: (value: number | null | undefined) => string;
  getTier: (value: number | null | undefined) => string | null;
};

export function ProductivityAreaExport({
  role,
  mile,
  period,
  activeRangeLabel,
  activeRange,
  data,
  formatSigned,
  getTier,
}: ProductivityAreaExportProps) {
  return (
    <ExportButton<any>
      module={`productivity-${role}-${mile}`}
      scope="area"
      period={period}
      sheetName={`Productivity ${role === 'courier' ? 'Kurir' : 'Sorter'} ${mile.toUpperCase()} by Area`}
      data={data}
      meta={[
        { label: 'Role', value: role === 'courier' ? 'Kurir' : 'Sorter' },
        { label: 'Mile', value: mile.toUpperCase() },
        { label: 'Periode', value: activeRangeLabel ?? 'Periode aktif' },
        { label: 'Range', value: activeRange ? `${activeRange.start} s/d ${activeRange.end}` : '—' },
        { label: 'Jumlah Area', value: String(data.length) },
        { label: 'Diekspor', value: new Date().toLocaleString('id-ID') },
      ]}
      columns={[
        { header: 'No', value: (_row: any, i: number) => i + 1 },
        { header: 'Area', value: 'name' },
        { header: 'Productivity', value: 'productivity', format: (v: unknown) => (v == null ? '—' : Number(v).toFixed(2)) },
        { header: 'Performa Sebelumnya', value: 'productivityPrevious', format: (v: unknown) => (v == null ? '—' : Number(v).toFixed(2)) },
        { header: 'Perubahan', value: (row: any) => row.productivity == null || row.productivityPrevious == null ? null : row.productivity - row.productivityPrevious, format: (v: unknown) => formatSigned(v == null ? null : Number(v)), type: 'signed-number' },
        { header: 'Tier', value: (row: any) => getTier(row.productivity) ?? '—' },
      ]}
    />
  );
}
