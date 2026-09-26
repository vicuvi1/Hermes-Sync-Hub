import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { DeviceRegistryService } from '../apps/agent/src/devices/DeviceRegistry';
import { PairingService } from '../apps/agent/src/pairing/PairingService';
import { ITailscaleAdapter } from '../apps/agent/src/tailscale/TailscaleAdapter';
import { ISyncthingAdapter } from '../apps/agent/src/sync/SyncthingAdapter';
import { HermesService } from '../apps/agent/src/hermes/HermesAdapter';
import { AgentServer } from '../apps/agent/src/health/AgentServer';
import { AgentClient } from '../apps/agent/src/client/AgentClient';
import { HealthMonitorService } from '../apps/agent/src/health/HealthMonitor';
import { TailscaleState, SyncthingState, Device } from '@hermes-hub/types';

describe('PairingService - Peer Pairing Workflow & Add Device Engine', () => {
  let tempDir: string;
  let identityService: DeviceIdentityService;
  let registry: DeviceRegistryService;
  let pairingService: PairingService;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-pair-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    identityService = new DeviceIdentityService(tempDir);
    registry = new DeviceRegistryService(identityService, tempDir);

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
          dnsName: 'self.ts.net',
          tailscaleIps: ['100.84.12.10'],
          ipv4: '100.84.12.10',
          online: true,
        },
        peers: [],
        directPeersCount: 0,
        relayedPeersCount: 0,
      }),
      pingPeer: async () => ({ success: true, latencyMs: 12, via: 'direct' }),
      formatLatency: (ms) => `${ms}ms`,
    };

    const mockSyncthing: ISyncthingAdapter = {
      isInstalled: async () => true,
      isRunning: async () => true,
      getState: async (): Promise<SyncthingState> => ({
        installed: true,
        running: true,
        version: 'v1.27.12',
        myID: 'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP',
        apiUrl: 'http://127.0.0.1:8384',
        devices: [],
        folders: [],
        transferState: {
          activeTransfers: [],
          totalBytesUploaded: 0,
          totalBytesDownloaded: 0,
          rateUploadBytesPerSec: 0,
          rateDownloadBytesPerSec: 0,
          hasConflicts: false,
          conflictFiles: [],
        },
      }),
      triggerRescan: async () => true,
      restart: async () => true,
    };

    pairingService = new PairingService(
      identityService,
      registry,
      mockTailscale,
      mockSyncthing
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate human-friendly pairing code with base32 charset and no ambiguous characters', () => {
    for (let i = 0; i < 20; i++) {
      const code = pairingService.generatePairingCode();
      expect(code).toMatch(/^HERMES-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
      expect(code).not.toContain('0');
      expect(code).not.toContain('O');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
    }
  });

  it('should generate an invitation with issuer metadata, token, and encoded payload', async () => {
    const inv = await pairingService.generateInvitation(15);

    expect(inv.invitationId).toMatch(/^inv-/);
    expect(inv.code).toMatch(/^HERMES-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(inv.token).toBeDefined();
    expect(inv.token.length).toBeGreaterThanOrEqual(32);
    expect(inv.createdAt).toBeDefined();
    expect(inv.expiresAt).toBeDefined();

    // Check Issuer Node
    const local = identityService.getLocalDevice();
    expect(inv.issuer.deviceId).toBe(local.deviceId);
    expect(inv.issuer.hostname).toBe(local.hostname);
    expect(inv.issuer.tailscaleIp).toBe('100.84.12.10');
    expect(inv.issuer.syncthingId).toBe('SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP');
    expect(inv.issuer.agentPort).toBe(48199);

    // Verify Base64URL payload
    expect(inv.encodedPayload).toBeDefined();
    const decoded = JSON.parse(Buffer.from(inv.encodedPayload, 'base64url').toString('utf-8'));
    expect(decoded.code).toBe(inv.code);
    expect(decoded.issuer.hostname).toBe(local.hostname);

    // Check active
    const active = pairingService.getActiveInvitation();
    expect(active).not.toBeNull();
    expect(active?.invitationId).toBe(inv.invitationId);
  });

  it('should validate active pairing code or Base64URL encoded payload', async () => {
    const inv = await pairingService.generateInvitation(15);

    // Validate using human code
    const byCode = pairingService.validateCodeOrPayload(inv.code);
    expect(byCode.valid).toBe(true);
    expect(byCode.invitation?.code).toBe(inv.code);
    expect(byCode.invitation?.issuer.hostname).toBe(inv.issuer.hostname);

    // Validate using full Base64URL payload
    const byPayload = pairingService.validateCodeOrPayload(inv.encodedPayload);
    expect(byPayload.valid).toBe(true);
    expect(byPayload.invitation?.code).toBe(inv.code);

    // Validate arbitrary standard formatted code
    const byStandardFormat = pairingService.validateCodeOrPayload('HERMES-84Q2-KM7D');
    expect(byStandardFormat.valid).toBe(true);
    expect(byStandardFormat.invitation?.code).toBe('HERMES-84Q2-KM7D');

    // Reject empty
    const byEmpty = pairingService.validateCodeOrPayload('   ');
    expect(byEmpty.valid).toBe(false);

    // Reject invalid gibberish
    const byGibberish = pairingService.validateCodeOrPayload('INVALID-FORMAT');
    expect(byGibberish.valid).toBe(false);
  });

  it('should reject expired pairing invitation', async () => {
    // Generate invitation with negative TTL (already expired)
    const inv = await pairingService.generateInvitation(-1);

    // Should return null for active invitation
    const active = pairingService.getActiveInvitation();
    expect(active).toBeNull();

    // Payload validation should report expired
    const res = pairingService.validateCodeOrPayload(inv.encodedPayload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('expired');
  });

  it('should execute end-to-end pairing pipeline and enroll device in registry', async () => {
    const inv = await pairingService.generateInvitation(15);

    const result = await pairingService.executePairing({
      codeOrPayload: inv.encodedPayload,
      joinerDevice: {
        deviceName: 'Target Linux Node',
        data: {
          sessions: 55,
          memories: 20,
          skills: 12,
          totalSizeBytes: 120 * 1024 * 1024,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.pairedDevice).toBeDefined();
    expect(result.pairedDevice.deviceName).toBe('Target Linux Node');
    expect(result.pairedDevice.online).toBe(true);

    // Check all steps completed
    expect(result.steps.length).toBe(6);
    expect(result.steps.every((s) => s.status === 'completed')).toBe(true);

    // Verify enrolled in persistent DeviceRegistry
    const all = await registry.getAllDevices();
    expect(all.some((d) => d.deviceId === result.pairedDevice.deviceId)).toBe(true);
  });
});

describe('Agent Server & Client Pairing REST Endpoints', () => {
  let tempDir: string;
  let identityService: DeviceIdentityService;
  let registry: DeviceRegistryService;
  let pairingService: PairingService;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-srv-pair-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    identityService = new DeviceIdentityService(tempDir);
    registry = new DeviceRegistryService(identityService, tempDir);
    const healthMonitor = new HealthMonitorService(identityService);

    pairingService = new PairingService(
      identityService,
      registry
    );

    server = new AgentServer(
      identityService,
      healthMonitor,
      undefined,
      undefined,
      undefined,
      registry,
      pairingService
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

  it('should generate pairing invitation over /pairing/invitation POST', async () => {
    const inv = await client.generatePairingInvitation();

    expect(inv.code).toMatch(/^HERMES-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(inv.invitationId).toBeDefined();
    expect(inv.encodedPayload).toBeDefined();
    expect(inv.issuer).toBeDefined();
  });

  it('should retrieve active pairing invitation over /pairing/invitation/active GET', async () => {
    const active = await client.getActivePairingInvitation();

    expect(active).not.toBeNull();
    expect(active?.code).toMatch(/^HERMES-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  });

  it('should validate pairing code over /pairing/validate POST', async () => {
    const active = await client.getActivePairingInvitation();
    expect(active).not.toBeNull();

    const result = await client.validatePairingCode(active!.code);
    expect(result.valid).toBe(true);
    expect(result.invitation?.code).toBe(active!.code);

    const invalid = await client.validatePairingCode('NOT-A-VALID-CODE');
    expect(invalid.valid).toBe(false);
  });

  it('should execute full pairing flow over /pairing/execute POST', async () => {
    const active = await client.getActivePairingInvitation();

    const res = await client.executePairing({
      codeOrPayload: active!.code,
      joinerDevice: {
        deviceName: 'Client Paired Node',
      },
    });

    expect(res.success).toBe(true);
    expect(res.pairedDevice.deviceName).toBe('Client Paired Node');
    expect(res.steps.length).toBe(6);

    // Verify added to cluster devices
    const devices = await client.getDevices();
    expect(devices.some((d) => d.deviceId === res.pairedDevice.deviceId)).toBe(true);
  });
});
