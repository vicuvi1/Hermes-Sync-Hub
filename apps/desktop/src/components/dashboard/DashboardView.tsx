import React from 'react';
import { Device, OverallStats, ActiveTransfer, ActivityEvent } from '@hermes-hub/types';
import { DeviceCard } from './DeviceCard';
import { StatsGrid } from './StatsGrid';
import { TransferWidget } from './TransferWidget';
import { Plus, CheckCircle2, ArrowRight, ShieldCheck, Activity, Sparkles, FolderSync } from 'lucide-react';
import { formatTimeAgo } from '@hermes-hub/shared';

interface DashboardViewProps {
  devices: Device[];
  stats: OverallStats;
  activeTransfer: ActiveTransfer | null;
  recentActivity: ActivityEvent[];
  onSelectDevice: (device: Device) => void;
  onSyncDevice: (device: Device) => void;
  onAddDevice: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  devices,
  stats,
  activeTransfer,
  recentActivity,
  onSelectDevice,
  onSyncDevice,
  onAddDevice,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Hero Synchronized Status Banner */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 backdrop-blur-md relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
            <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              Everything synchronized
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 font-medium font-mono">
                Mesh Active
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              All online Hermes agents are connected over Tailscale and actively exchanging block updates via Syncthing. No central server required.
            </p>
          </div>
        </div>

        <button
          onClick={onAddDevice}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Add Device</span>
        </button>
      </div>

      {/* Global Metrics Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Overview Metrics
          </h2>
        </div>
        <StatsGrid stats={stats} />
      </div>

      {/* Active Transfer Banner (if any) */}
      {activeTransfer && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Active Peer-to-Peer Transfer
            </h2>
          </div>
          <TransferWidget transfer={activeTransfer} />
        </div>
      )}

      {/* Devices Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Devices ({devices.length})
          </h2>
          <button
            onClick={() => onNavigateTab('devices')}
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          >
            <span>Manage all</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <DeviceCard
              key={device.deviceId}
              device={device}
              onSelect={onSelectDevice}
              onSyncDevice={onSyncDevice}
            />
          ))}
        </div>
      </div>

      {/* Recent Activity Timeline Preview */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Recent Synchronization Activity
          </h2>
          <button
            onClick={() => onNavigateTab('activity')}
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          >
            <span>View all activity</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/60 divide-y divide-border/40 overflow-hidden">
          {recentActivity.slice(0, 4).map((event) => (
            <div key={event.id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <div>
                  <div className="font-semibold text-foreground">{event.title}</div>
                  <div className="text-muted-foreground mt-0.5">{event.description}</div>
                </div>
              </div>
              <div className="font-mono text-muted-foreground whitespace-nowrap">
                {formatTimeAgo(event.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
