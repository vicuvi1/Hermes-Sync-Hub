import { DeviceSyncSummary } from '@hermes-hub/types';

export class SyncEngineService {
  async getSyncSummary(): Promise<DeviceSyncSummary> {
    return {
      lastSync: new Date().toISOString(),
      pendingFiles: 0,
      filesTransferred: 0,
      bytesUploaded: 0,
      bytesDownloaded: 0,
      conflicts: 0,
      status: 'in-sync',
    };
  }
}
