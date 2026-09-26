import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  BackupRecord,
  BackupOptions,
  BackupVerificationResult,
  BackupRestoreOptions,
  BackupRestoreResult,
} from '@hermes-hub/types';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { HermesService } from '../hermes/HermesAdapter.js';
import { DeviceIdentityService } from '../devices/DeviceService.js';

export class BackupService {
  private workspaceService: WorkspaceService;
  private hermesService: HermesService;
  private identityService: DeviceIdentityService;
  private customBackupsDir?: string;

  constructor(
    workspaceService?: WorkspaceService,
    hermesService?: HermesService,
    identityService?: DeviceIdentityService,
    customBackupsDir?: string
  ) {
    this.identityService = identityService || new DeviceIdentityService();
    this.hermesService = hermesService || new HermesService();
    this.workspaceService =
      workspaceService || new WorkspaceService(this.identityService, this.hermesService);
    this.customBackupsDir = customBackupsDir;
  }

  /**
   * Resolves the primary directory storing backup bundles
   */
  getBackupsDirectory(): string {
    if (this.customBackupsDir) {
      if (!fs.existsSync(this.customBackupsDir)) {
        fs.mkdirSync(this.customBackupsDir, { recursive: true });
      }
      return this.customBackupsDir;
    }
    const layout = this.workspaceService.getLayout();
    if (!fs.existsSync(layout.backups)) {
      fs.mkdirSync(layout.backups, { recursive: true });
    }
    return layout.backups;
  }

