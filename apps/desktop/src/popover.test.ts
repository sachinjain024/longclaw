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
import { fitsBeside, liftIntoView, placeAtPoint } from "./popover";

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

/**
 * The two decisions a submenu makes about where it can go. Both are measured
 * against a live box in the app and neither can be reached by a test that
 * measures one — jsdom lays nothing out, so `getBoundingClientRect` is all
 * zeroes and every submenu in every test has infinite room (LC-222's review).
 */
describe("where a submenu fits", () => {
  it("takes its parent's right side when the window has room for it", () => {
    expect(fitsBeside(700, 200, 1440)).toBe(true);
  });

  it("refuses the right side when the submenu would end outside the window", () => {
    expect(fitsBeside(1300, 200, 1440)).toBe(false);
    // Exactly flush is inside, and is the case the board's last column makes.
    expect(fitsBeside(1240, 200, 1440)).toBe(true);
  });

  it("lifts a submenu that hangs below the window by exactly its overhang", () => {
    // 918 in an 900-tall window: 18 past the edge, plus the 8px margin.
    expect(liftIntoView({ top: 738, bottom: 918 }, 900)).toBe(26);
  });

  it("lifts nothing when the submenu already ends inside the window", () => {
    expect(liftIntoView({ top: 200, bottom: 380 }, 900)).toBe(0);
    expect(liftIntoView({ top: 200, bottom: 892 }, 900)).toBe(0);
  });

  it("never lifts a submenu past the top of the window", () => {
    // Taller than the window: the rows nearest its parent are the ones the
    // pointer is on, so it keeps those and loses the far end.
    expect(liftIntoView({ top: 20, bottom: 1200 }, 900)).toBe(12);
    expect(liftIntoView({ top: 4, bottom: 1200 }, 900)).toBe(0);
  });
});
