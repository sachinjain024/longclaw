// @vitest-environment jsdom

/**
 * Full create: the panel in create mode, and every field the design approved
 * (`screen-specs.md:209-216`).
 *
 * The claim these cover is that one create carries the lot — a user planning
 * real work sets priority and labels here rather than on a second pass — and
 * that nothing on screen pretends the file already exists.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreatePanel } from "./CreatePanel";
import type { Label } from "./types";

afterEach(cleanup);

/** What `longclaw.yaml` defines in these tests. Tickets carry only the slugs. */
const DEFINITIONS: Record<string, Label> = {
  backend: { name: "Backend", color: "blue" },
  reliability: { name: "Reliability", color: "amber" },
};

function createPanel(props?: {
  initialTitle?: string;
  onCancel?: () => void;
  onCreate?: (request: unknown) => void;
}) {
  return (
    <CreatePanel
      provisionalKey="RT-4"
      labels={DEFINITIONS}
      initialTitle={props?.initialTitle}
      onCancel={props?.onCancel ?? (() => {})}
      onCreate={props?.onCreate ?? (() => {})}
    />
  );
}

function metaTrigger(field: "Status" | "Priority" | "Labels"): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${field}: `) });
}

function pick(field: "Status" | "Priority", option: string) {
  fireEvent.click(metaTrigger(field));
  fireEvent.click(screen.getByRole("menuitemradio", { name: option }));
}

function addChecklistItem(text: string) {
  const field = screen.getByLabelText("Add a checklist item");
  fireEvent.change(field, { target: { value: text } });
  fireEvent.submit(field.closest("form")!);
}

describe("every approved field, in one create", () => {
  it("carries title, status, priority, labels, description and checklist", () => {
    const onCreate = vi.fn();
    render(createPanel({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Prove the agent round trip  " },
    });
    pick("Status", "In Review");
    pick("Priority", "P1");
    fireEvent.click(metaTrigger("Labels"));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Backend" }));
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Reliability" }),
    );
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Check whether the round trip holds." },
    });
    addChecklistItem("Let an agent read this ticket");
    addChecklistItem("Review what it changed");

    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Prove the agent round trip",
      status: "in_review",
      priority: "p1",
      labels: ["backend", "reliability"],
      description: "Check whether the round trip holds.",
      checklist: ["Let an agent read this ticket", "Review what it changed"],
    });
  });

  it("picks labels from the project's definitions, never from typed text", () => {
    render(createPanel());

    // A slug typed into a text box is a slug the project may not define. There
    // is no such field here; the menu's rows are the definitions.
    expect(screen.queryByLabelText(/comma separated/i)).toBeNull();
    fireEvent.click(metaTrigger("Labels"));
    expect(
      screen.getAllByRole("menuitemcheckbox").map((row) => row.textContent),
    ).toEqual(["Backend", "Reliability"]);
  });

  it("takes the title quick create was holding", () => {
    render(createPanel({ initialTitle: "Needs more thought" }));

    expect(screen.getByLabelText<HTMLTextAreaElement>("Title").value).toBe(
      "Needs more thought",
    );
  });
});

describe("nothing here claims the file exists yet", () => {
  it("shows the provisional key as a guess, and never as a tab stop", () => {
    render(createPanel());

    const chip = screen.getByText(/RT-4/);
    expect(chip.textContent).toBe("RT-4 · new");
    // Display only (`keyboard-focus-map.md:57`): the ID chip in view mode is a
    // stop because it is the ticket's key. This one is not the ticket's key.
    expect(chip.closest("button")).toBeNull();
    expect(chip.getAttribute("tabindex")).toBeNull();
  });

  it("offers write mode only, with no Preview tab until the ticket exists", () => {
    render(createPanel());

    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Preview" })).toBeNull();
    // The six formatting buttons are still there: they act on the draft string,
    // which exists whether or not a file does.
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy();
  });

  it("draws checklist drafts that cannot be ticked, only removed", () => {
    render(createPanel());
    addChecklistItem("Let an agent read this ticket");

    const box = screen.getByRole("checkbox");
    // `NewTicket.checklist` is a list of strings, so a created item is always
    // open. An enabled box would offer something the create cannot carry.
    expect(box.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByRole("button", {
        name: "Remove Let an agent read this ticket",
      }),
    ).toBeTruthy();
  });

  it("removes a draft row without touching the others", () => {
    const onCreate = vi.fn();
    render(createPanel({ onCreate }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Two of three" },
    });
    addChecklistItem("First");
    addChecklistItem("Second");
    addChecklistItem("Third");

    fireEvent.click(screen.getByRole("button", { name: "Remove Second" }));
    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ checklist: ["First", "Third"] }),
    );
  });

  it("keeps focus in the add-row after appending and after removing", () => {
    render(createPanel());
    const field = screen.getByLabelText("Add a checklist item");

    addChecklistItem("First");
    expect(
      screen.getByLabelText<HTMLInputElement>("Add a checklist item").value,
    ).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Remove First" }));
    expect(document.activeElement).toBe(field);
  });

  it("has no assignee, attachment or rank affordance", () => {
    render(createPanel());

    // ADR 0001, ADR 0005, ADR 0003 in that order. A create allocates no rank.
    const panel = screen.getByRole("complementary");
    expect(panel.textContent).not.toMatch(/assign/i);
    expect(panel.textContent).not.toMatch(/attach/i);
    expect(panel.textContent).not.toMatch(/rank/i);
  });
});

describe("committing and leaving", () => {
  it("creates on ⌘↵ from anywhere in the panel", () => {
    const onCreate = vi.fn();
    render(createPanel({ onCreate }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Chorded" },
    });

    fireEvent.keyDown(screen.getByLabelText("Add a checklist item"), {
      key: "Enter",
      metaKey: true,
    });

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Chorded" }),
    );
  });

  it("will not create a ticket with no title", () => {
    const onCreate = vi.fn();
    render(createPanel({ onCreate }));

    fireEvent.click(screen.getByText("Create ticket"));
    fireEvent.keyDown(screen.getByLabelText("Title"), {
      key: "Enter",
      metaKey: true,
    });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("cancels on Escape without creating anything", () => {
    const onCancel = vi.fn();
    const onCreate = vi.fn();
    render(createPanel({ onCancel, onCreate }));

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
