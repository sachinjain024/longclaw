---
title: "Pilot response memo"
product: LongClaw
status: awaiting evidence
milestone: "M4 — Pilot direction accepted (Step 10)"
---

# Pilot response memo

Step 10's job is to turn pilot evidence into backlog decisions. This memo is
where each piece of evidence is mapped to exactly one decision, so the revised
backlog can be traced back to something observed rather than something preferred.

**State: awaiting evidence.** The Step 9 pilot has not run. No session notes
exist under [`sessions/`](sessions/), so the evidence tables below are empty and
have not been filled with plausible-sounding findings. What is written now is the
part that is better decided *before* seeing evidence: the rules for what each
kind of finding obliges us to do.

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
| 1 | Real session, 2026-07-30 (not a recruited pilot session): naming a project `30 July 4PM` produced a derived key `3J4`, which the backend refused only after the folder picker had been answered, reported as `internal`, leaving an empty `.longclaw/tickets/` in the chosen folder | Onboarding blocker | S1 / F1 | Fixed in Step 10 before ranking anything else. Grammar settled and documented, derivation corrected, both create forms merged into one validated component, refusal now typed and residue-free | [Resolved report](../plans/resolved/project-key-derivation-bug.md) | `src/projectKey.test.ts`, `src/CreateProjectForm.test.tsx`, `src-tauri/tests/project_key_grammar.rs`, and the two refusal tests in `src-tauri/tests/storage_integration.rs` |
| 2 | | | | | | |

Row 1 is not pilot evidence and does not count toward the M4 exit gate. It is
recorded here because it is the one observed onboarding failure the re-plan had
in hand, and because the fix follows the rule above rather than a judgement call
made afterwards.

## Blockers and their owners

Every S0 or S1 finding, with the area accountable for it and the check that
proves it stayed fixed. Empty until the pilot runs; the Wave 0 table in the
backlog carries the equivalent list for risks already recorded in code.

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
| | | | | |

## Acceptance criteria to update

Where pilot evidence shows an existing criterion was insufficient rather than
unmet. Proposed changes land in
[the acceptance index](../acceptance/README.md) once accepted.

| Existing criterion | Evidence gap | Proposed update | State |
|---|---|---|---|
| The round-trip scenario acknowledges a *human* file edit with the human accent, an addition beyond the approved prototype that the scenario itself flags for pilot review | Not yet observed. The scenario's own note asks whether the treatment reads as noise in real use | Keep, or remove the one branch in `src/freshness.ts` and its CSS variant. Decide from evidence, not taste | Awaiting evidence |

## Vision register

Proposed changes to the product's boundaries. Recorded, not actioned. A change
here needs founder approval as a vision revision, separately from any backlog
decision.

| Proposal | Raised by | What it would change | Status |
|---|---|---|---|
| | | | |

## What closing M4 requires

M4 is not closed. It needs, in order:

1. Step 9's exit artifacts: at least five completed real-repository sessions under
   [`sessions/`](sessions/), a ranked problem list, and an evidence summary.
2. Every S0 and S1 finding in the blockers table with an owner and a must-pass
   verification, and every data-integrity blocker cleared.
3. The re-ranking record and scope decisions filled from the evidence, and the
   backlog's Waves 1–3 revised accordingly.
4. An explicit founder acceptance of the revised direction.

Wave 0 of the backlog may proceed before any of this. It is blocker work, which
Step 10 puts first by definition, and it does not depend on what the pilot finds.
