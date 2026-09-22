/**
 * The bar across the foot of the window: which LongClaw this is at one end, and
 * the standing offer to star it at the other (LC-257s).
 *
 * **Why a bar at all.** The star control had to be somewhere always visible, and
 * every other place in the chrome is already spoken for. The content header
 * would have cost the filter field 155px at every width — at a 980px window the
 * field goes 297px to 142px — and it is absent on the welcome screen and on a
 * project that will not open, which is exactly where a first-time reader is
 * standing. The side panel's version line had no room either: with an update
 * waiting, `LongClaw 0.2.0` is the only flexible thing left in 216px and wraps.
 * A bar the width of the window has room for both and nothing competing for an
 * edge.
 *
 * So the version and the update news move here out of `.side-panel-footer`,
 * where LC-256a put them. The strings are unchanged — `UPDATE_COPY.footer` is
 * still their one spelling — and only their address changed.
 *
 * **The star control carries no visible words.** A mark, and a number once
 * there is one. `GITHUB_COPY.aria` is the whole offer in words, and the only
 * warning that the press leaves the app; there is no visible label for it to
 * repeat, which is unusual enough here to be worth saying out loud.
 */

import { GitHubMark } from "./GitHubMark";
import { GITHUB_COPY, showsCount, starAria } from "./github";
import { openRepository } from "./api";
import { useMutationStore } from "./mutations";
import { UPDATE_COPY } from "./updates";
import type { UpdateStatus } from "./types";

export function StatusBar({
  update,
  stars,
  onUpdate,
}: {
  /** What the update path last said, or `undefined` before it has said it. */
  update?: UpdateStatus;
  /** The repository's star count, or `undefined` while there is no number. */
  stars?: number;
  /**
   * Opens Settings › Updates, carrying the opener so `Esc` comes back here.
   *
   * Absent on the welcome screen, which has no settings panel to open — there
   * is no project to have settings for. `update` is `undefined` there too, so
   * the link this answers cannot render; the prop is optional rather than
   * answered with a callback that does nothing.
   */
  onUpdate?: (opener: HTMLElement) => void;
}) {
  const counted = showsCount(stars);
  return (
    <div className="app-statusbar">
      {/* The version is absent rather than blank until the update path answers.
          It answers on launch, so this is one frame, and a placeholder that is
          replaced a frame later reads as a value that changed. */}
      {update && (
        <span className="ver">
          {UPDATE_COPY.footer.version(update.currentVersion)}
        </span>
      )}
      {update?.state === "available" && update.available && onUpdate && (
        <>
          {/* Decorative: colour is never the only channel, and the link beside
              it carries the message. */}
          <span className="upd-dot" aria-hidden="true" />
          <button
            tabIndex={0}
            type="button"
            className="upd-link"
            aria-label={UPDATE_COPY.footer.updateAria(update.available.version)}
            onClick={(event) => onUpdate(event.currentTarget)}
          >
            {UPDATE_COPY.footer.update}
          </button>
        </>
      )}
      <button
        tabIndex={0}
        type="button"
        className="gh-star"
        aria-label={starAria(stars)}
        title={GITHUB_COPY.title}
        onClick={() => {
          void openRepository().catch(() => {
            // It claims nothing about why. A person cannot act on the
            // difference between "no handler" and "the open call failed".
            useMutationStore
              .getState()
              .raise({ message: GITHUB_COPY.openFailed, tone: "danger" });
          });
        }}
      >
        <GitHubMark />
        {counted && (
          <span className="gh-count">{GITHUB_COPY.count(stars)}</span>
        )}
      </button>
    </div>
  );
}
