import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type {
  SharedVaultStatus,
  VaultEnvironmentProfile,
  VaultEnvironmentVariable,
  VaultSecret,
} from '@hermes-hub/types';

type StoredSecret = Omit<VaultSecret, 'isMasked'>;
type StoredVariable = Omit<VaultEnvironmentVariable, 'isMasked'>;
type StoredEnvironment = Omit<VaultEnvironmentProfile, 'variables'> & { variables: StoredVariable[] };

interface VaultPayload {
  secrets: StoredSecret[];
  environments: StoredEnvironment[];
}

interface SharedVaultFile {
  version: 2;
  kdf: 'scrypt';
  salt: string;
  iv: string;
  authTag: string;
  payload: string;
  revision: number;
  updatedAt: string;
  counts: { secrets: number; environments: number };
}

const EMPTY_PAYLOAD: VaultPayload = { secrets: [], environments: [] };

/**
 * A password-unlocked vault designed to be transported by Syncthing. The file
 * contains the KDF salt and authenticated ciphertext only; the password and
 * derived key are never written by this service.
 */
export class SharedVaultService {
  private key: Buffer | null = null;

  constructor(private readonly vaultPath: string, private readonly originDevice: string) {}

  getPath(): string { return this.vaultPath; }
  isConfigured(): boolean { return existsSync(this.vaultPath); }
  isLocked(): boolean { return this.key === null; }

  async setup(password: string, initialSecrets: VaultSecret[] = []): Promise<Buffer> {
    if (this.isConfigured()) throw new Error('The shared vault is already configured. Unlock it instead.');
    this.requirePassword(password);
    const salt = randomBytes(16);
    this.key = this.deriveKey(password, salt);
    await this.writePayload({
      ...EMPTY_PAYLOAD,
      secrets: initialSecrets.map(({ isMasked: _masked, ...secret }) => ({ ...secret, originDevice: secret.originDevice || this.originDevice })),
    }, salt, 0);
    return Buffer.from(this.key);
  }

  async unlock(password: string): Promise<Buffer> {
    this.requirePassword(password);
    const file = await this.readFile();
    const key = this.deriveKey(password, Buffer.from(file.salt, 'base64'));
    this.decrypt(file, key);
    this.key = key;
    return Buffer.from(key);
  }

  async unlockWithKey(key: Buffer): Promise<void> {
    if (key.length !== 32) throw new Error('Remembered vault key is invalid.');
    const file = await this.readFile();
    this.decrypt(file, key);
    this.key = Buffer.from(key);
  }

  lock(): void {
    this.key?.fill(0);
    this.key = null;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<Buffer> {
    await this.unlock(currentPassword);
    this.requirePassword(newPassword);
    const data = await this.readPayload();
    const salt = randomBytes(16);
    this.key?.fill(0);
    this.key = this.deriveKey(newPassword, salt);
    await this.writePayload(data, salt, (await this.readFile()).revision);
    return Buffer.from(this.key);
  }

  async getStatus(rememberedOnThisPc: boolean): Promise<SharedVaultStatus> {
    const configured = this.isConfigured();
    let revision = 0;
    let updatedAt: string | undefined;
    let secretCount = 0;
    let environmentCount = 0;
    if (configured) {
      try {
        const file = await this.readFile();
        revision = file.revision;
        updatedAt = file.updatedAt;
        secretCount = file.counts?.secrets || 0;
        environmentCount = file.counts?.environments || 0;
      } catch {}
    }
    const vaultDir = dirname(this.vaultPath);
    const conflictFiles = existsSync(vaultDir)
      ? readdirSync(vaultDir).filter((name) => /sync-conflict|conflicted copy/i.test(name)).map((name) => basename(name))
      : [];
    return { configured, locked: this.isLocked(), rememberedOnThisPc, syncPath: dirname(this.vaultPath), updatedAt, revision, secretCount, environmentCount, conflictFiles };
  }

  async listSecrets(): Promise<VaultSecret[]> {
    return (await this.readPayload()).secrets.map((secret) => ({ ...secret, value: '', isMasked: true }));
  }

  async getSecret(id: string): Promise<VaultSecret | null> {
    const secret = (await this.readPayload()).secrets.find((item) => item.id === id);
    return secret ? { ...secret, isMasked: false } : null;
  }

  async saveSecret(secret: VaultSecret): Promise<VaultSecret> {
    const data = await this.readPayload();
    const { isMasked: _masked, ...stored } = secret;
    stored.updatedAt = new Date().toISOString();
    stored.originDevice ||= this.originDevice;
    const index = data.secrets.findIndex((item) => item.id === secret.id);
    if (index >= 0) data.secrets[index] = stored; else data.secrets.unshift(stored);
    await this.writeCurrent(data);
    return { ...stored, value: '', isMasked: true };
  }

  async deleteSecret(id: string): Promise<boolean> {
    const data = await this.readPayload();
    const next = data.secrets.filter((item) => item.id !== id);
    if (next.length === data.secrets.length) return false;
    data.secrets = next;
    await this.writeCurrent(data);
    return true;
  }

  async listEnvironments(): Promise<VaultEnvironmentProfile[]> {
    return (await this.readPayload()).environments.map((profile) => ({
      ...profile,
      variables: profile.variables.map((variable) => ({ ...variable, value: '', isMasked: true })),
    }));
  }

  async getEnvironment(id: string): Promise<VaultEnvironmentProfile | null> {
    const profile = (await this.readPayload()).environments.find((item) => item.id === id);
    return profile ? { ...profile, variables: profile.variables.map((variable) => ({ ...variable, isMasked: false })) } : null;
  }

  async saveEnvironment(profile: VaultEnvironmentProfile): Promise<VaultEnvironmentProfile> {
    const data = await this.readPayload();
    const stored: StoredEnvironment = {
      ...profile,
      updatedAt: new Date().toISOString(),
      originDevice: profile.originDevice || this.originDevice,
      variables: profile.variables.map(({ isMasked: _masked, ...variable }) => variable),
    };
    const index = data.environments.findIndex((item) => item.id === profile.id);
    if (index >= 0) data.environments[index] = stored; else data.environments.unshift(stored);
    await this.writeCurrent(data);
    return { ...stored, variables: stored.variables.map((variable) => ({ ...variable, value: '', isMasked: true })) };
  }

  async deleteEnvironment(id: string): Promise<boolean> {
    const data = await this.readPayload();
    const next = data.environments.filter((item) => item.id !== id);
    if (next.length === data.environments.length) return false;
    data.environments = next;
    await this.writeCurrent(data);
    return true;
  }

  private requirePassword(password: string): void {
    if (typeof password !== 'string' || password.length < 8 || password.length > 512) {
      throw new Error('Vault password must contain at least 8 characters.');
    }
  }

  private deriveKey(password: string, salt: Buffer): Buffer {
    return scryptSync(password.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 });
  }

