// @vitest-environment jsdom

/**
 * What the DOM makes of the tree, which is the half `markdown.test.ts` cannot
 * see. A node value that still carries the author's `\n` is *one* line on
 * screen: `.markdown` sets no `white-space`, so the webview collapses that
 * newline to a space. Asserting on node values passes against a line the reader
 * never gets — LC-179 is that gap, and these tests are written in the units the
 * reader has, which are lines.
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
 * Only a `<br>`, a block boundary, and a `<pre>`'s preserved newlines put text
 * on a new line. Everywhere else a `\n` is a space, which is why this joins
 * across one rather than splitting on it.
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

function shown(source: string): string[] {
  const { container } = render(<MarkdownView source={source} />);
  return shownLines(container);
}

describe("the lines a reader gets", () => {
  /** LC-178's section, shortened: a table is worth writing to be scanned. */
  const ROWS = [
    "| Time | State |",
    "| ---- | ----- |",
    "| 0:00 | Query `Full Create`. Todo reads 4. |",
    "| 0:05 | Filter cleared. The board is correct. |",
  ];
  const TABLE = ROWS.join("\n");
  /** The same rows, minus the backticks a cell's code span consumed. */
  const AS_SHOWN = ROWS.map((row) => row.replaceAll("`", ""));

  it("keeps every row of a table on its own line", () => {
    expect(shown(TABLE)).toEqual(AS_SHOWN);
  });

  it("keeps the rows apart under the line that led into the table", () => {
    // The shape an author actually writes: a sentence, then the table, with no
    // blank line between them.
    expect(shown(`Here is the recording:\n${TABLE}`)).toEqual([
      "Here is the recording:",
      ...AS_SHOWN,
    ]);
  });

  it("keeps a table's rows apart inside a comment body's quote", () => {
    const quoted = ROWS.map((row) => `> ${row}`).join("\n");
    expect(shown(quoted)).toEqual(AS_SHOWN);
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
