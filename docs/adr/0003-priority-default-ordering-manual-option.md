# Tickets order by priority by default, with a per-board Manual option

Within a board column, tickets are ordered by priority by default (Urgent → P1 → P2 → P3 → P4 → None). A board-level control lets the user switch the ordering type between **Priority** and **Manual**. Manual ordering uses the per-ticket `rank` field from the file format; the selected ordering type is a view preference held in device-local app state, not project data.

## Consequences

- `rank` is written only by manual reordering; a project that never leaves Priority mode never writes rank data, and priority ordering needs nothing on disk beyond the existing `priority` field.
- New tickets need no rank allocation on create in Priority mode; Manual mode assigns rank on first reorder (partially closes `data-requirements.md` open item 3 — the rank midpoint scheme still lands in the Step 3 format spec).
