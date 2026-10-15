---
title: "Attachments: adding, showing and removing a ticket's files"
product: LongClaw
status: proposed
ticket: LC-206
---

# Attachments: adding, showing and removing a ticket's files

The spec for [LC-206](../../.longclaw/tickets/LC-206/ticket.md). Written on
2026-10-13 from the ticket as filed, the file format's attachment contract
([`file_format.md`](../file_format.md), _Attachments_, _Write and conflict
rules_ and _Lifecycle semantics_), ADRs
[0005](../adr/0005-attachments-ui-post-mvp.md),
[0009](../adr/0009-rust-owns-filesystem-authority-and-project-persistence.md),
[0010](../adr/0010-errors-cross-ipc-as-a-closed-tagged-shape.md) and
[0011](../adr/0011-cli-is-the-creation-surface-agents-use.md), and the core as it
stands on `main`.

## Problem Statement

A ticket is meant to be the unit of context, but the context a human most often
has to hand is not text: a screenshot of the failure, a screen recording of the
reproduction, a log file. Today the human cannot put any of it on the ticket
from the app. They can type a description and comments, but a pasted image goes
nowhere, a dropped file does nothing, and there is no button for either.

The format has expected attachments since v1 shipped ([ADR 0005](../adr/0005-attachments-ui-post-mvp.md)):
a ticket-owned `attachments/` directory and an `## Attachments` registry in
`ticket.md`. The parser reads the registry, keeps it intact through every write,
and already knows which registered files are missing and which files on disk
are unregistered orphans. But the only way to add an attachment is to do by
hand what the agent guide describes: copy the bytes, choose an id, sniff a
media type, and write a YAML record. Few humans will do that, and the CLI that
agents use (ADR 0011) has no verb for it, so agents have to hand-write records
too.

Even an attachment that is registered correctly is invisible. The description
and comment renderer refuses relative links on purpose, because v0 had nothing
to open them with and the webview would have navigated the whole app to
`tauri://…/attachments/…`. So `![Failure state](./attachments/att_8e31-failure-state.png)`
shows up as its own Markdown source.

## Solution

A human can attach a file to a ticket wherever they write about it, and see it
where they wrote it.

- In the **description editor** and the **comment composer**, the human can
  paste a copied file with ⌘V, drop files onto the field, or choose files from
  an **Attach** (paperclip) toolbar button. Each file is copied into the ticket, registered,
  and a Markdown link to it is inserted at the caret. Images get an image link
  (`![name](./attachments/…)`); everything else gets an ordinary link.
- Where a description or comment is **rendered**, a link into the ticket's own
  `attachments/` directory resolves: an image shows inline, a video shows as an
  inline player that can seek, and a text file or other attachment shows as a
  file chip with its name and size that opens in the default macOS app.
- The ticket panel has a **References** section, collapsed by default, that
  lists every registered attachment (name, media type, size, who added it and
  when) and then every **doc reference**: a spec, a prototype or any other file
  on disk that the ticket points at where it is, without copying it. Each row
  has one ⋮ menu: view or open, Show in Finder, and Remove. The section also
  shows the two broken states the core already detects: a **missing**
  attachment (registered, but no bytes) and an **orphan** (bytes, but no
  registration, shown as _not attached_). An orphan can be re-attached.
- A human adds a doc reference from the section's **Add** menu; agents add the
  docs they write with `longclaw ticket reference`. Either way the reference
  keeps the file's own name.
- **Removing** an attachment unregisters it and keeps its bytes, and Undo (the
  toast, or ⌘Z) puts it back. The file stays
  in `attachments/` as a recoverable orphan, which the same section offers to
  re-attach. Nothing is deleted. Permanent deletion or a ticket-local trash
  is a follow-up ([LC-276x](../../.longclaw/tickets/LC-276x/ticket.md)).
- **Agents** get the same operations from the command line: `longclaw ticket
  attach`, which copies, checks, registers and attributes the file the same way
  the app does, and `longclaw ticket reference`, which records a doc they wrote.
  Neither has to hand-write a record.

The design was reviewed as a prototype in four rounds and settled on
2026-10-15. The decisions and the settled copy deck are in
[LC-206](../../.longclaw/tickets/LC-206/ticket.md) under _Review decisions_ and
_Copy deck_; where this spec and the ticket disagree on a string, the ticket's
deck wins.

Every add and every removal is an attributed activity event, so the timeline
says who attached what.

## User Stories

