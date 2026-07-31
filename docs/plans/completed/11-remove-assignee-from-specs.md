---
title: "Remove assignee from the prototype specs and the data requirements"
product: LongClaw
status: done
completed: 2026-07-31
backlog_id: V0-19
order: 11
owner_area: Design
release_blocking: true
depends_on: none
---

# Remove assignee from the prototype specs and the data requirements

[ADR 0001](../../adr/0001-no-assignee-in-local-mode.md) took assignee out of local
mode on 2026-07-28, and its own consequences section says the Step 2 specs must be
revised. Commit `414f965` did most of that work: the prototype lost the assignee
row, the card and row avatars, the `A` shortcut and the palette command, and
`screen-specs.md`, `keyboard-focus-map.md`, `states.md`, `data-requirements.md`
and `prototype/README.md` all gained ADR citations in place.

What that commit did not touch is the Step-1 foundations. `git show --stat 414f965`
lists `foundations/decisions.md` and nothing else under `docs/design/foundations/`;
`components.md` was never opened. So the two documents an implementer reads first
for component anatomy still presented assignee as live v0 anatomy.

## Why this exists

Backlog [V0-19](../../backlog/v0-backlog.md), Wave 1, and its reason is the sharp
one: *a spec that still shows it will get built.* `screen-specs.md:119` already
patches around the gap — "per components.md § Board card, **minus the assignee
avatar**" — which is evidence the gap was known and worked around rather than
fixed. Someone building the board from `components.md` alone builds the slot.

## Do this

Surgical edits only. These are historical Step-1 records that other documents cite
by section; nothing is renumbered and nothing is rewritten wholesale.

`docs/design/foundations/components.md` is a spec — correct the anatomy outright
and cite the ADR on the same line:

1. § Avatars — the agent-tile rule "Never appears in the assignee slot" presumes
   an assignee slot is first-class anatomy.
2. § Board card — the footer row still ends "spacer, assignee avatar 20px".
3. § Command palette — the v0 command list still contains `assign`.
4. § Shortcuts — the table still has an `A` | Assign focused ticket row.

`docs/design/foundations/decisions.md` is a decision log — keep the record, strike
the entry, leave the existing ADR blockquotes standing:

5. D7 — same assignee-slot clause as (1), with no blockquote yet.
6. D8 — the shortcut list still reads `A` assign; the correction is only in the
   blockquote below it.
7. D14 — the command list still reads assign; same shape of problem.

And one cleanup:

8. `docs/design/prototype/prototype.css` — a stale comment naming an assignee
   picker that does not exist.

Leave alone: ADR 0001 itself; every "no assignee (ADR 0001)" call-out in
`screen-specs.md`, `keyboard-focus-map.md`, `data-requirements.md` and
`prototype/README.md` — those are the compliance evidence; `docs/file_format.md`,
where assignee stays as an optional team-mode field by the ADR's own consequences;
the `assignee: null` seed field in `prototype.js`, which is dead and never
rendered; and human circle avatars in the timeline and composer, which ADR 0001
explicitly preserves as *actor* representation.

## Done when

`rg -n -i 'assign|avatar|\bowner\b|\bpeople\b' docs/design/` returns no hit that
presents an assignee as part of a v0 surface — every remaining hit is an ADR
call-out, an agent-tile or actor avatar, the on-disk schema, or a colour-assignment
sentence about statuses and labels.

## Outcome

All eight edits shipped, as surgical replacements.

`docs/design/foundations/components.md`:

- § Avatars — "**Never appears in the assignee slot.**" became "**Never stands in
  for a person** — and v0 has no assignee slot for it to stand in at all (ADR
  0001); the rule returns with team projects." The rule survives; the presumption
  does not.
- § Board card — the footer now ends at the progress track, followed by "No
  assignee avatar and no trailing avatar slot — v0 is local mode and has no
  assignee (ADR 0001)." The trailing `spacer` went with the avatar, because its
  only job was to push the avatar right.
- § Command palette — `assign` dropped from the v0 command list, with "No
  **assign** command — v0 is local mode and has no assignee (ADR 0001)."
- § Shortcuts — the `A` row is gone from the table; the paragraph below now says
  "`A` is reserved, not bound", matching `keyboard-focus-map.md:68`.

`docs/design/foundations/decisions.md`:

- D7 — struck `~~never appears in the assignee slot~~` and added the ADR 0001
  blockquote D7 was missing, in the same form D8 and D14 already carry.
- D8 — struck `~~`A` assign~~` in the shortcut list; its blockquote stands.
- D14 — struck `~~assign~~` in the command list; its blockquote stands.

`docs/design/prototype/prototype.css` — the dropdown comment no longer names an
assignee picker.

### Decisions

