/**
 * What the six formatting buttons do to a selection
 * (`keyboard-focus-map.md:84`), as string in, string out.
 *
 * This is a separate module from the editor because the claim it has to carry is
 * a property, not an interaction: **a toolbar action changes the selection and
 * its own delimiters and nothing else.** V0-12's must-pass says a user who edits
 * one word produces a diff of one word, and a formatting button is the one place
 * an editor is tempted to reflow, re-indent, or canonicalize the rest of the
 * document on the way past. Nothing here looks at a byte it is not about to
 * move.
 */

export type ToolbarAction =
  "bold" | "italic" | "code" | "list" | "task" | "link";

export interface TextSelection {
  value: string;
  start: number;
  end: number;
}

/** The six, in the order `screen-specs.md:179-180` lists them. */
export const TOOLBAR_ACTIONS: {
  id: ToolbarAction;
  /** The accessible name. An icon alone is not a name. */
  label: string;
  glyph: string;
}[] = [
  { id: "bold", label: "Bold", glyph: "B" },
  { id: "italic", label: "Italic", glyph: "I" },
  { id: "code", label: "Code", glyph: "`" },
  { id: "list", label: "Bulleted list", glyph: "•" },
  { id: "task", label: "Task list", glyph: "☑" },
  { id: "link", label: "Link", glyph: "↗" },
];

const WRAPPERS: Record<"bold" | "italic" | "code", string> = {
  bold: "**",
  italic: "*",
  code: "`",
};

const PREFIXES: Record<"list" | "task", string> = {
  list: "- ",
  task: "- [ ] ",
};

export function applyToolbarAction(
  action: ToolbarAction,
  selection: TextSelection,
): TextSelection {
  if (action === "list" || action === "task") {
    return prefixLines(selection, PREFIXES[action]);
  }
  if (action === "link") return insertLink(selection);
  return wrap(selection, WRAPPERS[action]);
}

/**
 * Wraps, or unwraps when the selection is already exactly what this button
 * writes — so a mis-click is one press to take back rather than a nest.
 */
function wrap(selection: TextSelection, delimiter: string): TextSelection {
  const { value, start, end } = selection;
  const selected = value.slice(start, end);
  const width = delimiter.length;
  const alreadyWrapped =
    selected.length >= width * 2 &&
    selected.startsWith(delimiter) &&
    selected.endsWith(delimiter) &&
    // `*` must not unwrap the inner half of a `**`: pressing italic on bold text
    // adds italic, it does not quietly demote it.
    !(delimiter === "*" && selected.startsWith("**"));
  if (alreadyWrapped) {
    const inner = selected.slice(width, -width);
    return {
      value: value.slice(0, start) + inner + value.slice(end),
      start,
      end: start + inner.length,
    };
  }
  return {
    value:
      value.slice(0, start) +
      delimiter +
      selected +
      delimiter +
      value.slice(end),
    start: start + width,
    end: end + width,
  };
}

/**
 * Prefixes every line the selection touches, or takes the prefix off when they
 * all already carry it. Only whole lines inside the touched region move; the
 * caret keeps its place within them.
 */
function prefixLines(selection: TextSelection, prefix: string): TextSelection {
  const { value, start, end } = selection;
  const from = value.lastIndexOf("\n", start - 1) + 1;
  // A selection that ends on a line break has not touched the line after it.
  const searchFrom = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const lineEnd = value.indexOf("\n", searchFrom);
  const to = lineEnd === -1 ? value.length : lineEnd;

  const lines = value.slice(from, to).split("\n");
  const remove = lines.every(
    (line) => line.trim() === "" || line.startsWith(prefix),
  );
  const rewritten = lines.map((line) => {
    if (remove)
      return line.startsWith(prefix) ? line.slice(prefix.length) : line;
    return prefix + line;
  });
  const step = remove ? -prefix.length : prefix.length;
  const moved = rewritten.filter((line, index) => line !== lines[index]).length;
  const firstMoved = rewritten[0] !== lines[0] ? step : 0;

  return {
    value: value.slice(0, from) + rewritten.join("\n") + value.slice(to),
    start: Math.max(from, start + firstMoved),
    end: Math.max(from, end + step * moved),
  };
}

/**
 * `[text](url)` with the destination selected, because that is what has to be
 * typed next. An empty selection gets a placeholder rather than an empty label.
 */
function insertLink(selection: TextSelection): TextSelection {
  const { value, start, end } = selection;
  const selected = value.slice(start, end);
  const text = selected === "" ? "text" : selected;
  const destination = "url";
  const inserted = `[${text}](${destination})`;
  const destinationStart = start + text.length + 3;
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    start: destinationStart,
    end: destinationStart + destination.length,
  };
}
