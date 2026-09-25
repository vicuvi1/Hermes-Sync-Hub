import { HermesSession, HermesMemory, HermesSkill, HermesFile, DeviceHermesState } from '@hermes-hub/types';

export interface HermesInstallationInfo {
  homePath: string;
  configPath: string;
  version: string;
  profile: string;
}

export interface IHermesAdapter {
  detect(): Promise<HermesInstallationInfo | null>;
  getState(): Promise<DeviceHermesState>;
  getSessions(): Promise<HermesSession[]>;
  getMemories(): Promise<HermesMemory[]>;
  getSkills(): Promise<HermesSkill[]>;
  getFiles(): Promise<HermesFile[]>;
}

export class MockHermesAdapter implements IHermesAdapter {
  async detect(): Promise<HermesInstallationInfo | null> {
    return {
      homePath: 'C:\\Users\\victo\\AppData\\Local\\hermes',
      configPath: 'C:\\Users\\victo\\AppData\\Local\\hermes\\config.yaml',
      version: '1.4.2',
      profile: 'default',
    };
  }

  async getState(): Promise<DeviceHermesState> {
    return {
      installed: true,
      running: true,
      version: '1.4.2',
      home: 'C:\\Users\\victo\\AppData\\Local\\hermes',
      profile: 'default',
    };
  }

  async getSessions(): Promise<HermesSession[]> {
    return [];
  }

  async getMemories(): Promise<HermesMemory[]> {
    return [];
  }

  async getSkills(): Promise<HermesSkill[]> {
    return [];
  }

  async getFiles(): Promise<HermesFile[]> {
    return [];
  }
}
