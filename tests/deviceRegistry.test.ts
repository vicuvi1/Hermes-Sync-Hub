import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { DeviceRegistryService } from '../apps/agent/src/devices/DeviceRegistry';
import { ITailscaleAdapter } from '../apps/agent/src/tailscale/TailscaleAdapter';
import { ISyncthingAdapter } from '../apps/agent/src/sync/SyncthingAdapter';
import { AgentServer } from '../apps/agent/src/health/AgentServer';
import { AgentClient } from '../apps/agent/src/client/AgentClient';
import { HealthMonitorService } from '../apps/agent/src/health/HealthMonitor';
import { TailscaleState, SyncthingState, Device } from '@hermes-hub/types';

describe('DeviceRegistryService & Multi-Device Management', () => {
  let tempDir: string;
  let identityService: DeviceIdentityService;
  let registry: DeviceRegistryService;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    identityService = new DeviceIdentityService(tempDir);
    registry = new DeviceRegistryService(identityService, tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should initialize default cluster peer devices and write devices.json', async () => {
    const devices = await registry.getAllDevices();

    expect(devices.length).toBeGreaterThanOrEqual(4);
    // Local device is index 0
    const localDev = identityService.getLocalDevice();
    expect(devices[0].deviceId).toBe(localDev.deviceId);
    expect(devices[0].hostname).toBe(localDev.hostname);

    // Verify peers exist
    expect(devices.some((d) => d.hostname === 'VICTOR-ZENBOOK')).toBe(true);
    expect(devices.some((d) => d.hostname === 'UBUNTU-LAPTOP-THINKPAD')).toBe(true);
    expect(devices.some((d) => d.hostname === 'MACBOOK-PRO-M3')).toBe(true);

    // Verify file written to disk
    const filePath = path.join(tempDir, 'devices.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(parsed.length).toBe(devices.length);
  });

  it('should retrieve a device by ID or hostname', async () => {
    const zenbook = await registry.getDeviceById('dev-zenbook-02');
    expect(zenbook).not.toBeNull();
    expect(zenbook?.hostname).toBe('VICTOR-ZENBOOK');

    const byHost = await registry.getDeviceById('VICTOR-ZENBOOK');
    expect(byHost?.deviceId).toBe('dev-zenbook-02');

    const notFound = await registry.getDeviceById('non-existent-device');
    expect(notFound).toBeNull();
  });

  it('should add a new device and persist it', async () => {
    const newDevice = await registry.addDevice({
      deviceName: 'Office Server',
      hostname: 'OFFICE-SERVER-01',
      os: 'linux',
      online: true,
      tailscale: {
        installed: true,
        connected: true,
        ip: '100.84.12.99',
        connectionType: 'direct',
      },
      hermes: {
        installed: true,
        running: true,
        version: '0.21.5',
        home: '/home/hermes/.hermes',
        profile: 'server',
      },
      data: {
        sessions: 300,
        memories: 80,
        skills: 25,
        totalSizeBytes: 500 * 1024 * 1024,
      },
    });

    expect(newDevice.deviceId).toBeDefined();
    expect(newDevice.deviceName).toBe('Office Server');

    const all = await registry.getAllDevices();
    expect(all.some((d) => d.deviceId === newDevice.deviceId)).toBe(true);

    // Check disk
    const onDisk = JSON.parse(fs.readFileSync(path.join(tempDir, 'devices.json'), 'utf-8'));
    expect(onDisk.some((d: Device) => d.deviceId === newDevice.deviceId)).toBe(true);
  });

  it('should update an existing device properties and persist', async () => {
    const updated = await registry.updateDevice('dev-zenbook-02', {
      deviceName: 'Victor Zenbook Pro',
      hermes: {
        installed: true,
        running: true,
        version: '0.22.0',
        home: 'C:\\Users\\victor\\AppData\\Local\\hermes',
        profile: 'work',
      },
    });

    expect(updated.deviceName).toBe('Victor Zenbook Pro');
    expect(updated.hermes.version).toBe('0.22.0');

    const fetched = await registry.getDeviceById('dev-zenbook-02');
    expect(fetched?.deviceName).toBe('Victor Zenbook Pro');
    expect(fetched?.hermes.version).toBe('0.22.0');
  });

  it('should remove a peer device but prevent removing the local primary device', async () => {
    const localDev = identityService.getLocalDevice();

    // Trying to remove local machine throws
    await expect(registry.removeDevice(localDev.deviceId)).rejects.toThrow(
      'Cannot remove local machine from device registry'
    );

    // Removing a peer succeeds
    const removed = await registry.removeDevice('dev-thinkpad-03');
    expect(removed).toBe(true);

    const check = await registry.getDeviceById('dev-thinkpad-03');
    expect(check).toBeNull();

    // Removing non-existent returns false
    const removedNonExistent = await registry.removeDevice('dev-thinkpad-03');
    expect(removedNonExistent).toBe(false);
  });

  it('should compare two devices accurately and detect differences', async () => {
    const comparison = await registry.compareDevices('dev-zenbook-02', 'dev-thinkpad-03');

    expect(comparison.deviceA.deviceId).toBe('dev-zenbook-02');
    expect(comparison.deviceB.deviceId).toBe('dev-thinkpad-03');

    // Zenbook has 189 sessions, Thinkpad has 112 sessions
    expect(comparison.sessionsDiff.deviceACount).toBe(189);
    expect(comparison.sessionsDiff.deviceBCount).toBe(112);
    expect(comparison.sessionsDiff.delta).toBe(77);

    // Zenbook has 44 memories, Thinkpad has 28 memories
    expect(comparison.memoriesDiff.delta).toBe(16);

    // Zenbook v0.21.5 vs Thinkpad v0.21.4 -> versionMatch = false
    expect(comparison.versionMatch).toBe(false);

    // Ahead because all deltas >= 0
    expect(comparison.syncStatus).toBe('ahead');
  });

  it('should reconcile cluster devices with live Tailscale and Syncthing states', async () => {
    const mockTailscale: ITailscaleAdapter = {
      isInstalled: async () => true,
      getState: async (): Promise<TailscaleState> => ({
        installed: true,
        connected: true,
        backendState: 'Running',
        version: '1.60.0',
        self: {
          id: 'ts-self-01',
          hostname: identityService.getLocalDevice().hostname,
          dnsName: `${identityService.getLocalDevice().hostname.toLowerCase()}.tailnet.ts.net`,
          tailscaleIps: ['100.84.12.10'],
          ipv4: '100.84.12.10',
          online: true,
        },
        peers: [
          {
            id: 'ts-zenbook-peer',
            hostname: 'VICTOR-ZENBOOK',
            dnsName: 'victor-zenbook.tailnet.ts.net',
            tailscaleIps: ['100.84.12.20'],
            ipv4: '100.84.12.20',
            os: 'windows',
            online: true,
            connectionType: 'direct',
            lastSeen: new Date().toISOString(),
          },
          {
            id: 'ts-new-homelab',
            hostname: 'HOMELAB-SERVER',
            dnsName: 'homelab-server.tailnet.ts.net',
            tailscaleIps: ['100.84.12.75'],
            ipv4: '100.84.12.75',
            os: 'linux',
            online: true,
            connectionType: 'derp-relay',
            lastSeen: new Date().toISOString(),
          },
        ],
        directPeersCount: 1,
        relayedPeersCount: 1,
      }),
      pingPeer: async () => ({ success: true, latencyMs: 14, via: 'direct' }),
      formatLatency: (ms) => `${ms}ms`,
    };

    const mockSyncthing: ISyncthingAdapter = {
      isInstalled: async () => true,
      isRunning: async () => true,
      getState: async (): Promise<SyncthingState> => ({
        installed: true,
        running: true,
        version: 'v1.27.12',
        myID: 'SYNCTH-LOCAL-NODE-001',
        apiUrl: 'http://127.0.0.1:8384',
        devices: [
          {
            id: 'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP',
            name: 'VICTOR-ZENBOOK',
            addresses: ['tcp://100.84.12.20:22000'],
            connected: true,
            paused: false,
            inBytesTotal: 450 * 1024 * 1024,
            outBytesTotal: 320 * 1024 * 1024,
          },
        ],
        folders: [
          {
            id: 'hermes-core-sync',
            label: 'Hermes Core Data',
            path: 'C:\\Users\\victor\\AppData\\Local\\hermes',
            globalFiles: 120,
            globalBytes: 45000000,
            localFiles: 120,
            localBytes: 45000000,
            needFiles: 0,
            needBytes: 0,
            state: 'idle',
            paused: false,
            sharedWithDevices: ['SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP'],
          },
        ],
        transferState: {
          activeTransfers: [],
          totalBytesUploaded: 320 * 1024 * 1024,
          totalBytesDownloaded: 450 * 1024 * 1024,
          rateUploadBytesPerSec: 0,
          rateDownloadBytesPerSec: 0,
          hasConflicts: false,
          conflictFiles: [],
        },
      }),
      triggerRescan: async () => true,
      restart: async () => true,
    };

    const reconciled = await registry.reconcile(mockTailscale, mockSyncthing);

    // Local device has local IP from Tailscale self
    expect(reconciled[0].tailscale.ip).toBe('100.84.12.10');
    expect(reconciled[0].syncthing.deviceId).toBe('SYNCTH-LOCAL-NODE-001');

    // Zenbook peer updated from syncthing
    const zenbook = reconciled.find((d) => d.hostname === 'VICTOR-ZENBOOK');
    expect(zenbook?.online).toBe(true);
    expect(zenbook?.tailscale.connectionType).toBe('direct');
    expect(zenbook?.sync.bytesUploaded).toBe(320 * 1024 * 1024);

    // Discovered new Tailscale peer HOMELAB-SERVER
    const homelab = reconciled.find((d) => d.hostname === 'HOMELAB-SERVER');
    expect(homelab).toBeDefined();
    expect(homelab?.tailscale.ip).toBe('100.84.12.75');
    expect(homelab?.tailscale.connectionType).toBe('derp-relay');
  });
});

