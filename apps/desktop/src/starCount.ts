/**
 * The star count the status bar draws, and when it is worth asking for
 * (LC-257s).
 *
 * **The cache is what the control reads; the request is what refreshes it.**
 * A count that arrives after first paint and appears out of nowhere reads as a
 * count that went up, so the number on screen is the one in device preferences
 * and the request only ever replaces it. On a machine that has never fetched
 * one there is no number, which is the state the control is designed around
 * anyway.
 *
 * **Two slots, held at both ends.** This decides whether to ask, because the
 * timestamp lives in the preferences document the frontend owns; Rust refuses a
 * second request inside its own slot, because a schedule that lived only in a
 * webview is a schedule a reload resets. Neither is the other's backstop — it
 * is one rule held in both places, the same arrangement the update check has.
 *
 * **The preference gates this the way it gates the update check.** ADR 0014
 * forbids a request before the choice that governs it is read, and ADR 0015
 * inherits that unchanged for the second caller; `isFetchDue` therefore asks
 * the same question in the same order `isCheckDue` does, rather than leaving
 * the effect to remember. The first shipped draft of this file did leave it to
 * the effect, and the answer was a `GET api.github.com` on every launch of a
 * machine that had turned automatic checks off — the one thing the runtime
 * audit's `automatic-off` phase exists to catch, and the one thing no test in
 * `verify` could see.
 */

import { useEffect, useState } from "react";

import { starCount } from "./api";
import {
  readAutomaticUpdateCheck,
  readStarCount,
  rememberStarCount,
} from "./devicePreferences";
import { STAR_INTERVAL_MS } from "./github";

/**
 * Whether a count is worth asking for.
 *
 * **The preference is read here, before the request**, which is what ADR 0014
 * means by the choice being honoured before anything is asked and what ADR
 * 0015 promises for this caller too. With automatic checks off nothing is ever
 * asked, however old the cache is — the cached number stays on screen, because
 * refusing the road is not the same as disowning what came down it.
 *
 * A cache with no timestamp, or one whose timestamp will not parse, is due:
 * the pair is written together, so a half of it is a hand-edited file and the
 * honest reading of an unreadable timestamp is that nothing is known about when
 * the number came from.
 *
 * The argument order is `isCheckDue`'s on purpose. Two functions that answer
 * *should I ask* about the same road should not read differently.
 */
export function isFetchDue(
  automatic: boolean,
  fetchedAt: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!automatic) return false;
  if (!fetchedAt) return true;
  const then = Date.parse(fetchedAt);
  if (Number.isNaN(then)) return true;
  return now - then >= STAR_INTERVAL_MS;
}

/**
 * The count for this window: the cached one immediately, and a fresher one if
 * the slot is up and automatic checks are on.
 *
 * Runs once per mount. It is deliberately not tied to the project, the view or
 * anything else that changes — the count is a fact about LongClaw, and a
 * dependency here would be a way for switching projects to become a request.
 */
export function useStarCount(): number | undefined {
  const [stars, setStars] = useState<number | undefined>(
    () => readStarCount()?.count,
  );

  useEffect(() => {
    const cached = readStarCount();
    if (!isFetchDue(readAutomaticUpdateCheck(), cached?.fetchedAt)) return;
    let live = true;
    void starCount()
      .then((count) => {
        // `null` is every failure there is, and it claims nothing: whatever was
        // cached stays on screen rather than being cleared by a bad afternoon
        // on the network.
        if (!live || count === null) return;
        rememberStarCount(count);
        setStars(count);
      })
      .catch(() => {
        // A host with no backend — a browser tab, the perf harness — answers no
        // commands. That is not a failure to report; it is a window with no
        // count, which is a state this control already has.
      });
    return () => {
      live = false;
    };
  }, []);

  return stars;
}
