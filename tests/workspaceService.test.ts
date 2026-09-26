import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { HermesService } from '../apps/agent/src/hermes/HermesAdapter';
import { WorkspaceService } from '../apps/agent/src/workspace/WorkspaceService';
import { AgentServer } from '../apps/agent/src/health/AgentServer';
import { AgentClient } from '../apps/agent/src/client/AgentClient';
import { HealthMonitorService } from '../apps/agent/src/health/HealthMonitor';
import { DeviceRegistryService } from '../apps/agent/src/devices/DeviceRegistry';

describe('WorkspaceService - Managed Workspace, Safe Manifests & Snapshots', () => {
  let tempDir: string;
  let workspaceRoot: string;
  let identityService: DeviceIdentityService;
  let hermesService: HermesService;
  let workspaceService: WorkspaceService;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    workspaceRoot = path.join(tempDir, 'HermesHubData');
    fs.mkdirSync(tempDir, { recursive: true });

    identityService = new DeviceIdentityService(tempDir);
    hermesService = new HermesService();
    workspaceService = new WorkspaceService(identityService, hermesService, workspaceRoot);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should initialize the managed workspace layout and starter seed files', async () => {
    const status = await workspaceService.initWorkspace();

    expect(status.isInitialized).toBe(true);
    expect(status.rootPath).toBe(workspaceRoot);

    // Verify all standardized layout subdirectories exist
    const layout = workspaceService.getLayout();
    expect(fs.existsSync(layout.manifests)).toBe(true);
    expect(fs.existsSync(layout.snapshots)).toBe(true);
    expect(fs.existsSync(layout.devices)).toBe(true);
    expect(fs.existsSync(layout.memories)).toBe(true);
    expect(fs.existsSync(layout.skills)).toBe(true);
    expect(fs.existsSync(layout.configs)).toBe(true);
    expect(fs.existsSync(layout.backups)).toBe(true);
    expect(fs.existsSync(layout.activity)).toBe(true);

    // Verify starter seeds
    expect(fs.existsSync(path.join(layout.memories, 'MEMORY.md'))).toBe(true);
    expect(fs.existsSync(path.join(layout.configs, 'config.template.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(layout.skills, 'hermes-core', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(layout.manifests, 'revisions.json'))).toBe(true);
    expect(fs.existsSync(path.join(layout.manifests, 'index.json'))).toBe(true);

    expect(status.totalFiles).toBeGreaterThanOrEqual(3);
    expect(status.activeManifestRevision).toBeGreaterThanOrEqual(1);
  });

  it('should compute deterministic SHA-256 hashes normalizing CRLF vs LF', () => {
    const fileA = path.join(tempDir, 'fileA.md');
    const fileB = path.join(tempDir, 'fileB.md');

    // Windows style line endings CRLF
    fs.writeFileSync(fileA, 'Title\r\nLine 1\r\nLine 2\r\n', 'utf-8');
    // Unix style line endings LF
    fs.writeFileSync(fileB, 'Title\nLine 1\nLine 2\n', 'utf-8');

    const hashA = workspaceService.calculateFileHash(fileA);
    const hashB = workspaceService.calculateFileHash(fileB);

    expect(hashA).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(hashA).toBe(hashB);
  });

  it('should generate a comprehensive cluster manifest with categories and file digests', async () => {
    await workspaceService.initWorkspace();

    // Add a custom memory and skill
    const layout = workspaceService.getLayout();
    fs.writeFileSync(path.join(layout.memories, 'PROJECT_NOTES.md'), '# Hermes Notes\n', 'utf-8');
    fs.writeFileSync(path.join(layout.configs, 'custom-agent.yaml'), 'profile: dev\n', 'utf-8');

    const manifest = await workspaceService.generateManifest();

    expect(manifest.manifestId).toBeDefined();
    expect(manifest.revision).toBeGreaterThanOrEqual(2);
    expect(manifest.files.length).toBeGreaterThanOrEqual(5);

    // Check category categorization
    const memoryItem = manifest.files.find((f) => f.relativePath === 'memories/PROJECT_NOTES.md');
    expect(memoryItem).toBeDefined();
    expect(memoryItem?.category).toBe('memory');
    expect(memoryItem?.sha256).toMatch(/^sha256-/);

    const configItem = manifest.files.find((f) => f.relativePath === 'configs/custom-agent.yaml');
    expect(configItem).toBeDefined();
    expect(configItem?.category).toBe('config');

    // Check device manifest written
    const localDev = identityService.getLocalDevice();
    const devManifestPath = path.join(layout.devices, `${localDev.deviceId}-manifest.json`);
    expect(fs.existsSync(devManifestPath)).toBe(true);
  });

  it('should verify workspace integrity and report tampered or missing files', async () => {
    await workspaceService.initWorkspace();
    const layout = workspaceService.getLayout();

    // Initial state should be completely valid
    const initialVerify = await workspaceService.verifyManifest();
    expect(initialVerify.valid).toBe(true);
    expect(initialVerify.tamperedFiles.length).toBe(0);
    expect(initialVerify.missingFiles.length).toBe(0);

    // Tamper with MEMORY.md content
    const memoryPath = path.join(layout.memories, 'MEMORY.md');
    fs.appendFileSync(memoryPath, '\nTampered unmanifested modification!\n', 'utf-8');

    const tamperedVerify = await workspaceService.verifyManifest();
    expect(tamperedVerify.valid).toBe(false);
    expect(tamperedVerify.tamperedFiles.length).toBe(1);
    expect(tamperedVerify.tamperedFiles[0].relativePath).toBe('memories/MEMORY.md');

    // Restore file and delete config.template.yaml
    await workspaceService.generateManifest();
    const configPath = path.join(layout.configs, 'config.template.yaml');
    fs.unlinkSync(configPath);

    const missingVerify = await workspaceService.verifyManifest();
    expect(missingVerify.valid).toBe(false);
    expect(missingVerify.missingFiles).toContain('configs/config.template.yaml');
  });

  it('should capture safe non-destructive state snapshots without modifying active databases', async () => {
    await workspaceService.initWorkspace();

    const snapshot = await workspaceService.createSafeSnapshot({
      name: 'Safe Pre-Sync Snapshot',
      notes: 'Testing anti-corruption snapshot procedure',
    });

    expect(snapshot.id).toMatch(/^snap-/);
    expect(snapshot.name).toBe('Safe Pre-Sync Snapshot');
    expect(snapshot.sha256).toMatch(/^sha256-/);
    expect(snapshot.sourceDatabases).toBeDefined();
    expect(fs.existsSync(snapshot.filePath)).toBe(true);

    // Verify snapshot manifest persistence
    const snapshots = await workspaceService.getSnapshots();
    expect(snapshots.some((s) => s.id === snapshot.id)).toBe(true);

    const retrieved = await workspaceService.getSnapshotById(snapshot.id);
    expect(retrieved?.id).toBe(snapshot.id);

    // Workspace manifest should now track the snapshot
    const manifest = await workspaceService.getManifest();
    expect(manifest.files.some((f) => f.category === 'snapshot')).toBe(true);
  });
});

describe('Agent Server & Client Workspace REST APIs', () => {
  let tempDir: string;
  let workspaceRoot: string;
  let identityService: DeviceIdentityService;
  let workspaceService: WorkspaceService;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `hermes-hub-srv-ws-${Date.now()}`);
    workspaceRoot = path.join(tempDir, 'HermesHubData');
    fs.mkdirSync(tempDir, { recursive: true });

    identityService = new DeviceIdentityService(tempDir);
    const registry = new DeviceRegistryService(identityService, tempDir);
    const healthMonitor = new HealthMonitorService(identityService);
    const hermesService = new HermesService();
    workspaceService = new WorkspaceService(identityService, hermesService, workspaceRoot);

    server = new AgentServer(
      identityService,
      healthMonitor,
      hermesService,
      undefined,
      undefined,
      registry,
      undefined,
      workspaceService
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

  it('should initialize workspace over /workspace/init POST', async () => {
    const status = await client.initWorkspace();

    expect(status.isInitialized).toBe(true);
    expect(status.layout).toBeDefined();
    expect(status.totalFiles).toBeGreaterThanOrEqual(3);
  });

  it('should get workspace status over /workspace/status GET', async () => {
    const status = await client.getWorkspaceStatus();

    expect(status.rootPath).toBe(workspaceRoot);
    expect(status.activeManifestRevision).toBeGreaterThanOrEqual(1);
    expect(status.categoriesBreakdown).toBeDefined();
  });

  it('should generate and retrieve manifest over /workspace/manifest endpoints', async () => {
    const generated = await client.generateManifest();
    expect(generated.revision).toBeGreaterThanOrEqual(2);

    const fetched = await client.getManifest();
    expect(fetched.revision).toBe(generated.revision);
    expect(fetched.files.length).toBe(generated.files.length);
  });

  it('should verify workspace manifest over /workspace/manifest/verify POST', async () => {
    const verification = await client.verifyManifest();

    expect(verification.valid).toBe(true);
    expect(verification.totalChecked).toBeGreaterThan(0);
    expect(verification.matchingCount).toBe(verification.totalChecked);
  });

  it('should create and list safe snapshots over /workspace/snapshots endpoints', async () => {
    const created = await client.createSafeSnapshot({
      name: 'API Safe Snapshot',
    });

    expect(created.id).toMatch(/^snap-/);
    expect(created.name).toBe('API Safe Snapshot');
    expect(created.sha256).toBeDefined();

    const list = await client.getSnapshots();
    expect(list.some((s) => s.id === created.id)).toBe(true);
  });
});
