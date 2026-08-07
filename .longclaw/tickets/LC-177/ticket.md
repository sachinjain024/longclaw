---
format: longclaw.ticket/v1
id: af38e556-925f-447f-8af4-45e77414380c
key: LC-177
title: quick-create-guard reads declarations without a left boundary and misreports its count
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-08-07T14:38:34.947Z
updated_at: 2026-08-07T14:38:34.947Z
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

- [ ] Add the (?<![\w-]) left boundary to the declaration regex, matching what glyph-drift-guard already does. <!-- longclaw:item=ck_ca60e82e -->
- [ ] Report the number of declarations actually checked rather than a hardcoded 2. <!-- longclaw:item=ck_ce367b4a -->
- [ ] Lift the shared declaration reader into guard.mjs so the boundary is fixed once for both guards. <!-- longclaw:item=ck_74af1b9d -->

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
