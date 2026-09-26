# Hermes Hub

> A Windows-first, local-first desktop control center for discovering, organizing, backing up, and synchronizing Hermes Agent data across trusted devices.

[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows)](https://github.com/vicuvi1/Hermes-Sync-Hub/releases)
[![Release](https://img.shields.io/github/v/release/vicuvi1/Hermes-Sync-Hub)](https://github.com/vicuvi1/Hermes-Sync-Hub/releases/latest)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Hermes Hub brings the operational parts of a Hermes Agent installation into one desktop application. It shows the real state of Hermes, the local workspace, Tailscale, Syncthing, backups, sessions, memories, skills, configuration files, and encrypted secrets. It is designed for personal infrastructure: your data remains on your machines, and optional device-to-device transport uses tools you control.

This handbook is bundled with every Windows release and is available inside the application from **Help & README** in the sidebar.

## Table of contents

- [What Hermes Hub does](#what-hermes-hub-does)
- [Product principles](#product-principles)
- [Feature tour](#feature-tour)
- [System requirements](#system-requirements)
- [Install on Windows](#install-on-windows)
- [First-run setup](#first-run-setup)
- [Daily use](#daily-use)
- [Application updates](#application-updates)
- [Data, privacy, and security](#data-privacy-and-security)
- [Architecture](#architecture)
- [Synchronization model](#synchronization-model)
- [Backups and recovery](#backups-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Developer setup](#developer-setup)
- [Testing and packaging](#testing-and-packaging)
- [Publishing a release](#publishing-a-release)
- [Repository structure](#repository-structure)
- [IPC and trust boundaries](#ipc-and-trust-boundaries)
- [Limitations and roadmap](#limitations-and-roadmap)
- [Contributing](#contributing)

## What Hermes Hub does

Hermes Hub provides one place to:

- Detect the local Hermes Agent installation and inspect its health.
- Distinguish healthy, offline, unavailable, misconfigured, and failed services.
- Register and pair trusted devices.
- Inspect Hermes sessions, memories, skills, and configuration files.
- Stage file-based data without synchronizing live SQLite files.
- Use Syncthing as optional file transport between devices.
- Use Tailscale as the optional private network joining those devices.
- Create, verify, retain, restore, and inspect backups.
- Store credentials in an encrypted local vault protected by Windows secure storage.
- Export redacted diagnostics.
- Install releases without Git, Node.js, pnpm, or source code.

Hermes Hub does **not** require a hosted Hermes Hub server. The desktop application runs a loopback-only local agent and works with local files and trusted peer services.

## Product principles

### Local first

Your workspace, settings, backups, and vault remain local unless you explicitly configure synchronization. The app does not require a Hermes Hub cloud account.

### Honest states

Production mode never silently substitutes sample content after a failure. Screens show loading, empty, unavailable, offline, misconfigured, or error states. Sample content is available only through visibly labeled **Demo Mode**.

### Safe synchronization

Hermes Hub does not treat an active SQLite database as a normal sync file. Live databases, WAL files, shared-memory files, and locks are excluded. The app works with safe exports, manifests, staged files, snapshots, and archives.

### Explicit recovery

Failure states provide practical actions: retry, open Settings, initialize the workspace, export diagnostics, or restore a verified backup.

### Secure desktop boundaries

The renderer cannot execute shell commands, Git, or package-manager operations. Privileged actions live in the Electron main process and are exposed through a limited preload API.

## Feature tour

### Dashboard

Summarizes registered devices, online state, indexed content, pending files, conflicts, transfers, recent activity, and synchronization health.

### Devices

Shows the local machine and registered peers, including identity, operating system, Hermes, Tailscale, Syncthing, content counts, last sync, and backup state.

### Sessions, Memory, Skills, and Files

These screens display content discovered by live services. Supported operations use service APIs and managed files rather than directly mutating an active Hermes database.

### Vault

Vault stores secrets in an AES-256-GCM encrypted file. A random master key is protected with Electron `safeStorage`, which uses Windows protection for the current user. Lists are redacted; plaintext is returned only for an explicit reveal.

- Never commit vault files or key material.
- Avoid placing revealed values in screenshots or diagnostics.
- Back up credentials separately if they are the only copy.
- A vault copied to another Windows profile may not decrypt there.

### Activity and Backups

Activity shows supported real events and remains empty when no provider is available. Backups creates atomic bundles, verifies archives, enforces retention, and restores through a pre-restore recovery snapshot.

### Settings

Controls startup, tray behavior, notifications, backup preferences, Demo Mode, diagnostics, integration visibility, and application updates.

### Help & README

Renders this bundled handbook inside Hermes Hub with navigation, rich Markdown formatting, and links.

## System requirements

### Installed application

- Windows 10 or 11, x64.
- Permission to install a per-user application.
- Internet access only for GitHub update checks/downloads.
- Hermes Agent recommended; onboarding can continue if it is missing.
- Tailscale and Syncthing are optional until peer networking or transport is needed.

The installed app does not require Git, Node.js, pnpm, or a source checkout.

### Development

- Node.js 22 recommended.
- pnpm 12 recommended.
- Git.
- Windows to create and validate the supported NSIS installer.

## Install on Windows

1. Open the [latest GitHub Release](https://github.com/vicuvi1/Hermes-Sync-Hub/releases/latest).
2. Download `Hermes-Hub-Setup-<version>-x64.exe`.
3. Confirm it came from `vicuvi1/Hermes-Sync-Hub`.
4. Run the installer and choose the installation directory if desired.
5. Launch **Hermes Hub** from the Desktop or Start Menu shortcut.

The installer provides Desktop and Start Menu shortcuts, uninstall support, preserved application data, and the metadata required for future in-app updates.

### SmartScreen

Current releases are unsigned, so Windows SmartScreen may show an “unrecognized app” warning. Verify the repository, release tag, filename, and checksum. Do not disable SmartScreen globally.

### Uninstall

Use **Windows Settings → Apps → Installed apps → Hermes Hub → Uninstall**. Application data is preserved by default so a later reinstall can retain settings and local state.

## First-run setup

The wizard performs these checks:

1. **Hermes detection:** confirms the discovered or custom Hermes home.
2. **Workspace:** confirms the managed workspace used for manifests, staging, snapshots, and exports.
3. **Tailscale and Syncthing:** reports whether each optional integration is installed and running.
4. **Demo Mode:** optionally loads isolated, clearly labeled sample content.
5. **Health summary:** distinguishes healthy, offline, unavailable, misconfigured, and error states.

Do not select a protected system folder or an unrelated folder containing irreplaceable files as the workspace.

## Daily use

### Check health

The status bar summarizes the agent, Hermes, Tailscale, Syncthing, workspace, last successful sync, and update availability.

### Synchronize

Choose **Sync now** from the header or command palette. Hermes Hub stages supported content, checks manifests, rejects unsafe database artifacts, and delegates transport to configured services.

### Pair a device

Open **Devices → Add device**, generate or enter a pairing code, review the temporary invitation, complete verification, and confirm the peer. Share invitations only with the intended device.

### Back up and restore

Create backups from **Backups**. Verify an archive before restoration. Restoration creates a rollback snapshot before applying the selected backup.

### Store a secret

Add it in **Vault**. Listings remain masked. Reveal or copy only when necessary and avoid leaving plaintext in the clipboard.

### Quick actions

Press `Ctrl+K` to open navigation and common actions, including Help.

## Application updates

Hermes Hub uses GitHub Releases, not arbitrary commits on `main`.

### Manual one-click update

Open **Settings → Application Update → Update**. The app checks GitHub, downloads a newer installer with progress, verifies it, installs it, and restarts.

### Automatic updates

Enable **Automatically download, install, and restart when an update is available**. This also enables startup checks. Keep it disabled if the app must never restart without direct action.

The UI reports idle, checking, current, available, downloading, installing, restart pending, offline, failed, or disabled-in-development states. Only packaged builds update themselves.

## Data, privacy, and security

### Typical Windows locations

| Data | Location |
|---|---|
| Installed app | `%LOCALAPPDATA%\Programs\Hermes Hub` |
| Settings and Electron data | `%APPDATA%\Hermes Hub` |
| Device identity | `%LOCALAPPDATA%\HermesHub` |
| Crash log | `%APPDATA%\Hermes Hub\logs\main-process.log` |
| Vault and protected key blob | `%APPDATA%\Hermes Hub\vault` |
| Workspace | Selected during onboarding or the application default |

Locations can vary with Windows configuration and custom paths.

### Network behavior

- The local agent binds to loopback rather than a public interface.
- Update checks contact GitHub Releases.
- Tailscale and Syncthing follow their own configuration.
- Hermes Hub includes no advertising or analytics telemetry.

### Secret handling

- Authenticated AES-256-GCM vault encryption.
- Windows-protected master key through Electron secure storage.
- Masked listings and explicit reveal.
- Credential redaction in supported logs and diagnostics.
- Repository exclusions for environment files, keys, tokens, databases, and vault data.

Hermes Hub cannot protect data from malware already running with the same Windows user privileges. Keep Windows patched, protect the user account, and use disk encryption where appropriate.

## Architecture

```text
React renderer
Dashboard · Devices · Sessions · Memory · Skills · Files · Vault · Help
        │
        │ typed, allow-listed IPC through context-isolated preload
        ▼
Electron main process
Settings · updater · tray · notifications · crash logs · secure storage
        │
        ▼
Local agent and services
discovery · registry · workspace · sync · backups · revisions · vault
        │                    │                    │
        ▼                    ▼                    ▼
Hermes Agent files     Tailscale adapter    Syncthing adapter
```

More specifications:

- [System architecture](docs/ARCHITECTURE.md)
- [Hermes integration](docs/HERMES_INTEGRATION.md)
- [Device pairing](docs/DEVICE_PAIRING.md)
- [Sync protocol](docs/SYNC_PROTOCOL.md)
- [Security model](docs/SECURITY.md)

## Synchronization model

The managed workspace is a controlled interchange layer for manifests, file-based memories, skills, supported configs, exports, snapshots, and revision metadata.

Hermes Hub rejects or excludes active SQLite files, `-wal`, `-shm`, locks, partial writes, vault key material, and files outside configured scope. When two devices modify the same managed asset, the engine records a conflict instead of silently overwriting one version. Preserve both versions and create a backup before manual conflict intervention.

## Backups and recovery

- Backup creation uses safe snapshot logic rather than copying actively modified databases.
- Verification checks expected structure and available integrity metadata.
- Restoration creates a pre-restore rollback snapshot.
- Retention prunes older managed backups only after successful creation.
- Retention is not a substitute for an independent offline backup.

## Troubleshooting

### Broken Desktop shortcut

An old shortcut may point into a temporary source folder. Remove only the broken shortcut, reinstall the latest release, and use the new installer-created shortcut. The stable executable normally lives under `%LOCALAPPDATA%\Programs\Hermes Hub`.

### JavaScript startup error

Install the latest packaged release over the existing version, then inspect `%APPDATA%\Hermes Hub\logs\main-process.log`. If the UI opens, export diagnostics. Report the exact version and error text.

### Hermes unavailable

Confirm Hermes is installed, verify its configured home path, ensure the current user can read it, restart Hermes if offline, and refresh health.

### Tailscale or Syncthing unavailable

Install the service from its official source, start it, complete its own configuration, confirm the CLI/API is available to the current user, and refresh Settings.

### Workspace misconfigured

Confirm the path is writable, initialize the workspace, avoid Windows system directories, and export diagnostics if initialization still fails.

### Updates say Offline

Confirm internet access and that GitHub Releases and release assets are not blocked by a proxy or firewall, then retry.

### Updates say Current after code changed

The updater sees only published releases. A maintainer must increase the desktop package version and push a matching `v*` tag.

### Update installation fails

Close other Hermes Hub windows, check disk space, retry, or download the installer and install over the existing version. Do not delete application data without a backup.

### Vault cannot decrypt

Do not overwrite it. Preserve the entire vault directory. The Windows-protected key may belong to another profile or the file may be damaged. Restore from a known-good backup where available.

### App closes to tray

Use the tray icon to restore or quit. Change **Close to tray** in Settings if closing the window should exit.

### Diagnostics

Export diagnostics from Settings. Supported credential patterns are redacted, but review the report before sharing because paths and filenames may still contain personal information.

## Developer setup

```powershell
git clone https://github.com/vicuvi1/Hermes-Sync-Hub.git
cd Hermes-Sync-Hub
npm install --global pnpm@12.6.0
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm --filter @hermes-hub/desktop dev:electron
```

Workspace packages must be built before tests on a clean checkout because package entry points resolve to compiled `dist` folders. Development builds keep production updates disabled.

| Command | Purpose |
|---|---|
| `pnpm install --frozen-lockfile` | Install the locked dependency graph |
| `pnpm build` | Compile all workspace packages and desktop UI |
| `pnpm test` | Run the Vitest suite |
| `pnpm --filter @hermes-hub/desktop dev:electron` | Run Vite and Electron |
| `pnpm --filter @hermes-hub/desktop dist:win` | Build the Windows installer |

## Testing and packaging

Before merging a production change:

1. Install from the lockfile.
2. Build from a clean checkout.
3. Run all tests.
4. Build the NSIS installer.
5. Launch the packaged executable.
6. Verify the main window, shortcuts, installed version, tray, and clean shutdown.
7. For updater changes, publish a higher test version and verify discovery, download, installation, and restart.

Build locally:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @hermes-hub/desktop exec electron-builder --win nsis --x64
```

Artifacts in `release/` include the installer, `latest.yml`, optional blockmap, and unpacked app. Very long checkout paths can exceed NSIS tooling limits; use a physically shorter checkout. GitHub Actions already uses a short path.

## Publishing a release

`.github/workflows/release-windows.yml` installs dependencies, builds, tests, packages, and publishes on `v*` tags.

1. Increase `apps/desktop/package.json`.
2. Commit and push to `main`.
3. Create and push the matching annotated tag.

```powershell
git tag -a v0.2.4 -m "Hermes Hub v0.2.4"
git push origin v0.2.4
```

The desktop version and tag must match. Releases are currently unsigned. Never commit signing certificates, keys, or passwords.

## Repository structure

```text
Hermes-Sync-Hub/
├── .github/workflows/       # Windows release automation
├── apps/
│   ├── agent/src/           # Discovery, registry, sync, backups, vault
│   └── desktop/
│       ├── build/           # Branding
│       ├── electron/        # Main, preload, tray, updater
│       └── src/             # React renderer
├── docs/                    # Engineering specifications
├── packages/
│   ├── protocol/            # IPC channels and protocol models
│   ├── shared/              # Helpers, fixtures, redaction
│   ├── types/               # Domain interfaces
│   └── ui/                  # Shared UI foundations
├── tests/                   # Vitest service and integration tests
└── README.md                # Repository and in-app handbook
```

## IPC and trust boundaries

The context-isolated renderer receives a limited `window.hermesHub` API. Channel names live in `@hermes-hub/protocol`; response models live in `@hermes-hub/types`.

New operations must use stable typed channels, validate renderer input in the main process, avoid unrestricted shell/Node exposure, redact secrets, and return actionable errors instead of fictional success.

## Limitations and roadmap

Current limitations:

- Windows x64 is the only production installer target.
- Releases are unsigned.
- Tailscale and Syncthing are installed/configured separately.
- Advanced conflict workflows still need expansion.
- Updates require GitHub Releases access.

Completed: desktop foundation, local agent, Hermes discovery, adapters, registry, pairing, workspace, manifests, safe sync, sessions, encrypted Vault, backups, tray, diagnostics, onboarding, health, NSIS installer, manual/automatic updater, and in-app Help.

Planned: richer conflict resolution, unified search, per-device sync policies, Windows code signing, and evaluation of additional packaged platforms after Windows stabilizes.

## Contributing

Keep changes focused, preserve local-first and honest-state behavior, never add real secrets or databases to fixtures, add tests for behavior changes, run `pnpm build` and `pnpm test`, and document settings, IPC, release, and recovery changes. Treat updater, vault, backup, restore, and sync changes as high-risk paths requiring packaged validation.

## License

MIT © [Victor](https://github.com/vicuvi1)
