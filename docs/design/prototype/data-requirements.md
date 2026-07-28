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
| App state (OS app-support dir) | project registry (paths), starred, appearance preference, window/panel state, palette history, index, watcher checkpoints, content hashes | disposable / device-local |
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
| Filter | query | app state (session only) |
| View toggle | board/list preference | app state |

### Board / issue list

| Element | Data | Source |
|---|---|---|
| Columns / groups | status enum + per-status counts | frontmatter `status` (derived counts) |
| Card/row identity | key, title | frontmatter |
| Priority glyph / chip | priority | frontmatter |
| Labels (name + color) | ticket label slugs → project label defs | frontmatter + `longclaw.yaml` |
| Checklist fraction + progress | checklist items + checked | body `## Checklist` (derived) |
| Assignee avatar | assignee id → person name/initials | frontmatter + `longclaw.yaml` `people` |
| Ordering within column | rank | frontmatter `rank` |
| Updated-at (list) | updated_at | frontmatter |
| Fresh treatment + "updated by agent · 12s" | last external write time + actor type | watcher event + newest activity actor (derived, app state) |
| Degraded card/row | parse result, raw bytes, error, path | storage layer (never written back) |

### Ticket panel

| Element | Data | Source |
|---|---|---|
| ID chip, file path line | key; path derived from key | frontmatter; path convention `tickets/<KEY>/ticket.md` |
| Title (editable) | title | frontmatter |
| Status/priority menus | current value + enum | frontmatter |
| Assignee menu | people registry (humans only) | `longclaw.yaml` `people` |
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
| "created this ticket" event | actor = local human identity | see open item 1 below |

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
| Search tickets | key, title, status of all parseable tickets | index (disposable, rebuilt from files) |
| Go to project | registry + reachability + theme | app state + `longclaw.yaml` |
| Status/assign/priority/theme rows | enums, people, presets | as above |

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
ticket identity (`id`/`key`), title, status, priority, assignee, labels,
rank, timestamps, description, checklist with stable item ids, activity
events with typed actors, project name/key/theme, people, label
definitions. ✅

**Items the format intentionally leaves to app state, confirmed OK from
the screens:** starred, appearance, view preference, filter, freshness,
conflict hashes, palette history, waitlist joined. None of these need to
be portable; none enter the files.

**Open items surfaced by the prototype for Step 3 to close:**

1. **Local human identity.** Events and `assignee` need a stable person id
   for "the human at this machine" without accounts. The prototype assumes
   the first entry in `people` is the local user; Step 3 must decide how
   `people` gets its first entry (project creation prompt vs OS username
   default) and how the local actor id is chosen per machine.
2. **Status enum vs user-defined statuses.** D3 makes statuses
   user-definable with colored dots; `longclaw.yaml` in the format doc does
   not yet carry a status registry. v0 screens only need the six built-ins;
   if user statuses stay in v0 scope, the project file needs a `statuses`
   section (name, color from the 8-hue ramp, order) — flagged, not decided
   here.
3. **Ticket ordering.** Cards render by `rank` within a column; the
   prototype inserts new tickets at the top. Step 3 should state the rank
   scheme (lexicographic midpoints per the format doc) and the default rank
   on create.
4. **Freshness provenance.** "Updated by agent" derives from the newest
   activity entry's actor when a watcher event arrives. If an agent
   mutates state without appending an event (legal but history-incomplete
   per the format), the card still pulses but attributes as
   `file changed on disk — actor unknown`. No format change needed;
   noting the derivation rule.
5. **Archived tickets.** `archived_at` exists in the format's lifecycle
   semantics but no v0 surface displays or sets it. Confirm it is
   post-MVP UI (the format keeps it legal on disk).
6. **Attachments.** The format registers attachments; no v0 screen in this
   prototype renders them (drag-in images are explicitly "later" in the
   brief). Descriptions may reference them as plain links. Confirm
   attachment UI is post-MVP while the on-disk registry ships in v1 format.
