# Hermes Hub: System Architecture

## 1. Vision & Core Philosophy

**Hermes Hub** is a production-quality, local-first personal control center for managing [Hermes Agent](https://github.com/hermes-agent) installations across multiple workstations, laptops, and remote machines.

### Key Guiding Tenet: Zero Central Servers
Hermes Hub operates completely peer-to-peer (P2P) and local-first. There is no cloud backend to deploy, maintain, or pay for. 

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│           Device A              │           │           Device B              │
│  Hermes Agent (Local AI)        │           │  Hermes Agent (Local AI)        │
│             ↕                   │           │             ↕                   │
│     Hermes Hub Agent            │   P2P     │     Hermes Hub Agent            │
│             ↕                   │ ◄───────► │             ↕                   │
│     Hermes Hub Workspace        │           │     Hermes Hub Workspace        │
│             ↕                   │           │             ↕                   │
│          Syncthing              │           │          Syncthing              │
│             ↕                   │           │             ↕                   │
│         Tailscale               │           │         Tailscale               │
└─────────────────────────────────┘           └─────────────────────────────────┘
                                       ▲
                                       │ P2P Mesh
                                       ▼
                      ┌─────────────────────────────────┐
                      │           Device C              │
                      │  Hermes Agent (Local AI)        │
                      │             ↕                   │
                      │     Hermes Hub Agent            │
                      │             ↕                   │
                      │     Hermes Hub Workspace        │
                      │             ↕                   │
                      │          Syncthing              │
                      │             ↕                   │
                      │         Tailscale               │
                      └─────────────────────────────────┘
```

---

## 2. Technology Stack & Responsibilities

| Subsystem | Technology | Responsibility |
| :--- | :--- | :--- |
| **Desktop App** | Electron, React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Responsive, high-performance GUI, system tray, quick actions, secret management |
| **Device Agent** | Node.js / TypeScript, OS daemons | Background health monitoring, local snapshot generation, adapters, status reporting |
| **Local Metadata** | Atomic JSON files | Known devices, file revisions, activity, settings, search index, and backup metadata (never replaces Hermes's internal DB) |
| **Transport** | Syncthing REST API + Native Syncthing Core | P2P block-level file synchronization, conflict detection, NAT traversal |
| **Mesh Network** | Tailscale (CLI / Local API) | Zero-config WireGuard VPN mesh, device reachability, authenticated IP addressing |
| **Security Vault** | Electron `safeStorage` on Windows + AES-256-GCM | Encrypted-at-rest credential storage, selective reveal/copy |

---

## 3. The Core Dilemma: Why Naive Live Sync Destroys SQLite Databases

Hermes uses SQLite databases (e.g. `state.db`, `kanban.db`, `projects.db`) with Write-Ahead Logging (`WAL` mode and active lockfiles). 

> [!CAUTION]
> **NEVER configure Syncthing to continuously synchronize a live, active SQLite database file.**
> Doing so causes:
> 1. Inconsistent snapshots where `.db-wal` and `.db` frames fall out of sync.
> 2. File-locking conflicts while Hermes is executing transactions.
> 3. Catastrophic split-brain conflicts and corrupted B-Trees.

### The Hermes Hub Solution: Staged Workspace & Safe Snapshots
Hermes Hub enforces a strict boundary between **Live Data** and **Hub Sync Workspace**:

```
+-------------------------------------------------------------------------+
| LIVE HERMES DIRECTORY (e.g. AppData/Local/hermes or ~/.hermes)          |
| [state.db] [kanban.db] [SOUL.md] [skills/] [sessions/]                  |
+-------------------------------------------------------------------------+
                                 ▲
               Read / Export / Import / Verify (Agent)
                                 ▼
+-------------------------------------------------------------------------+
| HERMES HUB MANAGED WORKSPACE (HermesHubData/)                           |
| ├── manifests/          (Device manifests & file inventories)          |
| ├── memories/           (Exported/versioned memory markdown)           |
| ├── skills/             (Normalized portable skill trees)               |
| ├── configs/            (Sanitized configuration templates)             |
| ├── sessions/           (Exported portable session JSONL & transcripts) |
| └── snapshots/          (Atomic atomic SQLite vacuum snapshots)         |
+-------------------------------------------------------------------------+
                                 ▲
                      Continuous Block Sync (Syncthing)
                                 ▼
+-------------------------------------------------------------------------+
| SYNCTHING TRANSFER ENGINE (P2P Encrypted Blocks via Tailscale Mesh)     |
+-------------------------------------------------------------------------+
```

1. **Snapshot Creation**: The Agent creates safe exported snapshot records without copying live SQLite/WAL/SHM files into transport.
2. **Deterministic Manifesting**: Every supported file placed into the sync workspace receives a SHA-256 hash, revision number, timestamp, and origin-device metadata.
3. **Safe Ingestion**: When revisions arrive through Syncthing, the local Agent validates supported staged files and preserves ambiguous states for review instead of treating live databases as mergeable files.

---

## 4. Adapter Architecture

To insulate Hermes Hub from external API changes, all external interfaces operate through decoupled adapters:

```
HermesHub Core
  ├── HermesAdapter (Detection, version, sessions, memories, skills, config)
  ├── TailscaleAdapter (IP discovery, peer reachability, ping, auth status)
  ├── SyncthingAdapter (REST API client, folder status, peer connection, transfer rates)
  ├── VaultService (OS-level master key storage, AES-GCM encryption/decryption)
  ├── BackupService (Local snapshot bundling, rotation, restore verification)
  ├── DeviceService (Persistent device identity, hardware specs, manifest creation)
  └── SyncService (Manifest comparison, conflict detection, revision tracking)
```

---

## 5. Offline-First Resilience Model

In a peer-to-peer ecosystem with no central server:
- If **Desktop** is turned OFF and **Laptop** is ON:
  - Laptop continues operating locally without degradation.
  - The UI transparently presents: *"Desktop offline • Last synchronized: Yesterday 23:42 • 37 updates queued"*.
  - This is treated as a healthy, anticipated condition—not an error state.
  - Upon reconnection over Tailscale, Syncthing detects block deltas and transfers pending revisions immediately.

---

## 6. Security Principles

1. **Secrets Encrypted at Rest**: Vault values are encrypted locally with AES-256-GCM and are never placed in the shared workspace or search index.
2. **Windows User Protection**: The random Vault master key is protected with Electron `safeStorage` for the current Windows user.
3. **No Central Telemetry or Leakage**: All logs redact known key prefixes and sensitive tokens before writing to disk or exporting diagnostics.
4. **Git Hygiene**: Strict `.gitignore` rules prevent any accidental tracking of workspace files, SQLite databases, or credentials.

---

## 7. Future Extensibility: Encrypted Cloud Snapshots

While V1 is 100% serverless P2P via Syncthing + Tailscale, the architecture defines a clean `BackupProvider` interface:
```typescript
export interface BackupProvider {
  name: string;
  upload(snapshot: EncryptedSnapshot): Promise<void>;
  download(id: string): Promise<EncryptedSnapshot>;
  list(): Promise<SnapshotMetadata[]>;
}
```
This enables optional future zero-knowledge cloud cold-storage (e.g. S3, Google Drive, OneDrive) without compromising the core peer-to-peer design.
