---
format: longclaw.ticket/v1
id: 4f1fe43f-02da-42d0-bcd7-ddd11930190b
key: LC-206
title: Add Support for adding attachments
status: in_progress
priority: p1
labels:
  - ready-for-agent
due: 2026-10-16
created_at: 2026-08-11T14:38:36.097Z
updated_at: 2026-10-15T13:47:19.252Z
---

Users should be able to add attachments in description and comments: paste (⌘V), drop or pick a file in the description editor, the comment composer and the create panel; see images and videos inline and other files as chips; and list, open, remove and re-attach them from a References section in the panel, which also lists the docs written for the ticket. Agents get the same operations as `longclaw ticket attach` and `longclaw ticket reference`.

**Spec:** `docs/specs/LC-206-attachments.md`, recorded under References, covers the problem, user stories, implementation and testing decisions, and the test seams. It supersedes the "no attachment UI" half of ADR 0005.

**Prototype:** reviewed in four rounds and settled on 2026-10-15; the decisions and the copy deck are below. The prototype was deleted; its last version is `docs/ux/prototypes/LC-206-Attachments.html` at commit `26c6abc`.

Removal only unregisters; the bytes stay as a recoverable orphan. Permanent delete or trash is LC-276x.

## Review decisions

- **Attach control:** the seventh button in the formatting toolbar (paperclip, after a hairline), inside the group's roving tab stop. Same in the description editor, the composer and the full create panel.
- **Paste:** ⌘V of a copied file attaches it in the description, a comment or quick create; ⌘V of plain text still pastes text.
- **Dropping:** always attaches (a copy), into the description or a comment. The References section is not a drop target.
- **Feedback while attaching:** a row under the field says _Attaching {name} · {size}…_, then _Attached {name}_, which stays until the view next re-renders and never comes back. No toast for an attach. Refusals stay until dismissed. A multi-file drop lands the files that pass and announces one summary.
- **Cancel after attaching:** the file stays on the ticket (attaching is its own edit), listed in References and linked from nowhere.
- **Rendering:** an image spans the column in a padded frame and opens the in-app viewer from wherever it is (description or comment). A video never autoplays. A text file is a chip that opens in its default app. A link to a removed file reads _Removed_; to a missing file, _Unavailable_.
- **References section:** replaces "Attachments". Between Description and Checklist; collapsed by default (the heading toggles it and carries the count); opens by itself when a file lands. Files first, then docs. Five rows, then _View all_; broken rows count toward the five; a just-added row always shows. The empty state is shown.
- **Rows:** one ⋮ menu per row, always visible: View (images) or Open, Show in Finder, Remove (hint _File kept_); a not-attached row offers Re-attach. A file from a comment shows _Added in a comment_, which scrolls to and marks that comment; a file in an unposted comment has no such link.
- **Words:** _Remove_, not Delete (nothing is deleted). _Show in Finder_, not Open in Finder. _missing_ and _not attached_ for the broken states.
- **Remove:** no confirmation. A toast with Undo, and ⌘Z, restore the row where it was. Re-attach in the menu after that.
- **Doc references:** docs written for a ticket (spec, prototype) are recorded references, not links in the description. Agents add them with `longclaw ticket reference <KEY> <path>`; a human adds one with the section's **Add** menu (_Attach a file…_ / _Add a reference…_). A reference keeps the file's own name: no naming step, no Rename, no `--name`. A file outside the project is allowed, with an _outside project_ chip. A reference whose file moved reads _missing_.
- **Git:** no size warning and no mention of Git LFS; a project need not be a git repository.
- **CLI:** `ticket attach` always prints the link form.
- **Create:** quick create holds pasted files and attaches them after Create, with a tray (_Attached when the ticket is created:_).
- **Agents:** an agent's attachment wears the agent rail in References, with the existing acknowledgement and an attributed Activity entry.

## Copy deck

Settled 2026-10-15. Text is shown with its sample values filled in; `{name}`-style fields are filled at render. `existing` rows are shipped neighbours, listed for tone.

