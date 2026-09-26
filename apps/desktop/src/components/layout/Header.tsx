import React from 'react';
import { Plus, Sun, Moon, RefreshCw, CheckCircle2, AlertTriangle, Menu, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  title: string;
  onAddDevice: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
  syncHealth: 'all_synced' | 'syncing' | 'offline_changes' | 'has_conflicts';
  onOpenNavigation: () => void;
  onOpenCommandPalette: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onAddDevice,
  onSyncNow,
  isSyncing,
  syncHealth,
  onOpenNavigation,
  onOpenCommandPalette,
}) => {
  const { isDark, setTheme } = useTheme();

  return (
    <header className="h-16 border-b border-border/60 bg-card/70 backdrop-blur-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button aria-label="Open navigation" onClick={onOpenNavigation} className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:text-foreground lg:hidden">
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-foreground capitalize">
          {title}
        </h1>

        {/* Global Sync Status Banner */}
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${syncHealth === 'all_synced' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
          {syncHealth === 'all_synced' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{syncHealth === 'all_synced' ? 'Everything synchronized' : syncHealth.replace(/_/g, ' ')}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onOpenCommandPalette} className="hidden xl:flex min-w-48 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
          <Search className="h-3.5 w-3.5" /><span>Quick actions</span><kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
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
