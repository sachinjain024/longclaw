---
format: longclaw.ticket/v1
id: 57c3c15c-497f-4647-a6ea-641e6cc3d9f3
key: LC-227
title: Add Other Fields to Tickets like Due Date, Start Date, Est Effort, Type
status: in_progress
priority: urgent
labels:
  - release
type: feature
due: 2026-09-09
created_at: 2026-08-22T06:13:17.138Z
updated_at: 2026-09-09T06:38:54.212Z
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

Settled 2026-09-08. On disk a date is always `YYYY-MM-DD`. What a human types is
looser, and this is the grammar the app accepts.

**One rule generates all of it: the month is named, or the order is ISO.** A
date input's worst failure is not refusing something a person meant — they see
that and retype it — but silently storing a different day from the one they
meant. So the grammar refuses every form that needs a locale to resolve, and
accepts everything a named month makes unambiguous.

**Accepted**, case-insensitively, leading, trailing and repeated whitespace
ignored:

| Form | Example | Means |
|---|---|---|
| ISO | `2026-09-28` | that day |
| Day and named month, either order | `28 Sep`, `Sep 28`, `28 September` | the nearest future occurrence |
| The same, with a four-digit year | `28 Sep 2026`, `Sep 28, 2026` | that day |
| `today`, `tomorrow` | | resolved against the same injected `now` that proximity uses |

A named month is its three-letter abbreviation or its full name, may carry an
ordinal suffix (`28th Sep`), and may be separated by a space, a hyphen or a
slash — `28-Sep-2026` parses, because the named month is what makes the
separator safe.

**Refused**, each because resolving it would need something the app does not
have:

- **All-numeric forms that are not ISO** — `28/09/2026`, `09/28/2026`, `3/4`.
  This is the rule's whole reason. The app has no locale: there is no `Intl`
  call anywhere in `apps/desktop/src` and every age it prints is hand-formatted
  (`describeAge` in `acknowledgement.ts`), so nothing in it can say whether
  `3/4` is March or April, and a guess would be wrong for half the world
  silently.
- **Two-digit years** — `28 Sep 26`. Unambiguous on its own, and the habit that
  produces `9/28/26`.
- **A month with no day** — `Sep`.
- **Weekday names, `next week`, `in 3 days`.** Each asks the app to compute a
  date the person has not, which is a natural-language feature rather than a
  typing affordance, and each carries its own edge — a `Friday` typed on Friday.
  The picker is one click away. `today` and `tomorrow` are in because they are
  the two words a person types *instead* of thinking, not words that ask the app
  to think.
- **Anything carrying a time** — `28 Sep 5pm`, `2026-09-28T00:00:00Z`. A due
  date is a day; accepting a time only to drop it would store something other
  than what was typed.

**A form with no year means the nearest future occurrence, and today counts as
future.** `28 Sep` typed on 28 Sep is today, not next year — the literal reading
of "future" is the one boundary the rule has to state itself. Typed on 5 Oct
2026 it means 28 Sep **2027**, and that is the price: the past is reachable by
typing the year, and it is both the rarer direction and the riskier one, because
a date that silently lands in the past reads as an overdue ticket nobody
created.

**The rule is the same for `start` as for `due`**, and that is a deliberate
trade. Start dates are more often backward-looking, so forward-only costs
something there — but two adjacent controls in one rail where the same typed
string means two different days is worse than either rule applied to both.

**What is refused is not destroyed.** The field keeps the text the person typed
and reports that it did not resolve; the property is not written. That is the
same posture the format takes toward a malformed value on disk — degrade the
value, keep the bytes — and it is why this control is a Field in the
`CONTEXT.md` sense and not a picker with a text decoration.

**Parsing happens on commit — Enter or blur — not per keystroke**, because
`28 Se` is not a state worth reporting on. What the control shows *while* typing
was left to the prototype, and the answer is **an echo, not a verdict**: once
typed text resolves, a quiet line under the field says the day it resolved to in
full — `→ Tue 28 Sep 2027`. Nothing ever goes red mid-word. The echo earns its
place on the year rule alone: forward-only is invisible without it, and a date
that silently lands a year out is the exact failure the grammar was written to
prevent. It shows only while the field differs from what the file says, so a
field at rest is not wearing a second copy of its own value.

**Display is the input's mirror**, which settles something the app has never
done: nothing in it prints an absolute date today — no month name appears
anywhere in `apps/desktop/src`. A due date renders `28 Sep`, and `28 Sep 2027`
when the year is not the current one. Day-then-month is a choice rather than a
deduction, and it is consistent with an app that hardcodes its English
everywhere else.

**"Something the grammar accepts" was not enough, and the prototype found it.**
A form with no year means the nearest *future* occurrence, so a ticket due
5 Sep 2026 opened on 8 Sep 2026 renders `5 Sep` — which the grammar accepts and
reads back as **5 Sep 2027**. The field would be showing a string that does not
mean the day it is showing it for, and the first person to retype what is
already in front of them moves the date a year without being told. So a **field**
carries the year whenever the value would not round-trip without it: when it is
not in the current year, **or when it is in the past**. A **card** keeps the
short form, because nobody types into a card — which is the same split the chip
already makes below.

**The CLI takes the canonical form only** — `--due 2026-09-28`, and an error
naming the shape for anything else. ADR 0011 keeps the CLI from being a second
implementation, and a loose grammar in Rust beside the loose grammar in
TypeScript is exactly that: two parsers that will disagree about `28 Sep` in
some year nobody tests. The looseness is a typing affordance in the app; the
agent-facing surface writes the shape the file stores.

### The picker is the other way into the same control

Settled 2026-09-08, because the grammar above says "a picker" and a typing
affordance is only half a date control.

**One control, two ways in.** A date property is a Field with a calendar trigger
beside it. Typing and picking produce the same value through the same
normalisation — the picker is not a second writer, it is a second input to the
one the grammar already defines.

**It never opens on focus.** A popover that appears every time Tab passes
through would cover the panel and fight the field it is attached to. It opens
three ways: a click on the trigger, `Enter` on the trigger — the app's existing
rule for a meta trigger (`keyboard-focus-map.md:65`) — or `↓` from inside the
field, which is the combobox affordance and costs the single-line field nothing.

**It is the app's first two-dimensional popover, and that is the thing to
notice.** Every menu in the app is a list where `↑↓` cycles rows
(`keyboard-focus-map.md:136-142`); a month is a grid, so `↑↓` has to mean *week*
there. It therefore earns its own row in the keyboard map rather than being
filed under Menus:

| Key | Action |
|---|---|
| `←` `→` | A day |
| `↑` `↓` | A week |
| `PageUp` · `PageDown` | A month |
| `⇧PageUp` · `⇧PageDown` | A year |
| `Home` · `End` | The week's first and last day |
| `Enter` | Pick → write → close → focus returns to the field |
| `Esc` | Close, changing nothing → focus returns to the field |

`Enter` and `Esc` are deliberately the menu contract unchanged: pick applies and
returns focus, `Esc` walks one rung of the ladder. Only the movement keys are
new, because only the shape is.

**The picker is never the only path.** Everything it does, the field does by
typing — that is the a11y contract this app keeps failing in one direction
(`npm run check` fails a control without an explicit `tabIndex`, and the panel's
own controls were pointer-only until Step 17). A calendar that is the only way
to reach February is a bug, not a design.

**It opens on the month of the current value, or on today when there is none.**
Today is marked and the current value is selected — two different marks, because
a ticket due today has both on one cell.

**No rung treatment inside the grid.** Overdue, today and approaching are a
reading of a date against `now`, and a calendar is where every day is just a
day. Keeping the rungs to the surfaces that *display* a date stops the
vocabulary leaking into the one place a person is choosing rather than reading.

**The week starts Monday**, and that is derived rather than picked: the app has
no locale to ask, the canonical on-disk form is ISO 8601, and ISO 8601's week
starts on Monday. One convention already settled, used twice.

**Clearing is a first-class action, and it is not the same as never set.**
Emptying the field and committing removes the property, and the picker carries a
Clear row for the same act by pointer. On disk both absent and cleared are the
same thing — no key — so the distinction lives in the edit command, where absent
means *do not touch this* and cleared means *remove it*. That is the nullability
the TicketEdit row is about.

**No time, no ranges, no recurrence**, per the grammar and the out-of-scope list.

**And no cross-validation between `start` and `due` in v1.** A start after a due
date is nonsense, but refusing it means the second date you type is refused
because the first one is still what it was, and the format's posture everywhere
else is to record what the human said and degrade rather than destroy. The panel
may say the pair looks wrong; it does not decline to write it.

### Configuration lives in `longclaw.yaml`, beside labels

[ADR 0002](../../../docs/adr/0002-fixed-statuses-in-v0.md) reserved per-project
configuration for "that project's settings, **not** in `longclaw.yaml`". That
reservation is **deliberately deferred**, and
[ADR 0013](../../../docs/adr/0013-property-configuration-lives-in-longclaw-yaml.md)
records that rather than ignoring it, along with the three conditions that would
revisit it. Four reasons:

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

### Turning a property off does not ask first

Settled 2026-09-08. Disabling a property that tickets already carry writes
immediately and reports what it did. There is no confirmation dialog.

The precedent is already in the app, and it covers a stronger act than this one:
**removing a label definition** deletes something, and it takes no confirmation
either. It writes and reports, and the code says why the report is there — a
definition added, renamed, recoloured or removed "used to land in silence, which
on the remove is the difference between _gone_ and _did that work?_"
(`ProjectSettings.tsx`). The answer to silence was a message, not a dialog.
`RemoveProjectConfirm` is the app's only confirm of this shape, and what it
guards is taking a whole project out of the registry.