1. As a human, I want to paste a screenshot into a ticket's description, so that the failure I am describing is on the ticket next to the words.
2. As a human, I want to paste a screenshot into a comment, so that I can show the state of the work at the point in the conversation where it matters.
3. As a human, I want to drop one or more files from Finder onto the description editor, so that I can attach a log or recording without leaving the ticket.
4. As a human, I want to drop files onto the comment composer, so that a comment can carry its evidence.
5. As a human, I want an Attach button in the editor's toolbar that opens a file picker, so that I can attach a file without a mouse drag or a clipboard.
6. As a keyboard-only human, I want the Attach button to be reachable with Tab and to work with Enter and Space, so that attaching does not need a pointer.
7. As a human, I want the link to the attachment inserted where my caret was, so that the reference lands in the sentence I was writing.
8. As a human, I want an image to be inserted as an image link and any other file as a plain link, so that the description renders the way I expect without me editing Markdown.
9. As a human, I want the inserted link to use the file's original name as its text, so that the raw Markdown stays readable in an editor or in git.
10. As a human, I want to see a placeholder at the caret while a large file is copying, so that I know the attach is in progress and where the link will land.
11. As a human, I want to keep typing while a file is copying, so that a 10 MB video does not freeze the editor.
12. As a human, I want an image attachment to render inline in the description and in comments, so that I can read the ticket without opening files.
13. As a human, I want inline images to scale to the panel's width and keep their aspect ratio, so that a large screenshot does not break the layout.
14. As a human, I want to open an inline image at full size, so that I can read the detail in a screenshot.
15. As a human, I want a video attachment to render as an inline player I can seek, so that I can watch a reproduction without leaving the ticket.
16. As a human, I want a text attachment to render as a file chip showing its name and size, so that a log does not pour into the description.
17. As a human, I want to open any attachment in its default macOS app from its chip or from the Attachments section, so that I can use the right tool for it.
18. As a human, I want to show an attachment in Finder, so that I can drag it somewhere else or check it in git.
19. As a human, I want a References section in the ticket panel listing every registered attachment and every doc reference, collapsed until I open it and opening by itself when a file lands, so that I can see all of a ticket's files in one place even when no text links to them.
20. As a human, I want each row in that section to show the name, media type, size, who added it and when, so that I know where a file came from.
21. As a human, I want a file larger than 10 MB to be refused with a message that names the file and the limit, so that I know why it did not attach and what to do instead.
22. As a human, I want a file whose content is not an image, text or video to be refused with a message that names the file and the kinds that are allowed, so that I am not surprised later.
23. As a human, I want a refusal for one file in a multi-file drop not to stop the others, so that one bad file does not cost me the rest.
24. As a human, I want a file's type to be judged by its content and not only its extension, so that a renamed executable cannot pass as an image.
25. ~~As a human, I want to be warned when an attachment is large enough to be a burden in ordinary git storage.~~ Dropped in review: a project need not be a git repository, so LongClaw does not warn about git at all.
26. As a human, I want to remove an attachment from the Attachments section, so that a file I attached by mistake no longer belongs to the ticket.
27. As a human, I want removing an attachment to keep its bytes on disk, so that a slip of the hand cannot destroy evidence.
28. As a human, I want to undo a removal with ⌘Z like any other ticket edit, so that removing is as safe as editing a description.
29. As a human, I want a removed attachment to appear as an orphan I can re-attach, so that I can recover it after the undo window has passed.
30. As a human, I want a link to a removed attachment in the description or a comment to show as _Removed_, and a link to a missing one as _Unavailable_, so that I can see the reference is broken, and why, rather than having text silently disappear.
31. As a human, I want a registered attachment whose file is missing to show as missing, with its metadata intact, so that I know what is gone and who added it.
32. As a human, I want a file in `attachments/` that no record registers to show as an orphan, so that something an agent or an interrupted copy left behind does not stay hidden.
33. As a human, I want to re-attach an orphan, so that it becomes a registered, attributed attachment without being copied again.
34. As a human, I want every attachment added or removed to appear in the activity timeline, attributed to whoever did it, so that the ticket's history is complete.
35. As a human, I want an attachment an agent added to be attributed to that agent and to get the same acknowledgement as any other external change, so that I notice it.
36. As a human, I want an attachment added outside the app (by an agent, the CLI, or by hand) to show up in an open panel without reopening it, so that the ticket stays live.
37. As a human, I want an attachment I add while another writer changed `ticket.md` to be refused the same way any stale edit is, so that I never overwrite someone else's work.
38. As a human, I want an interrupted attach (app quit, disk full) to leave at worst an orphan and never a record pointing at nothing, so that the ticket file stays trustworthy.
39. As a human, I want an attachment's link to keep working after I archive the ticket, so that archived context is still readable.
40. As a human, I want attaching to work the same in the create panel as in the ticket panel, so that I can include a screenshot when I first file a ticket.
41. As a human, I want a relative link that points outside the ticket's `attachments/` directory to stay refused, so that a description cannot reach into the rest of my disk.
42. As a human, I want attachments to work offline, so that they keep to the app's no-network rule.
43. As an agent, I want `longclaw ticket attach <KEY> <file>` to copy, check, register and attribute a file in one call, so that I never have to hand-write an attachment record.
44. As an agent, I want the attach command to return the new record as JSON, including the relative link to use, so that I can put it in a comment or description in my next edit.
45. As an agent, I want the attach command to refuse with the same structured, recoverable error the app shows (too large, unsupported type, unknown ticket), so that I can report it or retry.
46. As an agent, I want `longclaw ticket show` to include the ticket's attachments with their missing or orphan state, so that I can see a ticket's files without listing the directory.
47. As an agent, I want the attachment rules in the generated `.longclaw/AGENTS.md` to point me at the CLI verb first and the hand-written record second, so that the safe path is also the obvious one.
48. As a maintainer, I want an attachment record written by the app to be byte-identical in shape to one written by the CLI, so that one parser and one fixture set cover both.
49. As a maintainer, I want unknown attachment fields and unsupported media types already on disk to stay preserved through every write, so that the lossless-round-trip rule still holds.
50. As a screen-reader user, I want inline images to be announced by their alt text and file chips by name, type and size, so that attachments are not silent.
51. As a screen-reader user, I want the attach progress, success and refusal to be announced in a live region, so that I know what happened without looking.
52. As a human, I want ⌘V of a copied file to attach it in the description, a comment or a create surface, while ⌘V of plain text still pastes text, so that attaching from the clipboard needs no button.
53. As a human, I want a file that came in through a comment to say _Added in a comment_ and take me to that comment, so that I can see the conversation it belongs to.
54. As a human, I want the References section to show five rows and _View all_ for the rest, with broken rows counted among the five and a just-added row always shown, so that a long list does not push the checklist off the panel.
55. As a human, I want each References row to have one ⋮ menu with every action it has, so that nothing a row can do is hidden behind a hover.
56. As a human, I want to add a reference to a file on disk from the section's Add menu, without copying it, so that a ticket can point at a doc that lives elsewhere.
57. As a human, I want a reference to a file outside the project folder to be allowed but marked _outside project_, so that I know agents and other machines may not find it.
58. As a human, I want a reference whose file was moved or deleted to show as missing with its old path, so that I know what to fix.
59. As an agent, I want `longclaw ticket reference <KEY> <path>` to record a doc I wrote for a ticket, attributed to me, so that a spec or a prototype is listed with the ticket's files rather than linked in its description.
60. As a human, I want the "Attached" confirmation under the field to stay until the view next re-renders and never come back, so that I see it without it lingering as state.

