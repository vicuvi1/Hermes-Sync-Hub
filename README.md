# Hermes Hub 🛸

> **A production-quality, local-first personal control center for multi-device [Hermes Agent](https://github.com/hermes-agent) installations.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33.2-47848F)](https://www.electronjs.org/)
[![Tailscale Mesh](https://img.shields.io/badge/Networking-Tailscale-2463EB)](https://tailscale.com/)
[![Syncthing P2P](https://img.shields.io/badge/Transport-Syncthing-1389FD)](https://syncthing.net/)

Hermes Hub gives you a single, unified, modern control center across all of your workstations and laptops without requiring you to host, maintain, or pay for a central server.

---

## ⚡ Key Highlights

- **Zero Central Servers**: Operates 100% peer-to-peer over **Tailscale** private networking.
- **Battle-Tested Transport**: Utilizes **Syncthing** for block-level synchronization, NAT traversal, and delta compression.
- **Anti-Corruption Snapshotting**: Strictly separates live Hermes SQLite databases (`state.db`) from sync snapshots to eliminate corruption risks.
- **Personal Productivity First**: Designed for private, high-speed visibility. Reveal, copy, edit, and safely store your API keys and configuration values.
- **Hardware Keychains**: Master keys are stored directly in Windows Credential Manager, macOS Keychain, or Linux Secret Service with AES-256-GCM encryption at rest.
- **Offline-First Resilience**: If a machine goes offline, local work continues seamlessly with pending updates queued naturally.

---

## 🏗️ Architecture

```text
Device A (Workstation)                    Device B (Laptop)
Hermes Agent (Local AI)                   Hermes Agent (Local AI)
       ↕                                         ↕
Hermes Hub Agent                          Hermes Hub Agent
       ↕                                         ↕
Hermes Hub Workspace                      Hermes Hub Workspace
(Manifests, Memories, Skills)             (Manifests, Memories, Skills)
       ↕                                         ↕
   Syncthing            ◄── Tailscale P2P ──►    Syncthing
```

For in-depth architectural details, refer to:
- [System Architecture](docs/ARCHITECTURE.md)
- [Hermes Discovery & SQLite Integration](docs/HERMES_INTEGRATION.md)
- [Device Pairing Workflow](docs/DEVICE_PAIRING.md)
- [Sync Protocol & Manifests](docs/SYNC_PROTOCOL.md)
- [Security Model & Hardware Keychains](docs/SECURITY.md)

---

## 📸 Screenshots & UI Preview

*(Placeholders for release builds)*

| Dashboard View | Device Details & Sync Status |
| :---: | :---: |
| *Modern overview with global sync status, live device cards, and transfer speeds* | *Comprehensive inspection of Tailscale IPs, Syncthing IDs, and Hermes counts* |

---

## 📁 Monorepo Layout

```text
hermes-hub/
├── apps/
│   ├── desktop/       # Electron + Vite + React 18 + Tailwind CSS GUI
│   └── agent/         # Headless local device background agent
├── packages/
│   ├── protocol/      # IPC definitions, pairing types, RPC contracts
│   ├── shared/        # Hashing, secret redaction, formatting, mock fixtures
│   ├── types/         # Canonical TypeScript interfaces
│   └── ui/            # UI components and tokens
├── docs/              # Comprehensive engineering specifications
├── tests/             # End-to-end vitest unit test suite
└── .gitignore         # Strict exclusion of databases, secrets, and logs
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20+ (Node v22 recommended)
- **pnpm**: v9+ / v12+ (`corepack enable pnpm`)
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/vicuvi1/hermes-hub.git
cd hermes-hub

# Install all workspace dependencies
pnpm install

# Run unit tests
pnpm test

# Launch Desktop application in development mode
pnpm dev
```

### Windows installation

Tagged releases publish an x64 Windows installer named `Hermes-Hub-Setup-<version>-x64.exe` on the GitHub Releases page. The installer creates Start Menu and Desktop shortcuts and keeps application data when uninstalling by default.

Release builds check GitHub Releases in the background. Use **Settings → Application Updates → Update** to download, verify, install, and restart in one step, or enable automatic installation for hands-free updates. Development builds intentionally disable release updates.

> Windows SmartScreen may warn on the initial unsigned releases. Confirm that the installer was downloaded from this repository's official GitHub Release and verify the attached checksum before running it. The build configuration is ready for certificate-based signing when a signing certificate is available.

To publish a release, update the desktop package version, commit it, and push the matching tag:

```bash
git tag v0.2.1
git push origin v0.2.1
```

---

## 🔐 Security & Privacy

1. **No Cloud Telemetry**: Hermes Hub does not phone home to any external analytics or tracking servers.
2. **Secrets Never in Git**: Environment files (`.env`), tokens, and private databases are strictly blocked by `.gitignore`.
3. **Log Redaction**: Automated pattern matchers scrub tokens (`sk-or-v1-...`, `Bearer ...`, `tskey-...`) before logging or exporting diagnostic bundles.
4. **Encrypted at Rest**: Vault secrets are encrypted with AES-256-GCM before entering the sync workspace.

---

## 🗺️ Roadmap & Milestones

- [x] **Milestone 1**: Project foundation, monorepo, Electron + React UI shell, Dashboard, responsive mock states, test suite.
- [x] **Milestone 2**: Local Device Agent daemon & persistent device identity.
- [x] **Milestone 3**: Hermes automatic filesystem discovery & non-destructive status inspection.
- [x] **Milestone 4**: Tailscale CLI/API adapter integration.
- [x] **Milestone 5**: Syncthing REST API adapter integration.
- [x] **Milestone 6**: Persistent device registry and live reconciliation.
- [x] **Milestone 7**: Pairing flow (`HERMES-XXXX-XXXX` + QR-ready payloads).
- [x] **Milestone 8**: Managed workspace directory and atomic snapshots.
- [x] **Milestone 9**: Safe file synchronization (Memories, Skills, Configs).
- [x] **Milestone 10**: Session exports and history browser.
- [x] **Milestone 11**: AES-GCM Vault with Windows-protected master key.
- [x] **Milestone 12**: Automated backups & revision rollback.
- [x] **Milestone 13**: System tray, Windows auto-start, notifications.
- [x] **Milestone 14**: Windows installer, first-run onboarding, honest live states, and GitHub Releases updater.
- [ ] **Next**: Cross-device conflict resolution UI, unified search, and per-device sync policies.

---

## 📜 License

MIT © [Victor](https://github.com/vicuvi1)
