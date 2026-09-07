---
format: longclaw.ticket/v1
id: 57c3c15c-497f-4647-a6ea-641e6cc3d9f3
key: LC-227
title: Add Other Fields to Tickets like Due Date, Start Date, Est Effort, Type
status: todo
priority: urgent
labels:
  - release
created_at: 2026-08-22T06:13:17.138Z
updated_at: 2026-09-07T14:24:52.409Z
---

Brainstorm with LLM agent like what other fields we should support. A few items I can think of are Type - Bug/Task, Due State, Start Date, Effort

- When Due Date is within a week, we highlight the ticket or add some indicator
- Should we show the Start Date and Due Date on the Card or only Due date on the card. We can take inspiration from Todoist on this.
- What are the other ticket types we should support - Is Task / Bug sufficient?

Create a Checklist once the execution plan is finalized. We should do a UX prototype first before building this feature.

In the UX Prototype we should consider increasing the width of the Ticket Panel and adding a right panel that contains all the properties like Status, Priority, etc and move the description, etc to the top.

## Brainstorm outcome

Settled 2026-09-07. All four properties ship, each opt-in per project, each
carrying configuration the project owns. Confirmed a release blocker.

### What ships

| Property | On disk | Values |
|---|---|---|
| Type | `type` | A project-defined enum, seeded with `bug` · `feature` · `chore` · `docs` · `spike` |
| Due date | `due` | date-only `YYYY-MM-DD` |
| Start date | `start` | date-only `YYYY-MM-DD` |
| Estimate | `estimate` | Depends on the project's estimate system — see below |

Each is optional and absent by default, mirroring `priority: none` rather than
forcing a backfill across the 233 tickets that predate them.

**Type is not a label in disguise.** None of this project's 15 labels is a type:
they are areas (`storage`, `frontend`, `platform`, `domain`, `format`, `index`,
`persistence`) and lifecycle (`release`, `v0-backlog`, `post-mvp`, `parked`,
`prototype-diff`), and the five triage labels are workflow state. Type is a free
axis, exclusive where a label is not, and it is the one property that changes how
an *agent* reads a ticket — defect report or feature spec.

Its values are **an editable enum, shaped like labels**: slug, display name and
colour, seeded with the five above and changeable per project. The CLI then has
to refuse an undefined type exactly as it already refuses an undefined label — "a
label cannot be brought into existence by using it" (`CONTEXT.md:47`), and
`known_labels()` at `cli.rs:283` is the shape to mirror.

**Start date was flagged as thin and included anyway.** It is a Gantt/dependency
concept and there is no timeline view to render it in; Todoist surfaces no
equivalent. It ships on the decision that the panel should hold both dates even
while only Due earns a place on the card.

### Estimate is a system the project picks

Three, and a project is on exactly one:

- **T-shirt** — `xs` `s` `m` `l` `xl`, an editable enum like Type's.
- **Fibonacci** — `1` `2` `3` `5` `8` `13`. Nothing to configure.
- **Duration** — a number input plus a unit dropdown: minutes, hours, days,
  weeks. Written as `<number><unit>`, so `30m`, `2h`, `1.5d`, `1w`.
  **Decimals are legal and compounds are not**: `1.5d` yes, `1d4h` no.
  The conversion is a project setting, defaulting to **1d = 8h** and **1w = 5d**,
  because effort is working time and a project on a six-hour day would otherwise
  sort wrongly.

One consequence worth designing for rather than discovering: `estimate` holds a
different shape under each system, so **switching systems must preserve values
written under the old one** rather than destroying them — the same rule as
disabling a property, below.

### Dates accept several inputs and store one

On disk it is always `YYYY-MM-DD`. What a human types is looser: a picker, or
`2026-09-28`, or `28 Sep 2026`, or `28 Sep` — the app normalises. A form with no
year needs a rule (nearest future occurrence is the Todoist behaviour and the
recommendation), and that rule has to be written down before it is implemented.

### Configuration lives in `longclaw.yaml`, beside labels

[ADR 0002](../../../docs/adr/0002-fixed-statuses-in-v0.md) reserved per-project
configuration for "that project's settings, **not** in `longclaw.yaml`". That
reservation is **deliberately deferred**, and the ADR this ticket writes has to
say so rather than ignore it. Four reasons:

1. **The format doc names the trigger for splitting, and it has not fired.** The
   registries are kept together to reduce format surface area, and may be split
   "if real collaboration data shows that the project file has become a conflict
   hotspot". The reason to split is write contention; with one user and no sync
   there is none, and when sync arrives the hot file will be tickets, not labels.
