import React, { useEffect, useState } from 'react';
import { Download, Github, LoaderCircle, RotateCw, Shield } from 'lucide-react';
import { AppUpdateProgress } from '@hermes-hub/types';

const BUSY_STATES = new Set(['checking', 'downloading', 'installing', 'restart-pending']);

export const UpdateSettingsSection: React.FC = () => {
  const [status, setStatus] = useState<AppUpdateProgress | null>(null);
  const [autoCheck, setAutoCheck] = useState(true);

  useEffect(() => {
    window.hermesHub?.getAppSettings?.().then((settings) => setAutoCheck(settings.autoCheckUpdates));
    return window.hermesHub?.onUpdateStatus?.(setStatus);
  }, []);

  const toggleAutoCheck = async () => {
    const next = !autoCheck;
    setAutoCheck(next);
    await window.hermesHub?.updateAppSettings?.({ autoCheckUpdates: next });
  };

  const update = async () => {
    if (!window.hermesHub) return;
    const checked = await window.hermesHub.checkForUpdates();
    setStatus(checked);
    if (checked.state === 'available') {
      const downloading = await window.hermesHub.downloadAndInstallUpdate();
      setStatus(downloading);
    }
  };

  const busy = status ? BUSY_STATES.has(status.state) : false;
  const disabled = status?.state === 'disabled';
  const icon = status?.state === 'restart-pending' ? RotateCw : status?.state === 'downloading' ? Download : Github;
  const Icon = icon;
  const message = status?.message || 'Check GitHub Releases, download a verified build, and restart automatically.';

  return <div className="space-y-3">
    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Application Updates</h3>
    <div className="rounded-xl border border-border bg-card/70 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border bg-background p-2.5 text-foreground"><Github className="h-5 w-5" /></div>
          <div><div className="text-sm font-semibold text-foreground">GitHub Update</div><div className={`mt-1 max-w-2xl text-xs ${status?.state === 'failed' || status?.state === 'offline' ? 'text-rose-500' : status?.state === 'current' ? 'text-emerald-500' : 'text-muted-foreground'}`}>{message}</div><div className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Shield className="h-3 w-3 text-emerald-500" />Versioned release · no Git or Node required</div></div>
        </div>
        <button onClick={update} disabled={busy || disabled} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}<span>{status?.state === 'downloading' ? `Downloading ${status.percent || 0}%` : status?.state === 'restart-pending' ? 'Restarting…' : 'GitHub Update'}</span></button>
      </div>
      {status?.state === 'downloading' && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${status.percent || 0}%` }} /></div>}
      {status && <div className="mt-3 font-mono text-[10px] text-muted-foreground">Installed: v{status.currentVersion}{status.latestVersion ? ` · Latest: v${status.latestVersion}` : ''}</div>}
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>Silently check for new GitHub Releases after startup</span>
        <input type="checkbox" checked={autoCheck} onChange={toggleAutoCheck} className="h-4 w-4 accent-primary" />
      </label>
    </div>
  </div>;
};
