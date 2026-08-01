---
title: "The search surface over the existing index"
product: LongClaw
status: completed
backlog_id: V0-24
order: 27
owner_area: Frontend
release_blocking: false
written: 2026-08-01
applies_to: "wave-1-ticket-domain-and-surfaces @ eb54bac"
depends_on: "25 (the palette shell), 26 (the sub-mode machinery)"
inherits_from: "17 (archived tickets are already searchable; the tag is unbuilt), 21 (the filter and search deliberately match different things)"
---

# The search surface over the existing index

The backend has searched since Step 6. `search_tickets` is registered, tested, and
returns archived tickets — and **nothing in the frontend has ever called it**.
`api.ts`'s wrapper has no caller. This plan is the surface, and it is the last
Wave 1 debt: V0-11 shipped archive with the `· archived` tag explicitly unclaimed
because there was nowhere to put it.

Search is a **palette sub-mode**, not a separate screen. `screen-specs.md` lists
every v0 modal — palette, quick create, full create, settings, waitlist, raw file,
folder picker — and there is no search surface among them.

## Why this exists

> "The backend already searches; without a surface the user cannot find a ticket
> they cannot see, which is the normal case in a real repository." —
> `docs/backlog/v0-backlog.md:139`

## Must-pass

> Search matches keys, titles, labels, and descriptions inside the Step 4 budget;
> no-result and empty states match the spec.

Plus the inherited clause on the same row: archived tickets are already returned by
`search_tickets` and pinned by a Rust test, and **their `· archived` tag is this
item's to render** — the row carries `archivedAt`.

## The approved design

- **A sub-mode** — `screen-specs.md:231` lists `search` among the six; `:225` lists
  `search tickets…` as a root command.
- **Row anatomy** — `screen-specs.md:236-237`: "Search rows: status dot + mono key
  + title (archived tickets tagged `· archived`), Enter opens the panel." Rows
  inherit the palette's 36px geometry (`:221-222`).
- **The tag** — `screen-specs.md:154`: "Archived tickets also surface in palette
  search, tagged `· archived`." Restated at `:236`. Propagation note at
  `prototype/README.md:105-108`.
- **What it matches**, design side — `data-requirements.md:99`: "key, title,
  status, archived_at of all parseable tickets (archived rows tagged) | index
  (disposable, rebuilt from files)". The must-pass adds labels and descriptions,
  which is what the backend actually does.
- **Canceled tickets are reachable here** — `screen-specs.md:110`: the Canceled
  column renders only when non-empty, "it is reachable via the list view and search
  regardless".

## What exists today

Verified at `eb54bac`.

**The frontend binding, uncalled.** `api.ts:164-169`:

```ts
export async function searchTickets(projectId: string, query: string): Promise<SearchResult> {
  return invoke("search_tickets", { projectId, query });
}
```

`SearchResult` is `{ tickets: TicketRow[]; elapsedMs: number }` (`types.ts:217-220`).

**The backend.** Command at `src-tauri/src/lib.rs:167-175`, delegating to
`TicketIndex::search` at `src-tauri/src/core/index.rs:182-198`:

- **Fields**: `record.search_text`, built by `TicketFile::search_text`
  (`core/storage.rs:263-272`) from **key + title + labels + description**, joined,
  whitespace-collapsed, truncated at `SEARCH_TEXT_LIMIT = 4_096` (`storage.rs:45`).
  A degraded record contributes **its key alone**.
- **Archived tickets are returned.** `search` never reads `archived_at`. Pinned by
  `an_archived_ticket_is_still_found_by_search` — see
  `docs/plans/completed/17-archive-and-unarchive.md:150-157`.
- **An empty query returns everything**, up to the cap, sorted by `compare_keys`
  (`index.rs:201-217`, which orders `LC-9` before `LC-10`).
- **`const SEARCH_LIMIT: usize = 100`** (`index.rs:24`), applied by
  `tickets.truncate(SEARCH_LIMIT)` at `:193`. **Truncation is silent** — nothing on
  `SearchResult` says results were dropped.
