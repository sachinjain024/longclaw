---
format: longclaw.ticket/v1
id: 3061ef92-576f-47b4-bf6e-6ebeedb9ce9d
key: LC-62
title: Implement the LongClaw logo
status: done
priority: none
created_at: 2026-08-05T14:44:43.929Z
updated_at: 2026-08-11T14:04:01.676Z
---

## Activity

<!-- longclaw:event
id: evt_ee5c0d36
kind: create
occurred_at: 2026-08-05T14:44:43.929Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5d8d0c06
kind: update
occurred_at: 2026-08-05T15:14:39.753Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_906c5af5
kind: update
occurred_at: 2026-08-11T14:04:01.676Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
-->
### Claude Code updated this ticket

Done — the mark is implemented and on both surfaces it was drawn for.

`src/OwlMark.tsx` is variant A "talon", the Step 1 deliverable at `docs/design/foundations/assets/owl-mark.svg` (`decisions.md` D13). It renders at 22px in the side panel (`App.tsx:1492`) and 52px on welcome (`App.tsx:2322`), which is why it is a component taking a `size` rather than an imported asset — the size is the only thing that varies.

It is single-colour by construction: every path fills with `currentColor`, so the mark takes whatever ink the chrome around it is set in and needs no accent prop. The duotone pupil variant stays reserved for marketing and never appears in app chrome. It carries `role="img"` and an `aria-label` of "LongClaw".

Filed 2026-08-05 as a bare title; closing it as observed rather than as remembered.
<!-- /longclaw:event -->
