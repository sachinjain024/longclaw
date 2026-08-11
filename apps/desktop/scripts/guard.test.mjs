/**
 * LC-177: `declaredValues` is the one place a guard reads `property: value` out
 * of a selector's declarations, and the only reason it is shared is the left
 * boundary.
 *
 * `glyph-drift-guard.mjs` learned it first — `\b` alone matches the `width`
 * inside `stroke-width` — and `create-surface-guard.mjs` was reading without
 * one, so a `padding` assertion would have been satisfied by a `scroll-padding`
 * the rule happened to declare. That guard reports clean while the declaration
 * it names has drifted, which is the worst thing a guard can do.
 *
 * These cases are the boundary and the shape of what comes back; the guards
 * above own what a value is allowed to be.
 */

import { describe, expect, it } from "vitest";

import { cssRules, declaredValues } from "./guard.mjs";

/** The values `selector` declares for `property`, read off a stylesheet. */
function valuesIn(css, selector, property) {
  return declaredValues(cssRules(css), selector, property);
}

describe("declaredValues", () => {
  it("reads the value a selector declares", () => {
    expect(
      valuesIn(".title { border: none; padding: 0 }", ".title", "border"),
    ).toEqual(["none"]);
  });

  it("does not read a longhand the property name ends", () => {
    expect(
      valuesIn(".title { scroll-padding: 12px }", ".title", "padding"),
    ).toEqual([]);
  });

  it("does not read a vendor prefix the property name ends", () => {
    expect(
      valuesIn(".title { -webkit-border-before: 1px }", ".title", "border"),
    ).toEqual([]);
  });

  it("reads the property beside the longhand that shadows it", () => {
    expect(
      valuesIn(
        ".title { scroll-padding: 12px; padding: 0 }",
        ".title",
        "padding",
      ),
    ).toEqual(["0"]);
  });

  it("reads every rule the selector has, in source order", () => {
    expect(
      valuesIn(
        ".title { font-size: 13px } .title { font-size: 15px }",
        ".title",
        "font-size",
      ),
    ).toEqual(["13px", "15px"]);
  });

  it("reads nothing from a selector that declares nothing of the kind", () => {
    expect(valuesIn(".title { border: none }", ".title", "padding")).toEqual(
      [],
    );
  });

  it("reads nothing from a selector with no rule at all", () => {
    expect(valuesIn(".title { border: none }", ".missing", "border")).toEqual(
      [],
    );
  });

  it("does not read what a descendant of the selector declares", () => {
    expect(
      valuesIn(".title strong { border: 1px }", ".title", "border"),
    ).toEqual([]);
  });
});