Disabling is weaker than the label case in three ways: no definition is deleted,
no ticket value is touched, and the same toggle puts it back — which is the undo,
and a better one than an undo affordance. A dialog over a reversible act that
destroys nothing is ceremony, and ceremony over the safe acts is what teaches
people to click through the dangerous one.

What it must not be is *silent*, because the effect is invisible: the dates
vanish from every card, and a person could reasonably conclude they were
deleted. So the write feedback carries the count and the reassurance together —

> Due turned off · 17 tickets keep their dates

— and the settings row goes on naming that count while the property is off,
which is then the only place the fact is visible. The count comes off the index,
which carries the four properties.

**Removing one value from a vocabulary is the label case exactly**, not a new
one: drop `spike` from `type.values` and the definition goes while every ticket
carrying `spike` keeps it, rendering as a bare slug in the fallback hue.

### A due date always shows, and its treatment escalates

Four rungs, settled 2026-09-08. The date itself is the weakest rung — visible,
but not engaging when it is a fortnight out — and both what the chip *says* and
how it is drawn sharpen as the date approaches:

| Rung | Boundary | What the chip says | Drawn |
|---|---|---|---|
| Overdue | `due` < today | `3d overdue` | `--lc-danger`, the one rung that takes a hue |
| Today | `due` = today | `Today` | Monochrome, emphasised |
| Approaching | today < `due` ≤ today + `attention_days` | `in 3d` | Monochrome, ordinary weight |
| Beyond | `due` > today + `attention_days` | `28 Sep` | Monochrome, quiet |

**Only one rung takes a colour, and that is the app's existing rule rather than
a new one.** `PriorityGlyph` is monochrome except Urgent, no chip is ever filled
and none takes the theme accent, because "a priority conveyed by shape and
colour alone is a priority half the people looking at the board cannot read".
Due is a second urgency axis on the same card; if priority earns a hue only at
its top rung, so does this. Every rung is legible with the colour removed,
because the words differ at every rung.

**Which hue is not a free choice — the other two are spoken for.** Agent green
belongs to agents and is deliberately absent from the label ramp. `--lc-warn` is
the unattributed external change (`styles.css:139-140`), and LC-148 was exactly
the bug of two vocabularies landing on one line. That leaves `--lc-danger`,
which today means an error or a destructive confirm — surfaces a card cannot
show — so on a card it will mean one thing.

**Comparisons are between local calendar days, never instants.** `due` is a day
and carries no timezone, so "today" is the reader's own day: a ticket due 28 Sep
becomes overdue in Tokyo before it does in California. That is correct for a
day-valued date rather than a defect, and it is the same reasoning that keeps
`due` out of RFC 3339.

`attention_days` defaults to **7**, and it is the only boundary that moves —
overdue and today are absolute. **`0` is legal** and empties the approaching
rung, leaving Today and Beyond; a negative value is refused.

**The rungs stand down on a ticket that is done, canceled or archived.** A
finished ticket that was due last week is not overdue, it is finished, and a
Done column drawn in `--lc-danger` teaches people to ignore the colour that was
supposed to mean something. The date still shows, plainly, in the Beyond
treatment. Status is row data, so this changes the treatment and never the card
height.

**The chip is not the date field, and it does not have to mirror the grammar.**
The field in the panel always shows the canonical display form — `28 Sep`,
`28 Sep 2027` — because a person types into it. Nobody types into a card, so the
chip is free to say the shortest true thing, and `in 3d` reuses the relative
vocabulary `describeAge` already speaks rather than inventing a second one.

**A rung is a reading, never a sort key.** Due ordering sorts by date; the rungs
have no part in it, which is what keeps the ordering mode from changing at
midnight along with the colours.

**Start never has a rung.** It is not a deadline — a start date in the past
means work should have begun, which is a judgement about the work rather than a
fact about the date, and the app does not make it.

**The card's due goes in the key row, not the footer.** Settled 2026-09-08 in
prototype review, replacing an earlier plan to grow the footer a second row for
it. The date sits in `.card-top` — the line that already carries the ticket key
and the priority glyph — and it shows **whenever the ticket has a due at all**,
at every rung.

The footer was the wrong place for a reason that is easy to state: it never
wraps and holds two chips, **one** when a checklist fraction is present
(`boardCard.ts:28-30`, `screen-specs.md:155-156`), so an always-visible date
there would cost a label slot on every ticket that has one. Growing a row to
avoid that worked, and cost 24px on every dated card. The key row costs nothing.

**`.card-top` is pinned at 16px whatever is in it**, so the date changes no
geometry: no new tokens, no third and fourth pinned height, no extra case for
`cardStrides()`, and `card-height-guard.mjs` keeps the two invariants it has.
The date is text — 14px of line in a 16px row — which is the whole of why it
fits; a *chip* there would not, and that is why Type stays out of this row.

That matters more than it sounds. `boardGeometry.ts` pins card heights exactly
because the board is virtualised — *"a column that guesses a card's height
jitters as it scrolls"* — and it states flatly that there is no third height. A
due date that never touches the height is a due date that never has to argue
with that.

**Presence stays pure row data**: "has a due, and the property is enabled", a
boolean off `IndexedTicket` plus the project's configuration. An earlier version
showed only the escalated rungs and hid the plain date, which was cheap — the
row is a fixed height, so a *rung*-derived presence would have been safe there
in a way it never is one row down. It was dropped anyway: it made presence one
more thing to have to know, and it left "where is that date I set" unanswerable
without opening the ticket. The rung decides the **word** and the **weight**,
both of which may change at midnight because neither moves an offset.

**It is right-aligned in that row**, settled in review: the date crosses the row
and stands immediately left of the priority glyph, so the two urgency marks read
as one object at the far edge and the key keeps the left edge to itself. The
alternative — the date sitting immediately after the key — was drawn and
refused.

The auto margin has to *move* rather than be added. `.card-top` puts
`margin-left: auto` on the priority glyph; a second auto on the date splits the
free space and parks the date mid-row, which is neither alignment. So the date
takes the auto and the glyph gives it back — **but only on a card that has a
date**. Handing it over unconditionally leaves the glyph with no auto margin and
nothing else holding the right edge, so on a ticket with no due the priority
glyph walks back up the row and sits against the key, 200px off the line its
neighbours' sit on. The rule is `:has(.due-chip)`, and it is the kind of defect
that ships because almost every fixture ticket has a date.

### The second footer row is estimate and type

With due gone from it, the row exists only for the two properties that are not
dates, and **a project that enables neither never grows a card**. It keeps the
rules it was given:

- **it is one line and never wraps**, the same rule the first footer already
  carries, so however many values land in it the card has exactly four pinned
  heights — plain and acknowledged, each with and without the row;
- **presence is derived from row data and never from the rung** — here that is
  "has a value for an enabled second-row property", and it changes only when the
  file does.

`cardStrides()` and `card-height-guard.mjs` go from two cases to four when
either property is on, because the acknowledged variant multiplies with the new
one — a second boolean rather than a new mechanism, since `cardStrides` already
picks a stride per ticket. Measured in WebKit: 108 · 132 · 136 · 160.

Two runs answer to this beyond the usual gate: `probe:drag`, because a drop is
arithmetic over these offsets (`gapAt`) and a new height moves where a dragged
ticket lands, and `perf:board`, because the whole scroll cost is nodes.

Start date never competes for either row: it is a panel-only property.

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

## The prototype

[`docs/ux/prototypes/LC-227-Ticket-Properties.html`](../../../docs/ux/prototypes/LC-227-Ticket-Properties.html)
— open it in a browser, no server and no build. Five scenes in the driver bar,
one question each, and every scene drives off one injected `today` that the
driver's `± day` moves.

It renders the app's own markup wearing `styles.css`; the CSS it proposes is in
`<style id="proposed">` and the harness's own in `<style id="harness">`, so a
review can tell which is which. Written to be **deleted** once this ticket is
reviewed, along with its line in the prototypes index.

### What it proposes

- **The panel splits on a container query, not a media query.** LC-238s makes
  the width a dragged, remembered number, so "is there room for a rail" is a
  question about that box and never about the window. At 660px — 560 plus the
  rail plus the gap — the rail appears; under it the properties fold back into
  the stacked meta grid exactly where they stand today. Source order is
  main-then-rail, so the fold is a no-op rather than a reorder.
- **A 232px rail, seven rows, name above control.** The one departure from the
  meta grid, and it is forced: 232px spending 84 on a label column leaves 148
  for a date field and its trigger, and no room at all for the estimate scale.
  Labels last, because it is the only row that grows. Start above Due —
  chronological, adjacent, and the pair the forward-only rule is a trade for.
- **The date field is one control with two ways in.** A Field with the calendar
  joined to its right edge, the trigger not a tab stop (`↓` from the field is
  its keyboard path), and a refusal that keeps the text and says which rule it
  broke — a different sentence per refusal, because each has a different next
  move.
- **The picker is right-aligned on the field and lifted into view.**
  `popover.ts` already answers both: `belowAnchor(anchor, width)` right-aligns
  for "a trigger at the window's far edge", which is precisely a date field in a
  right-hand rail, and `liftIntoView` is what stops the tallest popover the app
  will have — 253px of grid — losing its Clear row off the bottom.
