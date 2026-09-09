// @vitest-environment jsdom

/**
 * The date control: a Field with a calendar joined to its right edge.
 *
 * Most of what is below is one rule seen from a different side — **what is
 * refused is not destroyed** (LC-227). The field keeps what was typed, says
 * which rule it broke, and writes nothing; what the file says is untouched
 * until something resolves. That is the posture the format already takes toward
 * a malformed value on disk, and it is why this is a Field in the `CONTEXT.md`
 * sense rather than a picker with a text decoration.
 *
 * The grammar itself is `properties.ts`'s and is tested there. What is tested
 * here is the control: when it parses, what it keeps, and what it says.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateField } from "./DateField";
import { fieldOwnsUndo, trackFieldEdits } from "./fieldUndo";

afterEach(cleanup);

/** Tuesday 8 September 2026, local. Every expectation below is days from here. */
const TODAY = new Date(2026, 8, 8, 9, 0).getTime();

function field(props: { value?: string; onCommit?: (iso?: string) => void }) {
  // Some cases render twice to compare two values, and a second `Due` in the
  // document makes every query below ambiguous rather than wrong.
  cleanup();
  render(
    <DateField
      label="Due"
      value={props.value}
      now={TODAY}
      onCommit={props.onCommit ?? (() => {})}
    />,
  );
  return screen.getByLabelText("Due") as HTMLInputElement;
}

function type(input: HTMLInputElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
}

