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
 * It is a modal, which is the sixth (D-51, LC-134). The spec draws one — 680px,
 * over everything — and the panel it used to render in is 560px of a surface
 * built to *edit* a ticket: it carried a title field, a meta grid and an archive
 * button for a file with no ticket in it, and it left the file competing for
 * width with a board it does not belong to. A modal is also the only shape that
 * cannot be painted through, which is the half of D-51 that `--lc-z-panel`
 * already fixed and that this makes structural rather than a number.
 */

import { useEffect, useRef } from "react";
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
 *
 * The block is a tab stop of its own. It is the modal's scroller, and page keys
 * scroll what focus is inside (`keyboard-focus-map.md:141-142` — "scrolls with
 * the page keys"); with the buttons as the only stops, a long file could be
 * read by pointer and not by keyboard.
 */
function RawLines(props: { raw: string; offending?: number }) {
  return (
    <pre className="raw-file" tabIndex={0} aria-label="File content">
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
  /** The file as it was read. Absent while the read is still out. */
  detail?: TicketDetail;
  /** What the modal is about before the file arrives: the directory's name. */
  ticketKey: string;
  /**
   * The project's root as the header shows it — tilde-abbreviated, not
   * canonical. The heading is the *full* path (`screen-specs.md:293`), and the
   * relative path a `TicketDetail` carries is only the half of it below the
   * project. This is the screen a person reads just before opening the file
   * somewhere else, so the half that says *which* project belongs on it.
   */
  projectPath: string;
  /** Whether a retry is in flight, so the button cannot be pressed twice. */
  retrying: boolean;
  onRetry: () => void;
  onOpenInEditor: () => void;
  onClose: () => void;
}) {
  const { detail } = props;
  const error = detail && errorText(detail);
  const fullPath = detail
    ? `${props.projectPath}/${detail.relativePath}`
    : props.ticketKey;

  const dialog = useRef<HTMLElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  /**
   * `Retry parse` takes focus when the view opens
   * (`keyboard-focus-map.md:141-142`), and `Close` takes it on a newer-format
   * file, which offers no retry — a modal that opened with focus still on the
   * card behind it would be a layer the keyboard is not in.
   *
   * Once, deliberately. A retry that fails re-renders this same view, and
   * stealing focus back each time would fight a human who had tabbed on to
   * `Open in editor` — which, on a file that will not parse, is the other half
   * of the answer. It is not a mount effect because the file may not have
   * arrived yet: the run that matters is the first one with a button to focus.
   */
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current) return;
    const first = retryButton.current ?? closeButton.current;
    if (!first) return;
    focused.current = true;
    first.focus();
  });

  /**
   * Rule 5 of the focus map: a modal holds focus until it is dismissed. Without
   * it, `Tab` off the last button walks into the board behind the scrim — which
   * is the surface this file's ticket is not on.
   */
  function holdFocus(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const stops = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        "button, pre[tabindex='0']",
      ) ?? [],
    );
    if (stops.length === 0) return;
    event.preventDefault();
    const here = stops.indexOf(document.activeElement as HTMLElement);
    const next = here + (event.shiftKey ? -1 : 1);
    stops[(next + stops.length) % stops.length].focus();
  }

  return (
    // Clicking past it closes it, as every other scrim in the app does
    // (`prototype.js` — `overlay-dismiss`). `Esc` is the panel's, on the
    // document, and it reaches this the same way it reaches the panel.
    <div
      className="modal-scrim"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        ref={dialog}
        className="raw-file-view"
        role="dialog"
        aria-modal="true"
        aria-label={`Raw file ${fullPath}`}
        onKeyDown={holdFocus}
      >
        <div className="raw-file-head">
          <h3 className="raw-file-path">
            <WarnGlyph size={15} />
            {fullPath}
          </h3>
          <button
            ref={closeButton}
            tabIndex={0}
            className="ghost"
            onClick={props.onClose}
            aria-label="Close raw file"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="raw-file-error" role="alert">
            <WarnGlyph />
            <span>{error}</span>
          </p>
        )}

        {!detail ? (
          // The read is a local file and usually instant, but a modal that says
          // nothing while it is out is the silence `states.md:9-12` forbids.
          <p className="panel-loading">Reading {props.ticketKey} from disk…</p>
        ) : (
          <>
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
                  title={fullPath}
                >
                  Open in editor
                </button>
                {/* A newer format is not a fault to fix, so there is nothing for
                    a retry to find — the same distinction
                    `Diagnostic::is_read_only` draws in Rust. Offering one would
                    be a button that can only ever return the same answer. */}
                {!detail.readOnly && (
                  <button
                    ref={retryButton}
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
          </>
        )}
      </section>
    </div>
  );
}
