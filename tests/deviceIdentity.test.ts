import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';

describe('Device Identity & Persistence Service', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate and persist a new unique device identity with valid UUID', () => {
    const service = new DeviceIdentityService(tempDir);
    const identity = service.getOrCreateIdentity();

    expect(identity.deviceId).toBeDefined();
    // UUID v4 format regex
    expect(identity.deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(identity.deviceName).toBeDefined();
    expect(identity.createdAt).toBeDefined();

    // Verify file written to disk
    const filePath = service.getIdentityFilePath();
    expect(fs.existsSync(filePath)).toBe(true);

    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(fileContent.deviceId).toBe(identity.deviceId);
  });

  it('should preserve and reload the exact same deviceId on subsequent calls', () => {
    const service1 = new DeviceIdentityService(tempDir);
    const identity1 = service1.getOrCreateIdentity();

    // Create a new instance pointing to same directory
    const service2 = new DeviceIdentityService(tempDir);
    const identity2 = service2.getOrCreateIdentity();

    expect(identity2.deviceId).toBe(identity1.deviceId);
    expect(identity2.deviceName).toBe(identity1.deviceName);
    expect(identity2.createdAt).toBe(identity1.createdAt);
  });

  it('should detect local device operating system, architecture, and hostname', () => {
    const service = new DeviceIdentityService(tempDir);
    const hardware = service.getSystemHardwareInfo();

    expect(hardware.hostname).toBeDefined();
    expect(hardware.os).toMatch(/windows|macos|linux/);
    expect(hardware.architecture).toBeDefined();
    expect(hardware.cpuCores).toBeGreaterThan(0);
    expect(hardware.totalMemoryBytes).toBeGreaterThan(0);
    expect(hardware.freeMemoryBytes).toBeGreaterThan(0);
    expect(hardware.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should generate a complete local Device object with all metadata fields', () => {
    const service = new DeviceIdentityService(tempDir);
    const device = service.getLocalDevice();

    expect(device.deviceId).toBeDefined();
    expect(device.deviceName).toBeDefined();
    expect(device.hostname).toBeDefined();
    expect(device.os).toBeDefined();
    expect(device.online).toBe(true);
    expect(device.tailscale.installed).toBe(true);
    expect(device.syncthing.installed).toBe(true);
    // Hermes is optional on a clean CI machine, so detection must be a real
    // boolean rather than assuming the local development setup is present.
    expect(typeof device.hermes.installed).toBe('boolean');
    expect(device.healthStatus).toBe('healthy');
  });
});
