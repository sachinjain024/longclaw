/**
 * The four properties, read the way a surface reads them.
 *
 * Two things this suite exists to pin, because both are silent when wrong.
 *
 * **The year rule.** A form with no year means the nearest future occurrence,
 * so a field showing the short form of a past date reads back a year out. That
 * is not a rendering nit: it moves a date without telling anyone, and only the
 * `fieldDate` cases below stand between it and a shipped build.
 *
 * **Nothing derived from a rung is a height.** `dueRung` reads status and the
 * day, both of which change with no file write, so every call site has to be
 * one that redraws rather than one that measures.
 */

import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  displayDate,
  dueChipText,
  dueRung,
  echoDate,
  estimateMinutes,
  estimateScale,
  fieldDate,
  fromIso,
  NO_PROPERTIES,
  parseDate,
  readEstimate,
  startOfDay,
  toIso,
  untilNextDay,
} from "./properties";
import type { EstimateConfig } from "./types";

/** Tuesday 8 September 2026, local, which is the day the prototype was read on. */
const NOW = new Date(2026, 8, 8, 14, 30).getTime();

function on(text: string): string | undefined {
  const parsed = parseDate(text, NOW);
  return parsed.kind === "date" ? toIso(parsed.date) : undefined;
}

function refusal(text: string): string {
  const parsed = parseDate(text, NOW);
  if (parsed.kind !== "refused") {
    throw new Error(`${text} was not refused: ${JSON.stringify(parsed)}`);
  }
  return parsed.why;
}

describe("a stored date", () => {
  it("is exactly YYYY-MM-DD, and a real day", () => {
    expect(toIso(fromIso("2026-09-28") as Date)).toBe("2026-09-28");
    expect(fromIso("2024-02-29")).toBeInstanceOf(Date);
    // Refused rather than rolled over into 3 March, which is the whole point:
    // a reader that repairs a value writes a day nobody chose.
    expect(fromIso("2026-02-31")).toBeUndefined();
    expect(fromIso("2026-9-8")).toBeUndefined();
    expect(fromIso("28 Sep 2026")).toBeUndefined();
    expect(fromIso("")).toBeUndefined();
  });

  it("counts whole calendar days, never hours", () => {
    // 23:30 on one day to 00:30 the next is one day apart, not zero.
    const late = new Date(2026, 8, 8, 23, 30);
    const early = new Date(2026, 8, 9, 0, 30);
    expect(daysBetween(late, early)).toBe(1);
    expect(daysBetween(startOfDay(NOW), new Date(2026, 8, 8, 23, 59))).toBe(0);
  });
});

/**
 * Midnight is the one thing that changes every rung on screen and writes no
 * file, so nothing pushes it: the watcher reports files, and the app's other
 * clock runs only while a change is unreviewed. A board left open overnight
 * with nothing acknowledged would be drawing yesterday in the morning.
 */
describe("the wait until the day changes", () => {
  it("lands just after the next local midnight, whatever the hour", () => {
    for (const hour of [0, 1, 9, 12, 23]) {
      const at = new Date(2026, 8, 8, hour, 17, 42).getTime();
      const fires = at + untilNextDay(at);
      expect(fires).toBeGreaterThan(new Date(2026, 8, 9).getTime());
      // And not into the day after, which would skip a day of rungs.
      expect(fires).toBeLessThan(new Date(2026, 8, 10).getTime());
    }
  });

  /**
   * Calendar arithmetic rather than a fixed day length: a day is 23 or 25 hours
   * twice a year, and a timer set to 86,400,000ms drifts across both and then
   * keeps the drift. This holds across every day of a year rather than naming a
   * transition date, because which days those are depends on where the machine
   * running the test is.
   */
  it("crosses a short or long day without drifting", () => {
    for (let day = 0; day < 365; day += 1) {
      const at = new Date(2026, 0, 1 + day, 13, 0).getTime();
      const fires = new Date(at + untilNextDay(at));
      const tomorrow = addDays(startOfDay(at), 1);
      expect(startOfDay(fires).getTime()).toBe(tomorrow.getTime());
    }
  });
});

