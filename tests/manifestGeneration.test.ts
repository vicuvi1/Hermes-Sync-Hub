import { describe, it, expect } from 'vitest';
import { Device, HermesFile } from '@hermes-hub/types';
import { simpleSha256 } from '../packages/shared/src/hashing';

export function createDeviceManifest(device: Device) {
  return {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    online: device.online,
    hermes: {
      installed: device.hermes.installed,
      running: device.hermes.running,
      version: device.hermes.version,
      home: device.hermes.home,
      profile: device.hermes.profile,
    },
    data: {
      sessions: device.data.sessions,
      memories: device.data.memories,
      skills: device.data.skills,
    },
    sync: {
      lastSync: device.sync.lastSync,
      pendingFiles: device.sync.pendingFiles,
      conflicts: device.sync.conflicts,
    },
    lastSeen: device.lastSeen,
  };
}

export function createFileManifest(file: HermesFile) {
  return {
    id: file.id,
    path: file.path,
    sha256: file.sha256 || simpleSha256(file.name),
    size: file.size,
    modifiedAt: file.modifiedAt,
    originDevice: file.originDevice,
    revision: file.revision,
  };
}

describe('Manifest Generation', () => {
  it('should generate valid device manifest matching the architecture specification', () => {
    const mockDev: Device = {
      deviceId: 'dev-desktop-001',
      deviceName: 'Victor Desktop',
      hostname: 'VICTOR-WORKSTATION',
      os: 'windows',
      architecture: 'x64',
      appVersion: '0.1.0',
      agentVersion: '0.1.0',
      online: true,
      lastSeen: '2026-09-26T00:00:00.000Z',
      tailscale: { installed: true, connected: true, ip: '100.84.12.19' },
      syncthing: { installed: true, running: true, deviceId: 'SYNCTH-1' },
      hermes: {
        installed: true,
        running: true,
        version: '1.4.2',
        home: 'C:\\Users\\victo\\AppData\\Local\\hermes',
        profile: 'default',
      },
      data: { sessions: 243, memories: 52, skills: 18, totalSizeBytes: 1024000 },
      sync: {
        lastSync: '2026-09-26T00:00:00.000Z',
        pendingFiles: 0,
        filesTransferred: 142,
        bytesUploaded: 500,
        bytesDownloaded: 500,
        conflicts: 0,
        status: 'in-sync',
      },
      lastBackup: '2026-09-25T00:00:00.000Z',
      healthStatus: 'healthy',
    };

    const manifest = createDeviceManifest(mockDev);
    expect(manifest.deviceId).toBe('dev-desktop-001');
    expect(manifest.deviceName).toBe('Victor Desktop');
    expect(manifest.online).toBe(true);
    expect(manifest.hermes.running).toBe(true);
    expect(manifest.data.sessions).toBe(243);
    expect(manifest.data.memories).toBe(52);
    expect(manifest.data.skills).toBe(18);
  });

  it('should generate file manifest with sha256 checksum and revision number', () => {
    const mockFile: HermesFile = {
      id: 'f-001',
      name: 'MEMORY.md',
      category: 'Memories',
      path: 'memories/MEMORY.md',
      size: 82000,
      modifiedAt: '2026-09-26T00:00:00.000Z',
      sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      originDevice: 'dev-desktop-001',
      originDeviceName: 'Desktop-PC',
      revision: 142,
      syncStatus: 'synced',
    };

    const manifest = createFileManifest(mockFile);
    expect(manifest.path).toBe('memories/MEMORY.md');
    expect(manifest.revision).toBe(142);
    expect(manifest.sha256).toBeDefined();
    expect(manifest.size).toBe(82000);
  });
});