function commit(input: HTMLInputElement) {
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("what the date field shows for what the file says", () => {
  it("shows a stored day in the field's own form", () => {
    expect(field({ value: "2026-09-28" }).value).toBe("28 Sep");
  });

  it("carries the year whenever the text would not read back as itself", () => {
    // The defect this exists to prevent: `5 Sep` shown for a past date is read
    // by the grammar as 5 Sep *2027*, so the first person to retype what is
    // already in front of them moves the date a year without being told.
    expect(field({ value: "2026-09-05" }).value).toBe("5 Sep 2026");
    expect(field({ value: "2027-09-28" }).value).toBe("28 Sep 2027");
  });

  it("shows a value it cannot read exactly as the file spells it", () => {
    // Invariant 16. A date written by another tool, or by hand, is the ticket's
    // own data, and a field is not where it gets corrected.
    expect(field({ value: "28 Sep 2026" }).value).toBe("28 Sep 2026");
  });

  it("is empty for a property the file does not carry", () => {
    expect(field({}).value).toBe("");
  });
});

describe("when the date field parses, and what it does with the answer", () => {
  it("does not parse per keystroke", () => {
    // `28 Se` is not a state worth reporting on, and nothing goes red mid-word.
    const onCommit = vi.fn();
    const input = field({ onCommit });
    type(input, "28 Se");
    expect(onCommit).not.toHaveBeenCalled();
    expect(document.querySelector(".date-note")).toBeNull();
    expect(document.querySelector(".unresolved")).toBeNull();
  });

  it("stores the canonical shape, whatever was typed", () => {
    const onCommit = vi.fn();
    const input = field({ onCommit });
    type(input, "28 Sep");
    commit(input);
    expect(onCommit).toHaveBeenCalledWith("2026-09-28");
  });

  it("commits on blur as well as on Enter", () => {
    const onCommit = vi.fn();
    const input = field({ onCommit });
    type(input, "2026-10-20");
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith("2026-10-20");
  });

  it("keeps the text and names the rule a refusal broke", () => {
    const onCommit = vi.fn();
    const input = field({ onCommit });
    type(input, "28/09/2026");
    commit(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("28/09/2026");
    expect(screen.getByText(/YYYY-MM-DD only/)).toBeTruthy();
  });

  it("stops reporting a refusal the moment typing resumes", () => {
    const input = field({});
    type(input, "3/4");
    commit(input);
    expect(document.querySelector(".date-note")).not.toBeNull();
    type(input, "3 Apr");
    expect(document.querySelector(".date-note")).toBeNull();
  });

  it("reads an emptied field as a clear, which is not the same as never set", () => {
    const onCommit = vi.fn();
    const input = field({ value: "2026-09-28", onCommit });
    type(input, "");
    commit(input);
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it("writes nothing when the day typed is the day already stored", () => {
    // `TicketDocument::apply` refuses an edit that changes nothing, and a pass
    // through a rail holding two dates would otherwise blur two of them.
    const onCommit = vi.fn();
    const input = field({ value: "2026-09-28", onCommit });
    commit(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("writes nothing when an empty field is committed on an absent value", () => {
    const onCommit = vi.fn();
    commit(field({ onCommit }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("leaves an unreadable value alone until something resolves", () => {
    // Committing what the file already says must not rewrite it into a shape
    // the app prefers — that would be the field correcting the file.
    const onCommit = vi.fn();
    const input = field({ value: "28 Sep 2026", onCommit });
    commit(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("28 Sep 2026");
  });
});

describe("the echo under the field", () => {
  it("says the day in full once typed text resolves", () => {
    // The year rule is invisible without this: typed on 8 Sep 2026, `5 Sep`
    // means 2027, and this is where that stops being silent.
    const input = field({});
    type(input, "5 Sep");
    expect(document.querySelector(".date-echo")?.textContent).toContain(
      "Sun 5 Sep 2027",
    );
  });

  it("is confirmation and not validation — nothing is red while it shows", () => {
    const input = field({});
    type(input, "28 Sep");
    expect(document.querySelector(".date-echo")).not.toBeNull();
    expect(document.querySelector(".date-note")).toBeNull();
  });

  it("says nothing on a field showing what the file says", () => {
    // Otherwise a field at rest wears a second copy of its own value.
    field({ value: "2026-09-28" });
    expect(document.querySelector(".date-echo")).toBeNull();
  });

  it("says nothing while the text does not resolve", () => {
    const input = field({});
    type(input, "28 Se");
    expect(document.querySelector(".date-echo")).toBeNull();
  });
});

describe("the calendar", () => {
  function open(value?: string, onCommit?: (iso?: string) => void) {
    const input = field({ value, onCommit });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    return screen.getByRole("dialog");
  }

  it("opens from the field with ArrowDown", () => {
    expect(open()).toBeTruthy();
  });

  it("keeps its trigger out of the tab order", () => {
    // The field in front of it is the keyboard path; a stop of its own would be
    // an extra press on every pass through a rail that holds two dates.
    field({});
    expect(screen.getByLabelText("Due calendar").getAttribute("tabindex")).toBe(
      "-1",
    );
  });

  it("opens on the month the value is in", () => {
    expect(open("2026-11-03").textContent).toContain("November 2026");
  });

  it("opens on this month when there is no value", () => {
    expect(open().textContent).toContain("September 2026");
  });

  it("marks today and the value as two different things", () => {
    // A ticket due today wears both on one cell, so one mark cannot serve.
    const picker = open("2026-09-28");
    expect(picker.querySelector(".date-cell.now")?.textContent).toBe("8");
    expect(picker.querySelector(".date-cell.picked")?.textContent).toBe("28");
  });

  it("starts its weeks on Monday", () => {
    // Derived rather than picked: the app has no locale to ask, the on-disk
    // form is ISO 8601, and ISO 8601's week starts on Monday.
    const heads = [...open().querySelectorAll(".dow")].map(
      (d) => d.textContent,
    );
    expect(heads).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
  });

  it("picks a day and writes the canonical shape", () => {
    const onCommit = vi.fn();
    const picker = open(undefined, onCommit);
    fireEvent.click(screen.getByLabelText("Wed 30 Sep 2026"));
    expect(onCommit).toHaveBeenCalledWith("2026-09-30");
    expect(picker.isConnected).toBe(false);
  });

  it("carries Clear, which the pointer has no other way to reach", () => {
    const onCommit = vi.fn();
    open("2026-09-28", onCommit);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it("steps a month at a time without touching the value", () => {
    const onCommit = vi.fn();
    const picker = open("2026-09-28", onCommit);
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(picker.textContent).toContain("October 2026");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("moves a week where the menus move a row", () => {
    // The app's first two-dimensional popover: up-down here means seven days,
    // not the next row of a list.
    open("2026-09-28");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Mon 5 Oct 2026",
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Sun 4 Oct 2026",
    );
  });

  it("keeps the grid to one tab stop", () => {
    // 42 stops in a popover would be a month a person has to Tab across, which
    // is the same reason a board column's cards rove (`rovingFocus.ts`).
    const cells = [...open("2026-09-28").querySelectorAll(".date-cell")];
    expect(
      cells.filter((c) => c.getAttribute("tabindex") === "0"),
    ).toHaveLength(1);
  });

  it("closes on Escape without writing", () => {
    const onCommit = vi.fn();
    const picker = open("2026-09-28", onCommit);
    fireEvent.keyDown(picker, { key: "Escape" });
    expect(picker.isConnected).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

/**
 * LC-220's rule, from the side a field that commits without moving focus puts
 * it on: `⌘Z` belongs to the OS "while the field has an edit of its own to give
 * back" (`fieldUndo.ts`). Enter here writes and keeps the caret, so the text in
 * the box afterwards is the value the app now holds — and the toast that write
 * raised is the only Undo either of them has.
 */
describe("who owns ⌘Z once the field has written", () => {
  let stop: () => void;

  beforeEach(() => {
    stop = trackFieldEdits();
  });

  afterEach(() => stop());

  /** A keystroke, which fires `input`. `fireEvent.change` does not. */
  function press(input: HTMLInputElement, text: string) {
    input.focus();
    fireEvent.input(input, { target: { value: text } });
  }

  it("hands the key back to the toast the write raised", () => {
    const input = field({});
    press(input, "28 Sep");
    // Mid-edit, the typing is the field's to take back.
    expect(fieldOwnsUndo(input)).toBe(true);

    commit(input);
    // Written: the box now shows what the app was asked to store, and a field
    // still claiming the key would leave **Undo ⌘Z** on screen and unreachable.
    expect(fieldOwnsUndo(input)).toBe(false);
  });

  it("keeps the key while the text has not been written", () => {
    const input = field({});
    press(input, "28/09/2026");
    commit(input);
    // A refusal writes nothing and raises no toast, so the only thing on screen
    // anyone could take back is the typing, and it is still the field's.
    expect(fieldOwnsUndo(input)).toBe(true);
  });
});
