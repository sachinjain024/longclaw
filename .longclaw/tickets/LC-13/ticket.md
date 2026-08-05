---
format: longclaw.ticket/v1
id: 71b72f02-cf02-46ab-886b-11a8926c52b5
key: LC-13
title: "Complete the merged timeline: human comments, agent comments, and change events with the approved attribution treatment"
status: done
priority: p1
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:22:56Z
updated_at: 2026-08-05T14:22:57Z
---

~~Complete the merged timeline: human comments, agent comments, and change events with the approved attribution treatment~~ **Done 2026-08-01** — `src/Timeline.tsx` reads `event.kind` at last; it never did, and every kind collapsed into one template that printed `status todo → in_progress` and `checklist.ck_7d2a.checked false → true` at a human. The decision moved out of JSX into `src/timelineEvents.ts` — `sortActivity`, `entryShape`, `unfamiliarKind`, `changeLines`, `describeChange` — which is what makes every kind and every field enumerable in a test without a DOM. **Two entry shapes:** a *message* (comment, and any kind this build does not know) gets the full per-voice anatomy and its body through `MarkdownView`; a *change* (create, update, external_change) gets `components.md:207`'s single glyph and one line, with the actor named once in its accent colour. `components.md:207` and `states.md:169` disagree about whether a change event carries an avatar; the reading taken is that `components.md` owns layout and `states.md` owns provenance, so a change entry is compact and keeps the rail and the `via file edit` meta. **An unknown kind renders as a message with `· recorded as “deployed”` in the meta** — the whole record on screen, and the app saying what it does not know, the same discipline as an undefined label slug. `external_change` with no actor leads with `⚠ file changed on disk — actor unknown`, a sentence that now lives once in `attribution.ts` because `freshness.ts` was already writing its own copy of it. Every field becomes a sentence with the app's own glyph — `StatusDot`, `PriorityGlyph`, `LabelDot` — and a field this build does not interpret keeps its raw path in a `wash` chip. The composer gained its avatar, an auto-growing field, and optimistic posting through `save()`'s existing `apply` seam. **The markdown subset gained ordered lists and block quotes**, closing the weakest point V0-12's row named — see the amendment on that row. [Plan 19](../../../docs/plans/completed/19-merged-timeline.md)

## Must-pass

Passed both clauses. **Every kind:** `Timeline.test.tsx` is organised by kind rather than by feature, with the unknown kind a case rather than an afterthought — ten of its fourteen claims confirmed failing first against the old 53-line component, the four that passed being the ones the single template happened to satisfy. **Every field:** `timelineEvents.test.ts` enumerates all nine `field` values `TicketDocument::apply` can write, plus both dotted checklist paths and the `description` change that carries neither `from` nor `to`, and asserts no sentence leaves a dotted path or a wire enum on screen. That enumeration is pinned across the language boundary: `ipc-contract.json` gained `appliedFieldChanges`, `core::ticket::tests::json_contract_applied_field_changes` asserts Rust's serialized output equals it, and the frontend reads the same array — so a field added to `apply` fails on both sides rather than reaching a human as a wire value. Confirmed red with one extra field in the fixture. **ADR 0001:** `must-pass: an agent is an actor and never an assignee` asserts the panel contains no `/assign/i` anywhere, that the meta grid is exactly Status/Priority/Labels/Updated with the agent in none of them, that the agent's name appears only inside `.timeline`, and that the composer avatar — actor identity, which the ADR permits — is still there. **Three things worth a look:** the `confirm` risk is not in the agent treatment, which is specified precisely, but in the **eleven change-event sentences**, which no spec dictates and no user has read — a ticket with a long history is mostly those lines, and they are one table to change; a change entry has no avatar, so a run of agent updates is a column of rails with a mono name repeated down the left, which is what the spec asks for and is the one place a screenshot would have settled it faster than an argument; and V0-12's `shows the whole document in the preview, rendered or not` had to be amended, because it asserted `> a block quote` was literal text and it is now a `<blockquote>`. **Amended 2026-08-01, on review.** Two of the three were closed. **The badge is back on change entries.** Dropping it was a consequence of the `components.md:207` / `states.md:169` reading, not a decision anyone took on its own merits, and it took the one channel that says *agent* in words off the entries where the product's central claim actually has to land — a run of agent status changes. The rail and the accent name are colour, which D11's CVD policy will not let carry a distinction alone, and a name is a name: `sachin` and `Claude Code` are both just strings until something states the role. It rides the first line inline, so `components.md:207`'s one line is still one line and there is still no 26px tile. The reasoning is recorded in `Timeline.tsx`'s module comment and in [plan 19's amendment](../../../docs/plans/completed/19-merged-timeline.md#amendment-2026-08-01--the-agent-badge-on-a-change-entry), which is where the review looked for it and did not find it. **And the provenance clause is now actually tested on the branches it exists for.** `via file edit` was asserted only for agent actors; `Timeline.tsx`'s rule is *not a human, or an `external_change` whoever wrote it*, and neither of the other two branches had a test. Both do now — the unattributed external change and a human's own out-of-app file edit — each confirmed red by mutation, since the behaviour was already correct: narrowing the rule to `actorType === "human"` fails the human case, and narrowing it to agents alone fails both

## Source

`docs/backlog/v0-backlog.md` — **V0-13**, Wave 1, step 11, owner Frontend.

## Checklist

- [x] Passed both clauses. Every kind: Timeline.test.tsx is organised by kind rather than by feature, with the unknown kind a case rather than an afterthought — ten of its fourteen claims confirmed failing first against the old 53-line component, the four that passed being the ones the single template… <!-- longclaw:item=ck_0e5e88aa -->

## Activity

<!-- longclaw:event
id: evt_973531aa
kind: create
occurred_at: 2026-08-05T14:22:56Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_69b3e3b8
kind: update
occurred_at: 2026-08-05T14:22:57Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0e5e88aa.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-13 is recorded there as passed.
<!-- /longclaw:event -->
