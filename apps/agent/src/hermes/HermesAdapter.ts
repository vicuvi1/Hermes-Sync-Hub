import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import {
  HermesSession,
  HermesMemory,
  UpdateHermesMemoryInput,
  HermesSkill,
  HermesFile,
  DeviceHermesState,
} from '@hermes-hub/types';
import { HermesDiscoveryService } from '../discovery/HermesDiscovery.js';

const execFileAsync = promisify(execFile);

export interface HermesInstallationInfo {
  homePath: string;
  configPath?: string;
  executablePath?: string;
  version: string;
  profile: string;
  detectedDatabases: string[];
}

export interface HermesStatus {
  isInstalled: boolean;
  isRunning: boolean;
  pid?: number;
  homeDirectory: string;
  version: string;
  profile: string;
  executablePath?: string;
  stats: {
    sessionsCount: number;
    skillsCount: number;
    memoriesCount: number;
    totalSizeBytes: number;
    lastActivityAt?: string;
  };
  detectedDatabases: string[];
}

export interface IHermesService {
  detect(): Promise<HermesInstallationInfo | null>;
  getStatus(): Promise<HermesStatus>;
  getSessions(): Promise<HermesSession[]>;
  getMemories(): Promise<HermesMemory[]>;
  updateMemory(input: UpdateHermesMemoryInput): Promise<HermesMemory>;
  getSkills(): Promise<HermesSkill[]>;
  getConfigFiles(): Promise<HermesFile[]>;
}

export class HermesService implements IHermesService {
  private discovery: HermesDiscoveryService;
  private cachedInstallation: HermesInstallationInfo | null = null;
  private manualHome?: string;

  constructor(manualHome?: string, discovery?: HermesDiscoveryService) {
    this.manualHome = manualHome;
    this.discovery = discovery || new HermesDiscoveryService(manualHome);
  }

  /**
   * Non-destructively detects Hermes installation and environment
   */
  async detect(): Promise<HermesInstallationInfo | null> {
    if (this.cachedInstallation) {
      return this.cachedInstallation;
    }

    const home = this.manualHome || this.discovery.findHermesHome();
    if (!home || !fs.existsSync(home)) {
      return null;
    }

    const executablePath = this.discovery.findHermesExecutable(home) || undefined;
    const configPath = path.join(home, 'config.yaml');
    const hasConfig = fs.existsSync(configPath);

    // Read or probe version
    const version = await this.probeVersion(executablePath, home);

    // Identify detected database files
    const candidateDbs = ['state.db', 'kanban.db', 'projects.db'];
    const detectedDatabases = candidateDbs.filter((db) => fs.existsSync(path.join(home, db)));

    const installation: HermesInstallationInfo = {
      homePath: home,
      configPath: hasConfig ? configPath : undefined,
      executablePath,
      version,
      profile: 'default',
      detectedDatabases,
    };

    this.cachedInstallation = installation;
    return installation;
  }

  /**
   * Safely reads version from CLI or directory artifacts
   */
  private async probeVersion(exePath?: string, home?: string): Promise<string> {
    if (exePath) {
      try {
        const { stdout } = await execFileAsync(exePath, ['--version'], { timeout: 3000 });
        const match = stdout.match(/Hermes Agent v([0-9a-zA-Z.+_-]+)/i);
        if (match && match[1]) {
          return match[1];
        }
      } catch {
        // Fallback to file checks
      }
    }

    // Inspect package.json inside hermes-agent if cloned via git
    if (home) {
      const packagePath = path.join(home, 'hermes-agent', 'package.json');
      if (fs.existsSync(packagePath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
          if (pkg.version) return pkg.version;
        } catch {}
      }

      // Check pyproject.toml / version files
      const pyprojectPath = path.join(home, 'hermes-agent', 'pyproject.toml');
      if (fs.existsSync(pyprojectPath)) {
        try {
          const content = fs.readFileSync(pyprojectPath, 'utf-8');
          const match = content.match(/version\s*=\s*["']([^"']+)["']/);
          if (match && match[1]) return match[1];
        } catch {}
      }
    }

    return '0.21.5';
  }

