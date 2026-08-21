# Attachment UI is post-MVP; the on-disk attachment format ships in v1

**Status:** accepted 2026-07-29, and propagated through the prototype and specs in the same change.

v0 renders no attachment UI — no upload, gallery, or preview surfaces. The v1 file format still ships full attachment support (the `## Attachments` registry in `ticket.md` and the ticket-owned `attachments/` directory) so that attachment identity, attribution, and ownership exist from day one and adding the UI later is not a schema migration. Until then, descriptions and comments may reference attachment files as ordinary relative markdown links.

## Consequences

- Agents may already register attachments per the format contract; the app must preserve those records losslessly even though it doesn't render them (closes `data-requirements.md` open item 6).
- The supported media families are `image/*`, `text/*`, and `video/*`, with a maximum of 10 MB (10,000,000 bytes) per attachment.
- Unsupported media types already present on disk are preserved as opaque records, but the v0 app does not create new registry entries for them.
