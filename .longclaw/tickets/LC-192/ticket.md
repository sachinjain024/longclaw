---
format: longclaw.ticket/v1
id: 0881d8ce-05f3-411c-b979-3736715ad48c
key: LC-192
title: A held ⌥↑/⌥↓ loses every press but the first
status: todo
priority: none
labels:
  - frontend
created_at: 2026-08-10T08:12:47.770Z
updated_at: 2026-08-10T08:12:47.770Z
---

Reordering a checklist by keyboard drops any press made while the previous write is still out: `save` refuses to start a write against a hash another is using (`TicketPanel.tsx`), so a held key moves the row one place and no further. Nothing is corrupted — `TicketPanel.test.tsx` pins the quiet drop, one write out and the list settling on what the file holds — but moving a row three places means three deliberate presses with a pause in each gap, and a human holding the key has no way to know the rest went nowhere.

The same limit is on every optimistic write the panel makes (a run of quick ticks loses ticks too), which is why this is a ticket rather than a fix inside LC-185: the answer is a write queue for the panel, or a move that accumulates optimistically and writes once when the key comes up, and both are decisions about the panel's write model rather than about reordering.

Found by the spec review of LC-185.

## Activity

<!-- longclaw:event
id: evt_10e2753e
kind: create
occurred_at: 2026-08-10T08:12:47.770Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
