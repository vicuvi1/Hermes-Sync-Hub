import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, CircleDollarSign, FolderOpen, KeyRound, Plug, RefreshCw, Send, Sparkles, Zap } from 'lucide-react';
import { HermesFile, HermesMemory, HermesSession, HermesSkill, ModelPriceInfo, SharedVaultStatus, VaultEnvironmentProfile } from '@hermes-hub/types';
import { formatBytes } from '@hermes-hub/shared';

interface HermesViewProps {
  sessions: HermesSession[];
  memories: HermesMemory[];
  skills: HermesSkill[];
  files: HermesFile[];
  vaultStatus: SharedVaultStatus | null;
  onRefreshAll: () => Promise<void>;
}

export const HermesView: React.FC<HermesViewProps> = ({ sessions, memories, skills, files, vaultStatus, onRefreshAll }) => {
  const [status, setStatus] = useState<any>(null);
  const [prices, setPrices] = useState<ModelPriceInfo[]>([]);
  const [environments, setEnvironments] = useState<VaultEnvironmentProfile[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [recordedCost, setRecordedCost] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const usedModels = useMemo(() => Array.from(new Set(sessions.map((session) => session.model).filter(Boolean))), [sessions]);
  const totalTokens = sessions.reduce((total, session) => total + (session.tokensUsed || 0), 0);
  const pluginFiles = files.filter((file) => /(^|[\\/])(plugins|desktop-plugins)[\\/]/i.test(file.path));

  const load = async () => {
    if (!window.hermesHub) return;
    setBusy(true);
    try {
      const [nextStatus, nextPrices, nextEnvironments, details] = await Promise.all([
        window.hermesHub.getHermesStatus(),
        usedModels.length ? window.hermesHub.getModelPricing(usedModels) : Promise.resolve([]),
        vaultStatus && !vaultStatus.locked ? window.hermesHub.getVaultEnvironments() : Promise.resolve([]),
        Promise.all(sessions.slice(0, 100).map((session) => window.hermesHub!.getSessionDetail(session.id).catch(() => null))),
      ]);
      setStatus(nextStatus);
      setPrices(nextPrices);
      setEnvironments(nextEnvironments);
      setSelectedEnvironment((current) => current || nextEnvironments[0]?.id || '');
      setRecordedCost(details.reduce((total, detail) => total + (detail?.costUsd || 0), 0));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Hermes status could not be loaded.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, [usedModels.join('|'), vaultStatus?.revision, vaultStatus?.locked]);

  const refresh = async () => { await onRefreshAll(); await load(); setNotice('Hermes inventory and pricing refreshed.'); };
  const importCredentials = async () => {
    if (!window.confirm('Import provider keys from the local Hermes .env file into the encrypted Shared Vault? Secret values will never be displayed in this screen.')) return;
    setBusy(true);
    try { const result = await window.hermesHub!.importHermesCredentials(true); setNotice(result.message); await onRefreshAll(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Credential import failed. Unlock Shared Vault first.'); }
    finally { setBusy(false); }
  };
  const applyEnvironment = async () => {
    if (!selectedEnvironment) return;
    const profile = environments.find((item) => item.id === selectedEnvironment);
    if (!window.confirm(`Apply ${profile?.variables.length || 0} variables from ${profile?.name || 'this profile'} to Hermes? They will be written to the local Hermes .env file, and a recovery backup will be created first.`)) return;
    setBusy(true);
    try { const result = await window.hermesHub!.applyVaultEnvironmentToHermes(selectedEnvironment, true); setNotice(result.message); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The environment could not be applied to Hermes.'); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-card to-card p-6 shadow-xl shadow-primary/5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><Bot className="h-7 w-7" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold">Hermes Control Center</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${status?.isRunning ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{status?.isRunning ? 'Running' : status?.isInstalled ? 'Installed' : 'Unavailable'}</span></div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Live connection to the local Hermes runtime, files, knowledge, extensions, credentials, requests, and model costs.</p><p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{status?.homeDirectory || 'Detecting Hermes…'} · {status?.version || 'unknown version'} · {status?.profile || 'default'} profile</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => status?.homeDirectory && window.hermesHub?.openFolder(status.homeDirectory)} disabled={!status?.homeDirectory} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"><FolderOpen className="h-4 w-4" />Open Hermes</button><button onClick={() => void refresh()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh all</button></div></div>
    </section>

    {notice && <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-primary"><span>{notice}</span><button onClick={() => setNotice(null)} className="font-bold">Dismiss</button></div>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Metric icon={Zap} label="Requests" value={sessions.length.toLocaleString()} detail="discovered sessions" />
      <Metric icon={Sparkles} label="Tokens" value={totalTokens.toLocaleString()} detail="recorded or estimated" />
      <Metric icon={CircleDollarSign} label="Spend" value={`$${recordedCost.toFixed(4)}`} detail="reported by Hermes" />
      <Metric icon={Bot} label="Models" value={usedModels.length.toString()} detail="used locally" />
      <Metric icon={Plug} label="Extensions" value={(skills.length + pluginFiles.length).toLocaleString()} detail={`${skills.length} skills + plugin files`} />
      <Metric icon={KeyRound} label="Vault" value={(vaultStatus?.secretCount || 0).toString()} detail={vaultStatus?.locked ? 'locked' : 'encrypted secrets'} />
    </section>

    <div className="grid gap-5 xl:grid-cols-5">
      <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 xl:col-span-3"><div><h3 className="font-bold">Complete local inventory</h3><p className="mt-1 text-xs text-muted-foreground">Everything discovered under the active Hermes home. Runtime-managed files remain metadata-only.</p></div><div className="grid gap-3 sm:grid-cols-2"><Inventory label="Files" value={files.length} detail={`${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} indexed`} /><Inventory label="Memories" value={memories.length} detail={memories.map((memory) => memory.title).slice(0, 3).join(', ') || 'None found'} /><Inventory label="Skills" value={skills.length} detail={`${skills.reduce((sum, skill) => sum + skill.filesCount, 0)} files inside skills`} /><Inventory label="Plugin files" value={pluginFiles.length} detail="plugins and desktop-plugins" /></div><div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-600 dark:text-amber-300">Live SQLite databases, WAL/SHM files, locks, and binaries are visible in Synced files but are never opened or edited by Hermes Hub.</div></section>

      <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 xl:col-span-2"><div><h3 className="font-bold">Credential bridge</h3><p className="mt-1 text-xs text-muted-foreground">Move provider credentials between encrypted Shared Vault profiles and the local Hermes environment without exposing values to this screen.</p></div>{vaultStatus?.locked ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">Unlock Shared Vault before using the bridge.</div> : <><select value={selectedEnvironment} onChange={(event) => setSelectedEnvironment(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Select a Vault environment</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name} · {environment.variables.length} variables</option>)}</select><button onClick={() => void applyEnvironment()} disabled={busy || !selectedEnvironment} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" />Apply profile to Hermes</button><button onClick={() => void importCredentials()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-40"><KeyRound className="h-4 w-4" />Import Hermes keys into Vault</button></>}</section>
    </div>

    <section className="rounded-2xl border border-border bg-card/80 p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-bold">Live model prices</h3><p className="mt-1 text-xs text-muted-foreground">Current OpenRouter catalog prices for models found in local Hermes sessions. Prices are informational and may differ by provider route.</p></div>{prices[0] && <span className="text-[10px] text-muted-foreground">Updated {new Date(prices[0].fetchedAt).toLocaleString()}</span>}</div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr><th className="px-3 py-2">Model</th><th className="px-3 py-2">Context</th><th className="px-3 py-2">Input / 1M</th><th className="px-3 py-2">Output / 1M</th></tr></thead><tbody className="divide-y divide-border/50">{prices.map((price) => <tr key={price.id}><td className="px-3 py-3"><strong>{price.name}</strong><span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{price.id}</span></td><td className="px-3 py-3 font-mono">{price.contextLength.toLocaleString()}</td><td className="px-3 py-3 font-mono">${price.promptUsdPerMillion.toFixed(3)}</td><td className="px-3 py-3 font-mono">${price.completionUsdPerMillion.toFixed(3)}</td></tr>)}{!prices.length && <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">No matching public pricing was found for the models in local sessions.</td></tr>}</tbody></table></div>
    </section>
  </div>;
};

const Metric: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail: string }> = ({ icon: Icon, label, value, detail }) => <article className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><strong className="mt-1 block text-xl">{value}</strong><span className="text-[10px] text-muted-foreground">{detail}</span></article>;
const Inventory: React.FC<{ label: string; value: number; detail: string }> = ({ label, value, detail }) => <div className="rounded-xl border border-border bg-background/60 p-3"><div className="flex items-center justify-between"><span className="text-xs font-semibold">{label}</span><span className="text-lg font-bold text-primary">{value.toLocaleString()}</span></div><p className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</p></div>;
