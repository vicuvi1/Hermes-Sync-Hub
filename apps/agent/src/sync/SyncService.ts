import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SyncCategory,
  SyncCycleOptions,
  SyncFileAction,
  SyncCycleResult,
  ConflictItem,
  ConflictResolution,
  DeviceSyncSummary,
  WorkspaceStatus,
} from '@hermes-hub/types';
import { redactSecrets } from '@hermes-hub/shared';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { HermesService } from '../hermes/HermesAdapter.js';
import { DeviceRegistryService } from '../devices/DeviceRegistry.js';
import { ISyncthingAdapter } from './SyncthingAdapter.js';

/**
 * STRICT ANTI-CORRUPTION RULE:
 * Live SQLite databases (state.db, kanban.db, projects.db) actively holding WAL
 * journal locks must NEVER be synced directly. Returns true if the given file
 * matches any SQLite database or WAL lock pattern.
 */
export function isRestrictedSqliteFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const filename = path.basename(normalized);

  // Exact known database names
  const knownDbs = ['state.db', 'kanban.db', 'projects.db', 'hermes.db'];
  if (knownDbs.includes(filename)) {
    return true;
  }

  // SQLite WAL, SHM, journal extensions and variants
  if (
    filename.endsWith('.db') ||
    filename.endsWith('.db-wal') ||
    filename.endsWith('.db-shm') ||
    filename.endsWith('.sqlite') ||
    filename.endsWith('.sqlite-wal') ||
    filename.endsWith('.sqlite-shm') ||
    filename.endsWith('.db-journal')
  ) {
    return true;
  }

  // Active lock files
  if (filename.endsWith('.lock') || filename.includes('maintenance.lock')) {
    return true;
  }

  return false;
}

/**
 * Safely extracts a short text snippet from a file for conflict previews
 */
function getFileSnippet(filePath: string, maxLen = 120): string {
  try {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.slice(0, maxLen).replace(/[\r\n]+/g, ' ');
  } catch {
    return '';
  }
}

export class SyncEngineService {
  private workspaceService: WorkspaceService;
  private hermesService: HermesService;
  private deviceRegistry?: DeviceRegistryService;
  private syncthingAdapter?: ISyncthingAdapter;
  private customHermesHome?: string;
  private activeConflicts: Map<string, ConflictItem> = new Map();
  private protectedConflictPaths = new Set<string>();
  private lastSummary: DeviceSyncSummary;

  constructor(
    workspaceService?: WorkspaceService,
    hermesService?: HermesService,
    deviceRegistry?: DeviceRegistryService,
    syncthingAdapter?: ISyncthingAdapter,
    customHermesHome?: string
  ) {
    this.workspaceService = workspaceService || new WorkspaceService();
    this.hermesService = hermesService || new HermesService(customHermesHome);
    this.deviceRegistry = deviceRegistry;
    this.syncthingAdapter = syncthingAdapter;
    this.customHermesHome = customHermesHome;

    this.lastSummary = {
      lastSync: new Date(0).toISOString(),
      pendingFiles: 0,
      filesTransferred: 0,
      bytesUploaded: 0,
      bytesDownloaded: 0,
      conflicts: 0,
      status: 'in-sync',
    };
  }

  /**
   * Resolves effective local Hermes home directory
   */
  async resolveHermesHome(): Promise<string | null> {
    if (this.customHermesHome && fs.existsSync(this.customHermesHome)) {
      return this.customHermesHome;
    }
    const info = await this.hermesService.detect();
    if (info && info.homePath && fs.existsSync(info.homePath)) {
      return info.homePath;
    }
    return null;
  }

  private baselinePath(): string | null {
    if (!this.deviceRegistry) return null;
    return path.join(this.deviceRegistry.getStorageDirectory(), `sync-baseline-${this.deviceRegistry.getLocalDevice().deviceId}.json`);
  }

  private localPathFor(relativePath: string, hermesHome: string): string {
    const [category, ...rest] = relativePath.split('/');
    const relative = rest.join('/');
    if (category === 'memories' && (relative === 'SOUL.md' || relative === 'MEMORY.md')) return path.join(hermesHome, relative);
    if (category === 'configs') return path.join(hermesHome, relative);
    return path.join(hermesHome, category, relative);
  }

