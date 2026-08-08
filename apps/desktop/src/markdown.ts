/**
 * A CommonMark subset, parsed into a tree the app renders as React elements.
 *
 * Two rules decide everything here.
 *
 * **Nothing this produces may become live DOM.** Descriptions and comment bodies
 * are written by external agents and by anyone with the file open, and this runs
 * in a webview holding IPC to the filesystem. So there is no `html` node in the
 * union below, and raw HTML is text — the security property stated as a type.
 * Rendering an AST to elements is also why the app carries no sanitizer: there
 * is nothing to sanitize, because no node type can produce markup.
 *
 * **The subset is what `docs/file_format.md` documents for a ticket body**
 * (`:147` — "ordinary CommonMark apart from three reserved sections") plus what
 * the six-button toolbar writes: ATX headings, fenced code, bullet and task
 * lists, paragraphs, strong, emphasis, code spans, links, hard line breaks.
 *
 * V0-13 added ordered lists and block quotes, which V0-12 left out only because
 * `file_format.md` happens to show neither. A timeline comment is where that
 * stopped being academic: an agent narrating a change writes numbered steps and
 * quotes the error it saw, and both were rendering as literal `1.` and `>`.
 *
 * Everything else — thematic breaks, setext headings, tables, raw HTML, HTML
 * comments — is neither dropped nor executed. It comes back out as the paragraph
 * text its author typed. The editor never writes this tree back to disk, so an
 * unsupported construct is a rendering gap and can never be data loss.
 *
 * A table is the only one of those that is more than one line, and "the text its
 * author typed" has to mean the lines they typed or it means nothing: a soft
 * newline is a space on screen, so a nine-row table was arriving as one run-on
 * paragraph with the delimiter row inline in the middle of it (LC-179). So
 * `readTable` recognises the construct only far enough to keep its rows apart.
 * Rendering an actual `<table>` stays out of the subset — see
 * `docs/plans/completed/18-markdown-editor.md`.
 */

export interface TextNode {
  type: "text";
  value: string;
}

/** A hard line break: two trailing spaces, or a trailing backslash. */
export interface BreakNode {
  type: "break";
}

export interface CodeSpanNode {
  type: "code";
  value: string;
}

export interface StrongNode {
  type: "strong";
  children: Inline[];
}

export interface EmphasisNode {
  type: "emphasis";
  children: Inline[];
}

/** Only ever carries an `http`, `https`, or `mailto` destination. See `linkHref`. */
export interface LinkNode {
  type: "link";
  href: string;
  children: Inline[];
}

export type Inline =
  TextNode | BreakNode | CodeSpanNode | StrongNode | EmphasisNode | LinkNode;

export interface HeadingBlock {
  type: "heading";
  /** 1–6, as written. The renderer decides what that is in its own outline. */
  level: number;
  children: Inline[];
}

export interface ParagraphBlock {
  type: "paragraph";
  children: Inline[];
}

export interface CodeBlock {
  type: "codeBlock";
  /** The fence's info string, kept so a future highlighter has it. */
  info: string;
  value: string;
}

export interface ListItem {
  task: boolean;
  checked: boolean;
  children: Inline[];
}

export interface ListBlock {
  type: "list";
  items: ListItem[];
  /** True for `1.` / `1)` markers. The renderer picks `<ol>` or `<ul>` from it. */
  ordered: boolean;
  /** The first marker's own number, so a list starting at 7 still starts at 7. */
  start?: number;
}

/** Quoted blocks, parsed the same way: a quote may hold a list or a fence. */
export interface BlockquoteBlock {
  type: "blockquote";
  children: Block[];
}

export type Block =
  HeadingBlock | ParagraphBlock | CodeBlock | ListBlock | BlockquoteBlock;

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const BULLET = /^ {0,3}[-*+][ \t]+(.*)$/;
const ORDERED = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const TASK = /^\[([ xX])\][ \t]+(.*)$/;
/**
 * A GFM delimiter row — `| --- |`, `|:---|---:|`. It is what tells a table from
 * two lines of prose that happen to hold a pipe, and requiring a pipe in it is
 * what keeps `---` a thematic break and `Title\n-----` a setext heading, both of
 * which stay their own paragraph text.
 */
