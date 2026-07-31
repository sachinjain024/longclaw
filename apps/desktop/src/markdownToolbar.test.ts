/**
 * The six buttons, and the property that matters more than any of them.
 *
 * V0-12's second must-pass is "no reformatting of content the user did not
 * touch". A formatting button is where an editor is most tempted to break that,
 * so the last block here takes every action over deliberately non-canonical
 * markdown and asserts that everything outside the touched region is
 * byte-identical.
 */

import { describe, expect, it } from "vitest";
import type { ToolbarAction } from "./markdownToolbar";
import { applyToolbarAction, TOOLBAR_ACTIONS } from "./markdownToolbar";

/** `|` marks a caret, `[` and `]` a selection. Easier to read than indices. */
function at(marked: string) {
  const start = marked.indexOf("[");
  if (start === -1) {
    const caret = marked.indexOf("|");
    const value = marked.replace("|", "");
    return { value, start: caret, end: caret };
  }
  const end = marked.indexOf("]") - 1;
  return { value: marked.replace("[", "").replace("]", ""), start, end };
}

describe("the six buttons", () => {
  it("is exactly six, named and in the specified order", () => {
    expect(TOOLBAR_ACTIONS.map((action) => action.id)).toEqual([
      "bold",
      "italic",
      "code",
      "list",
      "task",
      "link",
    ]);
    expect(TOOLBAR_ACTIONS.every((action) => action.label.length > 0)).toBe(
      true,
    );
  });

  it.each([
    ["bold", "alpha [beta] gamma", "alpha **beta** gamma"],
    ["italic", "alpha [beta] gamma", "alpha *beta* gamma"],
    ["code", "alpha [beta] gamma", "alpha `beta` gamma"],
    ["list", "alpha [beta] gamma", "- alpha beta gamma"],
    ["task", "alpha [beta] gamma", "- [ ] alpha beta gamma"],
    ["link", "alpha [beta] gamma", "alpha [beta](url) gamma"],
  ])("%s wraps or prefixes the selection", (action, marked, expected) => {
    expect(applyToolbarAction(action as ToolbarAction, at(marked)).value).toBe(
      expected,
    );
  });

  it("puts the caret between the delimiters when nothing is selected", () => {
    const next = applyToolbarAction("bold", at("alpha |gamma"));
    expect(next.value).toBe("alpha ****gamma");
    expect([next.start, next.end]).toEqual([8, 8]);
  });

  it("selects what it wrapped, so the next button nests correctly", () => {
    const bold = applyToolbarAction("bold", at("alpha [beta] gamma"));
    expect(bold.value.slice(bold.start, bold.end)).toBe("beta");
    const italic = applyToolbarAction("italic", bold);
    expect(italic.value).toBe("alpha ***beta*** gamma");
  });

  it("takes its own delimiters back off when pressed twice", () => {
    const once = applyToolbarAction("bold", at("alpha [beta] gamma"));
    const twice = applyToolbarAction("bold", {
      ...once,
      start: once.start - 2,
      end: once.end + 2,
    });
    expect(twice.value).toBe("alpha beta gamma");
  });

  it("does not let italic quietly demote bold", () => {
    // Selecting `**beta**` and pressing italic adds italic; it must not strip
    // one asterisk from each side and turn the bold into emphasis.
    const value = "alpha **beta** gamma";
    const next = applyToolbarAction("italic", { value, start: 6, end: 14 });
    expect(next.value).toBe("alpha ***beta*** gamma");
  });

  it("prefixes every line the selection touches, and no others", () => {
    const value = "first\nsecond\nthird\nfourth";
    // A selection from inside "second" to inside "third".
    const next = applyToolbarAction("list", { value, start: 8, end: 15 });
    expect(next.value).toBe("first\n- second\n- third\nfourth");
  });

  it("does not drag in the line after a selection that ends on a break", () => {
    const value = "first\nsecond\nthird";
    const next = applyToolbarAction("task", { value, start: 0, end: 6 });
    expect(next.value).toBe("- [ ] first\nsecond\nthird");
  });

  it("takes the prefix off when every touched line already has it", () => {
    const value = "- first\n- second\nthird";
    const next = applyToolbarAction("list", { value, start: 0, end: 16 });
    expect(next.value).toBe("first\nsecond\nthird");
  });

  it("selects the destination of a new link, because that is what is typed next", () => {
    const next = applyToolbarAction("link", at("see [the docs] now"));
    expect(next.value).toBe("see [the docs](url) now");
    expect(next.value.slice(next.start, next.end)).toBe("url");
  });
});

/**
 * Markdown a careless editor would tidy: three bullet markers in one list, a
 * setext heading, a four-space indent, trailing whitespace, a tab, and a fence
 * whose interior spacing is load-bearing.
 */
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

describe("must-pass 2: nothing outside the touched region moves", () => {
  // The word "quote" in "> a block quote", nowhere near anything canonical.
  const start = NON_CANONICAL.indexOf("quote");
  const end = start + "quote".length;

  it.each(TOOLBAR_ACTIONS.map((action) => action.id))(
    "%s leaves every other byte identical",
    (action) => {
      const next = applyToolbarAction(action, {
        value: NON_CANONICAL,
        start,
        end,
      });

      // The region an action is allowed to have touched: the selection for a
      // wrap or a link, the whole line for a prefix.
      const lineStart = NON_CANONICAL.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = NON_CANONICAL.indexOf("\n", end);
      const before = NON_CANONICAL.slice(0, lineStart);
      const after = NON_CANONICAL.slice(lineEnd);

      expect(next.value.slice(0, lineStart)).toBe(before);
      expect(next.value.slice(next.value.length - after.length)).toBe(after);
      // And within the touched line, the action only inserted: every character
      // the human had written is still there, in the order they wrote it.
      const original = NON_CANONICAL.slice(lineStart, lineEnd);
      const touched = next.value.slice(
        lineStart,
        next.value.length - after.length,
      );
      expect(isSubsequence(original, touched)).toBe(true);
    },
  );
});

function isSubsequence(needle: string, haystack: string): boolean {
  let matched = 0;
  for (const char of haystack) {
    if (char === needle[matched]) matched += 1;
  }
  return matched === needle.length;
}
