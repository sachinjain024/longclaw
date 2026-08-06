---
format: longclaw.ticket/v1
id: 66ae5523-4f92-4543-982a-82d87dd9f4f3
key: LC-160
title: "LC-69 follow-ups: a settled ✓ that can expire unseen, and six nits on the disk-state line"
status: todo
priority: p2
labels:
  - frontend
  - design
  - v0-backlog
created_at: 2026-08-06T12:51:38.332Z
updated_at: 2026-08-06T12:51:38.332Z
---

Seven items the two-axis review of LC-69 surfaced and that the branch
deliberately left alone. LC-69 was scoped to the two headline findings — a
settled `✓` that came back from the dead on a *failed* write, and a label that
named `ticket.md` when every ticket in the project is stored under that name —
and both shipped on `feat/lc-69-idle-silent-disk-state`.

Item 1 is a real defect. Items 2-7 are nits, listed so they are not
rediscovered by the next review of this surface.

## Source

The `/code-review` passes over `feat/lc-69-idle-silent-disk-state`.

## Items

1. **The settled `✓` can expire unseen.** `WriteFeedback.tsx` checks
   `props.busy` before the settled branch, but the 5s stale clock runs
   underneath it. A write that lands during a `reconciling` or `reading`
   window is never drawn, and its mark can time out before the read finishes —
   so the one write the user is least sure about is the one that goes
   unreported. Either hold the clock while `busy` owns the line, or let a
   settle outrank a read the way a write in flight already does.

2. **The panel arms a timer for a mark it will never show.** `TicketPanel`
   passes `idle`, so a settle for another file is filtered out at render
   (`WriteFeedback.tsx`, the `settled === props.idle` guard) — but the stale
   effect arms its timeout regardless of whether the settle is this surface's.
   Harmless, and one condition away from not existing.

3. **The content header claims every settle, including `longclaw.yaml`.** That
   instance passes no `idle`, so a project-settings write puts
   `✓ longclaw.yaml` in the board header. Since the label now carries the key
   this is no longer *ambiguous* — but it is still a decision nobody made:
   should the project-level surface mark project-level writes, or only ticket
   ones?

4. **`busy?: "reading" | "reconciling"` is state, domain term, and display copy
   at once.** The prop is rendered verbatim, so renaming the state renames the
   UI text, and three lines of doc comment stand in for the type.

5. **`App.tsx` maps two booleans through a ternary cascade** (`reconciling ?
   … : loading ? … : undefined`) into that prop, feeding a component that then
   re-tests them.

6. **`.content-header > .disk-path`** is the only child combinator in ~2000
   lines of `styles.css`. Its neighbours (`.panel-header .disk-path`,
   `.content-header .toolbar-actions`) are descendant selectors, and `>` buys
   nothing here.

7. **The disk-state vocabulary is not in `CONTEXT.md`.** `reading`,
   `reconciling` and the settled mark are now user-visible words with no
   glossary entry, and `docs/agents/domain.md:24-26` asks for the project's
   vocabulary or a note of its absence.

## Notes

Two divergences from the design source, recorded here so a later review reads
them as decisions rather than rediscovering them as defects:

- **The settled `✓` stands down after 5s.** The prototype's `diskState` is
  sticky until the next write, and nothing in `screen-specs.md` or `states.md`
  expires it. LC-69 chose expiry because a mark that never goes is the
  `● watching` chip under another name, and `states.md:180` has the panel show
  it *briefly*.
- **Both surfaces name a file `tickets/<KEY>/ticket.md`** — the prototype's own
  label (`prototype.js:345`) — rather than the store's `.longclaw/`-prefixed
  relative path, in all three states of the line including idle. The panel
  header's idle line therefore lost its `.longclaw/` prefix, which
  `states.md:178` calls "the panel header's file path". One element that
  changes state should not change spelling as it does.

## Checklist

- [ ] Stop the settled ✓ expiring behind a reading/reconciling line <!-- longclaw:item=ck_f95b0d9c -->
- [ ] Do not arm the panel's stale timer for a settle it filters out <!-- longclaw:item=ck_8a0153f6 -->
- [ ] Decide whether the content header should mark longclaw.yaml writes <!-- longclaw:item=ck_43c33690 -->
- [ ] Split WriteIndicator's busy prop from the copy it renders <!-- longclaw:item=ck_789d71e4 -->
- [ ] Drop the ternary cascade feeding busy in App.tsx <!-- longclaw:item=ck_56b29777 -->
- [ ] Make .content-header > .disk-path a descendant selector like its neighbours <!-- longclaw:item=ck_3543777b -->
- [ ] Add the disk-state vocabulary to CONTEXT.md, or note its absence <!-- longclaw:item=ck_e8243380 -->

## Activity

<!-- longclaw:event
id: evt_8f2ec9b0
kind: create
occurred_at: 2026-08-06T12:51:38.332Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
