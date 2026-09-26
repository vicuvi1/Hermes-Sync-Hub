import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, LayoutDashboard, Laptop, MessageSquare, Brain, Sparkles, FolderSync, KeyRound, Activity, Archive, Settings, RefreshCw, Plus, X, BookOpen } from 'lucide-react';
import { NavTab } from './Sidebar';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onSync: () => void;
  onAddDevice: () => void;
}

const destinations: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['devices', 'Devices', Laptop], ['sessions', 'Sessions', MessageSquare],
  ['memory', 'Memory', Brain], ['skills', 'Skills', Sparkles], ['files', 'Files', FolderSync], ['vault', 'Vault', KeyRound],
  ['activity', 'Activity', Activity], ['backups', 'Backups', Archive], ['settings', 'Settings', Settings], ['help', 'Help & README', BookOpen],
].map(([id, label, icon]) => ({ id: id as NavTab, label: label as string, icon: icon as React.ComponentType<{ className?: string }> }));

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate, onSync, onAddDevice }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isOpen) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); } }, [isOpen]);
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const commands = useMemo(() => [
    ...destinations.map((item) => ({ ...item, group: 'Navigate', run: () => onNavigate(item.id) })),
    { id: 'sync', label: 'Sync all devices now', icon: RefreshCw, group: 'Actions', run: onSync },
    { id: 'add', label: 'Pair a new device', icon: Plus, group: 'Actions', run: onAddDevice },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query, onNavigate, onSync, onAddDevice]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[70] flex items-start justify-center bg-background/75 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-label="Quick actions" className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 border-b border-border px-4"><Search className="h-5 w-5 text-muted-foreground" /><input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages and actions…" className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
      <div className="max-h-[55vh] overflow-y-auto p-2">
        {commands.length ? commands.map((command) => { const Icon = command.icon; return <button key={command.id} onClick={() => { command.run(); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"><span className="rounded-lg border border-border bg-background p-2 text-primary"><Icon className="h-4 w-4" /></span><span className="font-medium">{command.label}</span><span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{command.group}</span></button>; }) : <div className="px-4 py-10 text-center text-sm text-muted-foreground">No matching actions</div>}
      </div>
    </div>
  </div>;
};
