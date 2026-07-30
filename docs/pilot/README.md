---
title: "Mid-v0 pilot protocol"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted (Step 9)"
---

# Mid-v0 pilot protocol

Step 9 tests whether the Step 8 vertical slice solves the planning/execution
split for real agent users. It is not a feature-discovery interview and it is
not a sales demo. The session should show whether a user can create a local
project, author a ticket, let an external agent mutate the file, recognize the
incoming change, and keep trusting the data.

Use this protocol for every mid-v0 pilot session, then feed the findings into
Step 10 before any broad MVP surface work continues.

## Inputs

- A build produced with [the pilot build guide](../acceptance/pilot-build.md).
- A passing run of [the agent round-trip scenario](../acceptance/agent-round-trip.md)
  on the pilot machine or an equivalent machine.
- The participant's real repository with a real ticket-sized task they would
  plausibly hand to Claude Code, Codex, Cursor, or a similar coding agent.
- The agent context in [`examples/agent-context/`](../../examples/agent-context/).
- One copy of [the session notes template](session-notes-template.md).

## Consent and privacy

This is a public MPL-2.0 repository, so raw pilot data does not belong here.

Before the session starts, ask for explicit permission to observe and, if
applicable, record the session. Use participant codes such as `P01`; do not put
participant names, company names, private repository names, recording URLs, raw
logs, or unredacted ticket/file excerpts in this repo.

Store raw notes, recordings, private repository names, and full before/after
files outside the public repository. Commit only redacted summaries and
sanitized excerpts that are necessary to support a finding.

## Recruit

Recruit 5 to 8 active agent users. Prefer people who already use an agent on
real code at least weekly.

The set should include:

- at least two solo builders;
- at least two people who work in a small team or shared repository;
- at least two Claude Code users;
- at least one Codex user if available;
- at least one Cursor user if available;
- at least one person who is not already familiar with the LongClaw file model.

Do not reject a participant because they are missing one of the preferred tools.
Record the tool they actually use; agent fit is part of the evidence.
Do not count a sample repository run toward the Step 9 exit gate. A sample repo
can debug the build or the script, but it cannot prove the core workflow.

M4 requires at least 5 completed real-repository sessions. Continue toward 8
sessions when the first 5 do not cover both solo-builder and small-team users,
or when evidence is split enough that Step 10 would be guessing.

## Session shape

Plan for 45 minutes.

1. Setup, 5 minutes: hand over the build, unsigned-build note, and agent context.
2. First launch and project setup, 7 minutes: observe without correcting unless
   they are blocked.
3. Ticket authoring, 8 minutes: ask them to make one real ticket for the repo.
4. Agent round trip, 12 minutes: have their agent discover and mutate the
   ticket using the context files.
5. Review and recovery, 8 minutes: ask them what changed, what they trust, and
   what they would do next. Trigger one wrong or confusing path only if it
   occurs naturally or the session has time.
6. Debrief, 5 minutes: ask for missing context, repeated work, data-loss fears,
   and whether they would use this for the next ticket.

The moderator should observe first and explain second. If the participant gets
stuck, record the exact point, the language they used, and the smallest hint
needed to continue.

## Observe

Capture evidence for these specific behaviors:

- **Folder/project setup:** Does the participant know where data will live? Do
  they hesitate to choose a real repository?
- **File-model comprehension:** Can they explain what `.longclaw/` is after
  seeing it once?
- **Ticket authoring:** Can they create a useful real ticket without needing
  missing fields from later MVP steps?
- **Agent discovery:** Does the agent find `.longclaw/AGENTS.md` and the target
  ticket without the moderator teaching the format? Record whether the
  repository had a root-level bridge file such as `AGENTS.md` or `CLAUDE.md`
  pointing at `.longclaw/`.
- **Agent mutation:** Does the agent safely update status, description,
  checklist, and activity without damaging unrelated fields?
- **Incoming-change recognition:** Does the participant notice the external
  update and understand who or what made it?
- **Trust:** Does the participant believe the app preserved their work and the
  agent's work?
- **Recovery:** When something goes wrong, can they identify the problem and the
  next action without developer intervention?

## Intervention rules

- Let confusion run long enough to identify the cause, but do not waste the
  session once the cause is clear.
- Use the smallest possible hint and record it verbatim.
- Do not explain the file format before the agent attempts discovery.
- Do not fix ticket files by hand unless the session is already marked failed.
- Do not describe future features as available. Log requests for later ranking.

## Classify findings

After each session, classify every finding into exactly one category:

- **Core thesis failure:** The planning/execution split, file round trip, or
  trust model does not work for the participant.
- **Data-integrity blocker:** The participant or agent could lose, overwrite,
  corrupt, or misattribute work.
- **Onboarding blocker:** The participant cannot reach the first useful ticket
  without help.
- **Agent-discovery blocker:** The agent cannot find or follow the local
  instructions without format coaching.
- **Missing MVP breadth:** The participant needs a Step 11-15 feature to use the
  product seriously, but the vertical slice remains trusted.
- **Polish or efficiency:** The product works, but the flow has avoidable
  friction.
- **Post-MVP request:** Useful but outside the MVP guardrails.
- **Rejected or inconsistent:** Conflicts with the local-first MVP vision or
  scope guardrails.

## Severity and frequency

Rank problems with the following severity scale:

| Severity | Meaning                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| S0       | Data loss, corruption, silent overwrite, or a trusted false state. Blocks the pilot.         |
| S1       | User cannot complete the core round trip without moderator or developer intervention.        |
| S2       | Core round trip completes, but trust or comprehension is weak enough to threaten repeat use. |
| S3       | Meaningful workflow friction or missing MVP breadth.                                         |
| S4       | Polish, copy, speed, or preference issue.                                                    |

Track frequency as:

| Frequency | Meaning                                              |
| --------- | ---------------------------------------------------- |
| F1        | One participant.                                     |
| F2        | Two participants.                                    |
| F3        | Three or more participants.                          |
| F4        | Most participants or every participant in a segment. |

The ranked problem list should sort by severity first, then frequency, then
confidence in the evidence.

## Exit gate

Step 9 is complete when the repo contains:

- redacted session notes for at least 5 completed real-repository sessions under
  [`sessions/`](sessions/), indexed by participant code;
- a ranked problem list using [the problem list template](problem-list-template.md);
- an evidence summary using [the evidence summary template](evidence-summary-template.md);
- sanitized examples for any failed agent mutation or data-integrity concern;
- a clear recommendation for Step 10: proceed, fix blockers first, rerun part of
  the pilot, or reject the current vertical-slice direction.

Do not close M4 until Step 10 maps this evidence to backlog decisions and
acceptance-test updates. That mapping is
[the pilot response memo](response-memo.md), whose decision rules are already
fixed: a finding's category determines what it obliges us to do, so the rule
cannot be chosen after the evidence is in.
