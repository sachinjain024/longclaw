/**
 * The subset, construct by construct, and what happens to everything outside it.
 *
 * The table below is the enumeration V0-12's must-pass asks for: every markdown
 * construct `docs/file_format.md` documents for a ticket body, plus the ones the
 * six-button toolbar writes. The second table is the other half of the claim —
 * a construct the subset does not render must come back as the text its author
 * typed, never as a blank and never as a swallowed block.
 */

import { describe, expect, it } from "vitest";
import type { Block, Inline } from "./markdown";
import { linkHref, parseMarkdown } from "./markdown";

/** Everything a block would put on screen, as one string. */
function textOf(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.value;
        case "code":
          return node.value;
        case "break":
          return "\n";
        default:
          return textOf(node.children);
      }
    })
    .join("");
}

/** Everything the block puts on screen, whatever kind of block it is. */
function shownText(block: Block): string {
  if (block.type === "codeBlock") return block.value;
  if (block.type === "list") {
    return block.items.map((item) => textOf(item.children)).join("\n");
  }
  if (block.type === "blockquote") {
    return block.children.map(shownText).join("\n");
  }
  if (block.type === "table") {
    return [block.header, ...block.rows]
      .map((row) => row.cells.map(textOf).join(" | "))
      .join("\n");
  }
  return textOf(block.children);
}

/** A table's cells as plain strings, header row first — the grid, in a literal. */
function gridOf(block: Block): string[][] {
  if (block.type !== "table") throw new Error("expected a table");
  return [block.header, ...block.rows].map((row) => row.cells.map(textOf));
}

function shapeOf(block: Block): string {
  if (block.type === "heading") return `heading${block.level}`;
  if (block.type === "list") {
    if (block.ordered) return "ordered";
    return block.items.every((item) => item.task) ? "tasks" : "list";
  }
  if (block.type === "blockquote") {
    return `blockquote(${block.children.map(shapeOf).join(" ")})`;
  }
  return block.type;
}

