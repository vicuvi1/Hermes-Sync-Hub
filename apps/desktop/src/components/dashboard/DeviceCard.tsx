import React from 'react';
import { Device } from '@hermes-hub/types';
import { formatTimeAgo, formatBytes } from '@hermes-hub/shared';
import {
  Laptop,
  Monitor,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  ArrowUpRight,
  Shield,
  Layers,
} from 'lucide-react';

interface DeviceCardProps {
  device: Device;
  onSelect: (device: Device) => void;
  onSyncDevice: (device: Device) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onSelect, onSyncDevice }) => {
  const isOnline = device.online;
  const isHermesRunning = device.hermes.running;

  const getDeviceIcon = () => {
    if (device.os === 'windows') return Monitor;
    if (device.deviceName.toLowerCase().includes('laptop')) return Laptop;
    return HardDrive;
  };

  const Icon = getDeviceIcon();

  return (
    <div
      onClick={() => onSelect(device)}
      className={`group relative rounded-xl border p-5 transition-all cursor-pointer backdrop-blur-sm ${
        isOnline
          ? 'bg-card/90 border-border hover:border-primary/50 hover:shadow-md'
          : 'bg-card/40 border-border/60 opacity-80 hover:opacity-100 hover:border-border'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg border ${
              isOnline
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm flex items-center gap-2">
              {device.deviceName}
              <span className="text-[10px] text-muted-foreground uppercase font-mono px-1 rounded bg-muted">
                {device.os}
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              {device.tailscale.ip || device.hostname}
            </div>
          </div>
        </div>

        {/* Online / Offline status badge */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
            }`}
          />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Hermes Status Line */}
      <div className="mt-4 flex items-center justify-between text-xs py-1.5 px-2.5 rounded-md bg-muted/40 border border-border/40">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${isHermesRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-muted-foreground">Hermes:</span>
          <span className="font-medium text-foreground">
            {isHermesRunning ? 'Running' : device.hermes.installed ? 'Stopped' : 'Not Detected'}
          </span>
        </div>
        <div className="text-muted-foreground">
          {isOnline ? (
            <span>Synced {formatTimeAgo(device.sync.lastSync)}</span>
          ) : (
            <span className="text-amber-500 font-medium">{device.sync.pendingFiles} updates behind</span>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-background/50 border border-border/40 p-2">
          <div className="text-xs text-muted-foreground">Sessions</div>
          <div className="text-base font-bold text-foreground font-mono mt-0.5">
            {device.data.sessions}
          </div>
        </div>
        <div className="rounded-lg bg-background/50 border border-border/40 p-2">
          <div className="text-xs text-muted-foreground">Skills</div>
          <div className="text-base font-bold text-foreground font-mono mt-0.5">
            {device.data.skills}
          </div>
        </div>
        <div className="rounded-lg bg-background/50 border border-border/40 p-2">
          <div className="text-xs text-muted-foreground">Memories</div>
          <div className="text-base font-bold text-foreground font-mono mt-0.5">
            {device.data.memories}
          </div>
        </div>
      </div>

      {/* Sub-bar with Tailscale / Syncthing indicators */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Wifi className="h-3 w-3 text-emerald-500" />
            <span>Tailscale</span>
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-emerald-500" />
            <span>Syncthing</span>
          </span>
        </div>
        <span className="text-primary group-hover:translate-x-0.5 transition-transform flex items-center font-medium">
          Details <ArrowUpRight className="h-3 w-3 ml-0.5" />
        </span>
      </div>
    </div>
  );
};
