import React from 'react';
import { Plus, Sun, Moon, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  title: string;
  onAddDevice: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
  syncHealth: 'all_synced' | 'syncing' | 'offline_changes' | 'has_conflicts';
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onAddDevice,
  onSyncNow,
  isSyncing,
  syncHealth,
}) => {
  const { isDark, setTheme } = useTheme();

  return (
    <header className="h-16 border-b border-border/60 bg-card/40 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground capitalize">
          {title}
        </h1>

        {/* Global Sync Status Banner */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Everything synchronized</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Sync Now Action */}
        <button
          onClick={onSyncNow}
          disabled={isSyncing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-all disabled:opacity-50"
          title="Trigger instantaneous Syncthing scan & sync"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isSyncing ? 'animate-spin text-primary' : ''}`} />
          <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>

        {/* Add Device Primary Button */}
        <button
          onClick={onAddDevice}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Add Device</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
