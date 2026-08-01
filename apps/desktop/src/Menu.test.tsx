// @vitest-environment jsdom

/**
 * The one popover behind status, priority, ordering and labels
 * (`screen-specs.md:239-247`). These are the guarantees its callers are allowed
 * to rely on, so they are tested here once rather than in each caller.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu, type MenuOption } from "./Menu";

afterEach(cleanup);

const OPTIONS: MenuOption<string>[] = [
  { id: "urgent", label: "Urgent" },
  { id: "p1", label: "P1" },
  { id: "p2", label: "P2" },
  { id: "none", label: "None" },
];

function Harness(props: {
  selected?: string[];
  multiple?: boolean;
  onPick?: (id: string) => void;
  onClose?: () => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={anchor} onClick={() => setOpen(true)}>
        Priority
      </button>
      <p>outside</p>
      {open && (
        <Menu
          label="Priority"
          options={OPTIONS}
          selected={props.selected ?? ["p2"]}
          multiple={props.multiple}
          anchor={anchor.current}
          onPick={props.onPick ?? (() => {})}
          onClose={() => {
            setOpen(false);
            props.onClose?.();
          }}
        />
      )}
    </>
  );
}

const rows = () => screen.getAllByRole("menuitemradio");

/** Every caller opens the menu from something; these tests open it the same way. */
function open() {
  fireEvent.click(screen.getByRole("button", { name: "Priority" }));
}

describe("the anchored menu", () => {
  it("names itself and marks the value that is set", () => {
    render(<Harness />);
    open();

    expect(screen.getByRole("menu", { name: "Priority" })).toBeTruthy();
    expect(rows().map((row) => row.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "true",
      "false",
    ]);
  });

  it("opens on the value that is set", () => {
    render(<Harness />);
    open();

    expect(document.activeElement).toBe(rows()[2]);
  });

  it("cycles with the arrows and with j and k, wrapping at both ends", () => {
    render(<Harness selected={["urgent"]} />);
    open();

    fireEvent.keyDown(rows()[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows()[3]);

    fireEvent.keyDown(rows()[3], { key: "j" });
    expect(document.activeElement).toBe(rows()[0]);

    fireEvent.keyDown(rows()[0], { key: "k" });
    expect(document.activeElement).toBe(rows()[3]);

    fireEvent.keyDown(rows()[3], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows()[0]);
  });

  it("picks the row Enter was pressed on and closes", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    open();

    fireEvent.keyDown(rows()[2], { key: "ArrowDown" });
    fireEvent.keyDown(rows()[3], { key: "Enter" });

    expect(onPick).toHaveBeenCalledWith("none");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("picks a clicked row too", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    open();

    fireEvent.click(rows()[0]);

    expect(onPick).toHaveBeenCalledWith("urgent");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape without picking and hands focus back", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    open();

    fireEvent.keyDown(rows()[2], { key: "Escape" });

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Priority" }),
    );
  });

  it("closes when the pointer goes somewhere else", () => {
    render(<Harness />);
    open();

    fireEvent.mouseDown(screen.getByText("outside"));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("stays open while a multi-select menu is being ticked", () => {
    const onPick = vi.fn();
    render(<Harness multiple selected={["p1", "p2"]} onPick={onPick} />);
    open();

    const boxes = screen.getAllByRole("menuitemcheckbox");
    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "true",
      "false",
    ]);

    fireEvent.click(boxes[0]);

    expect(onPick).toHaveBeenCalledWith("urgent");
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
