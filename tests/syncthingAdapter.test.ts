import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  SyncthingAdapter,
  MockSyncthingAdapter,
  DeviceIdentityService,
  HealthMonitorService,
  HermesService,
  MockTailscaleAdapter,
  AgentServer,
  AgentClient,
} from '../apps/agent/src/index';

describe('Syncthing Adapter & XML Config Parsing', () => {
  it('should instantiate SyncthingAdapter and report installation status gracefully', async () => {
    const adapter = new SyncthingAdapter();
    const installed = await adapter.isInstalled();
    expect(typeof installed).toBe('boolean');

    const state = await adapter.getState();
    expect(state).toBeDefined();
    expect(typeof state.running).toBe('boolean');
    expect(Array.isArray(state.devices)).toBe(true);
    expect(Array.isArray(state.folders)).toBe(true);
  });

  it('should parse real Syncthing config.xml structure accurately', () => {
    const mockXml = `
      <configuration version="37">
        <folder id="hermes-hub-data" label="Hermes Hub Sync Workspace" path="C:\\Users\\victo\\HermesHubData" type="sendreceive" rescanIntervalS="3600">
          <filesystemType>basic</filesystemType>
          <device id="SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP" introducedBy=""></device>
          <device id="SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL" introducedBy=""></device>
          <minDiskFree unit="%">1</minDiskFree>
        </folder>
        <folder id="hermes-sessions" label="Hermes Sessions Export" path="C:\\Users\\victo\\HermesHubData\\sessions" type="sendreceive">
          <device id="SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP"></device>
        </folder>
        <device id="SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP" name="VICTOR-ZENBOOK" compression="metadata" introducer="false" skipIntroductionRemovals="false" introducedBy="">
          <address>tcp://100.84.12.20:22000</address>
        </device>
        <device id="SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL" name="UBUNTU-LAPTOP-THINKPAD" compression="metadata">
          <address>dynamic</address>
        </device>
        <gui enabled="true" tls="false" debugging="false" sendBasicAuthPrompt="false">
          <address>127.0.0.1:8384</address>
          <apikey>a1b2c3d4e5f678901234567890abcdef</apikey>
          <theme>default</theme>
        </gui>
      </configuration>
    `;

    const adapter = new SyncthingAdapter();
    const parsed = adapter.parseConfigXml(mockXml);

    expect(parsed.apiKey).toBe('a1b2c3d4e5f678901234567890abcdef');
    expect(parsed.guiAddress).toBe('127.0.0.1:8384');

    // Devices
    expect(parsed.devices.length).toBe(2);
    expect(parsed.devices[0].id).toBe('SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP');
    expect(parsed.devices[0].name).toBe('VICTOR-ZENBOOK');
    expect(parsed.devices[1].id).toBe('SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL');
    expect(parsed.devices[1].name).toBe('UBUNTU-LAPTOP-THINKPAD');

    // Folders
    expect(parsed.folders.length).toBe(2);
    const mainFolder = parsed.folders.find((f) => f.id === 'hermes-hub-data');
    expect(mainFolder).toBeDefined();
    expect(mainFolder?.label).toBe('Hermes Hub Sync Workspace');
    expect(mainFolder?.path).toBe('C:\\Users\\victo\\HermesHubData');
    expect(mainFolder?.type).toBe('sendreceive');
    expect(mainFolder?.devices).toContain('SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP');
    expect(mainFolder?.devices).toContain('SYNCTH-UBNT-THNK-9014-F92D-T5RA-38NE-K1PL');
  });

  it('should verify MockSyncthingAdapter provides full state, devices, folders, and connection data', async () => {
    const mock = new MockSyncthingAdapter();

    expect(await mock.isInstalled()).toBe(true);
    expect(await mock.isRunning()).toBe(true);

    const state = await mock.getState();
    expect(state.installed).toBe(true);
    expect(state.running).toBe(true);
    expect(state.myID).toBe('SYNCTH-VCTR-DSKT-8942-A83B-K4LM-91XQ-Z7WV');
    expect(state.devices.length).toBe(2);
    expect(state.folders.length).toBe(2);
    expect(state.connectionState.activeConnections).toBe(1);
    expect(state.connectionState.totalConnections).toBe(2);
    expect(state.transferState.completionPercentage).toBe(100);

    const devices = await mock.getDevices();
    expect(devices.length).toBe(2);
    expect(devices[0].connected).toBe(true);
    expect(devices[0].address).toBe('100.84.12.20:22000');

    const folders = await mock.getFolders();
    expect(folders.length).toBe(2);
    expect(folders[0].id).toBe('hermes-hub-data');
    expect(folders[0].globalFiles).toBe(1420);
  });
});

describe('Syncthing Agent Server & Client Endpoints', () => {
  let tempDir: string;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-st-${Date.now()}`);
    const identityService = new DeviceIdentityService(tempDir);
    const healthMonitor = new HealthMonitorService(identityService);
    const hermesService = new HermesService();
    const mockTailscale = new MockTailscaleAdapter();
    const mockSyncthing = new MockSyncthingAdapter();

    server = new AgentServer(
      identityService,
      healthMonitor,
      hermesService,
      mockTailscale,
      mockSyncthing
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

  it('should return complete Syncthing state over /syncthing GET endpoint', async () => {
    const syncState = await client.getSyncthingState();
    expect(syncState).toBeDefined();
    expect(syncState.installed).toBe(true);
    expect(syncState.running).toBe(true);
    expect(syncState.myID).toBe('SYNCTH-VCTR-DSKT-8942-A83B-K4LM-91XQ-Z7WV');
    expect(syncState.devices.length).toBe(2);
    expect(syncState.folders.length).toBe(2);
  });

  it('should return Syncthing devices over /syncthing/devices GET endpoint', async () => {
    const devices = await client.getSyncthingDevices();
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBe(2);
    expect(devices[0].name).toBe('VICTOR-ZENBOOK');
    expect(devices[0].connected).toBe(true);
  });

  it('should return Syncthing folders over /syncthing/folders GET endpoint', async () => {
    const folders = await client.getSyncthingFolders();
    expect(Array.isArray(folders)).toBe(true);
    expect(folders.length).toBe(2);
    expect(folders[0].id).toBe('hermes-hub-data');
    expect(folders[0].state).toBe('idle');
  });

  it('should return Syncthing connections over /syncthing/connections GET endpoint', async () => {
    const conns = await client.getSyncthingConnections();
    expect(conns).toBeDefined();
    expect(conns.activeConnections).toBe(1);
    expect(conns.totalConnections).toBe(2);
  });

  it('should return Syncthing transfer state over /syncthing/transfer GET endpoint', async () => {
    const transfer = await client.getSyncthingTransfer();
    expect(transfer).toBeDefined();
    expect(transfer.completionPercentage).toBe(100);
    expect(transfer.isSyncing).toBe(false);
  });
});