- **The card's due is in the key row, right-aligned**, immediately left of the
  priority glyph so the two urgency marks read as one object at the far edge and
  the key keeps the left edge to itself. It costs no height. The second footer
  row is estimate and type, above the label footer, in the first footer's own
  grammar: mono values first, chips after — **+24px**, four pinned heights
  (108 · 132 · 136 · 160), and only in a project that enables one of the two.
- **The estimate scale is the appearance row's segment** with a leading `—`,
  because absent is a value a scale must be able to say and the dash is the
  app's existing word for it (`priority: none` draws that glyph already).
- **Settings gets one Properties pane after Labels**, four blocks, the
  checklist's own checkbox on a third selector, and the type-values editor is
  `.label-row` unchanged.
- **The right-click menu gains all four properties**, below `Priority` and above
  the archive rule — see below.

### The context menu takes all four, and never grows a calendar

Settled 2026-09-08 in review. `ticketMenu.tsx` offers `Move to` and `Priority`
as submenus off `metaOptions.tsx`, so "the values a card can be moved to are the
values the panel offers, always". Type, Start, Due and Estimate join them.

The menu's own rule is that it holds *"only actions the app already has,
reachable from somewhere else, so the menu is a shortcut rather than a second
place where things are decided"*. Four rules keep the dates inside it:

- **A row exists only for a property the project has enabled.** Properties ship
  all off, so a default project's menu is exactly today's five rows. A project
  that turns everything on gets nine. This is what makes four more rows
  affordable at all.
- **The menu never contains a calendar.** The date rows are quick picks —
  `Today`, `Tomorrow`, `Next Monday`, `In a week` — and each says the day it
  resolves to in its `.menu-hint`. Nothing is computed silently, which is the
  whole of the objection the typed grammar raises against `next week`: refusing
  to *parse* a computed phrase and offering it as a row a person points at are
  different acts, and only the first one guesses.
- **`Pick a date…` is the way out**, and it hands the job to the panel's real
  control. Anything the four rows cannot reach is reached where the Field and
  the picker already live.
- **Every submenu carries `Clear`.** Clearing is first-class everywhere else
  this ticket touches, and a submenu that can only ever *set* a property is a
  one-way door.

**`due` and `start` offer the same rows**, which is the grammar section's own
trade one surface over: two adjacent controls whose vocabulary differs is worse
than one vocabulary applied to both. **Estimate offers the project's scale** —
the enum under t-shirt, the sequence under Fibonacci, and a common-durations
list (`30m` `1h` `2h` `4h` `1d` `2d` `1w`) under duration.

One gap the prototype surfaced and did not fill: every other row's glyph is its
current value's mark — a status dot, a priority glyph, a type dot — and
**estimate has no mark to draw**. Its slot is empty, which the 14px `.menu-glyph`
box keeps aligned, but it is the one row in the menu that says nothing before
you read it.

### The panel's width is LC-238s's, and this ticket sets its floor

Settled 2026-09-08: the panel gets a drag handle, opens at the width it was last
left at, and **remembers that width across projects** — device-level, beside
`appearance` in `devicePreferences.ts`, which is the placement
[LC-238s](../LC-238s/ticket.md) already recommends and not `localStorage`
(ADR 0012). The default goes up from 560.

This ticket does not pick the number, but it removes the freedom to pick it
freely: **under 660px there is no rail**, because the split is a container query
on the panel, so a default below that ships this feature switched off. **800 is
the recommendation** — the main column measures 507px there, one pixel under
what a 560px panel gives the description today, so the rail costs the reader
nothing. At 720 it is 427px, a ~70ch measure that reads fine and is a real
reduction.

Two consequences for LC-238s. The **minimum a person may drag to** stops being a
comfort limit and becomes a decision: drag under 660 and the rail folds into the
stacked meta grid, which is either the graceful degradation the container query
was chosen for or a trap, and the ticket should say which. And LC-238s already
clamps a width restored against a monitor that is no longer attached — the new
part is that a clamp landing under 660 takes the rail with it, silently.

### What the prototype changed about the settled spec

- **A field's display has to round-trip; a card's does not.** Recorded above
  under the grammar. This was a real defect in the settled wording, and it only
  showed up once a panel was opened on an overdue ticket.
- **The echo answers the open "what does it show while typing" question.**
  Also recorded above.
- **The due moved from the footer to the key row**, and the second footer row
  lost its only universal occupant with it.
- **The right-click menu was missing from the plan entirely**, and now carries
  all four properties.

## Built 2026-09-08: the format layer

The four properties are on disk, through the CLI, and on the index rows. No UI
yet — that is deliberate, because none of it depends on the two questions still
open in the review below.

**The reader validates nothing about these four, and the writers validate
everything.** A stored value is handed back exactly as the file spells it: an
estimate written under another system, a type slug nothing defines, a date in a
shape the format does not store. That is invariant 16, and it is also the rule
`is_label_slug` already states one registry over — a slug an agent wrote is
preserved and rendered as itself, and only *new* definitions are held to the
grammar. Parsing at read time would be the place that stopped being true, and
the corpus case `valid-ticket-properties-uninterpretable` is what holds it.

**A property key this build knows is never an unknown key.** Invariant 11 covers
a key the build cannot interpret; invariant 16 covers a key it knows and a value
this configuration cannot read. Conflating them would report the wrong thing
about both, so `KNOWN_KEYS` carries all four and the two cases are separate
fixtures.

**`estimate: 5` does not cost a ticket.** It is a YAML integer where the format
asks for a string, and `Option<String>` would refuse it and take the whole file
down over a missing pair of quotes. The four are read through a scalar reader
that takes whatever type YAML resolved and keeps the text.

Three things the format doc did not say, decided here and written into it in
place:

- **An estimate system that is absent is `tshirt`** — the one system whose
  vocabulary is already in the file, so a bare `enabled: true` is usable rather
  than a project that will not open over a missing key.
- **`estimate.values` is an ordered sequence, not a mapping.** A scale has an
  order, and `xs s m l xl` keyed by slug comes back `l m s xl xs`.
  `type.values` stays a mapping precisely because types have no order to lose.
- **The conversion is a float**, so a 7.5-hour day is expressible. `Project` and
  `ProjectReference` gave up their `Eq` derive for it, which nothing wanted.

**Where the keys land in the file**: after `labels` and `rank`, before
`created_at`, in the documented order however many of them a ticket carries.
Each property names the ones before it as its anchors, so the order does not
depend on which of them a given edit happened to set first.

**`ProjectReference` carries the property configuration**, for the reason it
already carries `labels`: a surface holding one has to know which properties
exist and what their values mean before it can draw anything.

**The timeline has a sentence for each of the four.** Not scope creep — the
repository's own tripwire: `json_contract_applied_field_changes` pins every
field `apply` can write into `ipc-contract.json`, and `timelineEvents.test.ts`
asserts every pinned field has a sentence, so adding four fields to `apply`
turns the frontend suite red until they do. A date reaches that line **verbatim
and unformatted**, because the same line has to carry a date in a shape the
format does not store, and prettying that one up would claim the file holds
something it does not.

### The gap this opened

**The app's own create and edit do not yet refuse a disabled property or an
undefined value.** The CLI does — it holds the `ProjectDocument`, so it can ask
— and `TicketDocument::apply_as` deliberately cannot: it knows the format's
rules and nothing about the project. Today nothing sends those fields over IPC,
so nothing is wrong; the moment the panel does, `engine.rs` needs the check the
CLI already makes. It is a checklist row rather than a sentence here.

### What is still open for the review

- **The estimate control in the rail: segment or menu.** The segment shows the
  whole scale at rest and takes one click; the menu is what the rail's other six
  rows already are, and survives a rail narrower than seven segments. Both are
  in the driver.
- **Whether the overdue chip is bare mono text or takes a soft danger wash.**
  The prototype defaults to text — a filled chip on a card is a thing the app
  has never had — and draws the alternative behind a switch.

### Refused in review

- **A colour for Today.** Tried in `--lc-danger` and dropped: sharing overdue's
  hue read as a second overdue at a glance, and the distinction fell entirely to
  words set at 11px. A third colour was never available — agent green belongs to
  agents, `--lc-warn` is the unattributed external change, and LC-148 was the bug
  of those two colliding. Today stays monochrome and emphasised, and the
  visibility it needed came from the key row instead.
- **Showing only the escalated rungs on the card.** Cheaper, and it made
  presence a reading of the rung — safe in a fixed-height row, still one more
  thing to know, and it left "where is that date I set" unanswerable without
  opening the ticket.
- **Type in the key row.** Type is a chip, the smallest chip is 19px and
  `.card-top` is pinned at 16, so every card in every project would grow 4px
  whether or not Type was enabled. The due survives that row only because it is
  text.

### Verified in WebKit rather than asserted

A throwaway pass in the engine the app ships on measured what jsdom cannot,
and found four defects that were green everywhere else: the container query
losing to a later rule of equal specificity, so the rail rendered with a 115px
value cell; the estimate segment as `inline-flex` handing its children `flex: 1`
of nothing, rendering `XS` as `X`; the picker hanging off two edges of a 1440px
window; and the settings checkbox's tick drawn as a chevron because the two
gradients were written from memory as `45deg`/`-45deg` rather than the sheet's
`45deg`/`135deg`.

WebKit now agrees with all four pinned card heights, no rail row overflows its
cell at 560 · 720 · 800 · 880, and moving `today` thirty days moves no card
height — which is the invariant the second footer row exists inside.

## Built 2026-09-08: the settings Properties pane

The pane is in, and with it the write path the whole feature needed: nothing
could configure a property before this, so the four blocks are the first thing
in the app that can turn one on.

