# Changelog

All notable changes are documented here. The project uses semantic version tags.

## 0.9.0 — Continuous background synchronization

- Added continuous synchronization enabled by default while Hermes Hub runs, including recursive file watching, 1.2-second edit-burst debouncing, a 30-second safety reconciliation, and automatic offline retry.
- Added serialized sync execution so background, manual, memory-edit, and tray-triggered cycles never race each other.
- Added a live Settings panel with on/off control, 15/30/60/120-second reconciliation choices, current phase, last success, changed-action count, conflict count, and honest transport errors.
- Fixed immediate Syncthing rescans to use the required authenticated `POST /rest/db/scan` operation instead of `GET`.
- Removed the hardcoded Syncthing folder ID and now rescans every configured, unpaused Hermes-related workspace folder without touching unrelated folders.
- Replaced fictional fixed transfer-speed values with rates calculated from real Syncthing connection byte counters.
- Preserved Main PC baseline authority, revision hashes, tombstones, recoverable conflicts, and the rule that ambiguous simultaneous edits are never silently overwritten.
- Expanded the full suite to 170 passing tests, including CRLF stability so an unchanged Windows configuration cannot create an endless sync loop.

## 0.8.0 — Live OpenRouter and Hermes profile routing

- Added an OpenRouter connection center that detects the key in the active Hermes environment and validates it with OpenRouter's authenticated key endpoint without exposing the secret to the renderer or spending model credits.
- Added live key-tier, usage, limit, and remaining-budget information using only redacted OpenRouter metadata.
- Added a searchable live OpenRouter model browser with current pricing, free status, context size, tool support, and vision support.
- Added one-click catalog model import into the local routing-policy draft.
- Added native Hermes profile configuration for a primary model and ordered provider fallbacks, with a recovery backup before every change.
- Added an explicit end-to-end test that launches the real Hermes CLI through a selected OpenRouter model and reports latency and redacted output.
- Verified the real installed Hermes/OpenRouter path on Windows and expanded the suite to 165 passing tests.

## 0.7.1 — Optional zero-credit semantic routing

- Added an opt-in local semantic classifier powered by the Apache-2.0 Transformers.js runtime and a quantized MiniLM embedding model.
- Added explicit one-time model preparation, application-data caching, readiness/error states, and clear disk/network consent.
- Kept deterministic classification as the default and automatic fallback when the local model is unavailable or below the configured confidence threshold.
- Added an editable semantic confidence threshold and route explanations showing semantic confidence.
- Added supply-chain policy allowing only the required ONNX runtime install script; optional image and protobuf build scripts remain disabled.
- Verified real local inference produces finite 384-dimensional embeddings without provider requests or model-credit usage.
- Expanded Smart Router coverage to seven focused tests and 163 total repository tests.

## 0.7.0 — Smart Model Router and native bot builder

- Added a dedicated Smart Router workspace with overview, bot, model, pool, rule, simulator, and history tabs.
- Added native Hermes profile discovery and confirmed profile creation instead of introducing a competing bot runtime.
- Added deterministic local task classification with free-first routing for general, coding, research, analysis, writing, vision, and tool-use work.
- Added exact model/provider configuration, editable pools, ordered routing rules, and a live OpenRouter catalog refresh for current free status, context, and prices.
- Added fail-closed paid-model approval, a complexity floor, per-task and daily cost limits, and a daily paid-run limit.
- Added route simulation that explains every score and choice before executing anything.
- Added confirmed one-shot Hermes execution with exact profile/model selection, redacted local history, and Hermes-reported token/cost capture when available.
- Added typed renderer/preload/main-process IPC contracts, strict privileged input validation, activity journal events, global-search discovery, and six focused router tests.

## 0.6.2 — Real product gallery

