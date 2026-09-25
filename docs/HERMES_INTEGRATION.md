# Hermes Integration Architecture & Discovery

## 1. Local Hermes Discovery Strategy

Hermes Agent installations vary by operating system and user setup. Rather than hardcoding fixed paths, the `HermesAdapter` performs discovery in a prioritized sequence:

### Standard Locations
- **Windows**:
  - `%LOCALAPPDATA%\hermes` (e.g. `C:\Users\<user>\AppData\Local\hermes`)
  - `%APPDATA%\hermes` (e.g. `C:\Users\<user>\AppData\Roaming\hermes`)
  - `%USERPROFILE%\.hermes`
- **macOS / Linux**:
  - `~/.hermes`
  - `~/.config/hermes`
  - `$XDG_DATA_HOME/hermes`
- **Environment Overrides**:
  - `HERMES_HOME`
  - `HERMES_PROFILE`

### Inspection Findings on Target Machine
Direct local filesystem inspection reveals:
1. `skills/`: Directory of modular agent capabilities and instructions.
2. `sessions/`: Session logs and transcripts.
3. `profiles/`: Profile-specific configs.
4. `SOUL.md`: Agent persona and system prompt configuration.
5. `config.yaml`: Core agent runtime configuration.
6. `.env`: Sensitive credentials and provider keys (e.g. OpenRouter, OpenAI, Anthropic).
7. `state.db`: Core SQLite database with active WAL journal (`state.db-wal`, `state.db-shm`) and lockfiles (`state.db.auto-maintenance.lock`).
8. `kanban.db` and `projects.db`: Supplementary tracking databases.

---

## 2. Safe SQLite State Extraction (Anti-Corruption Guarantee)

Because `state.db` actively uses SQLite WAL mode during agent execution, copying the file while Hermes is running will cause database corruption.

### Safe Snapshot Procedure:
1. **Agent-Level Lock Check**: Check for `.lock` files or active Hermes processes.
2. **Vacuum Snapshotting**:
   Execute an atomic read-only snapshot using SQLite's vacuum or backup API:
   ```sql
   VACUUM INTO 'HermesHubData/snapshots/temp-snapshot.db';
   ```
3. **Structured Extraction**:
   Export records to deterministic JSONL files for session history, memory notes, and project metadata.
4. **Digest Hashing**: Compute SHA-256 digests of exported items before presenting them to the sync workspace.

---

## 3. Hermes Service Contract

```typescript
export interface HermesInstallation {
  homePath: string;
  configPath: string;
  version: string;
  executablePath?: string;
  activeProfile: string;
  detectedDatabases: string[];
}

export interface HermesStatus {
  isInstalled: boolean;
  isRunning: boolean;
  pid?: number;
  homeDirectory: string;
  profile: string;
  stats: {
    sessionsCount: number;
    skillsCount: number;
    memoriesCount: number;
    totalSizeBytes: number;
    lastActivityAt?: string;
  };
}

export interface HermesService {
  detect(): Promise<HermesInstallation | null>;
  getStatus(): Promise<HermesStatus>;
  getSessions(): Promise<HermesSessionSummary[]>;
  getSkills(): Promise<HermesSkillItem[]>;
  getMemories(): Promise<HermesMemoryItem[]>;
  getConfigFiles(): Promise<HermesConfigFile[]>;
}
```
