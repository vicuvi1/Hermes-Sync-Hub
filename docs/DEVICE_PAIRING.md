# Device Pairing Workflow

## 1. Zero-Friction Peer Pairing Model

Adding a new device to an existing Hermes Hub mesh requires minimal manual intervention while maintaining strict security:

```
[Device A: Initiator]                            [Device B: Joiner]
         │                                               │
  Click "+ Add Device"                                    │
  Generate One-Time Pairing Code                         │
  (e.g. HERMES-84Q2-KM7D)                                │
  Payload: { SyncthingID, TailscaleIP, EphemeralKey }    │
         │                                               │
         │ ──────────── Pairing Code or QR ────────────► │
         │                                       Enter Code / Scan QR
         │                                       Validate Signature
         │ ◄── Syncthing Device Introduction ─────────── │
  Auto-Accept Peer via REST                              │
  Share 'HermesHubData' Folder                           │
         │ ────────────────────────────────────────────► │
  Synced Manifest Handshake                              │
  Local Hermes Detected                                  │
         ▼                                               ▼
  [Device Added ✓]                                [Device Added ✓]
```

---

## 2. Pairing Sequence

1. **Initiator (Device A)**:
   - Generates a cryptographically strong 16-character base32 pairing code (formatted as `HERMES-XXXX-XXXX`).
   - Gathers Device A's Tailscale IP, Syncthing Device ID, and public exchange key.
   - Listens on an ephemeral encrypted local handshake listener or advertises on local Syncthing cluster.

2. **Joining Machine (Device B)**:
   - User clicks **"Join existing Hermes Hub"** on Device B's initial launch.
   - Enters pairing code.
   - Hermes Hub automatically:
     - Detects local Tailscale status.
     - Adds Device A's Syncthing Device ID to local Syncthing via REST API.
     - Maps the shared `HermesHubData` folder with cluster ID `hermes-hub-sync`.
     - Validates peer connection over the Tailscale IP.

3. **Status Confirmation**:
   - The UI on both devices displays confirmation:
     - Device added ✓
     - Hermes detected ✓
     - Syncthing connected ✓
     - Tailscale connected ✓
     - Synchronizing...
