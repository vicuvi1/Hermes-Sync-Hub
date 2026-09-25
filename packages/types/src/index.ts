export type OperatingSystem = 'windows' | 'macos' | 'linux';
export type SyncStatusType = 'in-sync' | 'syncing' | 'pending' | 'offline' | 'conflict';
export type HealthStatusType = 'healthy' | 'warning' | 'degraded' | 'offline';

export interface DeviceTailscaleState {
  installed: boolean;
  connected: boolean;
  ip?: string;
  connectionType?: 'direct' | 'derp-relay' | 'unknown';
  peersCount?: number;
}

export interface DeviceSyncthingState {
  installed: boolean;
  running: boolean;
  deviceId?: string;
  version?: string;
  foldersCount?: number;
}

export interface DeviceHermesState {
  installed: boolean;
  running: boolean;
  version: string;
  home: string;
  profile: string;
}

export interface DeviceDataCounts {
  sessions: number;
  memories: number;
  skills: number;
  totalSizeBytes: number;
}

export interface DeviceSyncSummary {
  lastSync: string; // ISO date string
  pendingFiles: number;
  filesTransferred: number;
  bytesUploaded: number;
  bytesDownloaded: number;
  conflicts: number;
  status: SyncStatusType;
}

export interface Device {
  deviceId: string;
  deviceName: string;
  hostname: string;
  os: OperatingSystem;
  architecture: string;
  appVersion: string;
  agentVersion: string;
  online: boolean;
  lastSeen: string; // ISO date string
  tailscale: DeviceTailscaleState;
  syncthing: DeviceSyncthingState;
  hermes: DeviceHermesState;
  data: DeviceDataCounts;
  sync: DeviceSyncSummary;
  lastBackup: string;
  healthStatus: HealthStatusType;
}

export interface HermesSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messagesCount: number;
  model: string;
  tokensUsed?: number;
  toolsUsed?: string[];
  originDevice: string;
  originDeviceName: string;
  revision: number;
  syncStatus: 'synced' | 'pending' | 'local-only';
  previewText?: string;
}

export interface HermesMemory {
  id: string;
  title: string;
  path: string;
  updatedAt: string;
  originDevice: string;
  originDeviceName: string;
  revision: number;
  content: string;
  devicesWithRevision: string[]; // deviceIds
  isLatest: boolean;
}

export interface HermesSkill {
  id: string;
  name: string;
  description: string;
  filesCount: number;
  lastModified: string;
  originDevice: string;
  originDeviceName: string;
  revision: number;
  devicesWithRevision: string[];
  tags: string[];
}

export type HermesFileCategory = 'Configuration' | 'Memories' | 'Skills' | 'Sessions/Exports' | 'Logs' | 'Other';

export interface HermesFile {
  id: string;
  name: string;
  category: HermesFileCategory;
  path: string;
  size: number;
  modifiedAt: string;
  sha256: string;
  originDevice: string;
  originDeviceName: string;
  revision: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

export interface VaultSecret {
  id: string;
  key: string;
  category: 'API Keys' | 'Auth Tokens' | 'Tailscale' | 'Custom';
  value: string;
  description?: string;
  isMasked: boolean;
  updatedAt: string;
  originDevice: string;
}

export type ActivityEventType =
  | 'file_sync'
  | 'device_connect'
  | 'device_disconnect'
  | 'session_imported'
  | 'backup_created'
  | 'conflict_detected';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: ActivityEventType;
  title: string;
  description: string;
  sourceDevice: string;
  targetDevice?: string;
  bytesTransferred?: number;
  filesCount?: number;
  status: 'success' | 'warning' | 'error' | 'info';
}

export interface ActiveTransfer {
  id: string;
  sourceDevice: string;
  targetDevice: string;
  progressPercentage: number;
  bytesCurrent: number;
  bytesTotal: number;
  filesRemaining: number;
  speedBytesPerSec: number;
}

export interface BackupRecord {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  health: 'valid' | 'corrupt' | 'in_progress';
  itemCounts: {
    sessions: number;
    memories: number;
    skills: number;
    configs: number;
  };
  originDevice: string;
}

export interface ConflictItem {
  id: string;
  filePath: string;
  detectedAt: string;
  leftVersion: {
    deviceName: string;
    modifiedAt: string;
    hash: string;
    snippet: string;
  };
  rightVersion: {
    deviceName: string;
    modifiedAt: string;
    hash: string;
    snippet: string;
  };
}

export interface OverallStats {
  devicesCount: number;
  onlineCount: number;
  sessionsCount: number;
  memoriesCount: number;
  skillsCount: number;
  pendingFilesCount: number;
  conflictsCount: number;
  syncHealth: 'all_synced' | 'syncing' | 'offline_changes' | 'has_conflicts';
}