**Strikethrough in the log, deletion in the spec.** `decisions.md` records what was
decided at Step 1, so the entries are struck rather than removed and the ADR
blockquote explains why — the convention D3 and D4 already use with their
`<details>Superseded original</details>` blocks. `components.md` is a spec an
implementer builds from, so the wrong anatomy is deleted and replaced with the
correction inline. Striking text in a build document invites someone to read past
the strike.

**D7 got the blockquote it never had.** The audit for this item listed six
document spots; D7 was not among them, and adding an annotation to a decision was
not in the plan. It is the same sentence as `components.md` § Avatars, and leaving
one half corrected would have been worse than the inconsistency of adding one
blockquote.

### What was not in the plan

**The audit missed D7** (`decisions.md:124`). It is fixed, and the plan text above
now lists it as item 5.

**The Step-1 proof artifacts still render assignees, and were left alone.** Two
files under `docs/design/foundations/proof/` show an assignee on a v0 surface:

- `board.html` — seven board cards carry a footer avatar (`:308`, `:319`, `:357`,
  `:370`, `:391`, `:413`, `:424`).
- `components-library.html` — a disabled "Assignee (project has no members yet)"
  field in the create form (`:609`), an assignee avatar in five list rows and three
  card specimens, the section blurbs for the list view (`:814`) and ticket panel
  (`:918`) both naming assignee as an element, and an assignee control in the
  ticket-panel header (`:934`, "Aria Rowe"). Its § 09 blurb also still ends "Never
  in the assignee slot."

These are a real gap against the must-pass read literally, and they were left for
a decision rather than fixed here:

1. `git log -- docs/design/foundations/proof/` shows one commit, the Step-1
   original. The ADR propagation pass regenerated the *prototype's* renders and
   deliberately did not open these, which reads as a scope choice rather than an
   oversight.
2. Ten committed PNGs in `proof/renders/` are the evidence behind the Step-1 exit
   gate in `foundations/README.md:42` and behind D15. Editing the HTML desyncs
   them, and the render pipeline is not committed — only `playwright-core` as a
   transitive dependency of the desktop app, with no viewport or theme-switching
   recipe recorded.

The exposure is concrete, not theoretical: V0-14 (dense list surface) and V0-16
(full create surface) are the two items most likely to be built from
`components-library.html` § 12 and § 05, and both still show an assignee there.
Worth a follow-up backlog item that fixes the two HTML files and regenerates the
renders together.

**`data-requirements.md:15` is fine.** It lists assignee in the `ticket.md`
frontmatter row, which is the on-disk schema, and `:129-130` annotates it: assignee
stays optional in the format, no v0 surface reads or writes it. That matches ADR
0001's own consequences and is not a spec showing an assignee.

### Verification

`rg -n -i 'assign|avatar|\bowner\b|\bpeople\b' docs/design/` — every hit outside
`proof/` is a cleared category:

- ADR 0001 call-outs in `screen-specs.md`, `keyboard-focus-map.md`,
  `prototype/README.md`, `data-requirements.md`, and the three new ones in
  `components.md` and `decisions.md`.
- Agent avatar tile: `decisions.md` D7 heading, `accessibility.md` contrast rows,
  `design-tokens.{json,css}`, `glyphs.svg`, `build.mjs`.
- Actor avatars in the timeline and composer: `components.md:200`,
  `screen-specs.md:193`, `states.md:170`, `prototype.js:750`/`:809`.
- The dead `assignee: null` seed field in `prototype.js`.
- Colour *assignment* prose about statuses and labels (`decisions.md:55`,
  `components.md:111`), and `Object.assign` in `prototype.js:152`.
- `people` as the `longclaw.yaml` registry (schema, not a surface) and in the
  display-type sample string "Plan with people. Ship with agents."
- `fable-design-system-v1.mhtml`, the captured approved reference — a historical
  import in the same class as the ADR itself.

No code changed, so `npm run verify` was not run.

## Amendment 2026-08-01 — the follow-up is filed, and the backlog row corrected

The Outcome above asked for a follow-up item covering the two HTML files and the
renders. The HTML half landed in this pass; the follow-up for the renders was
never filed, and V0-19's backlog row closed reporting *"passed for every spec and
data requirement"* — which is the must-pass sentence with the failing clause
removed. The criterion the item was measured against reads *no spec, **screen**,
or data requirement in `docs/design/` shows an assignee in local mode*, and the
ten PNGs in `proof/renders/` are screens that do.

Both are fixed rather than argued. The renders are now **V0-41** in Wave 3, next
to V0-37, which needs the same uncommitted pipeline to exist before it can
produce a matrix at all. V0-19's row states the screen clause as not passed and
says why. The verdict is unchanged — the specs and the data requirements really
were cleared, and the HTML really was revised — but the row no longer reads as a
clean pass, because it was not one.
