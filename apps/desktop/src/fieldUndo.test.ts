// @vitest-environment jsdom

/**
 * The question `⌘Z` asks before it runs: does the field under the caret still
 * have an edit of its own to take back?
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fieldOwnsUndo, trackFieldEdits } from "./fieldUndo";

let stop: () => void;

beforeEach(() => {
  stop = trackFieldEdits();
});

afterEach(() => {
  stop();
  document.body.innerHTML = "";
});

/** Types into a field the way a person does: focus, then a real input event. */
function type(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
  field.focus();
  field.value = text;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function input() {
  const field = document.createElement("input");
  document.body.append(field);
  return field;
}

describe("who owns ⌘Z", () => {
  it("leaves it with the app outside a field", () => {
    const button = document.createElement("button");
    document.body.append(button);

    expect(fieldOwnsUndo(button)).toBe(false);
    expect(fieldOwnsUndo(null)).toBe(false);
  });

  it("leaves it with the app in a field nobody has typed in", () => {
    const field = input();
    field.focus();

    expect(fieldOwnsUndo(field)).toBe(false);
  });

  it("gives it to a field the caret has been typing in", () => {
    const field = input();
    type(field, "Fix the login redirect");

    expect(fieldOwnsUndo(field)).toBe(true);
  });

  it("keeps it with the field once its own text is deleted again", () => {
    // The field's undo stack is what is being asked about, not its value: text
    // typed and then backspaced away is still text `⌘Z` should bring back.
    const field = input();
    type(field, "Fx");
    type(field, "");

    expect(fieldOwnsUndo(field)).toBe(true);
  });

  it("takes it back when the app resets the field under the caret", () => {
    // Quick create's **Create more** loop: submit clears the box and puts focus
    // straight back in it. Nothing the field could undo is on screen any more,
    // so the next `⌘Z` is the app's — which is the whole of LC-220.
    const field = input();
    type(field, "Fix the login redirect");
    field.value = "";

    expect(fieldOwnsUndo(field)).toBe(false);
  });

  it("takes it back when the caret moves to another field", () => {
    const first = input();
    const second = input();
    type(first, "half a sentence");
    second.focus();

    expect(fieldOwnsUndo(second)).toBe(false);
    // The first field is not being asked about — it does not have the caret —
    // but leaving its record behind would answer for it wrongly if it got the
    // caret back with the app having cleared it in between.
    first.focus();
    expect(fieldOwnsUndo(first)).toBe(false);
  });

  it("asks the same of a textarea and a contenteditable", () => {
    const area = document.createElement("textarea");
    const rich = document.createElement("div");
    rich.setAttribute("contenteditable", "true");
    document.body.append(area, rich);

    expect(fieldOwnsUndo(area)).toBe(false);
    type(area, "a comment");
    expect(fieldOwnsUndo(area)).toBe(true);

    // A contenteditable has no `value` to compare, so an edit in one is taken
    // at its word for as long as the caret stays in it.
    rich.focus();
    expect(fieldOwnsUndo(rich)).toBe(false);
    rich.dispatchEvent(new Event("input", { bubbles: true }));
    expect(fieldOwnsUndo(rich)).toBe(true);
  });

  it("leaves it with the app on a control that holds no text", () => {
    // A checkbox is an `<input>`, which is why the single-key rule asks for
    // `input` whole — and why `⌘Z` must not. Ticking a checklist row leaves
    // focus on the box and raises a toast offering Undo (LC-220).
    const box = document.createElement("input");
    box.type = "checkbox";
    document.body.append(box);

    box.focus();
    box.checked = true;
    box.dispatchEvent(new Event("input", { bubbles: true }));

    expect(fieldOwnsUndo(box)).toBe(false);
  });

  it("answers for the field the event landed inside", () => {
    // `event.target` is the field itself for a keystroke, but the guard is
    // handed whatever the event carried, and a wrapper must not read as a field.
    const wrapper = document.createElement("div");
    const field = document.createElement("input");
    wrapper.append(field);
    document.body.append(wrapper);
    type(field, "typing");

    expect(fieldOwnsUndo(wrapper)).toBe(false);
  });

  it("forgets everything once tracking stops", () => {
    const field = input();
    type(field, "typing");
    stop();

    expect(fieldOwnsUndo(field)).toBe(false);
    stop = trackFieldEdits();
  });
});
