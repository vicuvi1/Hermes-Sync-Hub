import { execFile } from 'node:child_process';
import type {
  RequirementId,
  RequirementInstallResult,
  RequirementsInstallResult,
} from '@hermes-hub/types';

export const REQUIREMENT_CATALOG: Record<RequirementId, {
  label: string;
  packageId: string;
  downloadUrl: string;
}> = {
  tailscale: {
    label: 'Tailscale',
    packageId: 'Tailscale.Tailscale',
    downloadUrl: 'https://tailscale.com/download/windows',
  },
  syncthing: {
    label: 'Syncthing',
    packageId: 'Syncthing.Syncthing',
    downloadUrl: 'https://syncthing.net/downloads/',
  },
};

export interface RequirementCommandRunner {
  (file: string, args: string[]): Promise<void>;
}

const runCommand: RequirementCommandRunner = (file, args) => new Promise((resolve, reject) => {
  execFile(file, args, {
    windowsHide: true,
    timeout: 10 * 60 * 1_000,
    maxBuffer: 1024 * 1024,
  }, (error) => {
    if (error) reject(error);
    else resolve();
  });
});

export function validateRequirementIds(value: unknown): RequirementId[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    throw new Error('Choose one or both supported requirements.');
  }
  const ids = [...new Set(value)];
  if (ids.some((id) => typeof id !== 'string' || !(id in REQUIREMENT_CATALOG))) {
    throw new Error('Unsupported requirement. Only Tailscale and Syncthing can be installed.');
  }
  return ids as RequirementId[];
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  return String((error as { code?: unknown }).code || '');
}

export async function installRequirements(
  value: unknown,
  runner: RequirementCommandRunner = runCommand,
): Promise<RequirementsInstallResult> {
  const ids = validateRequirementIds(value);
  const results: RequirementInstallResult[] = [];

  for (const id of ids) {
    const requirement = REQUIREMENT_CATALOG[id];
    try {
      await runner('winget.exe', [
        'install',
        '--id', requirement.packageId,
        '--exact',
        '--source', 'winget',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity',
        '--silent',
      ]);
      results.push({
        id,
        label: requirement.label,
        packageId: requirement.packageId,
        state: 'installed',
        message: `${requirement.label} is installed.`,
      });
    } catch (error) {
      const wingetMissing = getErrorCode(error) === 'ENOENT';
      results.push({
        id,
        label: requirement.label,
        packageId: requirement.packageId,
        state: wingetMissing ? 'manual-required' : 'failed',
        message: wingetMissing
          ? 'Windows Package Manager is unavailable. Use the official download instead.'
          : `${requirement.label} installation did not complete. Windows may require approval or a restart; you can retry or use the official download.`,
      });
    }
  }

  const success = results.every((result) => result.state === 'installed');
  return {
    success,
    results,
    message: success
      ? 'Requirements installed. Complete Tailscale sign-in and Syncthing setup, then refresh their status.'
      : 'Some requirements need attention. Retry or open the official download page.',
  };
}
