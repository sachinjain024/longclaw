// @vitest-environment jsdom

/**
 * Quick create after V0-16 narrowed it, LC-186 widened it by one, LC-201 widened
 * it by two more and gave it a loop, and LC-227 gave it whichever properties the
 * project turned on: title, description, status, priority, labels, a **Create
 * more** checkbox, and a door to the surface that owns the checklist
 * (`screen-specs.md:253-262`).
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LabelDefinition } from "./LabelMenu";
import { NO_PROPERTIES } from "./properties";
import { QuickCreate } from "./QuickCreate";
import type {
  Label,
  NewTicketProperties,
  PropertiesConfig,
  TicketPriority,
  TicketStatus,
} from "./types";

afterEach(() => {
  cleanup();
  // Only the theme-dot test stamps it, and the root outlives a render.
  delete document.documentElement.dataset.theme;
});

/** What `longclaw.yaml` defines. The menu can offer these and nothing else. */
const LABELS: Record<string, Label> = {
  frontend: { name: "Frontend", color: "blue" },
  storage: { name: "Storage", color: "green" },
};

/** Tuesday 8 September 2026, local: the day the date grammar resolves against. */
const TODAY = new Date(2026, 8, 8, 9, 0).getTime();

function quickCreate(props?: {
  projectTheme?: string;
  initialStatus?: TicketStatus;
  initialPriority?: TicketPriority;
  initialProperties?: NewTicketProperties;
  properties?: PropertiesConfig;
  today?: number;
  onCancel?: () => void;
  onCreate?: (request: unknown, options: unknown) => void;
  onOpenFullEditor?: (draft: unknown) => void;
  onDefineLabel?: (definition: LabelDefinition) => Promise<boolean>;
  labels?: Record<string, Label>;
}) {
  return (
    <QuickCreate
      projectName="Round Trip"
      projectTheme={props?.projectTheme ?? "ember"}
      provisionalKey="RT-4"
      labels={props?.labels ?? LABELS}
      properties={props?.properties ?? NO_PROPERTIES}
      today={props?.today ?? TODAY}
      onDefineLabel={props?.onDefineLabel ?? (() => Promise.resolve(true))}
      initialStatus={props?.initialStatus}
      initialPriority={props?.initialPriority}
      initialProperties={props?.initialProperties}
      onCancel={props?.onCancel ?? (() => {})}
      onCreate={props?.onCreate ?? (() => {})}
      onOpenFullEditor={props?.onOpenFullEditor ?? (() => {})}
    />
  );
}

/** The label trigger — the dashed `+ add` chip, never a text box (D-3C). */
function labelTrigger() {
  return screen.getByRole("button", { name: /^Labels: / });
}

/** The status meta trigger, which is the shared popover rather than a select. */
function statusTrigger() {
  return screen.getByRole("button", { name: /^Status: / });
}

/** The priority trigger beside it — the same component, the same vocabulary. */
function priorityTrigger() {
  return screen.getByRole("button", { name: /^Priority: / });
}

