# LongClaw v0 — data required by every screen & state

> Phase 0, Step 2 deliverable, written for the Step 3 format work. Every
> surface and activity state in the reviewed prototype, mapped to the data
> it consumes and where that data lives. The on-disk contract is
> [`../../file_format.md`](../../file_format.md); this document verifies
> that every field a screen needs exists in that contract (or is
> deliberately app/derived state) — the M0 exit gate "the data needed by
> every screen and activity state is identifiable."

## Where data lives

| Store | Contents | Authority |
|---|---|---|
| `ticket.md` frontmatter | id, key, title, status, priority, assignee, labels (slugs), rank, created_at, updated_at | canonical |
| `ticket.md` body | description (CommonMark), `## Checklist` tasks + stable item IDs, `## Attachments` registry, `## Activity` bounded events | canonical |
| `longclaw.yaml` | project id, name, key, **theme**, created_at, people registry, label definitions | canonical |
| `.longclaw/AGENTS.md` | generated agent editing contract | documentation |
| App state (OS app-support dir) | project registry (paths), last active project, starred, appearance preference, per-project board/list view, ordering preference (ADR 0003), filter query, archived-view toggle, window/panel state, palette history, index, watcher checkpoints, content hashes | disposable / device-local |
| Derived at render | checklist progress, counts, relative times, freshness, degraded status | never stored |

## Per-surface requirements

### Side panel

| Element | Data | Source |
|---|---|---|
| Section membership (Starred / Local) | starred flag, registry order | app state |
| Project row name | project name | `longclaw.yaml` |
| Theme dot color | project theme preset | `longclaw.yaml` `theme` |
| Unreachable marker | path reachability | app state (probe) |
| Waitlist button vs "you're on the list" | joined flag | app state |

### Content header

| Element | Data | Source |
|---|---|---|
| Project name | name | `longclaw.yaml` |
| Path chip | registered project path | app state registry |
| Disk-state indicator | in-flight write + target filename | app state (write queue) |
| Filter | query | app state (device-local, per project) |
| View toggle | board/list preference | app state (device-local, per project) |

### Board / issue list

| Element | Data | Source |
|---|---|---|
| Columns / groups | status enum + per-status counts | frontmatter `status` (derived counts) |
| Card/row identity | key, title | frontmatter |
| Priority glyph / chip | priority | frontmatter |
| Labels (name + color) | ticket label slugs → project label defs | frontmatter + `longclaw.yaml` |
| Checklist fraction + progress | checklist items + checked | body `## Checklist` (derived) |
| Ordering within column | priority (default) or rank (Manual mode, ADR 0003) | frontmatter `priority` / `rank`; mode from app state (device-local, per project) |
| Archived exclusion / list archived group | archived_at (ADR 0004) | frontmatter `archived_at` |
| Updated-at (list) | updated_at | frontmatter |
| Fresh treatment + "updated by agent · 12s" | last external write time + actor type | watcher event + newest activity actor (derived, app state) |
| Degraded card/row | parse result, raw bytes, error, path | storage layer (never written back) |

### Ticket panel

| Element | Data | Source |
|---|---|---|
| ID chip, file path line | key; path derived from key | frontmatter; path convention `tickets/<KEY>/ticket.md` |
| Title (editable) | title | frontmatter |
| Status/priority menus | current value + fixed v0 enum (ADR 0002) | frontmatter |
| Archive / Unarchive control | archived_at (ADR 0004) | frontmatter `archived_at` |
| Labels row + picker | slugs + project label defs | frontmatter + `longclaw.yaml` |
| Description (view/edit) | markdown body (non-reserved sections) | `ticket.md` body |
| Checklist block | items: stable id, text, checked | `## Checklist` + `longclaw:item` markers |
| Agent-fresh row treatment | which item ids changed in the last unreviewed external write | watcher diff (app state) |
| Timeline | events: id, kind, occurred_at, actor {type,id,name}, changes, body | `## Activity` `longclaw:event` records |
| "via file edit" meta | how the change arrived | watcher provenance (app state) |
| Composer post | new comment event (actor = local human) | appended to `## Activity` |
| Conflict banner | edit-start content hash vs disk hash; conflicting actor + time | app state + newest activity |

### Creation flows

