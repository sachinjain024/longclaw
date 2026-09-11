# Ticket property configuration lives in `longclaw.yaml`, beside labels

**Status:** accepted 2026-09-07, for [LC-227](../../.longclaw/tickets/LC-227/ticket.md). It defers one sentence of [ADR 0002](0002-fixed-statuses-in-v0.md) rather than overturning it, and decides nothing about statuses.

The four ticket properties LC-227 adds — **Type**, **Due date**, **Start date** and **Estimate** — are configured per project in `.longclaw/longclaw.yaml`, in a `properties:` block beside `labels:`. Every property is off by default, and enabling one is where its vocabulary and its settings are configured: Type's value enum, Due's attention window, Estimate's system and the conversion that system needs.

```yaml
format: longclaw.project/v1
name: LongClaw
key: LC
theme: clay
labels:
  storage: { name: Storage, color: blue }
properties:
  type:
    enabled: true
    values:
      bug: { name: Bug, color: red }
  due:
    enabled: true
    attention_days: 7
  estimate:
    enabled: true
    system: duration
    hours_per_day: 8
```

The block itself is specified in [`file_format.md`](../file_format.md). This decision is only about which file it goes in, and it exists because there is already a sentence on the record pointing the other way.

## What ADR 0002 reserved, and why it is deferred rather than ignored

ADR 0002 said user-defined statuses "arrive in a later version as per-project data stored in that project's settings, **not** in `longclaw.yaml`". Property configuration is per-project data of exactly that kind, so the reservation has to be answered rather than walked past.

It is answered by narrowing it. That sentence was written about a status registry, and it stands for one: nothing here decides where user-defined statuses go, and statuses are still fixed in v0. It does not extend to properties, for four reasons.

**1. The format document names the trigger for splitting, and it has not fired.** The registries are kept together deliberately — _"Keeping these small, infrequently changed registries together reduces file-format surface area in v0. They can be split in a future schema version if real collaboration data shows that the project file has become a conflict hotspot."_ The reason to split is write contention. With one writer and no sync there is none, and when sync arrives the contended file will be `ticket.md`, not the project file. The format has already spent its one anti-hotspot move on the file that actually contends: `rank` lives on the ticket precisely to keep a shared board-order file from existing.

**2. `longclaw.yaml` is already the project's settings file.** `theme` is a per-project display setting sitting beside `id` and `key`, and `ProjectDocument::set_theme` rewrites that one line and nothing else. If a project's theme belongs there, a property's attention window does.

**3. A second canonical project file is permanent machinery.** Everything that knows one project file learns two — `storage::project_file_path` and the reader beside it, the watcher, the registry's cached project row, the CLI's `open_project`, the format-version check, the conformance fixtures, the release audit. And the project file's _existence_ is the test for whether a folder is a LongClaw project at all (`storage::holds_project`), which a second file either weakens or duplicates. It also creates a degraded state that does not exist today: one project file parsing while the other does not. Ticket degradation is per-ticket and specified (invariant 14); project metadata that will not parse is a project-level failure, reported rather than repaired ([ADR 0010](0010-errors-cross-ipc-as-a-closed-tagged-shape.md)). A _partial_ project-level parse is a third state, and nothing in the format says what it means.

**4. It cuts against the one-read principle the format is built around.** Activity is embedded in `ticket.md` to give an agent one file to read and mutate; the project's vocabulary is already a second read for an agent that needs to know what a slug means. Splitting configuration off makes it a third.

## The argument on the other side

Recorded because it is real, not to be dismissed. There is a genuine line between **identity** — `id`, `key`, `created_at`, effectively immutable — and **configuration** — `theme`, labels, properties, edited whenever somebody changes their mind. Keeping them in one file means every label rename rewrites the file that holds the project's identity.

Two things blunt it. The document keeps its bytes and rewrites only the lines it touches, so a rename is a one-line diff and the identity block is never re-rendered. And the decision is cheap to reverse: one migration later, against second-file machinery from now on.

## What would revisit it

Conditions rather than an invitation to re-run the argument. Any one of these is grounds to split configuration out — and to split _configuration_, leaving identity where it is, which is the shape the counter-argument above already describes.

1. **The format document's own trigger fires.** Multi-writer sync lands and the project file measurably contends. Contention on the project file is the evidence; contention on tickets is not.
2. **The write seam can no longer keep the file safe.** Today an edit to one label leaves every other child's bytes untouched. If configuration grows deep or dynamic enough that a write has to re-render its neighbours, the file has outgrown the seam — and a document the app rewrites wholesale is a different decision from this one.
3. **Something project-level arrives that is not configuration.** User-defined statuses are the obvious candidate: a status registry has referential integrity with every ticket's `status` and a deletion story that labels do not have. ADR 0002's reservation should be settled on that evidence, not by this decision.

## Consequences

- **The write seam has to grow a level.** `Mapping::set_nested_scalar` reaches `labels` → `storage` → `name`; `properties` → `type` → `values` → `bug` → `name` is one level deeper than that. Whatever shape ships, the requirement this decision imposes is the one that made `labels` safe: an edit to one property leaves every other property's bytes — including keys this build does not interpret — exactly where their author put them. Growing the seam is the expected answer; re-rendering the block wholesale is not.
- **The block ships inside `longclaw.project/v1`.** Adding an optional key to the project mapping is not a format break. A build that predates it reads the project, collects `properties` as an unknown key, and preserves it through every write — invariant 11, the same mechanism that already protects a key a human added by hand. Such a build shows no properties, which is what a build without the feature should do.
- **All off by default, so no existing project changes.** Nothing is backfilled across the 233 tickets that predate these properties, and the board's pinned card heights stay as they are until a project enables something that reaches the card.
- **Disabling hides; it never deletes.** A ticket keeps its `due:` when Due is switched off, because a disabled property is exactly a key this build declines to interpret, and invariant 11 already requires it to survive a read-modify-write.
- **The CLI refuses a disabled property and an undefined value**, the way `known_labels` refuses an undefined label slug — _"a label cannot be brought into existence by using it"_ (`CONTEXT.md`). [ADR 0011](0011-cli-is-the-creation-surface-agents-use.md) already says this of the labels a CLI-written ticket carries; a type slug is that rule's second instance, and it belongs to this decision because a project can only refuse what its own file defines.
- **A value's colour validates the way a label's does** — a preset id the frontend owns (`is_theme_id`), not a colour the file gets to name. Rust learns no palette for this.
- **The generated `.longclaw/AGENTS.md` documents only the enabled set**, with the project's own vocabulary in it, so an agent is never told about a property the project turned off or a type it has not defined. That makes the file change whenever configuration does; [LC-66](../../.longclaw/tickets/LC-66/ticket.md) is the open bug about that file churning, and this adds to what churns it.
- **Nothing outside the project folder learns any of this.** Not `project-registry.json`, which caches only what draws a project row, and not `device-preferences.json`: an attention window is a fact about the project, the same for everyone who opens it. [ADR 0012](0012-device-preferences-are-a-file-rust-owns.md) owns the other side of that line — a property is configuration, not a preference.
