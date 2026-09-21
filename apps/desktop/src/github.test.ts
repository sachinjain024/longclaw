import { describe, expect, it } from "vitest";

import {
  GITHUB_COPY,
  GITHUB_REPO,
  STAR_FLOOR,
  countText,
  showsCount,
  starAria,
} from "./github";

describe("the count as it is drawn", () => {
  it("writes small numbers out", () => {
    expect(countText(0)).toBe("0");
    expect(countText(51)).toBe("51");
    expect(countText(847)).toBe("847");
    expect(countText(999)).toBe("999");
  });

  it("abbreviates at a thousand, to one decimal", () => {
    expect(countText(1000)).toBe("1k");
    expect(countText(1284)).toBe("1.3k");
    expect(countText(12_400)).toBe("12.4k");
  });

  it("drops a trailing zero rather than drawing 1.0k", () => {
    expect(countText(1049)).toBe("1k");
    expect(countText(2000)).toBe("2k");
  });

  it("keeps the mark's width stable as the count grows", () => {
    // The bar has about 40px for this. Five digits would be a different width
    // every week; four characters is the cap the abbreviation buys.
    for (const stars of [1000, 12_400, 124_000, 999_000]) {
      expect(countText(stars).length).toBeLessThanOrEqual(6);
    }
  });
});

describe("the floor", () => {
  it("draws no number below it", () => {
    expect(showsCount(0)).toBe(false);
    expect(showsCount(1)).toBe(false);
    expect(showsCount(STAR_FLOOR - 1)).toBe(false);
  });

  it("draws one at it and above", () => {
    expect(showsCount(STAR_FLOOR)).toBe(true);
    expect(showsCount(1284)).toBe(true);
  });

  it("treats a missing count as the same state as one under the floor", () => {
    // The control has one no-count state, not two. Offline, rate limited and
    // young are the same picture on purpose.
    expect(showsCount(undefined)).toBe(false);
    expect(starAria(undefined)).toBe(starAria(1));
  });

  it("holds up the plural in the spoken label", () => {
    // `{n} stars` is always right at or above the floor. This is the assertion
    // that fails if someone lowers it under 2 without adding a singular form.
    expect(STAR_FLOOR).toBeGreaterThan(1);
  });
});

describe("what the control reads out", () => {
  it("says what it is and that the press leaves the app", () => {
    // In the status bar there is no visible label, so this string is the whole
    // offer and the only warning that a browser is about to open.
    expect(GITHUB_COPY.aria).toContain("Star LongClaw on GitHub");
    expect(GITHUB_COPY.aria).toContain("Opens github.com in your browser");
  });

  it("speaks the full grouped number rather than the abbreviated one", () => {
    expect(starAria(1284)).toContain("1,284 stars");
    expect(starAria(1284)).not.toContain("1.3k");
  });

  it("names the repository in the title, spelled once", () => {
    expect(GITHUB_COPY.title).toBe(`github.com/${GITHUB_REPO}`);
    expect(GITHUB_COPY.title).not.toContain("{");
  });

  it("claims nothing about why an open failed", () => {
    expect(GITHUB_COPY.openFailed).toBe("Couldn’t open GitHub.");
  });

  it("says Open rather than Star in the palette", () => {
    // `Star project` is already a palette row. Two rows starting `Star` would
    // sort together under the same three keystrokes.
    expect(GITHUB_COPY.palette).toBe("Open LongClaw on GitHub");
  });
});