const TABLE_DELIMITER =
  /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const CLOSING_HASHES = /[ \t]+#+$/;
const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/** Destinations the app is willing to turn into a navigable anchor. */
const SAFE_SCHEME = /^(?:https?|mailto):/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function parseMarkdown(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      index = readFence(lines, index, fence, blocks);
      continue;
    }
    const atx = ATX.exec(line);
    if (atx) {
      const text = (atx[2] ?? "").replace(CLOSING_HASHES, "");
      blocks.push({
        type: "heading",
        level: atx[1].length,
        children: parseInline(text),
      });
      index += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      index = readQuote(lines, index, blocks);
      continue;
    }
    if (BULLET.test(line) || ORDERED.test(line)) {
      index = readList(lines, index, blocks);
      continue;
    }
    index = startsTable(lines, index)
      ? readTable(lines, index, blocks)
      : readParagraph(lines, index, blocks);
  }
  return blocks;
}

/** An unclosed fence runs to the end of the input, as CommonMark says it does. */
function readFence(
  lines: string[],
  start: number,
  open: RegExpExecArray,
  blocks: Block[],
): number {
  const marker = open[1];
  const closing = new RegExp(`^ {0,3}\\${marker[0]}{${marker.length},}[ \t]*$`);
  const body: string[] = [];
  let index = start + 1;
  while (index < lines.length) {
    if (closing.test(lines[index])) {
      index += 1;
      break;
    }
    body.push(lines[index]);
    index += 1;
  }
  blocks.push({
    type: "codeBlock",
    info: open[2].trim(),
    value: body.join("\n"),
  });
  return index;
}

/**
 * A run of list lines, flat, all of one kind: a bullet run ends where a numbered
 * one begins and the other way round, so the two never merge into one list. An
 * indented sub-list keeps its own text and its own marker in the item; it is not
 * nested, and nothing is lost.
 */
function readList(lines: string[], start: number, blocks: Block[]): number {
  const ordered = ORDERED.test(lines[start]) && !BULLET.test(lines[start]);
  const marker = ordered ? ORDERED : BULLET;
  /** The ordered marker captures its number first, so the text shifts along. */
  const textGroup = ordered ? 2 : 1;
  const items: ListItem[] = [];
  let index = start;
  let first: string | undefined;
  while (index < lines.length) {
    const item = marker.exec(lines[index]);
    if (!item) break;
    first ??= ordered ? item[1] : undefined;
    const text = item[textGroup];
    const task = TASK.exec(text);
    items.push(
      task
        ? {
            task: true,
            checked: task[1].toLowerCase() === "x",
            children: parseInline(task[2]),
          }
        : { task: false, checked: false, children: parseInline(text) },
    );
    index += 1;
  }
  blocks.push({
    type: "list",
    items,
    ordered,
    ...(first === undefined ? {} : { start: Number(first) }),
  });
  return index;
}

/**
 * A run of `>` lines, with the marker stripped and the interior parsed as blocks
 * — so a quoted list is a list. A line without the marker ends the quote:
 * CommonMark's lazy continuation would absorb it, and under-quoting one line is
 * a smaller lie than quoting a line its author did not mark.
 */
function readQuote(lines: string[], start: number, blocks: Block[]): number {
  const inner: string[] = [];
  let index = start;
  while (index < lines.length) {
    const quote = QUOTE.exec(lines[index]);
    if (!quote) break;
    inner.push(quote[1]);
    index += 1;
  }
  blocks.push({
    type: "blockquote",
    children: parseMarkdown(inner.join("\n")),
  });
  return index;
}

/**
 * The first line is a paragraph line by the time this is called, so it is taken
 * unconditionally — and a table below it ends the run, because nobody puts a
 * blank line between a sentence and the table it announces.
 */
