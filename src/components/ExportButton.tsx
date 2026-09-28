// src/components/ExportButton.tsx
import { Download } from 'lucide-react';
import {
  exportToExcel,
  buildExportFilename,
  type ExportColumn,
} from '../lib/export';

type Props<T> = {
  /** Module identifier: 'kpi-lm', 'sla', 'productivity', dll */
  module: string;
  /** Scope identifier: 'area', 'branch', 'gerai', 'daily', dll */
  scope?: string;
  /** Periode label dari activeRange, mis: '2026-09-01_2026-09-26' */
  period?: string | null;
  /** Nama sheet di Excel */
  sheetName: string;
  /** Kolom-kolom yang di-export */
  columns: ExportColumn<T>[];
  /** Data yang di-export (biasanya sudah difilter) */
  data: T[];
  /** Meta tambahan di baris atas (opsional) */
  meta?: Array<{ label: string; value: string }>;
  /** Ukuran tombol */
  size?: 'sm' | 'md';
};

export function ExportButton<T>({
  module,
  scope,
  period,
  sheetName,
  columns,
  data,
  meta,
  size = 'sm',
}: Props<T>) {
  const handleClick = () => {
    if (!data || data.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    const filename = buildExportFilename({
      module,
      scope,
      period: period ?? undefined,
    });

    exportToExcel(columns, data, {
      filename,
      sheetName,
      meta,
    });
  };

  const disabled = !data || data.length === 0;

  return (
    <button
      type="button"
      className={`export-btn export-btn-${size}`}
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? 'Tidak ada data untuk di-export' : 'Export ke Excel'}
      aria-label="Export ke Excel"
    >
      <Download size={size === 'sm' ? 13 : 15} />
      <span>Export</span>
    </button>
  );
}