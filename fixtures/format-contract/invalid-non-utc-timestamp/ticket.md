---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000020
key: LC-31
title: Timestamps are UTC RFC 3339 strings
status: todo
priority: none
created_at: 2026-07-29T05:30:00+05:30
updated_at: 2026-07-29T00:00:00Z
---

A local offset is a valid instant and still not the format's timestamp shape, so
the diagnostic names the rule rather than quietly converting the value.