  private aad(file: Pick<SharedVaultFile, 'version' | 'salt'>): Buffer {
    return Buffer.from(`hermes-hub-shared-vault:${file.version}:${file.salt}`, 'utf8');
  }

  private decrypt(file: SharedVaultFile, key: Buffer): VaultPayload {
    if (file.version !== 2 || file.kdf !== 'scrypt') throw new Error('Unsupported shared vault format.');
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(file.iv, 'base64'));
      decipher.setAAD(this.aad(file));
      decipher.setAuthTag(Buffer.from(file.authTag, 'base64'));
      const clear = Buffer.concat([decipher.update(Buffer.from(file.payload, 'base64')), decipher.final()]);
      const data = JSON.parse(clear.toString('utf8')) as VaultPayload;
      if (!Array.isArray(data.secrets) || !Array.isArray(data.environments)) throw new Error('Invalid payload');
      return data;
    } catch {
      throw new Error('Unable to unlock the shared vault. Check the password or resolve the synchronized vault conflict.');
    }
  }

  private async readFile(): Promise<SharedVaultFile> {
    if (!this.isConfigured()) throw new Error('Shared Vault has not been configured yet.');
    return JSON.parse(await readFile(this.vaultPath, 'utf8')) as SharedVaultFile;
  }

  private async readPayload(): Promise<VaultPayload> {
    if (!this.key) throw new Error('Shared Vault is locked. Enter the shared password first.');
    return this.decrypt(await this.readFile(), this.key);
  }

  private async writeCurrent(data: VaultPayload): Promise<void> {
    if (!this.key) throw new Error('Shared Vault is locked.');
    const file = await this.readFile();
    await this.writePayload(data, Buffer.from(file.salt, 'base64'), file.revision);
  }

  private async writePayload(data: VaultPayload, salt: Buffer, previousRevision: number): Promise<void> {
    if (!this.key) throw new Error('Shared Vault is locked.');
    await mkdir(dirname(this.vaultPath), { recursive: true });
    const iv = randomBytes(12);
    const saltText = salt.toString('base64');
    const header = { version: 2 as const, salt: saltText };
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(this.aad(header));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const file: SharedVaultFile = {
      version: 2,
      kdf: 'scrypt',
      salt: saltText,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      payload: encrypted.toString('base64'),
      revision: previousRevision + 1,
      updatedAt: new Date().toISOString(),
      counts: { secrets: data.secrets.length, environments: data.environments.length },
    };
    const temporaryPath = `${this.vaultPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(file), { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.vaultPath);
  }
}
