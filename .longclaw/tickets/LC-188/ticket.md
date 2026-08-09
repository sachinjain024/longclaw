---
format: longclaw.ticket/v1
id: 13610936-d7c7-446f-9fe4-033eda2eea28
key: LC-188
title: Switching Project when Editor view is open leads to weird state
status: in_review
priority: urgent
labels:
  - frontend
created_at: 2026-08-09T01:03:22.252Z
updated_at: 2026-08-09T03:56:53.333Z
---

Lets say I am on Project 1, I open the editor to create a ticket and then I switch the project from side pane and then I click on Create, it creates the ticket in different project.

Same experience happens on project switching when editor is open.

<!-- Re-keyed from a local LC-184 that collided with the LC-184 filed on origin/main during LC-168. Same report, new key; the original was never pushed. -->

## Activity

<!-- longclaw:event
id: evt_b511aea7
kind: create
occurred_at: 2026-08-09T01:03:22.252Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_caa415b2
kind: update
occurred_at: 2026-08-09T03:56:32.375Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cf3aa4c7
kind: update
occurred_at: 2026-08-09T03:56:32.403Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: ""
    to: frontend
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8bf94e03
kind: comment
occurred_at: 2026-08-09T03:56:47.267Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Both halves of the report are one root: the create surfaces and the ticket panel outlive a project switch, and both then read the project that is active *now* rather than the one they were opened against.

**Create** now captures its project when the surface opens and compares it at submit. When they differ it raises a confirm naming both projects, the destination folder, and the key the ticket will take there; confirming writes into the project on screen, Cancel returns to the draft with nothing sent. The surface stays mounted behind the dialog, so cancelling costs nothing that was typed. Primary confirm rather than danger — the write is being aimed, not destroyed.

The key is the sharper half of this. The next key is a guess off the rows on screen, and a project switched to mid-draft has none until its snapshot lands, so the guess would be `KEY-1` — a key that project has usually already spent. `addProvisionalTicket` keys by key, so the optimistic card would have taken a real ticket's seat and the write's `removeTicket` would then have taken that ticket off the board. Same hazard as LC-140, answered the same way: the confirm cannot be pressed until the destination project has answered, and says why, and `writeNewTicket` refuses out loud rather than guessing. Rust's allocation was never at risk — `prepare_new_ticket_as` scans directory names under the creation lock and claims with `create_dir` — the collision was only ever in the board's copy.

The panel closes on a switch, because a key belongs to one project. On a switch only: relocate and rename both re-load the project they are already on.

`apps/desktop/src/App.tsx`, `ConfirmDialog.tsx` (an optional primary tone and a disabled confirm), `screen-specs.md`, and six cases in `App.test.tsx` — five of them red against the unfixed code. verify green; a11y:audit Part A green, since this adds a modal.

One thing left standing and worth knowing: while a project is still opening, the create surface itself still shows the guessed `KEY-1` on its context line. It self-corrects when the snapshot lands and no longer reaches a write, but the line is briefly wrong.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_394456ac
kind: update
occurred_at: 2026-08-09T03:56:53.333Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