describe('Agent Server & Client Multi-Device REST APIs', () => {
  let tempDir: string;
  let identityService: DeviceIdentityService;
  let registry: DeviceRegistryService;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-srv-devs-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    identityService = new DeviceIdentityService(tempDir);
    registry = new DeviceRegistryService(identityService, tempDir);
    const healthMonitor = new HealthMonitorService(identityService);

    server = new AgentServer(
      identityService,
      healthMonitor,
      undefined,
      undefined,
      undefined,
      registry
    );
    port = await server.start(0);
    client = new AgentClient(`http://127.0.0.1:${port}`);
  });

  afterAll(async () => {
    await server.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should list all cluster devices over /devices GET', async () => {
    const devices = await client.getDevices();

    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThanOrEqual(4);
    expect(devices[0].deviceId).toBeDefined();
  });

  it('should create a new device over /devices POST', async () => {
    const created = await client.addDevice({
      deviceName: 'GPU Rig 4090',
      hostname: 'GPU-RIG-AI',
      os: 'linux',
      hermes: {
        installed: true,
        running: true,
        version: '0.21.5',
        home: '/home/ai/.hermes',
        profile: 'deep-train',
      },
    });

    expect(created.deviceId).toBeDefined();
    expect(created.deviceName).toBe('GPU Rig 4090');

    const devices = await client.getDevices();
    expect(devices.some((d) => d.deviceId === created.deviceId)).toBe(true);
  });

  it('should compare devices over /devices/compare GET', async () => {
    const comparison = await client.compareDevices('dev-zenbook-02', 'dev-thinkpad-03');

    expect(comparison.deviceA).toBeDefined();
    expect(comparison.deviceB).toBeDefined();
    expect(comparison.sessionsDiff).toBeDefined();
    expect(comparison.syncStatus).toBeDefined();
  });

  it('should remove a device over /devices/:id DELETE', async () => {
    const dev = await client.addDevice({
      deviceName: 'Temporary Laptop',
      hostname: 'TEMP-LAPTOP',
      os: 'windows',
    });

    const success = await client.removeDevice(dev.deviceId);
    expect(success).toBe(true);

    const devices = await client.getDevices();
    expect(devices.some((d) => d.deviceId === dev.deviceId)).toBe(false);
  });
});
