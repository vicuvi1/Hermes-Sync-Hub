import { AgentHealthResponse, SystemHardwareInfo } from '@hermes-hub/protocol';
import {
  Device,
  DeviceComparison,
  TailscaleState,
  SyncthingState,
  SyncthingDevice,
  SyncthingFolder,
  SyncthingConnectionState,
  SyncthingTransferState,
} from '@hermes-hub/types';
import { DEFAULT_AGENT_PORT } from '../health/AgentServer.js';

export class AgentClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs = 2500) {
    this.baseUrl = baseUrl || `http://127.0.0.1:${DEFAULT_AGENT_PORT}`;
    this.timeoutMs = timeoutMs;
  }

  private async fetchWithTimeout(path: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async isAgentRunning(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout('/health');
      return res.ok;
    } catch {
      return false;
    }
  }

  async checkHealth(): Promise<AgentHealthResponse> {
    const res = await this.fetchWithTimeout('/health');
    if (!res.ok) {
      throw new Error(`Agent health check failed with status ${res.status}`);
    }
    return res.json();
  }

  async getLocalDevice(): Promise<Device> {
    const res = await this.fetchWithTimeout('/device');
    if (!res.ok) {
      throw new Error(`Failed to fetch local device info: ${res.status}`);
    }
    return res.json();
  }

  async getDevices(): Promise<Device[]> {
    const res = await this.fetchWithTimeout('/devices');
    if (!res.ok) {
      throw new Error(`Failed to fetch devices: ${res.status}`);
    }
    return res.json();
  }

  async addDevice(deviceData: Partial<Device>): Promise<Device> {
    const res = await this.fetchWithTimeout('/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceData),
    });
    if (!res.ok) {
      throw new Error(`Failed to add device: ${res.status}`);
    }
    return res.json();
  }

  async removeDevice(deviceId: string): Promise<boolean> {
    const res = await this.fetchWithTimeout(`/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`Failed to remove device: ${res.status}`);
    }
    const data = await res.json();
    return !!data.success;
  }

  async compareDevices(deviceAId: string, deviceBId: string): Promise<DeviceComparison> {
    const res = await this.fetchWithTimeout(
      `/devices/compare?a=${encodeURIComponent(deviceAId)}&b=${encodeURIComponent(deviceBId)}`
    );
    if (!res.ok) {
      throw new Error(`Failed to compare devices: ${res.status}`);
    }
    return res.json();
  }

  async getHardwareInfo(): Promise<SystemHardwareInfo> {
    const res = await this.fetchWithTimeout('/hardware');
    if (!res.ok) {
      throw new Error(`Failed to fetch hardware info: ${res.status}`);
    }
    return res.json();
  }

  async ping(): Promise<{ pong: boolean; time: string }> {
    const res = await this.fetchWithTimeout('/ping', { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Agent ping failed with status ${res.status}`);
    }
    return res.json();
  }

  async getHermesStatus(): Promise<any> {
    const res = await this.fetchWithTimeout('/hermes');
    if (!res.ok) {
      throw new Error(`Failed to fetch Hermes status: ${res.status}`);
    }
    return res.json();
  }

  async getTailscaleState(): Promise<any> {
    const res = await this.fetchWithTimeout('/tailscale');
    if (!res.ok) {
      throw new Error(`Failed to fetch Tailscale state: ${res.status}`);
    }
    return res.json();
  }

  async pingTailscalePeer(ipOrHost: string): Promise<any> {
    const res = await this.fetchWithTimeout('/tailscale/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipOrHost }),
    });
    if (!res.ok) {
      throw new Error(`Failed to ping Tailscale peer: ${res.status}`);
    }
    return res.json();
  }

  async getSyncthingState(): Promise<SyncthingState> {
    const res = await this.fetchWithTimeout('/syncthing');
    if (!res.ok) {
      throw new Error(`Failed to fetch Syncthing state: ${res.status}`);
    }
    return res.json();
  }

  async getSyncthingDevices(): Promise<SyncthingDevice[]> {
    const res = await this.fetchWithTimeout('/syncthing/devices');
    if (!res.ok) {
      throw new Error(`Failed to fetch Syncthing devices: ${res.status}`);
    }
    return res.json();
  }

  async getSyncthingFolders(): Promise<SyncthingFolder[]> {
    const res = await this.fetchWithTimeout('/syncthing/folders');
    if (!res.ok) {
      throw new Error(`Failed to fetch Syncthing folders: ${res.status}`);
    }
    return res.json();
  }

  async getSyncthingConnections(): Promise<SyncthingConnectionState> {
    const res = await this.fetchWithTimeout('/syncthing/connections');
    if (!res.ok) {
      throw new Error(`Failed to fetch Syncthing connections: ${res.status}`);
    }
    return res.json();
  }

  async getSyncthingTransfer(): Promise<SyncthingTransferState> {
    const res = await this.fetchWithTimeout('/syncthing/transfer');
    if (!res.ok) {
      throw new Error(`Failed to fetch Syncthing transfer state: ${res.status}`);
    }
    return res.json();
  }
}
