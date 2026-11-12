import { ExportButton } from '../components/ExportButton';

type ProductivityBranchExportProps = {
  role: 'courier' | 'sorter';
  mile: string;
  period: string | null;
  areaName: string;
  periodLabel?: string | null;
  activeRange?: { start: string; end: string } | null;
  data: any[];
  formatSigned: (value: number | null | undefined) => string;
  getTier: (value: number | null | undefined) => string | null;
};

export function ProductivityBranchExport({ role, mile, period, areaName, periodLabel, activeRange, data, formatSigned, getTier }: ProductivityBranchExportProps) {
  return (
    <ExportButton<any>
      module={`productivity-${role}-${mile.toLowerCase()}`}
      scope="gerai"
      period={period}
      sheetName={`Productivity ${role === 'courier' ? 'Kurir' : 'Sorter'} ${mile} by Gerai`}
      data={data}
      meta={[
        { label: 'Area', value: areaName },
        { label: 'Role', value: role === 'courier' ? 'Kurir' : 'Sorter' },
        { label: 'Mile', value: mile },
        { label: 'Periode', value: periodLabel ?? 'Periode aktif' },
        { label: 'Range', value: activeRange ? `${activeRange.start} s/d ${activeRange.end}` : '—' },
        { label: 'Jumlah Gerai', value: String(data.length) },
        { label: 'Diekspor', value: new Date().toLocaleString('id-ID') },
      ]}
      columns={[
        { header: 'No', value: (_row: any, i: number) => i + 1 },
        { header: 'Gerai', value: 'name' },
        { header: 'Kode', value: (row: any) => row.code ?? '—' },
        { header: 'Productivity', value: 'productivity', format: (v: unknown) => v == null ? '—' : Number(v).toFixed(2) },
        { header: 'Performa Sebelumnya', value: 'productivityPrevious', format: (v: unknown) => v == null ? '—' : Number(v).toFixed(2) },
        { header: 'Perubahan', value: (row: any) => row.productivity == null || row.productivityPrevious == null ? null : row.productivity - row.productivityPrevious, format: (v: unknown) => formatSigned(v == null ? null : Number(v)), type: 'signed-number' },
        { header: 'Tier', value: (row: any) => getTier(row.productivity) ?? '—' },
      ]}
    />
  );
}
