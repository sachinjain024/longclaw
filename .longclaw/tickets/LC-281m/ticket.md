---
format: longclaw.ticket/v1
id: 666a0d75-5b85-4aca-9dd5-1a181bfa7c73
key: LC-281m
title: "Attachments: create, refusal and reference gaps after LC-206"
status: todo
priority: none
labels:
  - frontend
  - ready-for-agent
created_at: 2026-10-22T13:59:26.447Z
updated_at: 2026-10-22T13:59:26.447Z
---

Follow-up to LC-206. These are gaps the review of PR #76 found and moved out of LC-206 on 2026-10-22. None of them breaks attaching. Each is a place where the feature does less than the spec says, or where an edge case lands badly.

## Create with held files

- [ ] Held files are lost when quick create's **Open full editor →** carries the draft over. They should travel with the draft.
- [ ] Held files attached after Create land in References, but no link is added to the description. Insert the links, as an attach in the editor does (story 9).
- [ ] A held file refused after Create is reported in a toast, because no field is left to show the row under. The spec says an attach never uses a toast. Show it in the opened panel instead.
- [ ] Full create opens the panel only after every held file is attached, and nothing on screen says so meanwhile. Show progress, or open the panel first and attach into it.

## Attach and refusals

- [ ] **Attach a file…** from the References **Add** menu has no field to show a refusal under, so its refusals are toasts without the `refuse.*` hint line. Show them as rows in the section instead.
- [ ] The read after an attach keeps drafts and counts as the panel's own write, so an outside edit landing in that window is not raised as a conflict. Compare against the hash the attach returned.
- [ ] The drop label (`attach.drop.label`, *inside the field* in the deck) sits under the field rather than over it (Grok, PR #76). Make it an overlay in the description editor, the composer and quick create, and check each one visually. The composer is one line tall.

## References

- [ ] A reference to a symlink is stored by its target, because the path is canonicalized. It can then read as *outside project* and doesn't keep the name the human chose. Store the path as given, and resolve it only when checking it.

## Activity

<!-- longclaw:event
id: evt_d9380589
kind: create
occurred_at: 2026-10-22T13:59:26.447Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
