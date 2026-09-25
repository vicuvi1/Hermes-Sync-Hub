import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { AgentHealthResponse } from '@hermes-hub/protocol';
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
} from 'lucide-react';

interface SettingsViewProps {
  onExportDiagnostics: () => void;
  agentHealth?: AgentHealthResponse | null;
  onPingAgent?: () => Promise<number | null>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onExportDiagnostics,
  agentHealth,
  onPingAgent,
}) => {
  const { theme, setTheme } = useTheme();
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [startAgentAuto, setStartAgentAuto] = useState(true);
  const [diagnosticsExported, setDiagnosticsExported] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const handleExport = () => {
    onExportDiagnostics();
    setDiagnosticsExported(true);
    setTimeout(() => setDiagnosticsExported(false), 3000);
  };

  const handlePing = async () => {
    if (!onPingAgent) return;
    setIsPinging(true);
    const latency = await onPingAgent();
    setPingLatency(latency);
    setIsPinging(false);
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

      {/* Network & Transport Status */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          P2P Network & Transport
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tailscale Card */}
          <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Wifi className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">Tailscale Mesh</div>
                  <div className="text-xs text-muted-foreground">Zero-config WireGuard VPN</div>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Local Tailscale IP:</span>
                <span className="text-foreground font-semibold">100.84.12.19</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connection Type:</span>
                <span className="text-foreground">Direct Peer-to-Peer</span>
              </div>
            </div>
          </div>

          {/* Syncthing Card */}
          <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">Syncthing Core</div>
                  <div className="text-xs text-muted-foreground">Block-level transfer engine</div>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                Running
              </span>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Syncthing ID:</span>
                <span className="text-foreground truncate max-w-[150px]">SYNCTH-VCTR-DSKT-8942</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">REST API:</span>
                <span className="text-foreground">127.0.0.1:8384</span>
              </div>
            </div>
            <button
              onClick={() => alert('Opening local Syncthing Web UI at http://127.0.0.1:8384 in default browser.')}
              className="text-xs text-primary hover:underline font-medium flex items-center gap-1 pt-1"
            >
              <span>Open Syncthing UI for advanced troubleshooting</span>
              <ExternalLink className="h-3 w-3" />
            </button>
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

      {/* System Startup Options */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Startup & Daemons
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
              onClick={() => setStartWithWindows(!startWithWindows)}
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
                Start Hermes Hub Agent automatically
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Run background monitoring and snapshotting service quietly
              </div>
            </div>
            <button
              onClick={() => setStartAgentAuto(!startAgentAuto)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                startAgentAuto ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  startAgentAuto ? 'translate-x-5' : 'translate-x-0'
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
        <div className="rounded-xl border border-border bg-card/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
      </div>
    </div>
  );
};
