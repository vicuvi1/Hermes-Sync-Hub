import { describe, expect, it } from 'vitest';
import { isSensitiveRepositoryPath } from '../apps/desktop/electron/sourceRepository';

describe('source repository safety', () => {
  it.each([
    '.env',
    '.env.production',
    'config/credentials.json',
    'private-keys/github.pem',
    'data/hermes.sqlite',
    'runtime/vault/secrets.json',
  ])('blocks sensitive path %s', (filePath) => {
    expect(isSensitiveRepositoryPath(filePath)).toBe(true);
  });

  it.each([
    'README.md',
    'apps/desktop/src/App.tsx',
    'packages/types/src/index.ts',
    'docs/token-design.md',
  ])('allows ordinary source path %s', (filePath) => {
    expect(isSensitiveRepositoryPath(filePath)).toBe(false);
  });
});
