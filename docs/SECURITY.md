# Security & Credential Vault Architecture

## 1. Threat Model & Philosophy

Hermes Hub is a **private personal application** running across trusted personal machines.
The primary UX objective is **zero-friction productivity without artificial blindness**:
- The user **wants** to see and inspect their configuration keys, API tokens, and credentials when troubleshooting or syncing machines.
- However, secrets must **never be committed to Git**, must **never be transmitted in unencrypted plaintext**, and must be **encrypted at rest** in the sync workspace.

---

## 2. Master Key Storage

The master vault encryption key is never written directly to a plain configuration file. Instead, Hermes Hub uses the operating system's native hardware/secure credential manager:
- **Windows**: Windows Credential Manager (`wincred` API via Node safeStorage / keytar).
- **macOS**: Keychain Services.
- **Linux**: Secret Service API / libsecret.

When a device first joins the Hub, the user provides or imports their mesh passphrase, which is derived using PBKDF2 (100,000 iterations + SHA-256 salt) into an AES-256-GCM symmetric key and saved into the OS credential store.

---

## 3. Vault Operations in the UI

1. **Masked by Default**: Values appear as `••••••••••••••••` to avoid accidental shoulder-surfing or screen-sharing leaks.
2. **Instant Reveal & Copy**: Clicking `Reveal` or `Copy` instantly surfaces or copies the raw secret (with an optional confirmation prompt if enabled in Settings).
3. **Structured Secret Types**:
   - `OPENROUTER_API_KEY`
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `TAILSCALE_AUTHKEY`
   - `CUSTOM_ENV_SECRETS`

---

## 4. Log Redaction & Safe Diagnostic Exports

Hermes Hub logger enforces automated pattern redaction before emitting to stdout or disk:
- Matches `sk-or-v1-[a-zA-Z0-9]{64}`, `sk-ant-[a-zA-Z0-9-]{40,}`, `tskey-[a-zA-Z0-9_-]+`, and generic `Bearer [A-Za-z0-9._-]+`.
- Diagnostic export packs strip all env-like files and replace recognized credentials with `[REDACTED]`.
