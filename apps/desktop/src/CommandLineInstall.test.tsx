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
 * The refusal is the second half. A write refused for want of rights goes on
 * to macOS's password sheet (LC-285r), and what the sheet answers decides
 * what is said: a refused password hands over the line to paste, for whoever
 * does administer the Mac, and a failure `sudo` cannot fix hands over none.
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
import { useState } from "react";
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

vi.mock("./api", () => ({
  commandLineStatus: vi.fn(),
  installCommandLine: vi.fn(),
  installCommandLineAsAdmin: vi.fn(),
}));

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

/** The plain write's refusal for want of rights, which raises the sheet. */
const NEEDS_ADMIN = {
  code: "permission_denied",
  message: "Writing to /usr/local/bin needs an administrator.",
  recoverable: true,
  context: { escalate: "true", command: COMMAND },
};

/** The copy deck's `failed.admin`. */
const PASSWORD_REFUSED =
  "macOS did not accept an administrator password, so nothing was installed. If someone else administers this Mac, they can run the line below.";

/** The plain write needs an administrator, and macOS refuses the password. */
function passwordRefused(context?: Record<string, string>) {
  vi.mocked(api.installCommandLine).mockRejectedValue(NEEDS_ADMIN);
  vi.mocked(api.installCommandLineAsAdmin).mockRejectedValue({
    code: "permission_denied",
    message: PASSWORD_REFUSED,
    recoverable: true,
    ...(context ? { context } : {}),
  });
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

    // The copy deck's `status.occupied` (LC-285r): no "try again", because
    // there is no button here that could.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            `LongClaw cannot replace ${LINK}. Move it or rename it, then reopen this pane, or run the line below yourself.`,
      ),
    ).toBeTruthy();
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
   * When even the password sheet is refused, the refusal in words and the
   * exact line with the paths already in it — for whoever does administer
   * this Mac.
   */
  it("shows the refusal and the exact line when the password is refused", async () => {
    passwordRefused({ command: COMMAND });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(PASSWORD_REFUSED);
    expect(screen.getByText(COMMAND)).toBeTruthy();
  });

  /**
   * LC-233 left the button reading `Install` after a failed install, so pressing
   * it a second time looked like the first press had not registered.
   */
  it("turns the primary into Try again once the password has been refused", async () => {
    passwordRefused({ command: COMMAND });
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
    passwordRefused({ command: fresher });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(fresher);
    expect(screen.queryByText(COMMAND)).toBeNull();
  });

  /** A refusal that carries no line of its own still gets the status's: the
   *  line is the way out of a refused password, whoever computed it. */
  it("falls back to the status's line when the refusal carries none", async () => {
    passwordRefused();
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
  const NAME = /Ask again when I open a project without the command/;

  function checkbox() {
    return screen.getByRole("checkbox", { name: NAME });
  }

  function maybeCheckbox() {
    return screen.queryByRole("checkbox", { name: NAME });
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

  /**
   * The box was rendered in every state, including the one where it can do
   * nothing at all: `unavailable` has no command beside it to install, so
   * `shouldOfferCommandLine` is false there however the preference is set.
   *
   * That state is a `npm run dev` window — which is where somebody working on
   * this feature is most likely to tick the box, restart, and watch nothing
   * happen. It was reported as the checkbox being broken. The preference was
   * being written correctly the whole time; the control was the thing making a
   * promise it could not keep, one line under a paragraph saying there is
   * nothing to install.
   */
  it("is not offered by a build that can never raise the offer", () => {
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

    expect(maybeCheckbox()).toBeNull();
    // The state still explains itself — this hides one control, not the pane.
    expect(screen.getByText(/nothing\s+to install/)).toBeTruthy();
  });

  /**
   * Stated over all five rather than as one `unavailable` case, so a sixth
   * state has to answer the question rather than inherit an answer. The four
   * here can all reach the offer eventually: an `occupied` path gets moved out
   * of the way, a `linked` command gets unlinked, and either is then a project
   * opened without the command.
   */
  it("is offered in every state whose build has a command to install", () => {
    for (const state of ["absent", "stale", "linked", "occupied"] as const) {
      render(
        <CommandLineSection status={status({ state })} onStatus={() => {}} />,
      );
      expect(maybeCheckbox(), state).not.toBeNull();
      cleanup();
    }
  });

  /**
   * The pairing the render is actually for: the box appears exactly where the
   * preference it writes can still change what happens. Asserted against
   * `shouldOfferCommandLine` on a machine that has never been asked, which is
   * the question the checkbox is offering to reopen.
   */
  it("appears only where clearing the preference could change something", () => {
    for (const state of [
      "absent",
      "stale",
      "linked",
      "occupied",
      "unavailable",
    ] as const) {
      const reachable = state !== "unavailable";
      render(
        <CommandLineSection status={status({ state })} onStatus={() => {}} />,
      );
      expect(maybeCheckbox() !== null, state).toBe(reachable);
      cleanup();
    }
    // The one that is out is out because no preference can let it in.
    resetDevicePreferences();
    expect(
      shouldOfferCommandLine(status({ state: "unavailable" }), false),
    ).toBe(false);
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
    passwordRefused({ command: COMMAND });
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

/**
 * The password sheet (LC-285r). The plain write is tried first; only a refusal
 * for want of rights — flagged `escalate` by Rust — goes on to the second
 * command, which raises macOS's sheet and waits on a person. While it waits,
 * both surfaces say so and nothing can be pressed.
 */
describe("installing through the administrator prompt", () => {
  const ESCALATABLE = {
    code: "permission_denied",
    message: "Writing to /usr/local/bin needs an administrator.",
    recoverable: true,
    context: { escalate: "true", command: COMMAND },
  };

  /** The sheet, held open until the test answers it. */
  function sheet() {
    let answer!: (status: CommandLineStatus) => void;
    vi.mocked(api.installCommandLineAsAdmin).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    return (status: CommandLineStatus) => answer(status);
  }

  it("never raises the sheet when the plain write lands", async () => {
    const onStatus = vi.fn();
    vi.mocked(api.installCommandLine).mockResolvedValue(
      status({ state: "linked", currentTarget: SOURCE }),
    );
    render(<CommandLineSection status={status()} onStatus={onStatus} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(onStatus).toHaveBeenCalled());
    expect(api.installCommandLineAsAdmin).not.toHaveBeenCalled();
  });

  it("does not raise the sheet for a refusal an administrator cannot fix", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue({
      code: "io",
      message:
        "Installing the longclaw command failed for bin. The volume it is on has no space left.",
      recoverable: true,
    });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await screen.findByText(/no space left/);
    expect(api.installCommandLineAsAdmin).not.toHaveBeenCalled();
  });

  it("waits for the password in the pane, then reports the install", async () => {
    const onStatus = vi.fn();
    vi.mocked(api.installCommandLine).mockRejectedValue(ESCALATABLE);
    const answer = sheet();
    render(<CommandLineSection status={status()} onStatus={onStatus} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    const waiting = await screen.findByRole("button", {
      name: "Waiting for your password",
    });
    expect((waiting as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("macOS is asking for an administrator password."),
    ).toBeTruthy();
    // The refused write is not a refusal to show: the sheet is its answer.
    expect(screen.queryByText(/could not write/)).toBeNull();
    expect(screen.queryByText(COMMAND)).toBeNull();

    const linked = status({ state: "linked", currentTarget: SOURCE });
    answer(linked);

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(linked));
    expect(
      screen.queryByText("macOS is asking for an administrator password."),
    ).toBeNull();
  });

  it("holds both footer buttons, Esc and the scrim while the sheet is up", async () => {
    const onDismiss = vi.fn();
    vi.mocked(api.installCommandLine).mockRejectedValue(ESCALATABLE);
    sheet();
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    const waiting = await screen.findByRole("button", {
      name: "Waiting for your password",
    });
    const skip = screen.getByRole("button", { name: "Skip for now" });
    expect((waiting as HTMLButtonElement).disabled).toBe(true);
    expect((skip as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("macOS is asking for an administrator password."),
    ).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(document.querySelector(".modal-scrim")!);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("answers in the dialog and returns focus to its primary when the sheet closes", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue(ESCALATABLE);
    const answer = sheet();
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await screen.findByRole("button", { name: "Waiting for your password" });
    answer(status({ state: "linked", currentTarget: SOURCE }));

    const done = await screen.findByRole("button", { name: "Done" });
    expect(screen.getByText(/is on your PATH/)).toBeTruthy();
    expect(document.activeElement).toBe(done);
  });

  /** A skip while the plain write is out must not be followed by a sheet. */
  it("cannot be skipped while the plain write is out", async () => {
    const onDismiss = vi.fn();
    let refuse!: (error: unknown) => void;
    vi.mocked(api.installCommandLine).mockReturnValue(
      new Promise((_, reject) => {
        refuse = reject;
      }),
    );
    sheet();
    render(
      <CommandLineOffer
        status={status()}
        onStatus={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await screen.findByRole("button", { name: "Installing…" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
    refuse(ESCALATABLE);
    await screen.findByRole("button", { name: "Waiting for your password" });
  });

  /** Linked, the pane has no primary left to return to; focus stays in it. */
  it("keeps focus in the pane when the sheet installs and the primary goes", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue(ESCALATABLE);
    const answer = sheet();
    function Pane() {
      const [current, setCurrent] = useState(status());
      return <CommandLineSection status={current} onStatus={setCurrent} />;
    }
    const { container } = render(<Pane />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await screen.findByRole("button", { name: "Waiting for your password" });
    answer(status({ state: "linked", currentTarget: SOURCE }));

    await screen.findByText(/points at this copy of LongClaw/);
    expect(document.activeElement).not.toBe(document.body);
    expect(container.contains(document.activeElement)).toBe(true);
  });

  it("returns focus to the pane's primary when the sheet closes without an install", async () => {
    vi.mocked(api.installCommandLine).mockRejectedValue(ESCALATABLE);
    vi.mocked(api.installCommandLineAsAdmin).mockRejectedValue({
      code: "io",
      message:
        "LongClaw could not install the command, even as an administrator: ln: failed",
      recoverable: true,
    });
    render(<CommandLineSection status={status()} onStatus={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(document.activeElement).toBe(retry);
  });
});

/**
 * What the sheet answered (LC-285r, items 3.1–3.5), on both surfaces. A cancel
 * is a choice and reads as one; a refused password hands over the line for
 * whoever does administer the Mac; a script that failed as root says why; and
 * a file found at the name as root puts the surface in the occupied state.
 */
describe.each(["pane", "dialog"] as const)(
  "after the password sheet, in the %s",
  (surface) => {
    const ESCALATABLE = {
      code: "permission_denied",
      message: "Writing to /usr/local/bin needs an administrator.",
      recoverable: true,
      context: { escalate: "true", command: COMMAND },
    };
    const FAILED_ADMIN =
      "macOS did not accept an administrator password, so nothing was installed. If someone else administers this Mac, they can run the line below.";

    /** The surface, holding the status the way its parent does. */
    function Surface(props: { onDismiss?: (outcome: string) => void }) {
      const [current, setCurrent] = useState(status());
      return surface === "pane" ? (
        <CommandLineSection status={current} onStatus={setCurrent} />
      ) : (
        <CommandLineOffer
          status={current}
          onStatus={setCurrent}
          onDismiss={props.onDismiss ?? (() => {})}
        />
      );
    }

    function sheetAnswers(error: unknown) {
      vi.mocked(api.installCommandLine).mockRejectedValue(ESCALATABLE);
      vi.mocked(api.installCommandLineAsAdmin).mockRejectedValue(error);
    }

    it("says nothing was installed after a cancel, and keeps Install", async () => {
      sheetAnswers({
        code: "cancelled",
        message: "Nothing was installed.",
        recoverable: true,
      });
      render(<Surface />);

      fireEvent.click(screen.getByRole("button", { name: "Install" }));

      await screen.findByText("Nothing was installed.");
      expect(screen.getByRole("button", { name: "Install" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.queryByText(COMMAND)).toBeNull();
    });

    it("brings the sheet back when Install is pressed after a cancel", async () => {
      sheetAnswers({
        code: "cancelled",
        message: "Nothing was installed.",
        recoverable: true,
      });
      render(<Surface />);

      fireEvent.click(screen.getByRole("button", { name: "Install" }));
      await screen.findByText("Nothing was installed.");
      fireEvent.click(screen.getByRole("button", { name: "Install" }));

      await waitFor(() =>
        expect(api.installCommandLineAsAdmin).toHaveBeenCalledTimes(2),
      );
      expect(api.installCommandLine).toHaveBeenCalledTimes(2);
    });

    it("hands over the line after a refused password, and Try again asks again", async () => {
      sheetAnswers({
        code: "permission_denied",
        message: FAILED_ADMIN,
        recoverable: true,
        context: { command: COMMAND },
      });
      render(<Surface />);

      fireEvent.click(screen.getByRole("button", { name: "Install" }));

      await screen.findByText(FAILED_ADMIN);
      expect(screen.getByText(COMMAND)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() =>
        expect(api.installCommandLineAsAdmin).toHaveBeenCalledTimes(2),
      );
    });

    it("says why a script that ran as an administrator failed, without the line", async () => {
      const reason =
        "LongClaw could not install the command, even as an administrator: ln: /usr/local/bin: No space left on device";
      sheetAnswers({ code: "io", message: reason, recoverable: true });
      render(<Surface />);

      fireEvent.click(screen.getByRole("button", { name: "Install" }));

      await screen.findByText(reason);
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.queryByText(COMMAND)).toBeNull();
    });

    /** `sudo` does not make room (LC-285r, 4.1): no line, no sheet, and
     *  `Try again` is the plain write again. */
    it("hands over no line for a full disk, and Try again writes again", async () => {
      const full =
        "Installing the longclaw command failed for bin. The volume it is on has no space left.";
      vi.mocked(api.installCommandLine).mockRejectedValue({
        code: "io",
        message: full,
        recoverable: true,
      });
      render(<Surface />);

      fireEvent.click(screen.getByRole("button", { name: "Install" }));

      await screen.findByText(full);
      expect(screen.queryByText(COMMAND)).toBeNull();
      expect(screen.queryByText(/sudo/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() =>
        expect(api.installCommandLine).toHaveBeenCalledTimes(2),
      );
      expect(api.installCommandLineAsAdmin).not.toHaveBeenCalled();
    });

    it("turns occupied when a file is found at the name as root", async () => {
      const refusal =
        "LongClaw cannot replace /usr/local/bin/longclaw. Move it or rename it, then reopen this pane, or run the line below yourself.";
      sheetAnswers({
        code: "io",
        message: refusal,
        recoverable: true,
        context: { state: "occupied", command: COMMAND },
      });
      vi.mocked(api.commandLineStatus).mockResolvedValue(
        status({ state: "occupied" }),
      );
      render(<Surface />);

      fireEvent.click(screen.getByRole("button", { name: "Install" }));

      // Said once, by the state — not a second time as a refusal under it.
      await screen.findByText(/LongClaw cannot replace/);
      expect(screen.getAllByText(/LongClaw cannot replace/)).toHaveLength(1);
      expect(screen.getByText(COMMAND)).toBeTruthy();
      expect(
        screen.queryByRole("button", {
          name: /^(Install|Try again|Point it at this app)$/,
        }),
      ).toBeNull();
    });

    it("turns occupied even when the fresh status cannot be read", async () => {
      sheetAnswers({
        code: "io",
        message: "LongClaw cannot replace /usr/local/bin/longclaw.",
        recoverable: true,
        context: { state: "occupied", command: COMMAND },
      });
      vi.mocked(api.commandLineStatus).mockRejectedValue(new Error("gone"));
      render(<Surface />);

      fireEvent.click(screen.getByRole("button", { name: "Install" }));

      await screen.findByText(/then reopen this pane/);
      expect(screen.getByText(COMMAND)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });

    if (surface === "dialog") {
      it("raises the skipped toast's answer when closed after a cancel", async () => {
        const onDismiss = vi.fn();
        sheetAnswers({
          code: "cancelled",
          message: "Nothing was installed.",
          recoverable: true,
        });
        render(<Surface onDismiss={onDismiss} />);

        fireEvent.click(screen.getByRole("button", { name: "Install" }));
        await screen.findByText("Nothing was installed.");
        fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

        expect(onDismiss).toHaveBeenCalledWith("skipped");
      });
    }
  },
);
