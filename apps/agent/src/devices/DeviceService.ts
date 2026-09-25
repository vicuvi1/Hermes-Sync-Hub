import os from 'node:os';
import { Device, OperatingSystem } from '@hermes-hub/types';

export class DeviceIdentityService {
  private cachedDevice: Device | null = null;

  getLocalDeviceInfo(): Partial<Device> {
    const platform = os.platform();
    const osType: OperatingSystem = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux';
    
    return {
      hostname: os.hostname(),
      os: osType,
      architecture: os.arch(),
      online: true,
      lastSeen: new Date().toISOString(),
    };
  }
}
