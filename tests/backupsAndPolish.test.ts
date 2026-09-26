import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { BackupService } from '../apps/agent/src/backups/BackupService';
import { RevisionService } from '../apps/agent/src/revisions/RevisionService';
import { DiagnosticsService } from '../apps/agent/src/diagnostics/DiagnosticsService';
import { WorkspaceService } from '../apps/agent/src/workspace/WorkspaceService';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { HermesService } from '../apps/agent/src/hermes/HermesAdapter';
import { AgentServer } from '../apps/agent/src/health/AgentServer';
import { AgentClient } from '../apps/agent/src/client/AgentClient';

describe('Milestones 12 & 13: Backups, Revisions, Diagnostics & Polish', () => {
  let tempBase: string;
  let tempWorkspaceRoot: string;
  let tempHermesHome: string;
  let workspaceService: WorkspaceService;
  let identityService: DeviceIdentityService;
  let hermesService: HermesService;
  let backupService: BackupService;
  let revisionService: RevisionService;
  let diagnosticsService: DiagnosticsService;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempBase = path.join(os.tmpdir(), `hermes-hub-m12-13-${Date.now()}`);
    tempWorkspaceRoot = path.join(tempBase, 'workspace');
    tempHermesHome = path.join(tempBase, 'hermes_home');

    fs.mkdirSync(tempWorkspaceRoot, { recursive: true });
    fs.mkdirSync(tempHermesHome, { recursive: true });

    identityService = new DeviceIdentityService(path.join(tempBase, 'identity'));
    hermesService = new HermesService(tempHermesHome);
    workspaceService = new WorkspaceService(identityService, hermesService, tempWorkspaceRoot);
    await workspaceService.initWorkspace();

    // Seed some test data in workspace
    const memoriesDir = path.join(tempWorkspaceRoot, 'memories');
    fs.writeFileSync(
      path.join(memoriesDir, 'MEMORY.md'),
      '# Core Memory\nUser prefers dark mode and local-first execution.\nAPI key sk-proj-1234567890abcdef1234567890\n',
      'utf-8'
    );

    const configsDir = path.join(tempWorkspaceRoot, 'configs');
    fs.writeFileSync(
      path.join(configsDir, 'config.yaml'),
      'agent_name: hermes-test\nsync_mode: p2p\n',
      'utf-8'
    );

    backupService = new BackupService(workspaceService, hermesService, identityService);
    revisionService = new RevisionService(workspaceService, identityService);
    diagnosticsService = new DiagnosticsService(
      identityService,
      undefined,
      hermesService,
      undefined,
      undefined,
      workspaceService,
      backupService
    );

    // Setup AgentServer with new services
    server = new AgentServer(
      identityService,
      undefined,
      hermesService,
      undefined,
      undefined,
      undefined,
      undefined,
      workspaceService,
      undefined,
      undefined,
      backupService,
      revisionService,
      diagnosticsService
    );

    port = await server.start(0);
    client = new AgentClient(`http://127.0.0.1:${port}`);
  });

  afterAll(async () => {
    await server.stop();
    if (fs.existsSync(tempBase)) {
      fs.rmSync(tempBase, { recursive: true, force: true });
    }
  });

  describe('Milestone 12: Backups Engine', () => {
    let createdBackupId: string;

    it('creates an atomic backup bundle without live SQLite WAL locks', async () => {
      const backup = await backupService.createBackup({
        name: 'test-backup-001',
        notes: 'Integration test backup',
      });

      expect(backup).toBeDefined();
      expect(backup.id).toBeDefined();
      expect(backup.name).toBe('test-backup-001');
      expect(backup.health).toBe('valid');
      expect(backup.sizeBytes).toBeGreaterThan(0);
      expect(backup.itemCounts.memories).toBeGreaterThan(0);
      expect(backup.itemCounts.configs).toBeGreaterThan(0);
      expect(backup.filePath).toBeDefined();
      expect(fs.existsSync(backup.filePath!)).toBe(true);

      createdBackupId = backup.id;

      // Verify backup bundle structure
      const manifestPath = path.join(backup.filePath!, 'backup-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const snapPath = path.join(backup.filePath!, 'snapshot.json');
      expect(fs.existsSync(snapPath)).toBe(true);
    });

    it('lists backups in master manifest sorted latest first', async () => {
      const list = await backupService.getBackups();
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].id).toBe(createdBackupId);
    });

    it('verifies cryptographic integrity of a valid backup bundle', async () => {
      const result = await backupService.verifyBackup(createdBackupId);

      expect(result.valid).toBe(true);
      expect(result.backupId).toBe(createdBackupId);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.matchingFiles).toBe(result.totalFiles);
      expect(result.missingFiles.length).toBe(0);
      expect(result.tamperedFiles.length).toBe(0);
    });

    it('detects tampering or corruption in backup files', async () => {
      const backup = await backupService.getBackupById(createdBackupId);
      expect(backup).toBeDefined();

      const memoryFileInBackup = path.join(backup!.filePath!, 'memories', 'MEMORY.md');
      expect(fs.existsSync(memoryFileInBackup)).toBe(true);

      // Tamper with the content
      fs.writeFileSync(memoryFileInBackup, 'TAMPERED UNVERIFIED CONTENT', 'utf-8');

      const result = await backupService.verifyBackup(createdBackupId);
      expect(result.valid).toBe(false);
      expect(result.tamperedFiles).toContain('memories/MEMORY.md');

      // Revert tamper so other tests remain clean
      fs.writeFileSync(
        memoryFileInBackup,
        '# Core Memory\nUser prefers dark mode and local-first execution.\nAPI key sk-proj-1234567890abcdef1234567890\n',
        'utf-8'
      );
    });

    it('restores backup safely with an automatic pre-restore rollback snapshot', async () => {
      const restoreRes = await backupService.restoreBackup({
        backupId: createdBackupId,
        emergencyRollback: true,
      });

      expect(restoreRes.success).toBe(true);
      expect(restoreRes.backupId).toBe(createdBackupId);
      expect(restoreRes.restoredFilesCount).toBeGreaterThan(0);
      expect(restoreRes.safetyRollbackSnapshotId).toBeDefined();

      // Check that safety snapshot exists
      const rollbackSnap = await workspaceService.getSnapshotById(restoreRes.safetyRollbackSnapshotId!);
      expect(rollbackSnap).toBeDefined();
    });

    it('enforces retention policy and prunes old backups beyond maxRetain', async () => {
      // Create 3 more backups
      await backupService.createBackup({ name: 'test-backup-002', retainCount: 2 });
      await backupService.createBackup({ name: 'test-backup-003', retainCount: 2 });

      const all = await backupService.getBackups();
      expect(all.length).toBeLessThanOrEqual(2);
    });

    it('deletes backup bundle from disk and master manifest', async () => {
      const listBefore = await backupService.getBackups();
      const targetId = listBefore[0].id;

      const deleted = await backupService.deleteBackup(targetId);
      expect(deleted).toBe(true);

      const listAfter = await backupService.getBackups();
      expect(listAfter.some((b) => b.id === targetId)).toBe(false);
    });
  });

  describe('Milestone 12: Revision History Engine', () => {
    it('records revisions incrementally and stores content-addressable blobs', async () => {
      const rev1 = await revisionService.recordRevision({
        relativePath: 'memories/MEMORY.md',
        category: 'memories',
        content: 'Version 1 content: Initial state',
        changeSummary: 'Initial setup',
      });

      expect(rev1.revision).toBe(1);
      expect(rev1.filePath).toBe('memories/MEMORY.md');
      expect(rev1.sha256).toBeDefined();

      const rev2 = await revisionService.recordRevision({
        relativePath: 'memories/MEMORY.md',
        category: 'memories',
        content: 'Version 2 content: Added user preferences',
        changeSummary: 'Update preferences',
      });

      expect(rev2.revision).toBe(2);
      expect(rev2.sha256).not.toBe(rev1.sha256);
    });

    it('retrieves full revision history for a target file', async () => {
      const history = await revisionService.getFileRevisions('memories/MEMORY.md');

      expect(history.filePath).toBe('memories/MEMORY.md');
      expect(history.currentRevision).toBe(2);
      expect(history.revisions.length).toBe(2);
      expect(history.revisions[0].revision).toBe(2);
      expect(history.revisions[1].revision).toBe(1);
    });

    it('safely rolls back to a historical revision', async () => {
      const rollback = await revisionService.rollbackRevision('memories/MEMORY.md', 1);

      expect(rollback.success).toBe(true);
      expect(rollback.previousRevision).toBe(2);
      expect(rollback.currentRevision).toBe(3); // New revision recorded representing the rollback

      // Verify file content matches revision 1
      const restoredContent = fs.readFileSync(path.join(tempWorkspaceRoot, 'memories', 'MEMORY.md'), 'utf-8');
      expect(restoredContent).toBe('Version 1 content: Initial state');
    });
  });

  describe('Milestone 13: Diagnostics Engine & Secret Redaction', () => {
    it('generates a full diagnostics report with secret redaction', async () => {
      const report = await diagnosticsService.generateDiagnosticsReport();

      expect(report.system).toBeDefined();
      expect(report.system.hostname).toBeDefined();
      expect(report.agent.status).toBeDefined();
      expect(report.hermes).toBeDefined();
      expect(report.workspace.rootPath).toBeDefined();
      expect(report.recentLogs.length).toBeGreaterThan(0);

      // Verify secrets are redacted
      const reportStr = JSON.stringify(report);
      expect(reportStr).not.toContain('1234567890abcdef1234567890');
    });

    it('renders clean Markdown diagnostic report', async () => {
      const md = await diagnosticsService.renderDiagnosticsMarkdown();

      expect(md).toContain('# Hermes Hub Diagnostic Report');
      expect(md).toContain('## System & Hardware');
      expect(md).toContain('## Agent Daemon');
      expect(md).toContain('## Hermes Agent Detection');
      expect(md).toContain('## Network & Mesh (Tailscale)');
      expect(md).toContain('## Sync Engine (Syncthing)');
      expect(md).toContain('## Managed Workspace & Backups');
    });

    it('exports diagnostics report to markdown file on disk', async () => {
      const exportPath = await diagnosticsService.exportDiagnosticsToFile();
      expect(fs.existsSync(exportPath)).toBe(true);

      const content = fs.readFileSync(exportPath, 'utf-8');
      expect(content).toContain('# Hermes Hub Diagnostic Report');
    });
  });

  describe('AgentServer HTTP Endpoints & Client SDK', () => {
    it('fetches backups via client.getBackups() and creates backup via client.createBackup()', async () => {
      const newBackup = await client.createBackup({ name: 'sdk-created-backup' });
      expect(newBackup).toBeDefined();
      expect(newBackup.name).toBe('sdk-created-backup');

      const backups = await client.getBackups();
      expect(backups.length).toBeGreaterThanOrEqual(1);
      expect(backups.some((b) => b.name === 'sdk-created-backup')).toBe(true);
    });

    it('verifies backup via client.verifyBackup()', async () => {
      const backups = await client.getBackups();
      const targetId = backups[0].id;

      const verification = await client.verifyBackup(targetId);
      expect(verification.valid).toBe(true);
      expect(verification.backupId).toBe(targetId);
    });

    it('retrieves file revisions via client.getFileRevisions()', async () => {
      const history = await client.getFileRevisions('memories/MEMORY.md');
      expect(history.filePath).toBe('memories/MEMORY.md');
      expect(history.revisions.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches diagnostics report via client.getDiagnosticsReport()', async () => {
      const report = await client.getDiagnosticsReport();
      expect(report.system.hostname).toBeDefined();
      expect(report.workspace.manifestValid).toBeDefined();
    });

    it('exports diagnostics file via client.exportDiagnostics()', async () => {
      const res = await client.exportDiagnostics();
      expect(res.success).toBe(true);
      expect(res.filePath).toBeDefined();
      expect(fs.existsSync(res.filePath)).toBe(true);
    });
  });
});
