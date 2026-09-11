# Statuses are fixed in v0; user-defined statuses come later, per project

**Status:** accepted 2026-07-29, and propagated through the prototype and specs in the same change.

v0 ships exactly the built-in status set — Backlog · Todo · In Progress · In Review · Done · Canceled — and users cannot create, rename, or recolor statuses. User-defined statuses arrive in a later version as per-project data stored in that project's settings, not in `longclaw.yaml`; their exact on-disk representation is specified when the feature ships.

**Narrowed 2026-09-07 by [ADR 0013](0013-property-configuration-lives-in-longclaw-yaml.md):** that reservation was written about a status registry and still stands for one — where user-defined statuses live is undecided, and this decision does not settle it. It does not extend to per-project *property* configuration. Type, due date, start date and estimate are configured in `longclaw.yaml` beside labels; ADR 0013 records why, and the three conditions that would revisit it.

## Consequences

- The v1 ticket format needs no status registry: `status` is a value from the fixed enum, which keeps the format spec and agent contract smaller (closes `data-requirements.md` open item 2).
- The status *visual language* from foundations D3 (one dot-plus-label geometry for every status) stands; only the status-creation UI (name input + dot swatch picker) moves out of v0 scope. Foundations `decisions.md` D3 is partially superseded accordingly.