**The type-values editor is the labels editor, and now it is literally that
row.** `LabelDefinition` gained one prop — the noun its controls call
themselves — and both registries draw the same component. So does the add-row:
it is `useLabelDefinition` over `type.values`, so a typed name derives the slug
here exactly as it does one section up, and nobody authors a key by hand in
either (LC-236e). The prototype sketched a separate slug field; that predates
LC-236e, and following it would have put the two surfaces back into the
disagreement that ticket exists to end.

**Turning a property off writes and says what it kept.** One sentence — `Due
date turned off · 17 tickets keep their dates` — and the row goes on carrying it
while the property is off. Both come from `PROPERTY_LABELS`, because the toast
and the row are the same reassurance said twice and two spellings of one sentence
is how they come to disagree. The count is off the index rows rather than the
project file, which is what makes it available at all while the property is
disabled.

### The YAML writer had to learn depth

`labels` → `storage` → `name` is three levels and `set_nested_scalar` handled
exactly three. `properties` → `type` → `values` → `bug` → `name` is five, so
`Mapping` gained a recursive path writer — `set_path_scalar`, `set_path_bool`,
`set_path_number`, `set_path_sequence`, `remove_path` — and the old two-level
pair is gone, reimplemented as calls into it. Every existing labels test passes
unchanged against the new one, which is what makes it a generalisation rather
than a second writer.

Three things it has to get right that the old one never had to:

- **A boolean is not a scalar string.** `encode_scalar` quotes `true` into the
  string `"true"` on purpose, so that a label *named* `true` round-trips. An
  `enabled` flag is the other case, and routing it through the scalar path would
  write a configuration this build then reads as off.
- **A flow-style child has to be expanded before an edit can reach inside it.**
  The format contract writes a type value as `bug: { name: Bug, color: red }`,
  and appending a field line under a mapping that is already closed is not YAML
  at all — it corrupts the file. Descending into one now re-renders it in block
  style first, every value keeping the type it had, and nothing else in the file
  is touched. The same latent defect was in the labels writer, unreachable only
  because the app has never written a label in flow style.
- **A new field lands with the fields**, not below a trailing comment that
  belongs to the field above it. The old writer had that property; the recursive
  one keeps it by carrying the trailing comments along as it appends.

### Verified in WebKit rather than asserted

The pane's real markup wearing `styles.css`, measured at 1440 · 1180 · 1024 ·
980 · 760 — 760 being the smallest window `tauri.conf.json` allows:

- the estimate segment is 248px and gives ground rather than overflowing, and no
  segment button clips its word at any width;
- the checkbox's tick is the sheet's own two gradients, because
  `.property-head input` joined the existing selector list rather than restating
  the rule — writing those from memory is what drew a chevron in the prototype;
- both `.property-inline` sentences are one line to 1180 and wrap below it,
  stranding nothing;
- and `.label-row` overflows the section by 51px at 760. **That is
  pre-existing** — the Labels pane does it today, measured as the control in the
  same run — and it is [LC-247u](../LC-247u/ticket.md). What this pane added was
  the 23px of `.property-config` indent on top of it, so the indent is dropped
  under 980px and the pane is now exactly as wide as the editor it copies.

### Three departures, all deliberate and none of them silent

- **The t-shirt scale is editable here**, which the prototype asserted in a note
  and did not build. "Enabling a property is where its values get configured"
  and "a t-shirt or type enum can be rewritten" are settled above, and a note
  claiming editability with no editor under it is a claim the pane cannot keep.
  It is a list rather than chips because the order *is* the scale, and every row
  can move for the same reason: an editor that could add and remove but not
  reorder edits everything about a scale except the part that makes it one. It
  is **not** "an editable enum like Type's" in the other two respects, and
  cannot be — `estimate.values` is a sequence of slugs, so there is no name and
  no colour on disk to edit.
- **The system picker is `.appearance-segment`**, the panel's own segment,
  rather than the rail's `.scale-segment`. They are the same control and this is
  the one that sets words rather than codes: it is the appearance row two panes
  up.
- **The toast says `Due date turned off`, not `Due turned off`.** The settled
  wording above quotes the latter; the prototype titles the block `Due date`,
  and a toast that named the control differently from the control would be two
  names for one act. The block title wins and the spec line above is the one
  that gives.

### What the review of this commit changed

Four defects in the new path writer, every one of them found by *probing* it
rather than by reading it — which is the argument for doing that at all:

- **A top-level key in flow style lost every child but the one being written.**
  `properties: { type: { enabled: true } }` plus a write to `due` rendered a
  `properties:` block holding only `due`. Expansion was applied to children and
  not to the top-level block it started from. Pre-existing in the two-level
  writer this replaced, and fixed here because the machinery for it was already
  in the file.
- **A comment after a flow child was dropped** by the expansion that rewrote the
  line above it. The expansion now rewrites the header and carries every byte
  after it across untouched.
- **A flow key needing quotes corrupted the file.** `bug: { "a: b": 1 }` came
  back as `a: b: 1`, which the subset check passes — it splits on the first
  colon — and `serde_yaml` refuses. Keys are encoded now, not written through.
- **A quoted child key wrote a duplicate.** `"bug":` and `bug:` were two keys to
  the matcher and one to the reader, so the write appended a second `bug:`
  beside the first and the file only failed on the way back in. Children are
  matched by the key they mean.

Three findings on the spec axis, all taken:

- **`1 ticket keeps its types`.** The reassurance is built by concatenation and
  the noun was plural-only. `PROPERTY_LABELS` carries both numbers now.
- **The seed acted as a reset.** It fired whenever the vocabulary was empty, so
  a project that deleted all five type values got them back on the next toggle —
  the opposite of what its own doc comment promised. An empty vocabulary and an
  absent one read the same off the parsed value, so the question is asked of the
  file instead (`Mapping::has_path`).
- **An invented ceiling on `attention_days`.** 365, refusing a write for a rule
  nothing wrote down. The format is exhaustive here — zero is legal, negatives
  are refused, and the unsigned type is the whole of the second half — so the
  ceiling is gone. The conversion's bounds stay: `hours_per_day: 0` makes every
  duration sort as nothing, which is a wrong answer rather than a silly one.

The Standards axis did not run — its agent stopped on an account spend limit
before reporting. Its probes are what found the four writer defects above.

### What this leaves open

`engine.rs` still does not refuse a disabled property or an undefined value on
the app's own create and edit (`ck_97b51001`), and `.longclaw/AGENTS.md` still
documents all four rather than the enabled set (`ck_e017a189`). Both are
reachable from the UI for the first time now, so they have stopped being
theoretical.

## Built 2026-09-08: the two the settings pane made real

The pane above closed with those two open, and this closes them. Both existed
because the pane did not: a property nobody could turn on was a property nobody
could write wrongly.

### One refusal, not one per surface

`TicketDocument::apply_as` holds a property value to the format's own rule and
deliberately no further. It is handed a file, so the questions it *cannot*
answer are the project's: whether this project reads the property at all, and
whether the value is in the vocabulary it configures. Those belong to whoever
holds the project — and the CLI held them while the app did not, which left the
desktop able to write a `type` no project defines. An undefined slug renders as
its own text, with no name and no colour, which is the state the CLI's
`known_labels` refusal exists to keep out of files LongClaw writes.

`PropertiesConfig` answers both halves now: `require_enabled` for the property,
`accept` for the value, with `accept_new` and `accept_edit` walking a create and
an edit. `cli.rs` lost its two copies and asks these; `engine.rs` asks them
before it prepares a write, so a refusal lands before any bytes are placed and
before a create claims a directory. The CLI's 23 tests passed untouched, which
is the evidence that this moved a rule rather than changing one.

`TicketEdit::properties` is now the one spelling of the four, because there are
two walks over them — the one that applies and the one that checks — and a fifth
property added to one and not the other would be a property the app writes
without ever checking.

**A clear is refused as firmly as a set**, on a disabled property. That is the
one thing "disabling hides, it never deletes" rules out: the value is being
hidden and the ticket still holds it, so a Clear row that reached it would
delete what the switch promised to keep.

Verified red first. With the two `engine.rs` lines removed, the new integration
test fails at the line where the app writes `type: epic` into a project that
defines only `bug`.

Every rail control is gated on `enabled`, so the app's own surfaces do not reach
this refusal — it is a backstop, which is what the row asked for. One path does
reach it: the panel's undo carries `inverse: { [property]: previous ?? null }`,
so a property disabled between a write and its undo makes the undo refuse rather
than restore. That is the right answer — restoring a value into a property the
project has stopped reading would write what the switch promised to keep hidden
— but it surfaces as a refused write, and it is the one case where a person can
see this check without an agent involved.

### The contract offers what the project turned on

`.longclaw/AGENTS.md` listed `title`, `status`, `priority` and `labels` and said
nothing about the four. It now carries a row per **enabled** property, in the
documented order, between `labels` and the description — and nothing at all when
a project enables none, which is every project file written before this build
and keeps their contract the file it has always been.

Each rule is the vocabulary itself rather than a pointer to it: `one of bug,
feature`, not "the slugs defined in longclaw.yaml". An agent reading this file
is about to write a value, and a pointer is another file to open. The estimate
row is `EstimateConfig::vocabulary()` — the same sentence the refusal uses — so
the contract cannot promise a scale the write then rejects.

One thing a table of rows cannot say is what an *unlisted* property means, and
silence there reads as permission. So an enabled set is followed by the sentence
that an unlisted property is one this project does not read, and a value found
under it is being hidden rather than deleted. A project with none enabled says
nothing, because there is no set to contrast with.

