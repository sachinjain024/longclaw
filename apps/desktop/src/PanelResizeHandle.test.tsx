// @vitest-environment jsdom

/**
 * The handle as a control: what it reports, what the keyboard does to it, and
 * what it refuses in a window with nowhere to drag into (LC-238s).
 *
 * The width itself is arithmetic and is covered in `panelWidth.test.ts`. What
 * is here is the contract a reader meets — `keyboard-focus-map.md:62,65`, and
 * rule 1: every pointer action has a keyboard path.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { resetDevicePreferences } from "./devicePreferences";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { PANEL_WIDTH_MIN, PANEL_WIDTH_PROPERTY } from "./panelWidth";

vi.mock("./api", () => ({
  readPreferences: vi.fn(),
  writePreferences: vi.fn(),
}));

/** The window the handle measures itself against. */
function windowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

const drawn = () =>
  document.documentElement.style.getPropertyValue(PANEL_WIDTH_PROPERTY);

const handle = () => screen.getByRole("separator", { name: "Panel width" });

beforeEach(() => {
  resetDevicePreferences();
  windowWidth(1_440);
  document.documentElement.style.removeProperty(PANEL_WIDTH_PROPERTY);
  vi.mocked(api.writePreferences).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("what the handle reports", () => {
  it("opens at the remembered width, before the panel is painted", () => {
    render(<PanelResizeHandle />);

    // 800 is the default, and it is on the root by the time render returns —
    // a width that arrived a frame later would be a panel that snaps.
    expect(drawn()).toBe("800px");
    expect(handle().getAttribute("aria-valuenow")).toBe("800");
  });

  it("names the range this window allows", () => {
    render(<PanelResizeHandle />);

    expect(handle().getAttribute("aria-valuemin")).toBe(
      String(PANEL_WIDTH_MIN),
    );
    // 88% of 1440, the ceiling the panel has always had.
    expect(handle().getAttribute("aria-valuemax")).toBe("1267");
  });
});

describe("the keyboard path", () => {
  it("widens on `←` and narrows on `→`", () => {
    render(<PanelResizeHandle />);

    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(drawn()).toBe("816px");

    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(drawn()).toBe("784px");
    expect(handle().getAttribute("aria-valuenow")).toBe("784");
  });

  it("moves in bigger steps with shift held", () => {
    render(<PanelResizeHandle />);

    fireEvent.keyDown(handle(), { key: "ArrowLeft", shiftKey: true });

    expect(drawn()).toBe("864px");
  });

  it("stops at the floor LC-227's properties rail needs", () => {
    render(<PanelResizeHandle />);

    for (let press = 0; press < 20; press += 1) {
      fireEvent.keyDown(handle(), { key: "ArrowRight", shiftKey: true });
    }

    expect(drawn()).toBe(`${PANEL_WIDTH_MIN}px`);
  });

  it("leaves every other key to the page", () => {
    render(<PanelResizeHandle />);
    const before = drawn();

    for (const key of ["ArrowUp", "ArrowDown", "Enter", "j"]) {
      const event = fireEvent.keyDown(handle(), { key, cancelable: true });
      expect(event).toBe(true);
    }

    expect(drawn()).toBe(before);
  });

  it("keeps the arrows from reaching the board behind it", () => {
    render(<PanelResizeHandle />);
    const board = vi.fn();
    document.addEventListener("keydown", board);

    fireEvent.keyDown(handle(), { key: "ArrowLeft" });

    expect(board).not.toHaveBeenCalled();
    document.removeEventListener("keydown", board);
  });
});

describe("the gesture", () => {
  it("widens as the handle is dragged left, and settles on release", () => {
    render(<PanelResizeHandle />);

    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 640 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 560 });
    expect(drawn()).toBe("880px");
    // Mid-gesture the control has not moved: nothing renders until it ends.
    expect(handle().getAttribute("aria-valuenow")).toBe("800");

    fireEvent.pointerUp(handle(), { pointerId: 1, clientX: 540 });

    expect(drawn()).toBe("900px");
    expect(handle().getAttribute("aria-valuenow")).toBe("900");
  });

  it("keeps what a cancelled gesture had already drawn", () => {
    render(<PanelResizeHandle />);

    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 640 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 600 });
    fireEvent.pointerCancel(handle(), { pointerId: 1, clientX: 600 });

    expect(drawn()).toBe("840px");
    expect(handle().getAttribute("aria-valuenow")).toBe("840");
  });
});

describe("a window with nowhere to drag into", () => {
  beforeEach(() => windowWidth(760));

  it("says it is unavailable rather than refusing silently", () => {
    render(<PanelResizeHandle />);

    expect(handle().getAttribute("aria-disabled")).toBe("true");
    // Still a focus stop: a control that cannot act can still say so.
    expect(handle().getAttribute("tabindex")).toBe("0");
  });

  it("takes neither the keyboard nor the pointer", () => {
    render(<PanelResizeHandle />);
    const before = drawn();

    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 40 });

    expect(drawn()).toBe(before);
  });
});
