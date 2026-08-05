---
title: "Pilot response memo"
product: LongClaw
status: "closed by founder decision, without evidence"
milestone: "M4 — Pilot direction accepted (Step 10)"
---

# Pilot response memo

Step 10's job is to turn pilot evidence into backlog decisions. This memo is
where each piece of evidence is mapped to exactly one decision, so the revised
backlog can be traced back to something observed rather than something preferred.

**State: closed by founder decision, without evidence.** The Step 9 pilot did not
run. `sessions/` is empty and will stay empty. The evidence tables below are
therefore empty, and were never filled with plausible-sounding findings — that
remains the one thing this document must not do, decision or no decision.

## Direction decision, 2026-07-31 (superseded the same day)

M4 offered two ways to close: run the pilot, or record a founder decision to
proceed without it. **The founder first chose to run it, then reversed that and
chose to proceed without it.** Both are recorded, in order, because the first
decision's consequences were written into four documents and a reader needs to know
why they changed.

| # | Decision | Effect |
|---|---|---|
| 1 | **Run the pilot rather than proceed without it.** The pilot is not cancelled, not deferred past Step 11, not worked around. Wave 0 had just closed, making the pilot the critical path rather than one of two open tracks | Superseded by 2 on the same day, before any work followed from it |
| 2 | **Proceed without the pilot sessions.** The five recruited real-repository sessions will not happen. M4 closes on this decision rather than on evidence | **Operative.** Step 11 is unblocked |

**Reason: not recorded.** The decision was taken as a direction, without a stated
rationale, and one has not been invented here. This is the memo's own rule turned on
its author, so it is worth filling in: a future reader deciding whether to revisit
this will have the decision and its cost but not its argument.

### What this closes, and what it does not

It closes M4 and unblocks Step 11. It does not make the M4 gate's condition true.
[The plan](../mvp_plan_order.md) words that gate as *"target users have tried the
slice and the remaining backlog has been explicitly revised."* The second half
happened. **The first half did not, and now will not.** M4 is closed by decision
with half its gate unmet, which is a legitimate founder call and is not the same
thing as a gate being satisfied.

### What it costs

Stated plainly, because the point of a pre-registered memo is that the cost cannot
be renegotiated later:

- **Waves 1–3's order is now the plan of record, and it was never validated.** It
  came from dependency and from the plan's own acceptance criteria — the backlog
  calls it "the weakest claim in this document." It stops being a baseline awaiting
  evidence and becomes simply the order, unchanged and unchallenged.
- **The `Pilot` column in [the backlog](../backlog/v0-backlog.md) is now inert.**
  Its `re-rank` and `confirm` markings describe what evidence would have done. No
  evidence is coming, so `confirm` items ship on their current design by default —
  including V0-12's markdown editor and V0-13's attribution treatment, the two the
  column singled out as most wanting a look from a real user.
- **The release risk is accepted, not mitigated.** *The mid-v0 pilot never runs, and
  the MVP ships on internal preference* is the exact risk being taken. It is marked
  accepted in [the release risks](../release-risks.md) rather than quietly retired.
