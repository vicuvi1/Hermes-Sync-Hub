import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, RefreshCw, Pin, AlertTriangle, Database, Loader2 } from 'lucide-react';
import { AppLocation, AppSettings, SavedSearch, SearchEntityKind, SearchIndexStatus, SearchResult } from '@hermes-hub/types';

interface Props {
  isOpen: boolean; onClose: () => void; onNavigate: (location: AppLocation) => void;
  onSync: () => Promise<void> | void; onCreateBackup: () => Promise<void> | void;
  onCheckUpdates: () => Promise<void> | void; onAddDevice: () => void;
}

const FILTERS: Array<{ kind?: SearchEntityKind; label: string }> = [
  { label: 'All' }, { kind: 'session', label: 'Sessions' }, { kind: 'memory', label: 'Memories' },
  { kind: 'skill', label: 'Skills' }, { kind: 'file', label: 'Files' }, { kind: 'device', label: 'Devices' },
  { kind: 'backup', label: 'Backups' }, { kind: 'activity', label: 'Activity' }, { kind: 'action', label: 'Actions' },
];
const KIND: Record<SearchEntityKind, string> = { session: 'Session', memory: 'Memory', skill: 'Skill', file: 'File', device: 'Device', backup: 'Backup', activity: 'Activity', setting: 'Setting', action: 'Action' };

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose, onNavigate, onSync, onCreateBackup, onCheckUpdates, onAddDevice }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchEntityKind>();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<SearchIndexStatus | null>(null);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<SearchResult | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (result: SearchResult) => {
    if (result.document.kind === 'action') {
      if (!confirming) { setConfirming(result); return; }
      const id = result.document.location.entityId;
      if (id === 'sync') await onSync();
      if (id === 'backup') await onCreateBackup();
      if (id === 'update') await onCheckUpdates();
      if (id === 'pair') onAddDevice();
    } else onNavigate(result.document.location);
    setConfirming(null); onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    setQuery(''); setResults([]); setSelected(0); setConfirming(null);
    window.hermesHub?.getSearchIndexStatus().then(setStatus).catch(() => undefined);
    window.hermesHub?.getAppSettings().then((settings: AppSettings) => { setSaved(settings.savedSearches || []); setRecent(settings.recentSearches || []); }).catch(() => undefined);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);
  useEffect(() => window.hermesHub?.onSearchIndexStatus?.(setStatus), []);
  useEffect(() => {
    if (!isOpen || !query.trim() || !window.hermesHub) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try { setResults(await window.hermesHub!.searchAll({ text: query, filter: filter ? { kinds: [filter] } : undefined, limit: 60 })); setSelected(0); }
      finally { setLoading(false); }
    }, 120);
    return () => clearTimeout(timer);
  }, [filter, isOpen, query]);

  const grouped = useMemo(() => results.reduce<Record<string, SearchResult[]>>((all, result) => { (all[KIND[result.document.kind]] ||= []).push(result); return all; }, {}), [results]);
  const saveCurrent = async () => {
    if (!query.trim() || !window.hermesHub) return;
    const item = await window.hermesHub.saveSearch({ name: query.trim(), query: { text: query.trim(), filter: filter ? { kinds: [filter] } : undefined } });
    setSaved((items) => [item, ...items]);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { confirming ? setConfirming(null) : onClose(); return; }
    if (confirming && event.key === 'Enter') { event.preventDefault(); void run(confirming); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(value + 1, results.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)); }
    if (event.key === 'Enter' && results[selected]) { event.preventDefault(); void run(results[selected]); }
  };

  if (!isOpen) return null;
  let flatIndex = -1;
  return <div className="fixed inset-0 z-[70] flex items-start justify-center bg-background/80 px-4 pt-[7vh] backdrop-blur-sm" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-label="Universal Command Center" className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl" onMouseDown={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
      <div className="flex items-center gap-3 border-b border-border px-4">{loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Search className="h-5 w-5 text-muted-foreground" />}<input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setConfirming(null); }} placeholder="Find sessions, memories, skills, files, devices, backups or actions…" className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" aria-label="Search everything" />{query && <button onClick={saveCurrent} title="Save search" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Pin className="h-4 w-4" /></button>}<button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">{FILTERS.map((item) => <button key={item.label} onClick={() => setFilter(item.kind)} className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium ${filter === item.kind ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{item.label}</button>)}</div>
      {confirming ? <div className="p-6"><div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" /><div><h3 className="font-semibold">Confirm {confirming.document.title.toLowerCase()}</h3><p className="mt-1 text-sm text-muted-foreground">{confirming.document.body}. Live data will refresh after this action.</p></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirming(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button><button onClick={() => void run(confirming)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Confirm action</button></div></div></div> : <div className="max-h-[62vh] overflow-y-auto p-2">
        {!query.trim() && <div className="space-y-5 p-3"><div className="rounded-xl border border-border bg-background/50 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-primary" />Private local search</div><p className="mt-1 text-xs text-muted-foreground">{status?.message || 'Reading the local index…'} Vault values, tokens, databases and diagnostics are excluded.</p><button onClick={() => window.hermesHub?.reindexSearch()} className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary"><RefreshCw className="h-3.5 w-3.5" />Rebuild index</button></div>{saved.length > 0 && <section><h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pinned searches</h3><div className="flex flex-wrap gap-2">{saved.map((item) => <button key={item.id} onClick={() => { setQuery(item.query.text); setFilter(item.query.filter?.kinds?.[0]); }} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/40"><Pin className="mr-1.5 inline h-3 w-3" />{item.name}</button>)}</div></section>}{recent.length > 0 && <section><h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recent</h3><div className="flex flex-wrap gap-2">{recent.slice(0, 8).map((text) => <button key={text} onClick={() => setQuery(text)} className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{text}</button>)}</div></section>}</div>}
        {query.trim() && results.length === 0 && !loading && <div className="px-4 py-12 text-center text-sm text-muted-foreground">No local results. Try another word or rebuild the index.</div>}
        {Object.entries(grouped).map(([group, items]) => <section key={group} className="mb-3"><h3 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</h3>{items.map((result) => { flatIndex += 1; const index = flatIndex; return <button key={result.document.id} onMouseEnter={() => setSelected(index)} onClick={() => void run(result)} className={`w-full rounded-xl px-3 py-2.5 text-left ${selected === index ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'}`}><div className="flex items-center gap-3"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{result.document.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.excerpt || result.document.subtitle}</span></span><span className="shrink-0 text-[10px] text-muted-foreground">{result.document.deviceName || KIND[result.document.kind]}</span></div></button>; })}</section>)}
      </div>}
      <div className="flex justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground"><span>↑↓ navigate · Enter open · Esc close</span><span>Local-only · no telemetry</span></div>
    </div>
  </div>;
};
