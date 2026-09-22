/**
 * The update path's decisions that are not markup (LC-256a): which reason gets
 * which sentence, when a scheduled check is due, and how the two numbers the
 * pane shows are worded.
 *
 * The contract pin at the end is the frontend half of seam 3. Rust asserts its
 * own `UpdateFault::ALL` against the same fixture, so the two sides cannot
 * drift into disagreeing about what a reason is called — which would show up as
 * a pane that quietly falls back to *couldn't check* for a failure Rust does
 * distinguish.
 */

import ipcContractJson from "../src-tauri/tests/fixtures/ipc-contract.json";
import { describe, expect, it } from "vitest";
import {
  CHECK_INTERVAL_MS,
  UPDATE_COPY,
  describeAge,
  describeBytes,
  isCheckDue,
  isUpdateFailureReason,
  updateFailureReason,
  updateFailureSentence,
} from "./updates";
import { UPDATE_FAILURE_REASONS } from "./types";

describe("which failure gets which sentence", () => {
  /**
   * Three of the seven share *couldn't check*, deliberately: offline, a proxy
   * that answered instead, and a manifest this build cannot read are one thing
   * to the person sitting there. The three that get their own words are the
   * three about a *file* — one that would not verify, one that did not arrive,
   * and one that arrived whole and could not be put in place.
   */
  it("says one thing about the network and three about the file", () => {
    for (const reason of ["offline", "blocked", "badManifest"] as const) {
      expect(updateFailureSentence(reason)).toBe(UPDATE_COPY.pane.checkFailed);
    }
    expect(updateFailureSentence("badSignature")).toBe(
      UPDATE_COPY.pane.verifyFailed,
    );
    expect(updateFailureSentence("corruptDownload")).toBe(
      UPDATE_COPY.pane.downloadFailed,
    );
    expect(updateFailureSentence("installFailed")).toBe(
      UPDATE_COPY.pane.installFailed,
    );
  });

  /**
   * The pair LC-265y turned on. A failed install wore the failed download's
   * sentence, so the pane blamed the one step that had worked and the bug was
   * looked for at the network for a day. They are different news and they must
   * not read alike.
   */
  it("does not tell someone their download failed when the install did", () => {
    expect(updateFailureSentence("installFailed")).not.toBe(
      updateFailureSentence("corruptDownload"),
    );
  });

  it("gives the two states that are not network failures their own words", () => {
    expect(updateFailureSentence("unavailable")).toBe(
      UPDATE_COPY.pane.unavailable,
    );
    expect(updateFailureSentence("writeInFlight")).toBe(
      UPDATE_COPY.pane.restartBlocked,
    );
  });

  /**
   * A reason this build does not know promises nothing rather than saying
   * nothing. *Couldn't check* is true of every unknown failure, which is the
   * only sentence it is safe to fall back to.
   */
  it("falls back for a reason a newer build might send", () => {
    expect(isUpdateFailureReason("somethingNewer")).toBe(false);
    expect(updateFailureSentence(undefined)).toBe(UPDATE_COPY.pane.checkFailed);
  });

  it("reads the reason off the tagged error and ignores anything else", () => {
    expect(
      updateFailureReason({ code: "io", context: { reason: "blocked" } }),
    ).toBe("blocked");
    expect(updateFailureReason({ code: "io" })).toBe(undefined);
    expect(updateFailureReason(undefined)).toBe(undefined);
    expect(updateFailureReason("offline")).toBe(undefined);
  });
});

describe("when a scheduled check is due", () => {
  const now = Date.parse("2026-09-19T12:00:00.000Z");
  const hoursAgo = (hours: number) =>
    new Date(now - hours * 60 * 60 * 1000).toISOString();

  /**
   * The preference is read **before** the request, which is what ADR 0014
   * means by the choice being honoured before anything is asked rather than
   * after one. The runtime audit's `automatic-off` phase records the same fact
   * from outside.
   */
  it("is never due with the automatic check off, however long it has been", () => {
    expect(isCheckDue(false, undefined, now)).toBe(false);
    expect(isCheckDue(false, hoursAgo(1000), now)).toBe(false);
  });

  it("is due on a machine that has never checked", () => {
    expect(isCheckDue(true, undefined, now)).toBe(true);
  });

  it("is not due again inside the slot", () => {
    expect(isCheckDue(true, hoursAgo(1), now)).toBe(false);
    expect(isCheckDue(true, hoursAgo(23), now)).toBe(false);
    expect(isCheckDue(true, hoursAgo(24), now)).toBe(true);
  });

  it("treats a record it cannot read as no record at all", () => {
    expect(isCheckDue(true, "the other day", now)).toBe(true);
  });

  it("keeps the same slot Rust enforces", () => {
    expect(CHECK_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("the two numbers the pane shows", () => {
  const now = Date.parse("2026-09-19T12:00:00.000Z");
  const minutesAgo = (minutes: number) =>
    new Date(now - minutes * 60 * 1000).toISOString();

  it("says so plainly when nothing has ever been checked", () => {
    expect(describeAge(undefined, now)).toBe(UPDATE_COPY.pane.never);
    expect(describeAge("not a date", now)).toBe(UPDATE_COPY.pane.never);
  });

  /**
   * Coarse on purpose. `Last checked` answers "is this roughly current", and a
   * minute count invites a reader to watch a thing that is supposed to be
   * beneath notice.
   */
  it("gets coarser as it gets older", () => {
    expect(describeAge(minutesAgo(0), now)).toBe(
      UPDATE_COPY.pane.last("just now"),
    );
    expect(describeAge(minutesAgo(1), now)).toBe(
      UPDATE_COPY.pane.last("1 minute ago"),
    );
    expect(describeAge(minutesAgo(5), now)).toBe(
      UPDATE_COPY.pane.last("5 minutes ago"),
    );
    expect(describeAge(minutesAgo(60), now)).toBe(
      UPDATE_COPY.pane.last("1 hour ago"),
    );
    expect(describeAge(minutesAgo(60 * 25), now)).toBe(
      UPDATE_COPY.pane.last("1 day ago"),
    );
    expect(describeAge(minutesAgo(60 * 24 * 9), now)).toBe(
      UPDATE_COPY.pane.last("9 days ago"),
    );
  });

  it("never reports a check made in the future as a negative age", () => {
    expect(describeAge(new Date(now + 60_000).toISOString(), now)).toBe(
      UPDATE_COPY.pane.last("just now"),
    );
  });

  /**
   * One decimal, because the artefact is tens of megabytes and a figure whose
   * last digit changes every frame is motion rather than information.
   */
  it("reads a download in the size the artefact actually is", () => {
    expect(describeBytes(0)).toBe("0 KB");
    expect(describeBytes(512 * 1024)).toBe("512 KB");
    expect(describeBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(describeBytes(18.75 * 1024 * 1024)).toBe("18.8 MB");
  });
});

describe("the contract the two sides share", () => {
  it("names the failure reasons Rust names, in the same order", () => {
    expect([...UPDATE_FAILURE_REASONS]).toEqual(
      (ipcContractJson as Record<string, unknown>).updateFailureReasons,
    );
  });

  /**
   * Every reason has a sentence. A reason added to the tuple without one would
   * otherwise reach the pane as the fallback, which is a real failure reported
   * as an unknown one.
   */
  it("has a sentence for every one of them", () => {
    for (const reason of UPDATE_FAILURE_REASONS) {
      expect(updateFailureSentence(reason).length).toBeGreaterThan(0);
    }
  });
});
