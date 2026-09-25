import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { HealthMonitorService } from '../apps/agent/src/health/HealthMonitor';
import { AgentServer } from '../apps/agent/src/health/AgentServer';
import { AgentClient } from '../apps/agent/src/client/AgentClient';

describe('Agent Server & Client Loopback Communication', () => {
  let tempDir: string;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-srv-${Date.now()}`);
    const identityService = new DeviceIdentityService(tempDir);
    const healthMonitor = new HealthMonitorService(identityService);

    server = new AgentServer(identityService, healthMonitor);
    // Port 0 allows OS to allocate an ephemeral free port
    port = await server.start(0);
    client = new AgentClient(`http://127.0.0.1:${port}`);
  });

  afterAll(async () => {
    await server.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should respond to /health endpoint with valid diagnostic snapshot', async () => {
    const health = await client.checkHealth();

    expect(['healthy', 'warning', 'degraded']).toContain(health.status);
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(health.deviceId).toBeDefined();
    expect(health.hostname).toBeDefined();
    expect(health.pid).toBe(process.pid);
    expect(health.memoryUsageMb.rss).toBeGreaterThan(0);
  });

  it('should return local device representation over /device endpoint', async () => {
    const device = await client.getLocalDevice();

    expect(device.deviceId).toBeDefined();
    expect(device.hostname).toBeDefined();
    expect(device.os).toBeDefined();
    expect(device.online).toBe(true);
  });

  it('should return system hardware info over /hardware endpoint', async () => {
    const hardware = await client.getHardwareInfo();

    expect(hardware.architecture).toBe(os.arch());
    expect(hardware.cpuCores).toBe(os.cpus().length);
    expect(hardware.totalMemoryBytes).toBeGreaterThan(0);
  });

  it('should return successful pong for /ping POST request', async () => {
    const res = await client.ping();

    expect(res.pong).toBe(true);
    expect(res.time).toBeDefined();
  });

  it('should verify agent is running via isAgentRunning()', async () => {
    const isRunning = await client.isAgentRunning();
    expect(isRunning).toBe(true);
  });
});
