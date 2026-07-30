# Watch project files and rebuild the index

**Status:** accepted at the M2 human-review gate on 2026-07-29.

Use a native recursive watcher on the selected project’s `.longclaw/tickets` directory. Normalize each notification burst into canonical `ticket.md` paths, wait for a 140 ms quiet period with a 900 ms maximum burst, and confirm the destination file is stable across a 35 ms interval before parsing.

The in-process ticket index is disposable. Opening, frontend focus/visibility recovery, or manually rebuilding a project clears it and scans canonical ticket files. A valid ticket becomes an indexed record; an invalid or unsupported ticket becomes a degraded record with its content hash, relative path, and diagnostic. No repair write is attempted.

Before an app-authored atomic rename, record `(canonical path, output hash, five-second expiry)`. A watcher event is suppressed only when both path and observed content hash match that receipt. The command itself updates the index exactly once. A different hash is always external, even during the receipt window.

## Consequences

- FSEvents rename/write variations and rapid successive edits collapse to one visible update containing the final stable content.
- Deleted files remove their indexed record. A missing project root emits an unavailable state.
- Frontend focus/visibility recovery requests a full reconciliation because native watcher streams are not treated as durable logs. Tao does not emit its lifecycle `Resumed` event on macOS; Phase 1 must add an `NSWorkspaceDidWakeNotification` adapter if wake itself must trigger reconciliation while the window remains focused.
- The v0 external module interface should stay small: `open`, `snapshot`, `write`, `search`, and `rebuild`. Debounce, stabilization, parsing, receipts, and watcher adapters remain implementation details behind that seam. (Revised at Step 6 — see below.)
- Ignoring all watcher events for a fixed time after an app write was rejected because it can hide a real external edit. Parsing every raw event was rejected because common editors emit partial and rename-heavy bursts. Making SQLite authoritative was rejected because it violates the project-file contract. SQLite remains a possible disposable index adapter only if later scale evidence requires it.

## Revised at Step 6

**Status:** accepted on 2026-07-30, during Step 6 implementation.

The seam is `open`, `snapshot`, `detail`, `search`, `rebuild`, `edit_ticket`, and `create_ticket`. Reading splits in two because a ticket panel needs the file as it is now, not an index row that may be a moment old. Writing splits in two because creating a ticket allocates its key by scanning canonical directories rather than accepting one from the caller, so creation cannot be expressed as an ordinary write.

Debounce, stabilization, parsing, and receipts remain behind the seam. The watcher adapter does not: choosing a deterministic polling adapter is public so integration tests assert this pipeline's behaviour rather than the platform's event timing. Production always uses the native adapter. Hiding the adapter behind a Cargo feature was rejected because a crate cannot enable a feature for its own tests, so the choice would have been between a broken `cargo test` and watcher tests that are silently skipped.

Project metadata is deliberately outside this seam. Reading and writing `longclaw.yaml` lives in the storage library, so a theme or name change is not routed through the ticket index and its watcher.
