---
format: longclaw.ticket/v1
id: 80ca9e70-a7ac-49d2-a021-787c1449f7dc
key: LC-80
title: Welcome / first launch — the subtitle explains the mechanism where the prototype explains the value
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.810Z
updated_at: 2026-08-07T06:27:19.367Z
---

**Prototype.** Subtitle: "Tickets live as plain files in a folder you choose — ideally inside your repo. Humans plan, agents execute, and both write to the same record."

**App.** "LongClaw writes project data into `.longclaw/` inside the folder you choose. Every ticket is a file you can read, edit, and commit."

## Source

`docs/cc_screens_diff.md` — **D-14**, § Welcome / first launch, severity P3.

## Checklist

- [x] Copy call. The app's version explains the mechanism; the prototype's explains the value. Pick one deliberately — currently it reads as a placeholder. <!-- longclaw:item=ck_c1041263 -->

## Activity

<!-- longclaw:event
id: evt_dfa026f1
kind: create
occurred_at: 2026-08-05T15:16:00.810Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f1d25fa9
kind: update
occurred_at: 2026-08-07T06:27:19.367Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_c1041263.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Picked the prototype's value copy, and it stopped being a coin toss once LC-77 landed: the create form now names the folder and the /.longclaw inside it, in the path the user just picked, so the mechanism is stated where it is concrete rather than as a subtitle over an empty screen. That leaves the subtitle free for the one thing nothing else on the screen says — what the files are for. It still names the folder-on-disk model, which is what screen-specs.md:90-91 asks a subtitle here to do.
<!-- /longclaw:event -->