| Element | Data | Source |
|---|---|---|
| Quick-create context `KEY-n` | project key + next sequence | `longclaw.yaml` + canonical ticket scan under creation lock (file_format § Ticket ID allocation) |
| Full create fields | same as panel fields | written to a new `tickets/<KEY-n>/ticket.md` |
| "created this ticket" event | reserved local human actor | `{ type: human, id: local }`; rendered as “You” |

### First launch / project creation & settings

| Element | Data | Source |
|---|---|---|
| Folder path | user selection (native picker) | app state registry |
| Existing-project detection | presence of `.longclaw/longclaw.yaml` | disk probe |
| Name / key | user input; key immutable after first ticket | `longclaw.yaml` |
| Theme picker | preset id | `longclaw.yaml` `theme` |
| Appearance | system/light/dark preference | app state (explicitly not project data) |

### Command palette

| Mode | Data | Source |
|---|---|---|
| Root commands | static set + target-ticket presence | D14 + focus state |
| Search tickets | key, title, status, archived_at of all parseable tickets (archived rows tagged) | index (disposable, rebuilt from files) |
| Go to project | registry + reachability + theme | app state + `longclaw.yaml` |
| Status/priority/ordering/theme rows | fixed enums, ordering modes, presets | as above |

### Waitlist

| Element | Data | Source |
|---|---|---|
| Email + consent | user input → submission endpoint (Step 15 decision) | never enters project files |
| Joined state | boolean | app state |

## Per-state requirements (trust states)

| State | Data needed | Source |
|---|---|---|
| No projects | empty registry | app state |
| Empty project | zero ticket dirs | disk scan |
| Loading | none (shape only) | — |
| Folder missing | last known path, project name/theme (for the listed row) | app state registry (name cached from last successful read) |
| Unparseable ticket | raw bytes, parser error + location, file path, mtime | storage layer |
| Conflict | edit-start hash, current disk hash, external actor + time | app state + activity |
| External update | changed fields diff, actor type/name, wall-clock of write | watcher + activity records |
| Undo toast | inverse of last mutation | app state (session) |

## Contract verification — prototype vs `file_format.md`

Every canonical field the screens consume exists in the approved format:
ticket identity (`id`/`key`), title, status, priority, labels, rank,
`archived_at`, timestamps, description, checklist with stable item ids,
activity events with typed actors, project name/key/theme, people, label
definitions. ✅ (`assignee` stays in the schema as optional but no v0
surface reads or writes it — ADR 0001.)

**Items the format intentionally leaves to app state, confirmed OK from
the screens:** starred, appearance, view preference, filter, freshness,
conflict hashes, palette history, waitlist joined. None of these need to
be portable; none enter the files.

**Items surfaced by the prototype — status after ADRs 0001–0005:**

1. **Local human identity** — *closed by [ADR 0001](../../adr/0001-no-assignee-in-local-mode.md).*
   Local projects expose no identity or profile UI in v0. App-authored
   human activity uses the reserved actor `{ type: human, id: local }`,
   omits a personal name, and renders as “You.”
2. **Status enum vs user-defined statuses** — *closed by
   [ADR 0002](../../adr/0002-fixed-statuses-in-v0.md).* v0 ships the six
   built-ins only; no status registry enters the v1 format. User-defined
   statuses arrive later as per-project data outside `longclaw.yaml`.
3. **Ticket ordering** — *closed by
   [ADR 0003](../../adr/0003-priority-default-ordering-manual-option.md).*
   Priority order is the default and needs nothing on disk; `rank` is
   written only by drag-and-drop while the board sort option is Manual.
   LongClaw owns rank allocation in v0; agents preserve existing ranks and
   do not invent them.
4. **Freshness provenance** — unchanged. "Updated by agent" derives from
   the newest activity entry's actor when a watcher event arrives; an
   unattributed external mutation shows as
   `file changed on disk — actor unknown`. No format change needed.
5. **Archival** — *reversed by [ADR 0004](../../adr/0004-archive-in-v0.md):
   archival UI is v0 scope.* The app reads and writes `archived_at`,
   excludes archived tickets from the board and default views, and lists
   them in the list view's archived group. Already legal in the format.
6. **Attachments** — *closed by
   [ADR 0005](../../adr/0005-attachments-ui-post-mvp.md).* No attachment
   UI in v0; the v1 format ships the registry and `attachments/`
   directory, and the app preserves agent-registered attachments
   losslessly.
