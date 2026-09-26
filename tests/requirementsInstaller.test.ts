import { describe, expect, it, vi } from 'vitest';
import {
  installRequirements,
  REQUIREMENT_CATALOG,
  validateRequirementIds,
} from '../apps/desktop/electron/requirementsInstaller.js';

describe('Windows requirements installer', () => {
  it('allows only the fixed Tailscale and Syncthing identifiers', () => {
    expect(validateRequirementIds(['tailscale', 'syncthing'])).toEqual(['tailscale', 'syncthing']);
    expect(() => validateRequirementIds(['Git.Git'])).toThrow(/unsupported requirement/i);
    expect(() => validateRequirementIds([])).toThrow(/choose one or both/i);
  });

  it('uses exact official winget package IDs without a shell', async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    const result = await installRequirements(['tailscale', 'syncthing'], runner);

    expect(result.success).toBe(true);
    expect(runner).toHaveBeenNthCalledWith(1, 'winget.exe', expect.arrayContaining([
      '--id', REQUIREMENT_CATALOG.tailscale.packageId, '--exact',
    ]));
    expect(runner).toHaveBeenNthCalledWith(2, 'winget.exe', expect.arrayContaining([
      '--id', REQUIREMENT_CATALOG.syncthing.packageId, '--exact',
    ]));
  });

  it('offers a manual path when Windows Package Manager is unavailable', async () => {
    const missingWinget = Object.assign(new Error('not found'), { code: 'ENOENT' });
    const result = await installRequirements(['tailscale'], vi.fn().mockRejectedValue(missingWinget));

    expect(result.success).toBe(false);
    expect(result.results[0].state).toBe('manual-required');
    expect(REQUIREMENT_CATALOG.tailscale.downloadUrl).toMatch(/^https:\/\//);
  });
});
