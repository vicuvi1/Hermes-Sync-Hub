# Hermes Hub

### The local-first companion for Hermes Agent on Windows

Run Hermes with confidence across one or several PCs. Hermes Hub gives you one visual control center for health, memories, skills, MCP servers, plugins, credentials, backups, synchronization, usage, and safe updates—without replacing the Hermes app you already use.

[![Latest release](https://img.shields.io/github/v/release/vicuvi1/Hermes-Sync-Hub?display_name=tag&sort=semver)](https://github.com/vicuvi1/Hermes-Sync-Hub/releases/latest)
[![Windows CI](https://github.com/vicuvi1/Hermes-Sync-Hub/actions/workflows/ci.yml/badge.svg)](https://github.com/vicuvi1/Hermes-Sync-Hub/actions/workflows/ci.yml)
[![Windows 10 and 11](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows)](https://github.com/vicuvi1/Hermes-Sync-Hub/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/vicuvi1/Hermes-Sync-Hub/total)](https://github.com/vicuvi1/Hermes-Sync-Hub/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
[![Public beta](https://img.shields.io/badge/status-public%20beta-f59e0b)](#current-status)

[Download for Windows](https://github.com/vicuvi1/Hermes-Sync-Hub/releases/latest) · [Read the setup guide](#five-minute-setup) · [Report a bug](https://github.com/vicuvi1/Hermes-Sync-Hub/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/vicuvi1/Hermes-Sync-Hub/issues/new?template=feature_request.yml)

> Hermes Hub is an independent companion project. It does not replace Hermes chat, task execution, or agent behavior; it makes the surrounding installation easier to understand, protect, synchronize, and maintain.

## Interface preview

The screenshots below come directly from Hermes Hub v0.6.2 using its visibly labeled, sanitized Demo Mode. No personal sessions, device identities, filesystem paths, or credentials are shown.

![Hermes Hub overview showing synchronized devices, workspace metrics, recent sessions, and recovery state](https://raw.githubusercontent.com/vicuvi1/Hermes-Sync-Hub/v0.6.2/docs/images/overview.png)

| Sessions workspace | Encrypted Shared Vault |
|---|---|
| ![Hermes Hub sessions workspace with search, revision metadata, model usage, and tool history](https://raw.githubusercontent.com/vicuvi1/Hermes-Sync-Hub/v0.6.2/docs/images/sessions.png) | ![Hermes Hub Shared Vault with encrypted credential summaries and environment profiles](https://raw.githubusercontent.com/vicuvi1/Hermes-Sync-Hub/v0.6.2/docs/images/shared-vault.png) |

## Why Hermes Hub?

A capable local agent quickly becomes more than one executable. It accumulates memories, skills, MCP connections, provider credentials, sessions, backups, and machine-specific configuration. That is manageable on one computer and surprisingly fragile across several.

Hermes Hub turns that operational complexity into a desktop workflow:

- **See what is real.** Health screens use live local services and show unavailable, offline, misconfigured, and failed states honestly.
- **Keep working across PCs.** Choose an initial Main PC, transport supported file-based data with Syncthing, and preserve ambiguous changes as conflicts.
- **Protect before changing.** Memory edits, baseline adoption, restores, and Hermes updates create recovery material first.
- **Manage the Hermes ecosystem.** Inspect Hermes Doctor, skills, Skill Sync, MCP servers, tools, plugins, usage, and update status from one place.
- **Carry credentials safely.** Store API keys, private keys, certificates, recovery codes, and `.env` profiles in a password-unlocked encrypted Shared Vault.
- **Stay local-first.** There is no Hermes Hub account, hosted control plane, advertising, or analytics telemetry.

## At a glance

| Capability | What it gives you |
|---|---|
| **Hermes Booster** | Live Doctor results, extension inventory, MCP tests, plugin controls, usage/cost visibility, and backup-first Hermes updates. |
| **Smart Model Router** | Build native Hermes bot profiles, classify work locally, prefer free models, and allow paid escalation only through explicit rules and budgets. |
| **Universal Command Center** | Press `Ctrl+K` to find sessions, memories, skills, files, devices, backups, activity, settings, and safe actions. |
| **Memory and workspace tools** | Browse real Hermes content, edit supported Markdown memories safely, inspect revisions, and recover earlier states. |
| **Multi-PC workflow** | Main-PC onboarding, bidirectional supported-file synchronization, explicit conflicts, device health, and recovery copies. |
| **Shared Vault** | AES-256-GCM encrypted secrets and environment profiles synchronized only as ciphertext. |
| **Backup and recovery** | Create, verify, retain, browse, restore, and migrate recoverable bundles from the UI. |
| **Windows releases** | NSIS installer, Desktop and Start Menu shortcuts, one-click application updates, checksums, and an SBOM. |

## Five-minute setup

1. Open the [latest release](https://github.com/vicuvi1/Hermes-Sync-Hub/releases/latest) and download `Hermes-Hub-Setup-<version>-x64.exe`.
2. Verify the installer against `SHA256SUMS.txt`, then run it. Current builds are unsigned, so Windows SmartScreen may require **More info → Run anyway**.
3. Start Hermes Hub from the Desktop or Start Menu and let onboarding detect Hermes and the managed workspace.
4. Open **Hermes** to review live health, extensions, usage, credentials, and updates.
5. For multiple PCs, install Tailscale and Syncthing from **Settings**, then follow [Main PC and multi-PC synchronization](#main-pc-and-multi-pc-synchronization).

No Git, Node.js, pnpm, or source checkout is required for the installed application.

## Current status

Hermes Hub is a **Windows x64 public beta**. Daily local inspection, encrypted Vault storage, backups, the Command Center, packaged updates, and the native Hermes Booster are ready for practical use. Multi-device synchronization and conflict recovery are intentionally conservative and should be paired with verified backups while the beta matures.

See [limitations and roadmap](#limitations-and-roadmap) before depending on the project for irreplaceable data. If something behaves unexpectedly, export redacted diagnostics from Settings and open a [bug report](https://github.com/vicuvi1/Hermes-Sync-Hub/issues/new?template=bug_report.yml).

This complete handbook is bundled with every Windows release and opens inside the application from **Help & README**. The GitHub page and in-app guide therefore stay aligned with the installed version.

## Table of contents

- [What Hermes Hub does](#what-hermes-hub-does)
- [Interface preview](#interface-preview)
- [Why Hermes Hub?](#why-hermes-hub)
- [At a glance](#at-a-glance)
- [Five-minute setup](#five-minute-setup)
- [Current status](#current-status)
- [Product principles](#product-principles)
- [Feature tour](#feature-tour)
- [Smart Model Router](#smart-model-router)
- [System requirements](#system-requirements)
- [Install on Windows](#install-on-windows)
- [First-run setup](#first-run-setup)
- [Daily use](#daily-use)
- [Main PC and multi-PC synchronization](#main-pc-and-multi-pc-synchronization)
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

- Find and open local work instantly with a private universal Command Center.
- Detect the local Hermes Agent installation and inspect its health.
- Control the live Hermes connection from a dedicated dashboard with complete user-data inventory, usage, models, prices, and credential bridging.
- Create native Hermes bot profiles and route confirmed tasks through free-first model pools with a fail-closed paid allowlist.
- Distinguish healthy, offline, unavailable, misconfigured, and failed services.
- Register and pair trusted devices.
- Inspect Hermes sessions, memories, skills, and configuration files.
- Stage file-based data without synchronizing live SQLite files.
- Use Syncthing as optional file transport between devices.
- Use Tailscale as the optional private network joining those devices.
- Create, verify, retain, restore, and inspect backups.
- Store credentials, private keys, certificates, recovery codes, and reusable `.env` profiles in a password-unlocked encrypted Shared Vault.
- Export redacted diagnostics.
- Install releases without Git, Node.js, pnpm, or source code.

Hermes Hub does **not** require a hosted Hermes Hub server. The desktop application runs a loopback-only local agent and works with local files and trusted peer services.

## Product principles

### Local first

Your workspace, settings, backups, and vault remain under your control. When the selected workspace is transported by Syncthing, the Shared Vault travels only as authenticated ciphertext. The app does not require a Hermes Hub cloud account.

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

Summarizes registered devices, online state, indexed content, pending files, conflicts, transfers, recent activity, synchronization health, and a **Continue working** area for recent sessions, changed memories, and conflicts.

### Universal Command Center

Press `Ctrl+K` from anywhere to search session titles and messages, memories, skills, file metadata, devices, backups, activity, settings, and safe application actions. Results are grouped and keyboard-accessible, include source-device context, and deep-link to the selected entity. Searches run against an atomic local index under Hermes Hub application data. Recent and pinned searches stay local.

Vault plaintext, credentials, API keys, live databases, diagnostics, and redacted originals are never indexed. Actions such as synchronization, backup creation, update checks, and pairing show a summary and require confirmation.

### Hermes Booster

The **Hermes** section boosts the installed Hermes application; it does not replace Hermes chat, tasks, or agent execution. **Open Hermes App** returns to the native Hermes experience, while Hub handles operational work around it.

The Overview connects nine companion capabilities: health, credentials, memory, extensions, cross-PC synchronization, backup/recovery, usage/cost, repair guidance, and updates. The Health tab executes the installed Hermes `doctor` command and presents its real redacted report. The Extensions tab uses Hermes' own `skills`, `sync`, `plugins`, `mcp`, and `tools` commands to inspect extensions, update unmodified skills, reconcile Skill Sync, test MCP connections, and enable or disable installed plugins. Interactive MCP installation and configuration opens in Hermes itself.

The Update tab keeps the two products separate. **Update Hermes safely** creates a Hermes Hub recovery archive and then invokes Hermes' official non-interactive updater with Hermes' own full backup enabled. It preserves locally modified skills and parks local source changes instead of silently carrying them across the update. Close Hermes Desktop, active Hermes terminals, and gateways if Windows reports locked Hermes runtime files. Hermes Hub application releases continue to use the independent GitHub Releases updater in Settings.

The Booster also shows runtime status and location, request/session counts, recorded or estimated token usage, Hermes-reported cost, models used, skills, plugins, memories, and the complete user-relevant file inventory. Current model prices are fetched from OpenRouter's public model catalog for exact model IDs found in local sessions; prices are informational and include the fetch time.

The credential bridge never sends secret values through the renderer. With Shared Vault unlocked, an encrypted environment profile can be applied to the local Hermes `.env` file through privileged desktop code. Hermes Hub creates a backup first and keeps the previous environment protected with Windows secure storage. Existing provider keys in the Hermes `.env` file can also be imported directly into encrypted Shared Vault entries. Restart Hermes after changing its environment if the running process does not reload environment variables dynamically.

Generated dependency trees, downloaded runtimes, and caches are summarized instead of rendering thousands of package files. User configuration, sessions, memories, profiles, skills, plugins, logs, state metadata, and top-level runtime files are inventoried. SQLite databases, WAL/SHM files, locks, binaries, and credential files are visible as metadata but are not opened or directly edited.

### Smart Model Router

The **Smart Router** is a policy layer in front of the installed Hermes runtime. It does not create a second agent system. Bots created in the Hub are real isolated Hermes profiles, and confirmed work is executed through the local Hermes CLI with the exact selected profile, provider, model, and optional forced skills.

The default policy is intentionally conservative:

1. A local deterministic classifier scores the task from `0–100` using its category, size, context, affected files, tool use, vision needs, and complexity signals.
2. The first enabled matching rule chooses a model pool. Ordinary work uses a fast free pool; coding, research, and analysis use a stronger free pool.
3. Highly complex work may enter the approved-paid pool. DeepSeek V4 Flash is the initial paid entry, but the user can add exact provider/model IDs and change the allowlist.
4. Paid work runs only when the model is enabled, explicitly approved, above the configured complexity floor, and inside both per-task and daily budgets. A failed check blocks execution instead of choosing another paid model silently.
5. The simulator shows the category, score, matching pool, exact model, estimated maximum cost, reasons, and approval state before any request is made.
6. **Run with Hermes** always asks for confirmation. Hermes remains responsible for the actual agent session, memory, tools, plugins, MCP servers, and provider request.

The **Bots** tab discovers existing Hermes profiles and can create a new one by cloning an existing profile, setting its purpose, default pool, and optional skills. The description is also useful to Hermes orchestration features when deciding which profile is appropriate. The **Models & pools** tab stores exact model identifiers, capabilities, context windows, and prices. **Refresh prices** checks OpenRouter's live public catalog and records when the values were last verified. If the catalog is offline, the UI says so and retains the last known configuration.

The **OpenRouter live** tab closes the gap between policy and runtime:

- **Verify without spending credits** finds `OPENROUTER_API_KEY` through Hermes' own environment path and checks it against OpenRouter's authenticated key endpoint. Only redacted label/tier/usage metadata reaches the UI; the key remains inside the Electron main process.
- The live model browser searches OpenRouter's current public catalog and shows free/paid status, per-million-token prices, context length, tool support, and vision support. A result can be added to the routing draft without manually copying a model ID.
- **Apply to Hermes** writes the selected primary model and ordered `fallback_providers` chain into the real Hermes profile through `hermes -p <profile> config set`. Hermes therefore keeps using the selection and fallbacks even while Hub is closed. Hub creates a recovery backup first.
- **Run live test** sends one deliberately tiny, confirmed request through the real Hermes CLI and selected OpenRouter model. A free model costs $0 but still consumes one OpenRouter request; a paid model can incur a small charge.

The **Routing logic** tab supports editable and removable ordered rules by category and complexity range. The **History** tab keeps a local audit trail containing the route, model, profile, result, token information when Hermes reports it, and actual cost when available. Prompt previews and command output are redacted before persistence. Vault plaintext and provider keys are never added to the routing policy or history.

Classification has two modes. **Deterministic** is the default: it is instant, bundled, reproducible, and spends no credits. **Local semantic** is opt-in and follows the open-source semantic-router pattern of comparing a prompt embedding with example utterances for each route. Hermes Hub uses [Transformers.js](https://github.com/huggingface/transformers.js) and the Apache-2.0 `Xenova/all-MiniLM-L6-v2` quantized ONNX model directly inside the privileged desktop process—no Python service, hosted embedding API, or provider request. Preparing it downloads roughly 24 MB once into application data. Low-confidence or unavailable semantic classification falls back to deterministic routing automatically.

The design also borrows the weak/strong threshold and calibration principle from [RouteLLM](https://github.com/lm-sys/RouteLLM), while leaving Hermes' native provider fallback chain responsible for rate limits, outages, and credential rotation. The Hub now configures that native chain visually instead of introducing LiteLLM or another always-running proxy that would duplicate Hermes. Future threshold calibration will use the user's own local routing outcomes rather than spending credits on a separate classifier.

Smart routing applies to tasks started from the Hub. Prompts typed directly into another Hermes window use the primary model and fallback chain configured for that Hermes profile, but they are not dynamically classified by the Hub. The Hub does not automatically rerun failed tool-using tasks because repeating a mutating agent task could duplicate side effects. Hermes handles provider availability and rate-limit recovery; the Hub handles task complexity, policy, allowlisting, and budgets.

### Devices

Shows the local machine and registered peers, including identity, operating system, Hermes, Tailscale, Syncthing, content counts, last sync, and backup state.

### Sessions, Memory, Skills, and Files

These screens display content discovered by live services. Memory discovers root `SOUL.md`, root `MEMORY.md`, and nested Markdown memories. **Edit memory** writes directly to the real Hermes file using stale-edit protection and atomic replacement, but only after a recovery backup is created; the updated memory is then staged for mesh synchronization and reindexed for search. Skills recursively count their real files and use their own documentation as descriptions. Files inventories user-relevant content throughout the active Hermes home. Supported operations use typed service APIs and managed files rather than mutating an active Hermes database.

### Vault

Shared Vault stores secrets and environment profiles in one AES-256-GCM encrypted file under the managed workspace. One password is transformed into the encryption key with `scrypt`; the password is never placed in the Vault file. Enter the same password on every PC that receives the encrypted file through Syncthing.

- **Remember on this PC** protects a derived unlock key with Windows secure storage. It does not synchronize the password.
- Secret lists and environment lists are redacted. Plaintext is returned only for reveal, copy, or edit.
- Reveal automatically hides again after one minute. Copy clears the clipboard after 30 seconds when it still contains the copied value.
- Supported categories include API keys, authentication tokens, passwords, SSH keys, certificates, recovery codes, Tailscale, and custom values.
- Environment profiles accept familiar `NAME=value` or `export NAME=value` lines and can be copied back as a complete `.env` document.
- Password changes re-encrypt the full Vault. Allow Syncthing to finish before unlocking another PC with the new password.
- Syncthing conflict copies are reported in the Vault UI. Preserve both encrypted copies until the desired version is identified.
- Never commit Vault files or private values to GitHub. Source Repository Sync blocks common Vault, key, token, and environment-file patterns.

#### First Shared Vault setup

1. Confirm every PC points Syncthing at the same `HermesHubData` workspace.
2. Open **Vault** on the first PC and choose a password containing at least eight characters.
3. Leave **Import previous local Vault** enabled to migrate credentials saved by v0.3.
4. Leave **Remember on this PC** enabled if Hermes Hub should unlock automatically for this Windows account.
5. Wait for Syncthing to report idle.
6. Open **Vault** on the next PC and enter the same password once.

If a second PC shows the setup screen instead of the unlock screen, its workspace has not received `vault/shared-vault.enc` yet. Check the workspace path and Syncthing folder before creating another Vault.

### Activity and Backups

Activity is a persistent local journal for synchronization, backups, baselines, repository operations, indexing, and supported failures. It remains honestly empty before any event occurs. Backups creates atomic bundles, verifies archives, enforces retention, and restores through a pre-restore recovery snapshot.

### Settings

Controls startup, tray behavior, notifications, backup preferences, Demo Mode, diagnostics, integration visibility, and application updates. Source Git pull/push controls appear only after explicitly enabling **Developer Mode**; the fixed destination is `https://github.com/vicuvi1/Hermes-Sync-Hub.git`.

### Help & README

Renders this bundled handbook inside Hermes Hub with navigation, rich Markdown formatting, and links.

## System requirements

### Installed application

- Windows 10 or 11, x64.
- Permission to install a per-user application.
- Internet access only for GitHub update checks/downloads.
- Hermes Agent recommended; onboarding can continue if it is missing.
- Tailscale and Syncthing are optional until peer networking or transport is needed. On Windows, Settings can install either official package—or both missing requirements—with one guided click through Windows Package Manager. Windows may request administrator approval. After installation, sign in to Tailscale and approve the intended Syncthing devices and `HermesHubData` folder; Hermes Hub never creates third-party accounts or accepts trust prompts for you.

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

Add it in **Vault → Secrets**. Listings remain masked. The app automatically hides revealed values and conditionally clears copied values from the clipboard.

### Reuse an environment

Open **Vault → Environments**, create a profile, and paste `.env` lines such as `OPENAI_API_KEY=...`. On another synchronized PC, unlock the Vault with the same password and copy the complete profile when needed.

### Quick actions

Press `Ctrl+K` to search every supported local entity and invoke confirmed safe actions. Use filters or pin a useful search for faster return visits.

## Main PC and multi-PC synchronization

This workflow solves a common first-time problem: two existing Hermes installations may contain very different memories and skills. Instead of immediately mixing both versions, Hermes Hub lets you choose one computer as the **Main PC** for the first copy. After every other computer adopts that baseline, the Main PC is no longer a one-way master; supported future changes can travel in either direction, including back to Main.

### The two phases

| Phase | Direction | Purpose |
|---|---|---|
| Initial baseline | Main PC → every follower | Make each PC start from the trusted Main PC memories and skills. |
| Normal operation | Any PC ↔ every other PC | Share newer supported file changes through the managed workspace and Syncthing. |

“Main PC” therefore means **initial source of truth**, not permanent owner of every future edit.

### Before starting

On every PC:

1. Install the same current Hermes Hub release.
2. Confirm Hermes Hub detects the correct Hermes home directory.
3. Pair/register the computers in **Devices**.
4. Configure the same `HermesHubData` folder as a Syncthing folder on every computer.
5. Use Syncthing folder type **Send & Receive** for normal operation.
6. Wait until Tailscale/Syncthing report the expected peers and Syncthing has no pending transfer.

Do not point Syncthing at the live Hermes database directory. Syncthing transports the managed `HermesHubData` workspace, not active SQLite files.

### Continuous background synchronization

Continuous sync is enabled by default while Hermes Hub is running, including when the window is closed to the system tray. You no longer need to press **Sync Now** for ordinary supported changes:

1. Hermes Hub watches safe Hermes skills, memories, `SOUL.md`, `MEMORY.md`, and sanitized configuration sources, plus their managed-workspace counterparts.
2. Rapid save bursts are grouped for about 1.2 seconds so an editor writing several temporary changes starts one cycle instead of many.
3. The safe sync engine stages or applies files using revision hashes and conflict protection.
4. Hermes Hub immediately requests an authenticated Syncthing rescan for every configured Hermes-related folder.
5. A periodic safety pass runs every 30 seconds by default and retries automatically when Syncthing or another PC is offline.

Open **Settings → Continuous synchronization** to disable it or choose a 15, 30, 60, or 120-second safety interval. The panel reports the live phase, last successful reconciliation, changed actions, conflicts, and whether Syncthing transport is unavailable. Enable **Start Hermes Hub with Windows** if background synchronization should begin at login.

The Main PC remains authoritative only for publishing a new initial baseline. After a follower adopts that baseline, supported changes are bidirectional. Continuous mode never turns ambiguous edits into silent overwrites: conflicts remain preserved for review and rollback.

Transfer discovery is faster because Hermes Hub now calls Syncthing's scan endpoint with the required `POST` method and discovers actual configured folder IDs rather than assuming a fixed ID. Network throughput itself remains controlled by Syncthing, Tailscale, disk speed, and peer connectivity. Displayed transfer speed comes from real Syncthing byte counters rather than a simulated value.

### Step 1: choose the Main PC

Decide which current Hermes installation has the memories and skills you trust most. On any computer, open **Devices → Main PC & Initial Copy**, select that device, acknowledge the warning, and choose **Set as Main PC**.

The selection is written to `manifests/mesh-sync-policy.json` inside the managed workspace, allowing the policy to reach the other trusted PCs through Syncthing. Selecting a different Main PC starts a new baseline generation; followers must explicitly adopt the new baseline.

### Step 2: publish from the Main PC

Open Hermes Hub on the computer selected as Main. In **Devices → Main PC & Initial Copy**:

1. Confirm that the panel says this computer has the `primary` role.
2. Close or pause editing of Hermes memories and skills during the short baseline operation.
3. Select the confirmation checkbox.
4. Choose **Back Up & Publish Baseline**.

Hermes Hub first creates a recovery backup. It then stages safe skills, memories, and sanitized configuration information into the managed workspace, regenerates the manifest, marks the baseline ready, and asks Syncthing to rescan. Existing workspace files that are absent from Main are moved into a recoverable `snapshots/pre-baseline-orphans-...` area instead of being included in the new baseline or permanently deleted. The panel records a unique baseline ID so each follower can prove which generation it adopted.

Wait for Syncthing to finish delivering the workspace before continuing on another PC. A “baseline ready” label only means Main finished publishing locally; Syncthing still needs time to transport those files.

### Step 3: copy the baseline on every other PC

On each follower PC, open the same panel and select **Refresh status**. When the Main baseline is available:

1. Verify the displayed Main PC name.
2. Stop making Hermes file edits temporarily.
3. Select the confirmation checkbox.
4. Choose **Back Up & Copy Main PC**.

Before overwriting anything, Hermes Hub creates a local-only recovery bundle named like `local-recovery-...`. It contains the follower's current safe memory and skill files plus a SHA-256 manifest, and lives under the device metadata `recovery` directory (normally `%LOCALAPPDATA%\HermesHub\recovery` on Windows). It then replaces matching safe skill and memory files with the baseline files. Files that exist only on the follower are preserved rather than silently deleted. The resulting adoption record is stored locally for that device and baseline ID.

Repeat this step separately on every follower. Do not copy the Main PC application-data directory manually. Shared Vault ciphertext is transported through the configured workspace or a Hermes Hub migration bundle, never by copying the Windows-protected remembered-key file.

### Step 4: normal two-way change sharing

After a follower reports **Baseline complete**, use **Sync Now** normally on any computer:

1. Hermes Hub compares the supported local files with the managed workspace.
2. A newer local skill or memory is staged into the workspace.
3. Syncthing carries that workspace change to the other PCs.
4. On the receiving PC, the next sync cycle applies the newer workspace version into its local Hermes files.
5. The manifest and device sync statistics are refreshed.

This means a memory edited on a laptop can later flow to the Main PC. Main is authoritative only during baseline creation.

### What is copied

| Data | Baseline copy | Ongoing sharing | Notes |
|---|---:|---:|---|
| Skill files | Yes | Yes | Recursive file copy with hashes and manifests. |
| `SOUL.md`, `MEMORY.md`, and memory files | Yes | Yes | Newer safe file versions move in either direction. |
| Sanitized configuration representation | Published | One-way staging | Secrets are redacted; sanitized config is not written over a live local config. |
| Safe session exports/snapshots | Preserved in workspace/backups | Transportable when explicitly exported | Live session databases are never copied. |
| Live SQLite databases, WAL, SHM, journals, locks | No | No | Excluded to prevent corruption. |
| Shared Vault ciphertext | Not part of baseline overwrite | Yes, through Syncthing | Password-derived AES-256-GCM file. Password and remembered Windows key never travel. |
| API keys, tokens, passwords, private keys, `.env` profiles | Encrypted only | Encrypted only | Never included in manifests, search, diagnostics, activity descriptions, or Git operations. |
| Application binaries | No | No | Use **Application Update** for Hermes Hub releases. |
| Source code | No | No | Use **Source Repository Sync** for the GitHub project. |

### Conflicts and simultaneous edits

Avoid editing the same memory or skill on two offline PCs at the same time. Hermes Hub uses content hashes and modification time to determine the newer safe file, while Syncthing may create a `.sync-conflict-*` copy when both sides changed. Hermes Hub detects those collision files and surfaces them as conflicts rather than intentionally deleting one version.

When a conflict appears:

1. Stop editing that file on every PC.
2. Create or confirm a backup.
3. Compare both versions in the conflict workflow.
4. Choose local, remote, or keep both.
5. Run **Sync Now** and wait for Syncthing to return to idle.

### If the wrong PC was selected

Do not publish it. Select the correct Main PC and start again. If the wrong baseline was already adopted, recover the previous skills and memories from the automatic `local-recovery-...` bundle, select the correct Main PC, publish a new baseline, wait for transport, and adopt the new baseline.

### If a follower is offline

Nothing is forced remotely. Bring it online, allow Syncthing to finish, open the panel on that follower, refresh, and explicitly adopt the current baseline. The action never happens silently.

### Safety guarantees and limits

- Baseline adoption requires an explicit checkbox and button click on each follower.
- A backup is created before publishing and before follower overwrite.
- Extra follower-only files are preserved during baseline adoption.
- Only safe file-based categories are copied automatically.
- Hermes Hub cannot merge the semantic meaning of two independently edited documents; simultaneous edits can require human conflict resolution.
- A device being listed as online does not prove that Syncthing has completed transport. Check Syncthing transfer state before adoption.

## Application updates

Hermes Hub uses GitHub Releases, not arbitrary commits on `main`.

### Manual one-click update

Open **Settings → Application Update → Update**. The app checks GitHub, downloads a newer installer with progress, verifies it, installs it, and restarts.

### Automatic updates

Enable **Automatically download, install, and restart when an update is available**. This also enables startup checks. Keep it disabled if the app must never restart without direct action.

The UI reports idle, checking, current, available, downloading, installing, restart pending, offline, failed, or disabled-in-development states. Only packaged builds update themselves.

## Source repository sync

The **Settings → Source Repository Sync** panel is a separate developer workflow for publishing files changed by coding assistants such as GPT or Reverso and for downloading the latest source code.

The destination is intentionally fixed to [`https://github.com/vicuvi1/Hermes-Sync-Hub.git`](https://github.com/vicuvi1/Hermes-Sync-Hub). The app refuses to operate on a folder whose `origin` points somewhere else.

### Configure the local folder

1. Open **Settings → Source Repository Sync**.
2. Select **Browse** and choose the local `Hermes-Sync-Hub` folder containing `.git`.
3. Select **Check**. The panel displays the branch, short commit, ahead/behind counts, and every changed file.

Git must be installed and authenticated for GitHub on the computer. This requirement applies only to source repository sync; normal application updates do not require Git, Node.js, pnpm, or source code.

### Pull the latest source

Select **Pull Latest**. For safety, the app allows only a fast-forward update on `main` and refuses to pull while uncommitted local edits exist. Commit or otherwise handle those edits first so a pull cannot silently overwrite them.

### Commit and push changes

1. Review the complete changed-files list.
2. Enter a clear commit message.
3. Select the confirmation checkbox.
4. Select **Commit & Push**.

The app stages the displayed working-tree changes, creates a commit when needed, and pushes `HEAD` to `origin/main`. It blocks likely environment files, credentials, tokens, private keys, Vault content, and local database files. GitHub may still reject a push if authentication is missing, branch protection applies, or the remote contains commits that have not been pulled.

## Data, privacy, and security

### Typical Windows locations

| Data | Location |
|---|---|
| Installed app | `%LOCALAPPDATA%\Programs\Hermes Hub` |
| Settings and Electron data | `%APPDATA%\Hermes Hub` |
| Device identity | `%LOCALAPPDATA%\HermesHub` |
| Crash log | `%APPDATA%\Hermes Hub\logs\main-process.log` |
| Shared Vault ciphertext | `<workspace>\vault\shared-vault.enc` |
| Optional remembered unlock key | `%APPDATA%\Hermes Hub\vault\shared-vault-key.bin` |
| Workspace | Selected during onboarding or the application default |

Locations can vary with Windows configuration and custom paths.

### Network behavior

- The local agent binds to loopback rather than a public interface.
- Update checks contact GitHub Releases.
- Tailscale and Syncthing follow their own configuration.
- Hermes Hub includes no advertising or analytics telemetry.

### Secret handling

- Authenticated AES-256-GCM Shared Vault encryption.
- Password-to-key derivation with `scrypt` and a random per-Vault salt.
- Optional Windows-protected remembered unlock key through Electron secure storage.
- Masked listings and explicit reveal.
- Automatic reveal hiding and conditional clipboard clearing.
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

The managed workspace is a controlled interchange layer for manifests, file-based memories, skills, supported configs, exports, snapshots, revision metadata, and Shared Vault ciphertext.

Hermes Hub rejects or excludes active SQLite files, `-wal`, `-shm`, locks, partial writes, plaintext secrets, remembered Vault key material, and files outside configured scope. When two devices modify the same managed asset, the engine records a conflict instead of silently overwriting one version. Preserve both versions and create a backup before manual conflict intervention.

## Backups and recovery

- Backup creation uses safe snapshot logic rather than copying actively modified databases.
- Verification checks expected structure and available integrity metadata.
- Restoration creates a pre-restore rollback snapshot.
- Retention prunes older managed backups only after successful creation.
- Retention is not a substitute for an independent offline backup.

### Moving to a new PC

Open **Backups → Recovery Center → Create migration bundle**. Choose an external drive or another local destination. The generated folder contains:

- A versioned migration manifest and selected application preferences.
- Safe workspace memories, skills, and configuration representations.
- The Shared Vault encrypted file, when configured.
- Restore instructions suitable for the destination PC.

Install Hermes Hub on the new PC, open **Backups → Recovery Center → Import migration bundle**, select the folder, and confirm. Hermes Hub creates a rollback backup before importing. Then open Vault and use the same Shared Vault password. Live databases, application binaries, Windows-protected remembered keys, and plaintext secret values are not placed in the bundle.

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

Confirm that the password is exactly the one used by the PC that created or last changed the Shared Vault. If Syncthing reports a conflict, preserve every conflict copy. Do not create a new Vault over the existing file. Restore the encrypted file from a migration bundle or known-good backup when necessary.

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
git tag -a v0.6.1 -m "Hermes Hub v0.6.1"
git push origin v0.6.1
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
- Synchronization is public-beta quality: revision baselines, tombstones, recovery copies, and local/remote/keep-both resolution are implemented, but large binary and cross-platform rename workflows remain experimental.
- Search is private lexical full-text search, not semantic search.
- Updates require GitHub Releases access.

Completed for v0.4: password-unlocked Shared Vault transport, previous-Vault migration, expanded credential types, reusable `.env` profiles, remembered per-PC access, Vault conflict visibility, and migration bundle export/import with automatic rollback backup.

Completed for v0.3 public beta: desktop foundation, local agent, Hermes discovery, adapters, registry, pairing, workspace, manifests, per-device sync baselines, conflict recovery/tombstones, Main PC baseline onboarding, two-way safe-file propagation, universal local Command Center, persistent activity, encrypted local Vault, backups and recovery browsing, tray, diagnostics, onboarding, health, NSIS installer, manual/automatic updater, Developer Mode, and in-app Help.

Planned: richer unified text diffs and rename matching, optional semantic search, more granular category policies per device, Windows code signing, and evaluation of additional packaged platforms after Windows stabilizes.

## Contributing

Keep changes focused, preserve local-first and honest-state behavior, never add real secrets or databases to fixtures, add tests for behavior changes, run `pnpm build` and `pnpm test`, and document settings, IPC, release, and recovery changes. Treat updater, vault, backup, restore, and sync changes as high-risk paths requiring packaged validation.

## License

MIT © [Victor](https://github.com/vicuvi1)
