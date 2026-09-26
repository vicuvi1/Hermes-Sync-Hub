import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { DeviceRegistryService } from '../apps/agent/src/devices/DeviceRegistry';
import { VaultService } from '../apps/agent/src/vault/VaultService';

const temporaryDirectories: string[] = [];
const temporaryDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-production-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('production readiness', () => {
  it('does not seed fictional peer devices in production mode', () => {
    const directory = temporaryDirectory();
    const identity = new DeviceIdentityService(directory);
    const registry = new DeviceRegistryService(identity, directory, false);
    const devices = registry.loadDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].deviceId).toBe(identity.getLocalDevice().deviceId);
    expect(devices.some((device) => device.deviceId === 'dev-zenbook-02')).toBe(false);
  });

  it('encrypts vault values on disk and returns redacted listings', async () => {
    const directory = temporaryDirectory();
    const vaultPath = path.join(directory, 'secrets.vault.enc');
    const vault = new VaultService(vaultPath, Buffer.alloc(32, 7));
    await vault.saveSecret({ id: 'secret-1', key: 'TEST_TOKEN', category: 'Auth Tokens', value: 'private-value', isMasked: true, updatedAt: new Date().toISOString(), originDevice: 'test' });
    expect(fs.readFileSync(vaultPath, 'utf8')).not.toContain('private-value');
    expect((await vault.listSecrets())[0].value).toBe('');
    expect((await vault.getSecret('secret-1'))?.value).toBe('private-value');
  });

  it('rejects an incorrect vault key without exposing plaintext', async () => {
    const directory = temporaryDirectory();
    const vaultPath = path.join(directory, 'secrets.vault.enc');
    await new VaultService(vaultPath, Buffer.alloc(32, 1)).saveSecret({ id: 'secret-1', key: 'KEY', category: 'Custom', value: 'hidden', isMasked: true, updatedAt: new Date().toISOString(), originDevice: 'test' });
    await expect(new VaultService(vaultPath, Buffer.alloc(32, 2)).listSecrets()).rejects.toThrow('Unable to decrypt vault');
  });
});