describe("quick create is title, description, status, priority and labels", () => {
  it("sends everything the human chose, and nothing else", () => {
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

    expect(onCreate).toHaveBeenCalledWith(
      {
        title: "Prove the agent round trip",
        description: "",
        status: "in_progress",
        priority: "urgent",
        labels: [],
        properties: {},
      },
      { createMore: false },
    );
  });

  it("sends the fields nobody filled in as empty rather than omitting them", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Filed without a thought about urgency" },
    });
    fireEvent.click(screen.getByText("Create"));

    // Not omitted: `none` is what the file would hold either way (LC-186), and
    // an empty description, no labels and no properties are the same fact.
    // Sending them keeps one create request shape rather than two.
    expect(onCreate).toHaveBeenCalledWith(
      {
        title: "Filed without a thought about urgency",
        description: "",
        status: "todo",
        priority: "none",
        labels: [],
        properties: {},
      },
      { createMore: false },
    );
  });

  it("sends the description the human typed (LC-201)", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Retry re-sends a stale hash" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  The draft's hash, not the disk's.  " },
    });
    fireEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "The draft's hash, not the disk's.",
      }),
      expect.anything(),
    );
  });

  it("sends the labels ticked in the project's own menu (LC-201)", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Two labels, both defined" },
    });
    fireEvent.click(labelTrigger());
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Frontend" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Storage" }));
    fireEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["frontend", "storage"] }),
      expect.anything(),
    );
  });

  it("offers no way to type a label that the project does not define", () => {
    render(quickCreate());

    // V0-10 and plan 22 removed a comma-separated text box, because a slug
    // typed into a free-text field is a slug `longclaw.yaml` may not carry.
    // The field is back; the box is not, and must not come back with it.
    // LC-236e's define row is not that box either: what it writes is a
    // definition, so the slug it produces is one `longclaw.yaml` carries.
    expect(screen.queryByLabelText(/^Labels$/)).toBeNull();
    expect(labelTrigger().getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(labelTrigger());
    expect(
      screen.getAllByRole("menuitemcheckbox").map((row) => row.textContent),
    ).toEqual(["Frontend", "Storage"]);
  });

  describe("defining a label from inside the flow (LC-236e)", () => {
    /** Opens the popover and expands the define row. */
    function openDefine() {
      fireEvent.click(labelTrigger());
      fireEvent.click(screen.getByRole("button", { name: "New label" }));
    }

    it("defines a label and ticks it onto the draft, in one gesture", async () => {
      const onDefineLabel = vi.fn().mockResolvedValue(true);
      const onCreate = vi.fn();
      render(quickCreate({ onDefineLabel, onCreate }));

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Needs a label that does not exist yet" },
      });
      openDefine();
      fireEvent.change(screen.getByLabelText("New label name"), {
        target: { value: "Reliability" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add label" }));

      await waitFor(() =>
        expect(onDefineLabel).toHaveBeenCalledWith({
          slug: "reliability",
          name: "Reliability",
          // The first hue this project is not already using: `frontend` holds
          // blue, and `storage`'s green is not on the ramp at all.
          color: "cyan",
        }),
      );
      // The second half of the gesture: it is on the draft, not merely defined.
      fireEvent.click(screen.getByText("Create"));
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ labels: ["reliability"] }),
        expect.anything(),
      );
    });

    it("keeps what was typed when the write is refused", async () => {
      const onDefineLabel = vi.fn().mockResolvedValue(false);
      render(quickCreate({ onDefineLabel }));

      openDefine();
      fireEvent.change(screen.getByLabelText("New label name"), {
        target: { value: "Reliability" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add label" }));

      await waitFor(() => expect(onDefineLabel).toHaveBeenCalledTimes(1));
      // The surface has already said why; the fix is an edit, not a retype.
      expect(
        (screen.getByLabelText("New label name") as HTMLInputElement).value,
      ).toBe("Reliability");
    });

    it("empties the row and stays open after one lands", async () => {
      const onDefineLabel = vi.fn().mockResolvedValue(true);
      render(quickCreate({ onDefineLabel }));

      openDefine();
      fireEvent.change(screen.getByLabelText("New label name"), {
        target: { value: "Reliability" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add label" }));

      // Defining one label on a project short of them is rarely defining one.
      await waitFor(() =>
        expect(
          (screen.getByLabelText("New label name") as HTMLInputElement).value,
        ).toBe(""),
      );
    });

    it("opens the row expanded on a project that defines nothing", () => {
      render(quickCreate({ labels: {} }));

      fireEvent.click(labelTrigger());

      // A popover whose only content is a collapsed invitation is a popover
      // that still says nothing, which is the complaint LC-236e opens with.
      expect(screen.queryByRole("button", { name: "New label" })).toBeNull();
      const field = screen.getByLabelText("New label name");
      expect(document.activeElement).toBe(field);
    });

    it("keeps the row collapsed where the project has labels to offer", () => {
      render(quickCreate());

      fireEvent.click(labelTrigger());

      // Two rows to tick: the invitation is one more row, not the whole menu.
      expect(screen.getByRole("button", { name: "New label" })).toBeTruthy();
      expect(screen.queryByLabelText("New label name")).toBeNull();
    });

    it("leaves Enter on the row's own buttons to the row", async () => {
      const onDefineLabel = vi.fn().mockResolvedValue(true);
      const onCreate = vi.fn();
      render(quickCreate({ onDefineLabel, onCreate }));

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Opened with the mouse" },
      });
      openDefine();
      fireEvent.change(screen.getByLabelText("New label name"), {
        target: { value: "Reliability" },
      });
      // `Menu.onKeyDown` is on the popover, so a key pressed on a control
      // *inside* the define row bubbles to it. Opening the row with the
      // pointer leaves the menu's roving index on the first label, so without
      // a guard this press picks that label and swallows the submit.
      const add = screen.getByRole("button", { name: "Add label" });
      add.focus();
      fireEvent.keyDown(add, { key: "Enter" });
      fireEvent.click(add);

      await waitFor(() => expect(onDefineLabel).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByText("Create"));
      // `frontend` is the first row in the menu, and nothing ticked it.
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ labels: ["reliability"] }),
        expect.anything(),
      );
    });

    it("keeps the roving stop on the field while the row is open", () => {
      render(quickCreate());
      openDefine();
      const field = screen.getByLabelText("New label name");

      // Stand on the first label, so the press below has somewhere to move
      // *from* — the row focuses its own field when it opens, and an assertion
      // made from there would hold whether or not the stop was wired up.
      const rows = screen.getAllByRole("menuitemcheckbox");
      rows[0].focus();
      expect(document.activeElement).toBe(rows[0]);

      // `↑` from the first label wraps onto the footer. While the row is open
      // the footer's stop *is* the name field — the collapsed button it was
      // attached to has unmounted, and React nulls a callback ref on the way
      // out, so a stop set only there would focus nothing at all.
      fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });

      expect(document.activeElement).toBe(field);
    });

    it("will not write a name that cannot make a key", () => {
      const onDefineLabel = vi.fn().mockResolvedValue(true);
      render(quickCreate({ onDefineLabel }));

      openDefine();
      fireEvent.change(screen.getByLabelText("New label name"), {
        target: { value: "日本語" },
      });

      expect(
        screen.getByText("Label Name must start with a letter [a-z]"),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Add label" }));
      expect(onDefineLabel).not.toHaveBeenCalled();
    });

    it("refuses a key the project already defines, and names what holds it", () => {
      const onDefineLabel = vi.fn().mockResolvedValue(true);
      render(quickCreate({ onDefineLabel }));

      openDefine();
      fireEvent.change(screen.getByLabelText("New label name"), {
        target: { value: "Front End" },
      });

      // `front-end` is free; `frontend` is not.
      expect(onDefineLabel).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("New label name"), {
        target: { value: "frontend" },
      });
      expect(
        screen.getByText(
          "frontend already exists for Frontend. Please provide a new Label name.",
        ),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Add label" }));
      expect(onDefineLabel).not.toHaveBeenCalled();
    });
  });

  it("still offers no checklist: that is what full create is for", () => {
    render(quickCreate());

    // The one of the three V0-16 removed whose case does not change. Draft
    // rows, drag reordering and an add-row that has to stay on screen are the
    // shape of a surface you sit in.
    expect(screen.queryByLabelText(/checklist/i)).toBeNull();
  });

  it("carries all six fields into full create rather than dropping any", () => {
    const onOpenFullEditor = vi.fn();
    const onCreate = vi.fn();
    render(quickCreate({ onOpenFullEditor, onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Needs more thought  " },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  And a checklist, which lives over there.  " },
    });
    fireEvent.click(statusTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Backlog" }));
    fireEvent.click(priorityTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "P1" }));
    fireEvent.click(labelTrigger());
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Frontend" }));
    fireEvent.click(screen.getByText("Open full editor →"));

    // The door is what makes the narrow surface honest, so it may not be the
    // place any of the six fields quietly go missing.
    expect(onOpenFullEditor).toHaveBeenCalledWith({
      title: "Needs more thought",
      description: "And a checklist, which lives over there.",
      status: "backlog",
      priority: "p1",
      labels: ["frontend"],
      properties: {},
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

/**
 * LC-201's own claim. Filing eight tickets used to cost eight presses of `C`
 * and eight trips through two menus for a run that almost always shares both.
 */
describe("the Create more loop", () => {
  function createMore() {
    return screen.getByRole("checkbox", {
      name: "Create more",
    }) as HTMLInputElement;
  }

  const field = (name: string) =>
    screen.getByLabelText(name) as HTMLInputElement;

  it("is off on every open: it is a mode for the run, not a preference", () => {
    render(quickCreate());

    expect(createMore().checked).toBe(false);
  });

  it("tells the caller whether the modal is expecting to stay", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "First of several" },
    });
    fireEvent.click(createMore());
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    // The second argument, not the request: `createMore` is a decision about
    // the surface, the way `openPanel` already is, and the first argument is
    // exactly what Rust is handed. A flag riding along inside the request
    // would be a field to remember to strip at the IPC boundary.
    expect(onCreate).toHaveBeenCalledWith(expect.anything(), {
      createMore: true,
    });
  });

  it("clears the title and description and keeps everything else", () => {
    render(quickCreate());

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "First of several" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "The one that sets the meta for the rest." },
    });
    fireEvent.click(statusTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "In Progress" }));
    fireEvent.click(priorityTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "P1" }));
    fireEvent.click(labelTrigger());
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Frontend" }));
    fireEvent.click(createMore());
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    // What the next ticket is: two empty fields and the meta already right.
    expect(field("Title").value).toBe("");
    expect(field("Description").value).toBe("");
    expect(statusTrigger().textContent).toContain("In Progress");
    expect(priorityTrigger().textContent).toContain("P1");
    expect(labelTrigger().getAttribute("aria-label")).toBe("Labels: Frontend");
    expect(createMore().checked).toBe(true);
  });

  it("sends the second create with the meta the first one left behind", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.click(createMore());
    fireEvent.click(priorityTrigger());
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Urgent" }));
    fireEvent.click(labelTrigger());
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Storage" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "First" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Second" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onCreate).toHaveBeenNthCalledWith(
      2,
      {
        title: "Second",
        description: "",
        status: "todo",
        priority: "urgent",
        labels: ["storage"],
        properties: {},
      },
      { createMore: true },
    );
  });

  it("refuses a second press on the title it just emptied", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.click(createMore());
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Only once" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    // The same `canCreate` that has always refused an empty title. A run must
    // not be able to file a blank ticket by leaning on Return.
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft standing when the box is not ticked", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "One and done" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    // Closing is App's job, not the modal's: the surface it is about to be
    // taken off the screen by must not flash an emptied field first.
    expect(onCreate).toHaveBeenCalledWith(expect.anything(), {
      createMore: false,
    });
    expect(field("Title").value).toBe("One and done");
  });
});

