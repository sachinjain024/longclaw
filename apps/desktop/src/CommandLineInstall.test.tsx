// @vitest-environment jsdom

/**
 * Installing the `longclaw` command (LC-233).
 *
 * Five states and one refusal, and the whole feature is which sentence each one
 * gets. What is asserted here is that they are different sentences: the two
 * states that look alike from a terminal — a link pointing here and a link
 * pointing at a copy of the app that has moved — must not read alike in the
 * app, because "already installed" over a stale link is how somebody ends up
 * running last month's build against this month's file format.
 *
 * The refusal is the other half. The app cannot escalate (`release-audit.mjs`
 * forbids the subprocess that would ask), so the line to paste *is* the
 * feature, and a refusal that swallowed it would leave a person with no way
 * through at all.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import {
  CommandLineOffer,
  CommandLineSection,
  commandLineHint,
  shouldOfferCommandLine,
} from "./CommandLineInstall";
import { useMutationStore } from "./mutations";
import type { CommandLineStatus } from "./types";

vi.mock("./api", () => ({ installCommandLine: vi.fn() }));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const SOURCE = "/Applications/LongClaw.app/Contents/MacOS/longclaw";
const LINK = "/usr/local/bin/longclaw";
const COMMAND = `sudo mkdir -p '/usr/local/bin' && sudo ln -sf '${SOURCE}' '${LINK}'`;

function status(over: Partial<CommandLineStatus> = {}): CommandLineStatus {
  return {
    state: "absent",
    sourcePath: SOURCE,
    linkPath: LINK,
    currentTarget: null,
    manualCommand: COMMAND,
    ...over,
  };
}

/** The one control that installs, whatever this state calls it. */
function installButton() {
  return screen.getByRole("button", { name: /Install|Point it at this app/ });
}

describe("the command line pane", () => {
  it("offers an install when nothing is on PATH", async () => {
    const onStatus = vi.fn();
    vi.mocked(api.installCommandLine).mockResolvedValue(
      status({ state: "linked", currentTarget: SOURCE }),
    );
    render(<CommandLineSection status={status()} onStatus={onStatus} />);

    expect(screen.getByText(/is not on your/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(onStatus).toHaveBeenCalled());
    expect(onStatus.mock.calls[0][0].state).toBe("linked");
  });

  /** The state that reads as "done" from a terminal and is not. */
  it("names what a stale link points at, and offers to re-point it", () => {
    const previous = "/Users/me/Downloads/LongClaw.app/Contents/MacOS/longclaw";
    render(
      <CommandLineSection
        status={status({ state: "stale", currentTarget: previous })}
        onStatus={() => {}}
      />,
    );

    expect(screen.getByText(previous)).toBeTruthy();
    expect(installButton().textContent).toBe("Point it at this app");
  });

  it("reports an install that already points at this app, and offers nothing", () => {
    render(
      <CommandLineSection
        status={status({ state: "linked", currentTarget: SOURCE })}
        onStatus={() => {}}
      />,
    );

    expect(screen.getByText(/points at this copy of LongClaw/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Install/ })).toBeNull();
  });

  /**
   * Somebody's own binary. There is no button, because pressing it could only
   * ever fail — the line is the whole answer, and it is shown without asking.
   */
  it("refuses a file it did not create, and shows the line that replaces it", () => {
    render(
      <CommandLineSection
        status={status({ state: "occupied" })}
        onStatus={() => {}}
      />,
    );

    expect(screen.getByText(/did not create/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Install/ })).toBeNull();
    expect(screen.getByText(COMMAND)).toBeTruthy();
  });

  it("says there is nothing to install in a build with no command beside it", () => {
    render(
      <CommandLineSection
        status={status({
          state: "unavailable",
          sourcePath: null,
          manualCommand: null,
        })}
        onStatus={() => {}}
      />,
    );

    expect(screen.getByText(/nothing\s+to install/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Install/ })).toBeNull();
    expect(screen.queryByText(/sudo/)).toBeNull();
  });

  /**
   * The whole escalation story: no privileged helper, no subprocess — the
   * refusal in words, and the exact line with the paths already in it.
   */
  it("shows the refusal and the exact line when the write is not allowed", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue({
      code: "permission_denied",
      message: "LongClaw is not allowed to write to /usr/local/bin.",
      recoverable: true,
    });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(/not allowed to write/);
    expect(screen.getByText(COMMAND)).toBeTruthy();
  });

  /**
   * The status was read at launch; the refusal was computed against the paths
   * the write actually used. If the app has been moved since, only one of them
   * is the "exact line" the refusal promises.
   */
  it("prefers the line the refusal itself carries over the one read at launch", async () => {
    const fresher = `sudo mkdir -p '/usr/local/bin' && sudo ln -sf '/Applications/Moved/LongClaw.app/Contents/MacOS/longclaw' '${LINK}'`;
    vi.mocked(api.installCommandLine).mockRejectedValue({
      code: "permission_denied",
      message: "LongClaw is not allowed to write to /usr/local/bin.",
      recoverable: true,
      context: { command: fresher },
    });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(fresher);
    expect(screen.queryByText(COMMAND)).toBeNull();
  });

  /** A refusal from an older build carries no command; the status still has one. */
  it("falls back to the status's line when the refusal carries none", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue({
      code: "permission_denied",
      message: "LongClaw is not allowed to write to /usr/local/bin.",
      recoverable: true,
    });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(COMMAND);
  });

  it("copies the line, and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <CommandLineSection
        status={status({ state: "occupied" })}
        onStatus={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(COMMAND));
    expect(useMutationStore.getState().toast?.message).toBe("Command copied");
  });
});

