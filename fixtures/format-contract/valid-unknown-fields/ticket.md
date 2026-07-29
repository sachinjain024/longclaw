---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000002
key: LC-7
title: Unknown supported keys survive a round trip
status: todo
priority: p2
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
x_scalar_extension: kept verbatim
x_mapping_extension:
  owner: future-version
  nested:
    depth: 2
x_sequence_extension:
  - first
  - second
---

An unknown key is not an error. A reader that cannot interpret a key must still
hand it back unchanged when it writes.

## Checklist

- [ ] Round-trip the file <!-- longclaw:item=ck_0001 -->
