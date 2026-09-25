const SENSITIVE_PATTERNS = [
  /sk-or-v1-[a-zA-Z0-9]{30,}/g,
  /sk-[a-zA-Z0-9]{20,}/g,
  /tskey-[a-zA-Z0-9_-]{10,}/g,
  /ghp_[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
];

/**
 * Redacts secrets from logs, diagnostics, and strings
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let redacted = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      if (match.startsWith('Bearer ')) {
        return 'Bearer [REDACTED]';
      }
      const prefix = match.slice(0, 7);
      return `${prefix}...[REDACTED]`;
    });
  }
  return redacted;
}

/**
 * Masks a secret string for UI presentation (e.g. sk-or-v1-...xxxx)
 */
export function maskSecret(secret: string): string {
  if (!secret) return '••••••••••••••••';
  if (secret.length <= 8) return '••••••••';
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}