describe("the first-launch offer", () => {
  it("is raised for a machine that has never been asked and has no command", () => {
    expect(shouldOfferCommandLine(status(), false)).toBe(true);
    expect(shouldOfferCommandLine(status({ state: "stale" }), false)).toBe(
      true,
    );
  });

  it("is not raised twice, and not raised when there is nothing to offer", () => {
    expect(shouldOfferCommandLine(status(), true)).toBe(false);
    expect(shouldOfferCommandLine(status({ state: "linked" }), false)).toBe(
      false,
    );
    expect(shouldOfferCommandLine(status({ state: "occupied" }), false)).toBe(
      false,
    );
    expect(
      shouldOfferCommandLine(status({ state: "unavailable" }), false),
    ).toBe(false);
  });

  /**
   * The row named a thing to do that cannot be done: `not set up` on a window
   * with nothing to install, opening a pane that says so.
   */
  it("gives the settings menu row no hint when there is nothing to install", () => {
    expect(commandLineHint(status({ state: "unavailable" }))).toBeNull();
    expect(commandLineHint(undefined)).toBeNull();
    expect(commandLineHint(status({ state: "linked" }))).toBe("on PATH");
    expect(commandLineHint(status())).toBe("not set up");
    expect(commandLineHint(status({ state: "stale" }))).toBe("not set up");
  });

  it("closes and records the answer when the install lands", async () => {
    const onDismiss = vi.fn();
    vi.mocked(api.installCommandLine).mockResolvedValue(
      status({ state: "linked", currentTarget: SOURCE }),
    );
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  /** `Not now` is an answer, and the machine is not asked again. */
  it("closes and records the answer when it is declined", () => {
    const onDismiss = vi.fn();
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onDismiss).toHaveBeenCalled();
    expect(api.installCommandLine).not.toHaveBeenCalled();
  });

  /**
   * A refusal keeps the dialog up, because the dialog is where the line is.
   * Dismissing to a toast would strand a first-launch user on the welcome
   * screen, which has no settings to go back to.
   */
  it("stays up after a refusal, holding the line to paste", async () => {
    const onDismiss = vi.fn();
    vi.mocked(api.installCommandLine).mockRejectedValue({
      code: "permission_denied",
      message: "LongClaw is not allowed to write to /usr/local/bin.",
      recoverable: true,
    });
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(COMMAND);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});
