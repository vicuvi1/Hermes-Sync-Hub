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
├── vault/
│   └── secrets.vault.enc
├── snapshots/
│   └── state-export-rev142.jsonl
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
  2. Hermes Hub tags the conflict in the local SQLite metadata:
     `status: "CONFLICT"`, tracking both `leftVersion` and `rightVersion`.
  3. The conflict is surfaced in the UI:
     - Clear visual diff comparison.
     - Fast resolution actions: `Use Desktop`, `Use Zenbook`, or `Keep Both`.
  4. Automatic line merging is permitted ONLY for clear, append-only logs or Markdown memory blocks when AST analysis indicates non-overlapping additions.
  5. Live SQLite files are NEVER merged; only safe snapshots and exported records are compared.
