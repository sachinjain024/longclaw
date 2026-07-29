---
format: longclaw.ticket/v1
id: 019c8c7e-6a10-7c44-b2d1-0f4c1b6d9a55
key: LC-2
title: Preserve unknown frontmatter during writes
status: todo
priority: p3
labels:
  - storage
  - reliability
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
x_fixture_extension:
  owner: future-version
  notes:
    - unknown keys survive a read-modify-write round trip
---

Used for manual visual review of atomic writes that must leave unrelated
metadata byte-identical.

## Checklist

- [ ] Edit the title in LongClaw <!-- longclaw:item=ck_2a01 -->
- [ ] Confirm unrelated metadata remains unchanged <!-- longclaw:item=ck_2a02 -->

## Activity

<!-- longclaw:event
id: evt_9d0c4471
kind: comment
occurred_at: 2026-07-29T08:40:00Z
actor:
  type: agent
  id: fixture-agent
  name: Fixture Agent
-->
### Fixture Agent commented

I left `x_fixture_extension` in place so the round-trip check has something to
protect.
<!-- /longclaw:event -->
