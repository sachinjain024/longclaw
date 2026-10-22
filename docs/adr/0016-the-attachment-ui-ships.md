# The attachment UI ships, and the app writes attachment records

**Status:** accepted 2026-10-15, for [LC-206](../../.longclaw/tickets/LC-206/ticket.md) ([spec](../specs/LC-206-attachments.md)). Supersedes the "no attachment UI" half of [ADR 0005](0005-attachments-ui-post-mvp.md); its format half stands.

ADR 0005 shipped the on-disk attachment format with no UI, so that attachment identity, attribution and ownership existed from the first release and adding the UI later would not be a schema migration. It was not one: LC-206 adds the UI over the same `## Attachments` registry and the same `attachments/` folder, and every rule in the format's _Attachments_ section stays but one — the git-size warning, dropped below.

What changes is that the app now **writes** attachment records, where before it only preserved them.

- **One operation, two thin callers.** Attaching is one core operation that takes bytes, a name and an actor. It judges the media type from the content, refuses anything outside `image/*`, `text/*` and `video/*` or over 10,000,000 bytes, copies the bytes into `attachments/` as `<id>-<sanitized-name>` first, and returns the `ticket.md` write that registers them second. The app's command and `longclaw ticket attach` wrap it and reimplement nothing (ADR 0011).
- **Removal unregisters.** Removing an attachment drops its record and leaves its bytes, which then read as an orphan. Undo puts the record back where it was; re-attach registers an orphan in place. Neither copies. A purge or a ticket-local trash is a separate decision ([LC-276x](../../.longclaw/tickets/LC-276x/ticket.md)).
- **Anything that names a file is checked against the disk.** A document only ever sees `ticket.md`, so a restore is re-read from its file — type and size are taken from the bytes, never from the request — before it reaches one. Containment refuses `..`, absolute paths and links, in the file and in the folder.
- **Three new error codes** cross IPC in ADR 0010's closed shape: `too_large`, `unsupported_media_type` and `not_found`, all recoverable.

## Consequences

- The format's rule to warn about files that may burden ordinary git storage is dropped. A project need not be a git repository, and a warning about a tool the person may not use is noise.
- Attachments narrate themselves in activity as `attachments.<id>.added`, `.removed` and `.reattached`, carrying the file's name. An undo's restore records `added`: it puts a row back, and nothing was re-attached.
- ADR 0005's consequences about preserving records this build cannot render, and about never creating a registry entry for an unsupported type, still hold.
