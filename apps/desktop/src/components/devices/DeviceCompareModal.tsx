import React, { useState } from 'react';
import { Device, DeviceComparison } from '@hermes-hub/types';
import { formatBytes } from '@hermes-hub/shared';
import {
  X,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Laptop,
  HardDrive,
  Layers,
  Wifi,
  Sparkles,
  GitCompare,
} from 'lucide-react';

interface DeviceCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  initialDeviceA?: Device | null;
  initialDeviceB?: Device | null;
}

export const DeviceCompareModal: React.FC<DeviceCompareModalProps> = ({
  isOpen,
  onClose,
  devices,
  initialDeviceA,
  initialDeviceB,
}) => {
  if (!isOpen || devices.length < 2) return null;

  const [devAId, setDevAId] = useState<string>(
    initialDeviceA?.deviceId || devices[0]?.deviceId || ''
  );
  const [devBId, setDevBId] = useState<string>(
    initialDeviceB?.deviceId || devices[1]?.deviceId || ''
  );

  const deviceA = devices.find((d) => d.deviceId === devAId) || devices[0];
  const deviceB = devices.find((d) => d.deviceId === devBId) || devices[1];

  const versionMatch = deviceA.hermes.version === deviceB.hermes.version;
  const sessionsDelta = deviceA.data.sessions - deviceB.data.sessions;
  const memoriesDelta = deviceA.data.memories - deviceB.data.memories;
  const skillsDelta = deviceA.data.skills - deviceB.data.skills;
  const bytesDelta = deviceA.data.totalSizeBytes - deviceB.data.totalSizeBytes;

  const getDeviceIcon = (dev: Device) => {
    if (dev.os === 'windows') return Monitor;
    if (dev.deviceName.toLowerCase().includes('laptop') || dev.deviceName.toLowerCase().includes('book'))
      return Laptop;
    return HardDrive;
  };

  const IconA = getDeviceIcon(deviceA);
  const IconB = getDeviceIcon(deviceB);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <GitCompare className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Device Comparison</h3>
              <p className="text-xs text-muted-foreground">
                Compare Hermes configuration, data divergence, and sync status between nodes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Device Selectors Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Reference Device (A)
              </label>
              <select
                value={devAId}
                onChange={(e) => setDevAId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceName} ({d.hostname}) {d.online ? '● Online' : '○ Offline'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Target Device (B)
              </label>
              <select
                value={devBId}
                onChange={(e) => setDevBId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceName} ({d.hostname}) {d.online ? '● Online' : '○ Offline'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side by side comparison header */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <IconA className="h-5 w-5 text-primary" />
                <span className="font-bold text-sm text-foreground">{deviceA.deviceName}</span>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {deviceA.tailscale.ip || 'No IP'} • {deviceA.os.toUpperCase()}
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  deviceA.online
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}
              >
                ● {deviceA.online ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <IconB className="h-5 w-5 text-primary" />
                <span className="font-bold text-sm text-foreground">{deviceB.deviceName}</span>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {deviceB.tailscale.ip || 'No IP'} • {deviceB.os.toUpperCase()}
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  deviceB.online
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}
              >
                ● {deviceB.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Comparison Metrics Table */}
          <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40 text-xs">
            {/* Version */}
            <div className="p-3.5 grid grid-cols-3 items-center hover:bg-muted/10 transition-colors">
              <span className="font-semibold text-muted-foreground uppercase text-[11px]">
                Hermes Version
              </span>
              <div className="font-mono text-center font-bold text-foreground">
                v{deviceA.hermes.version}
              </div>
              <div className="font-mono text-center font-bold text-foreground flex items-center justify-center gap-2">
                <span>v{deviceB.hermes.version}</span>
                {versionMatch ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                    Match ✓
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 font-semibold">
                    Mismatch
                  </span>
                )}
              </div>
            </div>

            {/* Profile */}
            <div className="p-3.5 grid grid-cols-3 items-center hover:bg-muted/10 transition-colors">
              <span className="font-semibold text-muted-foreground uppercase text-[11px]">
                Hermes Profile
              </span>
              <div className="font-mono text-center text-foreground">{deviceA.hermes.profile}</div>
              <div className="font-mono text-center text-foreground">{deviceB.hermes.profile}</div>
            </div>

            {/* Sessions */}
            <div className="p-3.5 grid grid-cols-3 items-center hover:bg-muted/10 transition-colors">
              <span className="font-semibold text-muted-foreground uppercase text-[11px]">
                Stored Sessions
              </span>
              <div className="font-mono text-center font-bold text-foreground">
                {deviceA.data.sessions}
              </div>
              <div className="font-mono text-center font-bold text-foreground flex items-center justify-center gap-2">
                <span>{deviceB.data.sessions}</span>
                {sessionsDelta !== 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      sessionsDelta > 0
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}
                  >
                    {sessionsDelta > 0 ? `+${sessionsDelta} on A` : `+${Math.abs(sessionsDelta)} on B`}
                  </span>
                )}
              </div>
            </div>

            {/* Memories */}
            <div className="p-3.5 grid grid-cols-3 items-center hover:bg-muted/10 transition-colors">
              <span className="font-semibold text-muted-foreground uppercase text-[11px]">
                Memory Records
              </span>
              <div className="font-mono text-center font-bold text-foreground">
                {deviceA.data.memories}
              </div>
              <div className="font-mono text-center font-bold text-foreground flex items-center justify-center gap-2">
                <span>{deviceB.data.memories}</span>
                {memoriesDelta !== 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      memoriesDelta > 0
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}
                  >
                    {memoriesDelta > 0 ? `+${memoriesDelta} on A` : `+${Math.abs(memoriesDelta)} on B`}
                  </span>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="p-3.5 grid grid-cols-3 items-center hover:bg-muted/10 transition-colors">
              <span className="font-semibold text-muted-foreground uppercase text-[11px]">
                Installed Skills
              </span>
              <div className="font-mono text-center font-bold text-foreground">
                {deviceA.data.skills}
              </div>
              <div className="font-mono text-center font-bold text-foreground flex items-center justify-center gap-2">
                <span>{deviceB.data.skills}</span>
                {skillsDelta !== 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      skillsDelta > 0
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}
                  >
                    {skillsDelta > 0 ? `+${skillsDelta} on A` : `+${Math.abs(skillsDelta)} on B`}
                  </span>
                )}
              </div>
            </div>

            {/* Data Size */}
            <div className="p-3.5 grid grid-cols-3 items-center hover:bg-muted/10 transition-colors">
              <span className="font-semibold text-muted-foreground uppercase text-[11px]">
                Total Sync Size
              </span>
              <div className="font-mono text-center font-bold text-foreground">
                {formatBytes(deviceA.data.totalSizeBytes)}
              </div>
              <div className="font-mono text-center font-bold text-foreground">
                {formatBytes(deviceB.data.totalSizeBytes)}
              </div>
            </div>

            {/* Network Route */}
            <div className="p-3.5 grid grid-cols-3 items-center hover:bg-muted/10 transition-colors">
              <span className="font-semibold text-muted-foreground uppercase text-[11px]">
                Tailscale Route
              </span>
              <div className="font-mono text-center capitalize text-emerald-500">
                {deviceA.tailscale.connectionType || 'direct'}
              </div>
              <div className="font-mono text-center capitalize text-emerald-500">
                {deviceB.tailscale.connectionType || 'direct'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
