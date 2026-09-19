// @vitest-environment jsdom

/**
 * The *Updates* pane (LC-256a), driven over a mocked `api` — seam 2 of the
 * spec, and exactly the shape `CommandLineInstall.test.tsx` uses.
 *
 * Three things are worth a test here, and they are the three that would be
 * expensive to find later:
 *
 * - **Each state gets its own sentence.** A pane with five states and one
 *   refusal is mostly a question of which words appear, and the one that must
 *   never appear is a promise the app cannot keep — offering `Update` on a
 *   build that has no updater, or `Restart to update` for a file nobody
 *   verified.
 * - **The restart is held while a ticket write is outstanding, and says why.**
 *   Rust refuses it too, from a count around the write seams, and that is the
 *   guarantee; this is the sentence a person reads, and the two are different
 *   work.
 * - **A failure stays in the pane.** ADR 0014's offline invariant is that a
 *   machine which has never checked and one which is up to date are
 *   indistinguishable outside here, so a failed check must produce no toast, no
 *   banner and no change anywhere else.
 *
 * Every expected string is read from `UPDATE_COPY`, not typed here. The deck is
 * the source; a test that spelled the sentences out again would be the second
 * copy the prototype's own rule exists to prevent.
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as api from "./api";
import {
  rememberAutomaticUpdateCheck,
  readAutomaticUpdateCheck,
  resetDevicePreferences,
} from "./devicePreferences";
import { useMutationStore, resetMutations } from "./mutations";
import { UPDATE_COPY } from "./updates";
import { UNREAD_UPDATE_STATUS, UpdatesSection } from "./UpdatesPane";
import type { UpdateProgress, UpdateStatus } from "./types";

vi.mock("./api", () => ({
  checkForUpdate: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn(),
  openDownloadPage: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  resetDevicePreferences();
  resetMutations();
});

const RELEASE = {
  version: "0.2.0",
  date: "2026-09-19",
  notes: "- The board remembers its scroll",
};

function status(over: Partial<UpdateStatus> = {}): UpdateStatus {
  return {
    state: "upToDate",
    currentVersion: "0.1.0",
    available: null,
    downloaded: false,
    ...over,
  };
}

/** The tagged shape ADR 0010 sends, with the reason the pane switches on. */
function refusal(reason: string) {
  return { code: "io", message: "no", recoverable: true, context: { reason } };
}

function paneFor(initial: UpdateStatus) {
  function Harness() {
    const [current, setCurrent] = useState(initial);
    return <UpdatesSection status={current} onStatus={setCurrent} />;
  }
  return render(<Harness />);
}

it("a build with no updater says so, and offers nothing it cannot do", () => {
  render(<UpdatesSection status={UNREAD_UPDATE_STATUS} onStatus={() => {}} />);

  expect(screen.getByText(UPDATE_COPY.pane.unavailable)).toBeTruthy();
  // Hidden rather than disabled: a control that cannot do the thing it names
  // reads as broken, and that reading would be correct.
  expect(screen.queryByRole("button", { name: UPDATE_COPY.pane.check })).toBe(
    null,
  );
  expect(screen.queryByLabelText(UPDATE_COPY.pane.automaticLabel)).toBe(null);
});

it("a machine that has never checked says so rather than claiming to be current", () => {
  paneFor(status());

  expect(screen.getByText(UPDATE_COPY.pane.never)).toBeTruthy();
  expect(screen.queryByText(UPDATE_COPY.pane.upToDate)).toBe(null);
});

it("Check now asks, and a version found is named with its date and notes", async () => {
  vi.mocked(api.checkForUpdate).mockResolvedValue(
    status({ state: "available", available: RELEASE }),
  );
  paneFor(status());

  fireEvent.click(screen.getByRole("button", { name: UPDATE_COPY.pane.check }));

  await waitFor(() =>
    expect(
      screen.getByText(UPDATE_COPY.pane.availableTitle(RELEASE.version)),
    ).toBeTruthy(),
  );
  expect(api.checkForUpdate).toHaveBeenCalledWith(true);
  expect(
    screen.getByText(UPDATE_COPY.pane.availableDate(RELEASE.date)),
  ).toBeTruthy();
  expect(screen.getByText(/board remembers its scroll/)).toBeTruthy();
  // One press is offered, and it is the one that downloads.
  expect(
    screen.getByRole("button", { name: UPDATE_COPY.pane.download }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: UPDATE_COPY.pane.restart })).toBe(
    null,
  );
});

it("the second press appears only once the download has verified", async () => {
  vi.mocked(api.downloadUpdate).mockImplementation(
    async (onProgress: (frame: UpdateProgress) => void) => {
      onProgress({
        event: "progress",
        data: { received: 5 * 1024 * 1024, total: 10 * 1024 * 1024 },
      });
      return status({
        state: "available",
        available: RELEASE,
        downloaded: true,
      });
    },
  );
  paneFor(status({ state: "available", available: RELEASE }));

  fireEvent.click(
    screen.getByRole("button", { name: UPDATE_COPY.pane.download }),
  );

  await waitFor(() =>
    expect(screen.getByText(UPDATE_COPY.pane.ready)).toBeTruthy(),
  );
  expect(
    screen.getByRole("button", { name: UPDATE_COPY.pane.restart }),
  ).toBeTruthy();
});