A t-shirt project that arrived there by switching systems has no scale, and the
contract says so — `this project's t-shirt scale, which defines no values yet` —
rather than inventing five sizes. That was a test expectation of mine that was
wrong before the code was: switching systems seeds nothing, deliberately,
because it keeps every value written under the old one.

### Checked against LC-66, which is still open

The row asked for the check and the check has an answer worth writing down.

The rows added here are derived from the project file, so two renders of one
project produce the same rows — pinned by a test, so this is not a second source
of churn. The file *around* them is another matter. `example_ticket` mints a
fresh `id`, `ck_` and `evt_` on every render, and `registry.rs`'s
`update_project_file` reprints the whole contract after every project write —
which is every one of the pane's eight writes. So ticking **Types on** now
produces a real diff (three new table rows) delivered alongside three
meaningless ones, and the repo's own test suite already carries a
`without_minted_ids` helper to compare contracts in spite of it.

That is LC-66 exactly, and it was filed at p4 when a theme change was the only
way to trigger it. The settings pane makes it fire on every property toggle, and
the diffs it now buries are the ones that say which fields an agent may write.
Left on LC-66 with the evidence rather than fixed here: its checklist asks for a
byte-identical rewrite, which means deterministic ids through a render chain the
app's real create path shares, and that is its own change.

`docs/file_format.md`'s `AGENTS.md` section already asked the contract to
explain "which fields agents may change"; that line now says "including the
ticket properties the project has enabled and no others", replaced in place so
no citation moved.

## Built 2026-09-09: the two create surfaces

`ck_15448aa4`. Both create surfaces now offer whichever of the four the project
turned on, and a project that has turned none on — every project that predates
this build — gets the two surfaces it has always had, down to the row quick
create does not draw.

### One switch, three surfaces

The panel's rail had the four written out as four gated rows. Copying that into
full create and quick create would have made three places that each decide what
a type is edited with, so it moved into `PropertyControl.tsx` instead: one
component, one switch, and the caller supplies only the box a named control goes
in — a rail row labels above, a meta grid labels beside, quick create labels
above again. The rail is now a map over `enabledPropertyFields`, and its four
rows read the same as before.

Two things that had to be named once rather than three times came out of it.
`PROPERTY_FIELDS` is the order a surface draws them in — type, estimate, start,
due — which is deliberately **not** the order the format writes them: `type due
start estimate` is right for bytes and wrong for a person, because it separates
the two dates and puts Due above Start. And `PROPERTY_LABELS` gained a `field`
name beside its `name`: settings lists the four with nothing around them and
`Due date` says which kind of thing it is, while a rail or a create surface puts
Start and Due next to each other, where the word `date` on both is noise.
`typeOptions` moved to `metaOptions.tsx`, beside the status and priority
vocabularies it belongs with — four surfaces offer it now, counting the context
menu still to come.

### Where each surface puts them, and why they differ

**Full create** takes them into the meta grid, between Priority and Labels,
which is the rail's order exactly: the surface a ticket is filed on and the
surface it is edited on read the same way down. Labels stay last for the reason
they are last in the rail — the only row that grows.

**Quick create** puts them on a row of their own under the meta line, so Labels
does not move. The ticket settled nothing about this surface and the prototype
had no scene for it, so the call is recorded here: the properties are in, on the
argument LC-186 already won for priority. A project that turned a property on
has said its tickets carry it; a create surface that cannot say so files a board
of tickets all missing the same thing and leaves a second pass to fix them, and
quick create is the surface most tickets are filed through and the only one with
a bulk loop. What it costs is paid only by a project that asked for it.

The properties row is the one part of either modal that **names its controls**,
and that is not decoration. The meta line above it is three bare triggers
learned by position (D-49); this row's length and order are configuration, so
nothing about it can be learned that way — and an unlabelled type beside an
unlabelled priority is two controls both reading `None`. Names above controls,
which is the rail's own arrangement wherever it has no label column either.

Across the **Create more** loop the properties are kept, like status, priority
and labels: eight bugs due Friday is LC-201's complaint in a project that turned
dates on. Nothing is hidden while it is kept — each control is on screen wearing
what the next create will send.

### Three things that would have gone missing quietly

**`⌘↵` from inside an uncommitted field.** A date parses on Enter or blur, never
per keystroke, so `⌘↵` typed straight from the due field would have created the
ticket without the date that was on screen — the surface's own commit gesture
dropping what it was meant to keep. `DateField` and the duration control now
take the first `⌘↵` when they hold something uncommitted and let the second
through. With nothing to commit it passes straight on, which is every press in
the panel, where the binding belongs to no one.

**The door.** `TicketDraft` grew the properties, because "everything past these
lives over there" is only honest if getting there costs nothing, and a property
is not the field it may start going missing at.

**The optimistic card.** `provisionalTicket` carries them now. Not decoration: a
card's height is derived from its row data and estimate and type are the second
footer row, so a card filed with an estimate would have drawn 24px short and
every card under it in the column would have moved the moment the write landed.

### What this leaves open

The two surfaces have not been looked at in WebKit — `probe:header`, `a11y:audit`
and the focus-map row are still unchecked, and the quick create modal's property
row is the first wrapping row it has ever had. `screen-specs.md` and
`keyboard-focus-map.md` were corrected in place for what this change makes false
about them (the quick create field list, its Tab order, and full create's meta
grid); the rest of the doc row still stands. Re-pinning the three edited lines
also dropped a stale lock entry for `keyboard-focus-map.md:130`, a line nothing
has cited for some time.

## Built 2026-09-09: `⌘Z` in the rail, and the map that describes it

`ck_43674ebd`, `ck_33780452`, `ck_8c1b2d21`, `ck_e4ce4244`. The rail has been on
screen since the panel commit; what was missing was the half of it that only
shows up from the keyboard.

### The offer that was on screen and unreachable

`saveProperty` has sent an `inverse` since the rail landed, and the toast's
**Undo** button has worked since then — `the properties rail` has a test that
clicks it. `⌘Z` did not. Rule 2 of the focus map gives the key to the OS
"wherever a field has an edit of its own to give back", and `fieldUndo.ts`
decides that by asking whether the box still holds what the last keystroke left
in it. A date field commits on `Enter` **without moving the caret**, and on the
ordinary path without changing the text either: `28 Sep` typed on 8 September is
still `28 Sep` after the write. So the field kept its claim, and the toast's
`Undo ⌘Z` was an offer on screen that the key could not reach.

That is LC-220 with the surfaces swapped. LC-220 was a field with nothing to
give back holding the key; this is a field whose edit has already been spent.

The fix is one export. `fieldCommitted()` drops the record, and the two controls
that write without moving the caret — the date field and the duration's number —
call it exactly where they call `onCommit`, never on the keystroke: a refused
date and a number this system cannot read leave text nobody has stored, and that
is still the person's to take back. Only one of the four never had the problem:
`type` is a menu, and `textFieldAt` has always said no to a button. Both dates
had it always, and `estimate` had it under `duration` and not under a scale,
which is the same property answering differently in two of its three shapes.

Two things worth saying about the shape:

- **It is told, not measured.** Every other way a record ends is visible to the
  tracker — the caret leaves, or the value changes underneath it. This one
  changes nothing in the DOM, so the field has to say it.
- **The create surfaces pay for it too**, and should. There the same commit
  hands `⌘Z` to whatever toast is up, which after **Create more** is the
  previous create's. That is the documented pairing (`keyboard-focus-map.md:30`)
  and the alternative is worse and silent: the field's own undo would put the
  old text back over a draft that still holds the parsed date.

Six claims, and they are not all red-first, which is worth saying plainly.
**Three name the defect and were confirmed failing first**: the date field hands
the key back after a write, the duration's number does the same, and the round
trip in `TicketPanel.test.tsx` — type a Start date, `Enter`, `⌘Z`, and the
inverse edit reaches the disk — which was re-run against `HEAD` with the two
`write` helpers stashed to be sure. The unit case in `fieldUndo.test.ts` could
not compile before the export, so it is red in the only sense open to it. **The
remaining two pass on both sides of the fix by design**: a refused date and a
number this system cannot read keep the key, because nothing was written, and
they are there so that a later hand cannot move `fieldCommitted()` onto the
keystroke without the suite noticing.

The round trip fires `input` rather than `change` deliberately: the tracker
watches the event typing actually fires, and a test that skipped it would have
passed with or without the fix.

### What the map now says

`keyboard-focus-map.md` learned three things, and one of them cost the other
two their line numbers.

Line 62 was replaced in place — the panel's natural Tab order now names the
opt-in properties between priority and labels. The picker needed more room than
a line: `## Property controls` and `## The date picker` are new sections before
the focus-return table, which also gained a row for where the picker returns
focus. The picker is the app's first two-dimensional layer and that is the whole
reason it could not be folded into § Menus: up and down mean a **week** here,
where every other popover in the app means a row.

Thirty-five inserted lines move everything below them, so fourteen citations
across eight files were re-pointed by hand before `citations:update` ran — and **only in the
trees the guard scans**, plus `docs/plans/active` and `docs/backlog`. Not
`.longclaw/tickets/`, not `docs/plans/completed/`, not `docs/cc_screens_diff.md`:
those are outside `SOURCES`, and spot-checking them showed they had drifted long
ago. Plan 20 cites `158-161` for the "no drag-and-drop keyboard equivalent"
bullet it quotes, and 158-161 was the focus-return table's heading and rule
before this change ever touched the file. Re-pointing a historical record from
one wrong line to a different wrong line is not maintenance. The lock moved
exactly seven lines and one line's text, which is the whole of the change.

