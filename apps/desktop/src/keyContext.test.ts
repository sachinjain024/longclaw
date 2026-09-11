// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  chordDigit,
  PROJECT_CHORD_COUNT,
  singleKeyShortcutAllowed,
  textFieldAt,
} from "./keyContext";

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
    // A bare `<input>` is the app's commonest field — the quick create title
    // and the checklist add-row both are one — and reports itself as `text`.
    expect(textFieldAt(control("input"))).toBeTruthy();
    expect(textFieldAt(control("input", "text"))).toBeTruthy();
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
   * Not because a search box could not hold an undo — it plainly could. The
   * list names the types the app ships rather than the types that exist, so
   * this is the reminder that adding one is two edits and not one.
   */
  it("refuses a textual type the app does not ship", () => {
    expect(textFieldAt(control("input", "search"))).toBeUndefined();
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

/**
 * `⌘1`…`⌘9` (LC-230). The range is the whole point: `isChord` answers one key
 * and nine calls to it would be nine places for the modifier convention to
 * drift, which is what this module exists to prevent.
 */
describe("the project chord's digit", () => {
  const press = (init: KeyboardEventInit) =>
    chordDigit(new KeyboardEvent("keydown", init));

  /**
   * The set the pattern accepts, read against the constant the sidebar badges
   * with — this is what keeps those two from parting company.
   *
   * It asks every digit key there is rather than probing
   * `PROJECT_CHORD_COUNT + 1`, which proves nothing at 9: `"10"` is two
   * characters and would be refused for its length whatever the range said.
   * Comparing the whole accepted set fails in both directions — a pattern that
   * stopped at 8, or a constant that claimed 8 while the pattern took 9.
   */
  it("accepts exactly the digits 1 through PROJECT_CHORD_COUNT", () => {
    const accepted = "0123456789"
      .split("")
      .filter((key) => press({ key, metaKey: true }) !== undefined);

    expect(accepted).toEqual(
      Array.from({ length: PROJECT_CHORD_COUNT }, (_, index) =>
        String(index + 1),
      ),
    );
  });

  /** `⌘` or `Ctrl` alike, the same convention `isChord` reads (plan 24). */
  it("takes Ctrl as well, so a Ctrl keyboard reaches it", () => {
    expect(press({ key: "4", ctrlKey: true })).toBe(4);
  });

  /**
   * `⌘0` is unbound on purpose: there is no zeroth row for it to mean, and a
   * chord that silently rounded to the first would be worse than one that does
   * nothing.
   */
  it("refuses ⌘0", () => {
    expect(press({ key: "0", metaKey: true })).toBeUndefined();
  });

  it("refuses a bare digit, which is not a chord at all", () => {
    expect(press({ key: "7" })).toBeUndefined();
  });

  /**
   * `⇧⌘1` arrives as `!` on a US layout, so the shifted press falls out by
   * itself — and a multi-character key never matches a single digit.
   */
  it("refuses the shifted press and anything longer than a digit", () => {
    expect(press({ key: "!", metaKey: true, shiftKey: true })).toBeUndefined();
    expect(press({ key: "F1", metaKey: true })).toBeUndefined();
  });
});
