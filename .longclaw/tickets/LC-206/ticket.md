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
updated_at: 2026-10-15T09:20:31.033Z
---

Users should be able to add attachments in description and comments: paste (⌘V), drop or pick a file in the description editor, the comment composer and the create panel; see images and videos inline and other files as chips; and list, open, remove and re-attach them from a References section in the panel, which also lists the docs written for the ticket. Agents get the same operations as `longclaw ticket attach` and `longclaw ticket reference`.

**Spec:** [`docs/specs/LC-206-attachments.md`](../../../docs/specs/LC-206-attachments.md) covers the problem, user stories, implementation and testing decisions, and the test seams. It supersedes the "no attachment UI" half of ADR 0005.

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
- [ ] 2 · CLI: `longclaw ticket attach` as a thin wrapper over the core operation, plus the agent guide — after 1 <!-- longclaw:item=ck_a74fb95d -->
- [ ] 3 · Serving: the attachment URI scheme and the CSP change, so the webview loads a ticket's own files and nothing else — after 1 <!-- longclaw:item=ck_2bf48f8c -->
- [ ] 4 · Rendering: full-width images, videos that never autoplay, file chips, Removed/Unavailable chips and the in-app viewer, in the description and in comments — after 3 <!-- longclaw:item=ck_e0ee20a9 -->
- [ ] 5 · References section: collapsed by default with a count, five rows then View all, a ⋮ menu with Show in Finder and Remove, ⌘Z undo, the (Added in comment) link and the agent rail — after 3 <!-- longclaw:item=ck_51e4f1af -->
- [ ] 6 · Inserting: ⌘V paste, drop and the toolbar's Attach button in the description editor, comments and create (held files), with the transient Attaching/Attached rows and refusals that stay until dismissed — after 4 and 5 <!-- longclaw:item=ck_8cbc2320 -->
- [ ] 7 · Doc references: `longclaw ticket reference`, the Add menu's reference row, and missing and outside-project rows in References — after 2 and 5 <!-- longclaw:item=ck_9a64aab2 -->
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
