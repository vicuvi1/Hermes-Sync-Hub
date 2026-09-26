import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  MeshSyncActionResult,
  MeshSyncPolicy,
  MeshSyncStatus,
} from '@hermes-hub/types';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { DeviceRegistryService } from '../devices/DeviceRegistry.js';
import { BackupService } from '../backups/BackupService.js';
import { SyncEngineService, isRestrictedSqliteFile } from './SyncService.js';

export class MeshCoordinatorService {
  constructor(
    private workspaceService: WorkspaceService,
    private deviceRegistry: DeviceRegistryService,
    private backupService: BackupService,
    private syncEngine: SyncEngineService
  ) {}

  private policyPath(): string {
    return path.join(this.workspaceService.getLayout().manifests, 'mesh-sync-policy.json');
  }

  private adoptionPath(deviceId: string): string {
    return path.join(this.deviceRegistry.getStorageDirectory(), `mesh-adoption-${deviceId}.json`);
  }

  private readPolicy(): MeshSyncPolicy | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.policyPath(), 'utf-8')) as MeshSyncPolicy;
      return parsed?.version === 1 && parsed.primaryDeviceId ? parsed : null;
    } catch {
      return null;
    }
  }

  private writePolicy(policy: MeshSyncPolicy): void {
    fs.mkdirSync(path.dirname(this.policyPath()), { recursive: true });
    const temporary = `${this.policyPath()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(policy, null, 2), 'utf-8');
    fs.renameSync(temporary, this.policyPath());
  }

  private async createLocalRecoveryBundle(label: string): Promise<{ id: string; path: string; files: number }> {
    const hermesHome = await this.syncEngine.resolveHermesHome();
    if (!hermesHome) throw new Error('Hermes home could not be found for the safety backup.');
    const id = `local-recovery-${Date.now()}`;
    const recoveryRoot = path.join(this.deviceRegistry.getStorageDirectory(), 'recovery', id);
    const fileRecords: Array<{ relativePath: string; sha256: string; sizeBytes: number }> = [];

    const copySafeTree = (sourceRoot: string, destinationRoot: string) => {
      if (!fs.existsSync(sourceRoot)) return;
      const scan = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) continue;
          const source = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(source);
            continue;
          }
          if (!entry.isFile() || isRestrictedSqliteFile(source)) continue;
          const relative = path.relative(sourceRoot, source);
          const destination = path.join(destinationRoot, relative);
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.copyFileSync(source, destination);
          const data = fs.readFileSync(source);
          fileRecords.push({
            relativePath: path.relative(recoveryRoot, destination).replace(/\\/g, '/'),
            sha256: crypto.createHash('sha256').update(data).digest('hex'),
            sizeBytes: data.length,
          });
        }
      };
      scan(sourceRoot);
    };

    copySafeTree(path.join(hermesHome, 'skills'), path.join(recoveryRoot, 'skills'));
    copySafeTree(path.join(hermesHome, 'memories'), path.join(recoveryRoot, 'memories'));
    for (const rootName of ['SOUL.md', 'MEMORY.md']) {
      const source = path.join(hermesHome, rootName);
      if (!fs.existsSync(source)) continue;
      fs.mkdirSync(recoveryRoot, { recursive: true });
      const destination = path.join(recoveryRoot, rootName);
      fs.copyFileSync(source, destination);
      const data = fs.readFileSync(source);
      fileRecords.push({ relativePath: rootName, sha256: crypto.createHash('sha256').update(data).digest('hex'), sizeBytes: data.length });
    }

    fs.mkdirSync(recoveryRoot, { recursive: true });
    fs.writeFileSync(path.join(recoveryRoot, 'recovery-manifest.json'), JSON.stringify({
      id,
      label,
      createdAt: new Date().toISOString(),
      localDeviceId: this.deviceRegistry.getLocalDevice().deviceId,
      files: fileRecords,
      note: 'Local-only safe file recovery bundle. Secrets, Vault files, and live databases are excluded.',
    }, null, 2), 'utf-8');
    return { id, path: recoveryRoot, files: fileRecords.length };
  }

  async getStatus(): Promise<MeshSyncStatus> {
    const local = this.deviceRegistry.getLocalDevice();
    const policy = this.readPolicy();
    if (!policy) {
      return {
        policy: null,
        localDeviceId: local.deviceId,
        localDeviceName: local.deviceName,
        localRole: 'unconfigured',
        baselineAdopted: false,
        canPublish: false,
        canAdopt: false,
        message: 'Choose the PC whose current Hermes files should become the initial baseline.',
      };
    }

    const isPrimary = policy.primaryDeviceId === local.deviceId;
    let baselineAdopted = isPrimary && policy.phase === 'baseline-ready';
    if (!isPrimary && policy.baselineId) {
      try {
        const adoption = JSON.parse(fs.readFileSync(this.adoptionPath(local.deviceId), 'utf-8'));
        baselineAdopted = adoption.baselineId === policy.baselineId;
      } catch {}
    }

    const message = policy.phase !== 'baseline-ready'
      ? isPrimary
        ? 'This is the Main PC. Publish its protected baseline when ready.'
        : `Waiting for ${policy.primaryDeviceName} to publish the baseline.`
      : isPrimary
        ? 'Main PC baseline is published. Normal changes now flow both ways.'
        : baselineAdopted
          ? 'This PC copied the Main PC baseline. Normal changes now flow both ways.'
          : `The ${policy.primaryDeviceName} baseline is ready to copy to this PC.`;

    return {
      policy,
      localDeviceId: local.deviceId,
      localDeviceName: local.deviceName,
      localRole: isPrimary ? 'primary' : 'follower',
      baselineAdopted,
      canPublish: isPrimary,
      canAdopt: !isPrimary && policy.phase === 'baseline-ready' && !baselineAdopted,
      message,
    };
  }

  async setPrimaryDevice(deviceId: string): Promise<MeshSyncStatus> {
    await this.workspaceService.initWorkspace();
    const device = await this.deviceRegistry.getDeviceById(deviceId);
    if (!device) throw new Error('The selected device is not registered.');
    this.writePolicy({
      version: 1,
      primaryDeviceId: device.deviceId,
      primaryDeviceName: device.deviceName,
      phase: 'awaiting-primary-publish',
      updatedAt: new Date().toISOString(),
      categories: ['skills', 'memories', 'configuration'],
    });
    return this.getStatus();
  }

  async publishPrimaryBaseline(confirmed: boolean): Promise<MeshSyncActionResult> {
    const before = await this.getStatus();
    if (!confirmed) return { success: false, message: 'Confirm the baseline publication first.', status: before };
    if (!before.policy || before.localRole !== 'primary') {
      return { success: false, message: 'Baseline publication must be run on the selected Main PC.', status: before };
    }

    const backup = await this.backupService.createBackup({
      name: `before-main-baseline-${Date.now()}`,
      notes: 'Automatic backup before publishing the Main PC mesh baseline.',
    });
    const cycle = await this.syncEngine.executeSyncCycle({ force: true });
    const policy: MeshSyncPolicy = {
      ...before.policy,
      phase: 'baseline-ready',
      baselineId: cycle.cycleId,
      baselinePublishedAt: cycle.completedAt,
      updatedAt: cycle.completedAt,
    };
    this.writePolicy(policy);
    return {
      success: true,
      message: 'Main PC baseline published. Wait for Syncthing to finish before copying it on other PCs.',
      status: await this.getStatus(),
      backupId: backup.id,
      filesCopied: cycle.actions.filter((action) => action.action.startsWith('staged')).length,
    };
  }

  async adoptPrimaryBaseline(confirmed: boolean): Promise<MeshSyncActionResult> {
    const before = await this.getStatus();
    if (!confirmed) return { success: false, message: 'Confirm the baseline copy first.', status: before };
    if (!before.canAdopt || !before.policy?.baselineId) {
      return { success: false, message: 'A new Main PC baseline is not ready for this device.', status: before };
    }

    const recovery = await this.createLocalRecoveryBundle(`Before copying baseline from ${before.policy.primaryDeviceName}`);
    const adoption = await this.syncEngine.adoptWorkspaceBaseline();
    const adoptionFile = this.adoptionPath(before.localDeviceId);
    fs.mkdirSync(path.dirname(adoptionFile), { recursive: true });
    fs.writeFileSync(adoptionFile, JSON.stringify({
      baselineId: before.policy.baselineId,
      primaryDeviceId: before.policy.primaryDeviceId,
      adoptedAt: new Date().toISOString(),
    }, null, 2), 'utf-8');

    return {
      success: true,
      message: `Copied ${adoption.filesCopied} safe files from ${before.policy.primaryDeviceName}. Normal two-way sync is now active.`,
      status: await this.getStatus(),
      backupId: recovery.id,
      filesCopied: adoption.filesCopied,
    };
  }
}
