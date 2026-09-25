import os from 'node:os';
import path from 'node:path';

export interface DiscoveredPath {
  path: string;
  source: string;
  exists: boolean;
}

export class HermesDiscoveryService {
  /**
   * Returns list of candidate directories to search for Hermes
   */
  getCandidatePaths(): string[] {
    const homeDir = os.homedir();
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return [
        path.join(localAppData, 'hermes'),
        path.join(appData, 'hermes'),
        path.join(homeDir, '.hermes'),
      ];
    } else {
      return [
        path.join(homeDir, '.hermes'),
        path.join(homeDir, '.config', 'hermes'),
      ];
    }
  }
}
