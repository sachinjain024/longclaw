// @vitest-environment jsdom

/**
 * The two timers the write surfaces own: the 500ms before a write may spin, and
 * the 5s a toast lives for. Both are driven here with fake clocks, because both
 * are promises the app makes about how it behaves when the disk is slow.
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMutations, useMutationStore } from "./mutations";
import { ToastStack, WriteIndicator } from "./WriteFeedback";

beforeEach(() => {
  resetMutations();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the disk-state indicator", () => {
  it("says it is writing at once and spins only after 500ms", () => {
    useMutationStore.setState({
      writing: ".longclaw/tickets/LC-1/ticket.md",
      inFlight: 1,
    });
    render(<WriteIndicator />);

    // The file, not the path: `screen-specs.md:51-52` writes `writing
    // ticket.md…`, and the header has no room for the rest of it.
    const line = screen.getByText(/writing ticket\.md/);
    expect(line.textContent).not.toContain(".longclaw");
    expect(line.textContent).not.toContain("⟳");

    act(() => void vi.advanceTimersByTime(499));
    expect(line.textContent).not.toContain("⟳");

    act(() => void vi.advanceTimersByTime(1));
    expect(line.textContent).toContain("⟳");
  });

  it("drops the spinner timer when the write settles, and on unmount", () => {
    useMutationStore.setState({ writing: "ticket.md", inFlight: 1 });
    const view = render(<WriteIndicator />);

    act(() => void useMutationStore.getState().endWrite("ticket.md"));
    expect(screen.getByText("✓ ticket.md")).toBeTruthy();
    // The spinner's timer is gone; the one left is the settled mark's own life.
    expect(vi.getTimerCount()).toBe(1);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves another ticket's settled mark off this ticket's header", () => {
    useMutationStore.setState({ settled: ".longclaw/tickets/LC-9/ticket.md" });
    render(<WriteIndicator idle=".longclaw/tickets/LC-1/ticket.md" />);

    expect(screen.getByText(".longclaw/tickets/LC-1/ticket.md")).toBeTruthy();
    expect(screen.queryByText(/✓/)).toBeNull();
  });

  /**
   * LC-69. `✓` is news, and news goes stale: a mark that stood forever would be
   * the `● watching` chip under another name — the last write of the session,
   * still on screen, for a file the user may have navigated away from.
   */
  it("stands the settled mark down after 5s, and puts up a fresh one", () => {
    useMutationStore.setState({ writing: "ticket.md", inFlight: 1 });
    render(<WriteIndicator />);
    act(() => void useMutationStore.getState().endWrite("ticket.md"));

    expect(screen.getByText("✓ ticket.md")).toBeTruthy();
    act(() => void vi.advanceTimersByTime(4_999));
    expect(screen.getByText("✓ ticket.md")).toBeTruthy();

    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByText("✓ ticket.md")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    // The same file again: `settled` never changes value, so the mark has to
    // come back off the write, not off that.
    act(() => void useMutationStore.getState().beginWrite("ticket.md"));
    act(() => void useMutationStore.getState().endWrite("ticket.md"));
    expect(screen.getByText("✓ ticket.md")).toBeTruthy();
  });

  it("falls back to the file it was showing when the mark goes stale", () => {
    useMutationStore.setState({ settled: ".longclaw/tickets/LC-1/ticket.md" });
    render(<WriteIndicator idle=".longclaw/tickets/LC-1/ticket.md" />);

    expect(screen.getByText("✓ ticket.md")).toBeTruthy();

    act(() => void vi.advanceTimersByTime(5_000));
    expect(screen.getByText(".longclaw/tickets/LC-1/ticket.md")).toBeTruthy();
  });

  /**
   * LC-69. An indicator with nothing to report says nothing. The chip this
   * replaced said `● watching` at every idle moment, which is dev telemetry —
   * the disk-state line is for what the disk is doing right now.
   */
  it("says nothing at all when there is no news and no file to name", () => {
    const view = render(<WriteIndicator />);

    expect(view.container.textContent).toBe("");
  });

  it("reports a read the app is waiting on, and drops it when it lands", () => {
    const view = render(<WriteIndicator busy="reconciling" />);

    expect(screen.getByText("reconciling")).toBeTruthy();

    view.rerender(<WriteIndicator />);
    expect(view.container.textContent).toBe("");
  });

  it("lets a write outrank a read, because the write is the user's own", () => {
    useMutationStore.setState({ writing: "ticket.md", inFlight: 1 });
    render(<WriteIndicator busy="reconciling" />);

    expect(screen.getByText(/writing ticket.md/)).toBeTruthy();
    expect(screen.queryByText("reconciling")).toBeNull();
  });
});

describe("the toast", () => {
  it("auto-dismisses after 5s", () => {
    useMutationStore
      .getState()
      .raise({ message: "LC-1 created", tone: "default" });
    render(<ToastStack />);

    expect(screen.getByText("LC-1 created")).toBeTruthy();

    act(() => void vi.advanceTimersByTime(5_000));

    expect(screen.queryByText("LC-1 created")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a danger toast up, because it carries the only Retry", () => {
    useMutationStore.getState().raise({
      message: "No space left on device",
      tone: "danger",
      retry: vi.fn(),
    });
    render(<ToastStack />);

    act(() => void vi.advanceTimersByTime(60_000));

    expect(screen.getByText("No space left on device")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });

  /**
   * V0-29. The toast is the surface a failed write actually reaches — `mutate`
   * raises toasts; the error banner is the load path — so what it says about a
   * write failure is what most people will ever read about one.
   */
  it("says what failed, which file, what to do, and what is safe", async () => {
    const { mutate } = await import("./mutations");
    await mutate({
      write: () =>
        Promise.reject({
          code: "permission_denied",
          message:
            "Saving ticket failed for ticket.md. The file or the folder it is in is read-only.",
          recoverable: true,
          context: {
            path: "/projects/app/.longclaw/tickets/LC-1/ticket.md",
            fileName: "ticket.md",
            cause: "readOnly",
          },
        }),
    });
    render(<ToastStack />);

    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("ticket.md");
    expect(toast.textContent).toContain("read-only");
    expect(toast.textContent).toContain("Give yourself write access");
    expect(toast.textContent).toContain("The file was left as it was.");
    // Nothing about the file changed, so re-sending the same edit is right.
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    // The full path belongs to the banner, which has room for it. A toast is
    // one line at the bottom of the window.
    expect(toast.textContent).not.toContain("/projects/app");
  });

  it("runs undo on ⌘Z, but never over a field's own undo", () => {
    const undo = vi.fn();
    useMutationStore
      .getState()
      .raise({ message: "LC-1 → In Progress", tone: "default", undo });
    render(
      <>
        <textarea aria-label="Comment" />
        <ToastStack />
      </>,
    );

    fireEvent.keyDown(screen.getByLabelText("Comment"), {
      key: "z",
      metaKey: true,
    });
    expect(undo).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "z", metaKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    // The offer goes with the toast: a second ⌘Z cannot undo twice.
    expect(screen.queryByText("LC-1 → In Progress")).toBeNull();
    fireEvent.keyDown(document.body, { key: "z", metaKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("stops listening for ⌘Z once it is unmounted", () => {
    const undo = vi.fn();
    useMutationStore
      .getState()
      .raise({ message: "LC-1 created", tone: "default", undo });
    const view = render(<ToastStack />);

    view.unmount();
    fireEvent.keyDown(document.body, { key: "z", metaKey: true });

    expect(undo).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
