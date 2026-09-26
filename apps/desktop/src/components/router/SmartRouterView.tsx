import React, { useEffect, useState } from 'react';
import {
  Activity, Bot, BrainCircuit, CheckCircle2, Coins, Gauge, History, KeyRound, LoaderCircle, Network, Play,
  Plus, RefreshCw, Route, Save, Search, ShieldCheck, Sparkles, TestTube2, XCircle,
} from 'lucide-react';
import type {
  CreateHermesBotInput, OpenRouterCatalogModel, OpenRouterHermesTestResult, RouterExecutionRecord, RouterModel, RouterPolicy, RouterTaskCategory,
  RoutingDecision, RoutingSimulationInput, SmartRouterState,
} from '@hermes-hub/types';

type Tab = 'overview' | 'connection' | 'bots' | 'models' | 'rules' | 'simulator' | 'history';
const categories: RouterTaskCategory[] = ['general', 'coding', 'research', 'writing', 'analysis', 'vision', 'tool-use'];

const money = (value: number) => `$${value.toFixed(value < 0.01 ? 4 : 2)}`;
const titleCase = (value: string) => value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const SmartRouterView: React.FC = () => {
  const [state, setState] = useState<SmartRouterState | null>(null);
  const [draft, setDraft] = useState<RouterPolicy | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<RoutingDecision | null>(null);
  const [execution, setExecution] = useState<RouterExecutionRecord | null>(null);
  const [task, setTask] = useState<RoutingSimulationInput>({ prompt: '', botId: 'default', fileCount: 0, estimatedContextTokens: 0, requiresTools: false, requiresVision: false });
  const [botForm, setBotForm] = useState<CreateHermesBotInput>({ profile: '', name: '', description: '', defaultPoolId: '', skills: [], cloneFrom: 'default' });
  const [modelForm, setModelForm] = useState({ provider: 'openrouter', model: '', label: '', prompt: '0', completion: '0', context: '131072' });
  const [catalogModels, setCatalogModels] = useState<OpenRouterCatalogModel[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogFreeOnly, setCatalogFreeOnly] = useState(true);
  const [catalogToolsOnly, setCatalogToolsOnly] = useState(false);
  const [profileSetup, setProfileSetup] = useState({ profile: 'default', primaryModelId: '', fallbackModelIds: [] as string[] });
  const [connectionTest, setConnectionTest] = useState<OpenRouterHermesTestResult | null>(null);

  const load = async () => {
    setBusy('load'); setError('');
    try {
      if (!window.hermesHub?.getSmartRouterState) throw new Error('The Smart Router desktop bridge is unavailable.');
      const next = await window.hermesHub.getSmartRouterState();
      setState(next); setDraft(structuredClone(next.policy));
      setBotForm((current) => ({ ...current, defaultPoolId: current.defaultPoolId || next.policy.pools[0]?.id || '' }));
      setProfileSetup((current) => ({ ...current, profile: next.bots.some((bot) => bot.profile === current.profile) ? current.profile : next.bots[0]?.profile || 'default', primaryModelId: current.primaryModelId || next.policy.models.find((model) => model.enabled && model.provider === 'openrouter')?.id || '' }));
    } catch (reason: any) { setError(reason?.message || 'Unable to load Smart Router.'); }
    finally { setBusy(''); }
  };
  useEffect(() => { void load(); }, []);

  const commitPolicy = async () => {
    if (!draft || !window.hermesHub) return;
    setBusy('save'); setError(''); setNotice('');
    try {
      const policy = await window.hermesHub.saveSmartRouterPolicy(draft);
      setState((current) => current ? { ...current, policy, classifier: { ...current.classifier, mode: policy.classifierMode, model: policy.localSemanticModel, state: policy.classifierMode === 'deterministic' ? 'disabled' : current.classifier.state === 'ready' ? 'ready' : 'not-downloaded', message: policy.classifierMode === 'deterministic' ? 'Deterministic zero-credit classification is active.' : current.classifier.state === 'ready' ? 'Local semantic classification is ready.' : 'Prepare the local semantic model once before using it.' } } : current); setDraft(structuredClone(policy));
      setNotice('Routing policy saved. New Hermes tasks will use these rules.');
    } catch (reason: any) { setError(reason?.message || 'Policy could not be saved.'); }
    finally { setBusy(''); }
  };

  const refreshCatalog = async () => {
    if (!window.hermesHub) return;
    setBusy('catalog'); setError('');
    try { const next = await window.hermesHub.refreshRouterCatalog(); setState(next); setDraft(structuredClone(next.policy)); setNotice(next.catalog.message); }
    catch (reason: any) { setError(reason?.message || 'Catalog refresh failed.'); }
    finally { setBusy(''); }
  };

  const verifyOpenRouter = async () => {
    if (!window.hermesHub) return;
    setBusy('openrouter'); setError(''); setNotice('');
    try {
      const openRouter = await window.hermesHub.testOpenRouterConnection();
      setState((current) => current ? { ...current, openRouter } : current);
      setNotice(openRouter.message);
    } catch (reason: any) { setError(reason?.message || 'OpenRouter could not be verified.'); }
    finally { setBusy(''); }
  };

  const searchCatalog = async () => {
    if (!window.hermesHub) return;
    setBusy('model-search'); setError('');
    try { setCatalogModels(await window.hermesHub.searchOpenRouterModels(catalogQuery, catalogFreeOnly, catalogToolsOnly)); }
    catch (reason: any) { setError(reason?.message || 'OpenRouter models could not be loaded.'); }
    finally { setBusy(''); }
  };

  const addCatalogModel = (entry: OpenRouterCatalogModel) => {
    if (!draft) return;
    const id = `openrouter:${entry.id}`;
    if (draft.models.some((model) => model.id === id)) { setNotice(`${entry.name} is already in your policy.`); return; }
    setDraft({ ...draft, models: [...draft.models, { id, provider: 'openrouter', model: entry.id, label: entry.name, class: entry.free ? 'free' : 'paid', enabled: true, approvedForPaidUse: false, contextLength: entry.contextLength, promptUsdPerMillion: entry.promptUsdPerMillion, completionUsdPerMillion: entry.completionUsdPerMillion, capabilities: ['text', ...(entry.supportsTools ? ['tools' as const] : []), ...(entry.supportsVision ? ['vision' as const] : []), ...(entry.contextLength >= 128_000 ? ['long-context' as const] : [])], catalogCheckedAt: new Date().toISOString() }] });
    setNotice(`${entry.name} added to the policy draft. Add it to a pool, then save.`);
  };

  const configureProfile = async () => {
    if (!window.hermesHub || !profileSetup.primaryModelId) return;
    const primary = draft?.models.find((model) => model.id === profileSetup.primaryModelId);
    if (!window.confirm(`Apply ${primary?.label || 'this model'} and ${profileSetup.fallbackModelIds.length} fallback(s) to Hermes profile “${profileSetup.profile}”?\n\nA recovery backup will be created first.`)) return;
    setBusy('profile-config'); setError(''); setConnectionTest(null);
    try {
      const bot = await window.hermesHub.configureHermesProfileRouting({ ...profileSetup, confirmed: true });
      setState((current) => current ? { ...current, bots: current.bots.map((item) => item.id === bot.id ? bot : item) } : current);
      setNotice(`Hermes profile ${bot.profile} now uses ${bot.hermesModel} with ${bot.hermesFallbacks?.length || 0} fallback(s).`);
    } catch (reason: any) { setError(reason?.message || 'Hermes profile routing could not be updated.'); }
    finally { setBusy(''); }
  };

  const testHermesConnection = async () => {
    if (!window.hermesHub || !profileSetup.primaryModelId) return;
    const model = draft?.models.find((item) => item.id === profileSetup.primaryModelId);
    if (!window.confirm(`Send one tiny live test through Hermes using ${model?.label || 'the selected model'}?\n\nFree models spend no money but do use OpenRouter request quota. Paid models may incur a very small charge.`)) return;
    setBusy('hermes-test'); setError(''); setConnectionTest(null);
    try { const result = await window.hermesHub.testHermesOpenRouter(profileSetup.profile, profileSetup.primaryModelId, true); setConnectionTest(result); setNotice(result.message); }
    catch (reason: any) { setError(reason?.message || 'The live Hermes/OpenRouter test failed.'); }
    finally { setBusy(''); }
  };

  const prepareLocalRouter = async () => {
    if (!window.hermesHub || !window.confirm('Download and cache the open-source local embedding model?\n\nThis uses disk space and internet bandwidth once, but never spends provider or model credits.')) return;
    setBusy('semantic'); setError(''); setNotice('');
    try {
      const next = await window.hermesHub.prepareLocalRouter(true);
      setState(next); setDraft(structuredClone(next.policy));
      setNotice('Local semantic routing is ready. No API credits are used for classification.');
    } catch (reason: any) { setError(reason?.message || 'The local semantic model could not be prepared.'); }
    finally { setBusy(''); }
  };

  const createBot = async () => {
    if (!window.hermesHub || !window.confirm(`Create the native Hermes profile “${botForm.profile}” and configure its default model?`)) return;
    setBusy('bot'); setError('');
    try {
      await window.hermesHub.createHermesBot({ ...botForm, skills: botForm.skills || [] }, true);
      setBotForm({ profile: '', name: '', description: '', defaultPoolId: draft?.pools[0]?.id || '', skills: [], cloneFrom: 'default' });
      await load(); setNotice('Native Hermes bot profile created.');
    } catch (reason: any) { setError(reason?.message || 'Bot could not be created.'); }
    finally { setBusy(''); }
  };

  const simulate = async () => {
    if (!window.hermesHub) return;
    setBusy('simulate'); setError(''); setExecution(null);
    try { setDecision(await window.hermesHub.simulateSmartRoute(task)); setTab('simulator'); }
    catch (reason: any) { setError(reason?.message || 'Task could not be classified.'); }
    finally { setBusy(''); }
  };

  const execute = async () => {
    if (!window.hermesHub || !decision || decision.blocked) return;
    const model = decision.selectedModel;
    if (!window.confirm(`Run this task with ${model?.label}?\n\nRoute: ${decision.paid ? 'APPROVED PAID' : 'FREE'}\nEstimated maximum cost: ${money(decision.estimatedCostUsd)}\nProfile: ${decision.botId}`)) return;
    setBusy('execute'); setError('');
    try { const record = await window.hermesHub.executeSmartRoute({ ...task, confirmed: true }); setExecution(record); setNotice(record.status === 'success' ? 'Hermes completed the routed task.' : 'Hermes returned a failure. Review the output.'); await load(); setTab('simulator'); }
    catch (reason: any) { setError(reason?.message || 'Routed task failed.'); }
    finally { setBusy(''); }
  };

  const addModel = () => {
    if (!draft) return;
    const provider = modelForm.provider.trim().toLowerCase(); const model = modelForm.model.trim();
    if (!provider || !model) { setError('Provider and exact model ID are required.'); return; }
    const id = `${provider}:${model}`;
    if (draft.models.some((item) => item.id === id)) { setError('That model is already configured.'); return; }
    const prompt = Number(modelForm.prompt || 0); const completion = Number(modelForm.completion || 0); const isFree = prompt === 0 && completion === 0;
    const next: RouterModel = { id, provider, model, label: modelForm.label.trim() || model, class: isFree ? 'free' : 'paid', enabled: true, approvedForPaidUse: false, contextLength: Number(modelForm.context || 0), promptUsdPerMillion: prompt, completionUsdPerMillion: completion, capabilities: ['text'] };
    setDraft({ ...draft, models: [...draft.models, next] });
    setModelForm({ provider: 'openrouter', model: '', label: '', prompt: '0', completion: '0', context: '131072' });
    setNotice('Model added to the draft. Add it to a pool and save the policy.');
  };

  const addRule = () => {
    if (!draft || !draft.pools.length) return;
    setDraft({
      ...draft,
      rules: [...draft.rules, {
        id: `routing-${Date.now()}`,
        name: 'New routing rule',
        enabled: true,
        priority: Math.max(0, ...draft.rules.map((rule) => rule.priority)) + 10,
        minimumComplexity: 0,
        maximumComplexity: 100,
        categories: [],
        poolId: draft.pools[0].id,
      }],
    });
  };

  const approvedPaid = draft?.models.filter((model) => model.class === 'paid' && model.approvedForPaidUse).length || 0;
  const freeModels = draft?.models.filter((model) => model.class === 'free' && model.enabled).length || 0;
  const selectedBot = state?.bots.find((bot) => bot.id === (task.botId || 'default'));
  if (!state || !draft) return <div className="flex min-h-[55vh] items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading Smart Router…</div>;

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: Gauge }, { id: 'connection', label: 'OpenRouter live', icon: Network }, { id: 'bots', label: 'Bots', icon: Bot }, { id: 'models', label: 'Models & pools', icon: Coins },
    { id: 'rules', label: 'Routing logic', icon: Route }, { id: 'simulator', label: 'Simulator', icon: Play }, { id: 'history', label: 'History', icon: History },
  ];

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-xl">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div className="flex gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><BrainCircuit className="h-7 w-7" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black">Smart Model Router</h2><span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-500">Free first</span><span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-400">Native Hermes profiles</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Classify each task locally, choose the cheapest capable allowed model, and escalate only to paid models you explicitly approve. Hermes remains the agent runtime.</p></div></div><div className="flex gap-2"><button onClick={() => void refreshCatalog()} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === 'catalog' ? 'animate-spin' : ''}`} />Refresh prices</button><button onClick={() => void commitPolicy()} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />Save policy</button></div></div>
    </section>

    {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-xs ${error ? 'border-rose-500/25 bg-rose-500/10 text-rose-400' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'}`}>{error || notice}</div>}

    <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex min-w-fit items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${tab === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>

    {tab === 'connection' && <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><KeyRound className="h-5 w-5" /></span><div><h3 className="font-bold">OpenRouter connection</h3><p className="mt-1 text-xs text-muted-foreground">Uses the key already stored in Hermes. The renderer never receives it.</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${state.openRouter.state === 'ready' ? 'bg-emerald-500/10 text-emerald-500' : state.openRouter.state === 'invalid' || state.openRouter.state === 'not-configured' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-500'}`}>{state.openRouter.state}</span></div>
          <p className="mt-4 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">{state.openRouter.message}</p>
          {state.openRouter.state === 'ready' && <div className="mt-4 grid grid-cols-2 gap-3"><DecisionMetric label="Tier" value={state.openRouter.isFreeTier ? 'Free' : 'Funded'} /><DecisionMetric label="Remaining" value={state.openRouter.remainingUsd == null ? 'No fixed limit' : money(state.openRouter.remainingUsd)} /><DecisionMetric label="Usage" value={state.openRouter.usageUsd == null ? 'Unknown' : money(state.openRouter.usageUsd)} /><DecisionMetric label="Key" value={state.openRouter.keyLabel || 'Verified'} /></div>}
          <button onClick={() => void verifyOpenRouter()} disabled={Boolean(busy)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy === 'openrouter' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Verify without spending credits</button>
          {state.openRouter.state === 'not-configured' && <p className="mt-3 text-xs leading-5 text-amber-400">Open Shared Vault, save OPENROUTER_API_KEY in an environment profile, and use “Apply to Hermes.” Then return here and verify.</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><h3 className="font-bold">Connect routing to a real Hermes profile</h3></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Writes the primary model and ordered fallback chain into Hermes itself. Hermes remains the runtime even when Hub is closed.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="block text-xs font-semibold">Hermes profile<select value={profileSetup.profile} onChange={(event) => setProfileSetup({ ...profileSetup, profile: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">{state.bots.filter((bot) => bot.nativeProfileDetected).map((bot) => <option key={bot.id} value={bot.profile}>{bot.name} · {bot.profile}</option>)}</select></label><label className="block text-xs font-semibold">Primary model<select value={profileSetup.primaryModelId} onChange={(event) => setProfileSetup({ ...profileSetup, primaryModelId: event.target.value, fallbackModelIds: profileSetup.fallbackModelIds.filter((id) => id !== event.target.value) })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">{draft.models.filter((model) => model.enabled && model.provider === 'openrouter').map((model) => <option key={model.id} value={model.id}>{model.label} · {model.class}</option>)}</select></label></div>
          <div className="mt-4"><p className="text-xs font-semibold">Ordered fallback models</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{draft.models.filter((model) => model.enabled && model.provider === 'openrouter' && model.id !== profileSetup.primaryModelId && (model.class === 'free' || model.approvedForPaidUse)).map((model) => <label key={model.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background p-3 text-xs"><input type="checkbox" checked={profileSetup.fallbackModelIds.includes(model.id)} onChange={(event) => setProfileSetup({ ...profileSetup, fallbackModelIds: event.target.checked ? [...profileSetup.fallbackModelIds, model.id] : profileSetup.fallbackModelIds.filter((id) => id !== model.id) })} /><span className="min-w-0"><span className="block truncate font-semibold">{model.label}</span><span className="text-[10px] text-muted-foreground">{model.class} · {model.model}</span></span></label>)}</div></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button onClick={() => void configureProfile()} disabled={!profileSetup.primaryModelId || Boolean(busy)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy === 'profile-config' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Apply to Hermes</button><button onClick={() => void testHermesConnection()} disabled={!profileSetup.primaryModelId || Boolean(busy)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold disabled:opacity-50">{busy === 'hermes-test' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}Run live test</button></div>
          {connectionTest && <div className={`mt-4 rounded-xl border p-3 text-xs ${connectionTest.success ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-rose-500/25 bg-rose-500/10'}`}><div className="flex items-center gap-2 font-bold">{connectionTest.success ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-400" />}{connectionTest.message}<span className="ml-auto font-mono text-muted-foreground">{connectionTest.latencyMs} ms</span></div><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{connectionTest.output}</pre></div>}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end"><div className="flex-1"><h3 className="font-bold">Live OpenRouter model browser</h3><p className="mt-1 text-xs text-muted-foreground">Search the current public catalog, inspect real pricing and capabilities, then add a model without copying IDs by hand.</p><label className="relative mt-3 block"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchCatalog(); }} placeholder="Search model name, provider, or capability…" className="h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary" /></label></div><div className="flex flex-wrap items-center gap-3"><Toggle label="Free only" checked={catalogFreeOnly} onChange={setCatalogFreeOnly} /><Toggle label="Tools" checked={catalogToolsOnly} onChange={setCatalogToolsOnly} /><button onClick={() => void searchCatalog()} disabled={Boolean(busy)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy === 'model-search' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</button></div></div>
        {catalogModels.length > 0 ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{catalogModels.map((model) => <article key={model.id} className="rounded-xl border border-border bg-background p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="truncate font-semibold">{model.name}</h4><p className="truncate font-mono text-[10px] text-primary">{model.id}</p></div><button onClick={() => addCatalogModel(model)} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold hover:bg-muted"><Plus className="mr-1 inline h-3 w-3" />Add</button></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{model.description || 'No description supplied by OpenRouter.'}</p><div className="mt-3 flex flex-wrap gap-1.5 text-[10px]"><span className={`rounded px-2 py-1 ${model.free ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{model.free ? 'FREE' : `${money(model.promptUsdPerMillion)}/M in`}</span><span className="rounded bg-muted px-2 py-1">{Math.round(model.contextLength / 1000)}K context</span>{model.supportsTools && <span className="rounded bg-blue-500/10 px-2 py-1 text-blue-400">TOOLS</span>}{model.supportsVision && <span className="rounded bg-violet-500/10 px-2 py-1 text-violet-400">VISION</span>}</div></article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">Search the live catalog to discover models.</div>}
      </section>
    </div>}

    {tab === 'overview' && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Hermes bots" value={state.bots.length} detail={`${state.bots.filter((bot) => bot.nativeProfileDetected).length} detected`} /><Metric label="Free models" value={freeModels} detail="enabled routes" /><Metric label="Approved paid" value={approvedPaid} detail="fail-closed allowlist" /><Metric label="Spent today" value={money(state.today.spentUsd)} detail={`${state.today.paidRuns} paid run(s)`} /><Metric label="Daily limit" value={money(draft.budget.maxUsdPerDay)} detail={`${draft.budget.maxPaidRunsPerDay} paid runs max`} /></div>
      <div className="grid gap-4 xl:grid-cols-3"><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-500" /><h3 className="font-bold">Fail-closed paid routing</h3></div><p className="mt-2 text-sm leading-6 text-muted-foreground">A paid model must be enabled, explicitly approved, selected by a matching rule, and remain inside both per-task and daily budgets. If any check fails, the task is blocked instead of silently spending money.</p><div className="mt-4 rounded-xl bg-muted/40 p-3 font-mono text-xs text-muted-foreground">complexity ≥ {draft.paidEscalationComplexity} → approved-paid<br />max task {money(draft.budget.maxUsdPerTask)} · max day {money(draft.budget.maxUsdPerDay)}</div></section><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold">Local classifier</h3><p className="mt-1 text-xs text-muted-foreground">Open-source embeddings or deterministic rules.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${state.classifier.state === 'ready' || state.classifier.state === 'disabled' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{state.classifier.state}</span></div><label className="mt-4 block text-xs font-semibold">Classification mode<select value={draft.classifierMode} onChange={(event) => setDraft({ ...draft, classifierMode: event.target.value as RouterPolicy['classifierMode'] })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="deterministic">Deterministic · built in</option><option value="local-semantic">Local semantic · Transformers.js</option></select></label>{draft.classifierMode === 'local-semantic' && <><NumberField label="Semantic confidence" value={draft.semanticConfidenceThreshold} onChange={(value) => setDraft({ ...draft, semanticConfidenceThreshold: value })} step="0.01" /><button onClick={() => void prepareLocalRouter()} disabled={busy === 'semantic'} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs font-bold text-primary disabled:opacity-50">{busy === 'semantic' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}{state.classifier.state === 'ready' ? 'Recheck local model' : 'Prepare local model'}</button></>}<p className="mt-3 text-xs leading-5 text-muted-foreground">{state.classifier.message}</p></section><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold">Live catalog</h3><p className="mt-1 text-xs text-muted-foreground">Free status and prices are refreshed from OpenRouter.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${state.catalog.state === 'current' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{state.catalog.state}</span></div><p className="mt-4 text-sm text-muted-foreground">{state.catalog.message}</p>{state.catalog.checkedAt && <p className="mt-2 font-mono text-[10px] text-muted-foreground">Checked {new Date(state.catalog.checkedAt).toLocaleString()}</p>}</section></div>
    </div>}

    {tab === 'bots' && <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><section className="space-y-3">{state.bots.map((bot) => <article key={bot.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Bot className="h-5 w-5" /></span><div><h3 className="font-bold">{bot.name}</h3><p className="font-mono text-[10px] text-primary">hermes -p {bot.profile}</p></div></div>{bot.nativeProfileDetected ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500">NATIVE PROFILE</span> : <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-400">MISSING</span>}</div><p className="mt-3 text-sm leading-6 text-muted-foreground">{bot.description}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span className="rounded-lg bg-muted px-2 py-1">Pool: {draft.pools.find((pool) => pool.id === bot.defaultPoolId)?.name || bot.defaultPoolId}</span><span className="rounded-lg bg-muted px-2 py-1">{bot.skills.length ? `${bot.skills.length} forced skills` : 'Profile skills'}</span></div></article>)}</section><section className="h-fit rounded-2xl border border-border bg-card p-5"><h3 className="font-bold">Create native Hermes bot</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Creates a real isolated Hermes profile. The Hub stores routing policy; Hermes owns execution, memory, skills, and sessions.</p><div className="mt-4 space-y-3"><Input label="Profile ID" value={botForm.profile} onChange={(value) => setBotForm({ ...botForm, profile: value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="researcher" /><Input label="Display name" value={botForm.name} onChange={(value) => setBotForm({ ...botForm, name: value })} placeholder="Research Bot" /><label className="block text-xs font-semibold">Purpose<textarea value={botForm.description} onChange={(event) => setBotForm({ ...botForm, description: event.target.value })} placeholder="Researches sources and produces evidence-backed reports." className="mt-1.5 min-h-24 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" /></label><label className="block text-xs font-semibold">Default pool<select value={botForm.defaultPoolId} onChange={(event) => setBotForm({ ...botForm, defaultPoolId: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">{draft.pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name}</option>)}</select></label><Input label="Forced skills (comma separated, optional)" value={(botForm.skills || []).join(', ')} onChange={(value) => setBotForm({ ...botForm, skills: value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="research, browser" /><button onClick={() => void createBot()} disabled={busy === 'bot'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy === 'bot' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create Hermes profile</button></div></section></div>}

    {tab === 'models' && <div className="space-y-5"><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold">Model registry</h3><p className="mt-1 text-xs text-muted-foreground">A price above zero marks a model paid. Paid execution remains blocked until explicitly approved.</p></div><span className="text-xs text-muted-foreground">{draft.models.length} configured</span></div><div className="mt-4 grid gap-3 xl:grid-cols-2">{draft.models.map((model, index) => <article key={model.id} className={`rounded-xl border p-4 ${model.class === 'paid' ? 'border-amber-500/25 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold">{model.label}</h4><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{model.provider} · {model.model}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${model.class === 'free' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{model.class}</span></div><div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground"><span>{model.contextLength.toLocaleString()} context</span><span>{money(model.promptUsdPerMillion)}/M input</span><span>{money(model.completionUsdPerMillion)}/M output</span></div><div className="mt-4 flex items-center gap-4"><Toggle label="Enabled" checked={model.enabled} onChange={(checked) => { const models = [...draft.models]; models[index] = { ...model, enabled: checked }; setDraft({ ...draft, models }); }} />{model.class === 'paid' && <Toggle label="Approved for paid use" checked={model.approvedForPaidUse} onChange={(checked) => { const models = [...draft.models]; models[index] = { ...model, approvedForPaidUse: checked }; setDraft({ ...draft, models }); }} />}</div></article>)}</div></section><section className="rounded-2xl border border-dashed border-border bg-card/50 p-5"><h3 className="font-bold">Add a model</h3><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Input label="Provider" value={modelForm.provider} onChange={(value) => setModelForm({ ...modelForm, provider: value })} /><Input label="Exact model ID" value={modelForm.model} onChange={(value) => setModelForm({ ...modelForm, model: value })} placeholder="provider/model:free" /><Input label="Display label" value={modelForm.label} onChange={(value) => setModelForm({ ...modelForm, label: value })} placeholder="My model" /><Input label="Input $ / 1M" value={modelForm.prompt} onChange={(value) => setModelForm({ ...modelForm, prompt: value })} /><Input label="Output $ / 1M" value={modelForm.completion} onChange={(value) => setModelForm({ ...modelForm, completion: value })} /><Input label="Context tokens" value={modelForm.context} onChange={(value) => setModelForm({ ...modelForm, context: value })} /></div><button onClick={addModel} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary"><Plus className="h-4 w-4" />Add to draft</button></section><section className="rounded-2xl border border-border bg-card p-5"><h3 className="font-bold">Model pools</h3><div className="mt-4 grid gap-4 lg:grid-cols-3">{draft.pools.map((pool, poolIndex) => <article key={pool.id} className="rounded-xl border border-border bg-background/40 p-4"><h4 className="font-semibold">{pool.name}</h4><p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{pool.description}</p><div className="mt-3 space-y-2">{draft.models.map((model) => <label key={model.id} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={pool.modelIds.includes(model.id)} onChange={(event) => { const pools = [...draft.pools]; pools[poolIndex] = { ...pool, modelIds: event.target.checked ? [...pool.modelIds, model.id] : pool.modelIds.filter((id) => id !== model.id) }; setDraft({ ...draft, pools }); }} className="mt-0.5 accent-primary" /><span><span className="font-medium">{model.label}</span><span className={`ml-2 text-[9px] font-bold uppercase ${model.class === 'free' ? 'text-emerald-500' : 'text-amber-500'}`}>{model.class}</span></span></label>)}</div></article>)}</div></section></div>}

    {tab === 'rules' && <div className="space-y-5"><section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-4"><NumberField label="Paid complexity floor" value={draft.paidEscalationComplexity} onChange={(value) => setDraft({ ...draft, paidEscalationComplexity: value })} suffix="/100" /><NumberField label="Maximum paid runs / day" value={draft.budget.maxPaidRunsPerDay} onChange={(value) => setDraft({ ...draft, budget: { ...draft.budget, maxPaidRunsPerDay: value } })} /><NumberField label="Maximum per task" value={draft.budget.maxUsdPerTask} onChange={(value) => setDraft({ ...draft, budget: { ...draft.budget, maxUsdPerTask: value } })} prefix="$" step="0.01" /><NumberField label="Maximum per day" value={draft.budget.maxUsdPerDay} onChange={(value) => setDraft({ ...draft, budget: { ...draft.budget, maxUsdPerDay: value } })} prefix="$" step="0.1" /></section><div className="flex items-center justify-between"><div><h3 className="font-bold">Routing rules</h3><p className="mt-1 text-xs text-muted-foreground">Rules run from the lowest priority number to the highest. The first match wins.</p></div><button onClick={addRule} className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary"><Plus className="h-4 w-4" />Add rule</button></div><section className="space-y-3">{[...draft.rules].sort((a, b) => a.priority - b.priority).map((rule) => { const index = draft.rules.findIndex((item) => item.id === rule.id); return <article key={rule.id} className="rounded-2xl border border-border bg-card p-5"><div className="grid gap-4 lg:grid-cols-[1fr_120px_120px_180px_auto]"><Input label="Rule" value={rule.name} onChange={(value) => { const rules = [...draft.rules]; rules[index] = { ...rule, name: value }; setDraft({ ...draft, rules }); }} /><NumberField label="Minimum" value={rule.minimumComplexity} onChange={(value) => { const rules = [...draft.rules]; rules[index] = { ...rule, minimumComplexity: value }; setDraft({ ...draft, rules }); }} /><NumberField label="Maximum" value={rule.maximumComplexity} onChange={(value) => { const rules = [...draft.rules]; rules[index] = { ...rule, maximumComplexity: value }; setDraft({ ...draft, rules }); }} /><label className="block text-xs font-semibold">Model pool<select value={rule.poolId} onChange={(event) => { const rules = [...draft.rules]; rules[index] = { ...rule, poolId: event.target.value }; setDraft({ ...draft, rules }); }} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">{draft.pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name}</option>)}</select></label><div className="flex items-center gap-2 pt-7"><Toggle label="Enabled" checked={rule.enabled} onChange={(checked) => { const rules = [...draft.rules]; rules[index] = { ...rule, enabled: checked }; setDraft({ ...draft, rules }); }} /><button aria-label={`Delete ${rule.name}`} onClick={() => setDraft({ ...draft, rules: draft.rules.filter((item) => item.id !== rule.id) })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400"><XCircle className="h-4 w-4" /></button></div></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => { const rules = [...draft.rules]; rules[index] = { ...rule, categories: [] }; setDraft({ ...draft, rules }); }} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${!rule.categories.length ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>Any category</button>{categories.filter((item) => item !== 'general').map((category) => <button key={category} onClick={() => { const active = rule.categories.includes(category); const rules = [...draft.rules]; rules[index] = { ...rule, categories: active ? rule.categories.filter((item) => item !== category) : [...rule.categories, category] }; setDraft({ ...draft, rules }); }} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${rule.categories.includes(category) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{titleCase(category)}</button>)}</div></article>; })}</section></div>}

    {tab === 'simulator' && <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><section className="h-fit rounded-2xl border border-border bg-card p-5"><h3 className="font-bold">Route a task</h3><p className="mt-1 text-xs text-muted-foreground">Simulation is local and free. Execution starts Hermes only after confirmation.</p><div className="mt-4 space-y-3"><label className="block text-xs font-semibold">Task<textarea value={task.prompt} onChange={(event) => { setTask({ ...task, prompt: event.target.value }); setDecision(null); }} placeholder="Describe exactly what the bot should do…" className="mt-1.5 min-h-40 w-full rounded-xl border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /></label><label className="block text-xs font-semibold">Hermes bot<select value={task.botId} onChange={(event) => setTask({ ...task, botId: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">{state.bots.filter((bot) => bot.enabled).map((bot) => <option key={bot.id} value={bot.id}>{bot.name} · {bot.profile}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><NumberField label="Affected files" value={Number(task.fileCount || 0)} onChange={(value) => setTask({ ...task, fileCount: value })} /><NumberField label="Context tokens" value={Number(task.estimatedContextTokens || 0)} onChange={(value) => setTask({ ...task, estimatedContextTokens: value })} /></div><div className="flex flex-wrap gap-4"><Toggle label="Requires tools" checked={Boolean(task.requiresTools)} onChange={(checked) => setTask({ ...task, requiresTools: checked })} /><Toggle label="Requires vision" checked={Boolean(task.requiresVision)} onChange={(checked) => setTask({ ...task, requiresVision: checked })} /></div><button onClick={() => void simulate()} disabled={!task.prompt.trim() || busy === 'simulate'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40">{busy === 'simulate' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Simulate route</button></div></section><section className="space-y-4">{!decision ? <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-center"><Route className="h-10 w-10 text-muted-foreground/40" /><h3 className="mt-4 font-bold">No routing decision yet</h3><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Describe a task to see its complexity, matching rule, chosen pool, exact model, estimated cost, and approval state.</p></div> : <><article className={`rounded-2xl border p-5 ${decision.blocked ? 'border-rose-500/30 bg-rose-500/5' : decision.paid ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Routing decision</p><h3 className="mt-1 text-xl font-black">{decision.selectedModel?.label || 'Blocked'}</h3><p className="mt-1 text-xs text-muted-foreground">{selectedBot?.name} · {titleCase(decision.category)} · pool {decision.selectedPoolId}</p></div><div className="text-right"><div className="font-mono text-3xl font-black">{decision.complexity}</div><div className="text-[10px] uppercase text-muted-foreground">complexity</div></div></div><div className="mt-5 grid grid-cols-3 gap-3"><DecisionMetric label="Route" value={decision.paid ? 'Paid' : 'Free'} /><DecisionMetric label="Estimate" value={money(decision.estimatedCostUsd)} /><DecisionMetric label="State" value={decision.blocked ? 'Blocked' : decision.requiresApproval ? 'Approval' : 'Ready'} /></div><p className="mt-4 rounded-xl bg-background/50 p-3 text-xs font-medium">{decision.message}</p><ul className="mt-4 space-y-1 text-xs text-muted-foreground">{decision.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul><button onClick={() => void execute()} disabled={decision.blocked || busy === 'execute'} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40 ${decision.paid ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'}`}>{busy === 'execute' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run with Hermes</button></article>{execution && <article className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2">{execution.status === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}<h3 className="font-bold">Hermes output</h3><span className="ml-auto font-mono text-xs text-muted-foreground">{money(execution.actualCostUsd)}</span></div><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-4 text-xs leading-5">{execution.output}</pre></article>}</>}</section></div>}

    {tab === 'history' && <section className="rounded-2xl border border-border bg-card"><div className="border-b border-border p-5"><h3 className="font-bold">Routing history</h3><p className="mt-1 text-xs text-muted-foreground">Local audit trail of selected profiles, models, routing reasons, outcomes, tokens, and reported cost.</p></div>{state.history.length ? <div className="divide-y divide-border">{state.history.map((record) => <article key={record.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${record.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} /><h4 className="font-semibold">{record.decision.selectedModel?.label || 'Blocked route'}</h4><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{record.profile}</span></div><p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">{record.promptPreview}</p></div><div className="shrink-0 text-right text-xs text-muted-foreground"><p>{new Date(record.createdAt).toLocaleString()}</p><p className="mt-1 font-mono">{record.decision.complexity}/100 · {money(record.actualCostUsd)}</p></div></div></article>)}</div> : <div className="py-16 text-center text-sm text-muted-foreground"><Activity className="mx-auto mb-3 h-8 w-8 opacity-40" />No routed tasks yet.</div>}</section>}
  </div>;
};

const Metric: React.FC<{ label: string; value: React.ReactNode; detail: string }> = ({ label, value, detail }) => <div className="rounded-2xl border border-border bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>;
const DecisionMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl bg-background/60 p-3 text-center"><p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>;
const Input: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => <label className="block text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>;
const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string; step?: string }> = ({ label, value, onChange, prefix, suffix, step = '1' }) => <label className="block text-xs font-semibold">{label}<div className="mt-1.5 flex h-11 items-center rounded-xl border border-input bg-background px-3">{prefix && <span className="mr-1 text-muted-foreground">{prefix}</span>}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{suffix && <span className="text-muted-foreground">{suffix}</span>}</div></label>;
const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold"><button type="button" onClick={() => onChange(!checked)} className={`flex h-5 w-9 rounded-full p-0.5 transition ${checked ? 'justify-end bg-primary' : 'justify-start bg-muted'}`} aria-pressed={checked}><span className="h-4 w-4 rounded-full bg-white shadow" /></button>{label}</label>;
