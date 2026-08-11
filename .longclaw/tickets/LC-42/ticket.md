---
format: longclaw.ticket/v1
id: 3775996b-6934-49b0-81d4-538ef36f447b
key: LC-42
title: Decide the waitlist endpoint and privacy handling, or decide to omit the waitlist
status: done
priority: p4
labels:
  - release
  - v0-backlog
  - parked
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-11T14:03:32.380Z
---

**Parked 2026-08-01** — Decide the waitlist endpoint and privacy handling, or decide to omit the waitlist

## Why it exists

The plan's own instruction: if no reviewed endpoint exists, omit the feature from the binary rather than ship a form that silently fails. This is a decision, not an implementation. Parking is not that decision — it postpones it, and the MVP ships with no waitlist either way.

## Source

`docs/backlog/v0-backlog.md` — **V0-38**, Wave 4, step 15 (parked), owner Release (parked).

## Checklist

- [x] Not an MVP gate while parked. On unparking: a recorded decision naming the endpoint and the data collected, or a recorded decision to omit <!-- longclaw:item=ck_05351bc7 -->

## Activity

<!-- longclaw:event
id: evt_f60a5b4f
kind: create
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_98a521df
kind: update
occurred_at: 2026-08-11T14:03:32.380Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
  - field: checklist.ck_05351bc7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The decision this ticket asks for has been made and recorded.

The ask is "decide the endpoint and privacy handling, **or** decide to omit the waitlist", and omit is the answer on record. Step 15 was parked by founder decision on 2026-08-01, and LC-75 closed the waitlist as cut from v0 on 2026-08-06: no submission endpoint was ever reviewed, and a v0 binary that posted an email would be the one network call in a product whose release gate (`audit:network`) exists to prove it makes none.

The decision is written down in four places, which is what makes it a decision rather than a silence:

- `screen-specs.md` gained a `## Designed, but not in v0` table, with § Waitlist headed `NOT IN V0`.
- `cc_screens_diff.md` D-0D is struck as not-a-diff.
- `styles.css` `.side-panel-footer` says cut rather than parked, and why the grid holds one row.
- `App.test.tsx` asserts no early-access control exists, and its footer assertion tightened from `toContain` to `toBe`.

This ticket noted that parking is not that decision. Correct — and it is not what closed this. The scope call is.

Done rather than cancelled: the deliverable was a recorded decision, and there is one. Unparking at Step 15 would be deciding the opposite, and wants its own ticket against a reviewed endpoint. LC-43 and LC-58 are closed alongside this.
<!-- /longclaw:event -->
