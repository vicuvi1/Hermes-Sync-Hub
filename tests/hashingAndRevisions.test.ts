import { describe, it, expect } from 'vitest';
import { simpleSha256, isRevisionNewer } from '../packages/shared/src/hashing';

describe('Hashing & Revision Comparison', () => {
  it('should generate deterministic sha256 digests', () => {
    const content = '# User Context\nLanguage: TypeScript';
    const hash1 = simpleSha256(content);
    const hash2 = simpleSha256(content);
    const diffHash = simpleSha256(content + ' modified');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(diffHash);
    expect(hash1.startsWith('sha256-')).toBe(true);
  });

  it('should correctly compare revision numbers', () => {
    expect(isRevisionNewer(142, 141)).toBe(true);
    expect(isRevisionNewer(140, 142)).toBe(false);
    expect(isRevisionNewer(5, 5)).toBe(false);
  });

  it('should detect conflicting concurrent revisions when hashes diverge at same revision', () => {
    const deviceAVersion = { revision: 142, hash: simpleSha256('A') };
    const deviceBVersion = { revision: 142, hash: simpleSha256('B') };

    const isConflict =
      deviceAVersion.revision === deviceBVersion.revision &&
      deviceAVersion.hash !== deviceBVersion.hash;

    expect(isConflict).toBe(true);
  });
});
