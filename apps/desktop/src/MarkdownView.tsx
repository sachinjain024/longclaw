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
import type { Inline } from "./markdown";
import { parseMarkdown } from "./markdown";

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
  const offset = props.headingOffset ?? 0;
  return (
    <div className={props.className ?? "markdown"}>
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
        if (block.type === "list") {
          return (
            <ul key={key} className="markdown-list">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className={item.task ? "markdown-task" : undefined}
                >
                  {item.task && (
                    <input
                      type="checkbox"
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
            </ul>
          );
        }
        return (
          <p key={key}>
            <InlineNodes nodes={block.children} />
          </p>
        );
      })}
    </div>
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