### The two runs, and the one thing they cannot see

`tab-order-guard` is clean over 94 files, which is `ck_33780452` — every button
in the new controls states its place, including the picker's 42 cells, where
`tabIndex={here ? 0 : -1}` is the roving form the board's columns already use.

`npm run a11y:audit` passes Part A, 56 checks over A1–A5, and it exercised the
re-pointed oracles on the way past. `npm run probe:header` is 140/140 at every
width, which is the row's own reason for existing: the rail widens the panel.

**Neither of them can see the rail.** `perf/fixture.ts` gives its project
`NO_PROPERTIES`, so "the panel's Tab order runs down the page in reading order"
counted fourteen stops and not one of them was a property. Turning a property on
there is not a small change: one fixture backs both traces and all four probes,
and an `estimate` or a `type` on a card moves the pinned heights that
`drag-probe` and `card-height-guard` are built on. So the audit's coverage of
this rail is nil, and that is recorded here rather than implied by a green run.

### What this leaves open

- The audit gap above. It belongs with whoever gives the fixture a second
  project, not with a row that says "run the audit".
- The inverse that cannot be carried: disable a property between a write and its
  Undo and `engine.rs` refuses the inverse, which is invariant 16 doing its job
  at the wrong moment. Found during the create-surface commit, unchanged here.

## Built 2026-09-09: the context menu takes all four

`ck_a77f4bb8`, `ck_fcf48239`, `ck_d3ec1253`, `ck_c06f6e05`. Right-clicking a
ticket now offers every property the project has turned on — on the board and on
the list, off one row builder, because two lists built in two places are two
lists that drift.

### Nine rows, or five

The rule that made four more rows affordable is the one asserted first: a row
exists only for a property the project enabled. Properties ship all off, so a
default project's menu is byte-for-byte the five rows it has always had, and
that is a test on both surfaces rather than a claim. A project with everything
on gets nine.

`enabledPropertyFields` decides the order, and this is where it diverges from
the prototype. The prototype drew `Type · Start date · Due date · Estimate`;
this draws `Type · Estimate · Start · Due`, which is what the panel's rail, full
create and quick create already read. That helper exists precisely to stop three
surfaces disagreeing about the order of the four, and a fourth surface with an
order of its own is the disagreement. The prototype's own adjacency argument
survives untouched: Start still sits directly above Due, which is the pairing
the forward-only grammar is a trade for. Recorded here because the prototype is
deleted once reviewed, and its order would otherwise read as the spec.

The row's label is `PROPERTY_LABELS[property].name` — `Due date`, not `Due`.
That is the settings row's word rather than a control's, and it is right here
for the same reason: the four are listed with nothing beside them, among
`Move to` and `Archive ticket`, where `Due` alone would not say what kind of
thing it is.

### The date rows, and the one that gives up

Four quick picks, each carrying the day it resolves to. `MenuList` refused to
draw a hint on a `choice` row, which turned out not to be a design decision at
all: the `choice` variant had no `hint` field, so `item.kind !== "choice"` was
narrowing the union, not stating a rule. The variant gained the field and the
gate came off. These picks are still the only choice rows in the app that carry
one.

`Pick a date…` is the row that decides nothing. It closes the menu, opens the
panel and puts the caret in that date's field, which is the whole of "hands the
job to the panel's real control" — a menu that opened the panel and left you to
Tab to the field would be a redirect rather than a hand-off.

That hand-off is a count, not a flag: the same row pressed twice is two
hand-offs, and the second has to move focus again though nothing else about the
ask has changed. It is forwarded down as `enter` — `App` → `TicketPanel` →
`PropertyControl` → `DateField`, which enters itself — rather than reached for
with a DOM query from the panel. The two do not arrive together: the panel is
asked for the ticket and the property in one gesture, and the field does not
exist until the read comes back. A field that focuses itself on mount handles
that for free; a query has to keep a nonce and retry.

`keyboard-focus-map.md:197` is amended in place for it, one line for one line.
The line was not pinned, so nothing was re-pointed and nothing shifted.

### Clear, where there is something to clear

Every property submenu carries `Clear` under a rule — and only when the property
holds something. A row that cannot do anything is worse than no row, because it
says the ticket holds a value. The prototype hardcoded `clearable: true` for
Type and gated the other three; this gates all four, which is the more
consistent reading of "a submenu that can only ever *set* a property is a
one-way door".

The type submenu is `typeOptions` minus its `None` row. `None` is the word the
rail and both create surfaces use, and `Clear` is the word every other submenu
here uses; the registry still owns the vocabulary and the dots.

### One sentence for two write paths

A pick from the menu goes through `mutate()` and a pick in the rail goes through
the panel's `save()` — two seams, as they are for status and priority. Both now
build their toast from `propertyToast` in `properties.ts`, so one act cannot be
described two ways depending on where it was asked for. `LC-1 Due → 2026-09-20`,
`LC-1 Type cleared`, and the inverse says the same of the value it puts back.
The value goes in verbatim: an inverse can carry a date this project's
configuration cannot read, and prettying that up would say the file holds
something it does not.

### The two reviews, and what they changed

Both axes independently found the same defect: `PropertyFocusRequest` and the
hand-off were typed over all four properties, while only the two dates offer the
row — and a request for `type`, whose control is a menu rather than a field,
would have found nothing to focus and quietly retried on every later render.
Narrowed to `"due" | "start"`, which is also what deleted the retry bookkeeping.

Standards' strongest finding was three cascades on one type: `propertyMark`,
`propertyHint` and `propertyValues` each asked *which property is this* and
answered a third of the question. They are now one `propertyFace`, which is the
bargain `PropertyControl.tsx` already strikes one surface over — the switch on
which property this is lives in one place per surface, so a fifth property is
one branch to write rather than three to find.

It also caught the context handing `today` the acknowledgement clock. The
arithmetic was right either way, since `datePicks` takes `startOfDay` of
whatever it is given, but the name was a lie about the argument. Both surfaces
now derive a day.

### The runs

`npm run verify` green, twice: once on the first cut and again after the review
fixes. 1312 frontend tests over 47 files, and every guard — `tab-order-guard` 94
files, `citation-guard` 500 citations, `card-height-guard` five invariants,
`glyph-drift-guard` 17 copies, `release-audit` 112 files.

Nineteen of those tests are new. Seventeen could not pass before this change;
two assert what the menu already did for a project with nothing enabled, and
they pass on both sides of it by design, which is the point of them. The
`Pick a date…` hand-off was confirmed red first on both implementations of it —
the DOM query it started as, and the forwarded count it ended as.

`npm run a11y:audit` passes Part A, 56 checks over A1–A5, including the focus
paths this touches. **It still cannot see any of these rows**: `perf/fixture.ts`
gives its project `NO_PROPERTIES`, so the audit drives a menu with five rows in
it. The blind spot is the one already recorded above and unchanged by this work.

`probe:drag`, `perf:board` and `perf:list` are not implicated. This change adds
no card geometry, no comparator, no lane and no selector — a menu is a popover
that is built when it opens.

### What this leaves open

- Nothing on a list *row* draws a property yet (`ck_6ac72ae5`), but the list now
  takes `properties` for its context menu. The row's due chip has the prop it
  needs waiting for it.
- `.menu-label` has no `min-width: 0` and does not truncate, so a project with
  very long type names would push a submenu's rows wide rather than clip them.
  Nothing in this change carries both a long label and a hint, and the four
  pick labels fit 200px with room, so this is a note rather than a defect.

## Checklist

