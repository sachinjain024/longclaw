# Commands, events, and channels have distinct IPC jobs

**Status:** accepted at the M2 human-review gate on 2026-07-29.

Use Tauri commands for request/response work, a single versioned project-event topic for low-volume invalidations and external changes, and Tauri channels for ordered high-throughput streams.

Command inputs use domain identifiers (`projectId`, `ticketKey`, expected content hash), never caller-supplied canonical ticket paths. Command results and failures are serializable DTOs using `camelCase`. The project event is `longclaw://project-event` and carries:

- `contractVersion`;
- a per-project monotonic `sequence`;
- `projectId` and emission time;
- a tagged event payload.

The spike includes an actual `Channel<StreamFrame>` path with tagged `started`, `chunk`, and `finished` frames. Phase 2 can replace the architecture-probe producer with a PTY producer without changing the frontend consumption shape. Binary output stays bytes and is not forced through UTF-8 event strings.

Enum variant names and every field inside their payloads serialize as `camelCase`. A shared JSON fixture is asserted by Rust for every project-event and stream-frame variant, then replayed through the Zustand event consumer for deletion and unavailable-state behavior. This keeps the Rust serializer and TypeScript consumer on one visible contract.

## Consequences

- Commands acknowledge in-app mutations only after the atomic disk write and index update succeed.
- Low-volume events may be recovered by requesting a full snapshot; the frontend does not assume event delivery is durable.
- Phase 2 PTY output must use channels, not the global event topic.
- Every listener is unregistered on React unmount.
- Direct JavaScript evaluation was rejected because it makes contracts implicit and couples Rust to DOM implementation. One event name per filesystem action was rejected because it creates a broad, hard-to-version interface. Global events for PTY chunks were rejected because Tauri documents channels as the ordered, high-throughput path.