it("a download that will not verify is said so, and offers both ways out", async () => {
  vi.mocked(api.downloadUpdate).mockRejectedValue(refusal("badSignature"));
  paneFor(status({ state: "available", available: RELEASE }));

  fireEvent.click(
    screen.getByRole("button", { name: UPDATE_COPY.pane.download }),
  );

  await waitFor(() =>
    expect(screen.getByText(UPDATE_COPY.pane.verifyFailed)).toBeTruthy(),
  );
  expect(
    screen.getByRole("button", { name: UPDATE_COPY.pane.retry }),
  ).toBeTruthy();
  // A retry alone is a dead end on a network that is not coming back.
  expect(
    screen.getByRole("button", { name: UPDATE_COPY.pane.downloadPage }),
  ).toBeTruthy();
  // And nothing is offered to install: what was verified was nothing.
  expect(screen.queryByRole("button", { name: UPDATE_COPY.pane.restart })).toBe(
    null,
  );
});

it("the restart is held while a ticket write is outstanding, and says why", () => {
  useMutationStore.getState().beginWrite("ticket.md");
  paneFor(status({ state: "available", available: RELEASE, downloaded: true }));

  const restart = screen.getByRole("button", {
    name: UPDATE_COPY.pane.restart,
  });
  // `aria-disabled`, not `disabled`: the button keeps its tab stop so a press
  // can announce the reason. A `disabled` button leaves the tab order and
  // nobody hears why.
  expect(restart.getAttribute("aria-disabled")).toBe("true");
  expect(restart.hasAttribute("disabled")).toBe(false);
  expect(restart.getAttribute("tabindex")).toBe("0");
  expect(screen.getByText(UPDATE_COPY.pane.restartBlocked)).toBeTruthy();

  useMutationStore.getState().endWrite("ticket.md");
});

it("the restart is offered again the moment the disk settles", () => {
  useMutationStore.getState().beginWrite("ticket.md");
  paneFor(status({ state: "available", available: RELEASE, downloaded: true }));
  // Through `act`, because the settle is a store update from outside React and
  // the assertion below is about the frame it produces.
  act(() => useMutationStore.getState().endWrite("ticket.md"));

  expect(
    screen
      .getByRole("button", { name: UPDATE_COPY.pane.restart })
      .getAttribute("aria-disabled"),
  ).toBe("false");
  expect(screen.queryByText(UPDATE_COPY.pane.restartBlocked)).toBe(null);
});

it("a refused restart announces the reason rather than looking broken", async () => {
  vi.mocked(api.installUpdate).mockRejectedValue(refusal("writeInFlight"));
  paneFor(status({ state: "available", available: RELEASE, downloaded: true }));

  fireEvent.click(
    screen.getByRole("button", { name: UPDATE_COPY.pane.restart }),
  );

  await waitFor(() =>
    expect(screen.getByText(UPDATE_COPY.live.blocked)).toBeTruthy(),
  );
});

it("a failed check says it failed and claims nothing about the version", async () => {
  vi.mocked(api.checkForUpdate).mockRejectedValue(refusal("offline"));
  paneFor(status());

  fireEvent.click(screen.getByRole("button", { name: UPDATE_COPY.pane.check }));

  await waitFor(() =>
    expect(screen.getByText(UPDATE_COPY.pane.checkFailed)).toBeTruthy(),
  );
  // A failed check is not a claim to be current, and it is not an update
  // either: the pane says the check did not work and nothing more.
  expect(screen.queryByText(UPDATE_COPY.pane.upToDate)).toBe(null);
  expect(screen.queryByText(/is available/)).toBe(null);
});

it("a reason this build does not know falls back rather than saying nothing", async () => {
  vi.mocked(api.checkForUpdate).mockRejectedValue(refusal("somethingNewer"));
  paneFor(status());

  fireEvent.click(screen.getByRole("button", { name: UPDATE_COPY.pane.check }));

  await waitFor(() =>
    expect(screen.getByText(UPDATE_COPY.pane.checkFailed)).toBeTruthy(),
  );
});

it("Try again repeats the press that failed, not the one the state implies", async () => {
  // A check can fail while a version is already pending. Inferring the retry
  // from "there is an update" would download instead of re-checking, which is
  // a button doing something other than what just failed.
  vi.mocked(api.checkForUpdate).mockRejectedValue(refusal("offline"));
  paneFor(status({ state: "available", available: RELEASE }));

  fireEvent.click(screen.getByRole("button", { name: UPDATE_COPY.pane.check }));
  await waitFor(() =>
    expect(screen.getByText(UPDATE_COPY.pane.checkFailed)).toBeTruthy(),
  );

  fireEvent.click(screen.getByRole("button", { name: UPDATE_COPY.pane.retry }));

  await waitFor(() => expect(api.checkForUpdate).toHaveBeenCalledTimes(2));
  expect(api.downloadUpdate).not.toHaveBeenCalled();
});

it("turning the automatic check off is remembered for this machine", () => {
  paneFor(status());

  const toggle = screen.getByLabelText(UPDATE_COPY.pane.automaticLabel);
  expect((toggle as HTMLInputElement).checked).toBe(true);

  fireEvent.click(toggle);

  expect(readAutomaticUpdateCheck()).toBe(false);
  expect((toggle as HTMLInputElement).checked).toBe(false);
  // And Check now is still there, so off never means stranded.
  expect(
    screen.getByRole("button", { name: UPDATE_COPY.pane.check }),
  ).toBeTruthy();
});

it("the toggle reads the stored preference rather than the default", () => {
  rememberAutomaticUpdateCheck(false);
  paneFor(status());

  expect(
    (screen.getByLabelText(UPDATE_COPY.pane.automaticLabel) as HTMLInputElement)
      .checked,
  ).toBe(false);
});

it("no label promises a dialog it does not open", () => {
  paneFor(status({ state: "available", available: RELEASE, downloaded: true }));

  for (const button of screen.getAllByRole("button")) {
    // `components.md` § Do / don't: a trailing ellipsis promises a dialog, and
    // nothing in this flow opens one. The dots survive only on an in-flight
    // frame, which no resting render shows.
    expect(button.textContent ?? "").not.toMatch(/…$/);
  }
});