  private detectRevisionConflicts(hermesHome: string, workspaceRoot: string): ConflictItem[] {
    this.protectedConflictPaths.clear();
    const baselinePath = this.baselinePath();
    if (!baselinePath || !fs.existsSync(baselinePath)) return [];
    let baseline: Record<string, string> = {};
    try { baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')).hashes || {}; } catch { return []; }
    const conflicts: ConflictItem[] = [];
    for (const [relativePath, baselineHash] of Object.entries(baseline)) {
      const localPath = this.localPathFor(relativePath, hermesHome);
      const workspacePath = path.join(workspaceRoot, relativePath);
      const localExists = fs.existsSync(localPath);
      const remoteExists = fs.existsSync(workspacePath);
      const localHash = localExists ? this.workspaceService.calculateFileHash(localPath) : 'deleted';
      const remoteHash = remoteExists ? this.workspaceService.calculateFileHash(workspacePath) : 'deleted';
      if (!(localHash !== baselineHash && remoteHash !== baselineHash && localHash !== remoteHash)) continue;
      const id = `revision-${crypto.createHash('sha256').update(relativePath).digest('hex').slice(0, 12)}`;
      const conflict: ConflictItem = {
        id, filePath: relativePath, detectedAt: new Date().toISOString(), baselineHash,
        state: !localExists || !remoteExists ? 'deleted' : 'both-changed',
        deletionState: !localExists ? 'local-deleted' : !remoteExists ? 'remote-deleted' : 'none',
        originDevice: this.deviceRegistry?.getLocalDevice().deviceName,
        diffPreview: `LOCAL: ${getFileSnippet(localPath)}\nREMOTE: ${getFileSnippet(workspacePath)}`,
        leftVersion: { deviceName: this.deviceRegistry?.getLocalDevice().deviceName || 'Local', modifiedAt: localExists ? fs.statSync(localPath).mtime.toISOString() : new Date().toISOString(), hash: localHash, snippet: getFileSnippet(localPath) },
        rightVersion: { deviceName: 'Managed workspace', modifiedAt: remoteExists ? fs.statSync(workspacePath).mtime.toISOString() : new Date().toISOString(), hash: remoteHash, snippet: getFileSnippet(workspacePath) },
      };
      conflicts.push(conflict); this.activeConflicts.set(id, conflict); this.protectedConflictPaths.add(relativePath);
    }
    return conflicts;
  }

  private saveRevisionBaseline(hermesHome: string, workspaceRoot: string): void {
    const baselinePath = this.baselinePath();
    if (!baselinePath) return;
    let hashes: Record<string, string> = {};
    try { hashes = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')).hashes || {}; } catch {}
    const scan = (directory: string) => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const item = path.join(directory, entry.name);
        if (entry.isDirectory()) scan(item);
        else if (entry.isFile() && !isRestrictedSqliteFile(item)) {
          const relative = path.relative(workspaceRoot, item).replace(/\\/g, '/');
          if (!['skills', 'memories', 'configs'].includes(relative.split('/')[0])) continue;
          const local = this.localPathFor(relative, hermesHome);
          if (!fs.existsSync(local)) continue;
          const workspaceHash = this.workspaceService.calculateFileHash(item);
          if (this.workspaceService.calculateFileHash(local) === workspaceHash) hashes[relative] = workspaceHash;
        }
      }
    };
    scan(workspaceRoot);
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    const temporary = `${baselinePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), hashes }, null, 2), 'utf-8');
    fs.renameSync(temporary, baselinePath);
  }

  /**
   * Stages local skills from <hermesHome>/skills into <workspaceRoot>/skills.
   * Strictly ignores and rejects any SQLite files.
   */
  async stageSkills(
    hermesHome: string,
    workspaceSkillsDir: string,
    dryRun = false,
    forceLocal = false
  ): Promise<SyncFileAction[]> {
    const actions: SyncFileAction[] = [];
    const localSkillsDir = path.join(hermesHome, 'skills');
    if (!fs.existsSync(localSkillsDir)) {
      return actions;
    }

    if (!fs.existsSync(workspaceSkillsDir) && !dryRun) {
      fs.mkdirSync(workspaceSkillsDir, { recursive: true });
    }

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const localPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(localPath);
        } else if (entry.isFile()) {
          // Strictly reject live SQLite database files
          if (isRestrictedSqliteFile(localPath)) {
            continue;
          }

          const relInsideSkills = path.relative(localSkillsDir, localPath).replace(/\\/g, '/');
          const workspaceTarget = path.join(workspaceSkillsDir, relInsideSkills);
          const localStat = fs.statSync(localPath);
          const localHash = this.workspaceService.calculateFileHash(localPath);
          const relWorkspace = `skills/${relInsideSkills}`;

          if (this.protectedConflictPaths.has(relWorkspace)) {
            actions.push({ relativePath: relWorkspace, category: 'skills', action: 'conflict', sha256: localHash, sizeBytes: localStat.size, message: 'Both local and remote changed since the last device baseline.' });
            continue;
          }

          let actionType: SyncFileAction['action'] = 'unchanged';

          if (!fs.existsSync(workspaceTarget)) {
            actionType = 'staged_new';
            if (!dryRun) {
              fs.mkdirSync(path.dirname(workspaceTarget), { recursive: true });
              fs.copyFileSync(localPath, workspaceTarget);
            }
          } else {
            const wsHash = this.workspaceService.calculateFileHash(workspaceTarget);
            const workspaceStat = fs.statSync(workspaceTarget);
            if (localHash !== wsHash && (forceLocal || localStat.mtimeMs >= workspaceStat.mtimeMs)) {
              actionType = 'staged_updated';
              if (!dryRun) {
                fs.copyFileSync(localPath, workspaceTarget);
              }
            }
          }

          actions.push({
            relativePath: relWorkspace,
            category: 'skills',
            action: actionType,
            sha256: localHash,
            sizeBytes: localStat.size,
            message: `Staged skill file: ${relInsideSkills} (${actionType})`,
          });
        }
      }
    };

    scanDir(localSkillsDir);
    return actions;
  }

  /**
   * Stages local memories from <hermesHome>/memories and <hermesHome>/SOUL.md or MEMORY.md
   * into <workspaceRoot>/memories.
   * Strictly ignores and rejects any SQLite files.
   */
  async stageMemories(
    hermesHome: string,
    workspaceMemoriesDir: string,
    dryRun = false,
    forceLocal = false
  ): Promise<SyncFileAction[]> {
    const actions: SyncFileAction[] = [];
    if (!fs.existsSync(workspaceMemoriesDir) && !dryRun) {
      fs.mkdirSync(workspaceMemoriesDir, { recursive: true });
    }

    // 1. Stage root memory files if present (SOUL.md, MEMORY.md)
    const rootFiles = ['SOUL.md', 'MEMORY.md'];
    for (const fileName of rootFiles) {
      const localPath = path.join(hermesHome, fileName);
      if (fs.existsSync(localPath) && !isRestrictedSqliteFile(localPath)) {
        const localStat = fs.statSync(localPath);
        const localHash = this.workspaceService.calculateFileHash(localPath);
        const workspaceTarget = path.join(workspaceMemoriesDir, fileName);
        const relWorkspace = `memories/${fileName}`;

        if (this.protectedConflictPaths.has(relWorkspace)) {
          actions.push({ relativePath: relWorkspace, category: 'memories', action: 'conflict', sha256: localHash, sizeBytes: localStat.size, message: 'Both local and remote changed since the last device baseline.' });
          continue;
        }

        let actionType: SyncFileAction['action'] = 'unchanged';
        if (!fs.existsSync(workspaceTarget)) {
          actionType = 'staged_new';
          if (!dryRun) {
            fs.copyFileSync(localPath, workspaceTarget);
          }
        } else {
          const wsHash = this.workspaceService.calculateFileHash(workspaceTarget);
          const workspaceStat = fs.statSync(workspaceTarget);
          if (localHash !== wsHash && (forceLocal || localStat.mtimeMs >= workspaceStat.mtimeMs)) {
            actionType = 'staged_updated';
            if (!dryRun) {
              fs.copyFileSync(localPath, workspaceTarget);
            }
          }
        }

        actions.push({
          relativePath: relWorkspace,
          category: 'memories',
          action: actionType,
          sha256: localHash,
          sizeBytes: localStat.size,
          message: `Staged memory file: ${fileName} (${actionType})`,
        });
      }
    }

    // 2. Stage files from memories/ subdirectory if present
    const localMemoriesDir = path.join(hermesHome, 'memories');
    if (fs.existsSync(localMemoriesDir)) {
      const scanDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const localPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            scanDir(localPath);
          } else if (entry.isFile()) {
            if (isRestrictedSqliteFile(localPath)) {
              continue;
            }

            const relInside = path.relative(localMemoriesDir, localPath).replace(/\\/g, '/');
            const workspaceTarget = path.join(workspaceMemoriesDir, relInside);
            const localStat = fs.statSync(localPath);
            const localHash = this.workspaceService.calculateFileHash(localPath);
            const relWorkspace = `memories/${relInside}`;

            if (this.protectedConflictPaths.has(relWorkspace)) {
              actions.push({ relativePath: relWorkspace, category: 'memories', action: 'conflict', sha256: localHash, sizeBytes: localStat.size, message: 'Both local and remote changed since the last device baseline.' });
              continue;
            }

            let actionType: SyncFileAction['action'] = 'unchanged';
            if (!fs.existsSync(workspaceTarget)) {
              actionType = 'staged_new';
              if (!dryRun) {
                fs.mkdirSync(path.dirname(workspaceTarget), { recursive: true });
                fs.copyFileSync(localPath, workspaceTarget);
              }
            } else {
              const wsHash = this.workspaceService.calculateFileHash(workspaceTarget);
              const workspaceStat = fs.statSync(workspaceTarget);
              if (localHash !== wsHash && (forceLocal || localStat.mtimeMs >= workspaceStat.mtimeMs)) {
                actionType = 'staged_updated';
                if (!dryRun) {
                  fs.copyFileSync(localPath, workspaceTarget);
                }
              }
            }

            actions.push({
              relativePath: relWorkspace,
              category: 'memories',
              action: actionType,
              sha256: localHash,
              sizeBytes: localStat.size,
              message: `Staged memory file: ${relInside} (${actionType})`,
            });
          }
        }
      };

      scanDir(localMemoriesDir);
    }

    return actions;
  }

  /**
   * Stages configuration files (config.yaml, SOUL.md).
   * Ensures SECRET REDACTION so credentials and API keys are NEVER pushed to the sync workspace.
   * Strictly excludes any live SQLite files.
   */
  async stageConfiguration(
    hermesHome: string,
    workspaceConfigsDir: string,
    dryRun = false
  ): Promise<SyncFileAction[]> {
    const actions: SyncFileAction[] = [];
    if (!fs.existsSync(workspaceConfigsDir) && !dryRun) {
      fs.mkdirSync(workspaceConfigsDir, { recursive: true });
    }

    const configCandidates = ['config.yaml', 'config.json'];
    for (const name of configCandidates) {
      const localPath = path.join(hermesHome, name);
      if (fs.existsSync(localPath) && !isRestrictedSqliteFile(localPath)) {
        const rawContent = fs.readFileSync(localPath, 'utf-8');
        // Redact secrets so API keys, tokens, and bearer tokens are never exposed in sync workspace
        const sanitizedContent = redactSecrets(rawContent);

        const workspaceTarget = path.join(workspaceConfigsDir, name);
        const relWorkspace = `configs/${name}`;

        let actionType: SyncFileAction['action'] = 'unchanged';
        const sanitizedBuffer = Buffer.from(sanitizedContent, 'utf-8');
        const sanitizedHash = `sha256-${crypto.createHash('sha256').update(sanitizedBuffer).digest('hex')}`;

        if (this.protectedConflictPaths.has(relWorkspace)) {
          actions.push({ relativePath: relWorkspace, category: 'configuration', action: 'conflict', sha256: sanitizedHash, sizeBytes: sanitizedBuffer.length, message: 'Both local and remote changed since the last device baseline.' });
          continue;
        }

        if (!fs.existsSync(workspaceTarget)) {
          actionType = 'staged_new';
          if (!dryRun) {
            fs.writeFileSync(workspaceTarget, sanitizedContent, 'utf-8');
          }
        } else {
          const wsHash = this.workspaceService.calculateFileHash(workspaceTarget);
          if (sanitizedHash !== wsHash) {
            actionType = 'staged_updated';
            if (!dryRun) {
              fs.writeFileSync(workspaceTarget, sanitizedContent, 'utf-8');
            }
          }
        }

        actions.push({
          relativePath: relWorkspace,
          category: 'configuration',
          action: actionType,
          sha256: sanitizedHash,
          sizeBytes: sanitizedBuffer.length,
          message: `Staged configuration: ${name} (sanitized, ${actionType})`,
        });
      }
    }

    return actions;
  }

  /**
   * Ingests / applies files from workspace into local Hermes home.
   * If a file exists in the workspace but is missing locally, it is written safely.
   */
  async applyWorkspaceToLocal(
    hermesHome: string,
    workspaceLayout: WorkspaceStatus['layout'],
    dryRun = false
  ): Promise<SyncFileAction[]> {
    const actions: SyncFileAction[] = [];

    // 1. Ingest missing skills
    if (fs.existsSync(workspaceLayout.skills)) {
      const localSkillsDir = path.join(hermesHome, 'skills');
      const scanDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const wsPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            scanDir(wsPath);
          } else if (entry.isFile()) {
            if (isRestrictedSqliteFile(wsPath)) continue;

            const rel = path.relative(workspaceLayout.skills, wsPath).replace(/\\/g, '/');
            const localDest = path.join(localSkillsDir, rel);
            if (this.protectedConflictPaths.has(`skills/${rel}`)) continue;

            const wsStat = fs.statSync(wsPath);
            const wsHash = this.workspaceService.calculateFileHash(wsPath);
            const localMissing = !fs.existsSync(localDest);
            const workspaceIsNewer = !localMissing && wsStat.mtimeMs > fs.statSync(localDest).mtimeMs;
            const contentDiffers = localMissing || this.workspaceService.calculateFileHash(localDest) !== wsHash;

            if (contentDiffers && (localMissing || workspaceIsNewer)) {
              if (!dryRun) {
                fs.mkdirSync(path.dirname(localDest), { recursive: true });
                fs.copyFileSync(wsPath, localDest);
              }

              actions.push({
                relativePath: `skills/${rel}`,
                category: 'skills',
                action: 'applied_to_local',
                sha256: wsHash,
                sizeBytes: wsStat.size,
                message: `Applied missing workspace skill to local Hermes: skills/${rel}`,
              });
            }
          }
        }
      };

      scanDir(workspaceLayout.skills);
    }

    // 2. Ingest missing memories
    if (fs.existsSync(workspaceLayout.memories)) {
      const localMemoriesDir = path.join(hermesHome, 'memories');
      const scanMemories = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const wsPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanMemories(wsPath);
            continue;
          }
          if (!entry.isFile() || isRestrictedSqliteFile(wsPath)) continue;

          const relative = path.relative(workspaceLayout.memories, wsPath).replace(/\\/g, '/');
          const localDest = relative === 'SOUL.md' || relative === 'MEMORY.md'
            ? path.join(hermesHome, relative)
            : path.join(localMemoriesDir, relative);
          if (this.protectedConflictPaths.has(`memories/${relative}`)) continue;
          const wsStat = fs.statSync(wsPath);
          const wsHash = this.workspaceService.calculateFileHash(wsPath);
          const localMissing = !fs.existsSync(localDest);
          const workspaceIsNewer = !localMissing && wsStat.mtimeMs > fs.statSync(localDest).mtimeMs;
          const contentDiffers = localMissing || this.workspaceService.calculateFileHash(localDest) !== wsHash;

          if (contentDiffers && (localMissing || workspaceIsNewer)) {
            if (!dryRun) {
              fs.mkdirSync(path.dirname(localDest), { recursive: true });
              fs.copyFileSync(wsPath, localDest);
            }
            actions.push({
              relativePath: `memories/${relative}`,
              category: 'memories',
              action: 'applied_to_local',
              sha256: wsHash,
              sizeBytes: wsStat.size,
              message: `Applied newer workspace memory to local Hermes: ${relative}`,
            });
          }
        }
      };
      scanMemories(workspaceLayout.memories);
    }

    return actions;
  }

  /**
   * Copies the published Main PC baseline into the local Hermes file tree.
   * The caller must create a backup and obtain explicit user confirmation first.
   * Live databases, secrets, Vault data, and sanitized shared configuration are not applied.
   */
  async adoptWorkspaceBaseline(): Promise<{ filesCopied: number; actions: SyncFileAction[] }> {
    const hermesHome = await this.resolveHermesHome();
    if (!hermesHome) throw new Error('Hermes home could not be found on this PC.');
    const status = await this.workspaceService.initWorkspace();
    const actions: SyncFileAction[] = [];

    const copyTree = (sourceRoot: string, targetRoot: string, category: 'skills' | 'memories') => {
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
          let target = path.join(targetRoot, relative);
          if (category === 'memories' && (relative === 'SOUL.md' || relative === 'MEMORY.md')) {
            target = path.join(hermesHome, relative);
          }
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(source, target);
          const stat = fs.statSync(source);
          actions.push({
            relativePath: `${category}/${relative.replace(/\\/g, '/')}`,
            category,
            action: 'applied_to_local',
            sha256: this.workspaceService.calculateFileHash(source),
            sizeBytes: stat.size,
            message: `Copied Main PC baseline file: ${relative.replace(/\\/g, '/')}`,
          });
        }
      };
      scan(sourceRoot);
    };

    copyTree(status.layout.skills, path.join(hermesHome, 'skills'), 'skills');
    copyTree(status.layout.memories, path.join(hermesHome, 'memories'), 'memories');
    return { filesCopied: actions.length, actions };
  }

  /** Moves stale workspace files that do not exist on the chosen Main PC into a
   * recoverable snapshot area so they cannot leak into the new baseline. */
  private quarantineWorkspaceOrphans(hermesHome: string, layout: WorkspaceStatus['layout']): number {
    const quarantineRoot = path.join(layout.snapshots, `pre-baseline-orphans-${Date.now()}`);
    let moved = 0;
    const categories: Array<{ workspaceRoot: string; localRoot: string; category: string }> = [
      { workspaceRoot: layout.skills, localRoot: path.join(hermesHome, 'skills'), category: 'skills' },
      { workspaceRoot: layout.memories, localRoot: path.join(hermesHome, 'memories'), category: 'memories' },
    ];

    for (const { workspaceRoot, localRoot, category } of categories) {
      if (!fs.existsSync(workspaceRoot)) continue;
      const scan = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const workspacePath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(workspacePath);
            continue;
          }
          if (!entry.isFile()) continue;
          const relative = path.relative(workspaceRoot, workspacePath);
          const localPath = category === 'memories' && (relative === 'SOUL.md' || relative === 'MEMORY.md')
            ? path.join(hermesHome, relative)
            : path.join(localRoot, relative);
          if (fs.existsSync(localPath)) continue;
          const destination = path.join(quarantineRoot, category, relative);
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.renameSync(workspacePath, destination);
          moved++;
        }
      };
      scan(workspaceRoot);
    }
    return moved;
  }

  /**
   * Detects conflicts across the workspace and local files.
   * Includes Syncthing collision files (*.sync-conflict-*) and divergent revisions.
   */
  async detectConflicts(
    workspaceRoot: string,
    hermesHome: string,
    layout: WorkspaceStatus['layout'],
    existing: ConflictItem[] = []
  ): Promise<ConflictItem[]> {
    const conflicts: ConflictItem[] = [...existing];
    const localDev = this.deviceRegistry ? this.deviceRegistry.getLocalDevice() : { deviceName: 'Local' };

    // 1. Scan for Syncthing conflict files (*.sync-conflict-*)
    const checkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(full);
        } else if (entry.isFile() && entry.name.includes('.sync-conflict-')) {
          // Identify the original file
          const originalName = entry.name.replace(/\.sync-conflict-[^.]+/i, '');
          const originalPath = path.join(dir, originalName);

          const conflictId = `conf-${crypto.createHash('md5').update(full).digest('hex').slice(0, 8)}`;
          const relPath = path.relative(workspaceRoot, originalPath).replace(/\\/g, '/');

          const origStat = fs.existsSync(originalPath) ? fs.statSync(originalPath) : null;
          const conflictStat = fs.statSync(full);

          const origHash = fs.existsSync(originalPath)
            ? this.workspaceService.calculateFileHash(originalPath)
            : 'missing';
          const conflictHash = this.workspaceService.calculateFileHash(full);

          const conflictItem: ConflictItem = {
            id: conflictId,
            filePath: relPath,
            detectedAt: new Date().toISOString(),
            state: 'transport-conflict',
            originDevice: 'Remote Syncthing Peer',
            deletionState: 'none',
            diffPreview: `LOCAL: ${getFileSnippet(originalPath)}\nREMOTE: ${getFileSnippet(full)}`,
            leftVersion: {
              deviceName: localDev.deviceName || 'Local Device',
              modifiedAt: origStat ? origStat.mtime.toISOString() : new Date().toISOString(),
              hash: origHash,
              snippet: getFileSnippet(originalPath),
            },
            rightVersion: {
              deviceName: 'Remote Syncthing Peer',
              modifiedAt: conflictStat.mtime.toISOString(),
              hash: conflictHash,
              snippet: getFileSnippet(full),
            },
          };

          conflicts.push(conflictItem);
          this.activeConflicts.set(conflictId, conflictItem);
        }
      }
    };

    checkDir(layout.skills);
    checkDir(layout.memories);
    checkDir(layout.configs);

    // Save detected conflicts to workspace manifests
    const conflictsFile = path.join(layout.manifests, 'conflicts.json');
    try {
      fs.writeFileSync(conflictsFile, JSON.stringify(conflicts, null, 2), 'utf-8');
    } catch {}

    return conflicts;
  }

  /**
   * Resolves an identified conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'use_local' | 'use_remote' | 'keep_both'
  ): Promise<{ success: boolean; message: string; recoveryArtifactPath?: string }> {
    const layout = this.workspaceService.getLayout();
    const root = this.workspaceService.getRootPath();
    const conflictsFile = path.join(layout.manifests, 'conflicts.json');

    let conflict = this.activeConflicts.get(conflictId);
    if (!conflict && fs.existsSync(conflictsFile)) {
      try {
        const stored: ConflictItem[] = JSON.parse(fs.readFileSync(conflictsFile, 'utf-8'));
        conflict = stored.find((c) => c.id === conflictId);
      } catch {}
    }

    if (!conflict) {
      return { success: false, message: `Conflict ${conflictId} not found` };
    }

    const basePath = path.join(root, conflict.filePath);
    const hermesHome = await this.resolveHermesHome();
    const localOriginalPath = conflict.state && conflict.state !== 'transport-conflict' && hermesHome
      ? this.localPathFor(conflict.filePath, hermesHome)
      : basePath;
    const dir = path.dirname(basePath);
    const ext = path.extname(basePath);
    const baseStem = path.basename(basePath, ext);

    // Find any matching .sync-conflict- file
    let conflictFilePath: string | null = null;
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.startsWith(baseStem) && f.includes('.sync-conflict-')) {
          conflictFilePath = path.join(dir, f);
          break;
        }
      }
    }

    const recoveryDirectory = path.join(layout.snapshots, `conflict-recovery-${Date.now()}-${conflictId}`);
    fs.mkdirSync(recoveryDirectory, { recursive: true });
    if (fs.existsSync(localOriginalPath)) fs.copyFileSync(localOriginalPath, path.join(recoveryDirectory, `local${ext || '.txt'}`));
    const remoteOriginalPath = conflict.state && conflict.state !== 'transport-conflict' ? basePath : conflictFilePath;
    if (remoteOriginalPath && fs.existsSync(remoteOriginalPath)) fs.copyFileSync(remoteOriginalPath, path.join(recoveryDirectory, `remote${ext || '.txt'}`));
    fs.writeFileSync(path.join(recoveryDirectory, 'conflict.json'), JSON.stringify({ ...conflict, selectedResolution: resolution, preservedAt: new Date().toISOString() }, null, 2), 'utf-8');

    if (conflict.state && conflict.state !== 'transport-conflict') {
      if (!hermesHome) throw new Error('Hermes home is unavailable for conflict resolution.');
      if (resolution === 'use_local') {
        if (!fs.existsSync(localOriginalPath)) {
          if (fs.existsSync(basePath)) fs.unlinkSync(basePath);
          this.recordTombstone(conflict.filePath, 'local', conflict.baselineHash);
        } else {
          fs.mkdirSync(path.dirname(basePath), { recursive: true });
          fs.copyFileSync(localOriginalPath, basePath);
        }
      } else if (resolution === 'use_remote') {
        if (!fs.existsSync(basePath)) {
          if (fs.existsSync(localOriginalPath)) fs.unlinkSync(localOriginalPath);
          this.recordTombstone(conflict.filePath, 'remote', conflict.baselineHash);
        } else {
          fs.mkdirSync(path.dirname(localOriginalPath), { recursive: true });
          fs.copyFileSync(basePath, localOriginalPath);
        }
      } else {
        if (fs.existsSync(basePath)) fs.copyFileSync(basePath, path.join(path.dirname(localOriginalPath), `${path.basename(localOriginalPath, ext)}.remote-${Date.now()}${ext}`));
        if (fs.existsSync(localOriginalPath)) { fs.mkdirSync(path.dirname(basePath), { recursive: true }); fs.copyFileSync(localOriginalPath, basePath); }
      }
    } else if (resolution === 'use_local') {
      // Keep base file, delete conflict copy
      if (conflictFilePath && fs.existsSync(conflictFilePath)) {
        fs.unlinkSync(conflictFilePath);
      }
    } else if (resolution === 'use_remote') {
      // Replace base file with conflict file
      if (conflictFilePath && fs.existsSync(conflictFilePath)) {
        fs.copyFileSync(conflictFilePath, basePath);
        fs.unlinkSync(conflictFilePath);
      }
    } else if (resolution === 'keep_both') {
      // Rename conflict file to a permanent historical copy
      if (conflictFilePath && fs.existsSync(conflictFilePath)) {
        const ext = path.extname(basePath);
        const nameWithoutExt = path.basename(basePath, ext);
        const targetArchive = path.join(dir, `${nameWithoutExt}.remote-${Date.now()}${ext}`);
        fs.renameSync(conflictFilePath, targetArchive);
      }
    }

    // Remove from active conflicts list
    this.activeConflicts.delete(conflictId);
    let remainingConflicts: ConflictItem[] = [];
    if (fs.existsSync(conflictsFile)) {
      try {
        const stored: ConflictItem[] = JSON.parse(fs.readFileSync(conflictsFile, 'utf-8'));
        remainingConflicts = stored.filter((c) => c.id !== conflictId);
        fs.writeFileSync(conflictsFile, JSON.stringify(remainingConflicts, null, 2), 'utf-8');
      } catch {}
    }

    // Regenerate workspace manifest
    await this.workspaceService.generateManifest();

    return {
      success: true,
      message: `Conflict for ${conflict.filePath} successfully resolved using ${resolution}. Recovery copy: ${recoveryDirectory}`,
      recoveryArtifactPath: recoveryDirectory,
    };
  }

  private recordTombstone(relativePath: string, origin: 'local' | 'remote', baselineHash?: string): void {
    const tombstonesPath = path.join(this.workspaceService.getLayout().manifests, 'tombstones.json');
    let tombstones: Array<{ relativePath: string; deletedAt: string; origin: string; baselineHash?: string }> = [];
    try { tombstones = JSON.parse(fs.readFileSync(tombstonesPath, 'utf-8')); } catch {}
    tombstones = [{ relativePath, deletedAt: new Date().toISOString(), origin, baselineHash }, ...tombstones.filter((item) => item.relativePath !== relativePath)].slice(0, 2_000);
    fs.mkdirSync(path.dirname(tombstonesPath), { recursive: true });
    const temporary = `${tombstonesPath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(tombstones, null, 2), 'utf-8');
    fs.renameSync(temporary, tombstonesPath);
  }

