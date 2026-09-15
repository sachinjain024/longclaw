/**
 * The panel's width as arithmetic, away from the pointer that usually drives it.
 *
 * Two numbers here are decisions rather than comfort limits (LC-238s). 800 is
 * the default because LC-227's properties rail is behind a container query at
 * 660px and a default under it would ship that rail switched off; 660 is the
 * drag floor for the same reason. Both are asserted rather than described, so a
 * later "let's make it a bit narrower" has to answer for the rail.
 */

import { describe, expect, it } from "vitest";
import {
  PANEL_RAIL_FLOOR,
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  isStoredPanelWidth,
  panelResizeInert,
  panelWidthFromDrag,
  panelWidthFromKey,
  reachablePanelWidth,
} from "./panelWidth";

describe("the numbers the rail depends on", () => {
  it("defaults wide enough to draw LC-227's properties rail", () => {
    expect(PANEL_WIDTH_DEFAULT).toBe(800);
    expect(PANEL_WIDTH_DEFAULT).toBeGreaterThanOrEqual(PANEL_RAIL_FLOOR);
  });

  it("will not let a drag fold the rail away", () => {
    expect(PANEL_WIDTH_MIN).toBe(PANEL_RAIL_FLOOR);
    expect(reachablePanelWidth(400, 1_440)).toBe(PANEL_WIDTH_MIN);
  });
});

describe("a width read back from the document", () => {
  it("takes a number inside the range this build can draw", () => {
    expect(isStoredPanelWidth(PANEL_WIDTH_MIN)).toBe(true);
    expect(isStoredPanelWidth(PANEL_WIDTH_DEFAULT)).toBe(true);
    expect(isStoredPanelWidth(PANEL_WIDTH_MAX)).toBe(true);
  });

  it("drops a number outside it, and anything that is not one", () => {
    for (const rejected of [
      PANEL_WIDTH_MIN - 1,
      PANEL_WIDTH_MAX + 1,
      0,
      -800,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "800",
      true,
      null,
      undefined,
      {},
    ]) {
      expect(isStoredPanelWidth(rejected)).toBe(false);
    }
  });
});

describe("what this window can actually draw", () => {
  it("caps at 88% of the window, the ceiling the panel already had", () => {
    expect(reachablePanelWidth(1_200, 1_000)).toBe(880);
    expect(reachablePanelWidth(1_200, 2_000)).toBe(1_200);
  });

  it("keeps the floor when the cap falls under it", () => {
    // A 700px window caps at 616 — under the rail's 660. The floor wins and the
    // panel is drawn at 88% by CSS; nothing here stores a width under 660.
    expect(reachablePanelWidth(PANEL_WIDTH_DEFAULT, 700)).toBe(PANEL_WIDTH_MIN);
  });

  it("never stores more than the largest width this build accepts back", () => {
    expect(reachablePanelWidth(9_000, 100_000)).toBe(PANEL_WIDTH_MAX);
  });
});

describe("the gesture", () => {
  it("widens as the left edge is dragged left", () => {
    expect(panelWidthFromDrag(800, -120, 1_440)).toBe(920);
    expect(panelWidthFromDrag(800, 120, 1_440)).toBe(680);
  });

  it("stops at the floor and at the window's cap", () => {
    expect(panelWidthFromDrag(800, 400, 1_440)).toBe(PANEL_WIDTH_MIN);
    expect(panelWidthFromDrag(800, -900, 1_440)).toBe(1_267);
  });
});

describe("the keyboard path", () => {
  it("moves 16px a press, and 64px with shift", () => {
    expect(panelWidthFromKey(800, "ArrowLeft", false, 1_440)).toBe(816);
    expect(panelWidthFromKey(800, "ArrowRight", false, 1_440)).toBe(784);
    expect(panelWidthFromKey(800, "ArrowLeft", true, 1_440)).toBe(864);
    expect(panelWidthFromKey(800, "ArrowRight", true, 1_440)).toBe(736);
  });

  it("answers nothing for a key that is not a resize", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", "a", " "]) {
      expect(panelWidthFromKey(800, key, false, 1_440)).toBeUndefined();
    }
  });

  it("holds at the floor rather than reporting a width it will not take", () => {
    expect(panelWidthFromKey(PANEL_WIDTH_MIN, "ArrowRight", true, 1_440)).toBe(
      PANEL_WIDTH_MIN,
    );
  });
});

describe("a window with nowhere to drag into", () => {
  it("is inert below the width that leaves 24px of travel", () => {
    // 760 is `tauri.conf.json`'s `minWidth`: 88% of it is 668, 8px above the
    // floor. The handle says so rather than refusing silently.
    expect(panelResizeInert(760)).toBe(true);
    expect(panelResizeInert(777)).toBe(true);
    expect(panelResizeInert(778)).toBe(false);
    expect(panelResizeInert(1_440)).toBe(false);
  });
});
