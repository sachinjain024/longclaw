/**
 * The markdown tree, rendered as React elements.
 *
 * There is no `dangerouslySetInnerHTML` here and there must never be one. A
 * ticket description is written by external agents and by anyone editing the
 * file, and this is a webview with IPC to the filesystem — so HTML in a
 * description stays text, structurally, because the renderer has no branch that
 * could turn it into anything else.
 *
 * The subset and its fallbacks are `markdown.ts`. This file only decides what
 * each node looks like.
 */

import { useMemo } from "react";
import type { Block, ColumnAlignment, Inline, TableRow } from "./markdown";
import { parseMarkdown } from "./markdown";

/**
 * The delimiter row's colons, as the one class that carries them.
 *
 * Named rather than built from the value, so the three classes `styles.css`
 * defines are the three a search for them finds.
 */
const ALIGNMENT_CLASS: Record<NonNullable<ColumnAlignment>, string> = {
  left: "markdown-table-left",
  center: "markdown-table-center",
  right: "markdown-table-right",
};

interface MarkdownViewProps {
  source: string;
  /**
   * How deep in the surrounding outline this block sits, so a `#` the author
   * wrote becomes the next heading down rather than a second `<h1>`. The panel's
   * sections are `<h3>`, so they pass 3.
   */
  headingOffset?: number;
  className?: string;
}

export function MarkdownView(props: MarkdownViewProps) {
  const blocks = useMemo(() => parseMarkdown(props.source), [props.source]);
  return (
    <div className={props.className ?? "markdown"}>
      <Blocks blocks={blocks} offset={props.headingOffset ?? 0} />
    </div>
  );
}

/** Recursive, because a block quote's interior is blocks like any other. */
function Blocks({ blocks, offset }: { blocks: Block[]; offset: number }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          const level = Math.min(block.level + offset, 6);
          const Heading = `h${level}` as "h1";
          return (
            <Heading key={key}>
              <InlineNodes nodes={block.children} />
            </Heading>
          );
        }
        if (block.type === "codeBlock") {
          return (
            <pre key={key} className="markdown-code">
              <code>{block.value}</code>
            </pre>
          );
        }
        if (block.type === "blockquote") {
          return (
            <blockquote key={key} className="markdown-quote">
              <Blocks blocks={block.children} offset={offset} />
            </blockquote>
          );
        }
        if (block.type === "list") {
          // `<ol>` carries the author's own first number, so a list that starts
          // at 7 is not silently renumbered to 1.
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={key}
              className="markdown-list"
              start={block.ordered ? block.start : undefined}
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className={item.task ? "markdown-task" : undefined}
                >
                  {item.task && (
                    <input
                      type="checkbox"
                      // Never a stop: a task inside rendered Markdown is a
                      // picture of a box, not a control — the checklist is
                      // where one is ticked. Stated rather than left to
                      // `disabled` (`tab-order-guard.mjs`).
                      tabIndex={-1}
                      checked={item.checked}
                      disabled
                      readOnly
                    />
                  )}
                  <span>
                    <InlineNodes nodes={item.children} />
                  </span>
                </li>
              ))}
            </List>
          );
        }
        if (block.type === "table") {
          // A real `<table>`, because the grid is the content: a row of `<td>`s
          // is what puts a column under a heading, and `<th scope="col">` is
          // what tells a screen reader which heading a cell sits under — the
          // half of "scan down a column" that has nothing to do with sight.
          // Nothing in here is a tab stop, so `keyboard-focus-map.md` is
          // unchanged by a description that holds one.
          return (
            <table key={key} className="markdown-table">
              <thead>
                <Cells
                  row={block.header}
                  alignments={block.alignments}
                  as="th"
                />
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <Cells
                    key={rowIndex}
                    row={row}
                    alignments={block.alignments}
                    as="td"
                  />
                ))}
              </tbody>
            </table>
          );
        }
        return (
          <p key={key}>
            <InlineNodes nodes={block.children} />
          </p>
        );
      })}
    </>
  );
}

/**
 * One `<tr>`. `readTable` has already squared the block off, so the cells and
 * the alignments line up by index and neither side can run out first.
 */
function Cells({
  row,
  alignments,
  as,
}: {
  row: TableRow;
  alignments: ColumnAlignment[];
  as: "th" | "td";
}) {
  const Cell = as;
  return (
    <tr>
      {row.cells.map((cell, index) => {
        const alignment = alignments[index];
        return (
          <Cell
            key={index}
            scope={as === "th" ? "col" : undefined}
            className={alignment ? ALIGNMENT_CLASS[alignment] : undefined}
          >
            <InlineNodes nodes={cell} />
          </Cell>
        );
      })}
    </tr>
  );
}

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.type}-${index}`;
        switch (node.type) {
          case "text":
            return <span key={key}>{node.value}</span>;
          case "break":
            return <br key={key} />;
          case "code":
            return <code key={key}>{node.value}</code>;
          case "strong":
            return (
              <strong key={key}>
                <InlineNodes nodes={node.children} />
              </strong>
            );
          case "emphasis":
            return (
              <em key={key}>
                <InlineNodes nodes={node.children} />
              </em>
            );
          case "link":
            // `linkHref` has already refused everything but http, https, and
            // mailto. The new-window hint is belt and braces: the app must not
            // navigate away from itself.
            return (
              <a
                key={key}
                href={node.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                <InlineNodes nodes={node.children} />
              </a>
            );
        }
      })}
    </>
  );
}
