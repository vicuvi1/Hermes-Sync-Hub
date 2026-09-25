import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export interface DiscoveredPath {
  path: string;
  source: string;
  exists: boolean;
  score: number;
}

export class HermesDiscoveryService {
  private manualPath?: string;

  constructor(manualPath?: string) {
    this.manualPath = manualPath;
  }

  /**
   * Returns list of candidate directories to search for Hermes
   */
  getCandidatePaths(): string[] {
    const candidates: string[] = [];

    if (this.manualPath) {
      candidates.push(this.manualPath);
    }

    if (process.env.HERMES_HOME) {
      candidates.push(process.env.HERMES_HOME);
    }

    const homeDir = os.homedir();
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      candidates.push(path.join(localAppData, 'hermes'));
      candidates.push(path.join(appData, 'hermes'));
      candidates.push(path.join(homeDir, '.hermes'));
    } else {
      candidates.push(path.join(homeDir, '.hermes'));
      candidates.push(path.join(homeDir, '.config', 'hermes'));
      if (process.env.XDG_DATA_HOME) {
        candidates.push(path.join(process.env.XDG_DATA_HOME, 'hermes'));
      }
    }

    return Array.from(new Set(candidates));
  }

  /**
   * Discovers the active Hermes home directory
   */
  findHermesHome(): string | null {
    if (this.manualPath && fs.existsSync(this.manualPath)) {
      return this.manualPath;
    }

    const candidates = this.getCandidatePaths();
    const indicators = [
      'config.yaml',
      'state.db',
      'skills',
      'sessions',
      'SOUL.md',
      'hermes-agent',
      'install_id',
    ];

    let bestPath: string | null = null;
    let highestScore = 0;

    for (const cand of candidates) {
      if (!fs.existsSync(cand)) continue;

      try {
        const stat = fs.statSync(cand);
        if (!stat.isDirectory()) continue;

        let score = 0;
        for (const ind of indicators) {
          if (fs.existsSync(path.join(cand, ind))) {
            score++;
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestPath = cand;
        }
      } catch {
        // Skip inaccessible paths
      }
    }

    return highestScore > 0 ? bestPath : null;
  }

  /**
   * Discovers the Hermes CLI executable if installed in PATH or standard bin
   */
  findHermesExecutable(hermesHome?: string | null): string | null {
    const isWindows = process.platform === 'win32';
    const exeNames = isWindows ? ['hermes.cmd', 'hermes.exe', 'hermes.bat'] : ['hermes'];

    // 1. Check inside detected Hermes home/bin
    if (hermesHome) {
      for (const name of exeNames) {
        const binPath = path.join(hermesHome, 'bin', name);
        if (fs.existsSync(binPath)) {
          return binPath;
        }
      }
    }

    // 2. Check PATH environment variable
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of pathDirs) {
      if (!dir) continue;
      for (const name of exeNames) {
        const full = path.join(dir, name);
        try {
          if (fs.existsSync(full)) {
            return full;
          }
        } catch {}
      }
    }

    return null;
  }
}
