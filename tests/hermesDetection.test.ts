import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { HermesDiscoveryService } from '../apps/agent/src/discovery/HermesDiscovery';
import { HermesService } from '../apps/agent/src/hermes/HermesAdapter';

describe('Hermes Detection & Inspection Service (Milestone 3)', () => {
  let mockHermesHome: string;

  beforeEach(() => {
    // Construct realistic Hermes home fixture in temp directory
    mockHermesHome = path.join(os.tmpdir(), `hermes-detect-test-${Date.now()}`);
    fs.mkdirSync(path.join(mockHermesHome, 'skills', 'cybersecurity'), { recursive: true });
    fs.mkdirSync(path.join(mockHermesHome, 'skills', 'development'), { recursive: true });
    fs.mkdirSync(path.join(mockHermesHome, 'sessions'), { recursive: true });

    // Populate indicator files
    fs.writeFileSync(path.join(mockHermesHome, 'config.yaml'), 'model: deepseek\nprofile: default\n', 'utf-8');
    fs.writeFileSync(path.join(mockHermesHome, 'SOUL.md'), '# Persona\nAgent soul instructions\n', 'utf-8');
    fs.writeFileSync(path.join(mockHermesHome, 'state.db'), 'mock-sqlite-db-binary', 'utf-8');
    fs.writeFileSync(path.join(mockHermesHome, 'install_id'), 'inst-92019482', 'utf-8');

    // Add session dumps
    fs.writeFileSync(path.join(mockHermesHome, 'sessions', 'request_dump_001.json'), '{}', 'utf-8');
    fs.writeFileSync(path.join(mockHermesHome, 'sessions', 'request_dump_002.json'), '{}', 'utf-8');

    // Add skills
    fs.writeFileSync(path.join(mockHermesHome, 'skills', 'cybersecurity', 'tool.ts'), 'export {}', 'utf-8');
    fs.writeFileSync(path.join(mockHermesHome, 'skills', 'development', 'tool.ts'), 'export {}', 'utf-8');
  });

  afterEach(() => {
    if (fs.existsSync(mockHermesHome)) {
      fs.rmSync(mockHermesHome, { recursive: true, force: true });
    }
  });

  it('should discover Hermes home directory via candidate discovery scoring', () => {
    const discovery = new HermesDiscoveryService(mockHermesHome);
    const discovered = discovery.findHermesHome();

    expect(discovered).toBe(mockHermesHome);
  });

  it('should detect Hermes installation details and detected databases', async () => {
    const service = new HermesService(mockHermesHome);
    const install = await service.detect();

    expect(install).not.toBeNull();
    expect(install?.homePath).toBe(mockHermesHome);
    expect(install?.profile).toBe('default');
    expect(install?.version).toBeDefined();
    expect(install?.detectedDatabases).toContain('state.db');
  });

  it('should inspect metadata counts non-destructively', async () => {
    // Capture timestamps before inspection
    const configFile = path.join(mockHermesHome, 'config.yaml');
    const mtimeBefore = fs.statSync(configFile).mtimeMs;

    const service = new HermesService(mockHermesHome);
    const status = await service.getStatus();

    expect(status.isInstalled).toBe(true);
    expect(status.homeDirectory).toBe(mockHermesHome);
    expect(status.stats.sessionsCount).toBe(2);
    expect(status.stats.skillsCount).toBe(2);
    expect(status.stats.memoriesCount).toBe(1); // SOUL.md
    expect(status.stats.totalSizeBytes).toBeGreaterThan(0);

    // CRITICAL: Guarantee no files were modified during inspection
    const mtimeAfter = fs.statSync(configFile).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it('should extract skills non-destructively', async () => {
    const service = new HermesService(mockHermesHome);
    const skills = await service.getSkills();

    expect(skills.length).toBe(2);
    expect(skills.some((s) => s.name.toLowerCase().includes('cybersecurity'))).toBe(true);
    expect(skills.some((s) => s.name.toLowerCase().includes('development'))).toBe(true);
  });

  it('should extract memories non-destructively', async () => {
    const service = new HermesService(mockHermesHome);
    const memories = await service.getMemories();

    expect(memories.length).toBe(1);
    expect(memories[0].title).toBe('SOUL.md');
    expect(memories[0].content).toContain('Agent soul instructions');
  });

  it('should extract sessions non-destructively', async () => {
    const service = new HermesService(mockHermesHome);
    const sessions = await service.getSessions();

    expect(sessions.length).toBe(2);
    expect(sessions[0].id).toBeDefined();
  });

  it('should detect running state when lockfiles or process indicators are present', async () => {
    const service = new HermesService(mockHermesHome);

    // Initially no locks
    const initialRunning = await service.isRunning(mockHermesHome);
    expect(initialRunning.isRunning).toBe(false);

    // Add lockfile simulating active maintenance or transaction
    const lockPath = path.join(mockHermesHome, '.install_id.lock');
    fs.writeFileSync(lockPath, '1', 'utf-8');

    const runningWithLock = await service.isRunning(mockHermesHome);
    expect(runningWithLock.isRunning).toBe(true);

    // Clean up lock
    fs.unlinkSync(lockPath);
  });

  it('should non-destructively inspect the live system Hermes if present', async () => {
    // Inspect local live machine without any overrides
    const liveService = new HermesService();
    const liveStatus = await liveService.getStatus();

    if (liveStatus.isInstalled) {
      expect(liveStatus.homeDirectory).toBeDefined();
      expect(liveStatus.version).toBeDefined();
      expect(liveStatus.stats.skillsCount).toBeGreaterThan(0);
    }
  });
});
