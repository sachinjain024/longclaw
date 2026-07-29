# Attachment UI is post-MVP; the on-disk attachment format ships in v1

v0 renders no attachment UI — no upload, gallery, or preview surfaces. The v1 file format still ships full attachment support (the `## Attachments` registry in `ticket.md` and the ticket-owned `attachments/` directory) so that attachment identity, attribution, and ownership exist from day one and adding the UI later is not a schema migration. Until then, descriptions and comments may reference attachment files as ordinary relative markdown links.

## Consequences

- Agents may already register attachments per the format contract; the app must preserve those records losslessly even though it doesn't render them (closes `data-requirements.md` open item 6).
