# Statuses are fixed in v0; user-defined statuses come later, per project

v0 ships exactly the built-in status set — Backlog · Todo · In Progress · In Review · Done · Canceled — and users cannot create, rename, or recolor statuses. User-defined statuses arrive in a later version as per-project data stored in that project's settings, not in `longclaw.yaml`; their exact on-disk representation is specified when the feature ships.

## Consequences

- The v1 ticket format needs no status registry: `status` is a value from the fixed enum, which keeps the format spec and agent contract smaller (closes `data-requirements.md` open item 2).
- The status *visual language* from foundations D3 (one dot-plus-label geometry for every status) stands; only the status-creation UI (name input + dot swatch picker) moves out of v0 scope. Foundations `decisions.md` D3 is partially superseded accordingly.