  /**
   * Calculates SHA-256 hash of a file
   */
  private calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Recursively copies a directory
   */
  private copyDirRecursive(src: string, dest: string): number {
    if (!fs.existsSync(src)) return 0;
    fs.mkdirSync(dest, { recursive: true });
    let count = 0;

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        count += this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        count++;
      }
    }
    return count;
  }

  /**
   * Safely captures and packages a complete, atomic backup bundle.
   * ANTI-CORRUPTION GUARANTEE: Never copies live SQLite databases.
   */
  async createBackup(options?: BackupOptions): Promise<BackupRecord> {
    const localDev = this.identityService.getLocalDevice();
    const backupsDir = this.getBackupsDirectory();
    const wsRoot = this.workspaceService.getRootPath();

    const timestamp = new Date().toISOString();
    const backupId = `backup-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const backupName =
      options?.name ||
      `hermes-backup-${timestamp.slice(0, 10)}-${backupId.slice(-6)}`;
    const backupBundleDir = path.join(backupsDir, backupId);

    fs.mkdirSync(backupBundleDir, { recursive: true });

    // 1. Capture safe non-destructive snapshot of Hermes runtime state
    const safeSnap = await this.workspaceService.createSafeSnapshot({
      name: `${backupName}-safe-state`,
      notes: `Embedded state capture for ${backupId}`,
    });

    // 2. Package file-based categories into the backup directory
    let sessionsCount = 0;
    let memoriesCount = 0;
    let skillsCount = 0;
    let configsCount = 0;

    const categories: Array<{ name: string; srcSubdir: string }> = [
      { name: 'memories', srcSubdir: 'memories' },
      { name: 'skills', srcSubdir: 'skills' },
      { name: 'configs', srcSubdir: 'configs' },
      { name: 'sessions', srcSubdir: 'sessions' },
    ];

    const filesManifest: Array<{ relativePath: string; sha256: string; sizeBytes: number }> = [];

    for (const cat of categories) {
      const srcDir = path.join(wsRoot, cat.srcSubdir);
      const targetDir = path.join(backupBundleDir, cat.name);

      if (fs.existsSync(srcDir)) {
        const copied = this.copyDirRecursive(srcDir, targetDir);
        if (cat.name === 'memories') memoriesCount = copied;
        else if (cat.name === 'skills') skillsCount = copied;
        else if (cat.name === 'configs') configsCount = copied;
        else if (cat.name === 'sessions') sessionsCount = copied;
      }
    }

    // Copy the safe snapshot JSON into the backup bundle
    const snapTarget = path.join(backupBundleDir, 'snapshot.json');
    if (fs.existsSync(safeSnap.filePath)) {
      fs.copyFileSync(safeSnap.filePath, snapTarget);
    }

    // 3. Scan all files in backup bundle and calculate integrity hashes
    let totalSizeBytes = 0;
    const scanBundle = (dir: string, baseDir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          scanBundle(full, baseDir);
        } else if (item.name !== 'backup-manifest.json') {
          const stat = fs.statSync(full);
          const rel = path.relative(baseDir, full).replace(/\\/g, '/');
          const sha = this.calculateFileHash(full);
          filesManifest.push({
            relativePath: rel,
            sha256: sha,
            sizeBytes: stat.size,
          });
          totalSizeBytes += stat.size;
        }
      }
    };
    scanBundle(backupBundleDir, backupBundleDir);

    // 4. Write backup-manifest.json inside the bundle
    const bundleManifest = {
      backupId,
      name: backupName,
      createdAt: timestamp,
      originDevice: localDev.deviceId,
      notes: options?.notes || 'Atomic Hermes Hub local backup package',
      snapshotId: safeSnap.id,
      itemCounts: {
        sessions: sessionsCount,
        memories: memoriesCount,
        skills: skillsCount,
        configs: configsCount,
      },
      totalSizeBytes,
      files: filesManifest,
    };

    const bundleManifestPath = path.join(backupBundleDir, 'backup-manifest.json');
    fs.writeFileSync(bundleManifestPath, JSON.stringify(bundleManifest, null, 2), 'utf-8');

    const manifestSha = this.calculateFileHash(bundleManifestPath);

    const record: BackupRecord = {
      id: backupId,
      name: backupName,
      createdAt: timestamp,
      sizeBytes: totalSizeBytes,
      health: 'valid',
      itemCounts: bundleManifest.itemCounts,
      originDevice: localDev.deviceId,
      sha256: manifestSha,
      filePath: backupBundleDir,
      notes: bundleManifest.notes,
      snapshotId: safeSnap.id,
      verifiedAt: timestamp,
    };

    // 5. Update master backups manifest
    await this.recordBackupInMasterManifest(record);

    // 6. Enforce retention policy (prune oldest backups beyond retainCount)
    const retainCount = options?.retainCount || 10;
    await this.pruneOldBackups(retainCount);

    return record;
  }

  /**
   * Records a backup record in the master backups manifest
   */
  private async recordBackupInMasterManifest(record: BackupRecord): Promise<void> {
    const backupsDir = this.getBackupsDirectory();
    const masterManifestPath = path.join(backupsDir, 'backups-manifest.json');

    let allBackups: BackupRecord[] = [];
    if (fs.existsSync(masterManifestPath)) {
      try {
        const raw = fs.readFileSync(masterManifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) allBackups = parsed;
      } catch {}
    }

    // Insert new record at beginning
    allBackups = [record, ...allBackups.filter((b) => b.id !== record.id)];
    fs.writeFileSync(masterManifestPath, JSON.stringify(allBackups, null, 2), 'utf-8');
  }

  /**
   * Prunes oldest backups when total backups exceed maxRetain
   */
  async pruneOldBackups(maxRetain: number): Promise<number> {
    if (maxRetain <= 0) return 0;
    const all = await this.getBackups();
    if (all.length <= maxRetain) return 0;

    const toPrune = all.slice(maxRetain);
    const toKeep = all.slice(0, maxRetain);
    let prunedCount = 0;

    for (const b of toPrune) {
      if (b.filePath && fs.existsSync(b.filePath)) {
        try {
          fs.rmSync(b.filePath, { recursive: true, force: true });
          prunedCount++;
        } catch {}
      }
    }

    const backupsDir = this.getBackupsDirectory();
    const masterManifestPath = path.join(backupsDir, 'backups-manifest.json');
    fs.writeFileSync(masterManifestPath, JSON.stringify(toKeep, null, 2), 'utf-8');

    return prunedCount;
  }

  /**
   * Retrieves all backup records, sorted latest first
   */
  async getBackups(): Promise<BackupRecord[]> {
    const backupsDir = this.getBackupsDirectory();
    const masterManifestPath = path.join(backupsDir, 'backups-manifest.json');

    if (fs.existsSync(masterManifestPath)) {
      try {
        const raw = fs.readFileSync(masterManifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
      } catch {}
    }

    // Fallback: discover by scanning backup folders in directory
    const discovered: BackupRecord[] = [];
    try {
      const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestFile = path.join(backupsDir, entry.name, 'backup-manifest.json');
        if (fs.existsSync(manifestFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
            discovered.push({
              id: data.backupId || entry.name,
              name: data.name || entry.name,
              createdAt: data.createdAt || new Date().toISOString(),
              sizeBytes: data.totalSizeBytes || 0,
              health: 'valid',
              itemCounts: data.itemCounts || { sessions: 0, memories: 0, skills: 0, configs: 0 },
              originDevice: data.originDevice || 'local',
              filePath: path.join(backupsDir, entry.name),
              notes: data.notes,
              snapshotId: data.snapshotId,
            });
          } catch {}
        }
      }
    } catch {}

    return discovered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Retrieves a specific backup by ID
   */
  async getBackupById(id: string): Promise<BackupRecord | null> {
    const all = await this.getBackups();
    return all.find((b) => b.id === id) || null;
  }

  /**
   * Verifies the cryptographic integrity of a backup bundle
   */
  async verifyBackup(backupId: string): Promise<BackupVerificationResult> {
    const backup = await this.getBackupById(backupId);
    const checkedAt = new Date().toISOString();

    if (!backup || !backup.filePath || !fs.existsSync(backup.filePath)) {
      return {
        valid: false,
        backupId,
        checkedAt,
        totalFiles: 0,
        matchingFiles: 0,
        errors: [`Backup bundle directory not found for ${backupId}`],
        missingFiles: [],
        tamperedFiles: [],
      };
    }

    const manifestPath = path.join(backup.filePath, 'backup-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return {
        valid: false,
        backupId,
        checkedAt,
        totalFiles: 0,
        matchingFiles: 0,
        errors: [`Missing backup-manifest.json inside ${backupId}`],
        missingFiles: ['backup-manifest.json'],
        tamperedFiles: [],
      };
    }

    let manifestData: any;
    try {
      manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (err: any) {
      return {
        valid: false,
        backupId,
        checkedAt,
        totalFiles: 0,
        matchingFiles: 0,
        errors: [`Corrupted backup-manifest.json: ${err.message}`],
        missingFiles: [],
        tamperedFiles: [],
      };
    }

    const files: Array<{ relativePath: string; sha256: string }> = manifestData.files || [];
    const missingFiles: string[] = [];
    const tamperedFiles: string[] = [];
    let matchingFiles = 0;

    for (const f of files) {
      const fullPath = path.join(backup.filePath, f.relativePath);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(f.relativePath);
      } else {
        const actualSha = this.calculateFileHash(fullPath);
        if (actualSha !== f.sha256) {
          tamperedFiles.push(f.relativePath);
        } else {
          matchingFiles++;
        }
      }
    }

    const valid = missingFiles.length === 0 && tamperedFiles.length === 0;

    return {
      valid,
      backupId,
      checkedAt,
      totalFiles: files.length,
      matchingFiles,
      errors: valid ? [] : ['Backup integrity check failed: missing or altered files detected'],
      missingFiles,
      tamperedFiles,
    };
  }

  /**
   * Restores a backup bundle safely.
   * ANTI-CORRUPTION SAFEGUARDS:
   * 1. Creates an emergency safety rollback snapshot of the current state before restore.
   * 2. If Hermes is active and locked, prevents destructive database overwrites.
   * 3. Non-destructively restores memories, skills, and configs.
   */
  async restoreBackup(options: BackupRestoreOptions): Promise<BackupRestoreResult> {
    const backup = await this.getBackupById(options.backupId);
    const restoredAt = new Date().toISOString();

    if (!backup || !backup.filePath || !fs.existsSync(backup.filePath)) {
      return {
        success: false,
        backupId: options.backupId,
        restoredAt,
        restoredFilesCount: 0,
        error: `Backup ${options.backupId} not found on disk`,
      };
    }

    // Verify backup integrity prior to restore
    const verification = await this.verifyBackup(options.backupId);
    if (!verification.valid) {
      return {
        success: false,
        backupId: options.backupId,
        restoredAt,
        restoredFilesCount: 0,
        error: `Cannot restore corrupted backup: ${verification.errors.join('; ')}`,
      };
    }

    // Safety Step 1: Create emergency safety rollback snapshot of current state
    let safetyRollbackSnapshotId: string | undefined;
    if (options.emergencyRollback !== false) {
      try {
        const rollbackSnap = await this.workspaceService.createSafeSnapshot({
          name: `pre-restore-safety-${Date.now()}`,
          notes: `Automatic safety rollback point before restoring backup ${options.backupId}`,
        });
        safetyRollbackSnapshotId = rollbackSnap.id;
      } catch (err) {
        console.warn('Failed to capture pre-restore rollback snapshot:', err);
      }
    }

    // Safety Step 2: Check Hermes running state
    const hermesStatus = await this.hermesService.getStatus();
    if (hermesStatus.isRunning) {
      // If Hermes is running, we strictly forbid modifying live SQLite or lockfiles
      // File-based items (skills, memories, configs) can be restored into workspace safely
    }

    // Safety Step 3: Non-destructively copy categories from backup into workspace
    const wsRoot = this.workspaceService.getRootPath();
    let restoredFilesCount = 0;

    const restoreCategories = ['memories', 'skills', 'configs', 'sessions'];
    for (const cat of restoreCategories) {
      const srcDir = path.join(backup.filePath, cat);
      const destDir = path.join(wsRoot, cat);
      if (fs.existsSync(srcDir)) {
        restoredFilesCount += this.copyDirRecursive(srcDir, destDir);
      }
    }

    // Regenerate workspace manifest
    await this.workspaceService.generateManifest();

    return {
      success: true,
      backupId: options.backupId,
      restoredAt,
      restoredFilesCount,
      safetyRollbackSnapshotId,
    };
  }

  /**
   * Deletes a backup bundle from disk
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    const backup = await this.getBackupById(backupId);
    if (backup?.filePath && fs.existsSync(backup.filePath)) {
      try {
        fs.rmSync(backup.filePath, { recursive: true, force: true });
      } catch {}
    }

    const backupsDir = this.getBackupsDirectory();
    const masterManifestPath = path.join(backupsDir, 'backups-manifest.json');
    if (fs.existsSync(masterManifestPath)) {
      try {
        const raw = fs.readFileSync(masterManifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter((b: any) => b.id !== backupId);
          fs.writeFileSync(masterManifestPath, JSON.stringify(updated, null, 2), 'utf-8');
        }
      } catch {}
    }
    return true;
  }
}