describe("the date grammar", () => {
  it("takes ISO, and a named month in either order", () => {
    expect(on("2026-09-28")).toBe("2026-09-28");
    expect(on("28 Sep 2026")).toBe("2026-09-28");
    expect(on("Sep 28, 2026")).toBe("2026-09-28");
    expect(on("28 September 2026")).toBe("2026-09-28");
    expect(on("28-Sep-2026")).toBe("2026-09-28");
    expect(on("28th sep 2026")).toBe("2026-09-28");
    expect(on("  28   SEP   2026 ")).toBe("2026-09-28");
  });

  it("takes the two words a person types instead of thinking", () => {
    expect(on("today")).toBe("2026-09-08");
    expect(on("tomorrow")).toBe("2026-09-09");
  });

  it("reads a form with no year as the nearest future occurrence", () => {
    // Ahead in the same year.
    expect(on("28 Sep")).toBe("2026-09-28");
    // Today counts as future: the one boundary the rule has to state itself.
    expect(on("8 Sep")).toBe("2026-09-08");
    // Behind, so next year — and this is the price the year rule pays.
    expect(on("5 Sep")).toBe("2027-09-05");
    expect(on("1 Jan")).toBe("2027-01-01");
  });

  it("walks forward to a year that has 29 February", () => {
    // 2027 has none, and refusing a day that plainly exists would be worse
    // than landing on the next one that does.
    expect(on("29 Feb")).toBe("2028-02-29");
  });

  it("refuses every form that would need a locale, and says what to type", () => {
    expect(refusal("28/09/2026")).toContain("YYYY-MM-DD");
    expect(refusal("09/28/2026")).toContain("YYYY-MM-DD");
    expect(refusal("3/4")).toContain("YYYY-MM-DD");
  });

  it("refuses a two-digit year, a bare month, and a computed date", () => {
    expect(refusal("28 Sep 26")).toContain("in full");
    expect(refusal("Sep")).toContain("A month on its own");
    expect(refusal("September")).toContain("A month on its own");
    expect(refusal("Friday")).toContain("not computed");
    expect(refusal("next week")).toContain("not computed");
    expect(refusal("in 3 days")).toContain("not computed");
  });

  it("refuses anything carrying a time", () => {
    expect(refusal("28 Sep 5pm")).toContain("no time on it");
    expect(refusal("2026-09-28T00:00:00Z")).toContain("no time on it");
  });

  it("refuses a day that does not exist without repairing it", () => {
    expect(refusal("31 Sep 2026")).toContain("does not exist");
    expect(refusal("2026-02-31")).toContain("does not exist");
  });

  it("reads an empty field as cleared rather than as a refusal", () => {
    expect(parseDate("", NOW).kind).toBe("empty");
    expect(parseDate("   ", NOW).kind).toBe("empty");
  });
});

describe("what a date is shown as", () => {
  it("keeps a card short, and carries the year only across one", () => {
    expect(displayDate(new Date(2026, 8, 28), NOW)).toBe("28 Sep");
    expect(displayDate(new Date(2027, 8, 28), NOW)).toBe("28 Sep 2027");
    // A card is only read, so the past keeps the short form.
    expect(displayDate(new Date(2026, 8, 5), NOW)).toBe("5 Sep");
  });

  /**
   * The correction the prototype made to the settled grammar, and the reason
   * this file exists: `5 Sep` in a field on 8 Sep 2026 reads back as 2027.
   */
  it("makes a field round-trip, which means the year on a past date", () => {
    expect(fieldDate(new Date(2026, 8, 28), NOW)).toBe("28 Sep");
    expect(fieldDate(new Date(2026, 8, 8), NOW)).toBe("8 Sep");
    expect(fieldDate(new Date(2026, 8, 5), NOW)).toBe("5 Sep 2026");
    expect(fieldDate(new Date(2027, 8, 28), NOW)).toBe("28 Sep 2027");
  });

  it("shows every field it renders as a day the grammar reads back", () => {
    for (const offset of [-400, -30, -1, 0, 1, 30, 400]) {
      const day = new Date(2026, 8, 8 + offset);
      expect(on(fieldDate(day, NOW))).toBe(toIso(day));
    }
  });

  it("says the weekday and the year in the echo, which is what makes the rule visible", () => {
    expect(echoDate(new Date(2027, 8, 5))).toBe("Sun 5 Sep 2027");
  });
});

