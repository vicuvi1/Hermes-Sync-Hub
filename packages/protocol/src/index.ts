import { Device, ActiveTransfer, HealthStatusType, OperatingSystem } from '@hermes-hub/types';

export const IPC_CHANNELS = {
  GET_DEVICES: 'hermes-hub:get-devices',
  GET_DEVICE_DETAIL: 'hermes-hub:get-device-detail',
  GET_OVERALL_STATS: 'hermes-hub:get-overall-stats',
  GET_ACTIVE_TRANSFER: 'hermes-hub:get-active-transfer',
  TRIGGER_SYNC_NOW: 'hermes-hub:trigger-sync-now',
  GENERATE_PAIRING_CODE: 'hermes-hub:generate-pairing-code',
  JOIN_WITH_CODE: 'hermes-hub:join-with-code',
  GET_SESSIONS: 'hermes-hub:get-sessions',
  GET_MEMORIES: 'hermes-hub:get-memories',
  GET_SKILLS: 'hermes-hub:get-skills',
  GET_FILES: 'hermes-hub:get-files',
  GET_VAULT_SECRETS: 'hermes-hub:get-vault-secrets',
  SAVE_VAULT_SECRET: 'hermes-hub:save-vault-secret',
  GET_ACTIVITY: 'hermes-hub:get-activity',
  GET_BACKUPS: 'hermes-hub:get-backups',
  CREATE_BACKUP: 'hermes-hub:create-backup',
  EXPORT_DIAGNOSTICS: 'hermes-hub:export-diagnostics',
  OPEN_EXTERNAL_URL: 'hermes-hub:open-external-url',
  OPEN_FOLDER: 'hermes-hub:open-folder',

  // Milestone 2 Local Agent channels
  GET_LOCAL_DEVICE: 'hermes-hub:get-local-device',
  GET_AGENT_HEALTH: 'hermes-hub:get-agent-health',
  PING_AGENT: 'hermes-hub:ping-agent',

  // Milestone 3 Hermes Detection channels
  GET_HERMES_STATUS: 'hermes-hub:get-hermes-status',

  // Milestone 4 Tailscale Integration channels
  GET_TAILSCALE_STATE: 'hermes-hub:get-tailscale-state',
  PING_TAILSCALE_PEER: 'hermes-hub:ping-tailscale-peer',

  // Milestone 5 Syncthing Integration channels
  GET_SYNCTHING_STATE: 'hermes-hub:get-syncthing-state',

  // Milestone 6 Device Management channels
  ADD_DEVICE: 'hermes-hub:add-device',
  REMOVE_DEVICE: 'hermes-hub:remove-device',
  UPDATE_DEVICE: 'hermes-hub:update-device',
  COMPARE_DEVICES: 'hermes-hub:compare-devices',

  // Milestone 7 Pairing Workflow channels
  GENERATE_PAIRING_INVITATION: 'hermes-hub:generate-pairing-invitation',
  GET_ACTIVE_PAIRING_INVITATION: 'hermes-hub:get-active-pairing-invitation',
  VALIDATE_PAIRING_CODE: 'hermes-hub:validate-pairing-code',
  EXECUTE_PAIRING: 'hermes-hub:execute-pairing',

  // Milestone 8 Managed Workspace, Manifests & Snapshots channels
  GET_WORKSPACE_STATUS: 'hermes-hub:get-workspace-status',
  INIT_WORKSPACE: 'hermes-hub:init-workspace',
  GET_MANIFEST: 'hermes-hub:get-manifest',
  GENERATE_MANIFEST: 'hermes-hub:generate-manifest',
  VERIFY_MANIFEST: 'hermes-hub:verify-manifest',
  GET_SNAPSHOTS: 'hermes-hub:get-snapshots',
  CREATE_SAFE_SNAPSHOT: 'hermes-hub:create-safe-snapshot',

  // Milestone 9 Safe Synchronization channels
  TRIGGER_SYNC_CYCLE: 'hermes-hub:trigger-sync-cycle',
  GET_SYNC_SUMMARY: 'hermes-hub:get-sync-summary',
  GET_SYNC_CONFLICTS: 'hermes-hub:get-sync-conflicts',
  RESOLVE_SYNC_CONFLICT: 'hermes-hub:resolve-sync-conflict',

  // Milestone 10 Safe Session Access, Export & Import channels
  GET_SESSION_DETAIL: 'hermes-hub:get-session-detail',
  EXPORT_SESSION: 'hermes-hub:export-session',
  IMPORT_SESSION: 'hermes-hub:import-session',

  // Milestone 12 Backups & Revisions channels
  VERIFY_BACKUP: 'hermes-hub:verify-backup',
  RESTORE_BACKUP: 'hermes-hub:restore-backup',
  DELETE_BACKUP: 'hermes-hub:delete-backup',
  GET_FILE_REVISIONS: 'hermes-hub:get-file-revisions',
  ROLLBACK_REVISION: 'hermes-hub:rollback-revision',

  // Milestone 13 Polish & Diagnostics channels
  GET_APP_SETTINGS: 'hermes-hub:get-app-settings',
  UPDATE_APP_SETTINGS: 'hermes-hub:update-app-settings',
  SHOW_NOTIFICATION: 'hermes-hub:show-notification',
  GET_DIAGNOSTICS_REPORT: 'hermes-hub:get-diagnostics-report',
  GITHUB_UPDATE: 'hermes-hub:github-update',
  CHECK_FOR_UPDATES: 'hermes-hub:check-for-updates',
  DOWNLOAD_AND_INSTALL_UPDATE: 'hermes-hub:download-and-install-update',
  GET_APP_VERSION: 'hermes-hub:get-app-version',
  UPDATE_STATUS: 'hermes-hub:update-status',
  GET_RUNTIME_HEALTH: 'hermes-hub:get-runtime-health',
  GET_ONBOARDING_STATE: 'hermes-hub:get-onboarding-state',
  COMPLETE_ONBOARDING: 'hermes-hub:complete-onboarding',
  GET_VAULT_SECRET: 'hermes-hub:get-vault-secret',
  DELETE_VAULT_SECRET: 'hermes-hub:delete-vault-secret',
} as const;

export interface GithubUpdateResult {
  success: boolean;
  status: 'up-to-date' | 'updated' | 'blocked' | 'failed';
  message: string;
  previousCommit?: string;
  currentCommit?: string;
  restartScheduled?: boolean;
}

export interface PairingCodePayload {
  code: string; // e.g. "HERMES-84Q2-KM7D"
  createdAt: string;
  expiresAt: string;
  initiatorDevice: Partial<Device>;
  syncthingDeviceId: string;
  tailscaleIp?: string;
}

export interface PairingResult {
  success: boolean;
  message: string;
  pairedDevice?: Device;
  stepsCompleted: {
    identityVerified: boolean;
    tailscaleConnected: boolean;
    syncthingPaired: boolean;
    hermesDiscovered: boolean;
    initialSyncStarted: boolean;
  };
}

export interface AgentHealthResponse {
  status: HealthStatusType;
  uptimeSeconds: number;
  version: string;
  deviceId: string;
  hostname: string;
  os: OperatingSystem;
  pid: number;
  timestamp: string;
  memoryUsageMb: {
    rss: number;
    heapUsed: number;
  };
}

export interface SystemHardwareInfo {
  hostname: string;
  os: OperatingSystem;
  platform: string;
  release: string;
  version: string;
  architecture: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  uptimeSeconds: number;
}