function readParagraph(
  lines: string[],
  start: number,
  blocks: Block[],
): number {
  const body = [lines[start]];
  let index = start + 1;
  while (
    index < lines.length &&
    !interruptsParagraph(lines[index]) &&
    !startsTable(lines, index)
  ) {
    body.push(lines[index]);
    index += 1;
  }
  blocks.push({ type: "paragraph", children: parseInline(body.join("\n")) });
  return index;
}

/** Where a run of prose ends, and a table's run of rows with it. */
function interruptsParagraph(line: string): boolean {
  const numbered = ORDERED.exec(line);
  return (
    line.trim() === "" ||
    FENCE.test(line) ||
    ATX.test(line) ||
    QUOTE.test(line) ||
    BULLET.test(line) ||
    // Only a `1.` may interrupt a paragraph, which is what keeps "shipped in
    // 1985. A good year." prose rather than a list numbered 1985.
    (numbered !== null && Number(numbered[1]) === 1)
  );
}

/** The only mark a row must carry, wherever a row is being recognised. */
function isRow(line: string): boolean {
  return line.includes("|");
}

/** A header row and the delimiter row under it, which is GFM's own test. */
function startsTable(lines: string[], index: number): boolean {
  const delimiter = lines[index + 1];
  if (delimiter === undefined) return false;
  return (
    isRow(lines[index]) && isRow(delimiter) && TABLE_DELIMITER.test(delimiter)
  );
}

/**
 * A table, kept as the block of lines it was typed as and nothing more.
 *
 * There is no `TableBlock` in the union and no `<table>` on screen: the cells go
 * through `parseInline` like any other text, so a code span in one is still a
 * code span, and the pipes stay visible as the boundaries the author drew — an
 * escaped `\|` among them, since nothing here knows a cell from its wall. What
 * this adds over a plain paragraph is a `break` between rows, which is the
 * difference between a table a reader can scan down and one run-on line.
 *
 * The delimiter row is shown too. Hiding it would be rendering half a table, and
 * a reader who sees the dashes can tell the app kept the text rather than
 * understood it.
 */
function readTable(lines: string[], start: number, blocks: Block[]): number {
  // The delimiter row is taken on `startsTable`'s word: a table written without
  // leading pipes has a `- | -` under it, which `interruptsParagraph` would
  // read as a bullet.
  const rows = [lines[start], lines[start + 1]];
  let index = start + 2;
  while (
    index < lines.length &&
    !interruptsParagraph(lines[index]) &&
    isRow(lines[index])
  ) {
    rows.push(lines[index]);
    index += 1;
  }
  const children: Inline[] = [];
  for (const [position, row] of rows.entries()) {
    if (position > 0) children.push({ type: "break" });
    children.push(...parseInline(row));
  }
  blocks.push({ type: "paragraph", children });
  return index;
}