describe("the rungs", () => {
  const rung = (iso: string, attention = 7) =>
    dueRung(iso, NOW, attention, "todo", false);

  it("escalates by whole days from the reader's own day", () => {
    expect(rung("2026-09-07")).toBe("overdue");
    expect(rung("2026-09-08")).toBe("today");
    expect(rung("2026-09-09")).toBe("approaching");
    expect(rung("2026-09-15")).toBe("approaching");
    expect(rung("2026-09-16")).toBe("beyond");
  });

  it("empties the approaching rung at zero, which is legal", () => {
    expect(rung("2026-09-09", 0)).toBe("beyond");
    expect(rung("2026-09-08", 0)).toBe("today");
    expect(rung("2026-09-07", 0)).toBe("overdue");
  });

  /**
   * A finished ticket that was due last week is not overdue, it is finished,
   * and a Done column drawn in the danger hue teaches people to ignore the
   * colour that was supposed to mean something.
   */
  it("stands down on a ticket that is done, canceled or archived", () => {
    expect(dueRung("2026-09-01", NOW, 7, "done", false)).toBe("beyond");
    expect(dueRung("2026-09-01", NOW, 7, "canceled", false)).toBe("beyond");
    expect(dueRung("2026-09-01", NOW, 7, "todo", true)).toBe("beyond");
    // The date still shows, plainly: standing down is not hiding.
    expect(dueChipText(fromIso("2026-09-01") as Date, NOW, "beyond")).toBe(
      "1 Sep",
    );
  });

  it("has no rung for a value it cannot read", () => {
    expect(dueRung(undefined, NOW, 7, "todo", false)).toBeUndefined();
    expect(dueRung("28 Sep 2026", NOW, 7, "todo", false)).toBeUndefined();
    expect(dueRung("2026-02-31", NOW, 7, "todo", false)).toBeUndefined();
  });

  it("says the shortest true thing on a chip", () => {
    const chip = (iso: string) => {
      const day = fromIso(iso) as Date;
      return dueChipText(
        day,
        NOW,
        dueRung(iso, NOW, 7, "todo", false) as never,
      );
    };
    expect(chip("2026-09-05")).toBe("3d overdue");
    expect(chip("2026-09-08")).toBe("Today");
    expect(chip("2026-09-11")).toBe("in 3d");
    expect(chip("2026-10-20")).toBe("20 Oct");
  });
});

describe("the estimate", () => {
  const tshirt: EstimateConfig = {
    enabled: true,
    system: "tshirt",
    values: ["xs", "s", "m", "l", "xl"],
    hoursPerDay: 8,
    daysPerWeek: 5,
  };
  const fibonacci: EstimateConfig = { ...tshirt, system: "fibonacci" };
  const duration: EstimateConfig = { ...tshirt, system: "duration" };

  it("reads only what the project's own system can read", () => {
    expect(readEstimate("m", tshirt)).toEqual({ kind: "known", text: "M" });
    expect(readEstimate("5", fibonacci)).toEqual({ kind: "known", text: "5" });
    expect(readEstimate("1.5d", duration)).toEqual({
      kind: "known",
      text: "1.5d",
    });
  });

  /**
   * Invariant 16, on screen: switching systems rewrites no ticket, so a value
   * written under the old one has to render as something rather than vanish.
   */
  it("calls a value from another system foreign rather than dropping it", () => {
    expect(readEstimate("2h", tshirt)).toEqual({ kind: "foreign", text: "2h" });
    expect(readEstimate("m", duration)).toEqual({ kind: "foreign", text: "m" });
    expect(readEstimate("4", fibonacci)).toEqual({
      kind: "foreign",
      text: "4",
    });
    expect(readEstimate("1d4h", duration)).toEqual({
      kind: "foreign",
      text: "1d4h",
    });
    expect(readEstimate(undefined, duration)).toBeUndefined();
  });

  it("orders durations through the project's own conversion", () => {
    expect(estimateMinutes("30m", duration)).toBe(30);
    expect(estimateMinutes("2h", duration)).toBe(120);
    expect(estimateMinutes("1d", duration)).toBe(480);
    expect(estimateMinutes("1w", duration)).toBe(2400);
    // The reason it is a project setting: on a six-hour day, 1d is under 4h+3h.
    const shortDay: EstimateConfig = { ...duration, hoursPerDay: 6 };
    expect(estimateMinutes("1d", shortDay)).toBe(360);
    expect(estimateMinutes("m", duration)).toBeUndefined();
  });

  it("offers each system its own scale, in the scale's order", () => {
    expect(estimateScale(tshirt)).toEqual(["xs", "s", "m", "l", "xl"]);
    expect(estimateScale(fibonacci)).toEqual(["1", "2", "3", "5", "8", "13"]);
    expect(estimateScale(duration)[0]).toBe("30m");
  });
});

describe("a project that has turned nothing on", () => {
  it("is what a file with no properties block reads as", () => {
    expect(NO_PROPERTIES.type.enabled).toBe(false);
    expect(NO_PROPERTIES.due.enabled).toBe(false);
    expect(NO_PROPERTIES.start.enabled).toBe(false);
    expect(NO_PROPERTIES.estimate.enabled).toBe(false);
    // The documented defaults stand even while the property is off, so turning
    // one on does not also have to invent its configuration.
    expect(NO_PROPERTIES.due.attentionDays).toBe(7);
    expect(NO_PROPERTIES.estimate.hoursPerDay).toBe(8);
    expect(NO_PROPERTIES.estimate.daysPerWeek).toBe(5);
  });
});
