---
title: "Pilot session notes template"
product: LongClaw
status: template
milestone: "M4 — Pilot direction accepted (Step 9)"
---

# Pilot session notes: <participant code>

## Session metadata

| Field | Value |
|---|---|
| Date | YYYY-MM-DD |
| Participant code | P00 |
| Moderator | |
| Observer | |
| Participant segment | Solo builder / small team / other |
| Agent tool and version | |
| Editor or terminal context | |
| macOS version | |
| LongClaw build | dev / packaged, commit, artifact name |
| Repository used | real repo; redacted name; language or stack |
| Raw notes location | private location, not committed |
| Recording permission | granted / declined / not requested |
| Recording storage | private location, not committed / none |

## Consent and redaction

- [ ] Participant consented to observation.
- [ ] Participant consented to recording, or recording was not used.
- [ ] Public notes use a participant code only.
- [ ] Private repo names, company names, recording links, raw logs, and
      unredacted file excerpts are not included in this file.
- [ ] Any committed ticket excerpts are sanitized and minimal.

## Preflight

- [ ] App launched without account or network setup.
- [ ] Pilot build warning was shown or explained.
- [ ] Participant had access to `examples/agent-context/`.
- [ ] Participant used a real repository and a real ticket-sized task.
- [ ] Root bridge file status recorded below.
- [ ] Agent round-trip acceptance scenario had passed before the session, or the
      exception was recorded.

## Agent discovery setup

| Field | Value |
|---|---|
| Root bridge file merged into repo | yes / no |
| Bridge file name | AGENTS.md / CLAUDE.md / other / none |
| Agent first looked inside `.longclaw/` unaided | yes / no / unclear |
| Discovery classification | unaided / bridged / moderator-assisted / failed |

## Task results

| Task | Result | Help needed | Evidence |
|---|---|---|---|
| First launch and folder selection | pass / fail / partial | | |
| Project and file-model comprehension | pass / fail / partial | | |
| Real ticket authoring | pass / fail / partial | | |
| Agent instruction discovery | pass / fail / partial | | |
| Agent file mutation | pass / fail / partial | | |
| Incoming-change recognition | pass / fail / partial | | |
| Human review after agent change | pass / fail / partial | | |
| Restart or recovery path | pass / fail / partial / not run | | |

## Timeline notes

Record timestamps or rough elapsed times. Prefer exact participant words when
they reveal comprehension, trust, or confusion.

| Time | Observation |
|---|---|
| 00:00 | |
| | |

## Agent prompt used

```text

```

## Agent output summary

- Did the agent read `.longclaw/AGENTS.md`?
- Did it read the intended `ticket.md`?
- What fields did it change?
- Did it append an agent-attributed activity record?
- Did it preserve fields it was not asked to change?

## Public file evidence

Link or paste short sanitized excerpts only. Keep full before/after files in
private storage if there was a failure.

| Artifact | Redacted public note |
|---|---|
| Ticket before agent write | |
| Ticket after agent write | |
| App screenshot | |
| Logs, if relevant | |

## Findings

Use the categories and S/F ranking from [the pilot protocol](README.md).

| Finding | Category | Severity | Evidence |
|---|---|---|---|
| | | | |

## Feature requests

| Request | Participant reason | MVP category |
|---|---|---|
| | | required / useful after MVP / Phase 2-3 / rejected |

## Debrief answers

- What did the participant think LongClaw stores, and where?
- What did they believe the agent changed?
- What did they trust or distrust?
- What felt like repeated manual work?
- Would they use this for their next real ticket? Why or why not?

## Moderator assessment

- Core round trip completed without developer intervention: yes / no.
- Participant trusted the result enough to continue: yes / no / unclear.
- Required follow-up before Step 10: none / clarify / rerun / fix blocker.
