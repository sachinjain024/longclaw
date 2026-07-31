/**
 * What a slug turns into before anything draws it.
 *
 * The interesting case is the slug this project does not define. An agent can
 * write one, and the file keeps it, so every surface has to have something
 * legible to show for it — which is the third clause of V0-10's gate.
 */

import { describe, expect, it } from "vitest";
import { FALLBACK_LABEL_COLOR, LABEL_COLORS, resolveLabels } from "./labels";
import type { Label } from "./types";

const DEFINITIONS: Record<string, Label> = {
  backend: { name: "Backend", color: "blue" },
  reliability: { name: "Reliability", color: "amber" },
};

describe("resolving a label slug", () => {
  it("reads the display name and the hue off the definition", () => {
    expect(resolveLabels(["backend", "reliability"], DEFINITIONS)).toEqual([
      { slug: "backend", name: "Backend", color: "blue", defined: true },
      {
        slug: "reliability",
        name: "Reliability",
        color: "amber",
        defined: true,
      },
    ]);
  });

  it("must-pass 3: keeps an undefined slug, as itself", () => {
    expect(resolveLabels(["legacy-thing"], DEFINITIONS)).toEqual([
      {
        slug: "legacy-thing",
        name: "legacy-thing",
        color: FALLBACK_LABEL_COLOR,
        defined: false,
      },
    ]);
  });

  it("falls back for a hue outside the ramp instead of inventing one", () => {
    // `slate` is what Rust defaults a definition to, and it is a theme id
    // rather than a ramp hue. Anything the ramp does not hold reads as gray.
    const definitions = { chore: { name: "Chore", color: "slate" } };

    expect(resolveLabels(["chore"], definitions)[0]).toMatchObject({
      name: "Chore",
      color: FALLBACK_LABEL_COLOR,
      defined: true,
    });
  });

  it("holds the ramp to D12: eight hues, and no green", () => {
    expect(LABEL_COLORS).toEqual([
      "blue",
      "cyan",
      "purple",
      "pink",
      "red",
      "orange",
      "amber",
      "gray",
    ]);
  });

  it("takes the first n when a surface has room for fewer", () => {
    expect(
      resolveLabels(["backend", "reliability"], DEFINITIONS, 1).map(
        (label) => label.slug,
      ),
    ).toEqual(["backend"]);
  });
});
