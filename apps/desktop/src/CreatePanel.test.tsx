// @vitest-environment jsdom

/**
 * Full create: the panel in create mode, and every field the design approved
 * (`screen-specs.md:264-271`).
 *
 * The claim these cover is that one create carries the lot — a user planning
 * real work sets priority and labels here rather than on a second pass — and
 * that nothing on screen pretends the file already exists.
 */

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreatePanel } from "./CreatePanel";
import type { Label, TicketDraft } from "./types";

afterEach(() => {
  cleanup();
  // Only the auto-grow test installs it (below), and only that test may see it.
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
  // The same for `scrollIntoView`, which jsdom does not define and the app's
  // calls are guarded for (`addRow.ts`).
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

/** What the auto-grow test measures a line of text as. */
const LINE_HEIGHT = 20;

/** What `longclaw.yaml` defines in these tests. Tickets carry only the slugs. */
const DEFINITIONS: Record<string, Label> = {
  backend: { name: "Backend", color: "blue" },
  reliability: { name: "Reliability", color: "amber" },
};

function createPanel(props?: {
  initialDraft?: TicketDraft;
  onCancel?: () => void;
  onCreate?: (request: unknown) => void;
}) {
  return (
    <CreatePanel
      provisionalKey="RT-4"
      labels={DEFINITIONS}
      initialDraft={props?.initialDraft}
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

  /** A draft with only the field under test set, the rest at their defaults. */
  function draft(fields: Partial<TicketDraft>): TicketDraft {
    return {
      title: "",
      description: "",
      status: "todo",
      priority: "none",
      labels: [],
      ...fields,
    };
  }

  it("takes the title quick create was holding", () => {
    render(
      createPanel({ initialDraft: draft({ title: "Needs more thought" }) }),
    );

    expect(screen.getByLabelText<HTMLTextAreaElement>("Title").value).toBe(
      "Needs more thought",
    );
  });

  it("takes the priority quick create was holding too (LC-186)", () => {
    render(createPanel({ initialDraft: draft({ priority: "urgent" }) }));

    // Quick create asks for a priority now, so the door between the surfaces
    // has one to carry. Losing it here would mean the urgent ticket somebody
    // marked urgent arrives at the fuller surface as `None`.
    expect(metaTrigger("Priority").textContent).toContain("Urgent");
  });

  it("opens on None when quick create had no priority to hand over", () => {
    render(createPanel());

    expect(metaTrigger("Priority").textContent).toContain("None");
  });

  /**
   * The title here wears `.panel-title`, which draws no resize grabber and
   * hides its own overflow (D-73, LC-108). A field with no handle has to find
   * its own height, and this one is the third of the three the finding names —
   * the panel's two grew one when the handle came off, and this one did not, so
   * a long title was clipped by the very rule that took the handle away.
   */
  it("grows the title to its own text rather than clipping it", () => {
    // jsdom lays nothing out, so every box measures 0 and the hook declines to
    // pin a field to nothing. A height that answers for the text is the whole
    // input this behaviour has, so the test supplies one: 20px a line, 20
    // characters to a line. Taken back in `afterEach`, not at the end of the
    // body — a failed assertion here would otherwise leave every later test in
    // this file measuring against it.
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        if (this.style.height !== "auto") return 0;
        return LINE_HEIGHT * Math.max(1, Math.ceil(this.value.length / 20));
      },
    });

    render(createPanel());
    const title = screen.getByLabelText<HTMLTextAreaElement>("Title");
    expect(title.style.height).toBe(`${LINE_HEIGHT}px`);

    fireEvent.change(title, {
      target: { value: "A title long enough to need a second line of its own" },
    });

    expect(title.style.height).toBe(`${LINE_HEIGHT * 3}px`);
  });
});

