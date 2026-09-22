// @vitest-environment jsdom

/**
 * When the star count is worth asking for (LC-257s), and — the half that
 * matters more — when it must not be asked for at all.
 *
 * `isFetchDue` is the whole decision, so most of this is a table. The last
 * block renders the hook, because the defect this file now guards was not in
 * the decision: the first shipped draft made the decision without the
 * preference in it, and a machine with *Check for updates automatically* off
 * performed a `GET api.github.com` on every launch. Only the person-driven
 * `audit:network --phase=automatic-off` run could see that, which is the wrong
 * place for the only evidence of a promise ADR 0014 and ADR 0015 both make.
 */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import {
  rememberAutomaticUpdateCheck,
  rememberStarCount,
  resetDevicePreferences,
} from "./devicePreferences";
import { STAR_INTERVAL_MS } from "./github";
import { isFetchDue, useStarCount } from "./starCount";

vi.mock("./api", () => ({ starCount: vi.fn() }));

const NOW = Date.parse("2026-09-21T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("when a count is worth asking for again", () => {
  it("is due when nothing has ever been fetched", () => {
    expect(isFetchDue(true, undefined, NOW)).toBe(true);
  });

  it("is not due inside the slot", () => {
    expect(isFetchDue(true, ago(0), NOW)).toBe(false);
    expect(isFetchDue(true, ago(STAR_INTERVAL_MS - 1), NOW)).toBe(false);
  });

  it("is due once the slot is up", () => {
    expect(isFetchDue(true, ago(STAR_INTERVAL_MS), NOW)).toBe(true);
    expect(isFetchDue(true, ago(STAR_INTERVAL_MS * 3), NOW)).toBe(true);
  });

  it("is due when the timestamp will not parse", () => {
    // The count and its timestamp are written together, so a half of the pair
    // is a hand-edited file. The honest reading of an unreadable timestamp is
    // that nothing is known about when the number came from.
    expect(isFetchDue(true, "whenever", NOW)).toBe(true);
    expect(isFetchDue(true, "", NOW)).toBe(true);
  });

  it("is due when the clock has gone backwards past the timestamp", () => {
    // Not a retry loop: Rust holds its own slot, so a machine whose clock
    // jumped still makes at most one request a day.
    expect(isFetchDue(true, new Date(NOW + 60_000).toISOString(), NOW)).toBe(
      false,
    );
  });

  it("is never due with automatic checks off, however old the cache is", () => {
    // The preference is read before the request, not after one (ADR 0014,
    // inherited by ADR 0015). Every row above that says `true` says `false`
    // here, including the fresh-install one — a machine that has never fetched
    // a count and has refused the road must ask for nothing.
    expect(isFetchDue(false, undefined, NOW)).toBe(false);
    expect(isFetchDue(false, ago(STAR_INTERVAL_MS * 3), NOW)).toBe(false);
    expect(isFetchDue(false, "whenever", NOW)).toBe(false);
  });
});

function Probe() {
  const stars = useStarCount();
  return <span data-testid="stars">{stars ?? "none"}</span>;
}

describe("what the window asks for on mount", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    resetDevicePreferences();
  });

  it("asks when the preference is on and the cache is due", async () => {
    vi.mocked(api.starCount).mockResolvedValue(1234);
    const { getByTestId } = render(<Probe />);
    await waitFor(() => expect(getByTestId("stars").textContent).toBe("1234"));
    expect(api.starCount).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing when automatic checks are off", async () => {
    rememberAutomaticUpdateCheck(false);
    vi.mocked(api.starCount).mockResolvedValue(1234);
    render(<Probe />);
    // No cache exists here — this is the fresh machine the defect was found
    // on, where `isFetchDue` used to be true for want of anything to age.
    await waitFor(() => expect(api.starCount).not.toHaveBeenCalled());
  });

  it("still draws the count it already has with the preference off", () => {
    rememberStarCount(1234, ago(STAR_INTERVAL_MS * 3));
    rememberAutomaticUpdateCheck(false);
    const { getByTestId } = render(<Probe />);
    // Refusing the road is not disowning what came down it: the number stays,
    // it just stops being refreshed.
    expect(getByTestId("stars").textContent).toBe("1234");
    expect(api.starCount).not.toHaveBeenCalled();
  });
});
