// @vitest-environment jsdom

/**
 * Installing the `longclaw` command (LC-233), and saying what it is for
 * (LC-249a).
 *
 * Five states and one refusal, and half the feature is which sentence each one
 * gets. What is asserted here is that they are different sentences: the two
 * states that look alike from a terminal — a link pointing here and a link
 * pointing at a copy of the app that has moved — must not read alike in the
 * app, because "already installed" over a stale link is how somebody ends up
 * running last month's build against this month's file format.
 *
 * The refusal is the second half. The app cannot escalate (`release-audit.mjs`
 * forbids the subprocess that would ask), so the line to paste *is* the
 * feature, and a refusal that swallowed it would leave a person with no way
 * through at all.
 *
 * The third is what LC-249a added: that the surfaces make an argument before
 * they describe a button, that the sentences which survived are the ones that
 * are news, and that answering the offer is a thing a person can take back.
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
import { DEMO_COMMAND } from "./commandLineDemo";
import {
  readCommandLinePrompted,
  rememberCommandLinePrompted,
  resetDevicePreferences,
} from "./devicePreferences";
import { useMutationStore } from "./mutations";
import type { CommandLineStatus } from "./types";

vi.mock("./api", () => ({ installCommandLine: vi.fn() }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  resetDevicePreferences();
});

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
  return screen.getByRole("button", {
    name: /Install|Point it at this app|Try again/,
  });
}

/** The terminal block, by the accessible name it is not allowed to go without. */
function preview() {
  return screen.queryByRole("group", {
    name: "Example of the longclaw command and its output",
  });
}

describe("the command line pane", () => {
  it("offers an install when nothing is on PATH", async () => {
    const onStatus = vi.fn();
    vi.mocked(api.installCommandLine).mockResolvedValue(
      status({ state: "linked", currentTarget: SOURCE }),
    );
    render(<CommandLineSection status={status()} onStatus={onStatus} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(onStatus).toHaveBeenCalled());
    expect(onStatus.mock.calls[0][0].state).toBe("linked");
  });

  /**
   * The one state with no sentence, and the reason it has none: the button
   * states the case by offering to change it, so LC-233's "`longclaw` is not on
   * your `PATH` yet" above an `Install` button was the same fact twice.
   */
  it("says nothing about being absent, because the Install button says it", () => {
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    expect(screen.queryByText(/is not on your/)).toBeNull();
    expect(screen.getByRole("button", { name: "Install" })).toBeTruthy();
  });

  /**
   * The block that makes the case, and the command in it is the constant
   * `cli-demo-guard.mjs` holds to a real CLI verb — not a string typed into the
   * component and not the design's `longclaw list --status todo`.
   */
  it("leads with a preview of the command, from the guarded constant", () => {
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    expect(preview()).toBeTruthy();
    expect(screen.getByText(DEMO_COMMAND)).toBeTruthy();
    expect(screen.getByText(/what it gets you · example/)).toBeTruthy();
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
    // The same block, reframed: on a stale link the command does run — it runs
    // the wrong build, which is the whole point.
    expect(screen.getByText(/what it is running today · example/)).toBeTruthy();
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
    // Nothing to demonstrate where there is nothing to install: a preview here
    // would be arguing for a button that does not exist.
    expect(preview()).toBeNull();
  });

  /**
   * The whole escalation story: no privileged helper, no subprocess — the
   * refusal in words, and the exact line with the paths already in it.
   */
  it("shows the refusal and the exact line when the write is not allowed", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue({
      code: "permission_denied",
      message:
        "LongClaw could not write to /usr/local/bin. The line below does the same thing.",
      recoverable: true,
    });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(/could not write to/);
    expect(screen.getByText(COMMAND)).toBeTruthy();
  });

  /**
   * LC-233 left the button reading `Install` after a failed install, so pressing
   * it a second time looked like the first press had not registered.
   */
  it("turns the primary into Try again once a write has been refused", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue({
      code: "permission_denied",
      message:
        "LongClaw could not write to /usr/local/bin. The line below does the same thing.",
      recoverable: true,
    });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
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
      message:
        "LongClaw could not write to /usr/local/bin. The line below does the same thing.",
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
      message:
        "LongClaw could not write to /usr/local/bin. The line below does the same thing.",
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

    fireEvent.click(
      screen.getByRole("button", { name: "Copy the install command" }),
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(COMMAND));
    expect(useMutationStore.getState().toast?.message).toBe("Command copied");
  });
});

