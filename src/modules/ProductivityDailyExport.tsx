import { ExportButton } from '../components/ExportButton';

type ProductivityDailyExportProps = {
  role: 'courier' | 'sorter';
  mile: string;
  period: string | null;
  branchName: string;
  areaName: string;
  periodLabel?: string | null;
  data: any[];
  getTier: (value: number | null | undefined) => string | null;
};

export function ProductivityDailyExport({ role, mile, period, branchName, areaName, periodLabel, data, getTier }: ProductivityDailyExportProps) {
  return (
    <ExportButton<any>
      module={`productivity-${role}-${mile.toLowerCase()}`}
      scope="daily"
      period={period}
      sheetName={`Productivity ${role === 'courier' ? 'Kurir' : 'Sorter'} ${mile} Daily`}
      data={data}
      meta={[
        { label: 'Gerai', value: branchName },
        { label: 'Area', value: areaName },
        { label: 'Role', value: role === 'courier' ? 'Kurir' : 'Sorter' },
        { label: 'Mile', value: mile },
        { label: 'Periode', value: periodLabel ?? 'Periode aktif' },
        { label: 'Jumlah Hari', value: String(data.length) },
        { label: 'Diekspor', value: new Date().toLocaleString('id-ID') },
      ]}
      columns={[
        { header: 'No', value: (_row: any, i: number) => i + 1 },
        { header: 'Tanggal', value: 'date', format: (v: unknown) => v == null ? '—' : new Date(`${String(v)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) },
        { header: `Volume Paket ${mile}`, value: 'productivityVolume', format: (v: unknown) => v == null ? '—' : Number(v).toLocaleString('id-ID') },
        { header: `Manpower ${mile}`, value: 'productivityManpower', format: (v: unknown) => v == null ? '—' : Number(v).toLocaleString('id-ID') },
        { header: 'Productivity', value: 'productivity', format: (v: unknown) => v == null ? '—' : Number(v).toFixed(2) },
        { header: 'Tier', value: (row: any) => getTier(row.productivity) ?? '—' },
      ]}
    />
  );
}
