import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Archive, Bot, Brain, CheckCircle2, CircleDollarSign, CloudCog, ExternalLink,
  FolderOpen, KeyRound, Laptop, Plug, RefreshCw, Send, ShieldCheck, Sparkles, Stethoscope,
  UploadCloud, Wrench, Zap,
} from 'lucide-react';
import {
  AppLocation, HermesBoosterActionResult, HermesBoosterStatus, HermesFile, HermesMemory,
  HermesSession, HermesSkill, ModelPriceInfo, SharedVaultStatus, VaultEnvironmentProfile,
} from '@hermes-hub/types';
import { formatBytes } from '@hermes-hub/shared';

interface HermesViewProps {
  sessions: HermesSession[];
  memories: HermesMemory[];
  skills: HermesSkill[];
  files: HermesFile[];
  vaultStatus: SharedVaultStatus | null;
  onRefreshAll: () => Promise<void>;
  onNavigate: (location: AppLocation) => void;
}

type Section = 'overview' | 'health' | 'extensions' | 'updates';

export const HermesView: React.FC<HermesViewProps> = ({ sessions, memories, skills, files, vaultStatus, onRefreshAll, onNavigate }) => {
  const [status, setStatus] = useState<any>(null);
  const [booster, setBooster] = useState<HermesBoosterStatus | null>(null);
  const [prices, setPrices] = useState<ModelPriceInfo[]>([]);
  const [environments, setEnvironments] = useState<VaultEnvironmentProfile[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [recordedCost, setRecordedCost] = useState(0);
  const [section, setSection] = useState<Section>('overview');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionOutput, setActionOutput] = useState('');
  const [pluginSearch, setPluginSearch] = useState('');

  const usedModels = useMemo(() => Array.from(new Set(sessions.map((session) => session.model).filter(Boolean))), [sessions]);
  const totalTokens = sessions.reduce((total, session) => total + (session.tokensUsed || 0), 0);
  const pluginFiles = files.filter((file) => /(^|[\\/])(plugins|desktop-plugins)[\\/]/i.test(file.path));
  const visiblePlugins = (booster?.extensions.plugins || []).filter((plugin) =>
    `${plugin.name} ${plugin.description}`.toLowerCase().includes(pluginSearch.toLowerCase()),
  );

  const load = async () => {
    if (!window.hermesHub) return;
    setBusy(true);
    try {
      const [nextStatus, nextBooster, nextPrices, nextEnvironments, details] = await Promise.all([
        window.hermesHub.getHermesStatus(),
        window.hermesHub.getHermesBoosterStatus(),
        usedModels.length ? window.hermesHub.getModelPricing(usedModels) : Promise.resolve([]),
        vaultStatus && !vaultStatus.locked ? window.hermesHub.getVaultEnvironments() : Promise.resolve([]),
        Promise.all(sessions.slice(0, 100).map((session) => window.hermesHub!.getSessionDetail(session.id).catch(() => null))),
      ]);
      setStatus(nextStatus);
      setBooster(nextBooster);
      setPrices(nextPrices);
      setEnvironments(nextEnvironments);
      setSelectedEnvironment((current) => current || nextEnvironments[0]?.id || '');
      setRecordedCost(details.reduce((total, detail) => total + (detail?.costUsd || 0), 0));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Hermes Booster status could not be loaded.');
    } finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, [usedModels.join('|'), vaultStatus?.revision, vaultStatus?.locked]);

  const refresh = async () => { await onRefreshAll(); await load(); setNotice('Hermes Booster data refreshed.'); };
  const runAction = async (action: () => Promise<HermesBoosterActionResult>) => {
    setBusy(true); setNotice(null); setActionOutput('');
    try {
      const result = await action();
      setNotice(`${result.message}${result.backupId ? ` Recovery backup: ${result.backupId}.` : ''}`);
      setActionOutput(result.output);
      await onRefreshAll();
      setBooster(await window.hermesHub!.getHermesBoosterStatus());
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Hermes action failed.'); }
    finally { setBusy(false); }
  };
  const importCredentials = async () => {
    if (!window.confirm('Import provider keys from the local Hermes .env file into encrypted Shared Vault?')) return;
    setBusy(true);
    try { const result = await window.hermesHub!.importHermesCredentials(true); setNotice(result.message); await onRefreshAll(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Credential import failed. Unlock Shared Vault first.'); }
    finally { setBusy(false); }
  };
  const applyEnvironment = async () => {
    const profile = environments.find((item) => item.id === selectedEnvironment);
    if (!profile || !window.confirm(`Apply ${profile.variables.length} variables from ${profile.name} to Hermes? A recovery backup will be created first.`)) return;
    await runAction(async () => {
      const result = await window.hermesHub!.applyVaultEnvironmentToHermes(profile.id, true);
      return { success: result.success, message: result.message, output: result.message, backupId: result.backupId };
    });
  };
  const updateHermes = async () => {
    if (!window.confirm('Update Hermes using its official updater? Hermes Hub will create a recovery backup first. Close Hermes Desktop, active Hermes terminals, and gateways if the updater reports locked files.')) return;
    await runAction(() => window.hermesHub!.updateHermes(true));
  };
  const updateSkills = async () => {
    if (!window.confirm('Update Hermes hub-installed skills? Locally modified skills are preserved, and a recovery backup is created first.')) return;
    await runAction(() => window.hermesHub!.updateHermesSkills(true));
  };
  const syncSkills = async () => {
    if (!window.confirm('Run Hermes Skill Sync now? This may pull and push skills configured in your Hermes account.')) return;
    await runAction(() => window.hermesHub!.syncHermesSkills(true));
  };
  const updatePlugin = async (name: string) => {
    if (!window.confirm(`Update the Hermes plugin “${name}” using its configured update source?`)) return;
    await runAction(() => window.hermesHub!.updateHermesPlugin(name, true));
  };
  const togglePlugin = async (name: string, enabled: boolean) => {
    if (!window.confirm(`${enabled ? 'Enable' : 'Disable'} the Hermes plugin “${name}”?`)) return;
    await runAction(() => window.hermesHub!.setHermesPluginEnabled(name, enabled));
  };

  const modules = [
    { icon: Stethoscope, title: 'Health & diagnostics', detail: booster?.health.summary || 'Run Hermes Doctor and inspect every dependency.', action: () => setSection('health') },
    { icon: KeyRound, title: 'Credentials', detail: `${vaultStatus?.secretCount || 0} encrypted secrets and environment profiles.`, action: () => onNavigate({ tab: 'vault' }) },
    { icon: Brain, title: 'Memory manager', detail: `${memories.length} live Hermes memory files with backup-first editing.`, action: () => onNavigate({ tab: 'memory' }) },
    { icon: Plug, title: 'Skills, MCPs & plugins', detail: `${skills.length} skills · ${booster?.extensions.mcpServers || 0} MCP servers · ${booster?.extensions.plugins.length || 0} plugins.`, action: () => setSection('extensions') },
    { icon: Laptop, title: 'Cross-PC Hermes sync', detail: 'Main-PC baseline, bidirectional supported files, and conflict protection.', action: () => onNavigate({ tab: 'devices' }) },
    { icon: Archive, title: 'Backup & recovery', detail: 'Snapshots, revision rollback, recovery artifacts, and migration bundles.', action: () => onNavigate({ tab: 'backups' }) },
    { icon: CircleDollarSign, title: 'Usage & costs', detail: `${sessions.length} sessions · ${totalTokens.toLocaleString()} tokens · $${recordedCost.toFixed(4)} recorded.`, action: () => setSection('overview') },
    { icon: Wrench, title: 'Repair guidance', detail: `${booster?.health.warnings || 0} warnings and ${booster?.health.errors || 0} errors from Hermes Doctor.`, action: () => setSection('health') },
    { icon: UploadCloud, title: 'Update center', detail: booster?.update.available ? 'A Hermes update is available.' : 'Hermes update status and application updates.', action: () => setSection('updates') },
  ];

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-card to-card p-6 shadow-xl shadow-primary/5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><Bot className="h-7 w-7" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold">Hermes Booster</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${status?.isRunning ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{status?.isRunning ? 'Hermes running' : status?.isInstalled ? 'Hermes installed' : 'Hermes unavailable'}</span></div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage, protect, synchronize, diagnose, and update the existing Hermes app. Hermes Hub does not replace its chat or agent experience.</p><p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{status?.homeDirectory || 'Detecting Hermes…'} · {status?.version || 'unknown version'}</p></div></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => window.hermesHub?.openHermesApp()} className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary"><ExternalLink className="h-4 w-4" />Open Hermes App</button><button onClick={() => status?.homeDirectory && window.hermesHub?.openFolder(status.homeDirectory)} disabled={!status?.homeDirectory} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"><FolderOpen className="h-4 w-4" />Open data</button><button onClick={() => void refresh()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button></div>
      </div>
    </section>

    {notice && <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-primary" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} className="font-bold">Dismiss</button></div>}
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">{(['overview', 'health', 'extensions', 'updates'] as Section[]).map((item) => <button key={item} onClick={() => setSection(item)} className={`rounded-xl px-4 py-2 text-xs font-semibold capitalize ${section === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{item}</button>)}</div>

    {section === 'overview' && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modules.map(({ icon: Icon, title, detail, action }) => <button key={title} onClick={action} className="group rounded-2xl border border-border bg-card/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><strong className="mt-3 block text-sm">{title}</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{detail}</span></button>)}</section>
      <div className="grid gap-5 xl:grid-cols-5">
        <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 xl:col-span-3"><h3 className="font-bold">Live Hermes inventory</h3><div className="grid gap-3 sm:grid-cols-2"><Inventory label="Files" value={files.length} detail={`${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} indexed`} /><Inventory label="Memories" value={memories.length} detail="Editable with automatic recovery" /><Inventory label="Skills" value={skills.length} detail={`${skills.reduce((sum, skill) => sum + skill.filesCount, 0)} files`} /><Inventory label="Plugin files" value={pluginFiles.length} detail="Managed by the Hermes plugin system" /></div><div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-600 dark:text-amber-300">Live databases, WAL/SHM files, locks, and binaries are inventoried but never synchronized or edited.</div></section>
        <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 xl:col-span-2"><div><h3 className="font-bold">Credential bridge</h3><p className="mt-1 text-xs text-muted-foreground">Move provider credentials between encrypted Shared Vault profiles and Hermes.</p></div>{vaultStatus?.locked ? <button onClick={() => onNavigate({ tab: 'vault' })} className="w-full rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-600">Unlock Shared Vault</button> : <><select value={selectedEnvironment} onChange={(event) => setSelectedEnvironment(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Select Vault environment</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name} · {environment.variables.length} variables</option>)}</select><button onClick={() => void applyEnvironment()} disabled={busy || !selectedEnvironment} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" />Apply profile to Hermes</button><button onClick={() => void importCredentials()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted"><KeyRound className="h-4 w-4" />Import Hermes keys into Vault</button></>}</section>
      </div>
      <Pricing prices={prices} />
      <section className="rounded-2xl border border-border bg-card/80 p-5"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><div><h3 className="font-bold">Hermes usage insights</h3><p className="text-xs text-muted-foreground">The installed Hermes app calculated these 30-day token, cost, tool, and activity patterns.</p></div></div><pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-[10px] leading-relaxed">{booster?.insights || 'No Hermes usage insight report was returned yet.'}</pre></section>
    </>}

    {section === 'health' && <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="flex items-center gap-2 font-bold"><Stethoscope className="h-5 w-5 text-primary" />Hermes Health & Diagnostics</h3><p className="mt-1 text-xs text-muted-foreground">Results come directly from the installed Hermes Doctor command.</p></div><button onClick={() => void runAction(() => window.hermesHub!.runHermesDoctor())} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Run Doctor again</button></div><div className="grid gap-3 sm:grid-cols-3"><Status label="Passed" value={booster?.health.passed || 0} tone="emerald" /><Status label="Warnings" value={booster?.health.warnings || 0} tone="amber" /><Status label="Errors" value={booster?.health.errors || 0} tone="rose" /></div><pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-[11px] leading-relaxed">{actionOutput || booster?.health.report || 'Health report is loading…'}</pre></section>}

    {section === 'extensions' && <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">Skills</h3><p className="text-xs text-muted-foreground">Uses Hermes’ own registry, updater, and cross-device Skill Sync.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void syncSkills()} disabled={busy} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">Sync skills now</button><button onClick={() => void updateSkills()} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Check & update skills</button></div></div>
        <pre className="mt-4 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-[10px]">{booster?.extensions.skillUpdates || booster?.extensions.skillSync || booster?.extensions.skillsSummary || 'Loading skills…'}</pre>
      </section>
      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">MCP servers & tools</h3><p className="text-xs text-muted-foreground">Live Hermes configuration: {booster?.extensions.mcpServers || 0} MCP servers and {booster?.extensions.enabledTools || 0} enabled tools.</p></div><button onClick={() => window.hermesHub?.openHermesApp()} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">Add or configure in Hermes</button></div>
        <div className="mt-3 flex flex-wrap gap-2">{booster?.extensions.mcpNames.map((name) => <button key={name} onClick={() => void runAction(() => window.hermesHub!.testHermesMcp(name))} disabled={busy} className="rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-semibold hover:border-primary/40">Test {name}</button>)}</div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2"><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-[10px]">{booster?.extensions.mcpSummary || 'No MCP servers reported.'}</pre><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-[10px]">{booster?.extensions.toolsSummary || 'No tools reported.'}</pre></div>
      </section>
      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">Plugins ({visiblePlugins.length})</h3><p className="text-xs text-muted-foreground">Enable or disable plugins through Hermes’ native plugin manager.</p></div><input value={pluginSearch} onChange={(event) => setPluginSearch(event.target.value)} placeholder="Search plugins…" className="h-10 rounded-xl border border-input bg-background px-3 text-xs" /></div>
        <div className="mt-4 grid max-h-[36rem] gap-2 overflow-auto pr-1 lg:grid-cols-2">{visiblePlugins.map((plugin, index) => <article key={`${plugin.source}:${plugin.name}:${index}`} className="rounded-xl border border-border bg-background/60 p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-xs">{plugin.name}</strong><div className="mt-0.5 font-mono text-[9px] text-muted-foreground">v{plugin.version} · {plugin.source}</div></div><button onClick={() => void togglePlugin(plugin.name, plugin.status !== 'enabled')} disabled={busy} className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${plugin.status === 'enabled' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>{plugin.status === 'enabled' ? 'Enabled' : 'Disabled'}</button></div><p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-muted-foreground">{plugin.description}</p>{plugin.source !== 'bundled' && <button onClick={() => void updatePlugin(plugin.name)} disabled={busy} className="mt-3 rounded-lg border border-border px-2.5 py-1 text-[10px] font-semibold hover:bg-muted">Update plugin</button>}</article>)}</div>
      </section>
    </div>}

    {section === 'updates' && <div className="grid gap-5 lg:grid-cols-2"><section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5"><div className="flex items-center gap-3"><CloudCog className="h-6 w-6 text-primary" /><div><h3 className="font-bold">Hermes Agent update</h3><p className="text-xs text-muted-foreground">Current: {booster?.update.currentVersion || status?.version || 'unknown'}</p></div></div><div className={`rounded-xl border p-3 text-xs ${!booster?.update.checkSucceeded ? 'border-rose-500/20 bg-rose-500/10 text-rose-500' : booster?.update.available ? 'border-amber-500/20 bg-amber-500/10 text-amber-600' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'}`}>{!booster?.update.checkSucceeded ? 'Hermes could not complete its update check. Review the output below.' : booster?.update.available ? 'An update is available.' : 'No newer Hermes update was detected.'}</div><pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-[10px]">{booster?.update.summary || 'Checking…'}</pre><button onClick={() => void updateHermes()} disabled={busy || !booster?.available} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">Update Hermes safely</button></section><section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5"><div className="flex items-center gap-3"><UploadCloud className="h-6 w-6 text-primary" /><div><h3 className="font-bold">Hermes Hub update</h3><p className="text-xs text-muted-foreground">GitHub Releases updater for this companion application.</p></div></div><p className="text-xs leading-relaxed text-muted-foreground">Application updates, automatic checks, and restart behavior remain separate from Hermes updates.</p><button onClick={() => onNavigate({ tab: 'settings', section: 'updates' })} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted">Open Hub update settings</button><button onClick={() => onNavigate({ tab: 'backups' })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted"><ShieldCheck className="h-4 w-4" />Open recovery center</button></section>{actionOutput && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-[11px] lg:col-span-2">{actionOutput}</pre>}</div>}
  </div>;
};

const Inventory: React.FC<{ label: string; value: number; detail: string }> = ({ label, value, detail }) => <div className="rounded-xl border border-border bg-background/60 p-3"><div className="flex items-center justify-between"><span className="text-xs font-semibold">{label}</span><span className="text-lg font-bold text-primary">{value.toLocaleString()}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>;
const Status: React.FC<{ label: string; value: number; tone: 'emerald' | 'amber' | 'rose' }> = ({ label, value, tone }) => {
  const colors = tone === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : tone === 'amber' ? 'border-amber-500/20 bg-amber-500/10 text-amber-500' : 'border-rose-500/20 bg-rose-500/10 text-rose-500';
  return <div className={`rounded-xl border p-4 ${colors}`}><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
};
const Pricing: React.FC<{ prices: ModelPriceInfo[] }> = ({ prices }) => <section className="rounded-2xl border border-border bg-card/80 p-5"><div><h3 className="font-bold">Live model prices</h3><p className="mt-1 text-xs text-muted-foreground">Current OpenRouter catalog prices for models found in Hermes sessions.</p></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr><th className="px-3 py-2">Model</th><th className="px-3 py-2">Context</th><th className="px-3 py-2">Input / 1M</th><th className="px-3 py-2">Output / 1M</th></tr></thead><tbody className="divide-y divide-border/50">{prices.map((price) => <tr key={price.id}><td className="px-3 py-3"><strong>{price.name}</strong><span className="block font-mono text-[10px] text-muted-foreground">{price.id}</span></td><td className="px-3 py-3 font-mono">{price.contextLength.toLocaleString()}</td><td className="px-3 py-3 font-mono">${price.promptUsdPerMillion.toFixed(3)}</td><td className="px-3 py-3 font-mono">${price.completionUsdPerMillion.toFixed(3)}</td></tr>)}{!prices.length && <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">No public pricing matched the models in local sessions.</td></tr>}</tbody></table></div></section>;
