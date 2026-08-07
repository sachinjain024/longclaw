// @vitest-environment jsdom

/**
 * The confirm dialog against the focus map's rules for a modal
 * (`keyboard-focus-map.md:16-23`), because a dialog that leaks focus is a dialog
 * a keyboard user can answer without ever reading.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

function open(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>>) {
  return render(
    <ConfirmDialog
      title="Remove “Away Project” from LongClaw?"
      body={<p>The folder stays on disk, untouched.</p>}
      confirmLabel="Remove from app"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
}

describe("the confirm a destructive action goes behind", () => {
  it("opens on Cancel rather than on the destructive button", () => {
    open({});

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });

  it("holds focus until it is dismissed", () => {
    open({});
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Remove from app" });

    fireEvent.keyDown(cancel, { key: "Tab" });
    expect(document.activeElement).toBe(confirm);

    // Off the last stop, focus comes round rather than landing on the screen
    // the dialog is asking about.
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("returns focus to whatever opened it", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { unmount } = open({});
    expect(document.activeElement).not.toBe(opener);

    unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("cancels on Esc and on a click past it, and stops Esc there", () => {
    const onCancel = vi.fn();
    const { unmount } = open({ onCancel });

    const escape = fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    // Consumed here rather than walking on to close the surface behind it.
    expect(escape).toBe(false);
    unmount();

    const clicked = open({ onCancel });
    fireEvent.click(clicked.container.querySelector(".modal-scrim")!);
    expect(onCancel).toHaveBeenCalledTimes(2);

    // A click inside the dialog is not a click past it.
    fireEvent.click(screen.getByRole("dialog"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("does nothing until one of its two answers is given", () => {
    const onConfirm = vi.fn();
    open({ onConfirm });

    fireEvent.click(screen.getByRole("button", { name: "Remove from app" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
