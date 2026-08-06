---
format: longclaw.ticket/v1
id: df6f7246-ced2-405a-9269-37674f9303b8
key: LC-69
title: App shell — A permanent ● watching chip (App.tsx:1237-1250), plus a WriteIndicator that only surfaces in the panel header
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.642Z
updated_at: 2026-08-06T11:49:03.653Z
---

**Prototype.** Disk-state indicator: `⟳ writing ticket.md…` while a write is in flight, `✓ ticket.md` when settled, `ink-disabled`

**App.** A permanent `● watching` chip (`App.tsx:1237-1250`), plus a `WriteIndicator` that only surfaces in the panel header

## Source

`docs/cc_screens_diff.md` — **D-07**, § App shell, severity P2.

## Checklist

- [x] Make disk-state idle-silent or ✓ ticket.md; reserve visible text for writing… / reconciling. The steady-state watching chip is dev telemetry, not designed chrome. <!-- longclaw:item=ck_785fe26a -->

## Activity

<!-- longclaw:event
id: evt_8e0108fe
kind: create
occurred_at: 2026-08-05T15:16:00.642Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1a1d0d67
kind: update
occurred_at: 2026-08-06T11:49:03.653Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_785fe26a.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The header now carries one disk-state line, beside the path chip and left of the spacer where `screen-specs.md:44-53` puts it, at mono 10px. It is silent when the disk is quiet: the permanent `● watching` chip is gone, along with its CSS. Visible text is `writing ticket.md…` (with the 500ms spinner rule unchanged), `✓ ticket.md` after a write lands, and `reconciling`.

Two things the plan did not name:

- `reading` stays on the line while a project load is in flight. The design answers a load with a board skeleton (`states.md:45-52`) that this build does not have, so removing the word would have left the load state with no surface at all. Filed as LC-159, which also drops `reading` once the skeleton lands.
- The settled `✓` now stands down after 5s, and both surfaces name the file rather than the project-relative path — which is how `screen-specs.md:51-52` and `states.md:180` write it, and what keeps the mark from becoming the `watching` chip under another name.

Covered by `WriteFeedback.test.tsx` (idle silence, the busy line, write-outranks-read, the mark's life) and `App.test.tsx` ("the header disk-state indicator (LC-69)"). `npm run verify` is green.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cd963912
kind: comment
occurred_at: 2026-08-06T12:51:54.256Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The two-axis review of this branch found two things worth fixing here, and both are now on it.

The settled ✓ keyed its freshness on `writing`, which also clears when a write **fails** — so a failed save re-raised the stood-down mark of an older write beside the danger toast reporting the failure. Freshness now keys on a `settledAt` counter the store bumps only when a write lands. `WriteFeedback.test.tsx` covers it, and the test was checked against the old code first: it reproduces.

The label named `ticket.md`, and every ticket in this project is stored as `ticket.md` — so the header could mark a write to one ticket while another sat open in the panel. It now says `tickets/LC-1/ticket.md`, the label the prototype's own disk state carries (`prototype.js:345`); the `.longclaw/` prefix they all share is what goes, not the key. The idle line uses the same spelling, so the element does not change how it names a file as it changes state. The header's cap moved 22ch → 32ch to hold it, and past that the ellipsis now costs the shared `ticket.md` rather than the key.

The remaining seven items are LC-160, which also records the 5s stand-down and the new label as decisions rather than leaving them to be rediscovered. `npm run verify` is green.
<!-- /longclaw:event -->
