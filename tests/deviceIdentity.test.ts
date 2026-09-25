import { describe, it, expect } from 'vitest';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';

describe('Device Identity Service', () => {
  it('should detect local device operating system and hostname', () => {
    const service = new DeviceIdentityService();
    const info = service.getLocalDeviceInfo();

    expect(info.hostname).toBeDefined();
    expect(info.os).toMatch(/windows|macos|linux/);
    expect(info.architecture).toBeDefined();
    expect(info.online).toBe(true);
    expect(info.lastSeen).toBeDefined();
  });
});