/**
 * `commandLinePrompted` was one-way in LC-233: a person who declined on first
 * launch could not be asked again on that Mac, and nothing on screen said the
 * press had done anything at all.
 */
describe("the ask-again checkbox", () => {
  function checkbox() {
    return screen.getByRole("checkbox", {
      name: /Ask again when I open a project without the command/,
    });
  }

  it("is on for a machine that has not been asked, and off for one that has", () => {
    render(<CommandLineSection status={status()} onStatus={() => {}} />);
    expect((checkbox() as HTMLInputElement).checked).toBe(true);

    cleanup();
    rememberCommandLinePrompted();
    render(<CommandLineSection status={status()} onStatus={() => {}} />);
    expect((checkbox() as HTMLInputElement).checked).toBe(false);
  });

  it("clears the preference, which is what LC-233 had no way to do", () => {
    rememberCommandLinePrompted();
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(checkbox());

    expect(readCommandLinePrompted()).toBe(false);
    expect((checkbox() as HTMLInputElement).checked).toBe(true);
  });

  it("records it again when the box is cleared", () => {
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(checkbox());

    expect(readCommandLinePrompted()).toBe(true);
  });

  /**
   * The preference is also recorded for a Mac that already had the command, so
   * the hint has to be narrower than the preference: telling that person they
   * chose `Skip for now` would be telling them about a press they never made.
   */
  it("blames the dismissal only where a dismissal is what happened", () => {
    rememberCommandLinePrompted();
    render(<CommandLineSection status={status()} onStatus={() => {}} />);
    expect(screen.getByText(/off since you chose Skip for now/)).toBeTruthy();

    cleanup();
    render(
      <CommandLineSection
        status={status({ state: "linked", currentTarget: SOURCE })}
        onStatus={() => {}}
      />,
    );
    expect(screen.queryByText(/off since you chose Skip for now/)).toBeNull();
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

  /** The argument, then the decision — and no restatement of why it is open. */
  it("opens on the reason rather than on the act, and does not restate itself", () => {
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Use LongClaw with Agents" }),
    ).toBeTruthy();
    expect(screen.getByText(/so agents can read, file, update/)).toBeTruthy();
    expect(preview()).toBeTruthy();
    expect(screen.queryByText(/is not on your/)).toBeNull();
  });

  /**
   * The one state whose sentence is *news* inside the dialog: the command
   * already works from a terminal, and nothing else on the screen says it is
   * running the wrong build.
   */
  it("keeps the stale sentence, which the button alone cannot carry", () => {
    const previous = "/Users/me/Downloads/LongClaw.app/Contents/MacOS/longclaw";
    render(
      <CommandLineOffer
        status={status({ state: "stale", currentTarget: previous })}
        onStatus={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByText(/which is not this copy of LongClaw/)).toBeTruthy();
  });

  /**
   * LC-233 closed the dialog on success, so the only evidence that anything had
   * happened was the dialog disappearing — which is also what happened when you
   * declined it.
   */
  it("becomes the answer when the install lands, and closes on Done", async () => {
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

    await screen.findByRole("heading", { name: /is on your PATH/ });
    expect(onDismiss).not.toHaveBeenCalled();
    // Nothing left to decline, so nothing beside it offers to.
    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDismiss).toHaveBeenCalledWith("installed");
  });

  /**
   * `Esc` and a click past the dialog are the two ways out that survive the
   * install — the cancel *button* is gone by then, those are not. Reporting
   * `skipped` there would raise the skipped toast over a command that is
   * already on `PATH`.
   */
  it("still reports the install when Esc closes the answered dialog", async () => {
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
    await screen.findByRole("heading", { name: /is on your PATH/ });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledWith("installed");
  });

  /** The dismissal is an answer, and the caller is told which one it was. */
  it("says which way it was answered when it is declined", () => {
    const onDismiss = vi.fn();
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(onDismiss).toHaveBeenCalledWith("skipped");
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
      message:
        "LongClaw could not write to /usr/local/bin. The line below does the same thing.",
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
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeTruthy();
  });
});