| Id | Kind | Where | Text | Status |
|---|---|---|---|---|
| `attach.button.aria` | aria-label | the paperclip button in the description editor's and the composer's toolbar | Attach files | new |
| `attach.button.title` | title | hover on the same button | Attach files - Paste or Drag & Drop into the field | new |
| `attach.picker.title` | file picker title | the macOS open panel the button raises (not drawn) | Attach to LC-312 | new |
| `attach.picker.prompt` | button (OS) | the open panel's confirm button (not drawn) | Attach | new |
| `attach.drop.label` | drop overlay | inside the field while files are dragged over it | Drop to attach to LC-312 | new |
| `attach.drop.hint` | note | under attach.drop.label | Images, text and video, up to 10 MB each | new |
| `attach.placeholder.image` | placeholder (in the Markdown) | at the caret while an image copies | ![Attaching {name}…]() | new |
| `attach.placeholder.file` | placeholder (in the Markdown) | at the caret while any other file copies | [Attaching {name}…]() | new |
| `attach.link.image` | inserted Markdown | replaces the placeholder when an image lands | ![{name}](./attachments/{file}) | new |
| `attach.link.file` | inserted Markdown | replaces the placeholder when any other file lands — and what the CLI prints | [{name}](./attachments/{file}) | new |
| `attach.status.pending` | write feedback (live region) | a row under the field while a file copies | Attaching {name} · {size}… | new |
| `attach.status.done` | write feedback (live region) | the same row, for a moment, when the file lands | Attached {name} | new |
| `attach.status.dismiss.aria` | aria-label | the ✕ on a refused row | Dismiss | new |
| `attach.status.summary` | live region | announced once when a multi-file drop settles | {ok} of {total} files attached. {refused} could not be. | new |
| `refuse.too_large` | refusal | a row under the field — and the CLI's error message | {name} is {size}. Attachments can be up to 10 MB. | new |
| `refuse.too_large.hint` | refusal hint | second line of the same row | Trim or compress it, or put it somewhere else and link to it. | new |
| `refuse.unsupported` | refusal | a row under the field — and the CLI's error message | {name} can’t be attached. Only images, text files and videos are supported. | new |
| `refuse.unsupported.hint` | refusal hint | second line of the same row | LongClaw checks what a file contains, not just its name. | new |
| `refuse.stale` | refusal | a row under the field when ticket.md changed between the copy and the registration | LC-312 changed on disk before {name} could be added. | new |
| `refuse.stale.hint` | refusal hint | second line of the same row | The file stays on disk. You can re-attach it from References later. | new |
| `render.image.aria` | aria-label | an inline image (the button around it) | {alt}, image. Open full size | new |
| `render.video.aria` | aria-label | an inline video player | {name}, video | new |
| `render.chip.meta` | chip meta | after a file chip's name | {type} · {size} | new |
| `render.chip.aria` | aria-label | a file chip | {name}, {type}, {size}. Opens in its default app | new |
| `render.chip.title` | title | hover on a file chip | Open in the default app | new |
| `render.removed` | chip text | a link to a file that was removed from the ticket but is still in attachments/ | Removed | new |
| `render.removed.aria` | aria-label | the same chip | {name}, removed from this ticket | new |
| `render.unavailable` | chip text | a link to an attachment whose file is missing | Unavailable | new |
| `render.unavailable.aria` | aria-label | the same chip | {name}, unavailable | new |
| `render.unavailable.title` | title | hover on a Removed or Unavailable chip | {name} — not attached to this ticket, or its file is missing | new |
| `viewer.open` | button | the viewer's header | Open | new |
| `viewer.reveal` | button / menu row | the viewer's header, and each References row's menu | Show in Finder | new |
| `viewer.close.aria` | aria-label | the viewer's ✕ (Esc also closes) | Close | new |
| `section.heading` | section heading (toggle) | ticket panel, between Description and Checklist | References | new |
| `section.add` | button (menu) | the section heading's right end | Add | new |
| `add.menu.attach` | menu row | the Add menu | Attach a file… | new |
| `add.menu.attach.hint` | menu hint | right of Attach a file… | Copied into the ticket | new |
| `add.menu.reference` | menu row | the Add menu | Add a reference… | new |
| `add.menu.reference.hint` | menu hint | right of Add a reference… | Linked where it is | new |
| `reference.picker.title` | file picker title | the macOS open panel Add a reference… raises (not drawn) | Add a reference to LC-312 | new |
| `reference.picker.prompt` | button (OS) | the open panel's confirm button (not drawn) | Add reference | new |
| `reference.outside` | state chip | a reference to a file outside the project folder | outside project | new |
| `reference.outside.title` | title | hover on that chip | This file is not in the project folder, so agents and other machines may not find it. | new |
| `reference.missing.meta` | row meta | under a reference whose file has moved or gone | File not found · {path} | new |
| `toast.referenced` | toast | after a reference is added | LC-312 referenced · {name} | new |
| `activity.referenced` | activity entry | the Activity tab | added a reference to {name} | new |
| `section.empty` | empty state | the section, expanded, when the ticket has none | Nothing here yet. Paste or drop a file into the description or a comment, or press Attach. Specs and other docs written for this ticket are listed here too. | new |
| `section.more` | button | under the fifth row, when there are more | View all {count} | new |
| `section.less` | button | the same place, expanded | Show fewer | new |
| `row.meta` | row meta | under each file's name | {type} · {size} · {who} · {age} | new |
| `row.source.comment` | link | beside a file's name, when it came in through a comment | Added in a comment | new |
| `row.source.comment.aria` | aria-label | the same link | Go to the comment that added {name} | new |
| `doc.meta` | row meta | under a reference's name | {dir} · {who} · {age} | new |
| `row.menu.aria` | aria-label | the ⋮ at a row's right end | Actions for {name} | new |
| `menu.view` | menu row | an image's menu | View | new |
| `menu.open` | menu row | a video's, text file's or doc's menu | Open | new |
| `row.remove` | menu row | a registered file's menu, last | Remove | new |
| `row.remove.hint` | menu hint | right of Remove | File kept | new |
| `state.missing` | state chip | a registered row whose file is gone | missing | new |
| `state.missing.meta` | row meta | under a missing file's name | File not found · {type} · {who} · {age} | new |
| `state.missing.title` | title | hover on a missing file's meta | Looked for attachments/{file} | new |
| `state.orphan` | state chip | a file in attachments/ that no record names | not attached | new |
| `state.orphan.meta` | row meta | under a not-attached file's name | Found in attachments/ · {type} · {size} | new |
| `state.removed.meta` | row meta | under a file removed in this session | Removed {age} — file kept · {type} · {size} | new |
| `row.reattach` | menu row | a not-attached file's menu | Re-attach | new |
| `toast.removed` | toast | after Remove | LC-312 removed · {name} | new |
| `toast.undo` | toast action | the remove toast | Undo | existing |
| `toast.reattached` | toast | after Re-attach | LC-312 re-attached · {name} | new |
| `activity.attached` | activity entry | the Activity tab | attached {name} | new |
| `activity.removed` | activity entry | the Activity tab | removed {name} | new |
| `activity.reattached` | activity entry | the Activity tab | re-attached {name} | new |
| `create.held` | note | quick create and the full create panel, under the description | Attached when the ticket is created: | new |
| `create.held.remove.aria` | aria-label | the ✕ on a held file | Don’t attach {name} | new |
| `cli.attach.usage` | CLI help | longclaw ticket attach, with no arguments | Usage: longclaw ticket attach <KEY> <FILE> [--name <NAME>] --agent-id <ID> [--agent-name <NAME>] | new |
| `cli.attach.markdown` | CLI output (JSON field) | the attach command's result, key markdown | [{name}](./attachments/{file}) | new |
| `cli.reference.usage` | CLI help | longclaw ticket reference, with no arguments | Usage: longclaw ticket reference <KEY> <PATH> --agent-id <ID> [--agent-name <NAME>] | new |
| `agents.guide.reference` | agent guide line | .longclaw/AGENTS.md, References | When you write a spec, a prototype or another doc for a ticket, record it with `longclaw ticket reference <KEY> <path> --agent-id <id>` instead of linking it in the description. | new |
| `agents.guide` | agent guide line | .longclaw/AGENTS.md, Attachments | Attach a file with `longclaw ticket attach <KEY> <file> --agent-id <id>`. It copies, checks and registers the file and prints the Markdown link to paste. Write an attachment record by hand only when the CLI is not installed. | new |
| `description.edit` | button | Description heading | Edit | existing |
| `editor.footer` | note | under the description editor | writes to ticket.md on save | existing |
| `composer.placeholder` | placeholder | the comment composer | Leave a comment… ⌘↵ to post | existing |
| `toast.checked` | toast | after ticking a checklist item | LC-312 checked · Reproduce in Manual order | existing |
| `conflict.title` | banner | the panel, when a draft's file changed on disk | ⚠ Changed on disk while you were editing | existing |
| `ack.agent` | banner | the panel, after an agent's change | ❯ updated by Claude Code · just now · via file edit | existing |
| `format.link` | aria-label | the toolbar button the paperclip sits beside | Link | existing |

