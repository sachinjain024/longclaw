---
format: longclaw.ticket/v1
id: b3dfbe39-3a24-45b3-b735-b0a5548ede68
key: LC-259y
title: A new project should join the sidebar last, not in name order
status: todo
priority: p2
labels:
  - platform
  - frontend
  - product
type: bug
created_at: 2026-09-17T00:42:18.652Z
updated_at: 2026-09-17T00:43:13.201Z
---

A new project lands in the sidebar wherever its name sorts, not at the bottom.
Because the `⌘1`–`⌘9` chord is the row's position in that list, registering a
project called `Admin` renumbers every project after it, and the chord a user has
in their fingers now opens something else.

Registration order should be the sidebar's order. A new project goes last, and
existing numbers do not move.

## Confirmed, and it is two sorts rather than one

The list is sorted twice, in two places, by two different comparators:

- `apps/desktop/src-tauri/src/registry.rs:301` — `remember` ends with
  `next.sort_by(|left, right| left.name.cmp(&right.name))`, so the registry file
  is written in name order. `cmp` on a `String` is byte order, which puts every
  capitalised name before every lowercase one: `Zebra` before `apple`.
- `apps/desktop/src/App.tsx:201` — `sortedProjects` sorts again with
  `localeCompare`, which is locale order and does not agree with the line above.

So the persisted order and the drawn order are already two different orders that
happen to look alike for ASCII-cased names. Both have to go, and the fix has to
leave exactly one authority for the order — replacing one sort with a stable
field while the other still sorts by name is this bug a second time.

## The chord is derived from position, so anything that moves a row renumbers

`App.tsx:604` builds `projectChords` by taking the first `PROJECT_CHORD_COUNT`
of `localProjects` and numbering them by index. The badge and the chord read
that one map, which is correct and should stay — a row cannot advertise a key
that lands somewhere else.

But the input is a name-sorted list, so the number is a function of the names.
That makes the reported defect one case of a larger one:

- **Registering a project renumbers.** The reported case.
- **Renaming a project renumbers.** `remember` is called on any update to a
  registered project, not only on registration, and it re-sorts every time. A
  user who renames `Work` to `Acme` moves it, and moves everything it passes.
  This is the sharper case, because nothing about renaming a project suggests
  that other projects' shortcuts change.

## The fix: an explicit order that registration appends to

Give `ProjectReference` a field that states its place, and sort by that
everywhere. `core/model.rs:22` is the struct; `#[serde(default)]` is already the
idiom there for fields added after the fact, and the comment on `labels` says so
in as many words — a registry written before the field existed still loads.

Two properties matter more than the representation:

- **New projects append.** Registration puts the project after every existing
  one. That is the whole request.
- **A rename moves nothing.** The order is independent of the name.

## Migrating an existing registry must not renumber anyone

This is the part to get right. Every current user's registry is in name order
today, and their muscle memory is built on it. Seeding the new field from the
order the registry is already in means that on upgrade nobody's number changes,
and the fix takes effect from the next project registered onward.

Seeding it any other way — by path, by id, by when the folder was created —
reshuffles every existing user once, which is the exact defect this ticket is
about.

## Keep the invariants that already hold

- Starred rows are the same rows pinned to the top rather than a second list,
  and a project shows one number wherever it is drawn (`App.tsx:596`). Starring
  must keep not changing the number.
- An unreachable project keeps its entry and its cached name, so it keeps its
  place too. A project that cannot be found is not a project that has been
  removed, and a temporarily unplugged disk must not renumber the sidebar.
- Removal closes the gap. There is no other sensible answer for a list of nine
  chords, and the numbers below the removed row do move — that is a deletion the
  user performed, not a surprise.

## Tests

- Register three projects with names that sort backwards; assert the sidebar
  order is registration order.
- Rename the first project to a name that sorts last; assert no row moves and no
  chord changes.
- Load a registry file with no order field; assert the resulting order is the
  file's existing order and every chord is what it was.
- Star, unstar, and make a project unreachable; assert the numbering is
  unchanged in each case.

## Out of scope

- Dragging rows to reorder the sidebar. It becomes possible once the order is a
  stored fact rather than a derived one, and it is the obvious follow-on, but it
  is not needed to fix this.
- Sorting the sidebar by name as an option.

## Related

- **LC-260j** — drag to reorder the sidebar. It is the follow-on named above and
  it depends on this ticket landing first.

## Checklist

- [ ] Add an explicit order field to ProjectReference, with serde(default) <!-- longclaw:item=ck_8fbe1774 -->
- [ ] Registration appends after every existing project <!-- longclaw:item=ck_4ebce917 -->
- [ ] Remove the name sort in registry.rs:301 <!-- longclaw:item=ck_ea0b2176 -->
- [ ] Remove sortedProjects in App.tsx:201; leave exactly one authority for the order <!-- longclaw:item=ck_dee42cb4 -->
- [ ] Seed the field on migration from the registry's existing order so nobody is renumbered on upgrade <!-- longclaw:item=ck_58900743 -->
- [ ] Renaming a project moves no row and changes no chord <!-- longclaw:item=ck_1040eff4 -->
- [ ] Starred, unreachable and removed projects keep their existing numbering behaviour <!-- longclaw:item=ck_1534c364 -->
- [ ] Tests: registration order, rename, migration from a file with no order field, star/unreachable <!-- longclaw:item=ck_8f80c4c2 -->

## Activity

<!-- longclaw:event
id: evt_58aea83a
kind: create
occurred_at: 2026-09-17T00:42:18.652Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b7697999
kind: update
occurred_at: 2026-09-17T00:43:13.201Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