- [x] ADR: property configuration joins labels in longclaw.yaml — record why ADR 0002's reservation is deferred, and what would revisit it <!-- longclaw:item=ck_945a1ca9 -->
- [x] Add Property to CONTEXT.md; Field is already defined there as a text-bearing editable <!-- longclaw:item=ck_d7acf634 -->
- [x] Settle the date-input grammar: which typed forms are accepted (2026-09-28, 28 Sep 2026, 28 Sep) and which year a form without one means <!-- longclaw:item=ck_eb7e1c56 -->
- [x] Specify type, due, start and estimate in docs/file_format.md, replacing prose in place <!-- longclaw:item=ck_4b893432 -->
- [x] Specify date-only YYYY-MM-DD in the YAML subset, distinct from the RFC 3339 timestamps at file_format.md:142 <!-- longclaw:item=ck_65106100 -->
- [x] Specify the properties block in longclaw.yaml — the all-off default, and per-property configuration beside it <!-- longclaw:item=ck_ea47a75f -->
- [x] Type values are an editable enum like labels — slug, name, colour — seeded with bug, feature, chore, docs, spike <!-- longclaw:item=ck_0b3b783d -->
- [x] Estimate: three systems — t-shirt, Fibonacci, duration — and a project is on exactly one <!-- longclaw:item=ck_d57ef7e6 -->
- [x] Estimate duration mode: number plus unit (minutes, hours, days, weeks); decimals legal (1.5d), compounds not (1d4h) <!-- longclaw:item=ck_addc6137 -->
- [x] Estimate conversion is configurable in duration mode only: hours per day and days per week, defaulting to 8 and 5 <!-- longclaw:item=ck_845b9000 -->
- [x] Switching estimate systems preserves values written under the old one rather than destroying them <!-- longclaw:item=ck_112ec2a3 -->
- [x] Settle the four due rungs — overdue, today, within attention_days, beyond — and that attention_days defaults to 7 and is configurable <!-- longclaw:item=ck_c45f20d4 -->
- [x] Decide whether disabling a property that tickets already carry warns first <!-- longclaw:item=ck_4148120d -->
- [x] Prototype the ticket panel: right-hand properties rail, description moved to the top <!-- longclaw:item=ck_b6758ff8 -->
- [x] Prototype the four due rungs and their visual treatments, in both appearances <!-- longclaw:item=ck_7b6183bf -->
- [x] Prototype the card's second footer row — what it holds, and how it reads at rest beside a checklist fraction <!-- longclaw:item=ck_e0292fab -->
- [x] The second footer row appears only when the ticket has a value for an enabled property that sits in it — one line, never wrapping, presence derived from row data and never from the rung, giving exactly four pinned heights <!-- longclaw:item=ck_bef33999 -->
- [x] Prototype the estimate control for each system — t-shirt chips, Fibonacci chips, and number plus unit <!-- longclaw:item=ck_100759d5 -->
- [x] Prototype the settings Properties pane: the type-values editor, the estimate system picker, and a property switched off while tickets carry values <!-- longclaw:item=ck_d5ddb411 -->
- [ ] Review the prototype, record what it settled, then delete it and its line in the index <!-- longclaw:item=ck_7d5bada6 -->
- [x] Project: parse and render the properties block in longclaw.yaml, preserving unknown keys <!-- longclaw:item=ck_15465a7c -->
- [x] Ticket: parse and render the four properties; a disabled one survives a read-modify-write untouched <!-- longclaw:item=ck_15eaaa0f -->
- [x] Validate a malformed date or estimate without destroying it — degrade the value, keep the bytes <!-- longclaw:item=ck_91489cf3 -->
- [x] TicketEdit: the four properties, nullable where absent must differ from cleared <!-- longclaw:item=ck_fc53069e -->
- [x] Activity: a changes entry per property, so a due date set by an agent is attributable <!-- longclaw:item=ck_92d3b485 -->
- [x] Index: carry the four properties on IndexedTicket <!-- longclaw:item=ck_71c2030f -->
- [x] CLI create and edit: --type --due --start --estimate, refusing a disabled property and an undefined type value the way known_labels refuses an undefined label <!-- longclaw:item=ck_cc46645c -->
- [x] The app's own create and edit refuse a disabled property and an undefined value, the way the CLI does — engine.rs holds the project and apply_as deliberately does not <!-- longclaw:item=ck_97b51001 -->
- [x] Generated .longclaw/AGENTS.md documents only the enabled set — check it against LC-66's churn <!-- longclaw:item=ck_e017a189 -->
- [x] Conformance fixtures per property: enabled and disabled, valid and malformed <!-- longclaw:item=ck_25b41a66 -->
- [x] types.ts: the four properties on Ticket and IndexedTicket <!-- longclaw:item=ck_bb5b83f5 -->
- [x] Settings: a properties section in SETTINGS_SECTIONS after labels, both labels off one row <!-- longclaw:item=ck_5fbdce11 -->
- [x] Settings pane: the type-values editor, shaped like the labels editor <!-- longclaw:item=ck_395aa8b1 -->
- [x] Settings pane: the estimate system picker, its conversion fields, and the due attention_days number <!-- longclaw:item=ck_f8c2ee24 -->
- [x] Ticket panel: the properties rail, gated on the project's enabled set <!-- longclaw:item=ck_8505f369 -->
- [x] Date input: picker plus the typed forms, normalised to the canonical on-disk shape <!-- longclaw:item=ck_31cdc0b5 -->
- [x] Hand LC-238s the rail's floor: no rail under 660px, 800 recommended, and a clamp that lands under 660 silently removes it <!-- longclaw:item=ck_ded5d73e -->
- [x] Create panel and quick create: the enabled properties only <!-- longclaw:item=ck_15448aa4 -->
- [x] Board card: the due in the key row, immediately before the priority glyph — it costs no height, so cardStrides and the pinned heights never learn about due at all <!-- longclaw:item=ck_09e1edf1 -->
- [x] boardGeometry: cardStrides learns the second footer row for estimate and type, keeping the height derivable from row data and never measured <!-- longclaw:item=ck_1b980442 -->
- [x] styles.css and card-height-guard.mjs learn the new pinned heights — the guard runs inside npm run check and fails on a disagreement <!-- longclaw:item=ck_2c41c9b0 -->
- [ ] List row: due within the row's two-chip budget, minding LC-93's 46px slot <!-- longclaw:item=ck_6ac72ae5 -->
- [x] Ticket context menu: submenus for all four properties beside Move to and Priority, each row present only when the project enables that property — a default project's menu is unchanged <!-- longclaw:item=ck_a77f4bb8 -->
- [x] Date submenus offer quick picks, Clear and Pick a date…; the latter opens the shared calendar at the context menu, without opening the Ticket Panel <!-- longclaw:item=ck_fcf48239 -->
- [x] Estimate submenu is the project's own scale: the enum under t-shirt, the sequence under Fibonacci, and a common-durations list under duration <!-- longclaw:item=ck_d3ec1253 -->
- [x] Every property submenu carries Clear, so a context-menu set is never a one-way door <!-- longclaw:item=ck_c06f6e05 -->
- [x] Proximity derived from an injected now, plus the day-boundary recompute the watcher cannot push <!-- longclaw:item=ck_55424527 -->
- [ ] A Due board ordering mode beside Priority and Manual (ADR 0003) <!-- longclaw:item=ck_79550de2 -->
- [ ] Command palette rows for setting each enabled property <!-- longclaw:item=ck_e8cbab2a -->
- [x] Undo for each property change, through fieldUndo.ts <!-- longclaw:item=ck_43674ebd -->
- [x] Explicit tabIndex on every new control — npm run check fails without it <!-- longclaw:item=ck_33780452 -->
- [ ] Update screen-specs.md, components.md, states.md and data-requirements.md in place, then npm run citations:update <!-- longclaw:item=ck_75cc51b4 -->
- [x] Update keyboard-focus-map.md in place for the rail's keyboard path, and for the picker's grid — the app's first two-dimensional popover, where the menus' up-down means a week <!-- longclaw:item=ck_8c1b2d21 -->
- [x] npm run a11y:audit, and probe:header since the rail widens the panel <!-- longclaw:item=ck_e4ce4244 -->
- [ ] probe:drag: a drop is arithmetic over the card offsets (gapAt), so a new card height moves where a dragged ticket lands <!-- longclaw:item=ck_5fa993af -->
- [ ] npm run perf:board and perf:list, and quote the numbers — the due comparator touches ordering <!-- longclaw:item=ck_c404ee03 -->
- [ ] npm run verify <!-- longclaw:item=ck_5e61f2a1 -->
- [ ] A /docs page for ticket properties and a /changelog entry <!-- longclaw:item=ck_aa77f085 -->
- [ ] Run /design-sync to push the settled Board card and the new property components to the Claude Design project (LC-63) <!-- longclaw:item=ck_0bc85504 -->
- [x] Install Caveman skill for Claude Code and Codex in this repo <!-- longclaw:item=ck_34b6d30d -->
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

<!-- longclaw:event
id: evt_8fd779eb
kind: update
occurred_at: 2026-09-08T01:09:30.565Z
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
id: evt_086c7e23
kind: update
occurred_at: 2026-09-08T01:11:52.266Z
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
id: evt_48f2ebb8
kind: update
occurred_at: 2026-09-08T01:11:58.725Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_eb7e1c56.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6f879640
kind: update
occurred_at: 2026-09-08T01:12:08.856Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8c1b2d21.text
    from: Update keyboard-focus-map.md in place for the rail's keyboard path
    to: Update keyboard-focus-map.md in place for the rail's keyboard path, and for the picker's grid — the app's first two-dimensional popover, where the menus' up-down means a week
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bcd9712e
kind: update
occurred_at: 2026-09-08T01:20:20.070Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_4b893432.checked
    from: "false"
    to: "true"
  - field: checklist.ck_65106100.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ea47a75f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0b3b783d.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d57ef7e6.checked
    from: "false"
    to: "true"
  - field: checklist.ck_addc6137.checked
    from: "false"
    to: "true"
  - field: checklist.ck_845b9000.checked
    from: "false"
    to: "true"
  - field: checklist.ck_112ec2a3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_65c7012e
kind: update
occurred_at: 2026-09-08T01:26:09.825Z
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
id: evt_570be8de
kind: update
occurred_at: 2026-09-08T01:26:16.394Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c45f20d4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_4148120d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5b17abc2
kind: update
occurred_at: 2026-09-08T02:03:07.925Z
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
id: evt_9d2bfc4d
kind: update
occurred_at: 2026-09-08T02:03:13.442Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b6758ff8.checked
    from: "false"
    to: "true"
  - field: checklist.ck_7b6183bf.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e0292fab.checked
    from: "false"
    to: "true"
  - field: checklist.ck_100759d5.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d5ddb411.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0b1cfa34
kind: update
occurred_at: 2026-09-08T06:51:11.630Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_09e1edf1.text
    from: "Board card: the due chip in a second footer row, which the footer gains rather than the chip contending for a label slot"
    to: "Board card: the due in the key row, immediately before the priority glyph — it costs no height, so cardStrides and the pinned heights never learn about due at all"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_40d4bbf3
kind: update
occurred_at: 2026-09-08T06:51:16.972Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1b980442.text
    from: "boardGeometry: cardStrides learns the second footer row, keeping the height derivable from row data and never measured"
    to: "boardGeometry: cardStrides learns the second footer row for estimate and type, keeping the height derivable from row data and never measured"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0317d23f