- Added release-resolution screenshots captured from the real Hermes Hub Electron renderer.
- Added an interface preview to both the GitHub README and the bundled in-app handbook.
- Sanitized Demo Mode device names, hostnames, filesystem paths, network examples, sessions, and activity descriptions before capture.
- Added responsive image presentation in **Help & README** while retaining descriptive alternative text.
- Published Overview, Sessions, and Shared Vault views without exposing personal data or credentials.

## 0.6.1 — Professional project presentation

- Reworked the public README opening around the user problem, product value, trust model, major capabilities, and a five-minute Windows setup.
- Kept the repository README and the bundled **Help & README** handbook as one versioned source of truth.
- Added direct download, support, issue, CI, release, platform, license, and public-beta signals for new users.
- Added curated release notes with installation, verification, highlights, known limitations, and support links.
- Updated release automation to publish curated notes when present and generated notes as a fallback.

## 0.6.0 — Hermes Booster

- Reframed the Hermes section as a companion control surface for the existing Hermes app, with a direct **Open Hermes App** action.
- Added live Hermes Doctor health checks, warning/error counts, redacted diagnostic output, and repair guidance.
- Connected the existing encrypted credential bridge, recovery-backed memory editor, cross-PC synchronization, backup center, and model cost reporting into one Booster overview.
- Added native Hermes skills inventory, update checks, safe updates, and Skill Sync actions.
- Added live MCP and tool inventory with per-server connection tests; interactive setup remains in Hermes itself.
- Added native plugin inventory, search, enable/disable controls, update checks, and updates for non-bundled plugins.
- Added the official Hermes update check and plan plus backup-first execution using `hermes update --yes --backup --keep-stash`.
- Replaced the fictional fallback Hermes version with an honest `unknown` state when version probing fails.
- Added strict, typed IPC contracts and tests for Booster parsing, plugin validation, and safe update arguments.

## 0.5.1 — One-click Windows requirements

- Added a guided **Install missing requirements** action in Settings for Tailscale and Syncthing.
- Added individual install and official-download actions for each integration.
- Restricted the privileged installer to the exact official `Tailscale.Tailscale` and `Syncthing.Syncthing` Windows Package Manager IDs.
- Added progress, completion, recovery guidance, activity logging, and automatic status refresh after installation.
- Kept account sign-in, Syncthing folder approval, licenses, and Windows administrator confirmation under user control.

## 0.5.0 — Direct Hermes bridge

### Added

- Dedicated Hermes Control Center with live runtime, inventory, usage, model, price, extension, and Vault status.
- Direct, recovery-backed editing for discovered Hermes Markdown memories with stale-edit protection.
- Encrypted credential import from the local Hermes environment into Shared Vault.
- Confirmed application of Vault environment profiles to Hermes without exposing plaintext to the renderer.
- Live OpenRouter catalog pricing for model IDs found in local Hermes sessions.

### Changed

- Memory discovery now includes root and nested Markdown memories.
- Skill discovery recursively counts files and reads available documentation summaries.
- File discovery now inventories user-relevant content across the Hermes home instead of three hardcoded files.
- Generated runtimes, dependency trees, and caches are summarized to keep the interface responsive.

### Safety

- Every memory edit and credential application creates recovery material before changing Hermes.
- Live databases, WAL/SHM files, locks, binaries, and secret values remain non-editable from the inventory.

## 0.4.2 — Subtle motion

### Changed

- Added a brief fade-and-lift transition when moving between application sections.
- Added a gentle animated glow to the Hermes Hub mark.
- Smoothed interactive card and button transitions throughout the workspace.
- Disabled decorative motion automatically when Windows reduced-motion preferences are enabled.

## 0.4.1 — Interface refinement

### Changed

- Grouped navigation into Workspace, Mesh & safety, and Application sections for faster scanning.
- Refined the application header with clearer breadcrumbs, search affordance, and action hierarchy.
- Added Shared Vault summary cards for secrets, environments, revision state, and upcoming expirations.
- Improved Vault tabs, conflict messaging, responsive spacing, and visual feedback.
- Added subtle workspace depth and clearer focus styling across light and dark themes.

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