  /**
   * Safely inspects whether Hermes process or active lockfiles are active
   */
  async isRunning(home: string): Promise<{ isRunning: boolean; pid?: number }> {
    // Check processes.json in home
    const processesFile = path.join(home, 'processes.json');
    if (fs.existsSync(processesFile)) {
      try {
        const content = fs.readFileSync(processesFile, 'utf-8');
        const list = JSON.parse(content);
        if (Array.isArray(list) && list.length > 0) {
          return { isRunning: true, pid: list[0]?.pid };
        }
      } catch {}
    }

    // Check lockfiles
    const lockfiles = ['.install_id.lock', 'state.db.auto-maintenance.lock', 'auth.lock'];
    for (const lock of lockfiles) {
      if (fs.existsSync(path.join(home, lock))) {
        return { isRunning: true };
      }
    }

    return { isRunning: false };
  }

  /**
   * Returns complete Hermes runtime and data status
   */
  async getStatus(): Promise<HermesStatus> {
    const install = await this.detect();
    if (!install) {
      return {
        isInstalled: false,
        isRunning: false,
        homeDirectory: '',
        version: 'unknown',
        profile: 'default',
        stats: {
          sessionsCount: 0,
          skillsCount: 0,
          memoriesCount: 0,
          totalSizeBytes: 0,
        },
        detectedDatabases: [],
      };
    }

    const runningState = await this.isRunning(install.homePath);
    const stats = this.inspectMetadata(install.homePath);

    return {
      isInstalled: true,
      isRunning: runningState.isRunning,
      pid: runningState.pid,
      homeDirectory: install.homePath,
      version: install.version,
      profile: install.profile,
      executablePath: install.executablePath,
      stats,
      detectedDatabases: install.detectedDatabases,
    };
  }

  /**
   * Non-destructive inspection of sessions, skills, memories, and directory byte size
   */
  private inspectMetadata(home: string) {
    let sessionsCount = 0;
    let skillsCount = 0;
    let memoriesCount = 0;
    let totalSizeBytes = 0;
    let latestMtime = 0;

    // 1. Inspect sessions
    const sessionsDir = path.join(home, 'sessions');
    if (fs.existsSync(sessionsDir)) {
      try {
        const files = fs.readdirSync(sessionsDir);
        sessionsCount = files.filter((f) => !f.startsWith('.')).length;
        for (const file of files) {
          try {
            const st = fs.statSync(path.join(sessionsDir, file));
            totalSizeBytes += st.size;
            if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
          } catch {}
        }
      } catch {}
    }

    // 2. Inspect skills
    const skillsDir = path.join(home, 'skills');
    if (fs.existsSync(skillsDir)) {
      try {
        const entries = fs.readdirSync(skillsDir);
        skillsCount = entries.filter((e) => {
          if (e.startsWith('.')) return false;
          try {
            return fs.statSync(path.join(skillsDir, e)).isDirectory();
          } catch {
            return false;
          }
        }).length;

        for (const entry of entries) {
          try {
            const entryPath = path.join(skillsDir, entry);
            const st = fs.statSync(entryPath);
            totalSizeBytes += st.size;
            if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
          } catch {}
        }
      } catch {}
    }

    // 3. Inspect memories & SOUL.md
    const soulFile = path.join(home, 'SOUL.md');
    if (fs.existsSync(soulFile)) {
      try {
        const st = fs.statSync(soulFile);
        memoriesCount += 1;
        totalSizeBytes += st.size;
        if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
      } catch {}
    }

    const memoriesDir = path.join(home, 'memories');
    if (fs.existsSync(memoriesDir)) {
      try {
        const memFiles = fs.readdirSync(memoriesDir);
        memoriesCount += memFiles.filter((f) => !f.startsWith('.')).length;
        for (const f of memFiles) {
          try {
            const st = fs.statSync(path.join(memoriesDir, f));
            totalSizeBytes += st.size;
            if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
          } catch {}
        }
      } catch {}
    }

    // Include database sizes
    for (const db of ['state.db', 'kanban.db', 'projects.db']) {
      const p = path.join(home, db);
      if (fs.existsSync(p)) {
        try {
          const st = fs.statSync(p);
          totalSizeBytes += st.size;
          if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
        } catch {}
      }
    }

    return {
      sessionsCount,
      skillsCount,
      memoriesCount,
      totalSizeBytes,
      lastActivityAt: latestMtime > 0 ? new Date(latestMtime).toISOString() : undefined,
    };
  }

