import { describe, expect, it, vi } from 'vitest';
import { ContinuousSyncService } from '../apps/desktop/electron/continuousSync';

describe('ContinuousSyncService', () => {
  it('runs safe background reconciliation and reports truthful status', async () => {
    const runner = vi.fn(async () => ({ actions: [{ action: 'staged_updated' }], conflicts: [] }));
    const service = new ContinuousSyncService(runner, { enabled: true, intervalSeconds: 30, debounceMs: 250 });
    service.start([]);
    await service.run('manual');
    const status = service.getStatus();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(status.state).toBe('watching');
    expect(status.lastActionsCount).toBe(1);
    expect(status.lastSuccessAt).toBeTruthy();
    service.stop();
  });

  it('does not run when disabled', async () => {
    const runner = vi.fn(async () => ({ actions: [], conflicts: [] }));
    const service = new ContinuousSyncService(runner, { enabled: false, intervalSeconds: 30, debounceMs: 250 });
    service.start([]);
    await service.run('manual');
    expect(runner).not.toHaveBeenCalled();
    expect(service.getStatus().state).toBe('stopped');
  });

  it('queues an automatic retry after a transient failure', async () => {
    const runner = vi.fn(async () => { throw new Error('peer offline'); });
    const service = new ContinuousSyncService(runner, { enabled: true, intervalSeconds: 30, debounceMs: 250 });
    service.start([]);
    await service.run('manual');
    const status = service.getStatus();
    expect(status.state).toBe('retrying');
    expect(status.lastError).toBe('peer offline');
    expect(status.nextAttemptAt).toBeTruthy();
    service.stop();
  });
});
