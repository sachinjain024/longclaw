import { describe, expect, it } from "vitest";
import { isAppRank, rankBetween } from "./rank";

/** Rebuilds the order a column would show, so a claim is about the order. */
function ordered(ranks: string[]): string[] {
  return [...ranks].sort();
}

describe("allocating a rank", () => {
  it("gives the first manually ordered card in a column a rank", () => {
    expect(rankBetween(undefined, undefined)).toBe("a0");
  });

  it("lands strictly between two neighbours", () => {
    const between = rankBetween("a0", "a1");

    expect(between > "a0").toBe(true);
    expect(between < "a1").toBe(true);
    // The shape `file_format.md:66` documents, and not by coincidence: `a0V` is
    // what this algorithm allocates in the very first gap it is asked about.
    expect(between).toBe("a0V");
  });

  it("stays short when a card is dropped at the tail again and again", () => {
    let last = rankBetween(undefined, undefined);
    const all = [last];
    for (let index = 0; index < 500; index += 1) {
      last = rankBetween(last, undefined);
      all.push(last);
    }

    expect(ordered(all)).toEqual(all);
    expect(last.length).toBeLessThanOrEqual(4);
  });

  it("stays short when a card is dropped at the head again and again", () => {
    let first = rankBetween(undefined, undefined);
    const all = [first];
    for (let index = 0; index < 500; index += 1) {
      first = rankBetween(undefined, first);
      all.unshift(first);
    }

    expect(ordered(all)).toEqual(all);
    expect(first.length).toBeLessThanOrEqual(4);
  });

  it("grows a character at a time in the one gap that cannot avoid it", () => {
    // Repeatedly splitting the same gap has to spend key length — there is no
    // scheme that does not. What matters is that it spends it slowly and never
    // collides.
    const lower = "a0";
    let upper = "a1";
    const all = [lower, upper];
    for (let index = 0; index < 200; index += 1) {
      upper = rankBetween(lower, upper);
      all.push(upper);
    }

    expect(new Set(all).size).toBe(all.length);
    expect(all.slice(1).every((rank) => rank > lower)).toBe(true);
    expect(upper.length).toBeLessThanOrEqual(45);
  });

  it("keeps a thousand splits of a random gap in order", () => {
    const ranks = [rankBetween(undefined, undefined)];
    for (let index = 0; index < 1_000; index += 1) {
      const at = (index * 7919) % (ranks.length + 1);
      const next = rankBetween(ranks[at - 1], ranks[at]);
      ranks.splice(at, 0, next);
    }

    expect(new Set(ranks).size).toBe(ranks.length);
    expect(ordered(ranks)).toEqual(ranks);
  });
});

describe("a rank this app did not write", () => {
  it("does not recognise one that is not in its alphabet", () => {
    // A LexoRank string, which `core/ticket.rs` already has a test writing.
    expect(isAppRank("0|hzzzzz:")).toBe(false);
    expect(isAppRank("")).toBe(false);
    // A bare fraction with no integer part header.
    expect(isAppRank("V")).toBe(false);
    // A trailing zero is a second spelling of the same position, so it is not
    // one of ours: allocation depends on there being only one.
    expect(isAppRank("a0V0")).toBe(false);
    expect(isAppRank("a0V")).toBe(true);
    expect(isAppRank("a0")).toBe(true);
  });

  it("is never used as a bound, and never rewritten", () => {
    // The format contract says agents preserve ranks and do not invent them, so
    // the app must not repair one it did not generate either. It cannot be
    // arithmetic, so it is simply not a bound.
    const next = rankBetween("0|hzzzzz:", undefined);

    expect(isAppRank(next)).toBe(true);
    expect(next).toBe("a0");
  });

  it("falls back to the lower bound when the two are not in order", () => {
    // Two tickets somehow sharing a rank cannot be split. The card lands just
    // after the pair rather than the allocation failing.
    const next = rankBetween("a1", "a1");

    expect(next > "a1").toBe(true);
  });

  it("falls back when the neighbours are the wrong way round", () => {
    const next = rankBetween("a2", "a1");

    expect(next > "a2").toBe(true);
  });
});
