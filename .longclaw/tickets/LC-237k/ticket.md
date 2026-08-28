---
format: longclaw.ticket/v1
id: 286b1b86-dc5c-48ed-9bee-aafd89b76976
key: LC-237k
title: Filter tickets by label and by priority
status: todo
priority: none
labels:
  - frontend
  - design
  - product
created_at: 2026-08-28T12:01:24.343Z
updated_at: 2026-08-28T12:01:24.343Z
---

The content header filters on one thing: a lowercased substring over a row's key, title and label slugs (`filtering.ts`). That means a label can only be filtered on by typing enough of its slug to be unambiguous — and it matches titles too, so `design` catches every ticket with the word in its title — and priority cannot be filtered on at all. This ticket adds structured narrowing on top of the text query:

- **Labels** — narrow to tickets carrying a chosen label, or any of several.
- **Priority** — narrow to a chosen priority, or any of several.

Both compose with the existing text query and with each other.

## Sequence

This is three pieces of work, in order, and the ticket is not done until the third lands:

1. **UX prototype first.** An HTML prototype under `docs/ux/prototypes/`, named for this ticket, in the manner of `LC-201-Bulk-Create-In-Quick-Create-Mode.html`. It answers the open questions below before any app code is written.
2. **Then a plan**, filed as its own ticket or as a plan doc, once the prototype has settled the shape.
3. **Then execute it.**

## What the prototype has to answer

- **Where the controls live.** The content header is a 62px band already carrying the project name and path chip, the gear, the disk-state indicator, the 180×30px filter field, the ordering control, the view segment and the primary New ticket button (`screen-specs.md:64-69`). Two more controls may not fit, and a header that breaks into two rows is exactly the defect `probe:header` exists to catch (LC-149). A filter *bar* under the header, a popover off the existing field, or chips that appear only when active are all plausible — the prototype should pick one and show it at the narrowest window the app supports.
- **What multiple selections mean.** Two labels: every ticket carrying *both*, or any ticket carrying *either*? Two priorities is almost certainly *either*. Across dimensions it is almost certainly *and*. Whatever the answer, the screen has to say it without a legend.
- **How an active filter is visible and how it comes off.** The no-match state today echoes the query with a `Clear filter` button and `Esc` (LC-15). With a label or priority active and the text box empty, "the query" is no longer a string, and that state needs to say what is actually narrowing the view.
- **Whether the selection survives, and how you notice it did.** The text query is device-local per-project workspace state (`data-requirements.md:41`, `devicePreferences.ts:44`), so it is written to preferences and comes back on relaunch. A label or priority selection joining it there is the obvious choice and the riskier one: a restored text query is visible in the field, while a restored label selection is a board missing rows for a reason that scrolled off the header. Decide it, and make the restored state legible either way.

## Constraints the implementation inherits

- **One narrowing, two projections.** `filterTickets` runs once in `App.tsx:412` and the board and the list both receive the result, so the two surfaces cannot disagree about what a filter means. Structured predicates go in the same place, not into either surface.
- **A degraded row is never filtered out.** `filtering.ts` keeps a file this build cannot parse, because "the query does not match it" is a claim the app is not entitled to make about a row with no readable text. A row with no readable labels or priority is the same case, and the same answer should hold — deliberately, with the comment saying so.
- **This is not `search_tickets`.** The indexed command truncates at 100 results, which is right for the `⌘K` palette and a lie for a filter that decides what the whole board shows. Filtering stays in the frontend over the rows already in memory.
- **Dropping with a filter on is already a known trap.** LC-187: a drop is ranked over the rows that matched, so it can land above hidden rows that did not, and nothing on screen says so until the filter comes off. Structured filters make hidden rows the normal case rather than the exception. `npm run probe:drag` covers this and must be run and quoted.
- **The filter is on the interaction budget.** `perf:board` and `perf:list` each carry a filter trace over 5,000 tickets, typed a character at a time (LC-15). A predicate that allocates per row per keystroke will show up there and nowhere else. Run both and quote the numbers.
- **Explicit `tabIndex` on every new button and checkbox** (`scripts/tab-order-guard.mjs`), and run `npm run a11y:audit` — new header controls change the tab order, and its A5 row is about a control pushed off the side of the window.

## Checklist

- [ ] UX prototype under docs/ux/prototypes/, answering where the controls live, what multiple selections mean, how an active filter reads and clears, and whether it persists <!-- longclaw:item=ck_4214cffa -->
- [ ] Review the prototype and settle the and/or semantics before any app code <!-- longclaw:item=ck_73c0c49a -->
- [ ] Write the implementation plan off the settled prototype <!-- longclaw:item=ck_dc94e8e3 -->
- [ ] Add label and priority predicates to filtering.ts, composed with the text query in the one narrowing in App.tsx <!-- longclaw:item=ck_581505d6 -->
- [ ] Keep a degraded row visible under a structured filter, and say why in the comment <!-- longclaw:item=ck_9bd11a7b -->
- [ ] Update the no-match state to describe a non-text filter, and give it a way to clear <!-- longclaw:item=ck_5e3f7be9 -->
- [ ] Explicit tabIndex on new controls; npm run check and npm run a11y:audit <!-- longclaw:item=ck_fa100fd1 -->
- [ ] npm run probe:header for the header row, and probe:drag for the filtered-drop cases (LC-187) <!-- longclaw:item=ck_d8c93e09 -->
- [ ] npm run perf:board and perf:list; quote the filter trace numbers <!-- longclaw:item=ck_ba5deffe -->
- [ ] npm run verify <!-- longclaw:item=ck_a355d044 -->

## Activity

<!-- longclaw:event
id: evt_cde66c79
kind: create
occurred_at: 2026-08-28T12:01:24.343Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
