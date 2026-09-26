import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Crown, DatabaseBackup, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Device, MeshSyncActionResult, MeshSyncStatus } from '@hermes-hub/types';

interface MeshPrimaryPanelProps {
  devices: Device[];
}

export const MeshPrimaryPanel: React.FC<MeshPrimaryPanelProps> = ({ devices }) => {
  const [status, setStatus] = useState<MeshSyncStatus | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const [actionConfirmed, setActionConfirmed] = useState(false);
  const [busy, setBusy] = useState<'load' | 'select' | 'publish' | 'adopt' | null>('load');
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null);

  const refresh = async () => {
    if (!window.hermesHub?.getMeshSyncStatus) return;
    setBusy('load');
    try {
      const next = await window.hermesHub.getMeshSyncStatus();
      setStatus(next);
      setSelectedId(next.policy?.primaryDeviceId || next.localDeviceId);
    } catch (error) {
      setNotice({ success: false, message: error instanceof Error ? error.message : 'Could not load mesh policy.' });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => { refresh(); }, []);

  const choosePrimary = async () => {
    if (!window.hermesHub || !selectionConfirmed || !selectedId) return;
    setBusy('select');
    setNotice(null);
    try {
      const next = await window.hermesHub.setPrimaryDevice(selectedId);
      setStatus(next);
      setSelectionConfirmed(false);
      setActionConfirmed(false);
      setNotice({ success: true, message: `${next.policy?.primaryDeviceName} is now the selected Main PC. Open Hermes Hub on that PC and publish its baseline.` });
    } catch (error) {
      setNotice({ success: false, message: error instanceof Error ? error.message : 'Could not select the Main PC.' });
    } finally {
      setBusy(null);
    }
  };

  const applyAction = (result: MeshSyncActionResult) => {
    setStatus(result.status);
    setActionConfirmed(false);
    setNotice({ success: result.success, message: `${result.message}${result.backupId ? ` Backup: ${result.backupId}` : ''}` });
  };

  const publish = async () => {
    if (!window.hermesHub || !actionConfirmed) return;
    setBusy('publish');
    setNotice(null);
    try { applyAction(await window.hermesHub.publishPrimaryBaseline(true)); }
    catch (error) { setNotice({ success: false, message: error instanceof Error ? error.message : 'Baseline publication failed.' }); }
    finally { setBusy(null); }
  };

  const adopt = async () => {
    if (!window.hermesHub || !actionConfirmed) return;
    setBusy('adopt');
    setNotice(null);
    try { applyAction(await window.hermesHub.adoptPrimaryBaseline(true)); }
    catch (error) { setNotice({ success: false, message: error instanceof Error ? error.message : 'Baseline copy failed.' }); }
    finally { setBusy(null); }
  };

  const primary = devices.find((device) => device.deviceId === status?.policy?.primaryDeviceId);
  const active = Boolean(busy);

  return <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-500"><Crown className="h-5 w-5" /></div>
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-foreground">Main PC &amp; Initial Copy</h3>{status?.policy && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{status.policy.phase === 'baseline-ready' ? 'Baseline ready' : 'Setup pending'}</span>}</div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Choose the PC with the Hermes setup you trust most. It publishes the first safe baseline; every other PC backs itself up before copying it. After that, newer memory and skill changes can flow in either direction.</p>
        </div>
      </div>
      <button onClick={refresh} disabled={active} className="self-start rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">Refresh status</button>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border border-border bg-card/80 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1 · Select the initial source</div>
        <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setSelectionConfirmed(false); }} disabled={active} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary">
          {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.deviceName} — {device.hostname}{device.deviceId === status?.localDeviceId ? ' (this PC)' : ''}</option>)}
        </select>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={selectionConfirmed} onChange={(event) => setSelectionConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span>I understand this selects the source for the first copy and resets any unfinished baseline setup.</span></label>
        <button onClick={choosePrimary} disabled={active || !selectionConfirmed || !selectedId} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{busy === 'select' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}Set as Main PC</button>
      </div>

      <div className="rounded-xl border border-border bg-card/80 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current state</div>
        {busy === 'load' ? <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Loading mesh policy…</div> : <>
          <div className="mt-3 text-sm font-semibold text-foreground">{primary?.deviceName || status?.policy?.primaryDeviceName || 'No Main PC selected'}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">This PC: {status?.localDeviceName || 'Unknown'} · Role: {status?.localRole || 'unconfigured'}</div>
          <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{status?.message || 'Select a Main PC to begin.'}</div>
        </>}
      </div>
    </div>

    {status?.policy && <div className="rounded-xl border border-border bg-card/80 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">2 · {status.localRole === 'primary' ? 'Publish this PC' : 'Copy to this PC'}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-background p-3 text-xs text-muted-foreground"><DatabaseBackup className="mb-2 h-4 w-4 text-indigo-500" /><strong className="block text-foreground">Automatic backup</strong>A recovery bundle is created before the baseline is published or copied.</div>
        <div className="rounded-lg bg-background p-3 text-xs text-muted-foreground"><ShieldCheck className="mb-2 h-4 w-4 text-emerald-500" /><strong className="block text-foreground">Safe files only</strong>Skills and memories are copied. Live databases, secrets, and Vault data stay local.</div>
        <div className="rounded-lg bg-background p-3 text-xs text-muted-foreground"><ArrowRightLeft className="mb-2 h-4 w-4 text-primary" /><strong className="block text-foreground">Then two-way</strong>After adoption, newer safe changes are shared back to every PC, including Main.</div>
      </div>

      {((status.localRole === 'primary' && status.canPublish) || status.canAdopt) && <>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={actionConfirmed} onChange={(event) => setActionConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span>{status.localRole === 'primary' ? 'I reviewed this PC and want its safe Hermes files to become the baseline.' : `I want to back up this PC, then overwrite matching safe files with ${status.policy.primaryDeviceName}'s baseline.`}</span></label>
        <button onClick={status.localRole === 'primary' ? publish : adopt} disabled={active || !actionConfirmed} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{busy === 'publish' || busy === 'adopt' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : status.localRole === 'primary' ? <ShieldCheck className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}{status.localRole === 'primary' ? 'Back Up & Publish Baseline' : 'Back Up & Copy Main PC'}</button>
      </>}

      {status.localRole === 'follower' && status.policy.phase !== 'baseline-ready' && <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">Open Hermes Hub on {status.policy.primaryDeviceName}, publish the baseline there, wait for Syncthing to finish, then refresh this panel.</div>}
      {status.baselineAdopted && <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Baseline complete. Use Sync Now for ongoing two-way change sharing.</div>}
    </div>}

    {notice && <div className={`rounded-lg border p-3 text-xs ${notice.success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}>{notice.message}</div>}
  </div>;
};
