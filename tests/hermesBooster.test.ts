import { describe, expect, it, vi } from 'vitest';
import { HermesBoosterService, type HermesCommandRunner } from '../apps/desktop/electron/hermesBooster.js';

function fakeHermes() {
  return {
    getStatus: vi.fn().mockResolvedValue({ isInstalled: true, version: '1.2.3' }),
    detect: vi.fn().mockResolvedValue({ homePath: 'C:/hermes', version: '1.2.3', profile: 'default', detectedDatabases: [] }),
    invalidateDetectionCache: vi.fn(),
  } as any;
}

describe('Hermes Booster service', () => {
  it('builds health, extension, and update status from Hermes native commands', async () => {
    const runner: HermesCommandRunner = vi.fn(async (args) => {
      const command = args.join(' ');
      if (command === 'doctor') return { success: true, output: 'Hermes Doctor\n✓ Python\n✓ Config\n⚠ Optional provider missing' };
      if (command === 'plugins list --json') return { success: true, output: '[{"name":"demo","status":"enabled","version":"1.0.0","description":"Demo","source":"bundled"}]' };
      if (command === 'mcp list') return { success: true, output: '  github           gh mcp serve        all       ✓ enabled' };
      if (command === 'tools list') return { success: true, output: '✓ enabled web\n✗ disabled video' };
      if (command === 'update --check') return { success: true, output: 'Update available: 3 commits behind' };
      return { success: true, output: 'ok' };
    });
    const status = await new HermesBoosterService(fakeHermes(), runner).getStatus();
    expect(status.health).toMatchObject({ passed: 2, warnings: 1, errors: 0, state: 'warning' });
    expect(status.extensions.plugins[0]).toMatchObject({ name: 'demo', status: 'enabled' });
    expect(status.extensions.mcpServers).toBe(1);
    expect(status.extensions.mcpNames).toEqual(['github']);
    expect(status.update.available).toBe(true);
  });

  it('uses only the official non-interactive safe update arguments', async () => {
    const runner = vi.fn().mockResolvedValue({ success: true, output: 'updated' });
    const hermes = fakeHermes();
    const result = await new HermesBoosterService(hermes, runner).updateHermes();
    expect(result.success).toBe(true);
    expect(runner).toHaveBeenCalledWith(['update', '--yes', '--backup', '--keep-stash'], 20 * 60_000);
    expect(hermes.invalidateDetectionCache).toHaveBeenCalled();
  });

  it('validates a plugin against the installed Hermes plugin list before toggling it', async () => {
    const runner = vi.fn(async (args: string[]) => args.join(' ') === 'plugins list --json'
      ? { success: true, output: '[{"name":"safe-plugin","status":"disabled"}]' }
      : { success: true, output: 'enabled' });
    const service = new HermesBoosterService(fakeHermes(), runner);
    await expect(service.setPluginEnabled('unknown', true)).rejects.toThrow(/not installed/i);
    await expect(service.setPluginEnabled('safe-plugin', true)).resolves.toMatchObject({ success: true });
    expect(runner).toHaveBeenLastCalledWith(['plugins', 'enable', 'safe-plugin'], 60_000);
  });

  it('tests only MCP servers already configured in Hermes', async () => {
    const runner = vi.fn(async (args: string[]) => args.join(' ') === 'mcp list'
      ? { success: true, output: '  github           gh mcp serve        all       ✓ enabled' }
      : { success: true, output: 'Connection passed' });
    const service = new HermesBoosterService(fakeHermes(), runner);
    await expect(service.testMcp('unknown')).rejects.toThrow(/not configured/i);
    await expect(service.testMcp('github')).resolves.toMatchObject({ success: true });
    expect(runner).toHaveBeenLastCalledWith(['mcp', 'test', 'github'], 2 * 60_000);
  });
});
