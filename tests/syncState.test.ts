import { describe, it, expect } from 'vitest';
import { SyncEngineService } from '../apps/agent/src/sync/SyncService';
import { MOCK_DEVICES, MOCK_OVERALL_STATS } from '../packages/shared/src/mockData';

describe('Sync State Calculations', () => {
  it('should initialize sync engine summary without errors', async () => {
    const syncService = new SyncEngineService();
    const summary = await syncService.getSyncSummary();

    expect(summary.status).toBe('in-sync');
    expect(summary.pendingFiles).toBe(0);
    expect(summary.conflicts).toBe(0);
  });

  it('should accurately calculate online and offline devices count', () => {
    const onlineDevices = MOCK_DEVICES.filter((d) => d.online);
    const offlineDevices = MOCK_DEVICES.filter((d) => !d.online);

    expect(onlineDevices.length).toBe(2);
    expect(offlineDevices.length).toBe(1);
    expect(offlineDevices[0].sync.pendingFiles).toBe(142);
    expect(MOCK_OVERALL_STATS.onlineCount).toBe(onlineDevices.length);
  });
});
