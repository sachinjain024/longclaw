import { describe, expect, it } from "vitest";
import { defaultProjectKey, validProjectKey } from "./projectKey";

describe("project keys", () => {
  it.each([
    ["30 July 4PM", "J4"],
    ["3j4", "LC"],
    ["2026 roadmap", "R"],
    ["3rd party audit", "PA"],
    ["My Project", "MP"],
    ["longclaw", "L"],
    ["日本語プロジェクト", "LC"],
  ])("derives a valid key from %s", (name, key) => {
    expect(defaultProjectKey(name)).toBe(key);
    expect(validProjectKey(key)).toBe(true);
  });

  it("keeps digit-leading keys out of the accepted grammar", () => {
    expect(validProjectKey("3J4")).toBe(false);
    expect(validProjectKey("J4")).toBe(true);
  });
});