## Implementation Decisions

**Supersedes part of ADR 0005.** ADR 0005 put the attachment UI after the MVP
and kept relative links unrendered. This spec ships that UI. A short ADR that
supersedes 0005's "no attachment UI" half should land with the first slice. The
format half of 0005, and every rule in the format's _Attachments_ section, stays
as it is.

**One core operation, two thin callers.** The Rust core gains one deep
operation on a ticket: _attach_. It takes bytes, the original file name and an
actor, and returns the new attachment record. Inside, it:

1. Resolves the ticket directory through the same ownership and containment
   checks every write uses.
2. Detects the media type from the content, with the extension as a secondary
   signal only. It refuses anything outside `image/*`, `text/*` and `video/*`.
3. Refuses anything over 10,000,000 bytes.
4. Mints an `att_…` id and sanitizes the name into `<id>-<sanitized-name>`.
5. Writes the bytes atomically into `attachments/` **first**.
6. Applies a ticket edit that appends the `## Attachments` record and an
   attributed activity event **second**, under the same stale-hash check as
   every other edit.

Both the Tauri command and the new `longclaw ticket attach` CLI verb are thin
wrappers over this operation (ADR 0011: the CLI is the creation surface agents
use). Neither caller reimplements a step.

**Doc references are a new record.** A `longclaw:reference` record under a new
`## References` section of `ticket.md` holds an `ref_…` id, the referenced
path, `added_at` and `added_by`. The path is project-relative when the file is
inside the project and absolute when it is not; an absolute path is allowed
(the UI marks it _outside project_) because a reference is a pointer the human
chose, not a canonical copy. The row's name is the file's own name, derived
from the path and never stored, so there is nothing to rename. Nothing is
copied and nothing is read except to check existence: a reference whose path
does not resolve is _missing_. `TicketEdit` gains `add_reference`,
`remove_reference` and `restore_reference`; removing drops the record and never
touches the file. This is a format change and the first record that may name a
path outside the project, so it lands with its own ADR, `file_format.md`
section and format-contract fixtures, in slice 1.

