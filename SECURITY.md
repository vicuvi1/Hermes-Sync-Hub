# Security Policy

## Supported versions

The latest tagged beta is the only version receiving security fixes. Hermes Hub currently supports Windows 10/11 x64.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability or accidentally exposed secret. Use GitHub's private vulnerability reporting for `vicuvi1/Hermes-Sync-Hub`. Include the affected version, impact, reproduction steps, and any suggested mitigation. Avoid attaching real credentials, vault files, diagnostics, or personal Hermes data.

## Security boundaries

- The renderer is context-isolated and receives only explicit preload operations.
- Vault values are encrypted locally and excluded from search and diagnostics.
- Live SQLite, WAL, SHM, locks, vault material, tokens, and credentials are excluded from synchronization.
- Tailscale and Syncthing are external dependencies configured by the user.
- Current installers are unsigned. Verify release checksums and expect Windows SmartScreen until signing is introduced.

No software can guarantee data safety. Keep independent backups before testing beta synchronization or recovery features.
