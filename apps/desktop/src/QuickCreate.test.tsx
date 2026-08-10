// @vitest-environment jsdom

/**
 * Quick create after V0-16 narrowed it and LC-186 widened it by one: title,
 * status and priority, and a door to the surface that owns everything else
 * (`screen-specs.md:253-262`).
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickCreate } from "./QuickCreate";
import type { TicketPriority, TicketStatus } from "./types";

afterEach(() => {
  cleanup();
  // Only the theme-dot test stamps it, and the root outlives a render.
  delete document.documentElement.dataset.theme;
});

function quickCreate(props?: {
  projectTheme?: string;
  initialStatus?: TicketStatus;
  initialPriority?: TicketPriority;
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
      initialPriority={props?.initialPriority}
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

/** The priority trigger beside it — the same component, the same vocabulary. */
function priorityTrigger() {
  return screen.getByRole("button", { name: /^Priority: / });
}

describe("quick create is title, status and priority", () => {
  it("sends the title, status and priority the human chose, and nothing else", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Prove the agent round trip  " },
    });
    fireEvent.click(statusTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "In Progress" }));
    fireEvent.click(priorityTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Urgent" }));
    fireEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Prove the agent round trip",
      status: "in_progress",
      priority: "urgent",
    });
  });

  it("sends the priority nobody chose as `none`, which is a priority (LC-186)", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Filed without a thought about urgency" },
    });
    fireEvent.click(screen.getByText("Create"));

    // Not omitted: `none` is what the file would hold either way, and sending
    // it keeps one create request shape rather than two.
    expect(onCreate).toHaveBeenCalledWith({
      title: "Filed without a thought about urgency",
      status: "todo",
      priority: "none",
    });
  });

  it("offers no description, checklist or label field at all", () => {
    render(quickCreate());

    // Everything past title, status and priority lives in full create. The
    // label field in particular was free text, typed against definitions the
    // project keeps in `longclaw.yaml`, which is what V0-10's menu exists to
    // stop — so widening this surface by one field is not an invitation.
    expect(screen.queryByLabelText("Description")).toBeNull();
    expect(screen.queryByLabelText(/Checklist/)).toBeNull();
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
    fireEvent.click(priorityTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "P1" }));
    fireEvent.click(screen.getByText("Open full editor →"));

    expect(onOpenFullEditor).toHaveBeenCalledWith({
      title: "Needs more thought",
      status: "backlog",
      priority: "p1",
    });
    // Moving surfaces is not creating.
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("opens on the priority it is handed, so coming back does not forget", () => {
    render(quickCreate({ initialPriority: "p2" }));

    expect(priorityTrigger().textContent).toContain("P2");
  });

  it("opens on None when nothing chose one", () => {
    render(quickCreate());

    expect(priorityTrigger().textContent).toContain("None");
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
      priority: "none",
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

  it("D-49: priority is the same menu trigger, not a second kind of control", () => {
    render(quickCreate());

    expect(priorityTrigger().getAttribute("aria-haspopup")).toBe("menu");
    // Status first, then priority — the meta grid's order everywhere else in
    // the app (`screen-specs.md:229`), and the Tab order the focus map states
    // (`keyboard-focus-map.md:133`).
    expect(
      statusTrigger().compareDocumentPosition(priorityTrigger()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("D-48: carries the project's theme dot before the name (LC-114)", () => {
    document.documentElement.dataset.theme = "dark";
    const { container } = render(quickCreate({ projectTheme: "ember" }));

    const dot = container.querySelector<HTMLElement>(".theme-dot");
    expect(dot).toBeTruthy();
    // Both axes, or the dot resolves to the accent in force rather than this
    // project's own — indistinguishable from working until two projects differ.
    expect(dot?.dataset.lcTheme).toBe("ember");
    expect(dot?.dataset.theme).toBe("dark");
    // Before the name, not after it: the eyebrow reads dot, name, key.
    expect(dot?.nextSibling?.textContent).toContain("Round Trip");
    // Decoration. The name is right beside it, so a dot in the reading order
    // would say the project twice.
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});
