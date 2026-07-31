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

    const line = screen.getByText(/writing .longclaw/);
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
    expect(vi.getTimerCount()).toBe(0);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves another ticket's settled mark off this ticket's header", () => {
    useMutationStore.setState({ settled: ".longclaw/tickets/LC-9/ticket.md" });
    render(<WriteIndicator idle=".longclaw/tickets/LC-1/ticket.md" />);

    expect(screen.getByText(".longclaw/tickets/LC-1/ticket.md")).toBeTruthy();
    expect(screen.queryByText(/✓/)).toBeNull();
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
