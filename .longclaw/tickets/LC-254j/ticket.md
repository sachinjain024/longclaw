---
format: longclaw.ticket/v1
id: 41342ac3-2fe7-47e9-8713-d928bfa2cd55
key: LC-254j
title: audit:network trusts its --phase label; gatekeeper-check verifies its own
status: todo
priority: p2
labels:
  - platform
type: chore
created_at: 2026-09-15T00:00:19.730Z
updated_at: 2026-09-15T00:00:42.544Z
---

`release:gatekeeper-check` refuses a `--phase` the machine contradicts. It checks
whether Apple is reachable and fails the run if the answer disagrees with the
label, and [the 2026-09-11 record](../../../docs/acceptance/signed-notarized-2026-09-11.md)
says why in as many words: an offline pass recorded on a connected machine is the
same defect as a quarantine check on an artefact that was never quarantined.

`audit:network` takes the same flag and **does not check**. `PHASE` is read
straight from the argument, written into the record, and printed in the header.
Nothing anywhere tests reachability. An `--phase=offline` run on a fully
connected machine produces a JSON record byte-identical in shape to a real one,
with the same controls green and the same zero findings.

That is worse here than it would be almost anywhere else, for three reasons:

- **The absence claim is the whole product.** This harness exists to support
  "nothing about your projects leaves your machine". Every other control in it —
  C1 through C5 — is built to stop an absence claim resting on a blind probe. The
  phase label is the one input to the same claim that nothing checks.
- **The failure is silent and permanent.** A record is a file someone reads a
  year later. There is no way to tell afterwards whether the network was off,
  and the record asserts it flatly.
- **The sibling harness already does it right**, so the asymmetry reads as a
  deliberate distinction when it is an omission. Someone comparing the two will
  reasonably conclude the check was judged unnecessary here.

The fix is small: the same reachability probe `gatekeeper-check` uses, run before
the session starts, refusing the run when the label and the machine disagree.
Offline it must not itself need the network to decide — `gatekeeper-check`
already solved that and the code can be shared rather than rewritten.

Found on 2026-09-15 while running the 0.1.0 release audit, which passed offline
with zero connections. That result is believed and recorded; the point is that
believing it is currently a decision about the operator rather than a reading of
the evidence.


## Checklist

- [ ] Reuse gatekeeper-check's reachability probe in network-audit.mjs <!-- longclaw:item=ck_e5346179 -->
- [ ] Refuse the run when --phase and the machine disagree, naming both <!-- longclaw:item=ck_b729156a -->
- [ ] Make the offline path decide without needing the network <!-- longclaw:item=ck_87ac8e2c -->
- [ ] Say in the record which way the check resolved, not just the label <!-- longclaw:item=ck_f169d769 -->
## Activity

<!-- longclaw:event
id: evt_2e4c8d39
kind: create
occurred_at: 2026-09-15T00:00:19.730Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_67e33c87
kind: update
occurred_at: 2026-09-15T00:00:42.457Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2c9a3b37
kind: update
occurred_at: 2026-09-15T00:00:42.478Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e5346179.added
    to: Reuse gatekeeper-check's reachability probe in network-audit.mjs
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_943e6d2b
kind: update
occurred_at: 2026-09-15T00:00:42.499Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b729156a.added
    to: Refuse the run when --phase and the machine disagree, naming both
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3ccdf8e2
kind: update
occurred_at: 2026-09-15T00:00:42.518Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_87ac8e2c.added
    to: Make the offline path decide without needing the network
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_140b7e2c
kind: update
occurred_at: 2026-09-15T00:00:42.544Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f169d769.added
    to: Say in the record which way the check resolved, not just the label
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
