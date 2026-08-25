/**
 * The content header's filter (`screen-specs.md:67`).
 *
 * ## Where this sits
 *
 * Before grouping, and deliberately not inside it. `groupByStatus` already
 * returns fewer tickets than it was given because V0-11 put the archived
 * exclusion there, and that exclusion is a statement *about status*: archived is
 * a date and not a status (ADR 0004), so a ticket carrying one has no bucket. A
 * filter says nothing about status — it says which rows the human asked to see —
 * so it narrows the array once in `App.tsx` and both surfaces receive the result.
 * One narrowing, two projections, no chance of the board and the list disagreeing
 * about what a query means.
 *
 * ## The rule
 *
 * A lowercased, whitespace-collapsed substring over the row's key, title, and
 * label slugs.
 *
 * That is `TicketIndex::search`'s rule (`src-tauri/src/core/index.rs:180-199`)
 * minus the description, because a `TicketRow` does not carry one and putting a
 * bounded copy of every description on every row would grow every snapshot for a
 * field no surface renders. **This runs here rather than through `search_tickets`
 * for a reason that is not only speed:** that command truncates at 100 results,
 * which is correct for a search and a lie for a filter — the 101st match would
 * leave the board without saying so. V0-24 builds the search surface, and it is
 * the one that should call the indexed command: a filter narrows what is in front
 * of you, a search finds a ticket anywhere, including by its description.
 *
 * ## Unreadable files
 *
 * A degraded row is never filtered out. A file this build cannot parse has no
 * text to compare, so "the query does not match it" is a claim the app is not
 * entitled to make; dropping it would hide a broken file behind a query. This is
 * the one place the rule here differs from Rust's on purpose — `search` matches a
 * degraded record on its key alone, which is right for a needle and wrong for a
 * decision about what the whole surface shows.
 */

import type { IndexedTicket, TicketRow } from "./types";

/** Lowercase, and one space between words: the query and the row agree on both. */
function collapse(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}

/**
 * The text of a row, built once per row object.
 *
 * The store replaces only the rows that changed, so a keystroke over 5,000
 * tickets re-uses 5,000 cached strings and builds none.
 */
const searchText = new WeakMap<IndexedTicket, string>();

function textOf(ticket: IndexedTicket): string {
  const held = searchText.get(ticket);
  if (held !== undefined) return held;
  const built = collapse(
    [ticket.key, ticket.title, ...ticket.labels].join(" "),
  );
  searchText.set(ticket, built);
  return built;
}

/**
 * The rows a query leaves on screen, in the order they arrived.
 *
 * An empty query returns the array it was given, so the surfaces below see the
 * identity they already memoized on.
 */
export function filterTickets(
  tickets: TicketRow[],
  query: string,
): TicketRow[] {
  const needle = collapse(query);
  if (needle === "") return tickets;
  return tickets.filter(
    (ticket) => ticket.state !== "indexed" || textOf(ticket).includes(needle),
  );
}

/** True when there is a query to clear — the last rung of the `Esc` ladder. */
export function isFiltering(query: string): boolean {
  return collapse(query) !== "";
}
