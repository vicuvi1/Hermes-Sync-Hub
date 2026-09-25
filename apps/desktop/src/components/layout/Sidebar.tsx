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
  Cpu,
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
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onlineDevicesCount: number;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'devices', label: 'Devices', icon: Laptop },
  { id: 'sessions', label: 'Sessions', icon: MessageSquare },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'files', label: 'Files', icon: FolderSync },
  { id: 'vault', label: 'Vault', icon: KeyRound },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, onlineDevicesCount }) => {
  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col justify-between select-none">
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-border/60">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              Hermes Hub
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">P2P</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Personal Agent Mesh</div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
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
  );
};
