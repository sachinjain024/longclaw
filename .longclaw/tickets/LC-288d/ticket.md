---
format: longclaw.ticket/v1
id: 62e118d2-8edc-4dff-8237-2cab04055571
key: LC-288d
title: Confirm the refused-password error number at a real macOS admin sheet
status: todo
priority: p3
labels:
  - platform
type: chore
created_at: 2026-11-20T13:46:57.857Z
updated_at: 2026-11-20T13:47:06.646Z
---

LC-285r shipped in 0.4.0 assuming macOS answers a wrong admin password with -60005 or -60007 (privileged.rs, outcome_of). That has never been seen at a real sheet. If the number differs, a wrong password reads as a cancel ("Nothing was installed.", no sudo line) or as a failure ("…even as an administrator: … (number)", with the sudo line as a safety net) instead of the refused-password message. Run section C of docs/acceptance/LC-285r-manual-test-plan.md on a Mac, record what C1 shows, and fix the mapping if it is wrong. Carried over from LC-285r checklist 3.3.

## Ticket References

<!-- longclaw:reference
id: ref_c4736b80
path: docs/acceptance/LC-285r-manual-test-plan.md
added_at: 2026-11-20T13:47:06.646Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[LC-285r-manual-test-plan.md](../../../docs/acceptance/LC-285r-manual-test-plan.md)
<!-- /longclaw:reference -->

## Activity

<!-- longclaw:event
id: evt_a77d7bd5
kind: create
occurred_at: 2026-11-20T13:46:57.857Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6ae683f7
kind: update
occurred_at: 2026-11-20T13:47:06.646Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_c4736b80.added
    to: LC-285r-manual-test-plan.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