  /**
   * Executes a complete, safe file-based synchronization cycle.
   * Stages skills, memories, and sanitized configurations, rejects live SQLite WAL files,
   * updates workspace manifests, triggers Syncthing rescan, and updates device registry.
   */
  async executeSyncCycle(options: SyncCycleOptions = {}): Promise<SyncCycleResult> {
    const startedAt = new Date().toISOString();
    const cycleId = `cycle-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const categories: SyncCategory[] = options.categories || ['skills', 'memories', 'configuration'];
    const dryRun = !!options.dryRun;

    // Ensure workspace layout is initialized
    const status = await this.workspaceService.initWorkspace();
    const layout = status.layout;
    const hermesHome = await this.resolveHermesHome();

    const actions: SyncFileAction[] = [];
    let skillsStaged = 0;
    let memoriesStaged = 0;
    let configsStaged = 0;

    let bytesUploaded = 0;
    let bytesDownloaded = 0;
    if (options.force) this.protectedConflictPaths.clear();
    const revisionConflicts = hermesHome && !options.force ? this.detectRevisionConflicts(hermesHome, this.workspaceService.getRootPath()) : [];

    if (hermesHome) {
      if (options.force && !dryRun) {
        this.quarantineWorkspaceOrphans(hermesHome, layout);
      }
      // 1. Stage Skills
      if (categories.includes('skills')) {
        const skillActions = await this.stageSkills(hermesHome, layout.skills, dryRun, !!options.force);
        actions.push(...skillActions);
        skillsStaged = skillActions.filter((a) => a.action.startsWith('staged')).length;
        for (const act of skillActions) {
          if (act.action.startsWith('staged')) bytesUploaded += act.sizeBytes;
        }
      }

      // 2. Stage Memories
      if (categories.includes('memories')) {
        const memoryActions = await this.stageMemories(hermesHome, layout.memories, dryRun, !!options.force);
        actions.push(...memoryActions);
        memoriesStaged = memoryActions.filter((a) => a.action.startsWith('staged')).length;
        for (const act of memoryActions) {
          if (act.action.startsWith('staged')) bytesUploaded += act.sizeBytes;
        }
      }

      // 3. Stage Configurations
      if (categories.includes('configuration')) {
        const configActions = await this.stageConfiguration(hermesHome, layout.configs, dryRun);
        actions.push(...configActions);
        configsStaged = configActions.filter((a) => a.action.startsWith('staged')).length;
        for (const act of configActions) {
          if (act.action.startsWith('staged')) bytesUploaded += act.sizeBytes;
        }
      }

      // 4. Ingest missing workspace files to local Hermes
      const appliedActions = options.force ? [] : await this.applyWorkspaceToLocal(hermesHome, layout, dryRun);
      actions.push(...appliedActions);
      for (const act of appliedActions) {
        bytesDownloaded += act.sizeBytes;
      }
    }

    // 5. Regenerate deterministic ClusterManifest if files were staged
    if (!dryRun) {
      await this.workspaceService.generateManifest();
    }

    // 6. Trigger Syncthing rescan if adapter available
    if (this.syncthingAdapter && !dryRun) {
      try {
        const isRunning = await this.syncthingAdapter.isRunning();
        if (isRunning) {
          await this.syncthingAdapter.rescanFolder();
        }
      } catch {}
    }

    // 7. Detect conflicts
    const conflicts = await this.detectConflicts(
      this.workspaceService.getRootPath(),
      hermesHome || '',
      layout,
      revisionConflicts
    );
    if (hermesHome && !dryRun) this.saveRevisionBaseline(hermesHome, this.workspaceService.getRootPath());

    const completedAt = new Date().toISOString();
    const transferredCount = actions.filter((a) => a.action !== 'unchanged').length;

    const summary: DeviceSyncSummary = {
      lastSync: completedAt,
      pendingFiles: conflicts.length,
      filesTransferred: transferredCount,
      bytesUploaded,
      bytesDownloaded,
      conflicts: conflicts.length,
      status: conflicts.length > 0 ? 'conflict' : 'in-sync',
    };

    this.lastSummary = summary;

    // 8. Update Device Registry with latest sync and data metrics
    if (this.deviceRegistry && !dryRun) {
      try {
        const localDev = this.deviceRegistry.getLocalDevice();
        localDev.sync = {
          ...summary,
          filesTransferred: (localDev.sync?.filesTransferred || 0) + transferredCount,
          bytesUploaded: (localDev.sync?.bytesUploaded || 0) + bytesUploaded,
          bytesDownloaded: (localDev.sync?.bytesDownloaded || 0) + bytesDownloaded,
        };

        if (hermesHome) {
          const hermesStatus = await this.hermesService.getStatus();
          localDev.data = {
            sessions: hermesStatus.stats.sessionsCount || 0,
            memories: hermesStatus.stats.memoriesCount || 0,
            skills: hermesStatus.stats.skillsCount || 0,
            totalSizeBytes: hermesStatus.stats.totalSizeBytes || 0,
          };
        }

        await this.deviceRegistry.updateDevice(localDev.deviceId, {
          sync: localDev.sync,
          data: localDev.data,
        });
      } catch {}
    }

    return {
      success: true,
      cycleId,
      startedAt,
      completedAt,
      summary,
      actions,
      conflicts,
      stagedCounts: {
        skills: skillsStaged,
        memories: memoriesStaged,
        configs: configsStaged,
      },
    };
  }

  /**
   * Retrieves active summary of synchronization
   */
  async getSyncSummary(): Promise<DeviceSyncSummary> {
    const layout = this.workspaceService.getLayout();
    const conflictsFile = path.join(layout.manifests, 'conflicts.json');
    let conflictsCount = this.activeConflicts.size;

    if (fs.existsSync(conflictsFile)) {
      try {
        const stored: ConflictItem[] = JSON.parse(fs.readFileSync(conflictsFile, 'utf-8'));
        conflictsCount = stored.length;
      } catch {}
    }

    return {
      ...this.lastSummary,
      conflicts: conflictsCount,
      pendingFiles: conflictsCount,
      status: conflictsCount > 0 ? 'conflict' : this.lastSummary.status,
    };
  }

  /**
   * Retrieves active conflicts
   */
  async getConflicts(): Promise<ConflictItem[]> {
    const layout = this.workspaceService.getLayout();
    const conflictsFile = path.join(layout.manifests, 'conflicts.json');
    if (fs.existsSync(conflictsFile)) {
      try {
        return JSON.parse(fs.readFileSync(conflictsFile, 'utf-8'));
      } catch {}
    }
    return Array.from(this.activeConflicts.values());
  }
}
