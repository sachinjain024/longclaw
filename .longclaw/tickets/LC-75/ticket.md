---
format: longclaw.ticket/v1
id: c36320af-96e3-4248-8c3b-2d1958e735a5
key: LC-75
title: App shell — waitlist "Get early access" → modal — Absent everywhere
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.733Z
updated_at: 2026-08-06T13:08:44.908Z
---

**Prototype.** Waitlist "Get early access" → modal

**App.** Absent everywhere

## Source

`docs/cc_screens_diff.md` — **D-0D**, § App shell, severity P3.

## Checklist

- [x] Product call, not a UI bug. Confirm it is intentionally cut from v0 and strike it from screen-specs.md:213-222, or build it. <!-- longclaw:item=ck_844a3938 -->

## Activity

<!-- longclaw:event
id: evt_2687ef61
kind: create
occurred_at: 2026-08-05T15:16:00.733Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9b0cd74d
kind: update
occurred_at: 2026-08-06T13:08:44.908Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_844a3938.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Closed as cut from v0. This confirms an existing decision rather than making a new one: Step 15 was parked by founder decision on 2026-08-01, taking V0-38 and V0-39 with it, and the step's own rule is to omit the feature from the binary rather than ship a form that fails silently. No submission endpoint was ever reviewed. A v0 binary that posted an email would also be the one network call in a product whose release gate (`audit:network`) exists to prove it makes none.

Recorded instead of built:

- `screen-specs.md` gains a `## Designed, but not in v0` table; § Waitlist is headed `NOT IN V0`, and the side-panel footer bullet marks the ghost button as absent.
- `cc_screens_diff.md` D-0D is struck as not-a-diff and the open `Product decisions, not bugs` question is answered in place.
- `styles.css` — the `.side-panel-footer` comment now says cut rather than parked, and says why the grid holds one row.
- `App.test.tsx` — the footer assertion tightens from `toContain` to `toBe`. Its old comment named this ticket as the reason to stay loose; with the call made, the exact footer text is worth pinning. A second test asserts no early-access control exists.

One tension worth recording. This ticket said to strike the waitlist from `screen-specs.md`, but `mvp_plan_order.md:640` says the prototype specs were left describing it *on purpose* when Step 15 was parked, because parking is not cancellation. Resolved by marking scope rather than deleting design: the section and its states/keyboard/data companions stay intact, headed by an explicit v0 scope statement. Deleting them would have destroyed the design that Step 15 says to build on unparking, and the flagging stops either way.

Line numbers in the original ticket had drifted — the waitlist is at `screen-specs.md:260-269`, not `213-222`, which is now the command palette.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_43a0367c
kind: comment
occurred_at: 2026-08-06T13:20:36.438Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Correction to the previous entry, appended rather than edited because activity is append-only.

Two claims in it are wrong as written.

First, it said the waitlist is at `screen-specs.md:260-269` and that the ticket's own `213-222` had drifted. The drift observation was right, but the entry then created the same fault it was diagnosing: the first pass inserted a table near the top of `screen-specs.md`, which pushed § Waitlist to 287 and stale-dated the correction on arrival. The rework is line-neutral — § Waitlist is still at **260**, exactly where the entry claimed, and no citation anywhere in the repo moved.

Second, it said `screen-specs.md` gained a `## Designed, but not in v0` table. The section that shipped is `## Cut from v0`, appended at the end of the file, with a `NOT IN V0` marker written into the § Waitlist heading line itself.

The substance of the decision is unchanged, as is the reasoning for marking scope rather than deleting the design.

Review also found the confirmation had been recorded in only one of three comparison documents. `docs/cd_ui_diffs.md` was the significant miss: beyond § 7, it carried a full `Step 7: Implement The Required Waitlist Flow` specifying an endpoint client module, a configured endpoint, and `longclaw.waitlistJoined` in `localStorage` — and a gate instructing `audit:network` to expect an explicit waitlist submit to contact a remote host. Left standing, that is a live instruction to put the first network call into a binary whose release gate exists to prove it makes none. It is now marked VOID, and the `audit:network` gate is restated as absolute rather than carving out a submit exception. `docs/cc_ui_diffs.md` D3 and B2 are likewise marked, and `components.md`'s footer bullet now says cut.
<!-- /longclaw:event -->
