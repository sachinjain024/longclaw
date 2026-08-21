/**
 * Where a popover opened at a point goes.
 *
 * The anchored placement in `popover.ts` has no viewport arithmetic in it at
 * all — it hangs a menu under a trigger, and a trigger is somewhere a person
 * could reach, so the popover under it is somewhere they can see. A context
 * menu has no such guarantee: it opens where the pointer was, and the pointer
 * can be one row above the bottom of the window (LC-222).
 */

import { describe, expect, it } from "vitest";
import { placeAtPoint } from "./popover";

const VIEWPORT = { width: 1000, height: 800 };
const MENU = { width: 220, height: 300 };

describe("placeAtPoint", () => {
  it("opens at the point when the popover fits below and beside it", () => {
    expect(placeAtPoint({ x: 120, y: 200 }, MENU, VIEWPORT)).toEqual({
      left: 120,
      top: 200,
    });
  });

  it("flips back over the point rather than running off the right edge", () => {
    // 900 + 220 is past the window, so the menu ends on the pointer instead of
    // starting there — the same gesture macOS makes.
    expect(placeAtPoint({ x: 900, y: 200 }, MENU, VIEWPORT)).toEqual({
      left: 680,
      top: 200,
    });
  });

  it("flips back over the point rather than running off the bottom edge", () => {
    expect(placeAtPoint({ x: 120, y: 700 }, MENU, VIEWPORT)).toEqual({
      left: 120,
      top: 400,
    });
  });

  it("keeps the margin when the flip would leave the window on the left too", () => {
    // A window narrower than the menu is wide. Neither side fits, so the menu
    // stands at the margin rather than starting off the edge, where its own
    // rows would be cut in half.
    expect(
      placeAtPoint({ x: 100, y: 20 }, MENU, { width: 300, height: 800 }),
    ).toEqual({ left: 8, top: 20 });
  });

  it("pins a popover taller than the window to the margin", () => {
    expect(
      placeAtPoint({ x: 10, y: 400 }, { width: 220, height: 900 }, VIEWPORT),
    ).toEqual({ left: 10, top: 8 });
  });

  it("leaves the point alone when nothing has been measured yet", () => {
    // The first render has no box to measure, and a zero-sized popover fits
    // anywhere: the point stands until the layout effect has something to say.
    expect(
      placeAtPoint({ x: 640, y: 700 }, { width: 0, height: 0 }, VIEWPORT),
    ).toEqual({ left: 640, top: 700 });
  });
});
