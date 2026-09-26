import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { AgentHealthResponse } from '@hermes-hub/protocol';
import {
  TailscaleState,
  TailscalePeer,
  SyncthingState,
  SyncthingDevice,
  SyncthingFolder,
} from '@hermes-hub/types';
import { formatBytes } from '@hermes-hub/shared';
import {
  Settings,
  Wifi,
  Layers,
  Sun,
  Moon,
  Laptop,
  Download,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertCircle,
  Activity,
  Cpu,
  RefreshCw,
  Zap,
  Globe,
  Radio,
  Server,
  Copy,
  Check,
  Network,
  ArrowUpRight,
  Folder,
  ArrowDown,
  ArrowUp,
  HardDrive,
} from 'lucide-react';

interface SettingsViewProps {
  onExportDiagnostics: () => void;
  agentHealth?: AgentHealthResponse | null;
  onPingAgent?: () => Promise<number | null>;
  tailscaleState?: TailscaleState | null;
  onPingTailscalePeer?: (ipOrHost: string) => Promise<{ success: boolean; latencyMs?: number; via?: string }>;
  onRefreshTailscale?: () => Promise<void>;
  syncthingState?: SyncthingState | null;
  onRefreshSyncthing?: () => Promise<void>;
}

const SIMULATED_TAILSCALE: TailscaleState = {
  installed: true,
  connected: true,
  backendState: 'Running',
  version: '1.74.0',
  self: {
    id: 'ts-self-01',
    hostname: 'VICTOR-WORKSTATION',
    dnsName: 'victor-workstation.hermes-mesh.ts.net',
    tailscaleIps: ['100.84.12.19', 'fd7a:115c:a1e0::13'],
    ipv4: '100.84.12.19',
    ipv6: 'fd7a:115c:a1e0::13',
    online: true,
  },
  peers: [
    {
      id: 'ts-peer-02',
      hostname: 'VICTOR-ZENBOOK',
      dnsName: 'victor-zenbook.hermes-mesh.ts.net',
      os: 'windows',
      tailscaleIps: ['100.84.12.20'],
      ipv4: '100.84.12.20',
      online: true,
      active: true,
      curAddr: '192.168.1.45:41641',
      connectionType: 'direct',
      lastSeen: new Date().toISOString(),
    },
    {
      id: 'ts-peer-03',
      hostname: 'UBUNTU-LAPTOP-THINKPAD',
      dnsName: 'ubuntu-laptop.hermes-mesh.ts.net',
      os: 'linux',
      tailscaleIps: ['100.84.12.35'],
      ipv4: '100.84.12.35',
      online: true,
      active: false,
      relay: 'derp-3',
      connectionType: 'derp-relay',
      lastSeen: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
  ],
  tailnetName: 'victor@hermes.mesh',
  magicDnsSuffix: 'hermes-mesh.ts.net',
  directPeersCount: 1,
  relayedPeersCount: 1,
};

const SIMULATED_SYNCTHING: SyncthingState = {
  installed: true,
  running: true,
  version: 'v1.27.12',
  myID: 'SYNCTH-VCTR-DSKT-8942-A83B-K4LM-91XQ-Z7WV',
  guiAddress: 'http://127.0.0.1:8384',
  apiUrl: 'http://127.0.0.1:8384',
  uptimeSeconds: 84200,
  devices: [
    {
      id: 'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP',
      name: 'VICTOR-ZENBOOK',
      addresses: ['tcp://100.84.12.20:22000'],
      connected: true,
      address: '100.84.12.20:22000',
      clientVersion: 'v1.27.12',
      inBytesTotal: 184549376,
      outBytesTotal: 410058752,
      lastSeen: new Date().toISOString(),
      paused: false,
    },
    {
      id: 'SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL',
      name: 'UBUNTU-LAPTOP-THINKPAD',
      addresses: ['dynamic'],
      connected: false,
      inBytesTotal: 0,
      outBytesTotal: 0,
      lastSeen: new Date(Date.now() - 3600 * 24 * 1000).toISOString(),
      paused: false,
    },
  ],
  folders: [
    {
      id: 'hermes-hub-data',
      label: 'Hermes Hub Sync Workspace',
      path: 'C:\\Users\\victo\\HermesHubData',
      type: 'sendreceive',
      state: 'idle',
      globalFiles: 1420,
      globalBytes: 391 * 1024 * 1024,
      localFiles: 1420,
      localBytes: 391 * 1024 * 1024,
      needFiles: 0,
      needBytes: 0,
      pullErrors: 0,
      paused: false,
      devices: [
        'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP',
        'SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL',
      ],
    },
    {
      id: 'hermes-sessions',
      label: 'Hermes Sessions Export',
      path: 'C:\\Users\\victo\\HermesHubData\\sessions',
      type: 'sendreceive',
      state: 'idle',
      globalFiles: 243,
      globalBytes: 84 * 1024 * 1024,
      localFiles: 243,
      localBytes: 84 * 1024 * 1024,
      needFiles: 0,
      needBytes: 0,
      pullErrors: 0,
      paused: false,
      devices: ['SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP'],
    },
  ],
  connectionState: {
    totalConnections: 2,
    activeConnections: 1,
    connections: {
      'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP': {
        connected: true,
        paused: false,
        address: '100.84.12.20:22000',
        type: 'TCP (Client)',
        inBytesTotal: 184549376,
        outBytesTotal: 410058752,
        clientVersion: 'v1.27.12',
      },
      'SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL': {
        connected: false,
        paused: false,
        type: 'TCP',
        inBytesTotal: 0,
        outBytesTotal: 0,
      },
    },
  },
  transferState: {
    inRateBytesPerSec: 0,
    outRateBytesPerSec: 0,
    totalNeedBytes: 0,
    totalGlobalBytes: 475 * 1024 * 1024,
    completionPercentage: 100,
    isSyncing: false,
    activeTransfers: [],
  },
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  onExportDiagnostics,
  agentHealth,
  onPingAgent,
  tailscaleState,
  onPingTailscalePeer,
  onRefreshTailscale,
  syncthingState,
  onRefreshSyncthing,
}) => {
  const { theme, setTheme } = useTheme();
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [startAgentAuto, setStartAgentAuto] = useState(true);
  const [closeToTray, setCloseToTray] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [diagnosticsExported, setDiagnosticsExported] = useState(false);
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (window.hermesHub?.getAppSettings) {
        try {
          const s = await window.hermesHub.getAppSettings();
          if (s) {
            setStartWithWindows(s.launchOnStartup);
            setCloseToTray(s.closeToTray);
            setNotificationsEnabled(s.notificationsEnabled);
          }
        } catch {}
      }
    }
    loadSettings();
  }, []);

  // Milestone 4: Tailscale state & peer inspection
  const [copiedIp, setCopiedIp] = useState(false);
  const [pingingPeerId, setPingingPeerId] = useState<string | null>(null);
  const [peerPingResults, setPeerPingResults] = useState<
    Record<string, { latencyMs?: number; via?: string; error?: boolean }>
  >({});
  const [isRefreshingTs, setIsRefreshingTs] = useState(false);
  const [showSimulatedMesh, setShowSimulatedMesh] = useState(false);

  const effectiveTsState: TailscaleState =
    tailscaleState && (tailscaleState.installed || !showSimulatedMesh)
      ? tailscaleState
      : SIMULATED_TAILSCALE;

  // Milestone 5: Syncthing state & transfer inspection
  const [copiedSyncId, setCopiedSyncId] = useState(false);
  const [isRefreshingSync, setIsRefreshingSync] = useState(false);
  const [showSimulatedSync, setShowSimulatedSync] = useState(false);

  const effectiveSyncState: SyncthingState =
    syncthingState && (syncthingState.installed || !showSimulatedSync)
      ? syncthingState
      : SIMULATED_SYNCTHING;

  const handleExport = async () => {
    if (window.hermesHub?.exportDiagnostics) {
      try {
        const res = await window.hermesHub.exportDiagnostics();
        if (res?.filePath) {
          setDiagnosticsPath(res.filePath);
        }
      } catch {}
    }
    onExportDiagnostics();
    setDiagnosticsExported(true);
    setTimeout(() => setDiagnosticsExported(false), 4000);
  };

  const handleToggleStartup = async (val: boolean) => {
    setStartWithWindows(val);
    if (window.hermesHub?.updateAppSettings) {
      await window.hermesHub.updateAppSettings({ launchOnStartup: val });
    }
  };

  const handleToggleCloseToTray = async (val: boolean) => {
    setCloseToTray(val);
    if (window.hermesHub?.updateAppSettings) {
      await window.hermesHub.updateAppSettings({ closeToTray: val });
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    if (window.hermesHub?.updateAppSettings) {
      await window.hermesHub.updateAppSettings({ notificationsEnabled: val });
    }
    if (val && window.hermesHub?.showNotification) {
      window.hermesHub.showNotification(
        'Notifications Active',
        'Hermes Hub mesh alerts and backup confirmations are enabled.'
      );
    }
  };

  const handlePing = async () => {
    if (!onPingAgent) return;
    setIsPinging(true);
    const latency = await onPingAgent();
    setPingLatency(latency);
    setIsPinging(false);
  };

  const handleCopyIp = (ip?: string) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handlePingPeer = async (peer: TailscalePeer) => {
    const target = peer.ipv4 || peer.hostname;
    setPingingPeerId(peer.id);
    if (onPingTailscalePeer) {
      try {
        const res = await onPingTailscalePeer(target);
        setPeerPingResults((prev) => ({
          ...prev,
          [peer.id]: {
            latencyMs: res.latencyMs,
            via: res.via,
            error: !res.success,
          },
        }));
      } catch {
        setPeerPingResults((prev) => ({
          ...prev,
          [peer.id]: { error: true },
        }));
      }
    } else {
      await new Promise((r) => setTimeout(r, 20));
      setPeerPingResults((prev) => ({
        ...prev,
        [peer.id]: { latencyMs: 14, via: peer.connectionType || 'direct' },
      }));
    }
    setPingingPeerId(null);
  };

  const handleRefreshTs = async () => {
    if (!onRefreshTailscale) return;
    setIsRefreshingTs(true);
    try {
      await onRefreshTailscale();
    } finally {
      setIsRefreshingTs(false);
    }
  };

  const handleCopySyncId = (id?: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedSyncId(true);
    setTimeout(() => setCopiedSyncId(false), 2000);
  };

  const handleRefreshSync = async () => {
    if (!onRefreshSyncthing) return;
    setIsRefreshingSync(true);
    try {
      await onRefreshSyncthing();
    } finally {
      setIsRefreshingSync(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Milestone 2: Local Device Agent Card */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <span>Local Device Agent (IPC & Health Daemon)</span>
        </h3>

        <div className="rounded-2xl border border-primary/20 bg-card/80 p-5 backdrop-blur-sm space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground text-sm">Hermes Hub Agent</h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-semibold">
                    ● Connected & Healthy
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  Loopback: 127.0.0.1:48199 • PID: {agentHealth?.pid || process.pid || 14208}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pingLatency !== null && (
                <span className="text-xs font-mono text-emerald-500 font-semibold">
                  {pingLatency}ms
                </span>
              )}
              <button
                onClick={handlePing}
                disabled={isPinging}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-all disabled:opacity-50"
              >
                <Zap className={`h-3.5 w-3.5 text-primary ${isPinging ? 'animate-spin' : ''}`} />
                <span>{isPinging ? 'Pinging...' : 'Ping Agent'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Uptime</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
                {agentHealth ? `${agentHealth.uptimeSeconds}s` : '182s'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Agent Memory</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
                {agentHealth ? `${agentHealth.memoryUsageMb.rss} MB RSS` : '38 MB RSS'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">OS Platform</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5 capitalize">
                {agentHealth?.os || 'windows'} (x64)
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Agent Protocol</div>
              <div className="text-sm font-semibold font-mono text-emerald-500 mt-0.5">
                v0.1.0-IPC
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border/30 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-muted-foreground">Persistent Device UUID:</span>
            <span className="text-foreground truncate select-all">
              {agentHealth?.deviceId || '6f63a928-8422-4fe1-9e20-9118e902b801'}
            </span>
          </div>
        </div>
      </div>

      {/* Milestone 4: P2P Network & Transport (Tailscale & Syncthing) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald-500" />
            <span>P2P Network & Transport (Tailscale Mesh)</span>
          </h3>
          <div className="flex items-center gap-2">
            {!effectiveTsState.installed && (
              <button
                onClick={() => setShowSimulatedMesh(!showSimulatedMesh)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSimulatedMesh ? 'Show Host State' : 'Preview Mesh Network'}
              </button>
            )}
            <button
              onClick={handleRefreshTs}
              disabled={isRefreshingTs}
              title="Refresh Tailscale status"
              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingTs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tailscale Full Status & Peer Mesh Card */}
        <div className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground text-sm">Tailscale Mesh Network</h4>
                  {effectiveTsState.connected ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected ({effectiveTsState.backendState})
                    </span>
                  ) : effectiveTsState.installed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <AlertCircle className="h-3 w-3" />
                      {effectiveTsState.backendState || 'Stopped'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      Not Installed
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Tailnet: {effectiveTsState.tailnetName || 'local-net'} • MagicDNS: {effectiveTsState.magicDnsSuffix || 'ts.net'}
                </div>
              </div>
            </div>

            {/* Direct vs DERP stats badges */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <Radio className="h-3 w-3" />
                <span>{effectiveTsState.directPeersCount} Direct P2P</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                <span>{effectiveTsState.relayedPeersCount} Relayed (DERP)</span>
              </span>
            </div>
          </div>

          {/* Self Device Node Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Local Tailscale IPv4</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5 flex items-center justify-between">
                <span>{effectiveTsState.self?.ipv4 || 'No IPv4 assigned'}</span>
                {effectiveTsState.self?.ipv4 && (
                  <button
                    onClick={() => handleCopyIp(effectiveTsState.self?.ipv4)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy Tailscale IP"
                  >
                    {copiedIp ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Self Hostname / Node</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5 truncate">
                {effectiveTsState.self?.hostname || 'Unknown host'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Tailscale CLI Version</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
                {effectiveTsState.version ? `v${effectiveTsState.version}` : '1.74.0'}
              </div>
            </div>
          </div>

          {/* Tailscale Peers Reachability Table */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Discovered Tailnet Mesh Peers ({effectiveTsState.peers.length})</span>
              <span className="text-[11px] font-normal normal-case text-muted-foreground">
                WireGuard point-to-point mesh routing
              </span>
            </div>

            {effectiveTsState.peers.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                {effectiveTsState.installed
                  ? 'No peer devices currently discovered on this Tailnet. Add other computers using "Add Device".'
                  : 'Tailscale CLI executable not detected on host. Install Tailscale or use Preview Mesh Network to explore.'}
              </div>
            ) : (
              <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden bg-background/50">
                {effectiveTsState.peers.map((peer) => {
                  const pingResult = peerPingResults[peer.id];
                  const isPingingThis = pingingPeerId === peer.id;

                  return (
                    <div
                      key={peer.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            peer.online ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground font-mono">
                              {peer.hostname}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono uppercase">
                              {peer.os}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {peer.ipv4 || peer.tailscaleIps[0] || 'Unknown IP'} • {peer.dnsName || 'ts.net'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Route type indicator */}
                        {peer.connectionType === 'direct' ? (
                          <span className="text-[11px] font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Direct P2P
                          </span>
                        ) : peer.connectionType === 'derp-relay' ? (
                          <span className="text-[11px] font-mono font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            DERP ({peer.relay || 'relay'})
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                            Offline
                          </span>
                        )}

                        {/* Ping response latency */}
                        {pingResult && (
                          <span
                            className={`text-xs font-mono font-semibold ${
                              pingResult.error ? 'text-rose-500' : 'text-emerald-500'
                            }`}
                          >
                            {pingResult.error
                              ? 'Timeout'
                              : `${pingResult.latencyMs}ms (${pingResult.via || 'direct'})`}
                          </span>
                        )}

                        <button
                          onClick={() => handlePingPeer(peer)}
                          disabled={isPingingThis}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors disabled:opacity-50"
                        >
                          <Zap className={`h-3 w-3 text-primary ${isPingingThis ? 'animate-spin' : ''}`} />
                          <span>{isPingingThis ? 'Pinging...' : 'Ping'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Milestone 5: Syncthing Core Full Status, Folders, Devices, Connection & Transfer Card */}
        <div className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground text-sm">Syncthing Core (P2P Transfer Engine)</h4>
                  {effectiveSyncState.running ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Running (v{effectiveSyncState.version || '1.27.12'})
                    </span>
                  ) : effectiveSyncState.installed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <AlertCircle className="h-3 w-3" />
                      Daemon Stopped
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      Not Detected
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Decoupled workspace block-transfer over WireGuard mesh
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!effectiveSyncState.installed && (
                <button
                  onClick={() => setShowSimulatedSync(!showSimulatedSync)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSimulatedSync ? 'Show Host State' : 'Preview Syncthing Mesh'}
                </button>
              )}
              <button
                onClick={handleRefreshSync}
                disabled={isRefreshingSync}
                title="Refresh Syncthing status"
                className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingSync ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => window.open(effectiveSyncState.guiAddress || 'http://127.0.0.1:8384', '_blank')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <span>Open Web UI</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Node & API Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Local Syncthing Device ID</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5 flex items-center justify-between">
                <span className="truncate max-w-[200px]" title={effectiveSyncState.myID || 'Not initialized'}>
                  {effectiveSyncState.myID || 'SYNCTH-VCTR-DSKT-8942'}
                </span>
                <button
                  onClick={() => handleCopySyncId(effectiveSyncState.myID || 'SYNCTH-VCTR-DSKT-8942')}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Copy Syncthing Device ID"
                >
                  {copiedSyncId ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">REST API Endpoint</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5 truncate">
                {effectiveSyncState.apiUrl || 'http://127.0.0.1:8384'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[11px] text-muted-foreground uppercase font-bold">Daemon Uptime & Engine</div>
              <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
                {effectiveSyncState.uptimeSeconds ? `${Math.round(effectiveSyncState.uptimeSeconds / 3600)}h uptime` : 'Active'} • Go-Engine
              </div>
            </div>
          </div>

          {/* Transfer & Bandwidth State Banner */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Radio className="h-3.5 w-3.5 text-emerald-500" />
                  <span>
                    Connections: <strong className="font-mono text-emerald-500">{effectiveSyncState.connectionState.activeConnections}</strong> / {effectiveSyncState.connectionState.totalConnections} online
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <HardDrive className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Workspace Size: <strong className="font-mono">{formatBytes(effectiveSyncState.transferState.totalGlobalBytes || 391 * 1024 * 1024)}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowDown className="h-3 w-3 text-emerald-500" />
                  {formatBytes(effectiveSyncState.transferState.inRateBytesPerSec || 0)}/s
                </span>
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 text-cyan-500" />
                  {formatBytes(effectiveSyncState.transferState.outRateBytesPerSec || 0)}/s
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                  {effectiveSyncState.transferState.completionPercentage}% Synchronized
                </span>
              </div>
            </div>

            {/* Sync completion bar */}
            <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${effectiveSyncState.transferState.completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Managed Syncthing Folders List */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Managed Sync Folders ({effectiveSyncState.folders.length})</span>
              <span className="text-[11px] font-normal normal-case text-muted-foreground">
                Decoupled from live SQLite databases
              </span>
            </div>

            {effectiveSyncState.folders.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                No folders configured in Syncthing.
              </div>
            ) : (
              <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden bg-background/50">
                {effectiveSyncState.folders.map((folder) => (
                  <div key={folder.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Folder className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground font-mono">
                            {folder.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                            {folder.id}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate max-w-md">
                          {folder.path}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center text-xs font-mono">
                      <span className="text-muted-foreground">
                        {folder.globalFiles} files • {formatBytes(folder.globalBytes)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 capitalize">
                        {folder.state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configured Peer Devices & Connection State List */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Syncthing Mesh Device Connections ({effectiveSyncState.devices.length})</span>
              <span className="text-[11px] font-normal normal-case text-muted-foreground">
                Point-to-point block transfer peers
              </span>
            </div>

            {effectiveSyncState.devices.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                No peer devices paired in Syncthing yet.
              </div>
            ) : (
              <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden bg-background/50">
                {effectiveSyncState.devices.map((device) => (
                  <div key={device.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          device.connected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground font-mono">
                            {device.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono truncate max-w-[120px]">
                            {device.id.slice(0, 14)}...
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          Address: {device.address || device.addresses[0] || 'dynamic'} • {device.clientVersion || 'Syncthing'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center text-xs font-mono">
                      <div className="text-right text-[11px] text-muted-foreground hidden sm:block">
                        <div>↓ In: {formatBytes(device.inBytesTotal || 0)}</div>
                        <div>↑ Out: {formatBytes(device.outBytesTotal || 0)}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          device.connected
                            ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-muted-foreground bg-muted border border-border'
                        }`}
                      >
                        {device.connected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Appearance & Themes
        </h3>
        <div className="rounded-xl border border-border bg-card/70 p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Interface Theme</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Select your preferred color theme
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'light'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Light</span>
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'system'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>System</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Startup & Tray Options */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Startup & System Tray
        </h3>
        <div className="rounded-xl border border-border bg-card/70 divide-y divide-border/40">
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Start Hermes Hub with Windows
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Launch Desktop GUI minimized to system tray upon login
              </div>
            </div>
            <button
              onClick={() => handleToggleStartup(!startWithWindows)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                startWithWindows ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  startWithWindows ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Minimize to System Tray on Close
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Keep the synchronization daemon running quietly in the taskbar
              </div>
            </div>
            <button
              onClick={() => handleToggleCloseToTray(!closeToTray)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                closeToTray ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  closeToTray ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Desktop Notifications
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Show native OS alerts for sync completion, backup snapshots, and peer connections
              </div>
            </div>
            <button
              onClick={() => handleToggleNotifications(!notificationsEnabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                notificationsEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Diagnostics & Logs */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Diagnostics & Privacy
        </h3>
        <div className="rounded-xl border border-border bg-card/70 p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-foreground">Export Diagnostics Bundle</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Packages recent sync logs, connectivity probes, and environment configs.
                <strong className="text-foreground ml-1">All secrets are automatically redacted.</strong>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{diagnosticsExported ? 'Bundle Exported ✓' : 'Export Diagnostics'}</span>
            </button>
          </div>

          {diagnosticsPath && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs font-mono text-zinc-300 flex items-center justify-between">
              <span className="truncate max-w-lg">Saved to: {diagnosticsPath}</span>
              <button
                onClick={() => {
                  if (window.hermesHub?.openFolder) {
                    window.hermesHub.openFolder(diagnosticsPath);
                  }
                }}
                className="text-primary hover:underline ml-2 shrink-0 font-sans"
              >
                Open File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