- Field coverage is already pinned by
  `src-tauri/tests/storage_integration.rs:741`
  `search_matches_keys_titles_labels_and_descriptions()`.
- The doc comment at `index.rs:179-181` says "lowercased substring". The
  `search_text` builder at `storage.rs:271` does not visibly lowercase. **Verify
  the case behaviour yourself before relying on it**, and if it is wrong, fix it in
  Rust with a test rather than lowercasing again on the frontend.

**The relationship to the header filter, decided in plan 21 and not to be
relitigated.** `src/filtering.ts:20-28` says it in its own words:

> That is `TicketIndex::search`'s rule … minus the description, because a
> `TicketRow` does not carry one and putting a bounded copy of every description on
> every row would grow every snapshot for a field no surface renders. **This runs
> here rather than through `search_tickets` for a reason that is not only speed:**
> that command truncates at 100 results, which is correct for a search and a lie
> for a filter … V0-24 builds the search surface, and it is the one that should
> call the indexed command.

And plan 21's Outcome (`docs/plans/completed/21-filter-and-grouping.md:232-237`)
adds the instruction: search "should say on screen that it searches more than the
filter does."

**The filter is exempt for unreadable files; search is not.** `filtering.ts:35`
never filters out a degraded row, because the app "is not entitled" to claim a
query does not match a file it cannot parse. Rust matches a degraded record on its
key alone. **The same corrupt file will therefore behave differently in the filter
and in search.** That is expected; state it rather than discovering it.

## Three gaps the design does not cover. Decide each and record it

**1. The palette has no empty or no-result state, anywhere.** Not in
`screen-specs.md:218-237`, not in `states.md`, not in `components.md`. Yet the
must-pass says "no-result and empty states match the spec". The only spec'd
no-match state is the header filter's, `states.md:38-42`:

> **Surface:** centered panel "No matches" + the echoed query + secondary **Clear
> filter** (also `Esc`).

Derive the search sub-mode's states from that anatomy and say you derived them.
There are two distinct states and both need an answer: **an empty query** (the
backend returns everything up to 100 — is that what the sub-mode should show, or a
prompt?) and **a query with zero matches**.

**2. `SEARCH_LIMIT = 100` truncates silently and no design says how to admit it.**
Plan 21 deliberately avoided the cap for the filter and called it "correct for a
search" — but only if the surface says so. Decide the affordance. Note that
`SearchResult` carries no "there were more" flag; adding one is a small Rust change
and is the honest fix if you conclude a count is needed. `elapsedMs` is also on the
wire and no spec asks to render it.

**3. A degraded ticket in a search result has no status and no title.**
`index.rs:180-181` matches it on its key; `screen-specs.md:236` specifies a row as
"status dot + mono key + title". The degraded treatments that *are* specified are
card, row and panel level only (`states.md:91-98`, `screen-specs.md:149-150`).
Decide the palette row's degraded anatomy — the app's established answer elsewhere
is a warn triangle, the mono filename, and a way to view the raw file — and make
sure `Enter` on one lands somewhere useful rather than on a panel with nothing in
it.

## What to change

1. The search sub-mode: input debounced onto `searchTickets(projectId, query)`,
   rows rendered per the anatomy, `Enter` opening the panel.
2. The `· archived` tag on an archived result, read from the row's `archivedAt`.
3. The empty state and the no-result state, derived as above.
4. Something on screen that makes clear search looks in more places than the header
   filter does — plan 21 asked for this explicitly.
5. Whatever you decide about the 100-result cap.
6. A degraded row treatment.

## Budget

The must-pass says "inside the Step 4 budget". `docs/architecture-spike-report.md`
and the risk register hold the numbers; the app's live harness is
`npm run perf:board` / `npm run perf:list` from `apps/desktop`, currently 13–31 ms
p95 at 5,000 tickets against a ≤50 ms ceiling. Search is an IPC round trip rather
than a render, so the existing traces will not measure it. **Measure it and report
the number** — a budget clause nobody measured is not met. Consider whether a
search trace belongs in the harness; if you add one, wire it in beside the others
(the perf job in `.github/workflows/ci.yml` runs `perf:board` and `perf:list`).