**No git-size warning.** The format's rule to warn when a file may be a burden
in ordinary git storage is dropped (review 1): a project need not be a git
repository, and a warning about a tool the user may not use is noise. Its
bullet in `file_format.md`'s _Attachments_ section is removed in slice 1.

**Removal and re-attach are ticket edits.** `TicketEdit` gains `remove_attachment`
(by id) and `restore_attachment`, the latter so that undo can put a removed
record back where it was. This mirrors `remove_checklist_item` and
`restore_comment`. Removing drops the registry record and leaves the bytes, so
the file becomes an orphan by the format's own definition. _Re-attach orphan_
registers an existing file under `attachments/` without copying it, using the
same media sniffing and size checks as _attach_.

**Activity.** Adding, removing and re-attaching each record an `update` event
with an `attachments` field change. The change carries the attachment's display
name, so the timeline stays readable after the record is gone. This is the same
pattern a checklist removal uses.

**Bytes cross IPC once, as bytes.** HTML5 drag-and-drop stays on, because the
window keeps `dragDropEnabled: false` (LC-60, which the board's drag depends
on). A dropped or pasted `File` is therefore read in the webview and sent to the
attach command as a raw binary body, not as base64 JSON. The file picker returns
paths, which the Rust side reads itself. A failure crosses as the closed error
shape of ADR 0010. Its codes are `too_large`, `unsupported_media_type`,
`not_found` and the existing `stale`/`conflict`, all marked recoverable.

**Serving attachments to the webview.** Attachments are served through a custom
URI scheme that Rust owns. It takes a project id, a ticket key and a relative
file path, and it checks that the path stays inside that ticket's `attachments/`
directory (no absolute paths, no `..`, no symlink escapes) before reading
anything (ADR 0009). It supports byte ranges so a video can seek, and it serves
the media type from the registry record, never one guessed from the extension.
The broad `asset:` protocol scope is not widened. The CSP's `img-src` and a new
`media-src` name only the new scheme. Thumbnails and poster frames, if added,
live in the app's cache directory and never in the project.

**Rendering.** The Markdown renderer's link policy becomes ticket-aware. A
relative destination that resolves inside the ticket's `attachments/` directory
and matches a registered attachment becomes an attachment node: an image, a
video, or a file chip, depending on the record's media type. A relative
destination that resolves to an unregistered or missing file becomes an
_unavailable attachment_ node. Every other relative or protocol-relative
destination stays refused, exactly as today. Images keep their alt text. Text
attachments are never inlined.

**Inserting.** The editor toolbar gains an _Attach_ (paperclip) action as its
seventh button, after a hairline, inside the formatting group's roving tab
stop. Paste and drop handlers live on the description editor and the comment
composer, and the create panel reuses them; ⌘V attaches only when the clipboard
holds a file. The create surfaces hold files and attach them right after the
ticket is written, with a tray saying so. Dropping always attaches: the
References section is not a drop target. Each file inserts a pending
placeholder at the caret, which is replaced by the final link when its attach
resolves and removed when the attach is refused. A row under the field says
_Attaching…_ and then _Attached_ until the next re-render; refusals stay until
dismissed. There is no toast for an attach. The textarea keeps holding the raw
Markdown, as it does today.

**The References section.** Between Description and Checklist, collapsed by
default behind a heading that toggles it and carries the count; it opens by
itself when a file lands. It lists registered attachments in registry order,
then doc references, with missing attachments and orphans where they fall. It
is built from the `missing_attachments` and `orphan_attachments` the ticket
detail already carries, plus the references. Five rows show, then _View all_.
Each row ends in a ⋮ menu: View (images, the in-app viewer) or Open (default
app), Show in Finder, and Remove (with the hint _File kept_); an orphan's menu
offers Re-attach. The heading's **Add** menu offers _Attach a file…_ and _Add a
reference…_. Remove raises a toast with Undo, and ⌘Z undoes it too.

