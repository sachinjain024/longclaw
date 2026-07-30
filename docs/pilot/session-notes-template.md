---
title: "Pilot session notes template"
product: LongClaw
status: template
milestone: "M4 - Pilot direction accepted (Step 9)"
---

# Pilot session notes: <participant or code>

## Session Metadata

| Field                      | Value                                 |
| -------------------------- | ------------------------------------- |
| Date                       | YYYY-MM-DD                            |
| Moderator                  |                                       |
| Observer                   |                                       |
| Participant segment        | Solo builder / small team / other     |
| Agent tool and version     |                                       |
| Editor or terminal context |                                       |
| macOS version              |                                       |
| LongClaw build             | dev / packaged, commit, artifact name |
| Repository used            | real repo, language or stack          |
| Recording or artifact link |                                       |

## Preflight

- [ ] App launched without account or network setup.
- [ ] Pilot build warning was shown or explained.
- [ ] Participant had access to `examples/agent-context/`.
- [ ] Participant used a real repository and a real ticket-sized task.
- [ ] Agent round-trip acceptance scenario had passed before the session, or the
      exception was recorded.

## Task Results

| Task                                 | Result                          | Help needed | Evidence |
| ------------------------------------ | ------------------------------- | ----------- | -------- |
| First launch and folder selection    | pass / fail / partial           |             |          |
| Project and file-model comprehension | pass / fail / partial           |             |          |
| Real ticket authoring                | pass / fail / partial           |             |          |
| Agent instruction discovery          | pass / fail / partial           |             |          |
| Agent file mutation                  | pass / fail / partial           |             |          |
| Incoming-change recognition          | pass / fail / partial           |             |          |
| Human review after agent change      | pass / fail / partial           |             |          |
| Restart or recovery path             | pass / fail / partial / not run |             |          |

## Timeline Notes

Record timestamps or rough elapsed times. Prefer exact participant words when
they reveal comprehension, trust, or confusion.

| Time  | Observation |
| ----- | ----------- |
| 00:00 |             |
|       |             |

## Agent Prompt Used

```text

```

## Agent Output Summary

- Did the agent read `.longclaw/AGENTS.md`?
- Did it read the intended `ticket.md`?
- What fields did it change?
- Did it append an agent-attributed activity record?
- Did it preserve fields it was not asked to change?

## File Evidence

Link or paste short excerpts only. Keep full before/after files as artifacts if
there was a failure.

| Artifact                    | Link or path |
| --------------------------- | ------------ |
| Ticket before agent write   |              |
| Ticket after agent write    |              |
| App screenshot or recording |              |
| Logs, if relevant           |              |

## Findings

Use the categories and S/F ranking from [the pilot protocol](README.md).

| Finding | Category | Severity | Evidence |
| ------- | -------- | -------- | -------- |
|         |          |          |          |

## Feature Requests

| Request | Participant reason | MVP category                                       |
| ------- | ------------------ | -------------------------------------------------- |
|         |                    | required / useful after MVP / Phase 2-3 / rejected |

## Debrief Answers

- What did the participant think LongClaw stores, and where?
- What did they believe the agent changed?
- What did they trust or distrust?
- What felt like repeated manual work?
- Would they use this for their next real ticket? Why or why not?

## Moderator Assessment

- Core round trip completed without developer intervention: yes / no.
- Participant trusted the result enough to continue: yes / no / unclear.
- Required follow-up before Step 10: none / clarify / rerun / fix blocker.
