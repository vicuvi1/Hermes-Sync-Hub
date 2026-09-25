import { describe, it, expect } from 'vitest';
import { HermesDiscoveryService } from '../apps/agent/src/discovery/HermesDiscovery';
import { MockHermesAdapter } from '../apps/agent/src/hermes/HermesAdapter';

describe('Hermes Discovery & Adapter Abstraction', () => {
  it('should provide candidate search paths for discovery', () => {
    const discovery = new HermesDiscoveryService();
    const candidates = discovery.getCandidatePaths();

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((p) => p.includes('hermes'))).toBe(true);
  });

  it('should detect hermes status through mock adapter abstraction', async () => {
    const adapter = new MockHermesAdapter();
    const install = await adapter.detect();
    const state = await adapter.getState();

    expect(install).not.toBeNull();
    expect(install?.version).toBe('0.21.5');
    expect(state.installed).toBe(true);
    expect(state.running).toBe(true);
    expect(state.home).toBeDefined();
  });
});