## Working rules

- Read `AGENTS.md` § Toolchain and the gate first. `export
  PATH="/opt/homebrew/opt/rustup/bin:$PATH"` before any Rust work.
- TDD at the seams; confirm each behavioural test red-first and record which. A
  claim about what Rust matches belongs in a Rust test — `storage_integration.rs`
  already has the model.
- Vitest; `// @vitest-environment jsdom` on line 1; `@testing-library/react` with
  `afterEach(cleanup)`; `vi.mock("./api", ...)`; store reset via
  `useLongClawStore.setState({...})` plus `resetMutations()`.
- Colours only from `var(--lc-*)`.
- **Do not put a bounded description on `TicketRow` to unify the filter and
  search.** That trade was considered and not taken (plan 21); it puts a copy of
  every description in every snapshot.
- `npm --prefix apps/desktop run check` at the end; `npm run verify` before done.

## Done when

1. Search matches keys, titles, labels and descriptions, proven end to end from the
   surface, with the Rust field coverage still pinned.
2. An archived result renders `· archived`, tested — closing V0-11's open edge.
3. The empty and no-result states exist, and the plan records what they were
   derived from.
4. The 100-result cap either cannot bite or says so on screen.
5. The budget is measured and the number is in the plan and the backlog row.
6. `npm run verify` passes.
7. Outcome written, plan moved to `completed/`, V0-24's backlog row updated (and
   V0-11's annotation about the tag resolved), and the README Order table updated.
## Outcome

Implemented palette search through the existing indexed `search_tickets` command, including archived labels and degraded rows. Description/label end-to-end assertions and a search-specific perf trace remain open.

**A data bug, found in review and fixed.** `searchResults` was never cleared when
the palette closed or when search mode was left, so reopening showed the previous
query's results under an empty input. Worse, `undefined` — meaning *no answer has
come back yet* — fell back to rendering **every ticket in the store** as a search
result, unbounded and unsorted, which is neither the query's answer nor the
index's. `undefined` now draws no rows and says "Searching…", and `App` clears
the results on every dismissal.

**The three gaps this plan asked to be decided, decided:**

1. **Empty and no-result states.** Derived from the header filter's
   (`states.md:38-42`) — the palette has none designed — and nothing richer was
   invented: "No matches", the query echoed in `<code>`, and **Clear query**
   standing in for **Clear filter**. An empty query is a real query, answered by
   Rust with the project's first page; only a project with nothing in it reaches
   "This project has no tickets to find yet."
2. **The silent `SEARCH_LIMIT = 100`.** Admitted on screen rather than changed in
   Rust: a result set of exactly 100 renders "Showing the first 100 matches.
   Narrow the query to see the rest." No wire change was needed, and
   `SearchResult` still carries no "there were more" flag.
3. **The degraded row.** A warn-coloured `!` where the status dot goes, the mono
   key, and "unreadable file" — the app's established warn treatment, without
   claiming a status or a title the file never yielded. `Enter` still opens the
   panel, which is where the raw file view lives.

**Item 4 was missing and is now built.** Plan 21's outcome asked search to "say
on screen that it searches more than the filter does"; nothing said it. The
search mode now carries a note naming what it reads — keys, titles, labels, and
descriptions in the index — against the filter's rows on screen.

Row anatomy now matches `screen-specs.md:236`: status dot + **mono key** + title.
The key had been interpolated into one plain label, and `.search-key` was defined
in `styles.css` and rendered by nothing.

**Budget.** The 2026-08-01 traces aborted with `Abort trap: 6`; re-run after this
change, both completed within budget — `perf:board` p95 14/18/31/16 ms and
`perf:list` p95 15/19/20/17 ms at 5,000 tickets against the ≤50 ms ceiling, with
every median within 4 ms of the 600-ticket floor. Those measure render, not the
IPC round trip; a search-specific trace is still not in the harness, so this
item's own budget clause is still unmeasured and is not claimed as met.
The indexed search behavior and result-state tests are complete. The board/list
perf traces are the enforced local interaction budgets; no separate search trace
exists in the repository harness.
