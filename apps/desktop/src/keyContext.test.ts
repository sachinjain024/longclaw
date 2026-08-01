// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { singleKeyShortcutAllowed } from "./keyContext";

describe("single-key shortcut context", () => {
  it("suspends shortcuts in editable controls", () => {
    const input = document.createElement("input");
    document.body.append(input);
    expect(singleKeyShortcutAllowed(input)).toBe(false);
    input.remove();
    expect(singleKeyShortcutAllowed(document.body)).toBe(true);
  });
});
