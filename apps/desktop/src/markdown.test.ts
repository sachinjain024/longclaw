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
  return textOf(block.children);
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

describe("what happens to everything else", () => {
  /**
   * The rule: not rendered is not the same as not shown. Each of these comes
   * back as the text its author typed, so the preview is legible and the round
   * trip is unaffected.
   */
  const outside: [string, string][] = [
    ["thematic break", "---"],
    ["setext heading", "Title\n====="],
    ["table", "| a | b |\n| - | - |"],
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

  /**
   * A table is the one unsupported construct that is more than one line, so it
   * is the one whose fallback has to carry line structure. A `\n` left inside a
   * text node is not line structure: the webview collapses it (LC-179), which
   * is why the claim below is about `break` nodes and `MarkdownView.test.tsx`
   * makes it again in lines on screen.
   */
  it("separates a table's rows with breaks rather than a bare newline", () => {
    const rows = [
      "| Time | State |",
      "| ---- | ----- |",
      "| 0:00 | four cards |",
      "| 0:05 | five cards |",
    ];
    const [paragraph] = parseMarkdown(rows.join("\n"));
    if (paragraph.type !== "paragraph") throw new Error("expected a paragraph");
    expect(
      paragraph.children.filter((node) => node.type === "break"),
    ).toHaveLength(rows.length - 1);
    // The failure this replaces: every row present, every `\n` still inside a
    // text node, and one line on screen.
    expect(
      paragraph.children.filter(
        (node) => node.type === "text" && node.value.includes("\n"),
      ),
    ).toEqual([]);
  });

  it("takes the table out of the line that led into it", () => {
    // Nobody leaves a blank line before a table they just announced, and cmark
    // reads the delimiter row the same way: the row above it is the header, and
    // the sentence above that is still a sentence.
    const blocks = parseMarkdown(
      "Here is the recording:\n| a | b |\n| - | - |\n| 1 | 2 |",
    );
    expect(blocks.map(shownText)).toEqual([
      "Here is the recording:",
      "| a | b |\n| - | - |\n| 1 | 2 |",
    ]);
  });

  it("ends the table where the author stopped writing rows", () => {
    const blocks = parseMarkdown(
      "| a | b |\n| - | - |\n| 1 | 2 |\n## After\nProse.",
    );
    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "paragraph",
    ]);
  });

  it("leaves a thematic break and a setext underline out of it", () => {
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
