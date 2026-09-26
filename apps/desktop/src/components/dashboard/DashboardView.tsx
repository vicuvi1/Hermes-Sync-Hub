import React from 'react';
import { Device, OverallStats, ActiveTransfer, ActivityEvent, HermesMemory, HermesSession } from '@hermes-hub/types';
import { DeviceCard } from './DeviceCard';
import { StatsGrid } from './StatsGrid';
import { TransferWidget } from './TransferWidget';
import { Plus, CheckCircle2, ArrowRight, Activity, AlertTriangle, Laptop } from 'lucide-react';
import { formatTimeAgo } from '@hermes-hub/shared';

interface DashboardViewProps {
  devices: Device[];
  stats: OverallStats;
  activeTransfer: ActiveTransfer | null;
  recentActivity: ActivityEvent[];
  recentSessions?: HermesSession[];
  recentMemories?: HermesMemory[];
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
  recentSessions = [],
  recentMemories = [],
  onSelectDevice,
  onSyncDevice,
  onAddDevice,
  onNavigateTab,
}) => {
  const synchronized = stats.syncHealth === 'all_synced' && stats.pendingFilesCount === 0 && stats.conflictsCount === 0;
  const statusTitle = devices.length === 0 ? 'No devices connected yet' : synchronized ? 'Everything synchronized' : stats.syncHealth === 'has_conflicts' ? 'Conflicts need attention' : 'Synchronization needs attention';
  return (
    <div className="space-y-6 pb-12">
      {/* Hero Synchronized Status Banner */}
      <div className={`rounded-2xl border p-6 backdrop-blur-md relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${synchronized ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent' : 'border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent'}`}>
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${synchronized ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500' : 'bg-amber-500/20 border-amber-500/30 text-amber-500'}`}>
            {synchronized ? <CheckCircle2 className="h-6 w-6 stroke-[2.5]" /> : <AlertTriangle className="h-6 w-6 stroke-[2.5]" />}
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              {statusTitle}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-mono ${synchronized ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                {synchronized ? 'Mesh Active' : 'Review Status'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              {devices.length === 0 ? 'Pair this computer or another Hermes device to begin local-first synchronization.' : synchronized ? 'All registered Hermes devices report no pending files or conflicts.' : 'Open device details or Settings to review offline services, pending files, and conflicts.'}
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

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Continue working</h2><button onClick={() => onNavigateTab('sessions')} className="text-xs font-medium text-primary hover:underline">Open Command Center with Ctrl+K</button></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {recentSessions.slice(0, 2).map((session) => <button key={session.id} onClick={() => onNavigateTab('sessions')} className="rounded-xl border border-border bg-card/70 p-4 text-left hover:border-primary/40"><span className="text-[10px] font-bold uppercase tracking-wider text-primary">Recent session</span><span className="mt-2 block truncate text-sm font-semibold">{session.title}</span><span className="mt-1 block text-xs text-muted-foreground">{formatTimeAgo(session.updatedAt)} · {session.model}</span></button>)}
          {recentMemories.slice(0, 1).map((memory) => <button key={memory.id} onClick={() => onNavigateTab('memory')} className="rounded-xl border border-border bg-card/70 p-4 text-left hover:border-primary/40"><span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">Changed memory</span><span className="mt-2 block truncate text-sm font-semibold">{memory.title}</span><span className="mt-1 block text-xs text-muted-foreground">{formatTimeAgo(memory.updatedAt)}</span></button>)}
          {stats.conflictsCount > 0 ? <button onClick={() => onNavigateTab('files')} className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left"><span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Needs attention</span><span className="mt-2 block text-sm font-semibold">{stats.conflictsCount} sync conflict{stats.conflictsCount === 1 ? '' : 's'}</span><span className="mt-1 block text-xs text-muted-foreground">Review before synchronizing.</span></button> : <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Recovery state</span><span className="mt-2 block text-sm font-semibold">No conflicts reported</span><span className="mt-1 block text-xs text-muted-foreground">Ambiguous changes are never silently approved.</span></div>}
          {!recentSessions.length && !recentMemories.length && <div className="md:col-span-2 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Recent real work will appear here after Hermes data is detected. Demo content is never substituted in production mode.</div>}
        </div>
      </section>

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
          {devices.length === 0 && <button onClick={onAddDevice} className="col-span-full flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-center hover:border-primary/40 hover:bg-card"><Laptop className="h-7 w-7 text-muted-foreground" /><span className="mt-3 text-sm font-semibold">Connect your first device</span><span className="mt-1 text-xs text-muted-foreground">Use a secure pairing code to build your mesh.</span></button>}
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
