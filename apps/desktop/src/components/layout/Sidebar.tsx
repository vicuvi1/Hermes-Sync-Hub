import React from 'react';
import {
  LayoutDashboard,
  Laptop,
  MessageSquare,
  Brain,
  Sparkles,
  FolderSync,
  KeyRound,
  Activity,
  Archive,
  Settings,
  BookOpen,
  Cpu,
  X,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'devices'
  | 'sessions'
  | 'memory'
  | 'skills'
  | 'files'
  | 'vault'
  | 'activity'
  | 'backups'
  | 'settings'
  | 'help';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onlineDevicesCount: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV_GROUPS: { label: string; items: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'sessions', label: 'Sessions', icon: MessageSquare },
      { id: 'memory', label: 'Memory', icon: Brain },
      { id: 'skills', label: 'Skills', icon: Sparkles },
    ],
  },
  {
    label: 'Mesh & safety',
    items: [
      { id: 'devices', label: 'Devices', icon: Laptop },
      { id: 'files', label: 'Synced files', icon: FolderSync },
      { id: 'vault', label: 'Shared Vault', icon: KeyRound },
      { id: 'backups', label: 'Backups', icon: Archive },
      { id: 'activity', label: 'Activity', icon: Activity },
    ],
  },
  {
    label: 'Application',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help & README', icon: BookOpen },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, onlineDevicesCount, isOpen = false, onClose }) => {
  return (
    <>
      {isOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card/95 backdrop-blur-xl flex flex-col justify-between select-none transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:bg-card/60 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Brand Header */}
      <div>
        <div className="h-[76px] flex items-center gap-3 px-5 border-b border-border/60">
          <div className="hub-logo h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Cpu className="h-5 w-5" />
          </div>
          <button aria-label="Close navigation" onClick={onClose} className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden">
            <X className="h-4 w-4" />
          </button>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              Hermes Hub
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">P2P</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Your local AI workspace</div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="custom-scrollbar max-h-[calc(100vh-154px)] space-y-5 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => <div key={group.label}>
            <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">{group.label}</div>
            <div className="space-y-1">{group.items.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onTabChange(item.id); onClose?.(); }}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary/12 text-primary ring-1 ring-inset ring-primary/20 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground group-hover:text-foreground'}`}><Icon className="h-4 w-4" /></span>
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}</div></div>)}
        </nav>
      </div>

      {/* Footer Status Pill */}
      <div className="p-4 border-t border-border/60">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-muted-foreground">Mesh Status</span>
          </div>
          <span className="font-mono text-emerald-500 font-semibold">{onlineDevicesCount} Online</span>
        </div>
      </div>
      </aside>
    </>
  );
};
