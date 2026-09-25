/**
 * Simple deterministic string hashing for tests and mock manifests
 * In Node runtime crypto.createHash('sha256') is used.
 */
export function simpleSha256(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `sha256-${hex.repeat(8).slice(0, 64)}`;
}

export function isRevisionNewer(revA: number, revB: number): boolean {
  return revA > revB;
}
