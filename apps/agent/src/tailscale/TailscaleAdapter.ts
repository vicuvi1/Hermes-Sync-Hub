import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TailscaleState, TailscalePeer } from '@hermes-hub/types';

const execFileAsync = promisify(execFile);

export interface ITailscaleAdapter {
  isInstalled(): Promise<boolean>;
  getState(): Promise<TailscaleState>;
  pingPeer(ipOrHost: string): Promise<{ success: boolean; latencyMs?: number; via?: string }>;
}

export class TailscaleAdapter implements ITailscaleAdapter {
  private customExePath?: string;
  private cachedExePath: string | null = null;

  constructor(customExePath?: string) {
    this.customExePath = customExePath;
  }

  /**
   * Discovers the tailscale CLI executable path across operating systems
   */
  findExecutable(): string | null {
    if (this.customExePath && fs.existsSync(this.customExePath)) {
      return this.customExePath;
    }
    if (this.cachedExePath && fs.existsSync(this.cachedExePath)) {
      return this.cachedExePath;
    }

    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    const candidates: string[] = [];

    if (isWindows) {
      const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const localAppData = process.env.LOCALAPPDATA || '';

      candidates.push(path.join(progFiles, 'Tailscale', 'tailscale.exe'));
      candidates.push(path.join(progFilesX86, 'Tailscale', 'tailscale.exe'));
      if (localAppData) {
        candidates.push(path.join(localAppData, 'Tailscale', 'tailscale.exe'));
      }
    } else if (isMac) {
      candidates.push('/Applications/Tailscale.app/Contents/MacOS/Tailscale');
      candidates.push('/usr/local/bin/tailscale');
      candidates.push('/opt/homebrew/bin/tailscale');
    } else {
      // Linux
      candidates.push('/usr/bin/tailscale');
      candidates.push('/usr/local/bin/tailscale');
    }

    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand)) {
          this.cachedExePath = cand;
          return cand;
        }
      } catch {}
    }

    // Check system PATH
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    const exeName = isWindows ? 'tailscale.exe' : 'tailscale';

    for (const dir of pathDirs) {
      if (!dir) continue;
      const full = path.join(dir, exeName);
      try {
        if (fs.existsSync(full)) {
          this.cachedExePath = full;
          return full;
        }
      } catch {}
    }

    return null;
  }

  async isInstalled(): Promise<boolean> {
    return this.findExecutable() !== null;
  }

  /**
   * Reads structured Tailscale status using machine-readable JSON format
   */
  async getState(): Promise<TailscaleState> {
    const exe = this.findExecutable();
    if (!exe) {
      return {
        installed: false,
        connected: false,
        backendState: 'NotInstalled',
        peers: [],
        directPeersCount: 0,
        relayedPeersCount: 0,
      };
    }

    try {
      const { stdout } = await execFileAsync(exe, ['status', '--json'], { timeout: 4000 });
      return this.parseTailscaleJson(stdout);
    } catch (err: any) {
      return {
        installed: true,
        connected: false,
        backendState: 'Stopped',
        peers: [],
        directPeersCount: 0,
        relayedPeersCount: 0,
      };
    }
  }

  /**
   * Parses machine-readable JSON returned from `tailscale status --json`
   */
  parseTailscaleJson(rawJson: string): TailscaleState {
    try {
      const data = JSON.parse(rawJson);

      const isRunning = data.BackendState === 'Running';
      const selfData = data.Self || {};
      const selfIps: string[] = selfData.TailscaleIPs || [];
      const ipv4 = selfIps.find((ip) => ip.includes('.'));
      const ipv6 = selfIps.find((ip) => ip.includes(':'));

      const peerMap = data.Peer || {};
      const peers: TailscalePeer[] = [];
      let directCount = 0;
      let relayCount = 0;

      for (const [key, p] of Object.entries<any>(peerMap)) {
        const ips: string[] = p.TailscaleIPs || [];
        const peerIpv4 = ips.find((ip) => ip.includes('.'));
        const online = !!p.Online;
        const hasDirectAddr = !!p.CurAddr && !p.Relay;

        let connType: 'direct' | 'derp-relay' | 'offline' = 'offline';
        if (online) {
          if (hasDirectAddr) {
            connType = 'direct';
            directCount++;
          } else {
            connType = 'derp-relay';
            relayCount++;
          }
        }

        peers.push({
          id: p.ID ? String(p.ID) : key,
          hostname: p.HostName || 'unknown',
          dnsName: p.DNSName || '',
          os: p.OS ? p.OS.toLowerCase() : 'unknown',
          tailscaleIps: ips,
          ipv4: peerIpv4,
          online,
          active: !!p.Active,
          curAddr: p.CurAddr || undefined,
          relay: p.Relay || undefined,
          connectionType: connType,
          lastSeen: p.LastSeen || undefined,
        });
      }

      return {
        installed: true,
        connected: isRunning,
        backendState: data.BackendState || 'Running',
        version: data.Version,
        self: {
          id: String(selfData.ID || 'local'),
          hostname: selfData.HostName || 'localhost',
          dnsName: selfData.DNSName || '',
          tailscaleIps: selfIps,
          ipv4,
          ipv6,
          online: !!selfData.Online,
        },
        peers,
        tailnetName: data.CurrentTailnet?.Name,
        magicDnsSuffix: data.MagicDNSSuffix,
        directPeersCount: directCount,
        relayedPeersCount: relayCount,
      };
    } catch (e) {
      return {
        installed: true,
        connected: false,
        backendState: 'Stopped',
        peers: [],
        directPeersCount: 0,
        relayedPeersCount: 0,
      };
    }
  }

  /**
   * Pings a peer using tailscale ping CLI
   */
  async pingPeer(ipOrHost: string): Promise<{ success: boolean; latencyMs?: number; via?: string }> {
    const exe = this.findExecutable();
    if (!exe) {
      return { success: false };
    }

    try {
      const { stdout } = await execFileAsync(exe, ['ping', '--timeout=2s', '--c=1', ipOrHost], { timeout: 3000 });
      const latencyMatch = stdout.match(/in\s+([0-9.]+)\s*ms/i);
      const latencyMs = latencyMatch ? parseFloat(latencyMatch[1]) : 12;
      const viaDerp = stdout.toLowerCase().includes('derp');

      return {
        success: true,
        latencyMs,
        via: viaDerp ? 'derp-relay' : 'direct',
      };
    } catch {
      return { success: false };
    }
  }
}

/**
 * Mock Tailscale Adapter for test environments and headless development
 */
export class MockTailscaleAdapter implements ITailscaleAdapter {
  async isInstalled(): Promise<boolean> {
    return true;
  }

  async getState(): Promise<TailscaleState> {
    return {
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
          online: false,
          active: false,
          relay: 'derp-3',
          connectionType: 'offline',
          lastSeen: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        },
      ],
      tailnetName: 'victor@hermes.mesh',
      magicDnsSuffix: 'hermes-mesh.ts.net',
      directPeersCount: 1,
      relayedPeersCount: 0,
    };
  }

  async pingPeer(ipOrHost: string): Promise<{ success: boolean; latencyMs?: number; via?: string }> {
    return {
      success: true,
      latencyMs: 14,
      via: 'direct',
    };
  }
}
