export type OperatingSystem = 'windows' | 'macos' | 'linux';
export type SyncStatusType = 'in-sync' | 'syncing' | 'pending' | 'offline' | 'conflict';
export type HealthStatusType = 'healthy' | 'warning' | 'degraded' | 'offline';

export interface TailscalePeer {
  id: string;
  hostname: string;
  dnsName: string;
  os: string;
  tailscaleIps: string[];
  ipv4?: string;
  online: boolean;
  active: boolean;
  curAddr?: string;
  relay?: string;
  connectionType: 'direct' | 'derp-relay' | 'offline';
  lastSeen?: string;
}

export interface TailscaleState {
  installed: boolean;
  connected: boolean;
  backendState: 'Running' | 'Stopped' | 'NeedsLogin' | 'Starting' | 'NoState' | 'NotInstalled';
  version?: string;
  self?: {
    id: string;
    hostname: string;
    dnsName: string;
    tailscaleIps: string[];
    ipv4?: string;
    ipv6?: string;
    online: boolean;
  };
  peers: TailscalePeer[];
  tailnetName?: string;
  magicDnsSuffix?: string;
  directPeersCount: number;
  relayedPeersCount: number;
}

export interface DeviceTailscaleState {
  installed: boolean;
  connected: boolean;
  ip?: string;
  connectionType?: 'direct' | 'derp-relay' | 'offline' | 'unknown';
  peersCount?: number;
}

export interface SyncthingDevice {
  id: string;
  name: string;
  addresses: string[];
  connected: boolean;
  address?: string;
  clientVersion?: string;
  inBytesTotal?: number;
  outBytesTotal?: number;
  lastSeen?: string;
  paused: boolean;
}

export interface SyncthingFolder {
  id: string;
  label: string;
  path: string;
  type: 'sendreceive' | 'sendonly' | 'receiveonly';
  state: 'idle' | 'syncing' | 'scanning' | 'error' | 'unknown';
  globalFiles: number;
  globalBytes: number;
  localFiles: number;
  localBytes: number;
  needFiles: number;
  needBytes: number;
  pullErrors: number;
  paused: boolean;
  devices: string[];
}

export interface SyncthingConnectionState {
  totalConnections: number;
  activeConnections: number;
  connections: Record<
    string,
    {
      connected: boolean;
      paused: boolean;
      address?: string;
      type?: string;
      inBytesTotal: number;
      outBytesTotal: number;
      clientVersion?: string;
    }
  >;
}

export interface SyncthingTransferState {
  inRateBytesPerSec: number;
  outRateBytesPerSec: number;
  totalNeedBytes: number;
  totalGlobalBytes: number;
  completionPercentage: number;
  isSyncing: boolean;
  activeTransfers: ActiveTransfer[];
}

export interface SyncthingState {
  installed: boolean;
  running: boolean;
  version?: string;
  myID?: string;
  guiAddress?: string;
  apiUrl: string;
  uptimeSeconds?: number;
  devices: SyncthingDevice[];
  folders: SyncthingFolder[];
  connectionState: SyncthingConnectionState;
  transferState: SyncthingTransferState;
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

export interface DeviceComparison {
  deviceA: Device;
  deviceB: Device;
  versionMatch: boolean;
  sessionsDiff: {
    deviceACount: number;
    deviceBCount: number;
    delta: number;
  };
  memoriesDiff: {
    deviceACount: number;
    deviceBCount: number;
    delta: number;
  };
  skillsDiff: {
    deviceACount: number;
    deviceBCount: number;
    delta: number;
  };
  dataSizeDiff: {
    deviceABytes: number;
    deviceBBytes: number;
    deltaBytes: number;
  };
  syncStatus: 'identical' | 'ahead' | 'behind' | 'diverged';
}

export interface PairingIssuer {
  deviceId: string;
  deviceName: string;
  hostname: string;
  os: 'windows' | 'linux' | 'macos';
  tailscaleIp?: string;
  syncthingId?: string;
  agentPort: number;
}

export interface PairingInvitation {
  invitationId: string;
  code: string;
  encodedPayload: string;
  issuer: PairingIssuer;
  token: string;
  createdAt: string;
  expiresAt: string;
  isExpired?: boolean;
}

export interface PairingValidationResult {
  valid: boolean;
  error?: string;
  invitation?: {
    code: string;
    issuer: PairingIssuer;
    expiresAt: string;
  };
}

export interface PairingJoinPayload {
  codeOrPayload: string;
  joinerDevice?: Partial<Device>;
}

export type PairingStepId =
  | 'validate_token'
  | 'detect_hermes'
  | 'syncthing_link'
  | 'tailscale_verify'
  | 'registry_enroll'
  | 'initial_sync';

export interface PairingProgressStep {
  stepId: PairingStepId;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  message?: string;
  timestamp: string;
}

export interface PairingExecutionResult {
  success: boolean;
  pairedDevice: Device;
  steps: PairingProgressStep[];
  error?: string;
}

// Milestone 8 Workspace, Manifest & Snapshot Types
export interface WorkspaceStatus {
  rootPath: string;
  isInitialized: boolean;
  layout: {
    manifests: string;
    snapshots: string;
    devices: string;
    memories: string;
    skills: string;
    configs: string;
    backups: string;
    activity: string;
  };
  totalFiles: number;
  totalSizeBytes: number;
  activeManifestRevision: number;
  lastSnapshotAt?: string;
  categoriesBreakdown?: Record<string, number>;
}

export type WorkspaceFileCategory = 'skill' | 'memory' | 'session' | 'config' | 'snapshot' | 'other';

export interface ManifestFileEntry {
  id: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  modifiedAt: string;
  category: WorkspaceFileCategory;
  originDevice: string;
  revision: number;
}

export interface ClusterManifest {
  manifestId: string;
  deviceId: string;
  revision: number;
  generatedAt: string;
  files: ManifestFileEntry[];
  stats: {
    totalFiles: number;
    totalSizeBytes: number;
    categoriesCount: Record<string, number>;
  };
}

export interface ManifestVerificationResult {
  valid: boolean;
  verifiedAt: string;
  totalChecked: number;
  matchingCount: number;
  tamperedFiles: Array<{
    relativePath: string;
    expectedSha256: string;
    actualSha256: string;
  }>;
  missingFiles: string[];
}

export interface SafeSnapshotRecord {
  id: string;
  name: string;
  createdAt: string;
  originDevice: string;
  sourceDatabases: string[];
  sizeBytes: number;
  sha256: string;
  recordCounts: {
    sessions: number;
    memories: number;
    skills: number;
    projects: number;
  };
  isClean: boolean;
  filePath: string;
}

