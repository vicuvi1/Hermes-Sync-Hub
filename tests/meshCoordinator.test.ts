import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MeshCoordinatorService } from '../apps/agent/src/sync/MeshCoordinatorService';
import { SyncEngineService } from '../apps/agent/src/sync/SyncService';
import { WorkspaceService } from '../apps/agent/src/workspace/WorkspaceService';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { DeviceRegistryService } from '../apps/agent/src/devices/DeviceRegistry';
import { HermesService } from '../apps/agent/src/hermes/HermesAdapter';
import { BackupService } from '../apps/agent/src/backups/BackupService';
import { MockSyncthingAdapter } from '../apps/agent/src/sync/SyncthingAdapter';

describe('Main PC mesh coordinator', () => {
  let root: string;
  let coordinator: MeshCoordinatorService;
  let registry: DeviceRegistryService;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-mesh-policy-'));
    const hermesHome = path.join(root, 'hermes');
    fs.mkdirSync(path.join(hermesHome, 'skills', 'trusted'), { recursive: true });
    fs.mkdirSync(path.join(hermesHome, 'memories'), { recursive: true });
    fs.writeFileSync(path.join(hermesHome, 'skills', 'trusted', 'SKILL.md'), 'trusted skill', 'utf-8');
    fs.writeFileSync(path.join(hermesHome, 'memories', 'profile.md'), 'trusted memory', 'utf-8');

    const identity = new DeviceIdentityService(path.join(root, 'identity'));
    const hermes = new HermesService(hermesHome);
    const workspace = new WorkspaceService(identity, hermes, path.join(root, 'workspace'));
    registry = new DeviceRegistryService(identity, path.join(root, 'registry'), false);
    await registry.getAllDevices();
    const sync = new SyncEngineService(workspace, hermes, registry, new MockSyncthingAdapter(), hermesHome);
    const backups = new BackupService(workspace, hermes, identity, path.join(root, 'backups'));
    coordinator = new MeshCoordinatorService(workspace, registry, backups, sync);
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('selects the local PC and publishes a recoverable baseline', async () => {
    const local = registry.getLocalDevice();
    const selected = await coordinator.setPrimaryDevice(local.deviceId);
    expect(selected.localRole).toBe('primary');
    expect(selected.policy?.phase).toBe('awaiting-primary-publish');

    const published = await coordinator.publishPrimaryBaseline(true);
    expect(published.success).toBe(true);
    expect(published.backupId).toMatch(/^backup-/);
    expect(published.status.policy?.phase).toBe('baseline-ready');
    expect(published.status.baselineAdopted).toBe(true);
    expect(published.filesCopied).toBeGreaterThan(0);
  });

  it('requires the selected Main PC to publish its own baseline', async () => {
    const remote = await registry.addDevice({ deviceName: 'Trusted Laptop', hostname: 'TRUSTED-LAPTOP' });
    const status = await coordinator.setPrimaryDevice(remote.deviceId);
    expect(status.localRole).toBe('follower');
    expect(status.canPublish).toBe(false);

    const result = await coordinator.publishPrimaryBaseline(true);
    expect(result.success).toBe(false);
    expect(result.message).toContain('selected Main PC');
  });

  it('backs up divergent follower files locally before adopting the Main PC baseline', async () => {
    const primary = registry.getLocalDevice();
    await coordinator.setPrimaryDevice(primary.deviceId);
    await coordinator.publishPrimaryBaseline(true);

    const followerHome = path.join(root, 'follower-hermes');
    fs.mkdirSync(path.join(followerHome, 'memories'), { recursive: true });
    fs.mkdirSync(path.join(followerHome, 'skills'), { recursive: true });
    fs.writeFileSync(path.join(followerHome, 'memories', 'profile.md'), 'divergent follower memory', 'utf-8');
    fs.writeFileSync(path.join(followerHome, 'memories', 'follower-only.md'), 'preserve follower file', 'utf-8');
    fs.writeFileSync(path.join(followerHome, 'state.db'), 'live database', 'utf-8');

    const followerIdentity = new DeviceIdentityService(path.join(root, 'follower-identity'));
    const followerHermes = new HermesService(followerHome);
    const sharedWorkspace = new WorkspaceService(followerIdentity, followerHermes, path.join(root, 'workspace'));
    const followerRegistry = new DeviceRegistryService(followerIdentity, path.join(root, 'follower-registry'), false);
    await followerRegistry.getAllDevices();
    const followerSync = new SyncEngineService(sharedWorkspace, followerHermes, followerRegistry, new MockSyncthingAdapter(), followerHome);
    const followerBackups = new BackupService(sharedWorkspace, followerHermes, followerIdentity, path.join(root, 'follower-backups'));
    const followerCoordinator = new MeshCoordinatorService(sharedWorkspace, followerRegistry, followerBackups, followerSync);

    const before = await followerCoordinator.getStatus();
    expect(before.localRole).toBe('follower');
    expect(before.canAdopt).toBe(true);
    const adopted = await followerCoordinator.adoptPrimaryBaseline(true);

    expect(adopted.success).toBe(true);
    expect(fs.readFileSync(path.join(followerHome, 'memories', 'profile.md'), 'utf-8')).toBe('trusted memory');
    expect(fs.readFileSync(path.join(followerHome, 'memories', 'follower-only.md'), 'utf-8')).toBe('preserve follower file');
    expect(fs.readFileSync(path.join(followerHome, 'state.db'), 'utf-8')).toBe('live database');

    const recoveryRoot = path.join(followerRegistry.getStorageDirectory(), 'recovery', adopted.backupId!);
    expect(fs.readFileSync(path.join(recoveryRoot, 'memories', 'profile.md'), 'utf-8')).toBe('divergent follower memory');
    expect(fs.existsSync(path.join(recoveryRoot, 'state.db'))).toBe(false);
    expect(fs.existsSync(path.join(recoveryRoot, 'recovery-manifest.json'))).toBe(true);
  });
});
