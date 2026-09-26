import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  SyncEngineService,
  isRestrictedSqliteFile,
} from '../apps/agent/src/sync/SyncService';
import { WorkspaceService } from '../apps/agent/src/workspace/WorkspaceService';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { HermesService } from '../apps/agent/src/hermes/HermesAdapter';
import { DeviceRegistryService } from '../apps/agent/src/devices/DeviceRegistry';
import { MockSyncthingAdapter } from '../apps/agent/src/sync/SyncthingAdapter';
import { AgentServer } from '../apps/agent/src/health/AgentServer';
import { AgentClient } from '../apps/agent/src/client/AgentClient';

describe('Milestone 9: Safe File-Based Synchronization Engine', () => {
  let tempBaseDir: string;
  let hermesHome: string;
  let workspaceRoot: string;
  let identityService: DeviceIdentityService;
  let hermesService: HermesService;
  let workspaceService: WorkspaceService;
  let registryService: DeviceRegistryService;
  let mockSyncthing: MockSyncthingAdapter;
  let syncEngine: SyncEngineService;

  beforeEach(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-sync-test-'));
    hermesHome = path.join(tempBaseDir, 'hermes-home');
    workspaceRoot = path.join(tempBaseDir, 'HermesHubData');

    fs.mkdirSync(hermesHome, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });

    // Populate mock local Hermes installation
    fs.mkdirSync(path.join(hermesHome, 'skills', 'web-search'), { recursive: true });
    fs.writeFileSync(
      path.join(hermesHome, 'skills', 'web-search', 'SKILL.md'),
      '---\nname: web-search\n---\nWeb search skill content.',
      'utf-8'
    );

    fs.mkdirSync(path.join(hermesHome, 'memories'), { recursive: true });
    fs.writeFileSync(
      path.join(hermesHome, 'memories', 'user-preferences.md'),
      '# User Preferences\nPrefers concise markdown and local-first data.\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(hermesHome, 'SOUL.md'),
      '# Hermes Agent Core Personality\nHelpful, private, local-first.\n',
      'utf-8'
    );

    fs.writeFileSync(
      path.join(hermesHome, 'config.yaml'),
      'model: deepseek-v4\napi_key: sk-or-v1-98a417df8b6e2104bcde190847321fa890123ef\ntemperature: 0.7\n',
      'utf-8'
    );

    // Live SQLite files that must NOT be synced
    fs.writeFileSync(path.join(hermesHome, 'state.db'), 'SQLITE-FORMAT-3-LIVE-DATA', 'utf-8');
    fs.writeFileSync(path.join(hermesHome, 'state.db-wal'), 'SQLITE-WAL-ACTIVE-LOCK', 'utf-8');
    fs.writeFileSync(path.join(hermesHome, 'state.db-shm'), 'SQLITE-SHM-INDEX', 'utf-8');
    fs.writeFileSync(path.join(hermesHome, 'kanban.db'), 'SQLITE-KANBAN-DB', 'utf-8');

    const identityDir = path.join(tempBaseDir, 'identity');
    fs.mkdirSync(identityDir, { recursive: true });
    identityService = new DeviceIdentityService(path.join(identityDir, 'device-identity.json'));

    hermesService = new HermesService(hermesHome);
    workspaceService = new WorkspaceService(identityService, hermesService, workspaceRoot);
    registryService = new DeviceRegistryService(identityService, path.join(tempBaseDir, 'devices.json'));
    mockSyncthing = new MockSyncthingAdapter();

    syncEngine = new SyncEngineService(
      workspaceService,
      hermesService,
      registryService,
      mockSyncthing,
      hermesHome
    );

    await workspaceService.initWorkspace();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Anti-Corruption Guarantee: Live SQLite Rejection', () => {
    it('strictly identifies and blocks all SQLite databases, WAL logs, and lockfiles', () => {
      expect(isRestrictedSqliteFile('state.db')).toBe(true);
      expect(isRestrictedSqliteFile('C:\\hermes\\state.db')).toBe(true);
      expect(isRestrictedSqliteFile('state.db-wal')).toBe(true);
      expect(isRestrictedSqliteFile('state.db-shm')).toBe(true);
      expect(isRestrictedSqliteFile('kanban.db')).toBe(true);
      expect(isRestrictedSqliteFile('projects.db')).toBe(true);
      expect(isRestrictedSqliteFile('chat.sqlite')).toBe(true);
      expect(isRestrictedSqliteFile('chat.sqlite-wal')).toBe(true);
      expect(isRestrictedSqliteFile('state.db.auto-maintenance.lock')).toBe(true);

      // Safe file-based assets must NOT be blocked
      expect(isRestrictedSqliteFile('SKILL.md')).toBe(false);
      expect(isRestrictedSqliteFile('MEMORY.md')).toBe(false);
      expect(isRestrictedSqliteFile('config.yaml')).toBe(false);
      expect(isRestrictedSqliteFile('SOUL.md')).toBe(false);
      expect(isRestrictedSqliteFile('skills/weather/tool.py')).toBe(false);
    });

    it('never stages or copies live SQLite databases into the sync workspace', async () => {
      const result = await syncEngine.executeSyncCycle();
      expect(result.success).toBe(true);

      const layout = workspaceService.getLayout();

      // Verify that no .db or .wal or .shm files exist anywhere in the sync workspace
      const allWorkspaceFiles: string[] = [];
      const scan = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) scan(full);
          else allWorkspaceFiles.push(e.name);
        }
      };
      scan(workspaceRoot);

      for (const name of allWorkspaceFiles) {
        expect(name).not.toMatch(/\.db$/i);
        expect(name).not.toMatch(/\.db-wal$/i);
        expect(name).not.toMatch(/\.db-shm$/i);
        expect(name).not.toMatch(/\.sqlite$/i);
      }

      // Check manifest does not index state.db
      const manifest = await workspaceService.getManifest();
      const sqliteEntries = manifest.files.filter((f) => isRestrictedSqliteFile(f.relativePath));
      expect(sqliteEntries.length).toBe(0);
    });
  });

  describe('Safe Staging of File-Based Assets', () => {
    it('stages skills and tracks staged_new, unchanged, and staged_updated states', async () => {
      const layout = workspaceService.getLayout();

      // First run: staged_new
      const initialActions = await syncEngine.stageSkills(hermesHome, layout.skills);
      expect(initialActions.length).toBe(1);
      expect(initialActions[0].action).toBe('staged_new');
      expect(initialActions[0].category).toBe('skills');
      expect(initialActions[0].relativePath).toBe('skills/web-search/SKILL.md');
      expect(fs.existsSync(path.join(layout.skills, 'web-search', 'SKILL.md'))).toBe(true);

      // Second run without modification: unchanged
      const secondActions = await syncEngine.stageSkills(hermesHome, layout.skills);
      expect(secondActions.length).toBe(1);
      expect(secondActions[0].action).toBe('unchanged');

      // Modify local skill
      fs.appendFileSync(
        path.join(hermesHome, 'skills', 'web-search', 'SKILL.md'),
        '\nUpdated capability query.'
      );

      // Third run after modification: staged_updated
      const thirdActions = await syncEngine.stageSkills(hermesHome, layout.skills);
      expect(thirdActions.length).toBe(1);
      expect(thirdActions[0].action).toBe('staged_updated');
    });

    it('stages memories including SOUL.md and memories subfolder', async () => {
      const layout = workspaceService.getLayout();
      const actions = await syncEngine.stageMemories(hermesHome, layout.memories);

      expect(actions.length).toBeGreaterThanOrEqual(2);
      const soulAction = actions.find((a) => a.relativePath === 'memories/SOUL.md');
      const prefAction = actions.find((a) => a.relativePath === 'memories/user-preferences.md');

      expect(soulAction).toBeDefined();
      expect(soulAction?.action).toBe('staged_new');
      expect(prefAction).toBeDefined();
      expect(prefAction?.action).toBe('staged_new');

      expect(fs.existsSync(path.join(layout.memories, 'SOUL.md'))).toBe(true);
      expect(fs.existsSync(path.join(layout.memories, 'user-preferences.md'))).toBe(true);
    });

    it('stages configuration with automatic secret redaction', async () => {
      const layout = workspaceService.getLayout();
      const actions = await syncEngine.stageConfiguration(hermesHome, layout.configs);

      expect(actions.length).toBe(1);
      expect(actions[0].action).toBe('staged_new');
      expect(actions[0].category).toBe('configuration');

      const stagedConfigPath = path.join(layout.configs, 'config.yaml');
      expect(fs.existsSync(stagedConfigPath)).toBe(true);

      const stagedContent = fs.readFileSync(stagedConfigPath, 'utf-8');
      // Verify raw API key was redacted
      expect(stagedContent).not.toContain('sk-or-v1-98a417df8b6e2104bcde190847321fa890123ef');
      expect(stagedContent).toContain('[REDACTED]');
      expect(stagedContent).toContain('model: deepseek-v4');
    });
  });

  describe('Bidirectional Ingestion: Workspace to Local Hermes', () => {
    it('safely applies new workspace skills and memories to local Hermes home', async () => {
      const layout = workspaceService.getLayout();

      // Simulate a skill added by another peer in the workspace
      const peerSkillDir = path.join(layout.skills, 'voice-synthesis');
      fs.mkdirSync(peerSkillDir, { recursive: true });
      fs.writeFileSync(
        path.join(peerSkillDir, 'SKILL.md'),
        '---\nname: voice-synthesis\n---\nPeer voice module.',
        'utf-8'
      );

      // Simulate a memory added by another peer
      fs.writeFileSync(
        path.join(layout.memories, 'project-notes.md'),
        '# Shared Project Notes\nFrom remote device.\n',
        'utf-8'
      );

      const appliedActions = await syncEngine.applyWorkspaceToLocal(hermesHome, layout);
      expect(appliedActions.length).toBeGreaterThanOrEqual(2);

      const appliedSkill = appliedActions.find((a) => a.relativePath === 'skills/voice-synthesis/SKILL.md');
      const appliedMem = appliedActions.find((a) => a.relativePath === 'memories/project-notes.md');

      expect(appliedSkill?.action).toBe('applied_to_local');
      expect(appliedMem?.action).toBe('applied_to_local');

      // Verify files actually exist in local Hermes home
      expect(fs.existsSync(path.join(hermesHome, 'skills', 'voice-synthesis', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(hermesHome, 'memories', 'project-notes.md'))).toBe(true);
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('detects Syncthing conflict collisions and allows selective resolution', async () => {
      const layout = workspaceService.getLayout();

      // Create base file in workspace
      const baseFile = path.join(layout.memories, 'roadmap.md');
      fs.writeFileSync(baseFile, '# Project Roadmap v1\nOriginal content.\n', 'utf-8');

      // Simulate Syncthing collision file
      const conflictFile = path.join(
        layout.memories,
        'roadmap.sync-conflict-20260926-114210-REMOTE.md'
      );
      fs.writeFileSync(conflictFile, '# Project Roadmap v2\nRemote peer modifications.\n', 'utf-8');

      const conflicts = await syncEngine.detectConflicts(workspaceRoot, hermesHome, layout);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].filePath).toBe('memories/roadmap.md');
      expect(conflicts[0].leftVersion.snippet).toContain('Project Roadmap v1');
      expect(conflicts[0].rightVersion.snippet).toContain('Project Roadmap v2');

      // Test 'use_local' resolution: keeps base file and deletes conflict file
      const res = await syncEngine.resolveConflict(conflicts[0].id, 'use_local');
      expect(res.success).toBe(true);
      expect(fs.existsSync(baseFile)).toBe(true);
      expect(fs.existsSync(conflictFile)).toBe(false);

      const remaining = await syncEngine.getConflicts();
      expect(remaining.length).toBe(0);
    });

    it('resolves conflict with use_remote by adopting conflict file content', async () => {
      const layout = workspaceService.getLayout();

      const baseFile = path.join(layout.skills, 'calc', 'SKILL.md');
      fs.mkdirSync(path.dirname(baseFile), { recursive: true });
      fs.writeFileSync(baseFile, 'v1 base skill', 'utf-8');

      const conflictFile = path.join(layout.skills, 'calc', 'SKILL.sync-conflict-20260926-PEER.md');
      fs.writeFileSync(conflictFile, 'v2 peer remote skill', 'utf-8');

      const conflicts = await syncEngine.detectConflicts(workspaceRoot, hermesHome, layout);
      expect(conflicts.length).toBe(1);

      const res = await syncEngine.resolveConflict(conflicts[0].id, 'use_remote');
      expect(res.success).toBe(true);
      expect(fs.readFileSync(baseFile, 'utf-8')).toBe('v2 peer remote skill');
      expect(fs.existsSync(conflictFile)).toBe(false);
    });
  });

  describe('Full Sync Cycle & Metrics Integration', () => {
    it('executes end-to-end sync cycle and updates device registry stats', async () => {
      const result = await syncEngine.executeSyncCycle();

      expect(result.success).toBe(true);
      expect(result.cycleId).toMatch(/^cycle-/);
      expect(result.summary.status).toBe('in-sync');
      expect(result.summary.filesTransferred).toBeGreaterThan(0);
      expect(result.stagedCounts.skills).toBeGreaterThanOrEqual(1);
      expect(result.stagedCounts.memories).toBeGreaterThanOrEqual(1);
      expect(result.stagedCounts.configs).toBe(1);

      // Verify local device sync summary in registry
      const localDev = registryService.getLocalDevice();
      expect(localDev.sync).toBeDefined();
      expect(localDev.sync?.status).toBe('in-sync');
      expect(localDev.sync?.filesTransferred).toBeGreaterThanOrEqual(result.summary.filesTransferred);
      expect(localDev.data?.skills).toBeGreaterThanOrEqual(1);
      expect(localDev.data?.memories).toBeGreaterThanOrEqual(1);
    });

    it('supports dryRun without mutating files on disk', async () => {
      const freshWorkspace = path.join(tempBaseDir, 'dry-run-ws');
      const wsService = new WorkspaceService(identityService, hermesService, freshWorkspace);
      const dryEngine = new SyncEngineService(
        wsService,
        hermesService,
        registryService,
        mockSyncthing,
        hermesHome
      );

      const dryResult = await dryEngine.executeSyncCycle({ dryRun: true });
      expect(dryResult.success).toBe(true);
      // Dry run actions should be calculated
      expect(dryResult.actions.length).toBeGreaterThan(0);

      // But skills directory in fresh workspace should NOT have been created
      expect(fs.existsSync(path.join(freshWorkspace, 'skills', 'web-search', 'SKILL.md'))).toBe(false);
    });
  });

  describe('HTTP REST API & AgentClient Integration', () => {
    let server: AgentServer;
    let client: AgentClient;
    let testPort: number;

    beforeEach(async () => {
      testPort = 49100 + Math.floor(Math.random() * 500);
      server = new AgentServer(
        identityService,
        undefined,
        hermesService,
        undefined,
        mockSyncthing,
        registryService,
        undefined,
        workspaceService,
        syncEngine
      );
      await server.start(testPort);
      client = new AgentClient(`http://127.0.0.1:${testPort}`);
    });

    afterEach(async () => {
      await server.stop();
    });

    it('triggers sync cycle over REST API via AgentClient', async () => {
      const cycle = await client.triggerSyncCycle({ categories: ['skills', 'memories'] });
      expect(cycle.success).toBe(true);
      expect(cycle.summary.status).toBe('in-sync');
      expect(cycle.stagedCounts.skills).toBeGreaterThanOrEqual(1);
    });

    it('retrieves sync summary and conflicts over REST API via AgentClient', async () => {
      const summary = await client.getSyncSummary();
      expect(summary).toBeDefined();
      expect(summary.status).toBe('in-sync');

      const conflicts = await client.getConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });
});
