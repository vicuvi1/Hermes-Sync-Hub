import { describe, it, expect } from 'vitest';
import { redactSecrets, maskSecret } from '../packages/shared/src/redaction';

describe('Secret Redaction & Masking', () => {
  it('should redact OpenRouter API keys from logs', () => {
    const raw = 'Configured key: sk-or-v1-98a417df8b6e2104bcde190847321fa890123ef with status 200';
    const clean = redactSecrets(raw);
    expect(clean).not.toContain('98a417df8b6e2104bcde190847321fa890123ef');
    expect(clean).toContain('sk-or-v...[REDACTED]');
  });

  it('should redact Tailscale auth keys', () => {
    const raw = 'Joining mesh with tskey-auth-k92840192847102948-nodekey';
    const clean = redactSecrets(raw);
    expect(clean).not.toContain('k92840192847102948-nodekey');
    expect(clean).toContain('[REDACTED]');
  });

  it('should redact Bearer authorization headers', () => {
    const raw = 'Headers: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token';
    const clean = redactSecrets(raw);
    expect(clean).toBe('Headers: Bearer [REDACTED]');
  });

  it('should mask secrets for UI preview', () => {
    const secret = 'sk-or-v1-98a417df8b6e2104bcde190847321fa890123ef';
    const masked = maskSecret(secret);
    expect(masked).toBe('sk-o••••••••••••23ef');
  });
});
