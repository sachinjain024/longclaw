# Ticket archival ships in v0

**Status:** accepted 2026-07-29, and propagated through the prototype and specs in the same change.

Archiving is in v0 scope: a user can archive a ticket from the UI, archived tickets disappear from ordinary board/list/search views, and they can be found and unarchived from an archived view. Per the file-format lifecycle semantics, archiving sets `archived_at` and never moves or deletes the ticket directory — it is distinct from Canceled (a workflow outcome that stays visible) and from deletion (not part of v0 at all). This keeps long-lived local projects tidy without introducing any destructive operation.

## Consequences

- Reverses the Step 2 handoff assumption that archival UI was post-MVP (`data-requirements.md` open item 5): v0 surfaces need an archive action, an archived-tickets view, and an unarchive path, to be specified against the existing screens.
