/**
 * What a human gets when a ticket file will not parse: the file itself, the
 * line that broke it, and the two ways out (`screen-specs.md:291-298`,
 * `states.md:95-104`).
 *
 * The design rule underneath it is `states.md:9-12` — never silent. Four of the
 * five parts here exist because a version of this screen without them left a
 * person with a sentence of prose and no way to act on it: the path so they know
 * which of many `ticket.md` files it is (D-58), the `file:line` so the raw
 * content has a point (D-52), the numbered gutter so the line can be found
 * (D-53), and the footer so recovery is not "wait for the watcher" (D-54).
 *
 * It renders inside the panel rather than as the 680px modal the spec draws;
 * that half is LC-134 and is deliberately not touched here.
 */

import type { TicketDetail } from "./types";
import { WarnGlyph } from "./WarnGlyph";

/**
 * The reassurance, which is the *body* rather than the heading (D-58): a person
 * looking at a broken file wants to know which file first, and that nothing was
 * rewritten second.
 */
function reassurance(detail: TicketDetail): string {
  if (detail.readOnly) {
    return "Newer format, shown read-only. This ticket was written by a newer LongClaw format. The file is shown exactly as it exists on disk, and this build will not rewrite it.";
  }
  return "Shown without repair. The file is shown exactly as it exists on disk — LongClaw never rewrites or discards content it cannot parse. Fix it in an editor, then Retry parse or wait for the watcher to read it again.";
}

/**
 * The parse error as the banner shows it: `ticket.md:7 — …`.
 *
 * The file name rather than the whole path, because the heading above already
 * carries the path, and the pair is the prototype's (`prototype.js:1917`). A
 * diagnostic with no line still shows its message — a parser that could not
 * place the fault says less, not nothing.
 */
function errorText(detail: TicketDetail): string | undefined {
  const message = detail.diagnostic?.message;
  const line = detail.diagnostic?.line;
  if (!message) return undefined;
  if (line === undefined) return message;
  const fileName = detail.relativePath.split("/").pop() ?? detail.relativePath;
  return `${fileName}:${line} — ${message}`;
}

/**
 * The file, one row per line, numbered.
 *
 * The gutter is `aria-hidden`: a screen reader reading "one two three" down the
 * side of a file is noise, and the line that matters is named in the banner
 * above in words. An empty line still renders a row, because a gutter that
 * skipped one would number every line after it wrongly.
 */
function RawLines(props: { raw: string; offending?: number }) {
  return (
    <pre className="raw-file">
      {props.raw.split("\n").map((text, index) => {
        const number = index + 1;
        return (
          <span
            key={number}
            className={
              number === props.offending ? "raw-line offending" : "raw-line"
            }
          >
            <span className="raw-line-number" aria-hidden="true">
              {number}
            </span>
            <span className="raw-line-text">{text || " "}</span>
          </span>
        );
      })}
    </pre>
  );
}

export function RawFileView(props: {
  detail: TicketDetail;
  /** Whether a retry is in flight, so the button cannot be pressed twice. */
  retrying: boolean;
  onRetry: () => void;
  onOpenInEditor: () => void;
}) {
  const { detail } = props;
  const error = errorText(detail);
  return (
    <section
      className="raw-file-view"
      aria-label={`Raw file ${detail.relativePath}`}
    >
      <h3 className="raw-file-path">
        <WarnGlyph size={15} />
        {detail.relativePath}
      </h3>

      {error && (
        <p className="raw-file-error" role="alert">
          <WarnGlyph />
          <span>{error}</span>
        </p>
      )}

      <RawLines raw={detail.raw} offending={detail.diagnostic?.line} />

      <div className="raw-file-foot">
        <p className="raw-file-note">
          {reassurance(detail)}
          {/* Without this the note above is simply untrue for a large file,
              and the numbers in the gutter stop meaning what they say. */}
          {detail.rawTruncated &&
            " This file is too large to show whole; only its first part is here."}
        </p>
        <div className="toolbar-actions">
          <button
            tabIndex={0}
            className="ghost"
            onClick={props.onOpenInEditor}
            title={detail.relativePath}
          >
            Open in editor
          </button>
          {/* A newer format is not a fault to fix, so there is nothing for a
              retry to find — the same distinction `Diagnostic::is_read_only`
              draws in Rust. Offering one would be a button that can only ever
              return the same answer. */}
          {!detail.readOnly && (
            <button
              tabIndex={0}
              className="secondary"
              disabled={props.retrying}
              onClick={props.onRetry}
            >
              Retry parse
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