- **One acceptance criterion is now decided by taste.** The freshness-accent row in
  [§ Acceptance criteria to update](#acceptance-criteria-to-update) says in its own
  words to "decide from evidence, not taste." There will be no evidence. It is
  resolved by default — keep — and that is a judgement call, not a finding.
- **The first real user session is now a release, not a pilot.** Whatever the pilot
  would have caught is still there to be caught; the difference is who finds it and
  when.

### What survives

- **The decision rules above stay binding.** They are what stops the next
  reasonable-sounding request walking into the MVP, and nothing about skipping the
  pilot loosens the scope gate.
- **The empty tables stay empty.** No decision permits back-filling them.
- **The door stays open.** If sessions ever run — a friendly user, a demo that goes
  sideways — findings enter through the tables and rules below exactly as written,
  and they re-rank the waves then. Skipping the pilot is not a decision that
  evidence no longer counts.

Reversing *this* is a third decision, to record here with its reason and its date.

## Why the rules are written first

A decision rule chosen after seeing the evidence is a rule chosen to fit the
conclusion someone already had. Fixing them now means a finding cannot be argued
down to a lower severity because the fix is inconvenient, and a feature request
cannot be argued up because it is exciting.

These rules are binding on Step 10's output. Changing one is itself a decision to
record here, with its reason.

## Decision rules, pre-registered

| Finding category (Step 9 classification) | Obligation |
|---|---|
| **Core thesis failure** | Stop. Do not re-rank breadth. The founder decides between revising the thesis and revising the slice, and that decision is recorded here before any Wave 1 work resumes. |
| **Data-integrity blocker** | Enters Wave 0 of [the backlog](../backlog/v0-backlog.md) with an owner area, a must-pass verification, and a sanitized artifact. Release-blocking by default. No breadth work proceeds past it. |
| **Onboarding blocker** | Enters Wave 0 if seen at F2 or above, or at F1 with a plausible-path argument. Fixed before further pilot builds go out, because a session spent on it is a session lost. |
| **Agent-discovery blocker** | Enters Wave 0. The instruction contract is the product's interface to the agent; a discovery failure is a contract defect, not a participant error. Record whether a root bridge file was present, since that changes the fix. |
| **Missing MVP breadth** | Re-ranks *within* its wave. It does not create a new wave and does not jump Wave 0. If it is already in the backlog, its rank moves and the evidence is cited; if it is genuinely absent, it is added with a stated reason. |
| **Polish or efficiency** | Enters the backlog only with a user consequence attached. Otherwise it goes to the deferred register. Friction is not automatically MVP scope. |
| **Post-MVP request** | Deferred register. Promotion to the MVP requires a row in § Scope decisions below: the evidence, the founder's decision, a must-pass verification, and the acceptance criterion it changes. |
| **Rejected or inconsistent** | Deferred register with the reason. Recorded rather than dropped, so the same request does not have to be re-litigated from scratch next time. |

Two rules cut across all of the above:

- **A blocker without a must-pass verification is not resolved.** "Fixed" means a
  test or a scripted acceptance step fails if it regresses.
- **Vision changes are recorded separately.** A proposed change to the product's
  boundaries goes in § Vision register, never into the MVP backlog by way of a
  re-rank. Scope does not expand by implication.

## Evidence → decision

One row per finding. Cite the session by participant code, never by name.

| # | Evidence (session, what was observed) | Category | Severity / frequency | Decision | Backlog ID | Must-pass verification |
|---|---|---|---|---|---|---|
| 1 | Real session, 2026-07-30 (not a recruited pilot session): naming a project `30 July 4PM` produced a derived key `3J4`, which the backend refused only after the folder picker had been answered, reported as `internal`, leaving an empty `.longclaw/tickets/` in the chosen folder | Onboarding blocker | S1 / F1 | Fixed in Step 10 before ranking anything else. Grammar settled and documented, derivation corrected, both create forms merged into one validated component, refusal now typed and residue-free | [Resolved report](../plans/completed/project-key-derivation-bug.md) | `src/projectKey.test.ts`, `src/CreateProjectForm.test.tsx`, `src-tauri/tests/project_key_grammar.rs`, and the two refusal tests in `src-tauri/tests/storage_integration.rs` |
| 2 | | | | | | |

Row 1 is not pilot evidence and does not count toward the M4 exit gate. It is
recorded here because it is the one observed onboarding failure the re-plan had
in hand, and because the fix follows the rule above rather than a judgement call
made afterwards.

## Blockers and their owners

Every S0 or S1 finding, with the area accountable for it and the check that
proves it stayed fixed. **Permanently empty:** the pilot did not run, so no
outside-observed blocker was ever recorded. The Wave 0 table in the backlog carries
the equivalent list for risks found by reading the code, and all seven are closed.

| Blocker | Severity | Owner area | Must-pass verification | State |
|---|---|---|---|---|
| | | | | |

## Re-ranking record

What moved, and on what evidence. A rank change with no evidence row is a
preference, and belongs in the backlog's baseline rather than here.

| Item | From | To | Evidence row | Reason |
|---|---|---|---|---|
| | | | | |

## Scope decisions

The only door from the deferred register into the MVP. A request with no row here
is not in the MVP, regardless of how often it came up.

| Request | Evidence rows | Founder decision | Must-pass verification | Acceptance criterion changed |
|---|---|---|---|---|
| **A creation surface outside the app's window, so LongClaw can track LongClaw.** The deferred register's *CLI or JSON projection* (P11), and the workflow gap it leaves (P9) | None from a pilot — the pilot never ran. The evidence is our own workflow: [the CLI caveat](../backlog/v0-backlog.md#the-cli-caveat-recorded-rather-than-resolved) records that a defect found while building LongClaw goes into `docs/plans/` because an agent may not mint a ticket key, and that the backlog is a document rather than tickets for the same reason. The caveat names this decision as the founder's to make | **Accepted 2026-08-05.** Build the CLI, then import both backlogs. Post-MVP, so it changes no release gate — it is a tool the project uses on itself, not a v0 feature | Passed: `tests/cli.rs` — LongClaw allocates every key, an agent-authored write records `type: agent`, an undefined label is refused before a key is spent, a description round-trips, and a write built from bytes that moved is a conflict. `npm run verify` clean | None. This is the caveat's own "scope decision to record in the memo", not a change to what v0 must do |

## Acceptance criteria to update

Where pilot evidence shows an existing criterion was insufficient rather than
unmet. Proposed changes land in
[the acceptance index](../acceptance/README.md) once accepted.

| Existing criterion | Evidence gap | Proposed update | State |
|---|---|---|---|
| The round-trip scenario acknowledges a *human* file edit with the human accent, an addition beyond the approved prototype that the scenario itself flags for pilot review | Never observed, and now never will be. The scenario's own note asks whether the treatment reads as noise in real use | ~~Decide from evidence, not taste~~ — no evidence is coming. **Resolved as: keep**, by default rather than by finding. The branch in `src/freshness.ts` and its CSS variant stay | Closed by default, 2026-07-31 |

## Vision register

Proposed changes to the product's boundaries. Recorded, not actioned. A change
here needs founder approval as a vision revision, separately from any backlog
decision.

| Proposal | Raised by | What it would change | Status |
|---|---|---|---|
| | | | |

## How M4 closed

**M4 is closed as of 2026-07-31, by founder decision.** This section previously
listed what closing it would require. That route was not taken, so the requirements
are kept below, struck, as the record of what was given up:

1. ~~Step 9's exit artifacts: at least five completed real-repository sessions under
   [`sessions/`](sessions/), a ranked problem list, and an evidence summary.~~ Not
   done. Waived by decision 2.
2. ~~Every S0 and S1 finding in the blockers table with an owner and a must-pass
   verification, and every data-integrity blocker cleared.~~ Vacuously satisfied:
   there are no findings, because there were no sessions. **This is not the same as
   there being no blockers** — it means none were looked for from the outside.
3. ~~The re-ranking record and scope decisions filled from the evidence, and the
   backlog's Waves 1–3 revised accordingly.~~ Not done. The pre-pilot order stands
   as-is, which is the central cost recorded above.
4. **An explicit founder acceptance of the revised direction.** Done — this is that
   acceptance, and with the other three waived it is the *only* thing M4 closed on.

Wave 0 closed on 2026-07-31 as well: all seven items, plus the ten plans in
[`docs/plans/completed/`](../plans/completed/). That part is evidence-backed work and
is unaffected by any of the above — it was blocker work justified by the risk
register, not by the pilot.

Step 11 is unblocked. [The plan's](../mvp_plan_order.md) guardrail — *do not continue
executing the original breadth backlog after M3 until the pilot feedback in M4 has
been processed* — is satisfied in the narrow sense that M4 is closed, and not in the
sense the guardrail was written for.
