---
format: longclaw.ticket/v1
id: af38e556-925f-447f-8af4-45e77414380c
key: LC-177
title: quick-create-guard reads declarations without a left boundary and misreports its count
status: in_review
priority: p3
rank: a1
labels:
  - frontend
created_at: 2026-08-07T14:38:34.947Z
updated_at: 2026-08-11T16:55:00Z
---

Two defects in `apps/desktop/scripts/quick-create-guard.mjs`, both in the same
reader.

**No left boundary.** `requireDeclaration` builds ``new
RegExp(`${property}\s*:\s*([^;]+)`, "g")``. Its sibling guard spells out why
that is unsafe — `glyph-drift-guard.mjs:234`: "The name may not be preceded by a
word character *or a hyphen*: `\b` alone matches the `width` inside
`stroke-width`" — and uses `(?<![\w-])` in both `attr` and `fromRules`. Nothing
false-passes today, because `border`, `padding`, `background`, and `font-size`
are unprefixed in the two rules it reads. But a `border` assertion would happily
match a `-webkit-border-*` longhand, and `padding` would match `scroll-padding`,
so the guard would report clean while the declaration it names had drifted.

**The count is a constant.** The call to `report` passes `checked: 2` while the
file asserts seven declarations. The gate prints "2 contracts clean", which
undercounts what actually held.

## Approach

A related seam from the same review: `requireDeclaration` here and `fromRules`
in `glyph-drift-guard.mjs:323` are the same "find `property: value` inside
`declarationsOf(rules, selector)`" shape, and `guard.mjs`'s header says "the
scan and the report live here and each guard is only its rules". Lifting one
`declaredValues()` helper into `guard.mjs` fixes the boundary once for both
callers rather than twice.

## Source

A two-axis review (standards + spec) of `fix/lc-113-lc-115-quick-create` against
`main`, 2026-08-07.

## Checklist

- [x] Add the (?<![\w-]) left boundary to the declaration regex, matching what glyph-drift-guard already does. <!-- longclaw:item=ck_ca60e82e -->
- [x] Report the number of declarations actually checked rather than a hardcoded 2. <!-- longclaw:item=ck_ce367b4a -->
- [x] Lift the shared declaration reader into guard.mjs so the boundary is fixed once for both guards. <!-- longclaw:item=ck_74af1b9d -->

## Activity

<!-- longclaw:event
id: evt_83a4d874
kind: create
occurred_at: 2026-08-07T14:38:34.947Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c4bf0445
kind: update
occurred_at: 2026-08-07T16:53:05.494Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_review
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_da5236c9
kind: update
occurred_at: 2026-08-07T16:54:45.126Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_review
    to: todo
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8f0424fa
kind: update
occurred_at: 2026-08-08T23:56:06.688Z
actor:
  type: human
  id: local
changes:
  - field: rank
    to: a1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_82b6ba70
kind: comment
occurred_at: 2026-08-11T14:25:06.082Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Half of this ticket's title is no longer true, and the file it names no longer exists under that name.

`quick-create-guard.mjs` became `create-surface-guard.mjs` in 8b2f1aa — the rename came with two full-create rows, and the old name had stopped being true. Its `report` call now passes `checked: 4` with `noun: "contracts"` against the four prototype-diff rows it holds, D-47, D-48, D-49 and D-4A, so the gate prints "4 contracts clean" and four is what actually held. The "2 contracts clean" this was filed against is gone.

Item 2 is left unticked on purpose. The number is still a literal rather than a count of the assertions — ten `requireDeclaration` calls stand behind a hand-written `4` — so it can go stale again the next time a row is added, which is exactly the failure that produced the original `2`. What has changed is that it is not wrong today.

The other two items stand verbatim in the renamed file. `requireDeclaration` still builds ``new RegExp(`${property}\s*:\s*([^;]+)`, "g")`` with no left boundary (`create-surface-guard.mjs:39-41`), so a `border` assertion would still match a `-webkit-border-*` longhand and report clean; and `glyph-drift-guard.mjs` still carries its own `fromRules` with the `(?<![\w-])` this one lacks, so the seam the Approach section names is still two readers rather than one in `guard.mjs`. The boundary is the live half of this ticket.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5c1d90ab
kind: update
occurred_at: 2026-08-11T16:55:00Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

`declaredValues(rules, selector, property)` is now the one reader, in
`guard.mjs` beside `declarationsOf`, and it carries the `(?<![\w-])` boundary.
`create-surface-guard.mjs` had none and now takes it from there;
`glyph-drift-guard.mjs`'s `fromRules` had its own copy and is now three lines
over the shared one, so the boundary exists once rather than twice.

The count is a count. `requireDeclaration` increments as it reads, and `report`
takes that with `noun: "declarations"` — the gate prints "10 declarations clean"
against the hand-written `4` the last comment left standing, and it moves on its
own the next time a row is added.

The boundary is proved rather than asserted: replacing `.quick-create-title`'s
`padding: 0` with `scroll-padding: 0` used to satisfy the D-47 assertion and now
fails it by name. `scripts/guard.test.mjs` pins that case and seven others —
the vendor prefix, the longhand standing beside the property it shadows, both
empty readings, and the descendant selector `declarationsOf` already refuses.

Left alone deliberately: the pass line still names D-47, D-48, D-49 and D-4A in
prose, so a fifth row would need that sentence edited. That is a smaller lie
than the number was — the sentence is beside the assertions it describes — but
it is the same kind, and it is not what this ticket was filed against.
<!-- /longclaw:event -->