describe("the constructs the format documents", () => {
  const documented: [string, string, string][] = [
    // name, source, the block shapes it must produce
    ["paragraph", "The worker fails after a transient error.", "paragraph"],
    ["heading, level 2", "## Acceptance criteria", "heading2"],
    ["heading, level 3", "### Claude Code updated this ticket", "heading3"],
    ["heading, level 6", "###### deep", "heading6"],
    ["bullet list", "- Retries use backoff.\n- Failures stay visible.", "list"],
    ["star bullets", "* one\n* two", "list"],
    ["plus bullets", "+ one\n+ two", "list"],
    ["task list", "- [x] Add retry policy\n- [ ] Add metrics", "tasks"],
    ["ordered list", "1. first\n2. second", "ordered"],
    ["paren-marked ordered list", "1) first\n2) second", "ordered"],
    ["block quote", "> quoted", "blockquote(paragraph)"],
    ["multi-line block quote", "> one\n> two", "blockquote(paragraph)"],
    ["fenced code", "```md\n## Activity\n```", "codeBlock"],
    ["tilde fence", "~~~\nliteral\n~~~", "codeBlock"],
    ["strong", "A **bold** claim.", "paragraph"],
    ["emphasis", "An *emphatic* claim.", "paragraph"],
    ["code span", "Run `cargo test` first.", "paragraph"],
    ["link", "See [the docs](https://example.com/x).", "paragraph"],
    [
      "relative link",
      "See [log](./attachments/att_7d2a-log.txt).",
      "paragraph",
    ],
    ["image", "![Failure state](./attachments/att_8e31.png)", "paragraph"],
    ["hard break", "first  \nsecond", "paragraph"],
    ["table", "| a | b |\n| - | - |\n| 1 | 2 |", "table"],
    ["table with no outer walls", "a | b\n- | -\n1 | 2", "table"],
  ];

  it.each(documented)("renders a %s", (_name, source, shapes) => {
    const blocks = parseMarkdown(source);
    expect(blocks.map(shapeOf).join(" ")).toBe(shapes);
  });

  it("keeps a task's own checked state, both ways", () => {
    const [list] = parseMarkdown("- [x] done\n- [ ] not done\n- plain");
    if (list.type !== "list") throw new Error("expected a list");
    expect(list.items.map((item) => [item.task, item.checked])).toEqual([
      [true, true],
      [true, false],
      [false, false],
    ]);
    expect(list.items.map((item) => textOf(item.children))).toEqual([
      "done",
      "not done",
      "plain",
    ]);
  });

  /**
   * V0-13 added these two. An agent narrating a change writes numbered steps and
   * quotes the error it saw, and both were showing as literal `1.` and `>`.
   */
  it("keeps an ordered list's own starting number", () => {
    const [list] = parseMarkdown("7. seventh\n8. eighth");
    if (list.type !== "list") throw new Error("expected a list");
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(7);
    expect(list.items.map((item) => textOf(item.children))).toEqual([
      "seventh",
      "eighth",
    ]);
  });

  it("does not let a year at the start of a line interrupt a paragraph", () => {
    // CommonMark's rule: only a `1.` may interrupt. Otherwise "…shipped in\n1985.
    // A good year." becomes a list numbered 1985.
    const blocks = parseMarkdown("It shipped in\n1985. A good year.");
    expect(blocks.map(shapeOf)).toEqual(["paragraph"]);
  });

  it("parses a block quote's interior as blocks, not as one string", () => {
    const [quote] = parseMarkdown("> ## Heading\n>\n> - one\n> - two");
    if (quote.type !== "blockquote") throw new Error("expected a blockquote");
    expect(quote.children.map(shapeOf)).toEqual(["heading2", "list"]);
  });

  it("does not read a lazy continuation line into a quote", () => {
    // A `>`-less line ends the quote here. CommonMark would absorb it; the
    // subset would rather under-quote than swallow a line that follows one.
    const blocks = parseMarkdown("> quoted\nnot quoted");
    expect(blocks.map(shapeOf)).toEqual(["blockquote(paragraph)", "paragraph"]);
  });

  it("keeps a fence's interior exactly, spacing and all", () => {
    const [fence] = parseMarkdown("```js\nconst a = '  keep   this  ';\n```");
    if (fence.type !== "codeBlock") throw new Error("expected a fence");
    expect(fence.info).toBe("js");
    expect(fence.value).toBe("const a = '  keep   this  ';");
  });

  it("runs an unclosed fence to the end rather than losing it", () => {
    const [fence] = parseMarkdown("```\nstill code\nand more");
    if (fence.type !== "codeBlock") throw new Error("expected a fence");
    expect(fence.value).toBe("still code\nand more");
  });

  it("does not read markdown inside a code span", () => {
    const [paragraph] = parseMarkdown("Use `**not bold**` here.");
    if (paragraph.type !== "paragraph") throw new Error("expected a paragraph");
    expect(paragraph.children.map((node) => node.type)).toEqual([
      "text",
      "code",
      "text",
    ]);
  });
});

/**
 * The construct LC-179 moved into the subset, and the reason it moved: a table
 * is worth writing because a reader can run their eye down a column, and no
 * amount of kept line structure puts a column on screen. These assert the grid —
 * `MarkdownView.test.tsx` asserts what the DOM makes of it.
 */
