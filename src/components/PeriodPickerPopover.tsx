// src/components/PeriodPickerPopover.tsx
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { id as idLocale } from 'date-fns/locale';

export type PeriodPreset =
  | 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30'
  | 'WTD' | 'MTD' | 'YTD';

type Props = {
  periodPreset: PeriodPreset;
  customRange: { start: string; end: string } | null;
  periodLabel: string;
  onChange: (preset: PeriodPreset, customRange: { start: string; end: string } | null) => void;
};

const PRESETS: { value: PeriodPreset; label: string; desc: string }[] = [
  { value: 'TODAY', label: 'Hari Ini', desc: 'Hari ini' },
  { value: 'YESTERDAY', label: 'Kemarin', desc: 'Kemarin' },
  { value: 'LAST_7', label: '7 Hari', desc: '7 hari terakhir' },
  { value: 'LAST_30', label: '30 Hari', desc: '30 hari terakhir' },
  { value: 'WTD', label: 'WTD', desc: 'Week to date' },
  { value: 'MTD', label: 'MTD', desc: 'Month to date' },
  { value: 'YTD', label: 'YTD', desc: 'Year to date' },
];

function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateShort(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(d)
    .replace(/\./g, '');
}

function formatDateShort(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(d)
    .replace(/\./g, '');
}

export function PeriodPickerPopover({
  periodPreset,
  customRange,
  periodLabel,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    if (open) {
      setDraftRange(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const handlePreset = (preset: PeriodPreset) => {
    onChange(preset, null);
    setOpen(false);
  };

  const handleSelect = (range: DateRange | undefined) => {
    setDraftRange(range);
  };

  const rangeComplete =
    draftRange?.from && draftRange?.to
      ? dateToIso(draftRange.from) !== dateToIso(draftRange.to) ||
        !!draftRange.to
      : false;

  const handleApply = () => {
    if (!draftRange?.from || !draftRange?.to) return;
    onChange(periodPreset, {
      start: dateToIso(draftRange.from),
      end: dateToIso(draftRange.to),
    });
    setOpen(false);
    setDraftRange(undefined);
  };

  const clearCustom = () => {
    setDraftRange(undefined);
    onChange('MTD', null);
  };

  const isPresetActive = !customRange;

  return (
    <div className="period-picker-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`period-picker-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Pilih periode"
      >
        <CalendarDays size={16} />
        <span className="period-picker-content">
          <span className="period-picker-caption">Periode Aktif</span>
          <span className="period-picker-value">{periodLabel}</span>
        </span>
        <ChevronDown size={14} className="period-picker-chevron" />
      </button>

      {open && (
        <div
          className="period-picker-popover"
          role="dialog"
          aria-label="Pilih periode"
        >
          <div className="period-picker-head">
            <strong>Pilih Periode</strong>
            <small>Data dihitung berdasarkan tanggal data terbaru</small>
          </div>

          <div className="period-picker-chips">
            {PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                className={`period-chip ${
                  isPresetActive && periodPreset === p.value ? 'active' : ''
                }`}
                onClick={() => handlePreset(p.value)}
                title={p.desc}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="period-picker-divider">
            <span>Custom Range</span>
            {customRange && (
              <button
                type="button"
                className="period-picker-clear"
                onClick={clearCustom}
              >
                Reset
              </button>
            )}
          </div>

          <div className="period-picker-cal">
            <DayPicker
              mode="range"
              numberOfMonths={1}
              selected={draftRange}
              onSelect={handleSelect}
              locale={idLocale}
              weekStartsOn={1}
              showOutsideDays={false}
            />
          </div>

          <div className="period-picker-footer">
            <div className="period-picker-range-info">
              {draftRange?.from && draftRange?.to ? (
                <>
                  <span>Terpilih:</span>
                  <strong>
                    {formatDateShort(draftRange.from)} — {formatDateShort(draftRange.to)}
                  </strong>
                </>
              ) : draftRange?.from ? (
                <>
                  <span>Awal:</span>
                  <strong>{formatDateShort(draftRange.from)}</strong>
                  <em>· pilih tanggal akhir</em>
                </>
              ) : (
                <em>Pilih tanggal awal lalu tanggal akhir</em>
              )}
            </div>
            <button
              type="button"
              className="period-picker-apply"
              disabled={!draftRange?.from || !draftRange?.to}
              onClick={handleApply}
            >
              Tampilkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
