import { describe, expect, it } from "vitest";
import { STATUSES, ticketKeyQuery, ticketPath } from "./tickets";

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
    // `core/storage.rs:102`: a ticket key belongs to a project only when its
    // prefix is that project's key, so `AB-1` is not a ticket of `LC` to find.
    expect(ticketKeyQuery("AB-1", "LC")).toBeUndefined();
    expect(ticketKeyQuery("L-1", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LCX-1", "LC")).toBeUndefined();
  });

  it("refuses anything the key grammar refuses", () => {
    // `core/storage.rs:74`: `<PREFIX>-<n>`, and `n` has no leading zeros.
    expect(ticketKeyQuery("LC-007", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC-0", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC-", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC-1a", "LC")).toBeUndefined();
    expect(ticketKeyQuery("LC", "LC")).toBeUndefined();
    expect(ticketKeyQuery("", "LC")).toBeUndefined();
    expect(ticketKeyQuery("search", "LC")).toBeUndefined();
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
