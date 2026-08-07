// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateProjectForm } from "./CreateProjectForm";

afterEach(cleanup);

const THEMES = [
  { id: "indigo", label: "Indigo" },
  { id: "slate", label: "Slate" },
];

function renderForm(onSubmit = vi.fn()) {
  render(
    <CreateProjectForm
      themes={THEMES}
      submitLabel="Choose folder"
      onSubmit={onSubmit}
    />,
  );
  const submit = screen.getByRole("button", {
    name: "Choose folder",
  }) as HTMLButtonElement;
  return {
    onSubmit,
    name: screen.getByLabelText("Name") as HTMLInputElement,
    key: screen.getByLabelText("Key") as HTMLInputElement,
    pickTheme: (label: string) =>
      fireEvent.click(screen.getByRole("radio", { name: label })),
    submit,
    form: submit.closest("form") as HTMLFormElement,
  };
}

describe("the create-project form", () => {
  it("sends the name, key, and theme the human chose", () => {
    const form = renderForm();
    fireEvent.change(form.name, { target: { value: "My Project" } });
    form.pickTheme("Slate");

    fireEvent.click(form.submit);

    expect(form.onSubmit).toHaveBeenCalledWith({
      name: "My Project",
      key: "MP",
      theme: "slate",
    });
  });

  it("suggests a key from the name", () => {
    const form = renderForm();
    fireEvent.change(form.name, { target: { value: "Longclaw Desktop" } });

    expect(form.key.value).toBe("LD");
  });

  // The reported bug: `30 July 4PM` derived `3J4`, the backend refused it, and
  // the user learned that only after answering the folder picker.
  it("never suggests a key the backend would refuse", () => {
    const form = renderForm();
    fireEvent.change(form.name, { target: { value: "30 July 4PM" } });

    expect(form.key.value).toBe("J4");
    expect(form.submit.disabled).toBe(false);

    fireEvent.click(form.submit);
    expect(form.onSubmit).toHaveBeenCalledWith({
      name: "30 July 4PM",
      key: "J4",
      theme: "indigo",
    });
  });

  it("keeps a key the human typed when they go back and edit the name", () => {
    const form = renderForm();
    fireEvent.change(form.name, { target: { value: "My Project" } });
    fireEvent.change(form.key, { target: { value: "PROJ" } });
    fireEvent.change(form.name, { target: { value: "My Renamed Project" } });

    expect(form.key.value).toBe("PROJ");
  });

  it("uppercases the key as it is typed", () => {
    const form = renderForm();
    fireEvent.change(form.key, { target: { value: "proj" } });

    expect(form.key.value).toBe("PROJ");
  });

  // D-15: the idle hint ran to two lines at the create form's width, which
  // reads as a warning about a field nobody has touched. It keeps the half no
  // refusal will ever explain — that the key locks — and hands the rule itself
  // to the refusal, which is where it earns the second line.
  it("states what the key costs before anything is refused, on one line", () => {
    renderForm();

    const hint = screen.getByText(/locks after the first ticket/i);
    expect(hint.textContent).toBe(
      "Uppercase letters and digits. Locks after the first ticket.",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains an invalid key and never opens the folder picker", () => {
    const form = renderForm();
    fireEvent.change(form.key, { target: { value: "3J4" } });

    expect(form.key.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toMatch(
      /starting with a letter/i,
    );
    expect(form.submit.disabled).toBe(true);

    fireEvent.click(form.submit);
    fireEvent.submit(form.form);

    expect(form.onSubmit).not.toHaveBeenCalled();
  });

  it("asks for a key rather than inventing one when the field is emptied", () => {
    const form = renderForm();
    fireEvent.change(form.name, { target: { value: "My Project" } });
    fireEvent.change(form.key, { target: { value: "" } });

    expect(form.key.value).toBe("");
    expect(form.submit.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/required/i);

    fireEvent.submit(form.form);
    expect(form.onSubmit).not.toHaveBeenCalled();
  });

  it("falls back to a usable name and key rather than submitting nothing", () => {
    const form = renderForm();
    fireEvent.change(form.name, { target: { value: "   " } });

    fireEvent.click(form.submit);

    expect(form.onSubmit).toHaveBeenCalledWith({
      name: "Untitled Project",
      key: "LC",
      theme: "indigo",
    });
  });

  it("stops the key at the length a new project is capped to", () => {
    const form = renderForm();
    fireEvent.change(form.key, { target: { value: "ABCDEFGH" } });

    expect(form.key.value).toBe("ABCDE");
  });

  it("caps the name at the length the project file accepts", () => {
    const form = renderForm();

    expect(form.name.maxLength).toBe(120);
  });
});

/**
 * Step two of first launch (D-13): the same form, with the folder the picker
 * already answered with shown back. Without it the screen asked for a name and
 * a key and never said where either would land.
 */
describe("the create-project form as first launch's second step", () => {
  function renderStepTwo(props: Partial<{ onBack: () => void }> = {}) {
    const onSubmit = vi.fn();
    render(
      <CreateProjectForm
        themes={THEMES}
        folder="/Users/dev/repo"
        submitLabel="Create project"
        onBack={props.onBack ?? vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    return { onSubmit };
  }

  it("shows the chosen folder and the one directory creation adds to it", () => {
    renderStepTwo();

    const row = document.querySelector(".picked-path") as HTMLElement;
    expect(row.textContent).toBe("/Users/dev/repo/.longclaw");
    // The suffix is a span of its own so it can be dimmed and can survive a
    // path too long for the row: the folder is the user's, `/.longclaw` is
    // LongClaw's, and the row exists to distinguish them.
    expect(row.querySelector(".suffix")?.textContent).toBe("/.longclaw");
    expect(row.getAttribute("title")).toBe("/Users/dev/repo/.longclaw");
  });

  it("says nothing about a folder when the picker has not run", () => {
    render(
      <CreateProjectForm
        themes={THEMES}
        submitLabel="Choose folder"
        onSubmit={vi.fn()}
      />,
    );

    expect(document.querySelector(".picked-path")).toBeNull();
    expect(screen.queryByText("Folder")).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  // `keyboard-focus-map.md:160`: the folder picker hands focus to the name
  // field. Only on this path — the sidebar's quick create opens beside a board
  // someone is already working in.
  it("puts the caret where the picker left off", () => {
    renderStepTwo();

    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });

  it("goes back to the folder question without submitting anything", () => {
    const onBack = vi.fn();
    const { onSubmit } = renderStepTwo({ onBack });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // `keyboard-focus-map.md:146-148` ends the form's tab order Create → Back.
  it("puts the way forward before the way out", () => {
    renderStepTwo();

    const actions = [
      ...document.querySelectorAll<HTMLButtonElement>(".form-actions button"),
    ];
    expect(actions.map((button) => button.textContent)).toEqual([
      "Create project",
      "Back",
    ]);
    expect(actions[0].className).toContain("primary");
    expect(actions[1].className).toContain("ghost");
    // A `Back` that submits the form it is cancelling is the default a
    // `<button>` inside a `<form>` has unless it says otherwise.
    expect(actions[1].getAttribute("type")).toBe("button");
  });
});

// First launch renders the Welcome form while the side panel renders its own, so
// two of these are mounted at once. A shared constant id would point both key
// fields at the first form's explanation.
describe("two create forms on screen at once", () => {
  it("explains each form's key in that form", () => {
    render(
      <>
        <CreateProjectForm
          themes={THEMES}
          submitLabel="Choose folder"
          onSubmit={vi.fn()}
        />
        <CreateProjectForm
          themes={THEMES}
          submitLabel="Create project in folder"
          onSubmit={vi.fn()}
        />
      </>,
    );

    const [firstKey, secondKey] = screen.getAllByLabelText(
      "Key",
    ) as HTMLInputElement[];
    fireEvent.change(secondKey, { target: { value: "3J4" } });

    const firstRule = firstKey.getAttribute("aria-describedby");
    const secondRule = secondKey.getAttribute("aria-describedby");
    expect(firstRule).not.toBe(secondRule);

    // The refusal belongs to the form it happened in, and only that form.
    expect(document.getElementById(secondRule!)?.textContent).toMatch(
      /starting with a letter/i,
    );
    expect(document.getElementById(secondRule!)?.getAttribute("role")).toBe(
      "alert",
    );
    expect(document.getElementById(firstRule!)?.getAttribute("role")).toBe(
      null,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