describe("the grid a table becomes", () => {
  it("reads the cells of every row, header first", () => {
    const [table] = parseMarkdown(
      "| Time | State |\n| ---- | ----- |\n| 0:00 | four cards |\n| 0:05 | five |",
    );
    expect(gridOf(table)).toEqual([
      ["Time", "State"],
      ["0:00", "four cards"],
      ["0:05", "five"],
    ]);
  });

  it("consumes the delimiter row rather than showing it", () => {
    // The dashes were never content: they said which row was the header, and
    // that is in the block's shape now.
    const [table] = parseMarkdown("| a |\n| - |\n| 1 |");
    expect(shownText(table)).not.toContain("-");
  });

  it("takes the delimiter row's alignments", () => {
    const [table] = parseMarkdown(
      "| l | c | r | n |\n| :-- | :-: | --: | --- |\n| 1 | 2 | 3 | 4 |",
    );
    if (table.type !== "table") throw new Error("expected a table");
    expect(table.alignments).toEqual(["left", "center", "right", null]);
  });

  it("reads a table written without its outer walls", () => {
    // GFM makes them optional, and the delimiter row under one starts with a
    // `- `, which is the shape `interruptsParagraph` would call a bullet.
    const [table] = parseMarkdown("a | b\n- | -\n1 | 2");
    expect(gridOf(table)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps an escaped pipe inside its cell", () => {
    // LC-181: with no table structure there was nothing that could tell a wall
    // from a pipe the author escaped to keep out of one. There is now.
    const [table] = parseMarkdown("| a | b |\n| - | - |\n| x \\| y | z |");
    expect(gridOf(table)[1]).toEqual(["x | y", "z"]);
  });

  it("parses a cell's inlines like any other run of text", () => {
    const [table] = parseMarkdown(
      "| what | where |\n| - | - |\n| `filterTickets` | **[docs](https://example.com/x)** |",
    );
    if (table.type !== "table") throw new Error("expected a table");
    expect(table.rows[0].cells[0].map((node) => node.type)).toEqual(["code"]);
    expect(table.rows[0].cells[1].map((node) => node.type)).toEqual(["strong"]);
  });

  it("squares a ragged table off without dropping a cell", () => {
    // GFM truncates a row that runs past the header. Nothing here may drop text
    // an author typed, so the widest row sets the width and the rest are padded.
    const [table] = parseMarkdown("| a | b |\n| - | - |\n| 1 |\n| 2 | 3 | 4 |");
    expect(gridOf(table)).toEqual([
      ["a", "b", ""],
      ["1", "", ""],
      ["2", "3", "4"],
    ]);
  });

  it("takes the table out of the line that led into it", () => {
    // Nobody leaves a blank line before a table they just announced, and cmark
    // reads the delimiter row the same way: the row above it is the header, and
    // the sentence above that is still a sentence.
    const blocks = parseMarkdown(
      "Here is the recording:\n| a | b |\n| - | - |\n| 1 | 2 |",
    );
    expect(blocks.map(shapeOf)).toEqual(["paragraph", "table"]);
    expect(shownText(blocks[0])).toBe("Here is the recording:");
  });

  it("ends the table where the author stopped writing rows", () => {
    const blocks = parseMarkdown(
      "| a | b |\n| - | - |\n| 1 | 2 |\n## After\nProse.",
    );
    expect(blocks.map(shapeOf)).toEqual(["table", "heading2", "paragraph"]);
  });

  it("reads a table inside a block quote, which is where a comment puts one", () => {
    const quoted = ["| a | b |", "| - | - |", "| 1 | 2 |"]
      .map((row) => `> ${row}`)
      .join("\n");
    const [quote] = parseMarkdown(quoted);
    if (quote.type !== "blockquote") throw new Error("expected a blockquote");
    expect(quote.children.map(shapeOf)).toEqual(["table"]);
  });

  it("still has no node type that could become markup", () => {
    // The security property survives the new node: a cell is `Inline[]`, so the
    // grid is in the tree's shape and never in a string.
    const [table] = parseMarkdown(
      "| a |\n| - |\n| <script>alert(1)</script> |",
    );
    if (table.type !== "table") throw new Error("expected a table");
    expect(table.rows[0].cells[0]).toEqual([
      { type: "text", value: "<script>alert(1)</script>" },
    ]);
  });
});

describe("what happens to everything else", () => {
  /**
   * The rule: not rendered is not the same as not shown. Each of these comes
   * back as the text its author typed, so the preview is legible and the round
   * trip is unaffected.
   */
  const outside: [string, string][] = [
    ["thematic break", "---"],
    ["setext heading", "Title\n====="],
    ["raw HTML", "<img src=x onerror=alert(1)>"],
    ["HTML comment", "<!-- longclaw:item=ck_7d2a -->"],
    ["a script tag", "<script>alert(1)</script>"],
  ];

  it.each(outside)("shows a %s as its own text", (_name, source) => {
    const blocks = parseMarkdown(source);
    expect(blocks).not.toHaveLength(0);
    const shown = blocks.map(shownText).join("\n");
    // Every non-blank line the author wrote is still on screen.
    for (const line of source.split("\n")) {
      expect(shown).toContain(line.trim());
    }
  });

  it("has no node type that could become markup", () => {
    // The security property as a type: `Block`/`Inline` carry no `html` member,
    // so `MarkdownView` has no branch that could produce one.
    const types = parseMarkdown("<b>x</b>\n\n<!-- y -->").map(
      (block) => block.type,
    );
    expect(types).toEqual(["paragraph", "paragraph"]);
  });

  it("does not read a thematic break or a setext underline as a table", () => {
    // Neither line holds a pipe, so neither can be read as a delimiter row and
    // both stay the paragraph text they were.
    const blocks = parseMarkdown("Title\n-----\n\n---");
    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "paragraph",
    ]);
  });

  it("leaves prose containing loose asterisks and underscores alone", () => {
    // `created_at` and `updated_at` in one sentence must not go italic, which is
    // why `_` is not an emphasis delimiter here at all.
    const [paragraph] = parseMarkdown(
      "Compare created_at with updated_at, then 2 * 3 * 4.",
    );
    if (paragraph.type !== "paragraph") throw new Error("expected a paragraph");
    expect(paragraph.children).toEqual([
      {
        type: "text",
        value: "Compare created_at with updated_at, then 2 * 3 * 4.",
      },
    ]);
  });
});