describe("nothing here claims the file exists yet", () => {
  /**
   * D-4A (LC-116). The key wears the same chip as the panel's real one, so the
   * two surfaces read as the same object — with `· new` beside it saying which
   * half is the guess. It was plain text, which made the create panel's header
   * the one place the key was not a chip.
   */
  it("shows the provisional key as a chip, as a guess, and never as a tab stop", () => {
    render(createPanel());

    const chip = screen.getByText(/RT-4/);
    expect(chip.textContent).toBe("RT-4 · new");
    expect(chip.classList.contains("id-chip")).toBe(true);
    // Display only (`keyboard-focus-map.md:61`): the ID chip in view mode is a
    // stop because it is the ticket's key, and it copies. This one is not the
    // ticket's key — copying it would hand out a guess — so it is neither.
    expect(chip.closest("button")).toBeNull();
    expect(chip.getAttribute("tabindex")).toBeNull();
    expect(screen.queryByRole("button", { name: /Copy/ })).toBeNull();
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

  /**
   * The other half of LC-215: a draft row is retyped in place here too, so a
   * typo caught while writing the ticket does not have to be removed and
   * retyped. There is no write behind it — the row is a string in an array.
   */
  it("rewords a draft row in place", () => {
    const onCreate = vi.fn();
    render(createPanel({ onCreate }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Reworded" },
    });
    addChecklistItem("Frist");
    addChecklistItem("Second");

    fireEvent.click(screen.getByRole("button", { name: "Edit Frist" }));
    const field = screen.getByRole("textbox", { name: "Edit Frist" });
    fireEvent.change(field, { target: { value: "First" } });
    fireEvent.submit(field.closest("form")!);
    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ checklist: ["First", "Second"] }),
    );
  });

  it("leaves a draft row as it was when the field is abandoned", () => {
    const onCreate = vi.fn();
    render(createPanel({ onCreate }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Abandoned" },
    });
    addChecklistItem("First");

    fireEvent.click(screen.getByRole("button", { name: "Edit First" }));
    const field = screen.getByRole("textbox", { name: "Edit First" });
    fireEvent.change(field, { target: { value: "Something else" } });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ checklist: ["First"] }),
    );
  });

  it("drops a draft row emptied by the field rather than creating a blank one", () => {
    const onCreate = vi.fn();
    render(createPanel({ onCreate }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Emptied" },
    });
    addChecklistItem("First");
    addChecklistItem("Second");

    fireEvent.click(screen.getByRole("button", { name: "Edit First" }));
    const field = screen.getByRole("textbox", { name: "Edit First" });
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.submit(field.closest("form")!);
    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ checklist: ["Second"] }),
    );
  });

  /**
   * The same two gestures the ticket panel's list has (LC-185), over rows that
   * are not a file yet: the order they are dragged into is the order they are
   * created in, and nothing is written until Create is.
   */
  describe("rearranging the drafted rows", () => {
    function drafted(): string[] {
      return [...document.querySelectorAll(".checklist-row label span")].map(
        (node) => node.textContent ?? "",
      );
    }

    function threeRows() {
      const onCreate = vi.fn();
      render(createPanel({ onCreate }));
      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Ordered work" },
      });
      addChecklistItem("First");
      addChecklistItem("Second");
      addChecklistItem("Third");
      return onCreate;
    }

    /** jsdom lays nothing out and has no `DragEvent`; both are stated here. */
    function dragOnto(from: string, onto: string, edge: "above" | "below") {
      const row = (text: string) => {
        const found = screen.getByText(text).closest("li");
        if (!found) throw new Error(`no draft row for ${text}`);
        return found;
      };
      const target = row(onto);
      target.getBoundingClientRect = () =>
        ({ top: 0, bottom: 20, height: 20 }) as DOMRect;
      fireEvent.dragStart(row(from));
      for (const type of ["dragOver", "drop"] as const) {
        const event = createEvent[type](target);
        Object.defineProperty(event, "clientY", {
          value: edge === "below" ? 15 : 5,
        });
        fireEvent(target, event);
      }
    }

    it("creates the ticket in the order the rows were dragged into", () => {
      const onCreate = threeRows();

      dragOnto("Third", "First", "above");

      expect(drafted()).toEqual(["Third", "First", "Second"]);
      fireEvent.click(screen.getByText("Create ticket"));
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          checklist: ["Third", "First", "Second"],
        }),
      );
    });

    it("moves a row on ⌥↓ and sends focus after it", () => {
      threeRows();
      const remove = screen.getByRole("button", { name: "Remove First" });
      remove.focus();

      fireEvent.keyDown(remove, { key: "ArrowDown", altKey: true });

      expect(drafted()).toEqual(["Second", "First", "Third"]);
      // The rows key by position, so the row that moved is a different element
      // now — focus has to follow the item rather than the place.
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Remove First" }),
      );
    });

    it("has nowhere to send the last row on ⌥↓", () => {
      threeRows();
      const remove = screen.getByRole("button", { name: "Remove Third" });

      fireEvent.keyDown(remove, { key: "ArrowDown", altKey: true });

      expect(drafted()).toEqual(["First", "Second", "Third"]);
    });

    it("draws no grip on a list with nothing to reorder", () => {
      render(createPanel());
      addChecklistItem("Alone");

      expect(document.querySelector(".row-grip")).toBeNull();
      expect(
        document.querySelector(".checklist-row")?.getAttribute("draggable"),
      ).toBe("false");
    });
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

  /**
   * And keeps it *on screen*: the draft row lands where the field was standing,
   * so the field moves a row down a pane that does not follow it, and on a short
   * window one Enter puts it under the bottom edge (LC-193). The panel's add-row
   * answers this and so does this one — they are the same object. jsdom lays
   * nothing out, so the call is what is held here;
   * `perf/checklist-probe.mjs` measures the boxes, on this surface too.
   */
  it("brings the add-row back into view as the draft list grows (LC-193)", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(createPanel());
    const field = screen.getByLabelText("Add a checklist item");

    field.focus();
    addChecklistItem("First");
    expect(scrolled.mock.instances[0]).toBe(field);
    expect(scrolled.mock.calls[0][0]).toEqual({ block: "nearest" });

    // Not when the field is not where the human is: removing a row moves the
    // list too, and focus is on the button that did it until it goes away.
    scrolled.mockClear();
    field.blur();
    addChecklistItem("Second");
    expect(scrolled).not.toHaveBeenCalled();
  });

  /**
   * D-4D (LC-119). The prototype draws no counter in create mode at any length,
   * and the numerator here could not move if it did: every draft item is open
   * by construction. `0/0` was a count of nothing that read as a checklist left
   * unfinished, and `0/3` would only repeat the three rows on screen.
   */
  it("shows no checklist fraction, however many items are drafted", () => {
    render(createPanel());
    const section = screen.getByRole("heading", { name: /Checklist/ });
    expect(section.querySelector(".section-count")).toBeNull();
    expect(section.textContent).toBe("Checklist");

    addChecklistItem("Let an agent read this ticket");
    addChecklistItem("Review what it changed");

    expect(section.querySelector(".section-count")).toBeNull();
    expect(section.textContent).toBe("Checklist");
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

describe("full create prototype parity", () => {
  /**
   * D-4B (LC-117). The one line telling the human what this field is *for* —
   * and what reads it. The prototype puts it only on the create surface: an
   * edit is opened against a description that already exists.
   */
  it("says what the description is for while it is still empty", () => {
    render(createPanel());

    expect(
      screen.getByLabelText("Description").getAttribute("placeholder"),
    ).toBe("What should happen? Agents read this before they start.");
  });

  /**
   * D-4C (LC-118), the same fix as D-3C: the chips are the value and the
   * dashed chip is the control. The empty row said `None` — a word reporting
   * an absence, where the prototype puts an invitation.
   */
  it("offers `+ add` on the labels row, never a `None` button", () => {
    render(createPanel());

    const control = metaTrigger("Labels");
    expect(control.textContent).toContain("add");
    expect(control.classList.contains("addable")).toBe(true);
    // The empty row's accessible name still says the value, because the chips
    // beside the control are not in its name.
    expect(control.getAttribute("aria-label")).toBe("Labels: none");
    expect(screen.queryByRole("button", { name: "None" })).toBeNull();
  });

  it("keeps `+ add` beside the chips once labels are on", () => {
    render(createPanel());
    fireEvent.click(metaTrigger("Labels"));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Backend" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    // A row with chips needs the control just as much: it takes labels off too.
    expect(metaTrigger("Labels").textContent).toContain("add");
    expect(screen.getByText("Backend")).toBeTruthy();
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
