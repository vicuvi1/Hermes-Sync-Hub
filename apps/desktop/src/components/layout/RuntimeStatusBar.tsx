import React from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { AppUpdateProgress, RuntimeHealth } from '@hermes-hub/types';

interface RuntimeStatusBarProps {
  health: RuntimeHealth | null;
  update: AppUpdateProgress | null;
  loading: boolean;
  onRetry: () => void;
  onOpenSettings: () => void;
}

export const RuntimeStatusBar: React.FC<RuntimeStatusBarProps> = ({ health, update, loading, onRetry, onOpenSettings }) => {
  const ready = health?.overall === 'ready';
  const updateAvailable = update?.state === 'available';
  return <div className={`flex min-h-9 items-center gap-3 border-b px-4 text-[11px] sm:px-6 lg:px-8 ${ready ? 'border-emerald-500/15 bg-emerald-500/5' : 'border-amber-500/15 bg-amber-500/5'}`}>
    {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" /> : ready ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
    <span className="font-medium text-foreground">{loading ? 'Checking local services…' : ready ? 'All required services ready' : health ? 'Setup needs attention' : 'Runtime status unavailable'}</span>
    {health && <span className="hidden text-muted-foreground md:inline">{Object.values(health.services).filter((service) => service.state === 'healthy').length}/5 services healthy</span>}
    {updateAvailable && <button onClick={onOpenSettings} className="ml-auto rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">Update {update.latestVersion} available</button>}
    {!updateAvailable && !ready && <button onClick={onOpenSettings} className="ml-auto text-amber-600 hover:underline dark:text-amber-400">Review setup</button>}
    {!updateAvailable && ready && <button onClick={onRetry} aria-label="Refresh service health" className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>}
    {!health && !loading && <CloudOff className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
  </div>;
};
