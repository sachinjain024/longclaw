/**
 * The designed conflict affordance: the human chooses, and neither version is
 * discarded behind their back. It appears the moment an external change lands on
 * a ticket with an open draft, not only after a save is refused.
 */

import type { AppError } from "./types";

export function ConflictBanner(props: {
  error: AppError;
  onReload: () => void;
  onKeepMine: () => void;
}) {
  const context = props.error.context;
  return (
    <section className="conflict-banner" role="alert">
      <strong>⚠ Changed on disk while you were editing</strong>
      <p>{props.error.message}</p>
      {context?.conflictingActorName && (
        <p className="conflict-actor">
          Last change on disk: {context.conflictingActorName} (
          {context.conflictingActorType})
        </p>
      )}
      <div className="toolbar-actions">
        <button className="secondary" onClick={props.onReload}>
          Reload file
        </button>
        <button className="ghost" onClick={props.onKeepMine}>
          Keep mine
        </button>
      </div>
      <p className="conflict-note">
        Reload discards your draft. Keep mine writes your version over the newer
        file and records the change.
      </p>
    </section>
  );
}
