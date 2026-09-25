import React from 'react';
import { Device } from '@hermes-hub/types';
import { formatBytes, formatTimeAgo } from '@hermes-hub/shared';
import {
  X,
  CheckCircle2,
  RefreshCw,
  Archive,
  FolderOpen,
  FileText,
  KeyRound,
  Terminal,
  Wifi,
  Layers,
  HardDrive,
  Cpu,
} from 'lucide-react';

interface DeviceDetailModalProps {
  device: Device | null;
  onClose: () => void;
  onSync: (device: Device) => void;
  onAction: (action: string, device: Device) => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  onClose,
  onSync,
  onAction,
}) => {
  if (!device) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-foreground">{device.deviceName}</h3>
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    device.online
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      device.online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                    }`}
                  />
                  {device.online ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-1">
                {device.hostname} • {device.os.toUpperCase()} ({device.architecture})
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Hermes Agent Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Hermes Agent
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">State</div>
                <div className="text-sm font-semibold text-foreground mt-1 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${device.hermes.running ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {device.hermes.running ? 'Running' : 'Stopped'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">Version</div>
                <div className="text-sm font-semibold font-mono text-foreground mt-1">
                  v{device.hermes.version}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">Profile</div>
                <div className="text-sm font-semibold text-foreground mt-1 font-mono">
                  {device.hermes.profile}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">Total Data</div>
                <div className="text-sm font-semibold font-mono text-foreground mt-1">
                  {formatBytes(device.data.totalSizeBytes)}
                </div>
              </div>
            </div>

            <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border/40 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Hermes Home:</span>
              <span className="font-mono text-foreground truncate max-w-sm">{device.hermes.home}</span>
            </div>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="text-xs text-muted-foreground">Sessions</div>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {device.data.sessions}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="text-xs text-muted-foreground">Skills</div>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {device.data.skills}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="text-xs text-muted-foreground">Memories</div>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {device.data.memories}
              </div>
            </div>
          </div>

          {/* Sync Stats */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Synchronization
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">Last Sync</div>
                <div className="text-xs font-medium text-foreground mt-1">
                  {formatTimeAgo(device.sync.lastSync)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="text-sm font-bold font-mono text-foreground mt-1">
                  {device.sync.pendingFiles}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">Uploaded</div>
                <div className="text-sm font-bold font-mono text-foreground mt-1">
                  {formatBytes(device.sync.bytesUploaded)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="text-xs text-muted-foreground">Downloaded</div>
                <div className="text-sm font-bold font-mono text-foreground mt-1">
                  {formatBytes(device.sync.bytesDownloaded)}
                </div>
              </div>
            </div>
          </div>

          {/* Network: Tailscale & Syncthing */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Network & Mesh
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Tailscale</div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {device.tailscale.ip || 'Not connected'}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-emerald-500 font-semibold">
                  {device.tailscale.connected ? 'Connected' : 'Offline'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Syncthing</div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[150px]">
                      {device.syncthing.deviceId || 'Offline'}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-emerald-500 font-semibold">
                  {device.syncthing.running ? 'Connected' : 'Stopped'}
                </span>
              </div>
            </div>
          </div>

          {/* Supported Actions */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Actions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => onSync(device)}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                <span>Sync Now</span>
              </button>
              <button
                onClick={() => onAction('create_backup', device)}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <Archive className="h-3.5 w-3.5 text-indigo-500" />
                <span>Create Backup</span>
              </button>
              <button
                onClick={() => onAction('open_folder', device)}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                <span>Open Hermes Folder</span>
              </button>
              <button
                onClick={() => onAction('view_files', device)}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                <span>View Files</span>
              </button>
              <button
                onClick={() => onAction('view_secrets', device)}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 text-purple-500" />
                <span>View Secrets</span>
              </button>
              <button
                onClick={() => onAction('view_logs', device)}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                <span>View Logs</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
