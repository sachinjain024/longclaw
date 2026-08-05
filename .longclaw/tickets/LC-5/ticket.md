---
format: longclaw.ticket/v1
id: 5f10e595-8632-4b19-9dd3-d5a252cc735f
key: LC-5
title: Move scans, parsing, and fsync onto bounded blocking workers; publish one snapshot back on the Tauri handle
status: done
priority: urgent
labels:
  - platform
  - v0-backlog
created_at: 2026-08-05T14:22:48Z
updated_at: 2026-08-05T14:22:49Z
---

~~Move scans, parsing, and fsync onto bounded blocking workers; publish one snapshot back on the Tauri handle~~ **Done 2026-07-31** — each project owns a bounded two-worker blocking pool; `rebuild_index` returns the current snapshot promptly, coalesces overlapping requests, and publishes one final `IndexRebuilt` event. [Plan 06](../../../docs/plans/completed/06-blocking-workers.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-05**, Wave 0, step 14, owner Platform.

## Checklist

- [x] Passed: npm --prefix apps/desktop run perf:rust with 5,000 tickets (concurrent_request_ms=82.72), two targeted native test:watcher runs, and the check/frontend/Rust/build portions of npm run verify; worker jobs never access a webview <!-- longclaw:item=ck_193cc2df -->

## Activity

<!-- longclaw:event
id: evt_24eaa78c
kind: create
occurred_at: 2026-08-05T14:22:48Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e6d22974
kind: update
occurred_at: 2026-08-05T14:22:49Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_193cc2df.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-05 is recorded there as passed.
<!-- /longclaw:event -->
