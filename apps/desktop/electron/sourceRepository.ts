import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  SourceRepositoryPushInput,
  SourceRepositoryResult,
  SourceRepositoryStatus,
} from '@hermes-hub/types';

export const SOURCE_REPOSITORY_URL = 'https://github.com/vicuvi1/Hermes-Sync-Hub.git';
const SOURCE_REPOSITORY_SSH_URL = 'git@github.com:vicuvi1/Hermes-Sync-Hub.git';

function runGit(workspacePath: string, args: string[], timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: workspacePath, timeout, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || stdout || error.message).trim();
        reject(new Error(detail || 'Git command failed.'));
        return;
      }
      resolve(String(stdout).trim());
    });
  });
}

function changedPaths(porcelain: string): string[] {
  return porcelain.split(/\r?\n/).filter(Boolean).map((line) => {
    const value = line.length > 3 ? line.slice(3) : line;
    const renameTarget = value.includes(' -> ') ? value.split(' -> ').at(-1)! : value;
    return renameTarget.replace(/^"|"$/g, '');
  });
}

export function isSensitiveRepositoryPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const base = normalized.split('/').at(-1) || normalized;
  return (
    base === '.env' ||
    base.startsWith('.env.') ||
    /^(credentials|secrets?|tokens?)(\.|$)/.test(base) ||
    /\.(pem|key|pfx|p12|sqlite|sqlite3|db)$/.test(base) ||
    normalized.includes('/vault/') ||
    normalized.includes('/private-keys/')
  );
}

function emptyStatus(workspacePath: string, message: string, gitAvailable = true): SourceRepositoryStatus {
  return {
    repositoryUrl: SOURCE_REPOSITORY_URL,
    workspacePath,
    configured: Boolean(workspacePath),
    gitAvailable,
    validRepository: false,
    changedFiles: [],
    ahead: 0,
    behind: 0,
    message,
  };
}

export class SourceRepositoryService {
  async getStatus(requestedPath?: string): Promise<SourceRepositoryStatus> {
    const workspacePath = requestedPath?.trim() ? path.resolve(requestedPath.trim()) : '';
    if (!workspacePath) return emptyStatus('', 'Choose the local Hermes Hub source folder.');

    if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
      return emptyStatus(workspacePath, 'The selected source folder does not exist.');
    }

    try {
      await runGit(workspacePath, ['--version'], 10_000);
    } catch {
      return emptyStatus(workspacePath, 'Git is not installed or is unavailable in PATH.', false);
    }

    try {
      const inside = await runGit(workspacePath, ['rev-parse', '--is-inside-work-tree']);
      if (inside !== 'true') return emptyStatus(workspacePath, 'The selected folder is not a Git repository.');
      const remote = await runGit(workspacePath, ['remote', 'get-url', 'origin']);
      if (remote !== SOURCE_REPOSITORY_URL && remote !== SOURCE_REPOSITORY_SSH_URL) {
        return emptyStatus(workspacePath, `This folder is connected to ${remote}, not the approved Hermes Hub repository.`);
      }

      const [branch, commit, porcelain] = await Promise.all([
        runGit(workspacePath, ['branch', '--show-current']),
        runGit(workspacePath, ['rev-parse', '--short', 'HEAD']),
        runGit(workspacePath, ['status', '--porcelain=v1']),
      ]);
      let ahead = 0;
      let behind = 0;
      try {
        const comparison = await runGit(workspacePath, ['rev-list', '--left-right', '--count', 'origin/main...HEAD']);
        const [remoteOnly, localOnly] = comparison.split(/\s+/).map(Number);
        behind = Number.isFinite(remoteOnly) ? remoteOnly : 0;
        ahead = Number.isFinite(localOnly) ? localOnly : 0;
      } catch {
        // A repository without origin/main can still show local status; pull/push will report the exact error.
      }
      const files = changedPaths(porcelain);
      return {
        repositoryUrl: SOURCE_REPOSITORY_URL,
        workspacePath,
        configured: true,
        gitAvailable: true,
        validRepository: true,
        branch,
        commit,
        changedFiles: files,
        ahead,
        behind,
        message: files.length ? `${files.length} local file${files.length === 1 ? '' : 's'} changed.` : 'Working tree is clean.',
      };
    } catch (error) {
      return emptyStatus(workspacePath, error instanceof Error ? error.message : 'Unable to inspect the repository.');
    }
  }

  async pull(workspacePath: string): Promise<SourceRepositoryResult> {
    let status = await this.getStatus(workspacePath);
    if (!status.validRepository) return { success: false, message: status.message, status };
    if (status.branch !== 'main') return { success: false, message: 'Switch to the main branch before pulling.', status };
    if (status.changedFiles.length) return { success: false, message: 'Commit or discard local changes before pulling from GitHub.', status };

    try {
      await runGit(status.workspacePath, ['fetch', 'origin', 'main'], 120_000);
      await runGit(status.workspacePath, ['merge', '--ff-only', 'origin/main'], 120_000);
      status = await this.getStatus(status.workspacePath);
      return { success: true, message: 'Latest changes downloaded from GitHub.', status };
    } catch (error) {
      status = await this.getStatus(status.workspacePath);
      return { success: false, message: error instanceof Error ? error.message : 'Pull failed.', status };
    }
  }

  async push(input: SourceRepositoryPushInput): Promise<SourceRepositoryResult> {
    let status = await this.getStatus(input.workspacePath);
    if (!input.confirmed) return { success: false, message: 'Review and confirm the changed files before pushing.', status };
    if (!status.validRepository) return { success: false, message: status.message, status };
    if (status.branch !== 'main') return { success: false, message: 'Switch to the main branch before pushing.', status };
    const commitMessage = input.commitMessage.trim();
    if (!commitMessage || commitMessage.length > 200) {
      return { success: false, message: 'Enter a commit message between 1 and 200 characters.', status };
    }
    const blocked = status.changedFiles.filter(isSensitiveRepositoryPath);
    if (blocked.length) {
      return { success: false, message: `Push blocked because sensitive files were detected: ${blocked.join(', ')}`, status };
    }

    try {
      if (status.changedFiles.length) {
        await runGit(status.workspacePath, ['add', '--all']);
        await runGit(status.workspacePath, ['commit', '-m', commitMessage], 120_000);
      }
      await runGit(status.workspacePath, ['push', 'origin', 'HEAD:main'], 120_000);
      status = await this.getStatus(status.workspacePath);
      return { success: true, message: 'Changes committed and pushed to GitHub.', status };
    } catch (error) {
      status = await this.getStatus(status.workspacePath);
      return { success: false, message: error instanceof Error ? error.message : 'Push failed.', status };
    }
  }
}
