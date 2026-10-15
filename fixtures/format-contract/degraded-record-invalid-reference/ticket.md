---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000207
key: LC-207
title: A reference that climbs out of the project degrades alone
status: todo
priority: none
created_at: 2026-10-15T00:00:00Z
updated_at: 2026-10-15T00:00:00Z
---

A relative path is read from the project root, so one that climbs out of it
would leave the project without the row saying so. That record degrades; the
one beside it stays.

## Ticket References

<!-- longclaw:reference
id: ref_0001
path: ../elsewhere/notes.md
added_at: 2026-10-15T00:01:00Z
added_by:
  type: agent
  id: some-tool
-->
[notes.md](<../../../../elsewhere/notes.md>)
<!-- /longclaw:reference -->

<!-- longclaw:reference
id: ref_0002
path: docs/plan.md
added_at: 2026-10-15T00:02:00Z
added_by:
  type: human
  id: local
-->
[plan.md](<../../../docs/plan.md>)
<!-- /longclaw:reference -->
