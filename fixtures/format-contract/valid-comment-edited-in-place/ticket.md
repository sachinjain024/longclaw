---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000031
key: LC-31
title: A reworded comment keeps its place in the stream
status: todo
priority: none
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

A comment's words belong to their author, so the author may rewrite them where
they stand. The entry records when that happened without moving.

## Activity

<!-- longclaw:event
id: evt_11111111
kind: comment
occurred_at: 2026-07-29T01:00:00Z
edited_at: 2026-07-29T04:00:00Z
actor:
  type: human
  id: local
-->
### You commented

The words as they now read.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_22222222
kind: comment
occurred_at: 2026-07-29T02:00:00Z
actor:
  type: agent
  id: quiet-agent
-->
### Quiet Agent commented

Said later than the entry above, and still second in the file — because the
stream is ordered by when a thing was said, not by when it was last touched.
<!-- /longclaw:event -->
