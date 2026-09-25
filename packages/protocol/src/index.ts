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
} as const;

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