  /**
   * Reads skill definitions non-destructively
   */
  async getSkills(): Promise<HermesSkill[]> {
    const install = await this.detect();
    if (!install) return [];

    const skillsDir = path.join(install.homePath, 'skills');
    if (!fs.existsSync(skillsDir)) return [];

    const results: HermesSkill[] = [];
    try {
      const dirs = fs.readdirSync(skillsDir);
      let idx = 1;

      for (const dirName of dirs) {
        if (dirName.startsWith('.')) continue;
        const fullDir = path.join(skillsDir, dirName);
        try {
          const stat = fs.statSync(fullDir);
          if (!stat.isDirectory()) continue;

          let fileCount = 0;
          let latestModified = stat.mtimeMs;
          const pending = [fullDir];
          while (pending.length) {
            const directory = pending.pop()!;
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
              const entryPath = path.join(directory, entry.name);
              if (entry.isDirectory()) pending.push(entryPath);
              else if (entry.isFile()) {
                fileCount += 1;
                try { latestModified = Math.max(latestModified, fs.statSync(entryPath).mtimeMs); } catch {}
              }
            }
          }

          let description = `Hermes Agent capability module located in skills/${dirName}`;
          const skillReadme = ['SKILL.md', 'README.md'].map((name) => path.join(fullDir, name)).find((file) => fs.existsSync(file));
          if (skillReadme) {
            const text = fs.readFileSync(skillReadme, 'utf-8');
            const summary = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith('#') && !line.startsWith('---'));
            if (summary) description = summary.slice(0, 240);
          }

          results.push({
            id: `skill-${idx++}`,
            name: dirName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            description,
            filesCount: fileCount,
            lastModified: new Date(latestModified).toISOString(),
            originDevice: 'local',
            originDeviceName: 'Local Machine',
            revision: 1,
            devicesWithRevision: ['local'],
            tags: ['Discovered', 'Active'],
          });
        } catch {}
      }
    } catch {}

    return results;
  }

  /**
   * Reads memory references non-destructively
   */
  async getMemories(): Promise<HermesMemory[]> {
    const install = await this.detect();
    if (!install) return [];

    const results: HermesMemory[] = [];
    const candidates: string[] = [];
    for (const rootName of ['SOUL.md', 'MEMORY.md']) {
      const candidate = path.join(install.homePath, rootName);
      if (fs.existsSync(candidate)) candidates.push(candidate);
    }
    const memoriesDirectory = path.join(install.homePath, 'memories');
    if (fs.existsSync(memoriesDirectory)) {
      const pending = [memoriesDirectory];
      while (pending.length) {
        const directory = pending.pop()!;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const entryPath = path.join(directory, entry.name);
          if (entry.isDirectory()) pending.push(entryPath);
          else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) candidates.push(entryPath);
        }
      }
    }

    for (const memoryPath of candidates) {
      try {
        const stat = fs.statSync(memoryPath);
        if (stat.size > 2 * 1024 * 1024) continue;
        const relative = path.relative(install.homePath, memoryPath).replace(/\\/g, '/');
        results.push({
          id: relative === 'SOUL.md' ? 'mem-soul' : `mem-${crypto.createHash('sha256').update(relative).digest('hex').slice(0, 16)}`,
          title: relative,
          path: memoryPath,
          updatedAt: new Date(stat.mtimeMs).toISOString(),
          originDevice: 'local',
          originDeviceName: 'Local Machine',
          revision: 1,
          content: fs.readFileSync(memoryPath, 'utf-8'),
          devicesWithRevision: ['local'],
          isLatest: true,
        });
      } catch {}
    }

    return results;
  }

  /**
   * Updates a discovered Hermes Markdown memory using an atomic replacement.
   * The caller must create a recovery artifact before invoking this method.
   */
  async updateMemory(input: UpdateHermesMemoryInput): Promise<HermesMemory> {
    const install = await this.detect();
    if (!install) throw new Error('Hermes is not installed or its home directory is unavailable.');

    const memories = await this.getMemories();
    const current = memories.find((memory) => memory.id === input.id);
    if (!current) throw new Error('The selected Hermes memory no longer exists. Refresh and try again.');
    if (current.updatedAt !== input.expectedUpdatedAt) {
      throw new Error('This memory changed outside Hermes Hub. Reload it before saving so newer changes are not overwritten.');
    }

    const relative = path.relative(install.homePath, current.path);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(current.path).toLowerCase() !== '.md') {
      throw new Error('Hermes Hub can only edit discovered Markdown memories inside the active Hermes home.');
    }

    const temporaryPath = `${current.path}.hermes-hub-${process.pid}-${Date.now()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, input.content, { encoding: 'utf-8', flag: 'wx' });
      fs.renameSync(temporaryPath, current.path);
    } finally {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }

    const updated = (await this.getMemories()).find((memory) => memory.id === input.id);
    if (!updated) throw new Error('Hermes memory was saved but could not be reloaded.');
    return updated;
  }

  /**
   * Reads session dump files non-destructively
   */
  async getSessions(): Promise<HermesSession[]> {
    const install = await this.detect();
    if (!install) return [];

    const sessionsDir = path.join(install.homePath, 'sessions');
    if (!fs.existsSync(sessionsDir)) return [];

    const results: HermesSession[] = [];
    try {
      const files = fs.readdirSync(sessionsDir);
      let idx = 1;

      for (const fileName of files) {
        if (!fileName.startsWith('.') && fileName.endsWith('.json')) {
          const filePath = path.join(sessionsDir, fileName);
          try {
            const stat = fs.statSync(filePath);
            const raw = fs.readFileSync(filePath, 'utf-8');
            let data: any = {};
            try { data = JSON.parse(raw); } catch {}

            const sessionId = data.session_id || `sess-${idx++}`;
            const messages = data.request?.body?.messages || data.messages || [];
            const model = data.request?.body?.model || data.model || 'openrouter/deepseek/deepseek-v4-flash';

            let firstPrompt = '';
            for (const m of messages) {
              if (m.role === 'user' && m.content) {
                firstPrompt = typeof m.content === 'string' ? m.content.slice(0, 100) : '';
                break;
              }
            }

            const title = firstPrompt
              ? firstPrompt.replace(/[\r\n]+/g, ' ')
              : fileName.replace('request_dump_', 'Session ').replace('.json', '');

            results.push({
              id: sessionId,
              title,
              createdAt: data.timestamp || new Date(stat.birthtimeMs || stat.mtimeMs).toISOString(),
              updatedAt: new Date(stat.mtimeMs).toISOString(),
              messagesCount: messages.length || 1,
              model,
              originDevice: 'local',
              originDeviceName: 'Local Machine',
              revision: 1,
              syncStatus: 'synced',
              previewText: firstPrompt || `Discovered session archive at sessions/${fileName}`,
            });
          } catch {}
        }
      }
    } catch {}

    return results;
  }

  /**
   * Reads core Hermes configuration files non-destructively
   */
  async getConfigFiles(): Promise<HermesFile[]> {
    const install = await this.detect();
    if (!install) return [];

    const results: HermesFile[] = [];
    const classify = (relative: string): HermesFile['category'] => {
      const normalized = relative.replace(/\\/g, '/').toLowerCase();
      if (normalized.endsWith('.md') && (normalized.includes('memory') || normalized === 'soul.md')) return 'Memories';
      if (normalized.startsWith('skills/')) return 'Skills';
      if (normalized.startsWith('sessions/') || normalized.startsWith('pastes/')) return 'Sessions/Exports';
      if (normalized.startsWith('logs/')) return 'Logs';
      if (/\.(ya?ml|json|toml|env|ini)$/.test(normalized) || normalized === '.env') return 'Configuration';
      return 'Other';
    };
    const pending = [install.homePath];
    const maximumFiles = 10_000;
    const generatedDirectories = new Set(['node', 'cache', 'audio_cache', 'image_cache', 'bootstrap-cache', 'installs', 'runtime', 'bin', 'hermes-agent', 'tools']);
    while (pending.length && results.length < maximumFiles) {
      const directory = pending.pop()!;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (results.length >= maximumFiles) break;
        const entryPath = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          const relativeDirectory = path.relative(install.homePath, entryPath).replace(/\\/g, '/');
          if (!relativeDirectory.includes('/') && generatedDirectories.has(relativeDirectory.toLowerCase())) continue;
          pending.push(entryPath);
          continue;
        }
        if (!entry.isFile()) continue;
        try {
          const stat = fs.statSync(entryPath);
          const relative = path.relative(install.homePath, entryPath).replace(/\\/g, '/');
          results.push({
            id: `file-${crypto.createHash('sha256').update(relative).digest('hex').slice(0, 16)}`,
            name: relative,
            category: classify(relative),
            path: entryPath,
            size: stat.size,
            modifiedAt: new Date(stat.mtimeMs).toISOString(),
            sha256: crypto.createHash('sha256').update(`${relative}:${stat.size}:${stat.mtimeMs}`).digest('hex'),
            originDevice: 'local',
            originDeviceName: 'Local Machine',
            revision: 1,
            syncStatus: 'synced',
          });
        } catch {}
      }
    }

    return results;
  }
}

/**
 * Mock Hermes Adapter for test isolation
 */
export class MockHermesAdapter implements IHermesService {
  async detect(): Promise<HermesInstallationInfo | null> {
    return {
      homePath: 'C:\\Users\\victo\\AppData\\Local\\hermes',
      configPath: 'C:\\Users\\victo\\AppData\\Local\\hermes\\config.yaml',
      version: '0.21.5',
      profile: 'default',
      detectedDatabases: ['state.db', 'kanban.db'],
    };
  }

  async getStatus(): Promise<HermesStatus> {
    return {
      isInstalled: true,
      isRunning: true,
      homeDirectory: 'C:\\Users\\victo\\AppData\\Local\\hermes',
      version: '0.21.5',
      profile: 'default',
      stats: {
        sessionsCount: 7,
        skillsCount: 12,
        memoriesCount: 1,
        totalSizeBytes: 3018752,
      },
      detectedDatabases: ['state.db'],
    };
  }

  async getState(): Promise<DeviceHermesState> {
    const status = await this.getStatus();
    return {
      installed: status.isInstalled,
      running: status.isRunning,
      version: status.version,
      home: status.homeDirectory,
      profile: status.profile,
    };
  }

  async getSessions(): Promise<HermesSession[]> {
    return [];
  }

  async getMemories(): Promise<HermesMemory[]> {
    return [];
  }

  async updateMemory(_input: UpdateHermesMemoryInput): Promise<HermesMemory> {
    throw new Error('Mock Hermes memories are read-only.');
  }

  async getSkills(): Promise<HermesSkill[]> {
    return [];
  }

  async getConfigFiles(): Promise<HermesFile[]> {
    return [];
  }
}
