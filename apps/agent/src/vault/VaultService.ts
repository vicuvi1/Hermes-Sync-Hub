import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { VaultSecret } from '@hermes-hub/types';

type StoredSecret = Omit<VaultSecret, 'isMasked'>;
interface EncryptedVault { version: 1; iv: string; authTag: string; payload: string; }

/**
 * Encrypted file vault. The caller must provide key material sourced from the
 * operating-system credential store; the key is never persisted by this service.
 */
export class VaultService {
  private readonly key: Buffer;

  constructor(private readonly vaultPath: string, masterKey: Buffer | string) {
    if (!masterKey || masterKey.length < 16) throw new Error('Vault master key must contain at least 16 bytes');
    this.key = createHash('sha256').update(masterKey).digest();
  }

  async listSecrets(): Promise<VaultSecret[]> {
    const secrets = await this.readSecrets();
    return secrets.map((secret) => ({ ...secret, value: '', isMasked: true }));
  }

  async getSecret(id: string): Promise<VaultSecret | null> {
    const secret = (await this.readSecrets()).find((item) => item.id === id);
    return secret ? { ...secret, isMasked: false } : null;
  }

  async saveSecret(secret: VaultSecret): Promise<VaultSecret> {
    const secrets = await this.readSecrets();
    const { isMasked: _isMasked, ...stored } = secret;
    const index = secrets.findIndex((item) => item.id === secret.id);
    if (index >= 0) secrets[index] = stored; else secrets.unshift(stored);
    await this.writeSecrets(secrets);
    return { ...stored, value: '', isMasked: true };
  }

  async deleteSecret(id: string): Promise<boolean> {
    const secrets = await this.readSecrets();
    const remaining = secrets.filter((item) => item.id !== id);
    if (remaining.length === secrets.length) return false;
    await this.writeSecrets(remaining);
    return true;
  }

  private async readSecrets(): Promise<StoredSecret[]> {
    try {
      const vault = JSON.parse(await readFile(this.vaultPath, 'utf8')) as EncryptedVault;
      if (vault.version !== 1) throw new Error('Unsupported vault format');
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(vault.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(vault.authTag, 'base64'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(vault.payload, 'base64')), decipher.final()]);
      return JSON.parse(plaintext.toString('utf8')) as StoredSecret[];
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw new Error('Unable to decrypt vault. The key may be incorrect or the vault may be damaged.');
    }
  }

  private async writeSecrets(secrets: StoredSecret[]): Promise<void> {
    await mkdir(dirname(this.vaultPath), { recursive: true });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(secrets), 'utf8'), cipher.final()]);
    const vault: EncryptedVault = { version: 1, iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), payload: encrypted.toString('base64') };
    const temporaryPath = `${this.vaultPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(vault), { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.vaultPath);
  }
}
