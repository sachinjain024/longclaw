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
    theme: screen.getByLabelText("Theme") as HTMLSelectElement,
    submit,
    form: submit.closest("form") as HTMLFormElement,
  };
}

describe("the create-project form", () => {
  it("sends the name, key, and theme the human chose", () => {
    const form = renderForm();
    fireEvent.change(form.name, { target: { value: "My Project" } });
    fireEvent.change(form.theme, { target: { value: "slate" } });

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

  it("states the key rule before anything is refused", () => {
    renderForm();

    expect(
      screen.getByText(/uppercase letters and digits, starting with a letter/i),
    ).toBeTruthy();
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
});
