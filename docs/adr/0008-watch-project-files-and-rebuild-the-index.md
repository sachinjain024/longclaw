# Watch project files and rebuild the index

**Status:** proposed for acceptance at the M2 human-review gate.

Use a native recursive watcher on the selected project’s `.longclaw/tickets` directory. Normalize each notification burst into canonical `ticket.md` paths, wait for a 140 ms quiet period with a 900 ms maximum burst, and confirm the destination file is stable across a 35 ms interval before parsing.

The in-process ticket index is disposable. Opening, resuming, or manually rebuilding a project clears it and scans canonical ticket files. A valid ticket becomes an indexed record; an invalid or unsupported ticket becomes a degraded record with its content hash, relative path, and diagnostic. No repair write is attempted.

Before an app-authored atomic rename, record `(canonical path, output hash, five-second expiry)`. A watcher event is suppressed only when both path and observed content hash match that receipt. The command itself updates the index exactly once. A different hash is always external, even during the receipt window.

## Consequences

- FSEvents rename/write variations and rapid successive edits collapse to one visible update containing the final stable content.
- Deleted files remove their indexed record. A missing project root emits an unavailable state.
- App resume and frontend focus/visibility recovery request a full reconciliation because native watcher streams are not treated as durable logs.
- The v0 external module interface should stay small: `open`, `snapshot`, `write`, `search`, and `rebuild`. Debounce, stabilization, parsing, receipts, and watcher adapters remain implementation details behind that seam.
- Ignoring all watcher events for a fixed time after an app write was rejected because it can hide a real external edit. Parsing every raw event was rejected because common editors emit partial and rename-heavy bursts. Making SQLite authoritative was rejected because it violates the project-file contract. SQLite remains a possible disposable index adapter only if later scale evidence requires it.
