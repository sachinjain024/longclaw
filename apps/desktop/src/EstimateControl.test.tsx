// @vitest-environment jsdom

/**
 * One property, three shapes, and one rule underneath all of them: a value this
 * project's system cannot read is the ticket's own data and is kept
 * (`file_format.md` invariant 16). Switching a project from t-shirts to hours
 * rewrites no ticket, so every one of them has to render as *something*.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EstimateControl } from "./EstimateControl";
import { fieldOwnsUndo, trackFieldEdits } from "./fieldUndo";
import { NO_PROPERTIES } from "./properties";
import type { EstimateConfig } from "./types";

afterEach(cleanup);

const TSHIRT: EstimateConfig = {
  ...NO_PROPERTIES.estimate,
  enabled: true,
  values: ["xs", "s", "m", "l", "xl"],
};
const FIBONACCI: EstimateConfig = { ...TSHIRT, system: "fibonacci" };
const DURATION: EstimateConfig = { ...TSHIRT, system: "duration" };

function control(config: EstimateConfig, value?: string) {
  const onCommit = vi.fn();
  cleanup();
  render(<EstimateControl value={value} config={config} onCommit={onCommit} />);
  return onCommit;
}

describe("a scale", () => {
  it("offers the project's own values, in the scale's order", () => {
    control(TSHIRT);
    const scale = screen.getByRole("group", { name: "Estimate" });
    expect(
      [...scale.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["—", "XS", "S", "M", "L", "XL"]);
  });

  it("leads with a dash, because absent is a value a scale has to say", () => {
    // Without it the only way back out of an estimate is a menu the segment
    // does not have.
    control(TSHIRT, "m");
    expect(
      screen.getByLabelText("No estimate").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("presses the dash when the ticket has no estimate", () => {
    control(TSHIRT);
    expect(
      screen.getByLabelText("No estimate").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("writes the stored slug, not the label the segment shows", () => {
    const onCommit = control(TSHIRT);
    fireEvent.click(screen.getByRole("button", { name: "XL" }));
    expect(onCommit).toHaveBeenCalledWith("xl");
  });

  it("clears through the dash", () => {
    const onCommit = control(TSHIRT, "m");
    fireEvent.click(screen.getByLabelText("No estimate"));
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it("writes nothing when the value picked is the value already set", () => {
    const onCommit = control(TSHIRT, "m");
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("offers the fibonacci scale under fibonacci, whatever the project lists", () => {
    // `values` is the t-shirt scale's; fibonacci's is the sequence itself.
    control(FIBONACCI);
    const scale = screen.getByRole("group", { name: "Estimate" });
    expect(
      [...scale.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["—", "1", "2", "3", "5", "8", "13"]);
  });
});

describe("a value written under another system", () => {
  it("is drawn in full rather than dropped or converted", () => {
    control(FIBONACCI, "m");
    expect(screen.getByText("m").className).toContain("estimate-foreign");
  });

  it("leaves the control below it, so the ticket can still be re-estimated", () => {
    // Showing the value *instead* of the control is a ticket nobody can change
    // — the worse of the two failures.
    const onCommit = control(FIBONACCI, "m");
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(onCommit).toHaveBeenCalledWith("5");
  });

  it("presses nothing on the scale, which is the honest reading", () => {
    control(FIBONACCI, "m");
    const pressed = screen
      .getByRole("group", { name: "Estimate" })
      .querySelectorAll('[aria-pressed="true"]');
    expect(pressed).toHaveLength(0);
  });
});

describe("a duration", () => {
  function amountField() {
    return screen.getByLabelText("Estimate amount") as HTMLInputElement;
  }

  it("splits a stored value into its number and its unit", () => {
    control(DURATION, "1.5d");
    expect(amountField().value).toBe("1.5");
    expect(screen.getByLabelText("Estimate unit: Days")).toBeTruthy();
  });

  it("joins them back together on commit", () => {
    const onCommit = control(DURATION);
    fireEvent.change(amountField(), { target: { value: "4" } });
    fireEvent.blur(amountField());
    expect(onCommit).toHaveBeenCalledWith("4h");
  });

  it("treats a unit picked over a number as an edit, not a preference", () => {
    const onCommit = control(DURATION, "2h");
    fireEvent.click(screen.getByLabelText("Estimate unit: Hours"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Days/ }));
    expect(onCommit).toHaveBeenCalledWith("2d");
  });

  it("keeps a number that is not finished rather than writing it", () => {
    // `2.` and `0` are both refused by the format, and both are things a person
    // is in the middle of typing.
    const onCommit = control(DURATION);
    fireEvent.change(amountField(), { target: { value: "2." } });
    fireEvent.blur(amountField());
    expect(onCommit).not.toHaveBeenCalled();
    expect(amountField().value).toBe("2.");
  });

  it("reads an emptied field as a clear", () => {
    const onCommit = control(DURATION, "4h");
    fireEvent.change(amountField(), { target: { value: "" } });
    fireEvent.blur(amountField());
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it("writes nothing when the value committed is the value already set", () => {
    const onCommit = control(DURATION, "4h");
    fireEvent.blur(amountField());
    expect(onCommit).not.toHaveBeenCalled();
  });
});

/**
 * The duration's number is the other field in the rail that writes without
 * moving the caret, so it answers the `⌘Z` question the way `DateField` does
 * (`fieldUndo.ts`, LC-220).
 */
describe("who owns ⌘Z once the number has been written", () => {
  let stop: () => void;

  beforeEach(() => {
    stop = trackFieldEdits();
  });

  afterEach(() => stop());

  function press(text: string) {
    const input = screen.getByLabelText("Estimate amount") as HTMLInputElement;
    input.focus();
    fireEvent.input(input, { target: { value: text } });
    return input;
  }

  it("hands the key back to the toast the write raised", () => {
    control(DURATION);
    const input = press("3");
    expect(fieldOwnsUndo(input)).toBe(true);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(fieldOwnsUndo(input)).toBe(false);
  });

  it("keeps the key while the number is not one this system reads", () => {
    control(DURATION);
    const input = press("1d4");
    fireEvent.keyDown(input, { key: "Enter" });
    // Nothing was written, so nothing else is offering the key.
    expect(fieldOwnsUndo(input)).toBe(true);
  });
});
