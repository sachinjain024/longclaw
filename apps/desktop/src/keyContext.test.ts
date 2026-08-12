// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { singleKeyShortcutAllowed, textFieldAt } from "./keyContext";

afterEach(() => {
  document.body.innerHTML = "";
});

function control(tag: string, type?: string) {
  const element = document.createElement(tag);
  if (type) (element as HTMLInputElement).type = type;
  document.body.append(element);
  return element;
}

describe("single-key shortcut context", () => {
  it("suspends shortcuts in editable controls", () => {
    const input = document.createElement("input");
    document.body.append(input);
    expect(singleKeyShortcutAllowed(input)).toBe(false);
    input.remove();
    expect(singleKeyShortcutAllowed(document.body)).toBe(true);
  });
});

describe("the field a keystroke could be undone in", () => {
  it("takes the text controls", () => {
    expect(textFieldAt(control("input"))).toBeTruthy();
    expect(textFieldAt(control("input", "search"))).toBeTruthy();
    expect(textFieldAt(control("textarea"))).toBeTruthy();
  });

  it("refuses the controls that hold no text", () => {
    expect(textFieldAt(control("input", "checkbox"))).toBeUndefined();
    expect(textFieldAt(control("input", "radio"))).toBeUndefined();
    expect(textFieldAt(control("select"))).toBeUndefined();
    expect(textFieldAt(control("button"))).toBeUndefined();
    expect(textFieldAt(null)).toBeUndefined();
  });

  /**
   * The reason the two live in one module: they are asked of the same target
   * and they must differ, so a checkbox suspends `S` — it would swallow the
   * keystroke — while never claiming `⌘Z`, which it has nothing to do with
   * (LC-220). Two hand-written selectors in two modules is how that drifts.
   */
  it("differs from the single-key rule on the same control, on purpose", () => {
    const box = control("input", "checkbox");

    expect(singleKeyShortcutAllowed(box)).toBe(false);
    expect(textFieldAt(box)).toBeUndefined();
  });

  it("answers for the field an event landed inside, not for its wrapper", () => {
    const wrapper = document.createElement("div");
    const field = document.createElement("input");
    wrapper.append(field);
    document.body.append(wrapper);

    expect(textFieldAt(field)).toBe(field);
    expect(textFieldAt(wrapper)).toBeUndefined();
  });
});