/**
 * LC-201. A textarea does not submit on `↵` and must not — a description is
 * markdown and needs its newlines — so the binding grows the second half full
 * create already has, and each half is said once on a control of its own.
 */
describe("the two ways to create", () => {
  it("creates on `⌘↵` from inside the description", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Filed from the description field" },
    });
    fireEvent.keyDown(screen.getByLabelText("Description"), {
      key: "Enter",
      metaKey: true,
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("leaves a plain `↵` in the description alone, so markdown keeps its lines", () => {
    const onCreate = vi.fn();
    render(quickCreate({ onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Two paragraphs, one ticket" },
    });
    fireEvent.keyDown(screen.getByLabelText("Description"), { key: "Enter" });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("says each binding once, on the control that performs it", () => {
    render(quickCreate());

    // `⌘↵` inside **Create**, the way full create's own footer writes it, and
    // `esc` at the top right. With both on controls, the mono hints line that
    // repeated them has nothing left to say.
    expect(
      screen.getByRole("button", { name: /^Create/ }).textContent,
    ).toContain("⌘↵");
    expect(screen.queryByText(/↵ create/)).toBeNull();
    expect(screen.queryByText(/esc cancel/)).toBeNull();
  });
});

/**
 * LC-201. Quick create has no **Cancel** and its scrim is `role="presentation"`
 * with no handler, so until now a human who opened it by pointer and changed
 * their mind had nowhere on the screen to go: **Open full editor →** is the only
 * control that leaves, and it does not leave.
 */
describe("`esc`, the word, at the top right", () => {
  it("closes the modal when it is clicked, without creating anything", () => {
    const onCancel = vi.fn();
    const onCreate = vi.fn();
    render(quickCreate({ onCancel, onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Typed, then thought better of" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("is not a tab stop: its keyboard path is the key it is named after", () => {
    render(quickCreate());

    // Stated rather than defaulted, which is what `tab-order-guard.mjs` is
    // for — and −1 rather than 0, because a stop in front of the title for a
    // control the keyboard already has is a press paid on every open.
    expect(screen.getByRole("button", { name: "Close" }).tabIndex).toBe(-1);
  });

  it("is the word and not a chip", () => {
    const { container } = render(quickCreate());

    // Not the palette's `kbd-chip`: that one is a `<kbd>` in a box reporting a
    // key it cannot perform, and a box here competes with the two fields under
    // it for the only edge the modal has to spend.
    const esc = screen.getByRole("button", { name: "Close" });
    expect(esc.textContent).toBe("esc");
    expect(esc.className).not.toContain("kbd-chip");
    expect(container.querySelector(".quick-create-context kbd")).toBeNull();
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

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Preseeded", status: "in_review" }),
      expect.anything(),
    );
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
    // (`keyboard-focus-map.md:134`).
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

/**
 * The opt-in properties on the narrow surface (LC-227).
 *
 * Quick create takes them for the reason it took priority back (LC-186): a
 * project that turned one on has said its tickets carry it, and a create
 * surface that cannot say so files a board of tickets all missing the same
 * thing. What it costs is paid only by a project that asked for it.
 */
describe("the properties a project turned on", () => {
  const withDue: PropertiesConfig = {
    ...NO_PROPERTIES,
    due: { enabled: true, attentionDays: 7 },
  };
  const withAll: PropertiesConfig = {
    ...withDue,
    type: { enabled: true, values: { bug: { name: "Bug", color: "red" } } },
    start: { enabled: true },
    estimate: {
      ...NO_PROPERTIES.estimate,
      enabled: true,
      values: ["s", "m", "l"],
    },
  };

  /** The property row's names, in the order it draws them. */
  function propertyNames(): (string | null)[] {
    return [
      ...document.querySelectorAll(".quick-create-properties .property-name"),
    ].map((name) => name.textContent);
  }

  it("draws no row at all for a project that has turned them all off", () => {
    render(quickCreate());

    // Every project that predates this build: the modal is the one that has
    // always been here, down to the empty row it does not draw.
    expect(document.querySelector(".quick-create-properties")).toBeNull();
  });

  it("names each control, because the row's shape is the project's", () => {
    // The meta line above is three bare triggers learned by position (D-49).
    // This row's length and order are configuration, and an unlabelled type
    // beside an unlabelled priority is two controls both reading `None`.
    render(quickCreate({ properties: withAll }));

    expect(propertyNames()).toEqual([
      "Type",
      "Estimate",
      "Start Date",
      "Due Date",
    ]);
  });

  it("draws only the ones it turned on", () => {
    render(quickCreate({ properties: withDue }));

    expect(propertyNames()).toEqual(["Due Date"]);
  });

  it("sends what was chosen under one properties field", () => {
    const onCreate = vi.fn();
    render(quickCreate({ properties: withAll, onCreate }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Filed with a date on it" },
    });
    const due = screen.getByLabelText("Due Date");
    fireEvent.change(due, { target: { value: "28 Sep" } });
    fireEvent.keyDown(due, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { due: "2026-09-28" } }),
      expect.anything(),
    );
  });

  it("carries them through the door to full create", () => {
    const onOpenFullEditor = vi.fn();
    render(quickCreate({ properties: withAll, onOpenFullEditor }));

    const due = screen.getByLabelText("Due Date");
    fireEvent.change(due, { target: { value: "28 Sep" } });
    fireEvent.keyDown(due, { key: "Enter" });
    fireEvent.click(screen.getByText("Open full editor →"));

    // The door is what makes the narrow surface honest, and a property is not
    // the field it may start going missing at.
    expect(onOpenFullEditor).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { due: "2026-09-28" } }),
    );
  });

  it("takes a clear off the draft rather than sending a null", () => {
    // The other half of `usePropertyDraft`'s contract, asserted from this
    // surface as well as from full create: the hook is what makes the two
    // answers the same, and a test on one surface alone would not say it is in
    // this one's path.
    const onCreate = vi.fn();
    render(quickCreate({ properties: withAll, onCreate }));

    const due = screen.getByLabelText("Due Date");
    fireEvent.change(due, { target: { value: "28 Sep" } });
    fireEvent.keyDown(due, { key: "Enter" });
    fireEvent.change(due, { target: { value: "" } });
    fireEvent.keyDown(due, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Set, then thought better of" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ properties: {} }),
      expect.anything(),
    );
  });

  it("opens on the properties it is handed, so coming back does not forget", () => {
    render(
      quickCreate({
        properties: withAll,
        initialProperties: { due: "2026-09-28" },
      }),
    );

    expect(screen.getByLabelText<HTMLInputElement>("Due Date").value).toBe(
      "28 Sep",
    );
  });

  it("keeps them across the Create more loop, as it keeps the rest of the meta", () => {
    const onCreate = vi.fn();
    render(quickCreate({ properties: withAll, onCreate }));

    fireEvent.click(screen.getByRole("checkbox"));
    const due = screen.getByLabelText("Due Date");
    fireEvent.change(due, { target: { value: "28 Sep" } });
    fireEvent.keyDown(due, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "First" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Second" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create/ }));

    // Eight bugs due Friday is LC-201's complaint in a project that turned
    // dates on. Nothing is hidden while it is kept: the field is on screen
    // wearing what the next create will send.
    expect(onCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: "Second",
        properties: { due: "2026-09-28" },
      }),
      { createMore: true },
    );
    expect(screen.getByLabelText<HTMLInputElement>("Due Date").value).toBe(
      "28 Sep",
    );
  });
});
