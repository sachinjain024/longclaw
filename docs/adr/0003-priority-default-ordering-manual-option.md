# Tickets order by priority by default, with a per-board Manual option

Within a board column, tickets are ordered by priority by default (Urgent → P1 → P2 → P3 → P4 → None). A board-level control lets the user switch the ordering type between **Priority** and **Manual**. Manual ordering uses the per-ticket `rank` field from the file format; the selected ordering type is a view preference held in device-local app state, not project data.

## Consequences

- Drag-and-drop reordering is available only while the selected sort option is **Manual**. It is disabled while sorting by Priority.
- `rank` is written only by manual reordering; a project that never leaves Priority mode never writes rank data, and priority ordering needs nothing on disk beyond the existing `priority` field.
- New tickets need no rank allocation on create in Priority mode; Manual mode assigns rank on first reorder.
- LongClaw owns rank allocation in v0. Agents preserve existing rank strings and do not invent them, so the allocation algorithm remains an app implementation detail rather than part of the agent-facing file contract.