kind: update
occurred_at: 2026-09-08T06:51:23.457Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a77f4bb8.added
    to: "Ticket context menu: a Type submenu beside Move to and Priority, off the same registry metaOptions feeds the other two from"
  - field: checklist.ck_fcf48239.added
    to: Record why due, start and estimate stay out of the context menu — the menu's own rule is that it is a shortcut, not a second place where things are decided
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1b625e3b
kind: update
occurred_at: 2026-09-08T06:51:28.355Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a77f4bb8.moved
    from: "54"
    to: "41"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fe6570b6
kind: update
occurred_at: 2026-09-08T06:51:33.494Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fcf48239.moved
    from: "55"
    to: "42"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b5c14827
kind: update
occurred_at: 2026-09-08T06:52:28.313Z
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
id: evt_057ff706
kind: update
occurred_at: 2026-09-08T06:53:12.387Z
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
id: evt_94b04aab
kind: update
occurred_at: 2026-09-08T07:18:24.157Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a77f4bb8.text
    from: "Ticket context menu: a Type submenu beside Move to and Priority, off the same registry metaOptions feeds the other two from"
    to: "Ticket context menu: submenus for all four properties beside Move to and Priority, each row present only when the project enables that property — a default project's menu is unchanged"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_068982cf
kind: update
occurred_at: 2026-09-08T07:18:30.178Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fcf48239.text
    from: Record why due, start and estimate stay out of the context menu — the menu's own rule is that it is a shortcut, not a second place where things are decided
    to: Date submenus are quick picks with the resolved day as each row's hint, plus Clear and a Pick a date… that hands off to the panel — never a calendar inside a popover
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2e3d8898
kind: update
occurred_at: 2026-09-08T07:18:37.598Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d3ec1253.added
    to: "Estimate submenu is the project's own scale: the enum under t-shirt, the sequence under Fibonacci, and a common-durations list under duration"
  - field: checklist.ck_c06f6e05.added
    to: Every property submenu carries Clear, so a context-menu set is never a one-way door
  - field: checklist.ck_ded5d73e.added
    to: "Hand LC-238s the rail's floor: no rail under 660px, 800 recommended, and a clamp that lands under 660 silently removes it"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4faa9a20
kind: update
occurred_at: 2026-09-08T07:18:45.000Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d3ec1253.moved
    from: "56"
    to: "43"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_67383efa
kind: update
occurred_at: 2026-09-08T07:18:45.030Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c06f6e05.moved
    from: "57"
    to: "44"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_737f4618
kind: update
occurred_at: 2026-09-08T07:18:45.059Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ded5d73e.moved
    from: "58"
    to: "36"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_64964302
kind: update
occurred_at: 2026-09-08T07:19:31.897Z
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
id: evt_cb630b9e
kind: update
occurred_at: 2026-09-08T07:20:00.434Z
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
id: evt_bd97b5ae
kind: update
occurred_at: 2026-09-08T10:28:55.619Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_15465a7c.checked
    from: "false"
    to: "true"
  - field: checklist.ck_15eaaa0f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_91489cf3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_fc53069e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_92d3b485.checked
    from: "false"
    to: "true"
  - field: checklist.ck_71c2030f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_cc46645c.checked
    from: "false"
    to: "true"
  - field: checklist.ck_25b41a66.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e12e97c1
kind: update
occurred_at: 2026-09-08T10:30:04.741Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_97b51001.added
    to: The app's own create and edit refuse a disabled property and an undefined value, the way the CLI does — engine.rs holds the project and apply_as deliberately does not
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c78f8bf3
kind: update
occurred_at: 2026-09-08T10:30:21.510Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_97b51001.moved
    from: "59"
    to: "28"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_050f402c
kind: update
occurred_at: 2026-09-08T11:05:17.943Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bb5b83f5.checked
    from: "false"
    to: "true"
  - field: checklist.ck_09e1edf1.checked
    from: "false"
    to: "true"
  - field: checklist.ck_1b980442.checked
    from: "false"
    to: "true"
  - field: checklist.ck_2c41c9b0.checked
    from: "false"
    to: "true"
  - field: checklist.ck_bef33999.checked
    from: "false"
    to: "true"
  - field: checklist.ck_55424527.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cd3d3e27
kind: update
occurred_at: 2026-09-08T11:56:20.679Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8505f369.checked
    from: "false"
    to: "true"
  - field: checklist.ck_31cdc0b5.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ded5d73e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0e1c66fb
kind: update
occurred_at: 2026-09-08T12:15:01.201Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_98d50a01
kind: update
occurred_at: 2026-09-08T12:52:48.744Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5fbdce11.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8e7b6ed3
kind: update
occurred_at: 2026-09-08T12:52:48.772Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_395aa8b1.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0353883f
kind: update
occurred_at: 2026-09-08T12:52:48.802Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f8c2ee24.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d971c5f7
kind: comment
occurred_at: 2026-09-08T12:54:24.650Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Built the settings Properties pane: the four opt-in properties as blocks, the
type-values editor sharing the labels editor's row, the estimate system picker
with its conversion fields and its t-shirt scale, and the due window. Added the
write path underneath it — a recursive nested-path writer in `yaml.rs`, eight
`ProjectDocument` edits, and eight commands — since nothing could configure a
property before this. Filed LC-247u for a `.label-row` overflow the WebKit
measurement found in the Labels pane it copies.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_db15b245
kind: update
occurred_at: 2026-09-08T15:02:19.855Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_97b51001.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e017a189.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The app's own create and edit now refuse a disabled property and an undefined value, and the generated contract lists the enabled set. One refusal serves both surfaces: PropertiesConfig::require_enabled and ::accept, walked by accept_new and accept_edit; cli.rs lost its two copies and engine.rs asks them before it prepares a write. Checked ck_e017a189 against LC-66 as the row asks — the property rows are derived and hold still, but the contract around them still churns three minted ids on every project write, and the new settings pane makes that fire on every property toggle. Noted on LC-66 with the evidence.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ffb9f679
kind: update
occurred_at: 2026-09-09T01:16:18.212Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_15448aa4.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Both create surfaces now offer the enabled properties and nothing else. One PropertyControl serves the panel's rail, full create and quick create, so the switch on which property this is lives in one place; PROPERTY_FIELDS names the order a surface draws them in, which is not the format's. Quick create's shape was not settled by the ticket or the prototype, so the call and its argument are recorded in the ticket: the properties are in, on LC-186's argument for priority, on a labelled row of their own so Labels does not move. Also fixed three quiet losses: a date typed and committed with the same key, the draft the full-editor door carries, and the optimistic card's height.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8b5c146b
kind: update
occurred_at: 2026-09-09T02:22:39.683Z
actor:
  type: human
  id: local
changes:
  - field: type
    to: feature
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3bdc19fd
kind: update
occurred_at: 2026-09-09T02:23:34.104Z
actor:
  type: human
  id: local
changes:
  - field: due
    to: 2026-09-09
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_63e48525
kind: update
occurred_at: 2026-09-09T02:53:49.951Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_43674ebd.checked
    from: "false"
    to: "true"
  - field: checklist.ck_33780452.checked
    from: "false"
    to: "true"
  - field: checklist.ck_8c1b2d21.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e4ce4244.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2c891216
kind: comment
occurred_at: 2026-09-09T02:54:23.511Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The rail's keyboard half. The toast's Undo button worked from the day the rail landed; the key beside it did not — a date field commits on Enter without moving the caret or changing its text, so fieldUndo.ts still read it as holding an edit of its own and gave it the key, leaving Undo on screen and unreachable. That is LC-220 with the surfaces swapped, and the fix is one export the two committing fields call where they call onCommit. keyboard-focus-map.md gained the rail's Tab order in place and two new sections for the picker's grid, which cost fourteen citations a re-point — only in the trees the guard scans, because the historical ones had drifted long before this. a11y:audit (56 checks) and probe:header (140/140) are green, and neither of them can see the rail: the perf fixture enables no properties, which is recorded rather than implied.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_13b02626
kind: update
occurred_at: 2026-09-09T03:02:01.720Z
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
id: evt_ecc16c09
kind: update
occurred_at: 2026-09-09T03:32:16.894Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: checklist.ck_34b6d30d.added
    to: Install Caveman skill for Claude Code and Codex in this repo
-->
### Codex updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b0040a92
kind: update
occurred_at: 2026-09-09T03:32:26.853Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: checklist.ck_34b6d30d.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a12a5800
kind: update
occurred_at: 2026-09-09T04:05:45.016Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_a77f4bb8.checked
    from: "false"
    to: "true"
  - field: checklist.ck_fcf48239.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d3ec1253.checked
    from: "false"
    to: "true"
  - field: checklist.ck_c06f6e05.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_12c54a16
kind: update
occurred_at: 2026-09-09T06:38:54.212Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: checklist.ck_fcf48239.text
    from: Date submenus are quick picks with the resolved day as each row's hint, plus Clear and a Pick a date… that hands off to the panel — never a calendar inside a popover
    to: Date submenus offer quick picks, Clear and Pick a date…; the latter opens the shared calendar at the context menu, without opening the Ticket Panel
-->
### Codex updated this ticket

Decision revised by the user on 2026-09-09: Pick a date… now opens the shared calendar at the context menu for Due and Start, replacing the earlier panel handoff. Choosing or clearing a date uses the existing property edit and Undo path. Escape and outside dismissal return focus to the originating ticket. Month controls and Clear are keyboard-accessible. The Type menu row now uses the chosen circle, square and triangle outline icon.
<!-- /longclaw:event -->
