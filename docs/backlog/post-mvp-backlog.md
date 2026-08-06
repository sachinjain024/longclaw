---
title: "Post-MVP backlog"
product: LongClaw
status: active
milestone: "After M6"
sources:
  - backlog/v0-backlog.md
  - acceptance/final-acceptance-2026-08-04.md
  - plans/completed/41-accessibility-audit.md
  - plans/completed/37-step-16a-ui-polish.md
  - release-risks.md
---

# Post-MVP backlog

Step 17's fourth deliverable: what to do after the local core ships, ranked.

**This is not the deferred register.**
[The v0 backlog's § Deferred register](v0-backlog.md#deferred-register) is a
*gate* — it says what may not enter the MVP without a recorded scope decision,
and it stays exactly as it is. This file is the queue on the other side of the
release: the work that is already known, already argued for somewhere, and now
has an order.

**Nothing here is a release gate.** Everything that blocks the release is in
[the acceptance record's § Known issues](../acceptance/final-acceptance-2026-08-04.md#known-issues),
and this document deliberately does not repeat it — a backlog that also carries
release blockers is a backlog somebody will read as optional.

## How this is ranked

Three criteria, in this order:

1. **Does something we shipped make a promise we have not verified?** An unkept
   promise costs more than a missing feature, because a user has already relied
   on it.
2. **Is it a risk carried through the release rather than retired at it?**
   Things the project chose to accept still need an owner afterwards.
3. **What does it unlock?** Phase 2 and Phase 3 sequencing is the last input,
   not the first.

Enthusiasm is not on that list, which is the same rule the deferred register
runs on.

---

## Tier 1 — Promises made and not yet kept

Ship-adjacent. Each is something the product or its documentation already claims.

| # | Item | Why now | Owner | Done when |
|---|---|---|---|---|
| P1 | **Part B of the accessibility audit — VoiceOver semantics.** B1 accessible names, B2 the four trust states: active row, write status, conflict state, degraded-file state. [Plan 41](../plans/completed/41-accessibility-audit.md) | **Dated 2026-09-04 and owned already**, as the condition on deferring it. This is the highest product risk on the page: a screen-reader user who cannot perceive the trust states is not told their work is at risk, which is a different order of problem from an unlabelled button | Design | The eight rows of `release-candidate.md` § Accessibility report all carry a VoiceOver result. Anything that prevents keyboard completion is promoted to Part A |
| P2 | **A medium *real* project against the budgets.** Every size measured so far is generated: uniform titles, one label, no history | The gate has asked for this since Step 16b and it has never been met. A generated fixture proves the app survives the size, not that it survives what a project of that size looks like — long titles, many labels, deep histories, degraded files | Frontend | `perf:rust`, `perf:board`, `perf:list` and `perf:startup` run against a real project of ~500–2,000 tickets, and the numbers are recorded beside the generated ones |
| P3 | **V0-42 — an interaction-budget gate that works on a CI runner.** [The row](v0-backlog.md) has the full argument | Two must-pass budgets are backed by "somebody remembered to run it". A CI job was tried and correctly removed: a shared runner is ~6x slower and misses ≤50 ms p95 even at the 600-ticket floor, so it measured the machine | Frontend | A regression in board or list interaction cost is caught by something other than a human's memory, on an unmodified tree, repeatedly, saying what it measured and on what hardware |
| P4 | **Signing and notarization.** v0 ships unsigned with a documented Gatekeeper route | The release notes tell a user to click through a security warning. That is honest and it is not a resting place: every install after this one pays the same tax, and the instruction trains a habit worth not training | Release | A Developer ID identity and a notarization request are recorded, and the release notes' § Opening the app the first time is deleted rather than softened |
| P5 | **An in-app route to the documentation.** Carried as an open decision through two candidates | A user who installed the DMG has no route to the guide, because the app ships without a shell or URL-opening capability *by design* — the privacy boundary `release:audit` enforces. So this is a design question, not an oversight: ship the guide into new projects, render it in-app, or accept repository-only | Design | A recorded decision, and if it is either of the first two, the surface exists without loosening the capability set |
| P5a | **Restore the project that was open, on relaunch.** Startup takes the first *reachable* project in registry order (`src/App.tsx:573-575`); `activeProjectId` lives only in the in-memory store (`src/state.ts:16`) and the registry has no field to persist it in. Open p2, quit, relaunch, and p1 is selected | Found by the clean-machine pass on 2026-08-05 and reported there as a finding rather than a blocker: nothing is lost or corrupted, and the other project is one click away. It is listed here because the gate's restart row reads *"Last project state reloads from disk"*, and on a strict reading of "last project" that row is met only by the second half. Never regressed — it was never built, and no test restarts the app with two projects registered | Frontend | A relaunch selects the project that was open at quit, falling back to the current behaviour when the record is missing or that project is unreachable — with a test that registers two projects, opens the second, and restarts |

---

## Tier 2 — Risks carried through the release

Not defects. Things the project decided to accept, which still need somebody.

| # | Item | Why now | Owner |
|---|---|---|---|
| P6 | **The pilot that never ran.** [Step 9](../mvp_plan_order.md) was skipped on 2026-07-31 by founder decision; `docs/pilot/sessions/` is empty | This is the one risk in [the register](../release-risks.md) marked *accepted, not mitigated*. The MVP ships on internal preference, and the ordering of Steps 11–15 was never validated against a user. Post-release is the first honest moment to find out; the memo's rules still bind whatever it finds | Product |
| P7 | **The startup-probe race.** `LONGCLAW_EXIT_AFTER_FIRST_PROBE` can report a startup time for an empty board (`src/App.tsx:353`) | Diagnostics-only and accepted for v0, but it is a measurement affordance that is silently wrong some fraction of the time — the worst failure mode a measurement can have. `perf:startup` works around it by waiting for a probe with rows; the probe should not need working around | Platform |
| P8 | **Plan 37's deferred design discrepancies.** Settings is an inline panel rather than the specified centered modal and its Remove flow has no confirming dialog naming the path; the content header is two stacked rows rather than one 56px header; Welcome is two columns rather than a centered one; ~~the Phase 2 terminal region is unreserved~~ *(no longer a discrepancy — 2026-08-06, LC-74: the terminal is not shown in v0 at all, so an unreserved shell is the spec)*; spacing and border literals are unrouted | Each is a structural change to a surface rather than a visual pass, which is why plan 37 drew the line there. The settings modal is the one with a user-visible cost — a Remove flow with no confirmation naming the folder is a destructive-adjacent action without a guard | Design |
| ~~P9~~ | ~~**The repository cannot file its own tickets.**~~ **Done 2026-08-05** — it can. [ADR 0011](../adr/0011-cli-is-the-creation-surface-agents-use.md), [the decision](../pilot/response-memo.md#scope-decisions). Both backlogs are imported as `LC-1`…`LC-58`, and the first defect found *by* the import was filed through it rather than written into `docs/plans/` | Taken with P11, ahead of its tier, because they were one piece of work | Product |

---

## Tier 3 — Deferred register, in the order it would be taken

Unchanged in substance from [the register](v0-backlog.md#deferred-register); this
only sequences it. **Nothing here enters a release without the scope decision the
register requires.**

| # | Item | Decision on record | Why this position |
|---|---|---|---|
| P10 | Attachment upload, gallery, and preview UI | Useful after MVP (ADR 0005) | The on-disk format already ships, so this is additive rather than a migration — the cheapest large win available |
| ~~P11~~ | ~~CLI or JSON projection of the ticket store~~ **Done 2026-08-05** | ~~Useful after MVP~~ — promoted by [a recorded scope decision](../pilot/response-memo.md#scope-decisions), which is what the register requires | It did let LongClaw track LongClaw, and it moved with P9 as predicted. What shipped is the creation surface and a JSON projection of the records a command touches ([ADR 0011](../adr/0011-cli-is-the-creation-surface-agents-use.md)) — not the full read projection this row imagined, which stays unbuilt until something needs it |
| P12 | Comprehensive canonical conformance-fixture corpus | Post-MVP product v1 (Step 3) | The v0 contract is covered by focused real-file tests. The corpus matters when a *second* implementation exists, which is the point at which two implementations must agree |
| P13 | User-defined, renamable, recolorable statuses | Useful after MVP (ADR 0002) | The fixed set keeps the agent contract small, and the format needs no status registry to add them later. Wants evidence from P6 first |
| P14 | The sync waitlist (V0-38, V0-39) | **Parked**, not deferred, 2026-08-01 | Parking is not a scope decision against it. Unpark with Step 15, or earlier if measuring demand for the paid layer becomes urgent |

---

## Then the phases

Not backlog rows — the plan's own sequencing, restated so this file ends where
[the execution plan](../mvp_plan_order.md#post-mvp-handoff) does.

**Phase 2 — integrated execution.** An embedded xterm.js terminal over a real
Rust PTY, multiple tabs, terminal↔ticket linkage in app state only, and
launching agent work for a ticket with its context read from disk. v0 leaves the
typed streaming path for it and nothing else; the palette's disabled `PHASE 2`
row is the only place it is visible.

**Phase 3 — sync and teams.** Only after Phase 2. **Before any sync
implementation, resolve the parked "tickets in git vs `.gitignore` for real-time
sync" question** — it determines the collaboration architecture, and the user
guide currently recommends committing `.longclaw/`, which is an answer to half of
it already.
