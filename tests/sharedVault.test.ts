import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SharedVaultService } from '../apps/agent/src/vault/SharedVaultService';

const directories: string[] = [];
const temporaryVault = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-shared-vault-'));
  directories.push(directory);
  return path.join(directory, 'vault', 'shared-vault.enc');
};

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('SharedVaultService', () => {
  it('creates encrypted portable vault data and redacts list results', async () => {
    const vaultPath = temporaryVault();
    const vault = new SharedVaultService(vaultPath, 'Desktop');
    await vault.setup('correct horse battery staple');
    await vault.saveSecret({ id: 'github', key: 'GITHUB_TOKEN', category: 'Auth Tokens', value: 'ghp-private-value', isMasked: false, updatedAt: '', originDevice: '' });
    const onDisk = fs.readFileSync(vaultPath, 'utf8');
    expect(onDisk).not.toContain('ghp-private-value');
    expect((await vault.listSecrets())[0].value).toBe('');
    expect((await vault.getSecret('github'))?.value).toBe('ghp-private-value');
  });

  it('unlocks the same synchronized file with the same password on another device', async () => {
    const vaultPath = temporaryVault();
    const desktop = new SharedVaultService(vaultPath, 'Desktop');
    await desktop.setup('one shared password');
    await desktop.saveSecret({ id: 'ssh', key: 'SSH_KEY', category: 'SSH Keys', value: 'private-key', isMasked: false, updatedAt: '', originDevice: '' });
    desktop.lock();
    const laptop = new SharedVaultService(vaultPath, 'Laptop');
    await laptop.unlock('one shared password');
    expect((await laptop.getSecret('ssh'))?.value).toBe('private-key');
  });

  it('rejects a wrong password and remains locked', async () => {
    const vaultPath = temporaryVault();
    await new SharedVaultService(vaultPath, 'Desktop').setup('right-password');
    const other = new SharedVaultService(vaultPath, 'Laptop');
    await expect(other.unlock('wrong-password')).rejects.toThrow('Unable to unlock');
    expect(other.isLocked()).toBe(true);
  });

  it('stores environment profiles encrypted and returns masked listings', async () => {
    const vaultPath = temporaryVault();
    const vault = new SharedVaultService(vaultPath, 'Desktop');
    await vault.setup('environment-password');
    await vault.saveEnvironment({ id: 'dev', name: 'Development', variables: [{ key: 'OPENAI_API_KEY', value: 'secret-key', isMasked: false }], updatedAt: '', originDevice: '' });
    expect(fs.readFileSync(vaultPath, 'utf8')).not.toContain('secret-key');
    expect((await vault.listEnvironments())[0].variables[0].value).toBe('');
    expect((await vault.getEnvironment('dev'))?.variables[0].value).toBe('secret-key');
  });

  it('re-encrypts with a new password', async () => {
    const vaultPath = temporaryVault();
    const vault = new SharedVaultService(vaultPath, 'Desktop');
    await vault.setup('original-password');
    await vault.saveSecret({ id: 'one', key: 'ONE', category: 'Custom', value: 'value', isMasked: false, updatedAt: '', originDevice: '' });
    await vault.changePassword('original-password', 'replacement-password');
    vault.lock();
    await expect(vault.unlock('original-password')).rejects.toThrow();
    await vault.unlock('replacement-password');
    expect((await vault.getSecret('one'))?.value).toBe('value');
  });
});
