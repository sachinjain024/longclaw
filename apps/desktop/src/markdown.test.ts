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
  return textOf(block.children);
}

function shapeOf(block: Block): string {
  if (block.type === "heading") return `heading${block.level}`;
  if (block.type === "list") {
    return block.items.every((item) => item.task) ? "tasks" : "list";
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
    ["ordered list", "1. first\n2. second"],
    ["block quote", "> quoted"],
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
