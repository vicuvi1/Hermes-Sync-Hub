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
  sha256?: string;
  filePath?: string;
  notes?: string;
  snapshotId?: string;
  verifiedAt?: string;
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

// Milestone 9 File-Based Safe Synchronization Types
export type SyncCategory = 'skills' | 'memories' | 'configuration';

export interface SyncCycleOptions {
  categories?: SyncCategory[];
  force?: boolean;
  dryRun?: boolean;
}

export interface SyncFileAction {
  relativePath: string;
  category: SyncCategory;
  action: 'staged_new' | 'staged_updated' | 'unchanged' | 'conflict' | 'applied_to_local';
  sha256: string;
  sizeBytes: number;
  originDevice?: string;
  message?: string;
}

export interface SyncCycleResult {
  success: boolean;
  cycleId: string;
  startedAt: string;
  completedAt: string;
  summary: DeviceSyncSummary;
  actions: SyncFileAction[];
  conflicts: ConflictItem[];
  stagedCounts: {
    skills: number;
    memories: number;
    configs: number;
  };
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'use_local' | 'use_remote' | 'keep_both';
}

// Milestone 10 Session Access, Export & Import Types
export interface HermesMessage {
  id: number | string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string | number;
  tokenCount?: number;
  toolCallId?: string;
  toolName?: string;
  reasoning?: string;
  toolCalls?: Array<{
    id: string;
    type?: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface HermesSessionDetail extends HermesSession {
  messages: HermesMessage[];
  systemPrompt?: string;
  cwd?: string;
  gitBranch?: string;
  costUsd?: number;
  endReason?: string;
}

export type SessionExportFormat = 'jsonl' | 'markdown' | 'html' | 'json';

export interface SessionExportOptions {
  sessionId?: string;
  format?: SessionExportFormat;
  redactSecrets?: boolean;
  outputPath?: string;
}

export interface SessionExportResult {
  success: boolean;
  exportedCount: number;
  format: SessionExportFormat;
  content?: string;
  filePath?: string;
  error?: string;
}

export interface SessionImportPayload {
  filePath?: string;
  content?: string;
  sessions?: any[];
}

export interface SessionImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  importedIds: string[];
  skippedIds: string[];
  errors: string[];
}

// Milestone 12: Backups and Revisions
export interface BackupOptions {
  name?: string;
  notes?: string;
  targetPath?: string;
  retainCount?: number;
}

export interface BackupVerificationResult {
  valid: boolean;
  backupId: string;
  checkedAt: string;
  totalFiles: number;
  matchingFiles: number;
  errors: string[];
  missingFiles: string[];
  tamperedFiles: string[];
}

export interface BackupRestoreOptions {
  backupId: string;
  targetHome?: string;
  overwrite?: boolean;
  emergencyRollback?: boolean;
}

export interface BackupRestoreResult {
  success: boolean;
  backupId: string;
  restoredAt: string;
  restoredFilesCount: number;
  safetyRollbackSnapshotId?: string;
  error?: string;
}

export interface FileRevision {
  revision: number;
  filePath: string;
  category: string;
  modifiedAt: string;
  deviceId: string;
  deviceName: string;
  sha256: string;
  sizeBytes: number;
  author?: string;
  changeSummary?: string;
  contentSnippet?: string;
}

export interface RevisionHistory {
  filePath: string;
  currentRevision: number;
  totalRevisions: number;
  revisions: FileRevision[];
}

export interface RevisionRollbackResult {
  success: boolean;
  filePath: string;
  previousRevision: number;
  currentRevision: number;
  rolledBackAt: string;
  message: string;
}

// Milestone 13: Polish (Settings, Tray, Notifications, Diagnostics)
export type AppTheme = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: AppTheme;
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  notificationsEnabled: boolean;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly';
  maxBackupsToRetain: number;
  demoMode: boolean;
  onboardingCompleted: boolean;
  autoCheckUpdates: boolean;
  autoInstallUpdates: boolean;
  hermesHome?: string;
  workspacePath?: string;
  repositoryWorkspacePath?: string;
}

export interface SourceRepositoryStatus {
  repositoryUrl: string;
  workspacePath: string;
  configured: boolean;
  gitAvailable: boolean;
  validRepository: boolean;
  branch?: string;
  commit?: string;
  changedFiles: string[];
  ahead: number;
  behind: number;
  message: string;
}

export interface SourceRepositoryPushInput {
  workspacePath: string;
  commitMessage: string;
  confirmed: boolean;
}

export interface SourceRepositoryResult {
  success: boolean;
  message: string;
  status: SourceRepositoryStatus;
}

export type RuntimeServiceState = 'healthy' | 'unavailable' | 'misconfigured' | 'offline' | 'error';

export interface RuntimeServiceHealth {
  state: RuntimeServiceState;
  label: string;
  detail: string;
  required: boolean;
}

export interface RuntimeHealth {
  checkedAt: string;
  overall: 'ready' | 'attention' | 'setup-required';
  services: {
    agent: RuntimeServiceHealth;
    hermes: RuntimeServiceHealth;
    tailscale: RuntimeServiceHealth;
    syncthing: RuntimeServiceHealth;
    workspace: RuntimeServiceHealth;
  };
  lastSuccessfulSync?: string;
}

export interface OnboardingState {
  completed: boolean;
  detectedHermesHome?: string;
  configuredHermesHome?: string;
  workspacePath: string;
  runtime: RuntimeHealth;
}

export interface CompleteOnboardingInput {
  hermesHome?: string;
  workspacePath?: string;
  demoMode: boolean;
}

export type AppUpdateState =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'restart-pending'
  | 'offline'
  | 'failed';

export interface AppUpdateInfo {
  state: AppUpdateState;
  currentVersion: string;
  latestVersion?: string;
  message: string;
  releaseName?: string;
  releaseNotes?: string;
  packaged: boolean;
}

export interface AppUpdateProgress extends AppUpdateInfo {
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
}

export interface DiagnosticsReport {
  generatedAt: string;
  system: {
    hostname: string;
    os: string;
    platform: string;
    arch: string;
    cpuCores: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
  };
  agent: {
    status: string;
    uptimeSeconds: number;
    pid: number;
    rssMemoryMb: number;
    loopbackPort: number;
  };
  hermes: {
    installed: boolean;
    running: boolean;
    version: string;
    home: string;
    detectedDatabases: string[];
  };
  tailscale: {
    installed: boolean;
    connected: boolean;
    backendState?: string;
    selfIp?: string;
    peersCount: number;
  };
  syncthing: {
    installed: boolean;
    running: boolean;
    deviceId?: string;
    foldersCount: number;
    devicesCount: number;
  };
  workspace: {
    rootPath: string;
    manifestValid: boolean;
    totalTrackedFiles: number;
    snapshotsCount: number;
    backupsCount: number;
  };
  recentLogs: string[];
}