**Agent surface.** `longclaw ticket attach <KEY> <path> [--name …] --agent-id …
[--agent-name …]` prints the record as JSON along with the Markdown link to
paste, always in the link form. `longclaw ticket reference <KEY> <path>
--agent-id …` records a doc reference and prints it. `ticket show` includes
attachments, references and their state. The generated
`.longclaw/AGENTS.md` names the verb first and keeps the hand-written procedure
as the fallback.

**Index.** Attachment bytes stay out of the search index, as they are today.
Indexing text attachments up to an explicit size limit is allowed by the format
but is not part of this spec.

## Testing Decisions

A good test here drives the operation a caller uses and asserts what a reader
of the project folder would see: the files on disk, the text of `ticket.md`,
the rendered DOM, or the JSON the CLI prints. It never asserts private helpers,
the sequence of internal calls, or intermediate state. Two seams carry almost
all of it:

1. **The core attach operation**, exercised against a temporary project folder.
   Cases: a supported image, text and video each register with the right
   sniffed media type; a mislabelled file is judged by its content; an
   over-limit file and an unsupported type are refused, leave nothing behind,
   and produce the structured error; a stale hash is refused; an interrupted
   registration leaves an orphan and never a dangling record; removal leaves the
   bytes and reports them as an orphan; restore and re-attach round-trip;
   containment rejects `..`, absolute paths and escaping symlinks; and unknown
   fields and opaque records survive. References get the same treatment: add,
   remove and restore round-trip; an inside path is stored relative and an
   outside one absolute; a path that does not resolve reads missing; removal
   never touches the file. Prior art: the attachment-state tests in
   the storage module and the `fixtures/format-contract/` cases
   (`valid-attachment-records-preserved`, `degraded-record-invalid-attachment`).
   New fixtures pin the exact record shape the app writes. The CLI verb gets the
   same end-to-end treatment as `ticket create` and `ticket edit`'s existing
   tests: run it, then read the folder and the JSON.
2. **The frontend render-and-insert path.** The Markdown module is tested as
   a pure function: registered, missing, unregistered, escaping and external
   destinations each map to the right node. Prior art: `markdown.test.ts`'s
   `linkHref` cases, which must keep refusing what they refuse today. The panel
   and the editors are tested through the IPC stub: paste, drop and the toolbar
   each call attach and land the link at the caret; a refusal surfaces the
   message and removes the placeholder; remove, undo and re-attach update the
   section. Prior art: `DescriptionEditor.test.tsx`, `TicketPanel.test.tsx` and
   `mutations.test.ts`.

The URI scheme handler's containment and range logic is a third, small seam,
tested directly in Rust, because it is the one piece neither seam above reaches.

Beyond `verify`: run `a11y:audit` after adding the Attach control and the
section's row actions, and extend it with a row for each. Run `probe:header`
if the toolbar change widens the content header. Run `audit:network` on a
bundle before release, because a new URI scheme is exactly what that audit
exists to vet.

## Out of Scope

- **Permanently deleting an attachment's bytes, or a ticket-local trash.**
  Removal in this spec only unregisters. Purge and trash are
  [LC-276x](../../.longclaw/tickets/LC-276x/ticket.md).
- Replacing an attachment's content in place. The format treats registered
  files as immutable, so a replacement is a new attachment.
- Media types outside `image/*`, `text/*` and `video/*`, and any rendering of
  them beyond preservation.
- Thumbnails, poster frames, transcoding, and image editing or annotation.
- Full-text indexing of text attachments.
- Moving or copying an attachment between tickets.
- Anything about git: no size warning, no Git LFS, no git configuration.
- Renaming a reference, and dropping files onto the References section.
- Attachments on anything other than a ticket, such as a project or a label.

## Further Notes

- The UI half was reviewed as a prototype in four rounds and settled on
  2026-10-15. The decisions and the copy deck are in LC-206. The prototype was
  then deleted; its last version is `docs/ux/prototypes/LC-206-Attachments.html`
  at commit `26c6abc`.
- Natural slices for `/to-tickets`, blockers first: (1) the core attach and
  remove operations, with fixtures; (2) the CLI verb and the agent guide;
  (3) the URI scheme and the CSP; (4) rendering; (5) the References section;
  (6) paste, drop and the toolbar in the description editor, comments and the
  create panel; (7) doc references: the record, `ticket reference`, and the
  Add menu. Slice 1 carries the format change for references and the removal
  of the git-size bullet, with its ADR.
- The website and docs must not describe attachments as shipped until they
  are. When they ship, `/docs/file-format` and `/docs/what-a-ticket-is` need
  the user-facing half.
