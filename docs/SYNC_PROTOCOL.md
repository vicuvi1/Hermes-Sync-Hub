# Synchronization Protocol & Conflict Resolution

## 1. Directory Layout: HermesHubData

The Hermes Hub workspace separates synchronized sync assets from live application files:

```
HermesHubData/
├── devices/
│   ├── victor-desktop-manifest.json
│   ├── victor-zenbook-manifest.json
│   └── laptop-manifest.json
├── manifests/
│   ├── index.json
│   └── revisions.json
├── memories/
│   ├── MEMORY.md
│   └── topic_notes/
├── skills/
│   ├── python-dev/
│   └── web-research/
├── configs/
│   └── config.template.yaml
├── snapshots/
│   ├── conflict-recovery-.../
│   └── pre-baseline-orphans-.../
├── backups/
│   └── hub-backup-2026-09-26.tar.gz
└── activity/
    └── device-events.log
```

---

## 2. Revision Vectors & Conflict Resolution

### Vector Revisions
Each synchronized object tracks:
- `id`: Unique identifier (UUID or normalized relative path).
- `path`: Normalized path relative to sync root.
- `sha256`: Cryptographic content digest.
- `size`: Byte count.
- `modifiedAt`: ISO timestamp.
- `originDevice`: ID of the device where edit originated.
- `revision`: Monotonically increasing integer counter.

### Conflict Detection Strategy
- When two devices edit the same file concurrently before a sync cycle completes:
  1. The file hashes will diverge while both claim a successor revision.
2. Hermes Hub compares both sides with the last per-device baseline hash and writes the unresolved record to managed conflict metadata, tracking `leftVersion`, `rightVersion`, deletion state, origin, and the baseline hash.
  3. The conflict is surfaced in the UI:
     - Clear visual diff comparison.
     - Fast resolution actions: `Use Desktop`, `Use Zenbook`, or `Keep Both`.
  4. Before a confirmed resolution, both versions are copied to a `conflict-recovery-*` artifact. Deletion is propagated only after an explicit local/remote choice and is recorded as a tombstone.
  5. Automatic content merging is not part of the v0.3 beta; ambiguous changes always require a choice.
  6. Live SQLite files are NEVER merged; only supported safe files and exported records are compared.

Vault files, master keys, live databases, diagnostics, credentials, and tokens are never stored in `HermesHubData`.
