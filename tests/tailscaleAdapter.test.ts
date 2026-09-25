import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  TailscaleAdapter,
  MockTailscaleAdapter,
  DeviceIdentityService,
  HealthMonitorService,
  HermesService,
  AgentServer,
  AgentClient,
} from '../apps/agent/src/index';

describe('Tailscale Adapter & Mesh State Inspection', () => {
  it('should instantiate TailscaleAdapter and report installation status gracefully', async () => {
    const adapter = new TailscaleAdapter();
    const installed = await adapter.isInstalled();
    expect(typeof installed).toBe('boolean');

    const state = await adapter.getState();
    expect(state).toBeDefined();
    expect(typeof state.connected).toBe('boolean');
    expect(Array.isArray(state.peers)).toBe(true);
  });

  it('should parse real tailscale status --json machine output accurately', () => {
    const mockJson = JSON.stringify({
      Version: '1.74.0-t128e469b2-gc4a2b9789',
      BackendState: 'Running',
      CurrentTailnet: {
        Name: 'victor.mesh.tailnet.ts.net',
      },
      MagicDNSSuffix: 'mesh.ts.net',
      Self: {
        ID: 1048576,
        HostName: 'victor-desktop',
        DNSName: 'victor-desktop.mesh.ts.net.',
        TailscaleIPs: ['100.84.12.19', 'fd7a:115c:a1e0::13'],
        Online: true,
      },
      Peer: {
        'node-peer-01': {
          ID: 1048577,
          HostName: 'victor-zenbook',
          DNSName: 'victor-zenbook.mesh.ts.net.',
          OS: 'windows',
          TailscaleIPs: ['100.84.12.20'],
          Online: true,
          Active: true,
          CurAddr: '192.168.1.45:41641',
          Relay: '',
          LastSeen: '2026-09-26T02:00:00Z',
        },
        'node-peer-02': {
          ID: 1048578,
          HostName: 'ubuntu-thinkpad',
          DNSName: 'ubuntu-thinkpad.mesh.ts.net.',
          OS: 'linux',
          TailscaleIPs: ['100.84.12.35'],
          Online: true,
          Active: false,
          CurAddr: '',
          Relay: 'derp-3',
          LastSeen: '2026-09-26T01:30:00Z',
        },
        'node-peer-03': {
          ID: 1048579,
          HostName: 'macbook-air',
          DNSName: 'macbook-air.mesh.ts.net.',
          OS: 'macos',
          TailscaleIPs: ['100.84.12.44'],
          Online: false,
          Active: false,
          LastSeen: '2026-09-20T10:00:00Z',
        },
      },
    });

    const adapter = new TailscaleAdapter();
    const parsed = adapter.parseTailscaleJson(mockJson);

    expect(parsed.installed).toBe(true);
    expect(parsed.connected).toBe(true);
    expect(parsed.backendState).toBe('Running');
    expect(parsed.version).toBe('1.74.0-t128e469b2-gc4a2b9789');
    expect(parsed.tailnetName).toBe('victor.mesh.tailnet.ts.net');
    expect(parsed.magicDnsSuffix).toBe('mesh.ts.net');

    // Verify self node
    expect(parsed.self).toBeDefined();
    expect(parsed.self?.hostname).toBe('victor-desktop');
    expect(parsed.self?.ipv4).toBe('100.84.12.19');
    expect(parsed.self?.ipv6).toBe('fd7a:115c:a1e0::13');
    expect(parsed.self?.online).toBe(true);

    // Verify peer counts and connection types
    expect(parsed.peers.length).toBe(3);
    expect(parsed.directPeersCount).toBe(1);
    expect(parsed.relayedPeersCount).toBe(1);

    const directPeer = parsed.peers.find((p) => p.hostname === 'victor-zenbook');
    expect(directPeer).toBeDefined();
    expect(directPeer?.connectionType).toBe('direct');
    expect(directPeer?.online).toBe(true);
    expect(directPeer?.curAddr).toBe('192.168.1.45:41641');

    const relayedPeer = parsed.peers.find((p) => p.hostname === 'ubuntu-thinkpad');
    expect(relayedPeer).toBeDefined();
    expect(relayedPeer?.connectionType).toBe('derp-relay');
    expect(relayedPeer?.relay).toBe('derp-3');

    const offlinePeer = parsed.peers.find((p) => p.hostname === 'macbook-air');
    expect(offlinePeer).toBeDefined();
    expect(offlinePeer?.connectionType).toBe('offline');
    expect(offlinePeer?.online).toBe(false);
  });

  it('should handle corrupt or invalid JSON gracefully without throwing', () => {
    const adapter = new TailscaleAdapter();
    const parsed = adapter.parseTailscaleJson('Not valid JSON');

    expect(parsed.installed).toBe(true);
    expect(parsed.connected).toBe(false);
    expect(parsed.backendState).toBe('Stopped');
    expect(parsed.peers).toEqual([]);
    expect(parsed.directPeersCount).toBe(0);
    expect(parsed.relayedPeersCount).toBe(0);
  });

  it('should verify MockTailscaleAdapter provides complete mesh topology and pings', async () => {
    const mockAdapter = new MockTailscaleAdapter();
    expect(await mockAdapter.isInstalled()).toBe(true);

    const state = await mockAdapter.getState();
    expect(state.connected).toBe(true);
    expect(state.self?.ipv4).toBe('100.84.12.19');
    expect(state.peers.length).toBe(2);
    expect(state.directPeersCount).toBe(1);

    const ping = await mockAdapter.pingPeer('100.84.12.20');
    expect(ping.success).toBe(true);
    expect(ping.latencyMs).toBe(14);
    expect(ping.via).toBe('direct');
  });
});

describe('Tailscale Agent Server & Client Endpoints', () => {
  let tempDir: string;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-ts-${Date.now()}`);
    const identityService = new DeviceIdentityService(tempDir);
    const healthMonitor = new HealthMonitorService(identityService);
    const hermesService = new HermesService();
    const mockTailscale = new MockTailscaleAdapter();

    server = new AgentServer(identityService, healthMonitor, hermesService, mockTailscale);
    port = await server.start(0);
    client = new AgentClient(`http://127.0.0.1:${port}`);
  });

  afterAll(async () => {
    await server.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should return Tailscale state over /tailscale GET endpoint', async () => {
    const tsState = await client.getTailscaleState();
    expect(tsState).toBeDefined();
    expect(tsState.connected).toBe(true);
    expect(tsState.self?.hostname).toBe('VICTOR-WORKSTATION');
    expect(tsState.peers.length).toBeGreaterThan(0);
    expect(tsState.directPeersCount).toBe(1);
  });

  it('should ping peer successfully over /tailscale/ping POST endpoint', async () => {
    const pingRes = await client.pingTailscalePeer('100.84.12.20');
    expect(pingRes).toBeDefined();
    expect(pingRes.success).toBe(true);
    expect(pingRes.latencyMs).toBeGreaterThan(0);
    expect(pingRes.via).toBe('direct');
  });
});
