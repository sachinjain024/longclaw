import { describe, expect, it } from "vitest";

import { STAR_INTERVAL_MS } from "./github";
import { isFetchDue } from "./starCount";

const NOW = Date.parse("2026-09-21T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("when a count is worth asking for again", () => {
  it("is due when nothing has ever been fetched", () => {
    expect(isFetchDue(undefined, NOW)).toBe(true);
  });

  it("is not due inside the slot", () => {
    expect(isFetchDue(ago(0), NOW)).toBe(false);
    expect(isFetchDue(ago(STAR_INTERVAL_MS - 1), NOW)).toBe(false);
  });

  it("is due once the slot is up", () => {
    expect(isFetchDue(ago(STAR_INTERVAL_MS), NOW)).toBe(true);
    expect(isFetchDue(ago(STAR_INTERVAL_MS * 3), NOW)).toBe(true);
  });

  it("is due when the timestamp will not parse", () => {
    // The count and its timestamp are written together, so a half of the pair
    // is a hand-edited file. The honest reading of an unreadable timestamp is
    // that nothing is known about when the number came from.
    expect(isFetchDue("whenever", NOW)).toBe(true);
    expect(isFetchDue("", NOW)).toBe(true);
  });

  it("is due when the clock has gone backwards past the timestamp", () => {
    // Not a retry loop: Rust holds its own slot, so a machine whose clock
    // jumped still makes at most one request a day.
    expect(isFetchDue(new Date(NOW + 60_000).toISOString(), NOW)).toBe(false);
  });
});
