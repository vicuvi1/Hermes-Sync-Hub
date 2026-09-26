# Changelog

All notable changes are documented here. The project uses semantic version tags.

## 0.4.0 — Shared workspace milestone

### Added

- Password-unlocked Shared Vault stored as authenticated ciphertext in the managed workspace.
- Optional per-PC remembered unlock key protected by Windows secure storage.
- Password, SSH key, certificate, recovery-code, token, API-key, and custom secret categories.
- Reusable encrypted environment profiles with `.env` paste, edit, and copy workflows.
- Vault revision, sync location, and Syncthing conflict-file visibility.
- Migration bundle export/import for preferences, safe workspace files, and encrypted Vault data.
- Automatic rollback backup before migration import.
- Five Shared Vault tests covering transport, wrong passwords, redacted listings, environments, and password changes.

### Changed

- Main PC preflight now reports Shared Vault readiness without mixing Vault plaintext into baseline manifests.
- Existing v0.3 local Vault items can be imported during first Shared Vault setup.

## 0.3.0 — Public beta

### Stable beta capabilities

- Universal, private local Command Center for sessions, memories, skills, files, devices, backups, activity, settings, and confirmed actions.
- Persistent activity journal and atomic search index with explicit status and recovery.
- Real production empty/error states; Demo Mode remains explicit and labeled.
- GitHub Releases updater, Windows installer shortcuts, tray recovery, single-instance handling, and crash logs.
- Windows-protected encrypted Vault and redacted diagnostics.
- Developer Mode gate for fixed-repository source pull/push controls.

### Experimental capabilities

- Main PC initial baseline workflow and bidirectional supported-file synchronization.
- Conflict/revision and recovery tooling while broader multi-device scenarios continue to be hardened.

### Known limitations

- Windows x64 only; installer is not code-signed.
- Tailscale and Syncthing must be installed and configured externally.
- Search is lexical, not semantic.
- Multi-device synchronization remains beta; keep independent backups.

## 0.2.5

- Added explicit Main PC baseline publishing and follower adoption with recovery artifacts.
- Added GitHub release updates and Developer source repository controls.