describe("which destinations become an anchor", () => {
  it.each([
    ["https://example.com/x", "https://example.com/x"],
    ["http://example.com", "http://example.com"],
    ["mailto:sachin@example.com", "mailto:sachin@example.com"],
  ])("follows %s", (destination, expected) => {
    expect(linkHref(destination)).toBe(expected);
  });

  it.each([
    ["javascript:alert(1)", "the obvious one"],
    ["JaVaScRiPt:alert(1)", "case does not help"],
    ["java\tscript:alert(1)", "nor does a control character"],
    ["data:text/html;base64,PHNjcmlwdD4=", "nor a data URL"],
    ["./attachments/att_7d2a-log.txt", "v0 has no attachment UI (ADR 0005)"],
    ["//evil.example", "protocol-relative resolves against tauri://"],
    ["", "nothing to follow"],
  ])("refuses %s — %s", (destination) => {
    expect(linkHref(destination)).toBeUndefined();
  });

  it("keeps a refused link's own markdown on screen", () => {
    const [paragraph] = parseMarkdown(
      "See [the log](./attachments/att_7d2a-log.txt) for detail.",
    );
    if (paragraph.type !== "paragraph") throw new Error("expected a paragraph");
    expect(paragraph.children.some((node) => node.type === "link")).toBe(false);
    expect(textOf(paragraph.children)).toBe(
      "See [the log](./attachments/att_7d2a-log.txt) for detail.",
    );
  });

  it("does not take a link's title into the href", () => {
    const [paragraph] = parseMarkdown('[x](https://example.com "a title")');
    if (paragraph.type !== "paragraph") throw new Error("expected a paragraph");
    expect(paragraph.children).toEqual([
      {
        type: "link",
        href: "https://example.com",
        children: [{ type: "text", value: "x" }],
      },
    ]);
  });
});
