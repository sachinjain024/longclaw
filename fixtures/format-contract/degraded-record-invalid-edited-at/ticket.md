---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000032
key: LC-32
title: An unreadable edited_at degrades only its own entry
status: todo
priority: none
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

`edited_at` is a timestamp and is held to the same rule as `occurred_at`: UTC,
or the record is not read. The rest of the file is unaffected.

## Activity

<!-- longclaw:event
id: evt_33333333
kind: comment
occurred_at: 2026-07-29T01:00:00Z
edited_at: yesterday afternoon
actor:
  type: human
  id: local
-->
### You commented

This entry cannot be read, because when it was last edited cannot be.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_44444444
kind: comment
occurred_at: 2026-07-29T02:00:00Z
actor:
  type: human
  id: local
-->
### You commented

This entry is intact and must still be visible.
<!-- /longclaw:event -->
