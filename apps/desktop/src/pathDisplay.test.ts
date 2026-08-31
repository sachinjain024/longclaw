import { describe, expect, it } from "vitest";
import {
  PATH_HEAD,
  PATH_TAIL,
  SIDEBAR_PATH_CAP,
  elidePath,
  tildeAbbreviate,
} from "./pathDisplay";

describe("tildeAbbreviate", () => {
  it("abbreviates only the actual home directory", () => {
    expect(tildeAbbreviate("/Users/sachin/dev/fixture", "/Users/sachin")).toBe(
      "~/dev/fixture",
    );
    expect(tildeAbbreviate("/Users/sachin", "/Users/sachin")).toBe("~");
    // A prefix is not a parent: `/Users/sachina` is somebody else.
    expect(tildeAbbreviate("/Users/sachina/dev", "/Users/sachin")).toBe(
      "/Users/sachina/dev",
    );
    expect(tildeAbbreviate("/Volumes/Backup/longclaw", "/Users/sachin")).toBe(
      "/Volumes/Backup/longclaw",
    );
  });

  it("leaves everything alone when the native layer has no home to give", () => {
    expect(tildeAbbreviate("/Users/sachin/dev", null)).toBe(
      "/Users/sachin/dev",
    );
  });
});

describe("elidePath", () => {
  it("returns a path that already fits, untouched", () => {
    expect(elidePath("~/dev/fixture")).toBe("~/dev/fixture");
    expect(elidePath("")).toBe("");
  });

  it("returns a path of exactly the cap untouched", () => {
    const exact = "a".repeat(SIDEBAR_PATH_CAP);
    expect(exact).toHaveLength(16);
    expect(elidePath(exact)).toBe(exact);
  });

  it("elides the middle, keeping the tail whole", () => {
    // The end is the folder that identifies the project; the head is
    // `~/Developer/…`, which is the same on every path in the app.
    expect(
      elidePath("~/Developer/work/acme-corp/longclaw-fixture-project"),
    ).toBe("~/De…ure-project");
  });

  it("never returns more characters than the cap", () => {
    const paths = [
      "~/Developer/work/acme-corp/longclaw-fixture-project",
      "/Volumes/Backup Drive/archive/2025/longclaw",
      "~/Documents/Screenshots and scratch/longclaw-fixture-project-two",
      "/".repeat(400),
      "~/" + "x".repeat(400),
    ];
    for (const path of paths) {
      expect(Array.from(elidePath(path)).length, path).toBeLessThanOrEqual(
        SIDEBAR_PATH_CAP,
      );
    }
  });

  it("spends the cap the way the head and tail state", () => {
    // The chip is mono, so a character count is a pixel count: 157px of box at
    // 6.32px a glyph. The split is what the review picked out of the three the
    // prototype offered.
    expect(PATH_HEAD + PATH_TAIL + 1).toBe(SIDEBAR_PATH_CAP);
    const elided = elidePath("/one/two/three/four/five/six/seven/eight");
    expect(elided.slice(0, PATH_HEAD)).toBe("/one");
    expect(elided.charAt(PATH_HEAD)).toBe("…");
    expect(elided.slice(PATH_HEAD + 1)).toBe(
      "/six/seven/eight".slice(-PATH_TAIL),
    );
  });

  it("cuts on characters, not code units", () => {
    // A folder with an emoji in its name is unusual and entirely legal. Half a
    // surrogate pair renders as the replacement glyph, so the cut has to fall
    // between characters — the same rule the project tile's initial follows.
    const emoji = "~/Documents/🦉🦉🦉🦉🦉🦉🦉🦉🦉🦉/owl-project-folder";
    expect(elidePath(emoji)).not.toContain("\uFFFD");
    expect(Array.from(elidePath(emoji))).toHaveLength(SIDEBAR_PATH_CAP);
  });
});
