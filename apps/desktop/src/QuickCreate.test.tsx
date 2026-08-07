// @vitest-environment jsdom

/**
 * Quick create after V0-16 narrowed it: title and status, and a door to the
 * surface that owns everything else (`screen-specs.md:198-207`).
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickCreate } from "./QuickCreate";
import type { TicketStatus } from "./types";

afterEach(() => {
  cleanup();
  // Only the theme-dot test stamps it, and the root outlives a render.
  delete document.documentElement.dataset.appearance;
});

function quickCreate(props?: {
  projectTheme?: string;
  initialStatus?: TicketStatus;
  onCancel?: () => void;
  onCreate?: (request: unknown) => void;
  onOpenFullEditor?: (draft: unknown) => void;
}) {
  return (
    <QuickCreate
      projectName="Round Trip"
      projectTheme={props?.projectTheme ?? "ember"}
      provisionalKey="RT-4"
      initialStatus={props?.initialStatus}
      onCancel={props?.onCancel ?? (() => {})}
      onCreate={props?.onCreate ?? (() => {})}
      onOpenFullEditor={props?.onOpenFullEditor ?? (() => {})}
    />
  );
}

/** The status meta trigger, which is the shared popover rather than a select. */
function statusTrigger() {
  return screen.getByRole("button", { name: /^Status: / });
}

describe("quick create is title and status", () => {
  it("sends the title and status the human typed, and nothing else", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Prove the agent round trip  " },
    });
    fireEvent.click(statusTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "In Progress" }));
    fireEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Prove the agent round trip",
      status: "in_progress",
    });
  });

  it("offers no description, checklist, priority or label field at all", () => {
    render(quickCreate());

    // Everything past title and status lives in full create. The label field in
    // particular was free text, typed against definitions the project keeps in
    // `longclaw.yaml`, which is what V0-10's menu exists to stop.
    expect(screen.queryByLabelText("Description")).toBeNull();
    expect(screen.queryByLabelText(/Checklist/)).toBeNull();
    expect(screen.queryByLabelText(/^Priority/)).toBeNull();
    expect(screen.queryByLabelText(/^Labels/)).toBeNull();
  });

  it("carries what has been typed into full create rather than dropping it", () => {
    const onOpenFullEditor = vi.fn();
    const onCreate = vi.fn();
    render(quickCreate({ onOpenFullEditor, onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Needs more thought  " },
    });
    fireEvent.click(statusTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Backlog" }));
    fireEvent.click(screen.getByText("Open full editor →"));

    expect(onOpenFullEditor).toHaveBeenCalledWith({
      title: "Needs more thought",
      status: "backlog",
    });
    // Moving surfaces is not creating.
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("names the project and the key the create will probably claim", () => {
    render(quickCreate());

    expect(screen.getByText("Round Trip · RT-4")).toBeTruthy();
  });

  it("will not create a ticket with no title", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.click(screen.getByText("Create"));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("closes on Escape without creating anything", () => {
    const onCancel = vi.fn();
    const onCreate = vi.fn();
    render(quickCreate({ onCancel, onCreate }));

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("the status the modal opens on (LC-83)", () => {
  it("stands in the column the + was pressed in", () => {
    const onCreate = vi.fn();
    render(quickCreate({ initialStatus: "in_review", onCreate }));

    expect(statusTrigger().textContent).toContain("In Review");

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Preseeded" },
    });
    fireEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Preseeded",
      status: "in_review",
    });
  });

  it("opens on Todo when nothing chose one, which is where a new ticket goes", () => {
    render(quickCreate());

    expect(statusTrigger().textContent).toContain("Todo");
  });
});

describe("quick create prototype parity", () => {
  it("D-49: keeps status as a menu trigger in quick create", () => {
    render(quickCreate());

    const trigger = statusTrigger();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("D-48: carries the project's theme dot before the name (LC-114)", () => {
    document.documentElement.dataset.appearance = "dark";
    const { container } = render(quickCreate({ projectTheme: "ember" }));

    const dot = container.querySelector<HTMLElement>(".theme-dot");
    expect(dot).toBeTruthy();
    // Both axes, or the dot resolves to the accent in force rather than this
    // project's own — indistinguishable from working until two projects differ.
    expect(dot?.dataset.theme).toBe("ember");
    expect(dot?.dataset.appearance).toBe("dark");
    // Before the name, not after it: the eyebrow reads dot, name, key.
    expect(dot?.nextSibling?.textContent).toContain("Round Trip");
  });
});
