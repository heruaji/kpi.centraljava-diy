import { memo, type ReactNode } from 'react';
import { Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import { PeriodPickerPopover } from './PeriodPickerPopover';
import type { DashboardPeriod } from '../services/dashboard';

type Props = {
  titleContent: ReactNode;
  faqOpen: boolean;
  onOpenMobileMenu: () => void;
  onRefresh: () => void;
  loading: boolean;
  refreshing: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeModule: string;
  periodPreset: DashboardPeriod;
  customRange: { start: string; end: string } | null;
  periodLabel: string;
  onPeriodChange: (preset: DashboardPeriod, customRange: { start: string; end: string } | null) => void;
};

function DashboardTopbarView({
  titleContent, faqOpen, onOpenMobileMenu, onRefresh, loading, refreshing,
  theme, onToggleTheme, activeModule, periodPreset, customRange, periodLabel, onPeriodChange,
}: Props) {
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onOpenMobileMenu}><Menu size={22}/></button>
      {titleContent}
      {!faqOpen && (
        <div className="topbar-actions" onClick={e => e.stopPropagation()}>
          <button className="theme-toggle refresh-button" onClick={onRefresh} disabled={loading || refreshing} title="Refresh data sekarang">
            <RefreshCw size={15} className={refreshing ? 'refresh-spin' : ''}/>
            <span>{refreshing ? 'Memperbarui...' : 'Refresh Data'}</span>
          </button>
          <button className="theme-toggle" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}
            <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
          <PeriodPickerPopover
            key={activeModule}
            periodPreset={periodPreset}
            customRange={customRange}
            periodLabel={periodLabel}
            onChange={onPeriodChange}
          />
        </div>
      )}
    </header>
  );
}

export const DashboardTopbar = memo(DashboardTopbarView);
