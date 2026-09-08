/**
 * What a slug turns into before anything draws it.
 *
 * The interesting case is the slug this project does not define. An agent can
 * write one, and the file keeps it, so every surface has to have something
 * legible to show for it — which is the third clause of V0-10's gate.
 */

import { describe, expect, it } from "vitest";
import {
  defineState,
  FALLBACK_LABEL_COLOR,
  isLabelSlug,
  LABEL_COLORS,
  labelKeyLine,
  labelKeyNote,
  nextLabelColor,
  resolveLabels,
  slugFromName,
} from "./labels";
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

/**
 * The derivation LC-236e adds. One function, exported, because the popover's
 * define row and the settings add-row both call it and a disagreement between
 * them would be two different keys for the same typed name.
 */
describe("deriving a key from a display name", () => {
  it("lowercases and joins words with a single -", () => {
    expect(slugFromName("Front End")).toBe("front-end");
  });

  it("collapses each run of punctuation to one -, not one each", () => {
    // The ticket's own example. `Back-end` and `Back end` both land here,
    // which is the collision the define row has to refuse by name.
    expect(slugFromName("Back-end")).toBe("back-end");
    expect(slugFromName("Back end")).toBe("back-end");
    expect(slugFromName("Design / UX")).toBe("design-ux");
  });

  it("drops a leading and trailing -, however it arose", () => {
    expect(slugFromName("  spaced  ")).toBe("spaced");
    expect(slugFromName("...docs!!!")).toBe("docs");
  });

  it("folds diacritics rather than treating them as punctuation", () => {
    // Without the NFD fold an accented letter is punctuation to `[a-z0-9]`,
    // so `Café` derives `caf` and `Ünïcode` derives `n-code`. With the key
    // read-only that is not something the person can correct afterwards.
    expect(slugFromName("Café")).toBe("cafe");
    expect(slugFromName("Ünïcode")).toBe("unicode");
    expect(slugFromName("Über Priority")).toBe("uber-priority");
  });

  it("returns empty when nothing survives", () => {
    expect(slugFromName("")).toBe("");
    expect(slugFromName("   ")).toBe("");
    expect(slugFromName("!!!")).toBe("");
    // The fold cannot rescue a name with no Latin in it at all. This is the
    // dead end LC-236e accepted: the way out is `longclaw.yaml` or the CLI.
    expect(slugFromName("日本語")).toBe("");
    expect(slugFromName("Кириллица")).toBe("");
  });

  it("proposes rather than validates: a digit-leading key gets this far", () => {
    // `is_label_slug` wants an ASCII lowercase first character, so this is a
    // string the derivation produces and the grammar then refuses.
    expect(slugFromName("2026 goals")).toBe("2026-goals");
    expect(isLabelSlug("2026-goals")).toBe(false);
  });
});

/**
 * Rust's grammar (`core/project.rs:349-359`), mirrored so the row can say no
 * before the write does. Rust stays the authority; this only spares a round
 * trip for the refusal that is already knowable on screen.
 */
describe("the slug grammar, mirrored", () => {
  it("takes what Rust takes", () => {
    expect(isLabelSlug("backend")).toBe(true);
    expect(isLabelSlug("back-end")).toBe(true);
    expect(isLabelSlug("back_end")).toBe(true);
    expect(isLabelSlug("v0")).toBe(true);
  });

  it("refuses what Rust refuses", () => {
    expect(isLabelSlug("")).toBe(false);
    expect(isLabelSlug("2026-goals")).toBe(false);
    expect(isLabelSlug("-leading")).toBe(false);
    expect(isLabelSlug("Backend")).toBe(false);
    expect(isLabelSlug("back end")).toBe(false);
  });
});

/**
 * The colour a new definition opens on. Settings defaulted to `LABEL_COLORS[0]`
 * unconditionally, so a project seeded from the app came out all blue.
 */
describe("choosing a hue for a new definition", () => {
  it("takes the first hue the project is not already using", () => {
    expect(nextLabelColor(DEFINITIONS)).toBe("cyan");
  });

  it("opens on blue on a project with no definitions at all", () => {
    expect(nextLabelColor({})).toBe("blue");
  });

  it("falls back to blue once all eight are taken", () => {
    const all = Object.fromEntries(
      LABEL_COLORS.map((color) => [color, { name: color, color }]),
    );

    expect(nextLabelColor(all)).toBe("blue");
  });

  it("ignores a stored hue that is not on the ramp", () => {
    // Rust's own `slate` default is a theme id, not a ramp hue, so it holds
    // nothing back — blue is still free.
    expect(nextLabelColor({ chore: { name: "Chore", color: "slate" } })).toBe(
      "blue",
    );
  });
});

/**
 * The four states the define row can be in, and the copy each one draws. One
 * function because the popover row and the settings add-row both ask it, and a
 * name that is refused in one place has to be refused in the other.
 */
describe("what a typed name would define", () => {
  it("is blank before anything is typed", () => {
    expect(defineState("", DEFINITIONS)).toEqual({ slug: "", kind: "blank" });
    expect(defineState("   ", DEFINITIONS).kind).toBe("blank");
  });

  it("carries the key it would write once one can be made", () => {
    expect(defineState("Front End", DEFINITIONS)).toEqual({
      slug: "front-end",
      kind: "ok",
    });
  });

  it("refuses a name whose key collides, and keeps the key that did it", () => {
    // The key and the name holding it are both kept, because the message
    // names them: `backend already exists for Backend`.
    expect(defineState("Backend", DEFINITIONS)).toEqual({
      slug: "backend",
      kind: "taken",
      heldBy: "Backend",
    });
    // Case and spacing are not what separates two names here — the key is.
    expect(defineState("back end", DEFINITIONS).kind).toBe("ok");
    expect(defineState("BACKEND", DEFINITIONS).kind).toBe("taken");
  });

  it("is one refusal for both ways a name fails to make a key", () => {
    // `2026 goals` derives something that is not a slug; `日本語` derives
    // nothing at all. Same kind, because there is one thing to do about
    // either and it is the name.
    expect(defineState("2026 goals", DEFINITIONS).kind).toBe("refused");
    expect(defineState("日本語", DEFINITIONS).kind).toBe("refused");
  });

  it("draws a key, or the rule, and never a string that is not a key", () => {
    // `2026-goals` is not a key, so the key's own line never holds it.
    expect(labelKeyLine(defineState("", DEFINITIONS))).toEqual({
      text: "Label key (auto-generated)",
      tone: "hint",
    });
    expect(labelKeyLine(defineState("Front End", DEFINITIONS))).toEqual({
      text: "front-end",
      tone: "key",
    });
    expect(labelKeyLine(defineState("Backend", DEFINITIONS))).toEqual({
      text: "backend",
      tone: "key",
    });
    expect(labelKeyLine(defineState("2026 goals", DEFINITIONS))).toEqual({
      text: "Label Name must start with a letter [a-z]",
      tone: "refused",
    });
  });

  it("says what collided, and with what, and only for a collision", () => {
    expect(labelKeyNote(defineState("Backend", DEFINITIONS))).toBe(
      "backend already exists for Backend. Please provide a new Label name.",
    );
    // The other three states have nothing to add: the line above already
    // carries the key, or the rule that stopped one being made.
    expect(labelKeyNote(defineState("", DEFINITIONS))).toBeUndefined();
    expect(labelKeyNote(defineState("Front End", DEFINITIONS))).toBeUndefined();
    expect(
      labelKeyNote(defineState("2026 goals", DEFINITIONS)),
    ).toBeUndefined();
  });
});
