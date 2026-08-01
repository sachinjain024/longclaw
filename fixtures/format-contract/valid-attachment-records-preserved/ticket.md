---
format: longclaw.ticket/v1
id: 019c8d10-1a2b-7c3d-9e4f-5a6b7c8d9e01
key: LC-77
title: An agent registered attachments this build cannot render
status: todo
priority: p3
labels:
  - storage
created_at: 2026-07-30T08:00:00Z
updated_at: 2026-07-30T08:05:00Z
---

ADR 0005 ships the on-disk attachment format with no attachment UI, so every
record below is data the app carries and never renders.

## Checklist

- [ ] Keep the registry intact <!-- longclaw:item=ck_5501 -->
- [x] Register the bytes first <!-- longclaw:item=ck_5502 -->

## Attachments

<!-- longclaw:attachment
id: att_1001
file: attachments/att_1001-screenshot.png
name: screenshot.png
media_type: image/png
size: 51200
added_at: 2026-07-30T08:01:00Z
added_by:
  type: human
  id: sachin
-->
[screenshot.png](./attachments/att_1001-screenshot.png)
<!-- /longclaw:attachment -->

<!-- longclaw:attachment
id: att_1002
file: attachments/att_1002-trace-bundle.lcarchive
name: trace-bundle.lcarchive
media_type: application/x-longclaw-archive
size: 8388608
added_at: 2026-07-30T08:02:00Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[trace-bundle.lcarchive](./attachments/att_1002-trace-bundle.lcarchive)
<!-- /longclaw:attachment -->

<!-- longclaw:attachment
id: att_1003
file: attachments/att_1003-capture.avif
name: capture.avif
media_type: image/avif
size: 12048
added_at: 2026-07-30T08:03:00Z
added_by:
  type: agent
  id: some-future-tool
  name: A Newer Writer
checksum: sha256:0f4a1c9e6b2d8a37c51e0d9f7b4a2c68e3d5f109a7b6c4d2e8f0a1b3c5d7e9f1
x_origin:
  tool: some-future-tool
  capture_mode: lossless
-->
[capture.avif](./attachments/att_1003-capture.avif)

Captured by a tool this build has never heard of.
<!-- /longclaw:attachment -->

## Activity

<!-- longclaw:event
id: evt_5f0c11a2
kind: update
occurred_at: 2026-07-30T08:05:00Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5502.checked
    from: false
    to: true
-->
### Claude Code updated this ticket

Copied the bytes in and registered them.
<!-- /longclaw:event -->