## Checklist

- [x] 1 · Core: attach, remove and restore an attachment, and the reference record (add, remove, restore), with the ADR superseding 0005's UI half, the file_format.md changes (References section; git-size bullet removed) and format fixtures — no blockers <!-- longclaw:item=ck_b5b81061 -->
- [x] 2 · CLI: `longclaw ticket attach` as a thin wrapper over the core operation, plus the agent guide — after 1 <!-- longclaw:item=ck_a74fb95d -->
- [x] 3 · Serving: the attachment URI scheme and the CSP change, so the webview loads a ticket's own files and nothing else — after 1 <!-- longclaw:item=ck_2bf48f8c -->
- [x] 4 · Rendering: full-width images, videos that never autoplay, file chips, Removed/Unavailable chips and the in-app viewer, in the description and in comments — after 3 <!-- longclaw:item=ck_e0ee20a9 -->
- [x] 5 · References section: collapsed by default with a count, five rows then View all, a ⋮ menu with Show in Finder and Remove, ⌘Z undo, the (Added in comment) link and the agent rail — after 3 <!-- longclaw:item=ck_51e4f1af -->
- [x] 6 · Inserting: ⌘V paste, drop and the toolbar's Attach button in the description editor, comments and create (held files), with the transient Attaching/Attached rows and refusals that stay until dismissed — after 4 and 5 <!-- longclaw:item=ck_8cbc2320 -->
- [x] 7 · Doc references: `longclaw ticket reference`, the Add menu's reference row, and missing and outside-project rows in References — after 2 and 5 <!-- longclaw:item=ck_9a64aab2 -->
- [ ] Open item · decide the open-in-default-app extension allow-list (chips for .sh/.py/.rs/.html refuse Open; SVG/XML excluded): keep it as a review decision, add deck rows for the refusal, and reword render.chip.aria/title for files that won't open <!-- longclaw:item=ck_8c2b2bef -->
- [ ] Open item · viewer header meta ({type} · {size}) is copy outside the deck: add a viewer.meta row or drop it <!-- longclaw:item=ck_b136d98b -->
- [ ] Open item · test that an archived ticket's attachment links still render and serve (story 39) <!-- longclaw:item=ck_3c15004e -->
- [ ] Open item · exercise the URI scheme in a real webview: an image renders, a video seeks, and the viewer opens <!-- longclaw:item=ck_858c3bc0 -->
- [ ] Open item · run npm run audit:network on a built bundle, offline and online, before release (new URI scheme) <!-- longclaw:item=ck_6a95d5b1 -->
- [x] Open item · a doc reference row's Open and Show in Finder (deferred to slice 7, with the missing and outside-project rows); Open needs the same allow-list decision as file chips, since a prototype is .html <!-- longclaw:item=ck_fef87636 -->
- [ ] Open item · extend a11y:audit with rows for the References toggle, a row's ⋮ menu, and focus after Remove (the existing A1–A8 pass) <!-- longclaw:item=ck_b585edab -->
- [ ] Open item · deck has no toast for undoing a Remove: a file's undo reuses toast.reattached, a doc's falls back to '{KEY} restored' — confirm or add rows <!-- longclaw:item=ck_a135eea2 -->
- [ ] Open item · not-attached rows are listed after all files rather than 'where they fall' (a removed file's old position is only known to Undo) <!-- longclaw:item=ck_74e5808b -->
- [ ] Open item · the file picker's confirm button reads the system default, not 'Attach' (attach.picker.prompt): the dialog plugin cannot set it <!-- longclaw:item=ck_d5eae1c0 -->
- [ ] Open item · held files are lost when quick create's 'Open full editor →' carries the draft over <!-- longclaw:item=ck_52202cc1 -->
- [ ] Open item · held files attached after Create land in References but no link is added to the description <!-- longclaw:item=ck_34a39e99 -->
- [ ] Open item · a held file refused after Create is reported in a toast (no field is left to show the row under), against 'no toast for an attach' <!-- longclaw:item=ck_fcf8e3d5 -->
- [ ] Open item · full create opens the panel only after every held file is attached, with nothing on screen saying so meanwhile <!-- longclaw:item=ck_876e059e -->
- [ ] Open item · the read after an attach keeps drafts and is treated as the panel's own write, so an outside edit landing in that window is not raised as a conflict <!-- longclaw:item=ck_bcde4f1c -->
- [ ] Open item · extend a11y:audit with a row for the Attach button in the toolbar's roving group (existing A1–A8 pass) <!-- longclaw:item=ck_53819021 -->
- [ ] Question · should a doc reference open in its default app? A spec (.md) opens in an editor, but a prototype (.html) opens in Safari, which the file-chip allow-list refuses — decide one rule for chips and doc rows <!-- longclaw:item=ck_3a8834a1 -->
- [ ] Question · an older installed LongClaw rewrites .longclaw/AGENTS.md from its own template, dropping the attach and reference guidance this branch adds — should a build leave a generated contract newer than itself alone? <!-- longclaw:item=ck_e78aad3a -->
- [ ] Question · Undo of a Remove re-opens References and pins the restored row past the five, as any landing does — keep, or treat a restore as not news? <!-- longclaw:item=ck_5472f846 -->
- [ ] Question · 'Added in a comment' is inferred (the earliest comment linking the file, when the description does not) rather than recorded — is that enough, or should an attach record which comment it came in with? <!-- longclaw:item=ck_00b8c65e -->
- [ ] Open item · 'outside project' is decided in the panel from the shape of the stored path (absolute = outside); a hand-written absolute path inside the project would read as outside — Rust should report it, as it does missingReferences <!-- longclaw:item=ck_54a7f2da -->
- [ ] Open item · a reference to a symlink is stored by its target (the path is canonicalized), which can read as outside project and is not quite 'keeps the file's own name' <!-- longclaw:item=ck_f2d9dd25 -->
- [ ] Open item · 'Attach a file…' from the References Add menu has no field to show a refusal under, so refusals are toasts without the refuse.* hint line — against 'no toast for an attach' <!-- longclaw:item=ck_ba83957e -->
- [ ] Open item · the reference picker's confirm button reads the system default, not 'Add reference' (reference.picker.prompt) <!-- longclaw:item=ck_88e6c5a4 -->
- [ ] Open item · extend a11y:audit with a row for the References Add menu <!-- longclaw:item=ck_a411dde4 -->

## Ticket References

<!-- longclaw:reference
id: ref_0f773116
path: docs/specs/LC-206-attachments.md
added_at: 2026-10-15T13:44:46.576Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
[LC-206-attachments.md](../../../docs/specs/LC-206-attachments.md)
<!-- /longclaw:reference -->

## Activity

<!-- longclaw:event
id: evt_9f1043c2
kind: create
occurred_at: 2026-08-11T14:38:36.097Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c4fa6c27
kind: update
occurred_at: 2026-09-09T02:20:08.073Z
actor:
  type: human
  id: local
changes:
  - field: labels
    from: release
    to: ""
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_59b0ad98
kind: update
occurred_at: 2026-10-13T16:31:56.965Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_598d1e47
kind: update
occurred_at: 2026-10-13T16:42:49.619Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: ""
    to: ready-for-agent
  - field: description
-->
### Claude Code updated this ticket

Wrote the spec to docs/specs/LC-206-attachments.md and linked it from the description. Filed LC-276x for permanently deleting or trashing removed attachments. Labelled ready-for-agent.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8ecdde88
kind: update
occurred_at: 2026-10-13T16:47:17.454Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p2
    to: p1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_02b43692
kind: update
occurred_at: 2026-10-13T16:47:27.625Z
actor:
  type: human
  id: local
changes:
  - field: due
    to: 2026-10-16
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b98fffe1
kind: update
occurred_at: 2026-10-14T12:46:39.388Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

UX prototype for review: docs/ux/prototypes/LC-206-Attachments.html. Ten scenes (in place, attach in the description, attach in a comment, rendering, the section in every state, remove/undo/re-attach, refusals, agent via CLI, while creating, and three placements for the Attach control) plus a 67-row copy deck. The asks that matter most: where the Attach control goes (scene J), whether Cancel after attaching should offer to remove the file (B), the words missing / not attached / unavailable (D, E), and hold-then-attach in the create surfaces (I).
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_723405c8
kind: comment
occurred_at: 2026-10-15T08:01:43.983Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype review 1 (2026-10-15) applied to docs/ux/prototypes/LC-206-Attachments.html: Attachments renamed References (files + docs the description links to), collapsed by default and auto-expanding when a file lands; 5 rows then View all; one ⋮ menu per row; 'Added in a comment' links back to the comment; full-width padded images; transient Attaching/Attached row instead of a toast; no Undo; stale links read Removed or Unavailable; Git LFS warning dropped; CLI prints the link form; ⌘V paste in description, comments and create; Attach control settled as the 7th toolbar button. Kept Remove (not Delete) and Show in Finder (not Open in Finder), pending reply. Open: how doc references are recorded (derived from links vs a registry). Spec changes once settled: References, stories 25 and 28 dropped, paste/source/cap/collapse added.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b3f18227
kind: comment
occurred_at: 2026-10-15T08:13:36.845Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype review 2 (2026-10-15) applied: specs, prototypes and other docs written for a ticket become recorded references in References (after the files), added with a new 'longclaw ticket reference' verb, not links in the description: a format change, and AGENTS.md's spec-linking rule changes with it. Undo is back on Remove (toast and ⌘Z). 'Attached' stays until the next re-render. Viewer, five-row count and comment-source behaviour settled. Open: how a human adds a doc in the app, and whether a moved doc reads 'missing'.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5e1638ba
kind: comment
occurred_at: 2026-10-15T08:31:15.377Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype review 3 (2026-10-15) applied: Remove and Show in Finder settled. A human can add a reference by hand: the References button is now Add, with 'Attach a file… (Copied into the ticket)' and 'Add a reference… (Linked where it is)'. New scene K: pick, name, added with Undo, a file outside the project (chip), and a moved doc (missing). Open: allow outside-project paths?, should dropping onto References add a reference?, is naming worth the step?
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c0ce97dd
kind: comment
occurred_at: 2026-10-15T08:37:50.044Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype review 4 (2026-10-15) applied; every ask is now answered. Outside-project references allowed, with the 'outside project' chip. A reference keeps its file's name: no naming step, no Rename, no --name on 'ticket reference'. Dropping a file always attaches it; References is not a drop target.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e909697c
kind: update
occurred_at: 2026-10-15T08:40:21.193Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Prototype review settled (2026-10-15). Review decisions and the 85-row copy deck are now in this ticket's description; the spec is updated to match; the prototype is deleted (last version at 26c6abc).
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_154edaff
kind: update
occurred_at: 2026-10-15T08:47:31.078Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b5b81061.added
    to: "1 · Core: attach, remove and restore an attachment, and the reference record (add, remove, restore), with the ADR superseding 0005's UI half, the file_format.md changes (References section; git-size bullet removed) and format fixtures — no blockers"
  - field: checklist.ck_a74fb95d.added
    to: "2 · CLI: `longclaw ticket attach` as a thin wrapper over the core operation, plus the agent guide — after 1"
  - field: checklist.ck_2bf48f8c.added
    to: "3 · Serving: the attachment URI scheme and the CSP change, so the webview loads a ticket's own files and nothing else — after 1"
  - field: checklist.ck_e0ee20a9.added
    to: "4 · Rendering: full-width images, videos that never autoplay, file chips, Removed/Unavailable chips and the in-app viewer, in the description and in comments — after 3"
  - field: checklist.ck_51e4f1af.added
    to: "5 · References section: collapsed by default with a count, five rows then View all, a ⋮ menu with Show in Finder and Remove, ⌘Z undo, the (Added in comment) link and the agent rail — after 3"
  - field: checklist.ck_8cbc2320.added
    to: "6 · Inserting: ⌘V paste, drop and the toolbar's Attach button in the description editor, comments and create (held files), with the transient Attaching/Attached rows and refusals that stay until dismissed — after 4 and 5"
  - field: checklist.ck_9a64aab2.added
    to: "7 · Doc references: `longclaw ticket reference`, the Add menu's reference row, and missing and outside-project rows in References — after 2 and 5"
-->
### Claude Code updated this ticket

Split the spec into seven tracer-bullet slices as this checklist, blockers first; each item names what gates it. Detail and acceptance criteria are the spec's (docs/specs/LC-206-attachments.md).
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d6a3f1cf
kind: update
occurred_at: 2026-10-15T09:20:31.033Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b5b81061.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Slice 1 landed: core attach, remove, restore and re-attach (core/attachments.rs over the ticket document), the longclaw:reference record under ## References with add/remove/restore, error codes too_large/unsupported_media_type/not_found, ADRs 0016 and 0017, file_format.md (References section, invariant 17, git-size bullet dropped), and three format-contract fixtures. No caller wires it up yet: ticket attach is slice 2, the app command slice 6.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_29b15a04
kind: update
occurred_at: 2026-10-15T09:52:02.373Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a74fb95d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Slice 2 landed: longclaw ticket attach <KEY> <FILE> [--name] wraps the core attach (a new path-reading prepare_attachment_file the app's picker will reuse), prints the record and the link form always, and refuses in the deck's words. The generated AGENTS.md names the command before the hand-written procedure.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5408526c
kind: update
occurred_at: 2026-10-15T10:12:47.206Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2bf48f8c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Slice 3 landed: the longclaw-attachment URI scheme serves a registered image or video from its ticket's attachments/ folder with the record's media type and byte ranges (open ranges in 2 MB chunks); paths out, links and orphans are refused before a read. CSP img-src and a new media-src name the scheme, and the release audit holds both to an allow-list. Owed before release: npm run audit:network on a bundle.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_92a9d9a4
kind: update
occurred_at: 2026-10-15T12:34:33.778Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e0ee20a9.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Slice 4 landed in f18450a: images in a frame with an in-app viewer, videos that never autoplay, file chips that open in the default app, and Removed/Unavailable chips, in the description, its preview and comments. Open refuses file names macOS would run rather than show (extension allow-list; SVG and XML excluded because they open in Safari).
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_63b450fa
kind: update
occurred_at: 2026-10-15T12:36:18.641Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8c2b2bef.added
    to: "Open item · decide the open-in-default-app extension allow-list (chips for .sh/.py/.rs/.html refuse Open; SVG/XML excluded): keep it as a review decision, add deck rows for the refusal, and reword render.chip.aria/title for files that won't open"
  - field: checklist.ck_b136d98b.added
    to: "Open item · viewer header meta ({type} · {size}) is copy outside the deck: add a viewer.meta row or drop it"
  - field: checklist.ck_3c15004e.added
    to: Open item · test that an archived ticket's attachment links still render and serve (story 39)
  - field: checklist.ck_858c3bc0.added
    to: "Open item · exercise the URI scheme in a real webview: an image renders, a video seeks, and the viewer opens"
  - field: checklist.ck_6a95d5b1.added
    to: Open item · run npm run audit:network on a built bundle, offline and online, before release (new URI scheme)
-->
### Claude Code updated this ticket

Open items after slice 4, added to the checklist to look at later:

1. **Open allow-list.** `open_attachment` opens only names LaunchServices shows rather than runs (`fix.command` would run in Terminal; SVG and XML open in Safari, where a script runs). So a text chip for `.sh`, `.py`, `.rs`, `.html` etc. refuses Open and points at Show in Finder, while its aria-label still says *Opens in its default app*. The spec didn't ask for it and its copy is not in the deck. Decide whether to keep it, record it as a review decision, and add deck rows.
2. **Viewer meta.** The viewer header shows `{type} · {size}`, which no deck row covers.
3. **Archived tickets (story 39).** Archiving leaves the ticket in place, so links should keep working, but no test pins it.
4. **Real webview.** The scheme and rendering are tested in Rust and jsdom only; nothing has been seen in WebKit yet.
5. **audit:network.** Owed on a bundle before release, since slice 3 added a URI scheme.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6be1876a
kind: update
occurred_at: 2026-10-15T12:55:53.252Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_51e4f1af.checked
    from: "false"
    to: "true"
  - field: checklist.ck_fef87636.added
    to: Open item · a doc reference row's Open and Show in Finder (deferred to slice 7, with the missing and outside-project rows); Open needs the same allow-list decision as file chips, since a prototype is .html
  - field: checklist.ck_b585edab.added
    to: Open item · extend a11y:audit with rows for the References toggle, a row's ⋮ menu, and focus after Remove (the existing A1–A8 pass)
  - field: checklist.ck_a135eea2.added
    to: "Open item · deck has no toast for undoing a Remove: a file's undo reuses toast.reattached, a doc's falls back to '{KEY} restored' — confirm or add rows"
  - field: checklist.ck_74e5808b.added
    to: Open item · not-attached rows are listed after all files rather than 'where they fall' (a removed file's old position is only known to Undo)
-->
### Claude Code updated this ticket

Slice 5 landed in ebe1338: the References section (collapsed with a count, opens when a file or doc lands, five rows then View all, one ⋮ per row with View/Open, Show in Finder, Remove and Re-attach, Undo/⌘Z for Remove, Added in a comment, and the external-write accent). Orphans now carry size and sniffed type; new reattach_attachment command. Open items added to the checklist: doc rows' Open/Show in Finder (slice 7), a11y:audit rows for the section, undo-toast copy, and where not-attached rows sit.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c6b7d15b
kind: update
occurred_at: 2026-10-15T13:25:55.659Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8cbc2320.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d5eae1c0.added
    to: "Open item · the file picker's confirm button reads the system default, not 'Attach' (attach.picker.prompt): the dialog plugin cannot set it"
  - field: checklist.ck_52202cc1.added
    to: Open item · held files are lost when quick create's 'Open full editor →' carries the draft over
  - field: checklist.ck_34a39e99.added
    to: Open item · held files attached after Create land in References but no link is added to the description
  - field: checklist.ck_fcf8e3d5.added
    to: Open item · a held file refused after Create is reported in a toast (no field is left to show the row under), against 'no toast for an attach'
  - field: checklist.ck_876e059e.added
    to: Open item · full create opens the panel only after every held file is attached, with nothing on screen saying so meanwhile
  - field: checklist.ck_bcde4f1c.added
    to: Open item · the read after an attach keeps drafts and is treated as the panel's own write, so an outside edit landing in that window is not raised as a conflict
  - field: checklist.ck_53819021.added
    to: Open item · extend a11y:audit with a row for the Attach button in the toolbar's roving group (existing A1–A8 pass)
-->
### Claude Code updated this ticket

Slice 6 landed in fc17db0: ⌘V, drop and the toolbar's Attach button in the description editor, the composer and both create surfaces (held files with a tray), with Attaching/Attached rows and refusals that stay until dismissed. Review changes: the file picker now runs in Rust and the webview only ever holds a token per file, never a path; saves wait for an attach in flight instead of being dropped; Save and Comment hold while a placeholder is in the text; over-limit files are refused before they are held. Open items added to the checklist: the picker's button label, held files across Open full editor, links for held files, toast refusals after Create, the late panel open, the conflict window after an attach, and an a11y:audit row.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_831bd614
kind: update
occurred_at: 2026-10-15T13:31:46.746Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3a8834a1.added
    to: Question · should a doc reference open in its default app? A spec (.md) opens in an editor, but a prototype (.html) opens in Safari, which the file-chip allow-list refuses — decide one rule for chips and doc rows
  - field: checklist.ck_e78aad3a.added
    to: Question · an older installed LongClaw rewrites .longclaw/AGENTS.md from its own template, dropping the attach and reference guidance this branch adds — should a build leave a generated contract newer than itself alone?
  - field: checklist.ck_5472f846.added
    to: Question · Undo of a Remove re-opens References and pins the restored row past the five, as any landing does — keep, or treat a restore as not news?
  - field: checklist.ck_00b8c65e.added
    to: Question · 'Added in a comment' is inferred (the earliest comment linking the file, when the description does not) rather than recorded — is that enough, or should an attach record which comment it came in with?
-->
### Claude Code updated this ticket

Questions waiting on a decision, added to the checklist as 'Question ·' items alongside the open items from slices 4–6:

1. **Opening docs.** Should a doc reference open in its default app? A spec opens in an editor, but a prototype is .html and opens in Safari, which the file-chip allow-list refuses. One rule should cover chips and doc rows. Slice 7 needs the answer before doc rows get Open.
2. **Agent guide skew.** The installed app, built from main, regenerates .longclaw/AGENTS.md with its older template. That removes the attach guidance this branch adds, and it happened twice this session. Should a build leave a generated contract newer than itself alone?
3. **Undo of Remove.** It re-opens References and shows the restored row past the five, as any landing does. Keep that, or treat a restore as not news?
4. **Added in a comment.** This is inferred from which comment links the file rather than recorded at attach time. Is that enough, or should the attach record its comment?
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_67bfa791
kind: update
occurred_at: 2026-10-15T13:44:46.576Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: references.ref_0f773116.added
    to: LC-206-attachments.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e95ca6fc
kind: update
occurred_at: 2026-10-15T13:44:54.348Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Recorded the spec as a reference with `longclaw ticket reference` (slice 7), so the description names it rather than linking it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b77b88ce
kind: update
occurred_at: 2026-10-15T13:47:19.252Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9a64aab2.checked
    from: "false"
    to: "true"
  - field: checklist.ck_fef87636.checked
    from: "false"
    to: "true"
  - field: checklist.ck_54a7f2da.added
    to: Open item · 'outside project' is decided in the panel from the shape of the stored path (absolute = outside); a hand-written absolute path inside the project would read as outside — Rust should report it, as it does missingReferences
  - field: checklist.ck_f2d9dd25.added
    to: Open item · a reference to a symlink is stored by its target (the path is canonicalized), which can read as outside project and is not quite 'keeps the file's own name'
  - field: checklist.ck_ba83957e.added
    to: Open item · 'Attach a file…' from the References Add menu has no field to show a refusal under, so refusals are toasts without the refuse.* hint line — against 'no toast for an attach'
  - field: checklist.ck_88e6c5a4.added
    to: Open item · the reference picker's confirm button reads the system default, not 'Add reference' (reference.picker.prompt)
  - field: checklist.ck_a411dde4.added
    to: Open item · extend a11y:audit with a row for the References Add menu
-->
### Claude Code updated this ticket

Slice 7 landed in d446412: `longclaw ticket reference`, the agent guide line with a by-hand References fallback, the Add menu (Attach a file… / Add a reference…), doc rows' missing and outside-project states, and Open and Show in Finder on doc rows (which closes the slice-5 open item; whether .html opens is still the open Question). LC-206's own spec is now recorded as a reference. All seven slices are done. Open items from this slice are on the checklist: how 'outside project' is decided, symlinked references, toast refusals from the Add menu, the picker's button label, and an a11y:audit row.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7ea85a6c
kind: comment
occurred_at: 2026-10-15T13:48:18.403Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

All seven slices have landed. Everything still open is on the checklist (Open item · / Question ·), gathered here in one place.

**Questions — need a decision**
1. Which files may open in their default app? An extension allow-list refuses .sh, .py, .rs and .html, plus SVG and XML, because Safari runs scripts. That covers file chips and doc rows alike, and a prototype (.html) is a doc row.
2. An older installed LongClaw regenerates .longclaw/AGENTS.md from its own template and drops the attach and reference guidance. Should a build leave a newer generated guide alone?
3. Undo of a Remove re-opens References and pins the restored row past the five. Keep that, or treat a restore as not news?
4. Is 'Added in a comment' worked out from links enough, or should an attach record the comment it came in with?

**Before release**
- Exercise it in a real webview: an image renders, a video seeks, and the viewer opens.
- Run npm run audit:network on a built bundle, offline and online.
- Add a11y:audit rows for the Attach button, the References toggle, a row's ⋮ menu, focus after Remove, and the Add menu.
- Add a test that an archived ticket's attachment links still render (story 39).

**Copy outside the deck**
- The viewer's {type} · {size} meta.
- The toasts for undoing a Remove.
- The picker confirm buttons 'Attach' and 'Add reference', which the dialog plugin cannot set.

**Behaviour to settle**
- Held files: they are lost on Open full editor, no link is added to the description, a refusal after Create shows as a toast, and the panel opens late.
- Refusals from the Add menu's Attach a file… are toasts.
- Not-attached rows sit after all files.
- The read after an attach keeps drafts, and does not raise an outside edit that lands in that window as a conflict.
- 'outside project' is decided from the path's shape.
- Symlinked references are stored by their target.
<!-- /longclaw:event -->
