import { describe, expect, it } from "vitest";
import {
  provisionalTicketKey,
  splitTicketKey,
  STATUSES,
  ticketKeyNames,
  ticketKeyQuery,
  ticketPath,
} from "./tickets";
import type { TicketRow } from "./types";
// The same import `projectKey.test.ts` uses, so both halves of the fixture are
// read the one way.
import grammar from "../../../fixtures/project-key-grammar.json";

/**
 * LC-171. The two decisions the ticket asked to be made rather than assumed:
 * a bare number counts, and a foreign prefix does not.
 */
describe("a query shaped like a ticket key", () => {
  it("reads this project's key in whatever case it was typed", () => {
    expect(ticketKeyQuery("LC-60", "LC")).toBe("LC-60");
    expect(ticketKeyQuery("lc-60", "LC")).toBe("LC-60");
    expect(ticketKeyQuery("  Lc-60  ", "LC")).toBe("LC-60");
  });

  it("takes a bare number as this project's ticket", () => {
    expect(ticketKeyQuery("60", "LC")).toBe("LC-60");
    expect(ticketKeyQuery(" 7 ", "ABC")).toBe("ABC-7");
  });

  it("refuses a foreign prefix, which this project cannot hold", () => {
    // `core/storage.rs:163`: a ticket key belongs to a project only when its
    // prefix is that project's key, so `AB-1` is not a ticket of `LC` to find.
    expect(ticketKeyQuery("AB-1", "LC")).toBeUndefined();
    expect(ticketKeyQuery("L-1", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LCX-1", "LC")).toBeUndefined();
  });

  it("refuses anything the key grammar refuses", () => {
    // `core/storage.rs:92`: `<PREFIX>-<n>` or `<PREFIX>-<n><s>`, `n` without
    // leading zeros and `s` a single lowercase letter.
    expect(ticketKeyQuery("LC-007", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC-0", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC-", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC-1ab", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC", "LC")).toBeUndefined();
    expect(ticketKeyQuery("", "LC")).toBeUndefined();
    expect(ticketKeyQuery("search", "LC")).toBeUndefined();
  });

  /**
   * LC-232. A key minted from 2026-08-25 carries a trailing character drawn at
   * random, and `LC-1` … `LC-233` do not — so both forms reach the palette, and
   * the number is the part a person has when they type one.
   */
  it("takes a key that carries a trailing character", () => {
    expect(ticketKeyQuery("LC-211p", "LC")).toBe("LC-211p");
    expect(ticketKeyQuery("lc-211P", "LC")).toBe("LC-211p");
    expect(ticketKeyQuery("  LC-211p  ", "LC")).toBe("LC-211p");
  });
});

/**
 * The half that decides which row a resolved query names. LC-232 put a drawn
 * character on the end of every new key, so the exact string match the palette
 * used would have made a ticket unfindable by the number people actually quote.
 */
describe("the ticket a resolved key names", () => {
  it("names a suffixed ticket by its number alone", () => {
    expect(ticketKeyNames("LC-234", "LC-234x")).toBe(true);
    expect(ticketKeyNames("LC-234x", "LC-234x")).toBe(true);
    expect(ticketKeyNames("LC-233", "LC-233")).toBe(true);
  });

  it("lets the character pick between two tickets sharing a number", () => {
    // Not a broken state: it is what two branches landing on 234 look like
    // after they merge without colliding.
    expect(ticketKeyNames("LC-234q", "LC-234x")).toBe(false);
    expect(ticketKeyNames("LC-234q", "LC-234q")).toBe(true);
  });

  it("still refuses the longer number the exact match was written for", () => {
    // LC-171's rule survives the suffix: `LC-6` must not offer `LC-60`.
    expect(ticketKeyNames("LC-6", "LC-60")).toBe(false);
    expect(ticketKeyNames("LC-6", "LC-60p")).toBe(false);
  });

  it("refuses a trailing character that is not the one the ticket carries", () => {
    expect(ticketKeyNames("LC-234x", "LC-234y")).toBe(false);
    expect(ticketKeyNames("LC-234x", "LC-234")).toBe(false);
  });
});

/**
 * The optimistic key a card wears until the write comes back. LC-232's silent
 * break: the old regex refused every suffixed row, so once every ticket carried
 * a character the maximum was zero and every new card claimed to be `LC-1`.
 */
describe("the key a create guesses", () => {
  const row = (key: string): TicketRow =>
    ({ kind: "indexed", key }) as unknown as TicketRow;

  it("reads the number off suffixed rows as readily as bare ones", () => {
    expect(provisionalTicketKey("LC", [row("LC-7q"), row("LC-40b")])).toBe(
      "LC-41",
    );
    expect(provisionalTicketKey("LC", [row("LC-7"), row("LC-40b")])).toBe(
      "LC-41",
    );
    expect(provisionalTicketKey("LC", [])).toBe("LC-1");
  });

  it("counts only this project's rows", () => {
    expect(provisionalTicketKey("LC", [row("ZZ-98p"), row("LC-3")])).toBe(
      "LC-4",
    );
  });
});

/**
 * The shared case table, read by this side too. Rust asserts the same rows
 * against `valid_ticket_key` in `tests/project_key_grammar.rs`; before LC-232
 * only Rust read them, and the frontend's own copy of the grammar drifted
 * without anything failing.
 */
describe("the shared ticket-key grammar", () => {
  const fixture = grammar as {
    ticketKeys: { ticketKey: string; valid: boolean; note?: string }[];
    ticketKeySuffix: { mintingAlphabet: string; length: number };
  };

  it("looks up every key the format calls valid", () => {
    const valid = fixture.ticketKeys.filter((row) => row.valid);
    expect(valid.length).toBeGreaterThan(4);
    for (const { ticketKey, note } of valid) {
      // Each row is looked up from its own project, which is the only project
      // the palette ever runs against.
      const projectKey = splitTicketKey(ticketKey)?.prefix;
      expect(
        projectKey,
        `${ticketKey} comes apart: ${note ?? ""}`,
      ).toBeDefined();
      expect(
        ticketKeyQuery(ticketKey, projectKey as string),
        `${ticketKey} is a key the format accepts, so the palette must find it`,
      ).toBe(ticketKey);
    }
  });

  /**
   * The rows the fixture refuses are the *directory* grammar's, and this side
   * does not enforce all of it — `lc-42` is refused as a folder name and
   * accepted as something to type (LC-171). What both sides do agree on is
   * shape, so these are the rows that are shape and not case or ownership.
   */
  it("refuses the shapes that are not keys at all", () => {
    for (const shape of [
      "LC-0",
      "LC-",
      "-42",
      "LC-42-1",
      "../LC-42",
      "LC/42",
    ]) {
      expect(
        ticketKeyQuery(shape, "LC"),
        `${shape} is not a key of LC`,
      ).toBeUndefined();
    }
  });

  it("reads every character the allocator can draw", () => {
    const { mintingAlphabet, length } = fixture.ticketKeySuffix;
    expect(length).toBe(1);
    for (const character of mintingAlphabet) {
      expect(ticketKeyQuery(`LC-211${character}`, "LC")).toBe(
        `LC-211${character}`,
      );
    }
  });
});

describe("status vocabulary", () => {
  it("matches the fixed v0 set in board order", () => {
    expect(STATUSES.map((status) => status.id)).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "canceled",
    ]);
  });
});

/**
 * LC-222: the path the context menu's Copy file path row puts on the
 * clipboard. What the row carries is the ticket's `relativePath` — which is
 * relative to the project folder and identical for tickets in different
 * projects — so the row is only worth having if it copies the whole path.
 */
describe("a ticket's path on disk", () => {
  it("joins the project's folder to the ticket's own path", () => {
    expect(
      ticketPath("/Users/x/work", ".longclaw/tickets/LC-1/ticket.md"),
    ).toBe("/Users/x/work/.longclaw/tickets/LC-1/ticket.md");
  });

  it("does not double the separator a stored folder ends with", () => {
    expect(
      ticketPath("/Users/x/work/", ".longclaw/tickets/LC-1/ticket.md"),
    ).toBe("/Users/x/work/.longclaw/tickets/LC-1/ticket.md");
  });

  it("copies an already absolute path as it stands", () => {
    // Nothing writes one today, and a path that has one root is not improved
    // by being given a second.
    expect(ticketPath("/Users/x/work", "/elsewhere/ticket.md")).toBe(
      "/elsewhere/ticket.md",
    );
  });
});
