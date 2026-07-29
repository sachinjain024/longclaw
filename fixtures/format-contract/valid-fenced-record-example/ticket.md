---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000024
key: LC-35
title: A description may quote a record without owning one
status: todo
priority: p2
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T06:00:00Z
---

The generated agent contract shows what an activity record looks like, so a
ticket about agent onboarding will quote one:

```md
<!-- longclaw:event
id: evt_4b91c07a
kind: update
occurred_at: 2026-07-29T09:12:31Z
actor:
  type: agent
  id: your-tool-id
-->
### Your Tool updated this ticket
<!-- /longclaw:event -->
```

A quoted record is documentation. It is not a record this ticket owns, and it is
not a reason to call the ticket broken.

## Activity

<!-- longclaw:event
id: evt_7c2d9e10
kind: comment
occurred_at: 2026-07-29T06:00:00Z
actor:
  type: human
  id: local
-->
### You commented

The fenced block above is the only place a record marker appears outside the
Activity section, and it does not count.
<!-- /longclaw:event -->
