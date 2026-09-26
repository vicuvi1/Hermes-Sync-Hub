import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  WorkspaceStatus,
  WorkspaceFileCategory,
  ManifestFileEntry,
  ClusterManifest,
  ManifestVerificationResult,
  SafeSnapshotRecord,
} from '@hermes-hub/types';
import { DeviceIdentityService } from '../devices/DeviceService.js';
import { HermesService } from '../hermes/HermesAdapter.js';

export class WorkspaceService {
  private customRootPath?: string;
  private identityService: DeviceIdentityService;
  private hermesService: HermesService;

  constructor(
    identityService?: DeviceIdentityService,
    hermesService?: HermesService,
    customRootPath?: string
  ) {
    this.identityService = identityService || new DeviceIdentityService();
    this.hermesService = hermesService || new HermesService();
    this.customRootPath = customRootPath;
  }

  /**
   * Resolves the primary root path of the managed HermesHubData workspace
   */
  getRootPath(): string {
    if (this.customRootPath) {
      return this.customRootPath;
    }

    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      return path.join(localAppData, 'HermesHub', 'HermesHubData');
    }

    return path.join(os.homedir(), '.hermes-hub', 'HermesHubData');
  }

  /**
   * Returns normalized paths for all standardized workspace subdirectories
   */
  getLayout(): WorkspaceStatus['layout'] {
    const root = this.getRootPath();
    return {
      manifests: path.join(root, 'manifests'),
      snapshots: path.join(root, 'snapshots'),
      devices: path.join(root, 'devices'),
      memories: path.join(root, 'memories'),
      skills: path.join(root, 'skills'),
      configs: path.join(root, 'configs'),
      backups: path.join(root, 'backups'),
      activity: path.join(root, 'activity'),
    };
  }

  /**
   * Initializes the directory hierarchy and default starter templates
   */
  async initWorkspace(): Promise<WorkspaceStatus> {
    const root = this.getRootPath();
    const layout = this.getLayout();

    // Ensure all subdirectories exist
    for (const dir of Object.values(layout)) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Seed default memory if missing
    const defaultMemoryPath = path.join(layout.memories, 'MEMORY.md');
    if (!fs.existsSync(defaultMemoryPath)) {
      const content = `# Hermes Agent Core Memory\n\n- Synchronized via Hermes Hub mesh.\n- Initialized: ${new Date().toISOString()}\n`;
      fs.writeFileSync(defaultMemoryPath, content, 'utf-8');
    }

    // Seed default config template if missing
    const defaultConfigPath = path.join(layout.configs, 'config.template.yaml');
    if (!fs.existsSync(defaultConfigPath)) {
      const configContent = `# Hermes Hub Synchronized Agent Configuration\nversion: 1.0\nsync_strategy: bidirectional\nencryption: aes-256-gcm\n`;
      fs.writeFileSync(defaultConfigPath, configContent, 'utf-8');
    }

    // Seed sample skill manifest if missing
    const sampleSkillDir = path.join(layout.skills, 'hermes-core');
    if (!fs.existsSync(sampleSkillDir)) {
      fs.mkdirSync(sampleSkillDir, { recursive: true });
      fs.writeFileSync(
        path.join(sampleSkillDir, 'SKILL.md'),
        `---\nname: hermes-core\ndescription: Core system capabilities and mesh synchronization\n---\n\nCore agent capabilities.\n`,
        'utf-8'
      );
    }

    // Ensure revisions.json exists
    const revisionsFile = path.join(layout.manifests, 'revisions.json');
    if (!fs.existsSync(revisionsFile)) {
      fs.writeFileSync(
        revisionsFile,
        JSON.stringify({ currentRevision: 1, history: [{ revision: 1, timestamp: new Date().toISOString() }] }, null, 2),
        'utf-8'
      );
    }

    // Generate initial manifest if missing
    const indexFile = path.join(layout.manifests, 'index.json');
    if (!fs.existsSync(indexFile)) {
      await this.generateManifest();
    }

    return this.getWorkspaceStatus();
  }

  /**
   * Computes SHA-256 checksum over file content.
   * For text files, normalizes CRLF -> LF so hashes remain deterministic across Windows and Linux.
   */
  calculateFileHash(filePath: string): string {
    const rawBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const textExts = ['.md', '.yaml', '.yml', '.json', '.jsonl', '.txt', '.log'];

    let bufferToHash: Buffer;
    if (textExts.includes(ext)) {
      const text = rawBuffer.toString('utf-8').replace(/\r\n/g, '\n');
      bufferToHash = Buffer.from(text, 'utf-8');
    } else {
      bufferToHash = rawBuffer;
    }

    return `sha256-${crypto.createHash('sha256').update(bufferToHash).digest('hex')}`;
  }

  /**
   * Classifies a relative path into a standard category
   */
  categorizePath(relPath: string): WorkspaceFileCategory {
    const normalized = relPath.replace(/\\/g, '/');
    if (normalized.startsWith('skills/')) return 'skill';
    if (normalized.startsWith('memories/')) return 'memory';
    if (normalized.startsWith('sessions/') || normalized.includes('session')) return 'session';
    if (normalized.startsWith('configs/')) return 'config';
    if (normalized.startsWith('snapshots/')) return 'snapshot';
    return 'other';
  }

  /**
   * Returns metadata and health status for the workspace
   */
  async getWorkspaceStatus(): Promise<WorkspaceStatus> {
    const root = this.getRootPath();
    const layout = this.getLayout();
    const isInitialized = fs.existsSync(root);

    let totalFiles = 0;
    let totalSizeBytes = 0;
    const categoriesBreakdown: Record<string, number> = {
      skill: 0,
      memory: 0,
      session: 0,
      config: 0,
      snapshot: 0,
      other: 0,
    };

    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile()) {
          totalFiles++;
          const stats = fs.statSync(full);
          totalSizeBytes += stats.size;
          const rel = path.relative(root, full);
          const cat = this.categorizePath(rel);
          categoriesBreakdown[cat] = (categoriesBreakdown[cat] || 0) + 1;
        }
      }
    };

    if (isInitialized) {
      scanDir(root);
    }

    // Read revision counter
    let activeManifestRevision = 1;
    const revFile = path.join(layout.manifests, 'revisions.json');
    if (fs.existsSync(revFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(revFile, 'utf-8'));
        activeManifestRevision = parsed.currentRevision || 1;
      } catch {}
    }

    // Read last snapshot timestamp
    let lastSnapshotAt: string | undefined;
    const snapshotsFile = path.join(layout.snapshots, 'manifest.json');
    if (fs.existsSync(snapshotsFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(snapshotsFile, 'utf-8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          lastSnapshotAt = parsed[parsed.length - 1].createdAt;
        }
      } catch {}
    }

    return {
      rootPath: root,
      isInitialized,
      layout,
      totalFiles,
      totalSizeBytes,
      activeManifestRevision,
      lastSnapshotAt,
      categoriesBreakdown,
    };
  }

  /**
   * Scans workspace files and generates a new deterministic ClusterManifest
   */
  async generateManifest(): Promise<ClusterManifest> {
    const root = this.getRootPath();
    const layout = this.getLayout();
    const localDev = this.identityService.getLocalDevice();

    // Ensure layout exists
    for (const dir of Object.values(layout)) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Read and increment revision
    let revision = 1;
    const revFile = path.join(layout.manifests, 'revisions.json');
    let revHistory: any[] = [];
    if (fs.existsSync(revFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(revFile, 'utf-8'));
        revision = (parsed.currentRevision || 0) + 1;
        revHistory = parsed.history || [];
      } catch {}
    }

    const files: ManifestFileEntry[] = [];
    let totalSizeBytes = 0;
    const categoriesCount: Record<string, number> = {};

    // Scan relevant sync subdirectories (excluding manifests and devices folders to avoid circular self-reference)
    const scanDirs = [
      layout.skills,
      layout.memories,
      layout.configs,
      layout.snapshots,
      layout.backups,
      layout.activity,
    ];

    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile()) {
          const rel = path.relative(root, full).replace(/\\/g, '/');
          const stat = fs.statSync(full);
          const sha = this.calculateFileHash(full);
          const category = this.categorizePath(rel);

          files.push({
            id: `file-${crypto.createHash('md5').update(rel).digest('hex').slice(0, 10)}`,
            relativePath: rel,
            sha256: sha,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            category,
            originDevice: localDev.deviceId,
            revision,
          });

          totalSizeBytes += stat.size;
          categoriesCount[category] = (categoriesCount[category] || 0) + 1;
        }
      }
    };

    for (const d of scanDirs) {
      scan(d);
    }

    const manifest: ClusterManifest = {
      manifestId: `man-${Date.now()}-${revision}`,
      deviceId: localDev.deviceId,
      revision,
      generatedAt: new Date().toISOString(),
      files,
      stats: {
        totalFiles: files.length,
        totalSizeBytes,
        categoriesCount,
      },
    };

    // Save manifest files
    fs.writeFileSync(path.join(layout.manifests, 'index.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    fs.writeFileSync(
      path.join(layout.devices, `${localDev.deviceId}-manifest.json`),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // Save updated revisions
    revHistory.push({ revision, timestamp: manifest.generatedAt, totalFiles: files.length });
    fs.writeFileSync(
      revFile,
      JSON.stringify({ currentRevision: revision, history: revHistory }, null, 2),
      'utf-8'
    );

    return manifest;
  }

  /**
   * Retrieves active cluster manifest from disk
   */
  async getManifest(): Promise<ClusterManifest> {
    const layout = this.getLayout();
    const indexPath = path.join(layout.manifests, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch {}
    }
    return this.generateManifest();
  }

  /**
   * Verifies current workspace contents on disk against the active manifest
   */
  async verifyManifest(): Promise<ManifestVerificationResult> {
    const root = this.getRootPath();
    const manifest = await this.getManifest();

    const tamperedFiles: ManifestVerificationResult['tamperedFiles'] = [];
    const missingFiles: string[] = [];
    let matchingCount = 0;

    for (const item of manifest.files) {
      const fullPath = path.join(root, item.relativePath);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(item.relativePath);
        continue;
      }

      const currentHash = this.calculateFileHash(fullPath);
      if (currentHash !== item.sha256) {
        tamperedFiles.push({
          relativePath: item.relativePath,
          expectedSha256: item.sha256,
          actualSha256: currentHash,
        });
      } else {
        matchingCount++;
      }
    }

    const valid = tamperedFiles.length === 0 && missingFiles.length === 0;

    return {
      valid,
      verifiedAt: new Date().toISOString(),
      totalChecked: manifest.files.length,
      matchingCount,
      tamperedFiles,
      missingFiles,
    };
  }

  /**
   * Safely captures an isolated snapshot of local Hermes state.
   * ANTI-CORRUPTION GUARANTEE: Never copies active SQLite WAL files directly.
   */
  async createSafeSnapshot(options?: { name?: string; notes?: string }): Promise<SafeSnapshotRecord> {
    const layout = this.getLayout();
    const localDev = this.identityService.getLocalDevice();
    const hermesStatus = await this.hermesService.getStatus();

    const snapshotId = `snap-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const snapshotName = options?.name || `hermes-snapshot-${new Date().toISOString().slice(0, 10)}-${snapshotId.slice(-4)}`;
    const snapshotFilename = `${snapshotId}.json`;
    const snapshotPath = path.join(layout.snapshots, snapshotFilename);

    // Check for active lockfiles
    let isClean = !hermesStatus.isRunning;
    const detectedDatabases = hermesStatus.detectedDatabases || ['state.db'];
    if (hermesStatus.homeDirectory) {
      const lockPath = path.join(hermesStatus.homeDirectory, 'state.db.auto-maintenance.lock');
      if (fs.existsSync(lockPath)) {
        isClean = false;
      }
    }

    // Build structured extract payload
    const snapshotPayload = {
      snapshotId,
      name: snapshotName,
      createdAt: new Date().toISOString(),
      originDevice: {
        id: localDev.deviceId,
        name: localDev.deviceName,
        hostname: localDev.hostname,
        os: localDev.os,
      },
      hermes: {
        version: hermesStatus.version,
        profile: hermesStatus.profile,
        home: hermesStatus.homeDirectory,
        databases: detectedDatabases,
        isRunning: hermesStatus.isRunning,
      },
      extractedData: {
        sessionsCount: hermesStatus.stats.sessionsCount || 0,
        skillsCount: hermesStatus.stats.skillsCount || 0,
        memoriesCount: hermesStatus.stats.memoriesCount || 0,
        totalSizeBytes: hermesStatus.stats.totalSizeBytes || 0,
        lastActivityAt: hermesStatus.stats.lastActivityAt || new Date().toISOString(),
      },
      notes: options?.notes || 'Non-destructive snapshot captured via Hermes Hub anti-corruption engine',
    };

    const contentStr = JSON.stringify(snapshotPayload, null, 2);
    fs.writeFileSync(snapshotPath, contentStr, 'utf-8');

    const stat = fs.statSync(snapshotPath);
    const sha = this.calculateFileHash(snapshotPath);

    const record: SafeSnapshotRecord = {
      id: snapshotId,
      name: snapshotName,
      createdAt: snapshotPayload.createdAt,
      originDevice: localDev.deviceId,
      sourceDatabases: detectedDatabases,
      sizeBytes: stat.size,
      sha256: sha,
      recordCounts: {
        sessions: hermesStatus.stats.sessionsCount || 0,
        memories: hermesStatus.stats.memoriesCount || 0,
        skills: hermesStatus.stats.skillsCount || 0,
        projects: detectedDatabases.length,
      },
      isClean,
      filePath: snapshotPath,
    };

    // Update snapshots manifest
    const manifestPath = path.join(layout.snapshots, 'manifest.json');
    let snapshotsList: SafeSnapshotRecord[] = [];
    if (fs.existsSync(manifestPath)) {
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) snapshotsList = parsed;
      } catch {}
    }
    snapshotsList.push(record);
    fs.writeFileSync(manifestPath, JSON.stringify(snapshotsList, null, 2), 'utf-8');

    // Automatically regenerate workspace manifest to include the new snapshot
    await this.generateManifest();

    return record;
  }

  /**
   * Retrieves all snapshot records from the workspace
   */
  async getSnapshots(): Promise<SafeSnapshotRecord[]> {
    const layout = this.getLayout();
    const manifestPath = path.join(layout.snapshots, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  }

  /**
   * Retrieves a snapshot by ID
   */
  async getSnapshotById(id: string): Promise<SafeSnapshotRecord | null> {
    const all = await this.getSnapshots();
    return all.find((s) => s.id === id) || null;
  }
}
