# Changelog

All notable changes are documented here. The project uses semantic version tags.

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
