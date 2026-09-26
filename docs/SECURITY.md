# Security & Credential Vault Architecture

## 1. Threat Model & Philosophy

Hermes Hub is a **private personal application** running across trusted personal machines.
The primary UX objective is **zero-friction productivity without artificial blindness**:
- The user **wants** to see and inspect their configuration keys, API tokens, and credentials when troubleshooting or syncing machines.
- However, secrets must **never be committed to Git**, must **never be transmitted in unencrypted plaintext**, and must be **encrypted at rest** in the sync workspace.

---

## 2. Master Key Storage

The Shared Vault password is never written to a plain configuration file. Hermes Hub derives a 256-bit key using `scrypt` and a random salt stored with the encrypted container. If **Remember on this PC** is selected, the derived key is protected by the operating system credential mechanism and kept outside the synchronized workspace:
- **Windows**: Electron `safeStorage`, backed by Windows DPAPI for the current Windows user.
- Other platforms are not production targets for v0.4.

When another PC receives `vault/shared-vault.enc`, the user enters the same password. The app derives the same key from the password and salt, verifies the AES-GCM authentication tag, and unlocks the contents in memory. The password is not saved; only the optional derived key is stored through `safeStorage`.

---

## 3. Vault Operations in the UI

1. **Masked by Default**: Values appear as `••••••••••••••••` to avoid accidental shoulder-surfing or screen-sharing leaks.
2. **Instant Reveal & Copy**: Clicking `Reveal` or `Copy` surfaces the raw secret. Reveals hide after one minute and copied values are cleared after 30 seconds when the clipboard still contains the same value.
3. **Structured Secret Types**:
   - API keys and authentication tokens
   - Passwords and recovery codes
   - SSH private keys and certificates
   - Tailscale credentials and custom values
   - Reusable `.env` profiles

---

## 4. Log Redaction & Safe Diagnostic Exports

Hermes Hub logger enforces automated pattern redaction before emitting to stdout or disk:
- Matches `sk-or-v1-[a-zA-Z0-9]{64}`, `sk-ant-[a-zA-Z0-9-]{40,}`, `tskey-[a-zA-Z0-9_-]+`, and generic `Bearer [A-Za-z0-9._-]+`.
- Diagnostic export packs strip all env-like files and replace recognized credentials with `[REDACTED]`.
