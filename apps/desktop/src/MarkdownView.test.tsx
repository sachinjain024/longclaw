// @vitest-environment jsdom

/**
 * What the DOM makes of the tree, which is the half `markdown.test.ts` cannot
 * see. A node value that still carries the author's `\n` is *one* line on
 * screen: `.markdown` sets no `white-space`, so the webview collapses that
 * newline to a space. Asserting on node values passes against a line the reader
 * never gets — LC-179 is that gap, and these tests are written in the units the
 * reader has, which are lines and, for a table, the grid the lines are in.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownView } from "./MarkdownView";

afterEach(cleanup);

/** The tags in the subset that start their own line by being block-level. */
const BLOCK = new Set([
  "P",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

/**
 * The lines the rendered output actually shows.
 *
 * Only a `<br>`, a block boundary, a `<pre>`'s preserved newlines and a table's
 * rows put text on a new line. Everywhere else a `\n` is a space, which is why
 * this joins across one rather than splitting on it.
 */
function shownLines(root: Element): string[] {
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current !== "") lines.push(current);
    current = "";
  };
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        current += (child.textContent ?? "").replace(/\n/g, " ");
        continue;
      }
      const element = child as Element;
      if (element.tagName === "BR") {
        lines.push(current);
        current = "";
        continue;
      }
      if (element.tagName === "PRE") {
        flush();
        lines.push(...(element.textContent ?? "").split("\n"));
        continue;
      }
      // A row is a line, and its cells are columns rather than words: joined
      // with a tab, because the boundary is drawn now and no longer a character
      // the reader can see.
      if (element.tagName === "TABLE") {
        flush();
        lines.push(...gridOf(element).map((row) => row.join("\t")));
        continue;
      }
      if (BLOCK.has(element.tagName)) {
        flush();
        walk(element);
        flush();
        continue;
      }
      walk(element);
    }
  };
  walk(root);
  flush();
  return lines;
}

/** A rendered table's text, cell by cell, header row first. */
function gridOf(table: Element): string[][] {
  return Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => cell.textContent ?? ""),
  );
}

function shown(source: string): string[] {
  const { container } = render(<MarkdownView source={source} />);
  return shownLines(container);
}

function table(source: string): HTMLTableElement {
  const { container } = render(<MarkdownView source={source} />);
  const found = container.querySelector("table");
  if (!found) throw new Error("expected a table");
  return found;
}

/** LC-178's section, shortened: a table is worth writing to be scanned. */
const ROWS = [
  "| Time | State |",
  "| ---- | ----- |",
  "| 0:00 | Query `Full Create`. Todo reads 4. |",
  "| 0:05 | Filter cleared. The board is correct. |",
];
const TABLE = ROWS.join("\n");
/** The grid those rows draw, with the delimiter row gone and the walls with it. */
const AS_SHOWN = [
  ["Time", "State"],
  ["0:00", "Query Full Create. Todo reads 4."],
  ["0:05", "Filter cleared. The board is correct."],
];

describe("the lines a reader gets", () => {
  it("puts each row of a table on its own line", () => {
    expect(shown(TABLE)).toEqual(AS_SHOWN.map((row) => row.join("\t")));
  });

  it("keeps the rows apart under the line that led into the table", () => {
    // The shape an author actually writes: a sentence, then the table, with no
    // blank line between them.
    expect(shown(`Here is the recording:\n${TABLE}`)).toEqual([
      "Here is the recording:",
      ...AS_SHOWN.map((row) => row.join("\t")),
    ]);
  });

  it("renders a table inside a comment body's quote", () => {
    const quoted = ROWS.map((row) => `> ${row}`).join("\n");
    expect(shown(quoted)).toEqual(AS_SHOWN.map((row) => row.join("\t")));
  });

  it("still joins a soft-wrapped paragraph into one line", () => {
    // The other half of the fix: a paragraph the author hard-wrapped at 80
    // columns is prose, and prose that broke at its wrap points would be worse
    // than the bug.
    expect(shown("one two\nthree four")).toEqual(["one two three four"]);
  });

  it("breaks where the author asked for a break", () => {
    expect(shown("one  \ntwo\\\nthree")).toEqual(["one", "two", "three"]);
  });

  it("keeps a fence's lines, which are its own", () => {
    expect(shown("```\nfirst\nsecond\n```")).toEqual(["first", "second"]);
  });
});

/**
 * Lines were the unit the first half of LC-179 could reach, and they were not
 * enough: a reader scanning a table is reading *down*, and only a grid has a
 * down. These are that half, in the units the DOM actually gives it.
 */
describe("the grid a reader gets", () => {
  it("draws the columns rather than leaving the author's pipes in the text", () => {
    const cells = gridOf(table(TABLE)).flat();
    expect(cells).toEqual(AS_SHOWN.flat());
    for (const cell of cells) expect(cell).not.toContain("|");
  });

  it("marks the header row as one, which is how a column is read down", () => {
    const headers = Array.from(table(TABLE).querySelectorAll("th"));
    expect(headers.map((cell) => cell.textContent)).toEqual(["Time", "State"]);
    // Without a scope a screen reader has a grid of cells and no headings for
    // them, which is the same table the sighted reader lost to the collapse.
    for (const cell of headers) expect(cell.getAttribute("scope")).toBe("col");
    expect(table(TABLE).querySelectorAll("tbody th")).toHaveLength(0);
  });

  it("carries the delimiter row's alignment onto every cell in the column", () => {
    const grid = table(
      "| l | c | r | n |\n| :-- | :-: | --: | --- |\n| 1 | 2 | 3 | 4 |",
    );
    const classes = Array.from(grid.querySelectorAll("th, td")).map(
      (cell) => cell.className,
    );
    expect(classes).toEqual([
      "markdown-table-left",
      "markdown-table-center",
      "markdown-table-right",
      "",
      "markdown-table-left",
      "markdown-table-center",
      "markdown-table-right",
      "",
    ]);
  });

  it("renders a cell's own markdown inside the cell", () => {
    const grid = table(
      "| what | where |\n| - | - |\n| `filterTickets` | [docs](https://example.com/x) |",
    );
    expect(grid.querySelector("td code")?.textContent).toBe("filterTickets");
    expect(grid.querySelector("td a")?.getAttribute("href")).toBe(
      "https://example.com/x",
    );
  });

  it("adds no tab stop, so the keyboard map is unchanged by a table", () => {
    // `keyboard-focus-map.md` describes a panel whose description holds none,
    // and a table is content rather than a control.
    const grid = table(TABLE);
    expect(grid.querySelectorAll("[tabindex], button, input, a")).toHaveLength(
      0,
    );
  });

  it("renders no markup a cell's text happened to spell", () => {
    const grid = table("| a |\n| - |\n| <script>alert(1)</script> |");
    expect(grid.querySelector("script")).toBeNull();
    expect(grid.querySelector("td")?.textContent).toBe(
      "<script>alert(1)</script>",
    );
  });
});
