---
format: longclaw.ticket/v1
id: 39f51e0f-bfd3-48f1-abed-fe7d3927c92b
key: LC-220
title: Implement Cmz+Z functionality
status: in_review
priority: urgent
created_at: 2026-08-12T06:50:37.442Z
updated_at: 2026-08-12T07:15:33.636Z
---

Right now the toast shows Cmd+Z at multiple places but it doesn’t really work in the app. Identify different actions where Cmd+Z is useful and then implement it.

## Activity

<!-- longclaw:event
id: evt_915f03ce
kind: create
occurred_at: 2026-08-12T06:50:37.442Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_15f2f913
kind: update
occurred_at: 2026-08-12T07:15:33.636Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

⌘Z now reaches every undo the app offers, and two edits that had no way back have one.

The key was not broken — the guard was too wide. `ToastStack` stood ⌘Z down for any focused field, on `keyboard-focus-map.md:13-15`'s carve-out that the OS owns it "inside a focused text field". Three of the app's own gestures end by putting focus in a control with no undo to defend, and all three raise a toast saying **Undo ⌘Z**:

- **Create more** clears the title and focuses it again (`QuickCreate.tsx:177`);
- removing a checklist row hands focus to the add-row (`TicketPanel.tsx:976`), the one control always there;
- ticking a row leaves focus on the box — and a checkbox is an `<input>`, so `states.md:62-63`'s **check**, the most-offered undo in the app, was the one that could never run.

`fieldUndo.ts` asks the field the honest question instead: is what is on screen still what the person typed? Never typed in since focus, or reset by the app since the last keystroke, means there is nothing to take back and the key is the app's. A field left is a field that loses its claim — these are drafts over a file, not documents.

Newly undoable: renaming the title, and saving over the description. Both replace prose the app cannot otherwise return, both are spent on a gesture that is not a decision to keep — a blur, a Save — and neither raised so much as a toast before.

Not undoable, and not from oversight: adding a checklist row is filed as LC-221, because the write receipt does not name the ids Rust minted and `removeChecklistItem` takes one id where an add is a batch. Comments have no removal at all — v0 never deletes.

Gates: `npm run check` clean and the frontend suite at 958→973 green. `a11y:audit` re-run because this is a key handler — A1–A5 all pass, including its own `⌘Z` row. `test:rust` has one failure, `an_item_can_be_reworded_and_removed_by_id`, which reproduces on a clean `main` and belongs to the CLI's missing `--edit-item` flag.

One thing deliberately left alone: `states.md:62` enumerates the toast set as "status, priority, archive/unarchive, create, check" and now under-counts by more than these two — LC-215's checklist toasts are already outside it. The line is cited by `citation-lock.json`, and rewording it is its own change.
<!-- /longclaw:event -->