export function parseInline(source: string): Inline[] {
  const nodes: Inline[] = [];
  let text = "";
  let index = 0;

  function flush() {
    if (text !== "") {
      nodes.push({ type: "text", value: text });
      text = "";
    }
  }

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1] ?? "";

    if (char === "\\" && ESCAPABLE.test(next)) {
      text += next;
      index += 2;
      continue;
    }
    if (char === "\\" && next === "\n") {
      flush();
      nodes.push({ type: "break" });
      index += 2;
      continue;
    }
    if (char === "\n") {
      if (/ {2,}$/.test(text)) {
        text = text.replace(/ +$/, "");
        flush();
        nodes.push({ type: "break" });
      } else {
        text += "\n";
      }
      index += 1;
      continue;
    }
    if (char === "`") {
      const run = runLength(source, index, "`");
      const close = findRun(source, index + run, "`", run);
      if (close !== -1) {
        flush();
        nodes.push({ type: "code", value: source.slice(index + run, close) });
        index = close + run;
        continue;
      }
    }
    // An image is link-shaped, so it has to be recognised to be left alone:
    // otherwise its `!` would separate from a link the app would then render.
    if (char === "!" && next === "[") {
      const image = matchLink(source, index + 1);
      if (image) {
        text += source.slice(index, image.end);
        index = image.end;
        continue;
      }
    }
    if (char === "[") {
      const link = matchLink(source, index);
      if (link) {
        const href = linkHref(link.destination);
        if (href === undefined) {
          // A destination the app will not follow keeps its own markdown, so
          // both halves stay on screen and nothing is lost.
          text += source.slice(index, link.end);
        } else {
          flush();
          nodes.push({ type: "link", href, children: parseInline(link.text) });
        }
        index = link.end;
        continue;
      }
    }
    if (char === "*") {
      const run = source.startsWith("**", index) ? 2 : 1;
      const close = findEmphasisClose(source, index + run, run);
      if (close !== -1) {
        flush();
        nodes.push({
          type: run === 2 ? "strong" : "emphasis",
          children: parseInline(source.slice(index + run, close)),
        });
        index = close + run;
        continue;
      }
    }
    text += char;
    index += 1;
  }
  flush();
  return nodes;
}

/**
 * The destination to hang an anchor on, or `undefined` for a link the app
 * renders as its own markdown text instead.
 *
 * Three destinations are refused, each for its own reason. A `javascript:` URL
 * is the obvious one. A relative path points inside the ticket directory, which
 * v0 has no attachment UI to open (ADR 0005) and which the webview would resolve
 * against `tauri://` and navigate the whole app to. A protocol-relative `//host`
 * does the same thing more quietly.
 */
export function linkHref(destination: string): string | undefined {
  // Control characters and spaces go before the scheme is read, so a tab
  // inside `java<tab>script:` cannot smuggle a scheme past the test below.
  const href = Array.from(destination)
    .filter((char) => char.charCodeAt(0) > 0x20)
    .join("");
  if (href === "" || href.startsWith("//")) return undefined;
  if (!ANY_SCHEME.test(href)) return undefined;
  return SAFE_SCHEME.test(href) ? href : undefined;
}

function runLength(source: string, start: number, char: string): number {
  let end = start;
  while (source[end] === char) end += 1;
  return end - start;
}

/** The next run of exactly `length` backticks, as CommonMark closes a code span. */
function findRun(
  source: string,
  from: number,
  char: string,
  length: number,
): number {
  let index = from;
  while (index < source.length) {
    if (source[index] !== char) {
      index += 1;
      continue;
    }
    const here = runLength(source, index, char);
    if (here === length) return index;
    index += here;
  }
  return -1;
}

/**
 * Enough of CommonMark's flanking rule to stop prose becoming emphasis: an
 * opener is not followed by a space and a closer is not preceded by one, so
 * `2 * 3 * 4` stays arithmetic.
 */
function findEmphasisClose(source: string, from: number, run: number): number {
  const opener = source[from];
  if (opener === undefined || /\s/.test(opener)) return -1;
  let index = from;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === "*") {
      const here = runLength(source, index, "*");
      if (here >= run && !/\s/.test(source[index - 1] ?? " ")) return index;
      index += here;
      continue;
    }
    index += 1;
  }
  return -1;
}

interface LinkMatch {
  text: string;
  destination: string;
  /** One past the closing paren. */
  end: number;
}

function matchLink(source: string, start: number): LinkMatch | undefined {
  let depth = 0;
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) break;
    }
    index += 1;
  }
  if (depth !== 0 || index >= source.length) return undefined;
  if (source[index + 1] !== "(") return undefined;
  const close = source.indexOf(")", index + 2);
  if (close === -1) return undefined;
  // `[text](url "title")` — the title is not rendered, but it must not end up in
  // the href either.
  const inside = source.slice(index + 2, close).trim();
  return {
    text: source.slice(start + 1, index),
    destination: inside.split(/\s/, 1)[0] ?? "",
    end: close + 1,
  };
}
