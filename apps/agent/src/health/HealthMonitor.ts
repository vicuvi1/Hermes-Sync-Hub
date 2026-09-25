import os from 'node:os';
import { HealthStatusType } from '@hermes-hub/types';
import { AgentHealthResponse } from '@hermes-hub/protocol';
import { DeviceIdentityService } from '../devices/DeviceService.js';

export class HealthMonitorService {
  private identityService: DeviceIdentityService;
  private startTime: number;

  constructor(identityService?: DeviceIdentityService) {
    this.identityService = identityService || new DeviceIdentityService();
    this.startTime = Date.now();
  }

  /**
   * Evaluates current system health state
   */
  async checkHealth(): Promise<HealthStatusType> {
    const freeMemRatio = os.freemem() / os.totalmem();
    if (freeMemRatio < 0.05) {
      return 'degraded';
    }
    if (freeMemRatio < 0.15) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Generates comprehensive health diagnostic snapshot
   */
  async getHealthSnapshot(): Promise<AgentHealthResponse> {
    const status = await this.checkHealth();
    const identity = this.identityService.getOrCreateIdentity();
    const hardware = this.identityService.getSystemHardwareInfo();
    const mem = process.memoryUsage();

    return {
      status,
      uptimeSeconds: Math.floor(process.uptime()),
      version: identity.version || '0.1.0',
      deviceId: identity.deviceId,
      hostname: hardware.hostname,
      os: hardware.os,
      pid: process.pid,
      timestamp: new Date().toISOString(),
      memoryUsageMb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      },
    };
  }
}
