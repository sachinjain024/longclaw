---
format: longclaw.ticket/v1
id: eb76978b-29ae-4084-a412-8b15a5231309
key: LC-129
title: Project settings — A full-width red-text button; no explanatory copy and no confirm dialog observed
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.562Z
updated_at: 2026-08-07T03:46:55.725Z
---

**Prototype.** Remove from app: danger button + confirm dialog naming the path and repeating "Removing only forgets the project in LongClaw. Files on disk are never touched."

**App.** A full-width red-text button; **no explanatory copy** and no confirm dialog observed

## Source

`docs/cc_screens_diff.md` — **D-44**, § Project settings, severity P1.

## Checklist

- [x] Add the copy and the confirm dialog. This is the app's single most destructive-looking action and its guarantee is currently unstated. <!-- longclaw:item=ck_77b4095e -->

## Activity

<!-- longclaw:event
id: evt_ca65e649
kind: create
occurred_at: 2026-08-05T15:16:01.562Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_97d78d76
kind: update
occurred_at: 2026-08-07T03:46:55.725Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_77b4095e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7957deb8
kind: comment
occurred_at: 2026-08-07T03:47:15.032Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The guarantee now sits beside the button, and the button asks first.

The confirm itself is `RemoveProjectConfirm` — the component LC-144 built for the unreachable screen's copy of this same action, moved to `ConfirmDialog.tsx` so a component `App` renders can reach it without an import cycle. One component rather than one per surface: the same removal must not be stated in two different sets of words, and must not be confirmed on one screen and fired on the other.
<!-- /longclaw:event -->