2. **`longclaw.yaml` already is the project settings file.** It holds `theme`, a
   per-project display setting sitting beside `id` and `key`. If `theme` belongs
   there, labels and property configuration do too.
3. **A second canonical project file is permanent machinery** — the app, the CLI,
   the watcher and the index each learn another project-level file to read,
   parse, watch, validate and version — and it creates a degraded state that does
   not exist today: one project file corrupt while the other parses. Ticket
   degradation is per-ticket; a project-level partial parse is new.
4. **It cuts against the one-read principle** the format is built around.

The argument on the other side, recorded because it is real: there is a genuine
line between *identity* (`id`, `key`, `created_at`, effectively immutable) and
*configuration* (`theme`, labels, properties, edited weekly), and keeping them
together means every label edit rewrites the file holding the project's identity.
It is not worth a second file today, and the decision is cheap to reverse — one
migration later, against second-file machinery forever now.

So the configuration joins labels where they already live:

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
      feature: { name: Feature, color: cyan }
  due:
    enabled: true
    attention_days: 7
  start:
    enabled: false
  estimate:
    enabled: true
    system: duration          # tshirt | fibonacci | duration
    hours_per_day: 8
    days_per_week: 5
```

Four rules follow:

- **All off by default.** The panel has three meta rows today; four more turned
  on by default changes every existing project and re-creates the
  description-below-the-fold problem for people who never asked for it.
- **Enabling a property is where its values get configured.** The base values
  ship; Fibonacci needs no editing, a t-shirt or type enum can be rewritten, and
  duration mode is where the conversion is set.
- **Disabling hides, never deletes.** A ticket keeps its `due:` when Due is
  switched off. This is format invariant 11 — a disabled property is exactly a
  key this build declines to interpret, and it must survive the next write.
- **The CLI refuses a disabled property and an undefined value.** The generated
  `.longclaw/AGENTS.md` then documents only the enabled set with the project's
  actual vocabularies, so an agent does not write a property the project has
  turned off or a type it has not defined — mind LC-66, the open bug about that
  file churning on every project change.

### A due date always shows, and its treatment escalates

Four rungs. The date itself is the weakest rung — visible, but not engaging when
it is a fortnight out — and the treatment sharpens as it approaches:

| Range | Treatment |
|---|---|
| Overdue | Attention indicator |
| Today | Slight attention indicator |
| Within `attention_days` (default 7, configurable) | A distinct indicator |
| Beyond that | The plain date |

Only the third boundary moves; overdue, today and beyond are absolute.

**The card grows a second footer row to hold it.** The footer never wraps and
holds two chips — **one** when a checklist fraction is present
(`boardCard.ts:28-30`, `screen-specs.md:155-156`) — so an always-visible date
would otherwise cost a label slot on every ticket that has one. The footer gains
a row instead; the date does not compete for the existing one.

That lands on the one thing the board cannot do casually. `boardGeometry.ts`
pins card heights exactly because the board is virtualised — *"a column that
guesses a card's height jitters as it scrolls"* — and there are exactly two,
`CARD_HEIGHT = 108` and `ACKNOWLEDGED_CARD_HEIGHT = 136`, with the module
stating flatly that there is no third. `scripts/card-height-guard.mjs`, inside
`npm run check`, adds the stylesheet's rows up and fails the build when they
disagree with the constants.

It is tractable, because `cardStrides()` already picks a stride **per ticket**.
The rule that must survive is the module's own: **a card's height stays
derivable from row data and is never measured.** "Has a due date, and the
property is enabled" is derivable; "how tall did this card turn out" is not.

**The row appears only when the ticket has something to put in it.** No due
date, no second row. Two things make that safe rather than the open-ended case
the module warns about:

- **it is one line and never wraps**, the same rule the first footer already
  carries, so however many chips land in it the card has exactly four pinned
  heights — plain and acknowledged, each with and without the row;
- **presence is derived from row data and never from the rung.** "Has a value
  for an enabled second-row property" is a boolean off `IndexedTicket` plus the
  project's configuration, and it changes only when the file does. Deciding it
  from the rung instead would change card heights **at midnight, with no file
  write**, shifting every column's offsets under a scrolled board.

Two consequences worth stating. The default costs nothing: properties ship
all-off, so no card has a second row until one is enabled and a project that
never enables one keeps today's geometry exactly. And `cardStrides()` and
`card-height-guard.mjs` go from two cases to four, because the acknowledged
variant multiplies with the new one — a second boolean rather than a new
mechanism, since `cardStrides` already picks per ticket.

Two runs answer to this beyond the usual gate: `probe:drag`, because a drop is
arithmetic over these offsets (`gapAt`) and a new height moves where a dragged
ticket lands, and `perf:board`, because the whole scroll cost is nodes.

Start date never competes for this: it is a panel-only property.

The list row is easier — two chips with nothing competing (`listRow.ts:35`) —
but its time slot is 46px and LC-93 was the bug about text wrapping inside it.

### Three consequences of a due date that are easy to miss

1. **It is a date, not a timestamp.** `file_format.md:142` says timestamps are
   UTC RFC 3339. A due date is a *day*: `2026-09-14T00:00:00Z` reads as Sep 13 in
   UTC-8. Date-only is a new shape in the YAML subset and the format doc has to
   say so.
2. **Proximity is derived, never stored**, consistent with checklist progress and
   freshness.
3. **A due date changes with no file write.** "Due tomorrow" becomes "due today"
   at midnight and nothing in the watcher/snapshot pipeline pushes that — the
   board keeps saying "tomorrow" until an unrelated event re-renders it. Needs a
   day-boundary tick or a recompute on window focus. The seam exists:
   `listRow.ts:41` already threads a `now`.

### The panel redesign overlaps LC-238s

LC-238s owns panel width and owns it in detail: the width belongs in
`devicePreferences.ts` (ADR 0012, not `localStorage`), the 560px at
`screen-specs.md:213` is line-cited and pinned, and the drag must not re-render
the subtree per frame. This ticket's prototype should build on that rather than
re-decide it — LC-238s ships the mechanism, LC-227 explores what the extra width
is *for*: a right-hand properties rail with the description moved to the top.
That rail is not cosmetic. Four more rows in the current stacked 84px meta grid
(`screen-specs.md:227-231`) push the description roughly 100px down, below the
fold.

### Deliberately out of scope

- **Relations — blocks / blocked-by / parent.** A graph across files with
  referential integrity and deletion semantics. Its own ticket, and the largest
  genuinely-missing thing in the tracker.
- **Recurrence, reminders, notifications.** There is no notification surface.
- **A `due:today` filter grammar.** The filter is a plain substring over key,
  title and label slugs (`filtering.ts:17-19`), and that file already points at
  V0-24 for the real search surface. A field grammar is a separate feature.
- **Story points as velocity.** Fibonacci is offered as a scale; summing it per
  column is a team concept from the family [ADR 0001](../../../docs/adr/0001-no-assignee-in-local-mode.md)
  excluded the assignee from.
- Worth a cheap look later: **`completed_at`**, which `archived_at` set the
  precedent for and which answers "what did I ship this week" — activity cannot,
  because `history_incomplete` is a real state.

### One vocabulary gap

`CONTEXT.md:59` already defines **Field** as *a text-bearing editable the caret
can sit in*, explicitly not a ticket property. This ticket's title collides with
that, and there is no existing term for "a named piece of ticket frontmatter".
`docs/agents/domain.md` asks that gaps be surfaced rather than papered over.
**Property** is the recommendation, and it is the word this ticket already
reaches for.

## Checklist

- [x] ADR: property configuration joins labels in longclaw.yaml — record why ADR 0002's reservation is deferred, and what would revisit it <!-- longclaw:item=ck_945a1ca9 -->
- [x] Add Property to CONTEXT.md; Field is already defined there as a text-bearing editable <!-- longclaw:item=ck_d7acf634 -->
- [ ] Settle the date-input grammar: which typed forms are accepted (2026-09-28, 28 Sep 2026, 28 Sep) and which year a form without one means <!-- longclaw:item=ck_eb7e1c56 -->
- [ ] Specify type, due, start and estimate in docs/file_format.md, replacing prose in place <!-- longclaw:item=ck_4b893432 -->
- [ ] Specify date-only YYYY-MM-DD in the YAML subset, distinct from the RFC 3339 timestamps at file_format.md:142 <!-- longclaw:item=ck_65106100 -->
- [ ] Specify the properties block in longclaw.yaml — the all-off default, and per-property configuration beside it <!-- longclaw:item=ck_ea47a75f -->
- [ ] Type values are an editable enum like labels — slug, name, colour — seeded with bug, feature, chore, docs, spike <!-- longclaw:item=ck_0b3b783d -->
- [ ] Estimate: three systems — t-shirt, Fibonacci, duration — and a project is on exactly one <!-- longclaw:item=ck_d57ef7e6 -->
- [ ] Estimate duration mode: number plus unit (minutes, hours, days, weeks); decimals legal (1.5d), compounds not (1d4h) <!-- longclaw:item=ck_addc6137 -->
- [ ] Estimate conversion is configurable in duration mode only: hours per day and days per week, defaulting to 8 and 5 <!-- longclaw:item=ck_845b9000 -->
- [ ] Switching estimate systems preserves values written under the old one rather than destroying them <!-- longclaw:item=ck_112ec2a3 -->
- [ ] Settle the four due rungs — overdue, today, within attention_days, beyond — and that attention_days defaults to 7 and is configurable <!-- longclaw:item=ck_c45f20d4 -->
- [ ] Decide whether disabling a property that tickets already carry warns first <!-- longclaw:item=ck_4148120d -->
- [ ] Prototype the ticket panel: right-hand properties rail, description moved to the top <!-- longclaw:item=ck_b6758ff8 -->
- [ ] Prototype the four due rungs and their visual treatments, in both appearances <!-- longclaw:item=ck_7b6183bf -->
- [ ] Prototype the card's second footer row — what it holds, and how it reads at rest beside a checklist fraction <!-- longclaw:item=ck_e0292fab -->
- [ ] The second footer row appears only when the ticket has a value for an enabled property that sits in it — one line, never wrapping, presence derived from row data and never from the rung, giving exactly four pinned heights <!-- longclaw:item=ck_bef33999 -->
- [ ] Prototype the estimate control for each system — t-shirt chips, Fibonacci chips, and number plus unit <!-- longclaw:item=ck_100759d5 -->
- [ ] Prototype the settings Properties pane: the type-values editor, the estimate system picker, and a property switched off while tickets carry values <!-- longclaw:item=ck_d5ddb411 -->
- [ ] Review the prototype, record what it settled, then delete it and its line in the index <!-- longclaw:item=ck_7d5bada6 -->
- [ ] Project: parse and render the properties block in longclaw.yaml, preserving unknown keys <!-- longclaw:item=ck_15465a7c -->
- [ ] Ticket: parse and render the four properties; a disabled one survives a read-modify-write untouched <!-- longclaw:item=ck_15eaaa0f -->
- [ ] Validate a malformed date or estimate without destroying it — degrade the value, keep the bytes <!-- longclaw:item=ck_91489cf3 -->
- [ ] TicketEdit: the four properties, nullable where absent must differ from cleared <!-- longclaw:item=ck_fc53069e -->
- [ ] Activity: a changes entry per property, so a due date set by an agent is attributable <!-- longclaw:item=ck_92d3b485 -->
- [ ] Index: carry the four properties on IndexedTicket <!-- longclaw:item=ck_71c2030f -->
- [ ] CLI create and edit: --type --due --start --estimate, refusing a disabled property and an undefined type value the way known_labels refuses an undefined label <!-- longclaw:item=ck_cc46645c -->
- [ ] Generated .longclaw/AGENTS.md documents only the enabled set — check it against LC-66's churn <!-- longclaw:item=ck_e017a189 -->
- [ ] Conformance fixtures per property: enabled and disabled, valid and malformed <!-- longclaw:item=ck_25b41a66 -->
- [ ] types.ts: the four properties on Ticket and IndexedTicket <!-- longclaw:item=ck_bb5b83f5 -->
- [ ] Settings: a properties section in SETTINGS_SECTIONS after labels, both labels off one row <!-- longclaw:item=ck_5fbdce11 -->
- [ ] Settings pane: the type-values editor, shaped like the labels editor <!-- longclaw:item=ck_395aa8b1 -->
- [ ] Settings pane: the estimate system picker, its conversion fields, and the due attention_days number <!-- longclaw:item=ck_f8c2ee24 -->
- [ ] Ticket panel: the properties rail, gated on the project's enabled set <!-- longclaw:item=ck_8505f369 -->
- [ ] Date input: picker plus the typed forms, normalised to the canonical on-disk shape <!-- longclaw:item=ck_31cdc0b5 -->
- [ ] Create panel and quick create: the enabled properties only <!-- longclaw:item=ck_15448aa4 -->
- [ ] Board card: the due chip in a second footer row, which the footer gains rather than the chip contending for a label slot <!-- longclaw:item=ck_09e1edf1 -->
- [ ] boardGeometry: cardStrides learns the second footer row, keeping the height derivable from row data and never measured <!-- longclaw:item=ck_1b980442 -->
- [ ] styles.css and card-height-guard.mjs learn the new pinned heights — the guard runs inside npm run check and fails on a disagreement <!-- longclaw:item=ck_2c41c9b0 -->
- [ ] List row: due within the row's two-chip budget, minding LC-93's 46px slot <!-- longclaw:item=ck_6ac72ae5 -->
- [ ] Proximity derived from an injected now, plus the day-boundary recompute the watcher cannot push <!-- longclaw:item=ck_55424527 -->
- [ ] A Due board ordering mode beside Priority and Manual (ADR 0003) <!-- longclaw:item=ck_79550de2 -->
- [ ] Command palette rows for setting each enabled property <!-- longclaw:item=ck_e8cbab2a -->
- [ ] Undo for each property change, through fieldUndo.ts <!-- longclaw:item=ck_43674ebd -->
- [ ] Explicit tabIndex on every new control — npm run check fails without it <!-- longclaw:item=ck_33780452 -->
- [ ] Update screen-specs.md, components.md, states.md and data-requirements.md in place, then npm run citations:update <!-- longclaw:item=ck_75cc51b4 -->
- [ ] Update keyboard-focus-map.md in place for the rail's keyboard path <!-- longclaw:item=ck_8c1b2d21 -->
- [ ] npm run a11y:audit, and probe:header since the rail widens the panel <!-- longclaw:item=ck_e4ce4244 -->
- [ ] probe:drag: a drop is arithmetic over the card offsets (gapAt), so a new card height moves where a dragged ticket lands <!-- longclaw:item=ck_5fa993af -->
- [ ] npm run perf:board and perf:list, and quote the numbers — the due comparator touches ordering <!-- longclaw:item=ck_c404ee03 -->
- [ ] npm run verify <!-- longclaw:item=ck_5e61f2a1 -->
- [ ] A /docs page for ticket properties and a /changelog entry <!-- longclaw:item=ck_aa77f085 -->
- [ ] Run /design-sync to push the settled Board card and the new property components to the Claude Design project (LC-63) <!-- longclaw:item=ck_0bc85504 -->
## Activity

<!-- longclaw:event
id: evt_7da0bfb7
kind: create
occurred_at: 2026-08-22T06:13:17.138Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_87d81e49
kind: update
occurred_at: 2026-08-22T06:36:55.553Z
actor:
  type: human
  id: local
changes:
  - field: title
    from: Add Support for Ticket Type like Bug, Task or whatelse?
    to: Add Other Fields to Tickets like Due Date, Start Date, Est Effort, Type
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c8a4ad8b
kind: update
occurred_at: 2026-08-22T06:43:35.344Z
actor:
  type: human
  id: local
changes:
  - field: description
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fab33caf
kind: update
occurred_at: 2026-09-07T11:55:28.620Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4ae3519b
kind: update
occurred_at: 2026-09-07T11:55:59.990Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_945a1ca9.added
    to: "ADR: ticket properties are per-project configuration in longclaw.yaml — reconcile with ADR 0002's 'not in longclaw.yaml' line for statuses"
  - field: checklist.ck_d7acf634.added
    to: Add Property to CONTEXT.md; Field is already defined there as a text-bearing editable
  - field: checklist.ck_eb7e1c56.added
    to: "Settle the estimate grammar: are compound durations (1d4h) legal in v1, and what conversion does sorting use (1d = 8h, 1w = 5d)"
  - field: checklist.ck_4b893432.added
    to: Specify type, due, start and estimate in docs/file_format.md, replacing prose in place
  - field: checklist.ck_65106100.added
    to: Specify date-only YYYY-MM-DD in the YAML subset, distinct from the RFC 3339 timestamps at file_format.md:142
  - field: checklist.ck_ea47a75f.added
    to: "Specify the properties: block in longclaw.yaml and the all-off default"
  - field: checklist.ck_4148120d.added
    to: Decide whether disabling a property that tickets already carry warns first
  - field: checklist.ck_b6758ff8.added
    to: "Prototype the ticket panel: right-hand properties rail, description moved to the top"
  - field: checklist.ck_7b6183bf.added
    to: Prototype the four due proximity states — overdue, today, this week, later
  - field: checklist.ck_e0292fab.added
    to: Prototype the card with the due chip contending for a footer that holds one chip beside a checklist fraction
  - field: checklist.ck_100759d5.added
    to: "Prototype the estimate control: unit dropdown plus number input"
  - field: checklist.ck_d5ddb411.added
    to: Prototype the settings Properties pane, including a property switched off while tickets carry values
  - field: checklist.ck_7d5bada6.added
    to: Review the prototype, record what it settled, then delete it and its line in the index
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a5370c3e
kind: update
occurred_at: 2026-09-07T11:56:07.857Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_15465a7c.added
    to: "Project: parse and render the properties: block, preserving unknown keys"
  - field: checklist.ck_15eaaa0f.added
    to: "Ticket: parse and render the four properties; a disabled one survives a read-modify-write untouched"
  - field: checklist.ck_91489cf3.added
    to: Validate a malformed date or estimate without destroying it — degrade the value, keep the bytes
  - field: checklist.ck_fc53069e.added
    to: "TicketEdit: the four properties, nullable where absent must differ from cleared"
  - field: checklist.ck_92d3b485.added
    to: "Activity: a changes entry per property, so a due date set by an agent is attributable"
  - field: checklist.ck_71c2030f.added
    to: "Index: carry the four properties on IndexedTicket"
  - field: checklist.ck_cc46645c.added
    to: "CLI create and edit: --type --due --start --estimate, refusing a disabled property the way known_labels refuses an unknown label"
  - field: checklist.ck_e017a189.added
    to: Generated .longclaw/AGENTS.md documents only the enabled set — check it against LC-66's churn
  - field: checklist.ck_25b41a66.added
    to: "Conformance fixtures per property: enabled and disabled, valid and malformed"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6b41a3c2
kind: update
occurred_at: 2026-09-07T11:56:16.032Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bb5b83f5.added
    to: "types.ts: the four properties on Ticket and IndexedTicket"
  - field: checklist.ck_5fbdce11.added
    to: "Settings: a properties section in SETTINGS_SECTIONS after labels, both labels off one row"
  - field: checklist.ck_8505f369.added
    to: "Ticket panel: the properties rail, gated on the project's enabled set"
  - field: checklist.ck_15448aa4.added
    to: "Create panel and quick create: the enabled properties only"
  - field: checklist.ck_09e1edf1.added
    to: "Board card: the earned-only due chip, against the two-chip footer"
  - field: checklist.ck_6ac72ae5.added
    to: "List row: due within the row's two-chip budget, minding LC-93's 46px slot"
  - field: checklist.ck_55424527.added
    to: Proximity derived from an injected now, plus the day-boundary recompute the watcher cannot push
  - field: checklist.ck_79550de2.added
    to: A Due board ordering mode beside Priority and Manual (ADR 0003)
  - field: checklist.ck_e8cbab2a.added
    to: Command palette rows for setting each enabled property
  - field: checklist.ck_43674ebd.added
    to: Undo for each property change, through fieldUndo.ts
  - field: checklist.ck_33780452.added
    to: Explicit tabIndex on every new control — npm run check fails without it
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2b7291be
kind: update
occurred_at: 2026-09-07T11:56:22.809Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_75cc51b4.added
    to: Update screen-specs.md, components.md, states.md and data-requirements.md in place, then npm run citations:update
  - field: checklist.ck_8c1b2d21.added
    to: Update keyboard-focus-map.md in place for the rail's keyboard path
  - field: checklist.ck_e4ce4244.added
    to: npm run a11y:audit, and probe:header since the rail widens the panel
  - field: checklist.ck_c404ee03.added
    to: npm run perf:board and perf:list, and quote the numbers — the due comparator touches ordering
  - field: checklist.ck_5e61f2a1.added
    to: npm run verify
  - field: checklist.ck_aa77f085.added
    to: A /docs page for ticket properties and a /changelog entry
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a3f762ae
kind: update
occurred_at: 2026-09-07T12:47:18.120Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_0b3b783d.added
    to: Type values are an editable enum like labels — slug, name, colour — seeded with bug, feature, chore, docs, spike
  - field: checklist.ck_d57ef7e6.added
    to: "Estimate: three systems — t-shirt, Fibonacci, duration — and a project is on exactly one"
  - field: checklist.ck_addc6137.added
    to: "Estimate duration mode: number plus unit (minutes, hours, days, weeks); decimals legal (1.5d), compounds not (1d4h)"
  - field: checklist.ck_845b9000.added
    to: "Estimate conversion is configurable in duration mode only: hours per day and days per week, defaulting to 8 and 5"
  - field: checklist.ck_112ec2a3.added
    to: Switching estimate systems preserves values written under the old one rather than destroying them
  - field: checklist.ck_c45f20d4.added
    to: Decide whether the due attention window (7 days) is configurable or fixed
  - field: checklist.ck_e2554391.added
    to: Migrate labels out of longclaw.yaml into the settings file — a recoverable copy first (LC-31's pattern), a format version bump, and a decision on what an older build shows
  - field: checklist.ck_395aa8b1.added
    to: "Settings pane: the type-values editor, shaped like the labels editor"
  - field: checklist.ck_f8c2ee24.added
    to: "Settings pane: the estimate system picker and its conversion fields"
  - field: checklist.ck_31cdc0b5.added
    to: "Date input: picker plus the typed forms, normalised to the canonical on-disk shape"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_10836eaf
kind: update
occurred_at: 2026-09-07T12:47:36.689Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_945a1ca9.text
    from: "ADR: ticket properties are per-project configuration in longclaw.yaml — reconcile with ADR 0002's 'not in longclaw.yaml' line for statuses"
    to: "ADR: a per-project settings file outside longclaw.yaml holds labels and property configuration, per ADR 0002's reservation — settle its name, path and format id"
  - field: checklist.ck_0b3b783d.moved
    from: "40"
    to: "7"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_57cbcaec
kind: update
occurred_at: 2026-09-07T12:47:36.714Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_eb7e1c56.text
    from: "Settle the estimate grammar: are compound durations (1d4h) legal in v1, and what conversion does sorting use (1d = 8h, 1w = 5d)"
    to: "Settle the date-input grammar: which typed forms are accepted (2026-09-28, 28 Sep 2026, 28 Sep) and which year a form without one means"
  - field: checklist.ck_d57ef7e6.moved
    from: "41"
    to: "8"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_760951f0
kind: update
occurred_at: 2026-09-07T12:47:36.735Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ea47a75f.text
    from: "Specify the properties: block in longclaw.yaml and the all-off default"
    to: "Specify the settings file: labels, the properties block, the all-off default, and what an older build shows for a migrated project"
  - field: checklist.ck_addc6137.moved
    from: "42"
    to: "9"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_557dff47
kind: update
occurred_at: 2026-09-07T12:47:36.756Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_15465a7c.text
    from: "Project: parse and render the properties: block, preserving unknown keys"
    to: "Settings file: parse and render it with its own versioned format id, preserving unknown keys"
  - field: checklist.ck_845b9000.moved
    from: "43"
    to: "10"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_94096493
kind: update
occurred_at: 2026-09-07T12:47:36.776Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_100759d5.text
    from: "Prototype the estimate control: unit dropdown plus number input"
    to: Prototype the estimate control for each system — t-shirt chips, Fibonacci chips, and number plus unit
  - field: checklist.ck_112ec2a3.moved
    from: "44"
    to: "11"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c18278a8
kind: update
occurred_at: 2026-09-07T12:47:46.005Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d5ddb411.text
    from: Prototype the settings Properties pane, including a property switched off while tickets carry values
    to: "Prototype the settings Properties pane: the type-values editor, the estimate system picker, and a property switched off while tickets carry values"
  - field: checklist.ck_c45f20d4.moved
    from: "45"
    to: "12"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9c66ca99
kind: update
occurred_at: 2026-09-07T12:47:46.029Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_cc46645c.text
    from: "CLI create and edit: --type --due --start --estimate, refusing a disabled property the way known_labels refuses an unknown label"
    to: "CLI create and edit: --type --due --start --estimate, refusing a disabled property and an undefined type value the way known_labels refuses an undefined label"
  - field: checklist.ck_e2554391.moved
    from: "46"
    to: "21"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_23b7aa46
kind: update
occurred_at: 2026-09-07T12:47:46.053Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_395aa8b1.moved
    from: "47"
    to: "32"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_885cc516
kind: update
occurred_at: 2026-09-07T12:47:46.075Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f8c2ee24.moved
    from: "48"
    to: "33"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ddd0b454
kind: update
occurred_at: 2026-09-07T12:47:46.095Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_31cdc0b5.moved
    from: "49"
    to: "35"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_71e411ac
kind: update
occurred_at: 2026-09-07T13:12:33.917Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_945a1ca9.text
    from: "ADR: a per-project settings file outside longclaw.yaml holds labels and property configuration, per ADR 0002's reservation — settle its name, path and format id"
    to: "ADR: property configuration joins labels in longclaw.yaml — record why ADR 0002's reservation is deferred, and what would revisit it"
  - field: checklist.ck_e2554391.removed
    from: Migrate labels out of longclaw.yaml into the settings file — a recoverable copy first (LC-31's pattern), a format version bump, and a decision on what an older build shows
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3a74eca7
kind: update
occurred_at: 2026-09-07T13:12:33.945Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ea47a75f.text
    from: "Specify the settings file: labels, the properties block, the all-off default, and what an older build shows for a migrated project"
    to: Specify the properties block in longclaw.yaml — the all-off default, and per-property configuration beside it
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d76d0d71
kind: update
occurred_at: 2026-09-07T13:12:33.969Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_15465a7c.text
    from: "Settings file: parse and render it with its own versioned format id, preserving unknown keys"
    to: "Project: parse and render the properties block in longclaw.yaml, preserving unknown keys"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6ad82d85
kind: update
occurred_at: 2026-09-07T13:12:33.994Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c45f20d4.text
    from: Decide whether the due attention window (7 days) is configurable or fixed
    to: Settle the four due rungs — overdue, today, within attention_days, beyond — and that attention_days defaults to 7 and is configurable
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e30da28e
kind: update
occurred_at: 2026-09-07T13:12:41.916Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7b6183bf.text
    from: Prototype the four due proximity states — overdue, today, this week, later
    to: Prototype the four due rungs, and settle whether the card shows the plain-date rung at all or only from an escalated one
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0c30f9f7
kind: update
occurred_at: 2026-09-07T13:12:41.943Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_09e1edf1.text
    from: "Board card: the earned-only due chip, against the two-chip footer"
    to: "Board card: the due chip against a footer holding one chip beside a checklist fraction — an always-shown date costs a label slot on every ticket that has one"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_07dc818c
kind: update
occurred_at: 2026-09-07T13:12:41.969Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f8c2ee24.text
    from: "Settings pane: the estimate system picker and its conversion fields"
    to: "Settings pane: the estimate system picker, its conversion fields, and the due attention_days number"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e5784331
kind: update
occurred_at: 2026-09-07T13:12:58.420Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7b6183bf.text
    from: Prototype the four due rungs, and settle whether the card shows the plain-date rung at all or only from an escalated one
    to: Prototype the four due rungs and their visual treatments, in both appearances
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2630fb35
kind: update
occurred_at: 2026-09-07T13:12:58.445Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e0292fab.text
    from: Prototype the card with the due chip contending for a footer that holds one chip beside a checklist fraction
    to: "Prototype the card: whether the plain-date rung shows there at all, given a footer that holds one chip beside a checklist fraction"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_59acbaf4
kind: update
occurred_at: 2026-09-07T13:17:51.733Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e0292fab.text
    from: "Prototype the card: whether the plain-date rung shows there at all, given a footer that holds one chip beside a checklist fraction"
    to: Prototype the card's second footer row — what it holds, and how it reads at rest beside a checklist fraction
  - field: checklist.ck_bef33999.added
    to: "Decide whether every card carries the second footer row or only cards with something in it: two pinned heights stay two, or become four"
  - field: checklist.ck_1b980442.added
    to: "boardGeometry: cardStrides learns the second footer row, keeping the height derivable from row data and never measured"
  - field: checklist.ck_2c41c9b0.added
    to: styles.css and card-height-guard.mjs learn the new pinned heights — the guard runs inside npm run check and fails on a disagreement
  - field: checklist.ck_5fa993af.added
    to: "probe:drag: a drop is arithmetic over the card offsets (gapAt), so a new card height moves where a dragged ticket lands"
  - field: checklist.ck_0bc85504.added
    to: Run /design-sync to push the settled Board card and the new property components to the Claude Design project (LC-63)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5731d2ef
kind: update
occurred_at: 2026-09-07T13:17:59.277Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_09e1edf1.text
    from: "Board card: the due chip against a footer holding one chip beside a checklist fraction — an always-shown date costs a label slot on every ticket that has one"
    to: "Board card: the due chip in a second footer row, which the footer gains rather than the chip contending for a label slot"
  - field: checklist.ck_bef33999.moved
    from: "49"
    to: "17"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a28d18c8
kind: update
occurred_at: 2026-09-07T13:17:59.303Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1b980442.moved
    from: "50"
    to: "38"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1487bfb8
kind: update
occurred_at: 2026-09-07T13:17:59.328Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2c41c9b0.moved
    from: "51"
    to: "39"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_208fbb19
kind: update
occurred_at: 2026-09-07T13:17:59.353Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5fa993af.moved
    from: "52"
    to: "49"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4f59cb23
kind: update
occurred_at: 2026-09-07T13:18:17.682Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2a3ecbfa
kind: update
occurred_at: 2026-09-07T13:24:17.170Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bef33999.text
    from: "Decide whether every card carries the second footer row or only cards with something in it: two pinned heights stay two, or become four"
    to: The second footer row appears only when the ticket has a value for an enabled property that sits in it — one line, never wrapping, presence derived from row data and never from the rung, giving exactly four pinned heights
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cb8ac7e2
kind: update
occurred_at: 2026-09-07T13:24:31.591Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dbf8c0e1
kind: update
occurred_at: 2026-09-07T13:40:42.006Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_945a1ca9.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_be536820
kind: update
occurred_at: 2026-09-07T14:24:52.409Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d7acf634.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
