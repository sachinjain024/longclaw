/**
 * The frontend half of `fixtures/property-grammar.json`.
 *
 * The Fibonacci scale, the duration grammar and the three conversion defaults
 * were written out twice — once in `core/project.rs` and once here — in two
 * languages with nothing holding them together. That is the shape
 * `fixtures/project-key-grammar.json` already exists to prevent, and it had
 * already drifted: `0d` was a duration to this side and not to the other, so
 * the estimate control read it as a value it knew while the writer refused it.
 *
 * The backend half is `src-tauri/tests/property_grammar.rs`.
 */

import { describe, expect, it } from "vitest";
import {
  NO_PROPERTIES,
  ESTIMATE_SYSTEMS,
  estimateMinutes,
  estimateScale,
  parseDate,
  readEstimate,
  toIso,
} from "./properties";
import type { EstimateConfig } from "./types";

import grammar from "../../../fixtures/property-grammar.json";

const duration: EstimateConfig = {
  enabled: true,
  system: "duration",
  values: [],
  hoursPerDay: grammar.defaults.hoursPerDay,
  daysPerWeek: grammar.defaults.daysPerWeek,
};

describe("the duration grammar, against the shared fixture", () => {
  it("reads exactly the values the fixture calls durations", () => {
    expect(grammar.durations.cases.length).toBeGreaterThan(15);

    for (const { value, valid, note } of grammar.durations.cases) {
      // `known` is the frontend's word for "this project's system can read it";
      // anything else is kept and shown as the file spells it (invariant 16).
      expect(
        readEstimate(value, duration)?.kind === "known",
        `${JSON.stringify(value)}: ${note ?? ""}`,
      ).toBe(valid);
    }
  });

  it("converts to the fixture's minutes, from the fixture's own rates", () => {
    for (const { value, minutes } of grammar.conversions.cases) {
      expect(estimateMinutes(value, duration), value).toBe(minutes);
    }
  });

  it("orders a duration by nothing but those minutes", () => {
    // The reason the table exists at all: `4h` against `1d` cannot be ordered
    // without knowing how long the project's working day is.
    expect(estimateMinutes("4h", duration)!).toBeLessThan(
      estimateMinutes("1d", duration)!,
    );
  });

  it("gives a value it cannot read no minutes to be ordered by", () => {
    for (const { value, valid } of grammar.durations.cases) {
      if (valid) continue;
      expect(estimateMinutes(value, duration), value).toBeUndefined();
    }
  });
});

describe("the scales, against the shared fixture", () => {
  it("offers the fixture's Fibonacci scale in the fixture's order", () => {
    expect(estimateScale({ ...duration, system: "fibonacci" })).toEqual(
      grammar.fibonacciScale.values,
    );
  });

  it("reads a Fibonacci value as known and anything else as foreign", () => {
    const fibonacci: EstimateConfig = { ...duration, system: "fibonacci" };
    for (const value of grammar.fibonacciScale.values) {
      expect(readEstimate(value, fibonacci)?.kind, value).toBe("known");
    }
    expect(readEstimate("4", fibonacci)?.kind).toBe("foreign");
  });

  it("names the fixture's estimate systems, in its order", () => {
    expect(ESTIMATE_SYSTEMS.map((system) => system.id)).toEqual(
      grammar.estimateSystems.values,
    );
  });

  it("reads the seeded t-shirt scale as this project's own vocabulary", () => {
    // Seeded rather than fixed, so it is the project's `values` that decide —
    // which is exactly why both sides have to agree on what the seed is.
    const tshirt: EstimateConfig = {
      ...duration,
      system: "tshirt",
      values: grammar.tshirtScale.values,
    };
    for (const value of grammar.tshirtScale.values) {
      expect(readEstimate(value, tshirt)?.kind, value).toBe("known");
    }
    expect(readEstimate("xxl", tshirt)?.kind).toBe("foreign");
  });
});

describe("the defaults a project with no properties block reads as", () => {
  it("carries the fixture's three numbers", () => {
    expect(NO_PROPERTIES.due.attentionDays).toBe(
      grammar.defaults.attentionDays,
    );
    expect(NO_PROPERTIES.estimate.hoursPerDay).toBe(
      grammar.defaults.hoursPerDay,
    );
    expect(NO_PROPERTIES.estimate.daysPerWeek).toBe(
      grammar.defaults.daysPerWeek,
    );
  });

  it("starts on the fixture's default estimate system", () => {
    expect(NO_PROPERTIES.estimate.system).toBe(grammar.estimateSystems.default);
  });
});

describe("the date grammar, against the shared fixture", () => {
  // The typed field is a wider grammar than the format's — it takes `28 Sep`
  // and `tomorrow` — so what is compared here is the day it resolves to, which
  // is the only thing that reaches a file.
  const now = new Date(2026, 8, 8).getTime();

  it("writes only days the format accepts", () => {
    for (const { value, valid, note } of grammar.dates.cases) {
      const parsed = parseDate(value, now);
      const writes =
        parsed.kind === "date" ? toIso(parsed.date) === value : false;
      expect(writes, `${JSON.stringify(value)}: ${note ?? ""}`).toBe(valid);
    }
  });
});
