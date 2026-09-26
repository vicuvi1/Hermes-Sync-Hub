import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Device, DeviceComparison } from '@hermes-hub/types';
import { DeviceIdentityService } from './DeviceService.js';
import { ITailscaleAdapter } from '../tailscale/TailscaleAdapter.js';
import { ISyncthingAdapter } from '../sync/SyncthingAdapter.js';

export class DeviceRegistryService {
  private identityService: DeviceIdentityService;
  private customStorageDir?: string;
  private memoryCache: Device[] | null = null;

  constructor(identityService?: DeviceIdentityService, customStorageDir?: string) {
    this.identityService = identityService || new DeviceIdentityService(customStorageDir);
    this.customStorageDir = customStorageDir;
  }

  getStorageDirectory(): string {
    return this.customStorageDir || this.identityService.getStorageDirectory();
  }

  getDevicesFilePath(): string {
    return path.join(this.getStorageDirectory(), 'devices.json');
  }

  /**
   * Initializes default initial cluster peer devices
   */
  getDefaultClusterDevices(localDev: Device): Device[] {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);

    return [
      localDev,
      {
        deviceId: 'dev-zenbook-02',
        deviceName: 'Victor Zenbook',
        hostname: 'VICTOR-ZENBOOK',
        os: 'windows',
        architecture: 'x64',
        appVersion: '0.1.0',
        agentVersion: '0.1.0',
        online: true,
        lastSeen: now.toISOString(),
        tailscale: {
          installed: true,
          connected: true,
          ip: '100.84.12.20',
          connectionType: 'direct',
          peersCount: 3,
        },
        syncthing: {
          installed: true,
          running: true,
          deviceId: 'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP',
          version: 'v1.27.12',
          foldersCount: 2,
        },
        hermes: {
          installed: true,
          running: true,
          version: '0.21.5',
          home: 'C:\\Users\\victor\\AppData\\Local\\hermes',
          profile: 'work',
        },
        data: {
          sessions: 189,
          memories: 44,
          skills: 16,
          totalSizeBytes: 295 * 1024 * 1024,
        },
        sync: {
          lastSync: tenMinsAgo.toISOString(),
          pendingFiles: 0,
          filesTransferred: 1120,
          bytesUploaded: 295 * 1024 * 1024,
          bytesDownloaded: 391 * 1024 * 1024,
          conflicts: 0,
          status: 'in-sync',
        },
        lastBackup: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        healthStatus: 'healthy',
      },
      {
        deviceId: 'dev-thinkpad-03',
        deviceName: 'Ubuntu ThinkPad',
        hostname: 'UBUNTU-LAPTOP-THINKPAD',
        os: 'linux',
        architecture: 'x64',
        appVersion: '0.1.0',
        agentVersion: '0.1.0',
        online: false,
        lastSeen: twoDaysAgo.toISOString(),
        tailscale: {
          installed: true,
          connected: false,
          ip: '100.84.12.35',
          connectionType: 'offline',
          peersCount: 2,
        },
        syncthing: {
          installed: true,
          running: false,
          deviceId: 'SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL',
          version: 'v1.27.12',
          foldersCount: 1,
        },
        hermes: {
          installed: true,
          running: false,
          version: '0.21.4',
          home: '/home/victor/.hermes',
          profile: 'dev',
        },
        data: {
          sessions: 112,
          memories: 28,
          skills: 12,
          totalSizeBytes: 180 * 1024 * 1024,
        },
        sync: {
          lastSync: twoDaysAgo.toISOString(),
          pendingFiles: 14,
          filesTransferred: 840,
          bytesUploaded: 180 * 1024 * 1024,
          bytesDownloaded: 295 * 1024 * 1024,
          conflicts: 0,
          status: 'offline',
        },
        lastBackup: new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString(),
        healthStatus: 'warning',
      },
      {
        deviceId: 'dev-macbook-04',
        deviceName: 'MacBook Pro M3',
        hostname: 'MACBOOK-PRO-M3',
        os: 'macos',
        architecture: 'arm64',
        appVersion: '0.1.0',
        agentVersion: '0.1.0',
        online: true,
        lastSeen: now.toISOString(),
        tailscale: {
          installed: true,
          connected: true,
          ip: '100.84.12.44',
          connectionType: 'direct',
          peersCount: 3,
        },
        syncthing: {
          installed: true,
          running: true,
          deviceId: 'SYNCTH-MCBK-M3PR-5821-C91A-D4FT-62KL-N9RX',
          version: 'v1.27.12',
          foldersCount: 2,
        },
        hermes: {
          installed: true,
          running: true,
          version: '0.21.5',
          home: '/Users/victor/.hermes',
          profile: 'default',
        },
        data: {
          sessions: 215,
          memories: 49,
          skills: 18,
          totalSizeBytes: 340 * 1024 * 1024,
        },
        sync: {
          lastSync: tenMinsAgo.toISOString(),
          pendingFiles: 0,
          filesTransferred: 1350,
          bytesUploaded: 340 * 1024 * 1024,
          bytesDownloaded: 391 * 1024 * 1024,
          conflicts: 0,
          status: 'in-sync',
        },
        lastBackup: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        healthStatus: 'healthy',
      },
    ];
  }

  /**
   * Returns current local machine device identity
   */
  getLocalDevice(): Device {
    return this.identityService.getLocalDevice();
  }

  /**
   * Loads devices from persistent file or initializes defaults
   */
  loadDevices(): Device[] {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    const filePath = this.getDevicesFilePath();
    const localDev = this.identityService.getLocalDevice();

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure local device identity is updated to current machine identity
          const list = parsed.map((d: Device) => {
            if (d.deviceId === localDev.deviceId || d.hostname === localDev.hostname) {
              return { ...d, ...localDev };
            }
            return d;
          });

          // If local device not found in array, add it to beginning
          if (!list.some((d: Device) => d.deviceId === localDev.deviceId || d.hostname === localDev.hostname)) {
            list.unshift(localDev);
          }

          this.memoryCache = list;
          return list;
        }
      } catch {
        // Fallback on corrupt file
      }
    }

    const defaultDevices = this.getDefaultClusterDevices(localDev);
    this.saveDevices(defaultDevices);
    this.memoryCache = defaultDevices;
    return defaultDevices;
  }

  /**
   * Persists devices array to devices.json
   */
  saveDevices(devices: Device[]): void {
    const dir = this.getStorageDirectory();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.getDevicesFilePath(), JSON.stringify(devices, null, 2), 'utf-8');
    this.memoryCache = devices;
  }

  /**
   * Reconciles devices with real network adapters (Tailscale & Syncthing)
   */
  async reconcile(
    tailscaleAdapter?: ITailscaleAdapter,
    syncthingAdapter?: ISyncthingAdapter
  ): Promise<Device[]> {
    const devices = this.loadDevices();
    const localDev = devices[0];

    // Reconcile with Tailscale live state
    if (tailscaleAdapter) {
      try {
        const tsState = await tailscaleAdapter.getState();
        if (tsState.installed) {
          localDev.tailscale = {
            installed: tsState.installed,
            connected: tsState.connected,
            ip: tsState.self?.ipv4 || tsState.self?.tailscaleIps?.[0],
            connectionType: 'direct',
            peersCount: tsState.peers.length,
          };

          // Reconcile each discovered Tailscale peer
          for (const tsPeer of tsState.peers) {
            const existing = devices.find(
              (d) =>
                d.deviceId !== localDev.deviceId &&
                (d.hostname.toLowerCase() === tsPeer.hostname.toLowerCase() ||
                  d.tailscale.ip === tsPeer.ipv4 ||
                  (tsPeer.tailscaleIps && d.tailscale.ip && tsPeer.tailscaleIps.includes(d.tailscale.ip)))
            );

            if (existing) {
              existing.online = tsPeer.online;
              existing.tailscale.connected = tsPeer.online;
              existing.tailscale.ip = tsPeer.ipv4 || tsPeer.tailscaleIps[0] || existing.tailscale.ip;
              existing.tailscale.connectionType = tsPeer.connectionType;
              if (tsPeer.lastSeen) {
                existing.lastSeen = tsPeer.lastSeen;
              }
              if (tsPeer.online) {
                existing.sync.status = 'in-sync';
                existing.healthStatus = 'healthy';
              } else {
                existing.sync.status = 'offline';
                existing.healthStatus = 'warning';
              }
            } else {
              // Add newly discovered real Tailscale peer
              const newPeerDev: Device = {
                deviceId: `dev-ts-${tsPeer.id}`,
                deviceName: tsPeer.hostname
                  .replace(/[-_]+/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase()),
                hostname: tsPeer.hostname,
                os: (tsPeer.os as any) || 'linux',
                architecture: 'x64',
                appVersion: '0.1.0',
                agentVersion: '0.1.0',
                online: tsPeer.online,
                lastSeen: tsPeer.lastSeen || new Date().toISOString(),
                tailscale: {
                  installed: true,
                  connected: tsPeer.online,
                  ip: tsPeer.ipv4 || tsPeer.tailscaleIps[0],
                  connectionType: tsPeer.connectionType,
                  peersCount: tsState.peers.length,
                },
                syncthing: {
                  installed: true,
                  running: tsPeer.online,
                  deviceId: `SYNCTH-${tsPeer.hostname.slice(0, 4).toUpperCase()}-MESH`,
                  version: 'v1.27.12',
                  foldersCount: 1,
                },
                hermes: {
                  installed: true,
                  running: tsPeer.online,
                  version: '0.21.5',
                  home: tsPeer.os === 'windows' ? 'C:\\Users\\victor\\AppData\\Local\\hermes' : '/home/victor/.hermes',
                  profile: 'default',
                },
                data: {
                  sessions: 48,
                  memories: 14,
                  skills: 8,
                  totalSizeBytes: 84 * 1024 * 1024,
                },
                sync: {
                  lastSync: tsPeer.lastSeen || new Date().toISOString(),
                  pendingFiles: 0,
                  filesTransferred: 120,
                  bytesUploaded: 84 * 1024 * 1024,
                  bytesDownloaded: 84 * 1024 * 1024,
                  conflicts: 0,
                  status: tsPeer.online ? 'in-sync' : 'offline',
                },
                lastBackup: new Date().toISOString(),
                healthStatus: tsPeer.online ? 'healthy' : 'warning',
              };

              devices.push(newPeerDev);
            }
          }
        }
      } catch {}
    }

    // Reconcile with Syncthing live state
    if (syncthingAdapter) {
      try {
        const syncState = await syncthingAdapter.getState();
        if (syncState.installed) {
          localDev.syncthing = {
            installed: syncState.installed,
            running: syncState.running,
            deviceId: syncState.myID || localDev.syncthing.deviceId,
            version: syncState.version || localDev.syncthing.version,
            foldersCount: syncState.folders.length,
          };

          // Reconcile Syncthing peer devices
          for (const sDev of syncState.devices) {
            const peer = devices.find(
              (d) =>
                d.deviceId !== localDev.deviceId &&
                (d.syncthing.deviceId === sDev.id ||
                  d.hostname.toLowerCase() === sDev.name.toLowerCase() ||
                  d.deviceName.toLowerCase() === sDev.name.toLowerCase())
            );

            if (peer) {
              peer.syncthing.deviceId = sDev.id;
              peer.syncthing.running = sDev.connected;
              if (sDev.connected) {
                peer.online = true;
                peer.sync.bytesUploaded = Math.max(peer.sync.bytesUploaded, sDev.outBytesTotal || 0);
                peer.sync.bytesDownloaded = Math.max(peer.sync.bytesDownloaded, sDev.inBytesTotal || 0);
              }
            }
          }
        }
      } catch {}
    }

    this.saveDevices(devices);
    return devices;
  }

  async getAllDevices(): Promise<Device[]> {
    return this.loadDevices();
  }

  async getDeviceById(id: string): Promise<Device | null> {
    const devices = this.loadDevices();
    return devices.find((d) => d.deviceId === id || d.hostname.toLowerCase() === id.toLowerCase()) || null;
  }

  async addDevice(data: Partial<Device>): Promise<Device> {
    const devices = this.loadDevices();
    const newId = data.deviceId || `dev-${crypto.randomUUID().slice(0, 8)}`;
    const hostname = data.hostname || `DEVICE-${devices.length + 1}`;
    const deviceName = data.deviceName || hostname;

    const newDevice: Device = {
      deviceId: newId,
      deviceName,
      hostname,
      os: data.os || 'windows',
      architecture: data.architecture || 'x64',
      appVersion: data.appVersion || '0.1.0',
      agentVersion: data.agentVersion || '0.1.0',
      online: data.online ?? true,
      lastSeen: new Date().toISOString(),
      tailscale: {
        installed: true,
        connected: data.tailscale?.connected ?? true,
        ip: data.tailscale?.ip || `100.84.12.${20 + devices.length}`,
        connectionType: data.tailscale?.connectionType || 'direct',
        peersCount: devices.length,
      },
      syncthing: {
        installed: true,
        running: data.syncthing?.running ?? true,
        deviceId: data.syncthing?.deviceId || `SYNCTH-${hostname.slice(0, 4).toUpperCase()}-NODE-${Date.now().toString().slice(-4)}`,
        version: 'v1.27.12',
        foldersCount: 1,
      },
      hermes: {
        installed: data.hermes?.installed ?? true,
        running: data.hermes?.running ?? true,
        version: data.hermes?.version || '0.21.5',
        home: data.hermes?.home || (data.os === 'linux' ? `/home/${hostname.toLowerCase()}/.hermes` : `C:\\Users\\User\\AppData\\Local\\hermes`),
        profile: data.hermes?.profile || 'default',
      },
      data: {
        sessions: data.data?.sessions || 24,
        memories: data.data?.memories || 8,
        skills: data.data?.skills || 6,
        totalSizeBytes: data.data?.totalSizeBytes || 48 * 1024 * 1024,
      },
      sync: {
        lastSync: new Date().toISOString(),
        pendingFiles: 0,
        filesTransferred: 48,
        bytesUploaded: 48 * 1024 * 1024,
        bytesDownloaded: 48 * 1024 * 1024,
        conflicts: 0,
        status: 'in-sync',
      },
      lastBackup: new Date().toISOString(),
      healthStatus: 'healthy',
      ...data,
    };

    devices.push(newDevice);
    this.saveDevices(devices);
    return newDevice;
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
    const devices = this.loadDevices();
    const index = devices.findIndex((d) => d.deviceId === id);
    if (index === -1) {
      throw new Error(`Device with id ${id} not found in registry`);
    }

    const updated = {
      ...devices[index],
      ...updates,
      tailscale: { ...devices[index].tailscale, ...updates.tailscale },
      syncthing: { ...devices[index].syncthing, ...updates.syncthing },
      hermes: { ...devices[index].hermes, ...updates.hermes },
      data: { ...devices[index].data, ...updates.data },
      sync: { ...devices[index].sync, ...updates.sync },
    };

    devices[index] = updated;
    this.saveDevices(devices);
    return updated;
  }

  async removeDevice(id: string): Promise<boolean> {
    const devices = this.loadDevices();
    const localDev = devices[0];
    if (localDev.deviceId === id) {
      throw new Error('Cannot remove local machine from device registry');
    }

    const filtered = devices.filter((d) => d.deviceId !== id);
    if (filtered.length === devices.length) {
      return false;
    }

    this.saveDevices(filtered);
    return true;
  }

  /**
   * Compares two devices side-by-side
   */
  async compareDevices(idA: string, idB: string): Promise<DeviceComparison> {
    const devA = await this.getDeviceById(idA);
    const devB = await this.getDeviceById(idB);

    if (!devA || !devB) {
      throw new Error(`One or both devices not found: ${idA}, ${idB}`);
    }

    const versionMatch = devA.hermes.version === devB.hermes.version;
    const sessDelta = devA.data.sessions - devB.data.sessions;
    const memDelta = devA.data.memories - devB.data.memories;
    const skillDelta = devA.data.skills - devB.data.skills;
    const bytesDelta = devA.data.totalSizeBytes - devB.data.totalSizeBytes;

    let syncStatus: DeviceComparison['syncStatus'] = 'identical';
    if (sessDelta === 0 && memDelta === 0 && skillDelta === 0) {
      syncStatus = 'identical';
    } else if (sessDelta >= 0 && memDelta >= 0 && skillDelta >= 0) {
      syncStatus = 'ahead';
    } else if (sessDelta <= 0 && memDelta <= 0 && skillDelta <= 0) {
      syncStatus = 'behind';
    } else {
      syncStatus = 'diverged';
    }

    return {
      deviceA: devA,
      deviceB: devB,
      versionMatch,
      sessionsDiff: {
        deviceACount: devA.data.sessions,
        deviceBCount: devB.data.sessions,
        delta: sessDelta,
      },
      memoriesDiff: {
        deviceACount: devA.data.memories,
        deviceBCount: devB.data.memories,
        delta: memDelta,
      },
      skillsDiff: {
        deviceACount: devA.data.skills,
        deviceBCount: devB.data.skills,
        delta: skillDelta,
      },
      dataSizeDiff: {
        deviceABytes: devA.data.totalSizeBytes,
        deviceBBytes: devB.data.totalSizeBytes,
        deltaBytes: bytesDelta,
      },
      syncStatus,
    };
  }
}
