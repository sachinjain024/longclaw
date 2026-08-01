// @vitest-environment jsdom

/**
 * The editor as a surface: the tab pattern, the toolbar's keyboard model, and
 * the claim the whole thing exists to keep — the raw string goes in and comes
 * back out untouched, however many times it is previewed on the way.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DescriptionEditor } from "./DescriptionEditor";

/** The panel owns the draft, so the harness does too. */
function Harness(props: {
  initial: string;
  onSave?: (value: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(props.initial);
  return (
    <DescriptionEditor
      value={value}
      canSave={value !== props.initial}
      onChange={setValue}
      onCancel={() => props.onCancel?.()}
      onSave={() => props.onSave?.(value)}
    />
  );
}

function field() {
  return screen.getByLabelText("Description") as HTMLTextAreaElement;
}

const NON_CANONICAL = [
  "Setext heading",
  "===",
  "",
  "*   a star bullet with loose spacing",
  "-  a dash bullet",
  "    - a four-space indent",
  "+ and a plus",
  "",
  "Trailing spaces here  ",
  "make the line above a hard break.",
  "",
  "> a block quote",
  "",
  "1. an ordered item",
  "",
  "```js",
  "const spacing = '  load   bearing  ';",
  "```",
  "",
  "\tA tab-indented line.",
].join("\n");

afterEach(cleanup);

describe("the write/preview tabs", () => {
  it("is a real tab pattern, driven by the arrow keys", () => {
    render(<Harness initial="hello" />);
    const [write, preview] = screen.getAllByRole("tab");

    expect(write.getAttribute("aria-selected")).toBe("true");
    expect(write.getAttribute("aria-controls")).toBe(
      screen.getByRole("tabpanel", { name: "Write" }).id,
    );
    expect(write.tabIndex).toBe(0);
    expect(preview.tabIndex).toBe(-1);

    fireEvent.keyDown(write, { key: "ArrowRight" });

    expect(preview.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(preview);
    expect(screen.getByRole("tabpanel", { name: "Preview" })).toBeTruthy();

    // Wraps, both ways.
    fireEvent.keyDown(preview, { key: "ArrowRight" });
    expect(write.getAttribute("aria-selected")).toBe("true");
  });

  it("focuses the textarea with the caret at the end when it opens", () => {
    render(<Harness initial="hello" />);

    expect(document.activeElement).toBe(field());
    expect(field().selectionStart).toBe(5);
  });

  it("says so rather than showing an empty preview", () => {
    render(<Harness initial="" />);

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByText("Nothing to preview yet.")).toBeTruthy();
  });
});

describe("the formatting toolbar", () => {
  it("is one tab stop with six named buttons, driven by the arrow keys", () => {
    render(<Harness initial="hello" />);
    const buttons = Array.from(
      screen
        .getByRole("toolbar", { name: "Formatting" })
        .querySelectorAll("button"),
    );

    expect(buttons).toHaveLength(6);
    // One stop, so Tab reaches the textarea without pressing it seven times
    // (`keyboard-focus-map.md:61`).
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);

    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });

    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].tabIndex).toBe(0);
    expect(buttons[0].tabIndex).toBe(-1);
  });

  it("has nothing to act on while the preview is showing", () => {
    render(<Harness initial="hello" />);

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const buttons = Array.from(
      screen
        .getByRole("toolbar", { name: "Formatting" })
        .querySelectorAll("button"),
    );
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it("puts the caret back where the action left it", () => {
    render(<Harness initial="alpha beta gamma" />);
    field().setSelectionRange(6, 10);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(field().value).toBe("alpha **beta** gamma");
    expect(document.activeElement).toBe(field());
    expect([field().selectionStart, field().selectionEnd]).toEqual([8, 12]);
  });
});

describe("must-pass 2: the raw string is never normalized", () => {
  it("survives previewing, and comes back byte-identical", () => {
    const onSave = vi.fn();
    render(<Harness initial={NON_CANONICAL} onSave={onSave} />);
    expect(field().value).toBe(NON_CANONICAL);

    // Two round trips through the parser's territory, and one word changed.
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    const edited = NON_CANONICAL.replace("quote", "quotation");
    fireEvent.change(field(), { target: { value: edited } });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    fireEvent.click(screen.getByRole("tab", { name: "Write" }));

    expect(field().value).toBe(edited);
    fireEvent.keyDown(field(), { key: "Enter", metaKey: true });
    expect(onSave).toHaveBeenCalledWith(edited);

    // Every byte outside the one word is the one the human never touched.
    const touched = NON_CANONICAL.indexOf("quote");
    expect(edited.slice(0, touched)).toBe(NON_CANONICAL.slice(0, touched));
    expect(edited.slice(touched + "quotation".length)).toBe(
      NON_CANONICAL.slice(touched + "quote".length),
    );
  });

  it("shows the whole document in the preview, rendered or not", () => {
    render(<Harness initial={NON_CANONICAL} />);

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const preview = screen.getByRole("tabpanel", { name: "Preview" });
    // The constructs the subset does not render are still legible, and the
    // fence's interior spacing is intact.
    expect(preview.textContent).toContain("Setext heading");
    expect(preview.textContent).toContain(
      "const spacing = '  load   bearing  ';",
    );
    expect(preview.textContent).toContain("A tab-indented line.");
    // And the constructs it does render are elements. V0-13 moved the block
    // quote and the ordered list into the subset, so these two are no longer
    // literal text — a timeline comment is full of both.
    expect(preview.querySelectorAll("li").length).toBeGreaterThan(0);
    expect(preview.querySelector("pre code")).toBeTruthy();
    expect(preview.querySelector("blockquote")?.textContent).toBe(
      "a block quote",
    );
    expect(preview.querySelector("ol li")?.textContent).toBe("an ordered item");
  });

  it("never turns markup into DOM", () => {
    render(
      <Harness
        initial={'<img src=x onerror=alert(1)>\n\n<a href="#">link</a>'}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const preview = screen.getByRole("tabpanel", { name: "Preview" });
    expect(preview.querySelector("img")).toBeNull();
    expect(preview.querySelector("a")).toBeNull();
    expect(preview.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("the footer keys", () => {
  it("saves on ⌘↵ only when there is something to save", () => {
    const onSave = vi.fn();
    render(<Harness initial="hello" onSave={onSave} />);

    fireEvent.keyDown(field(), { key: "Enter", metaKey: true });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(field(), { target: { value: "hello there" } });
    fireEvent.keyDown(field(), { key: "Enter", metaKey: true });
    expect(onSave).toHaveBeenCalledWith("hello there");
  });

  it("cancels on Esc, and stops it reaching the panel behind", () => {
    const onCancel = vi.fn();
    const escaped = vi.fn();
    document.addEventListener("keydown", escaped);
    render(<Harness initial="hello" onCancel={onCancel} />);

    fireEvent.keyDown(field(), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(escaped).not.toHaveBeenCalled();
    document.removeEventListener("keydown", escaped);
  });

  it("says where the bytes go", () => {
    render(<Harness initial="hello" />);

    expect(screen.getByText("writes to ticket.md on save")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Cancel/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Save/ })).toBeTruthy();
  });
});
