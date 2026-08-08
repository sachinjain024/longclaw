/**
 * Quick create: title and status, and nothing else (`screen-specs.md:198-207`).
 *
 * It used to ask for six fields, which made it the only create surface and made
 * it the wrong one — labels in particular were a comma-separated text box, typed
 * against definitions the project keeps in `longclaw.yaml` and the app has had a
 * real menu for since V0-10. Everything past title and status now lives in full
 * create, and **Open full editor →** carries the typed title there.
 *
 * The key is not asked for. Rust allocates it from the project's own directory
 * names, so two creations cannot claim the same one; the context line shows the
 * next one as a guess.
 */

import { useState } from "react";
import { MenuButton } from "./Menu";
import { STATUS_OPTIONS } from "./metaOptions";
import { ThemeDot } from "./ThemeSwatch";
import type { CreateTicketRequest, TicketStatus } from "./types";

interface QuickCreateProps {
  projectName: string;
  /**
   * The project's own preset, for the dot the context line carries (D-48). The
   * modal names which project the ticket lands in, and the dot is how that name
   * is recognised everywhere else in the app.
   */
  projectTheme: string;
  /** The key the create is about to be given, read off the rows on screen. */
  provisionalKey: string;
  /**
   * The status the modal opens on — "defaults Todo; preseeded when opened from
   * a column `+`" (`screen-specs.md:222`). A board column's `+` chooses it, so
   * the create starts in the column it was pressed in.
   */
  initialStatus?: TicketStatus;
  onCancel: () => void;
  /** Fires and forgets: the create is optimistic, so the modal never waits. */
  onCreate: (request: Omit<CreateTicketRequest, "projectId">) => void;
  /** Hands what has been typed to full create, rather than throwing it away. */
  onOpenFullEditor: (draft: { title: string; status: TicketStatus }) => void;
}

export function QuickCreate(props: QuickCreateProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TicketStatus>(
    props.initialStatus ?? "todo",
  );

  return (
    <div className="modal-scrim" role="presentation">
      <form
        className="quick-create-modal"
        aria-label="Create a ticket"
        onKeyDown={(event) => {
          if (event.key === "Escape") props.onCancel();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          props.onCreate({ title: title.trim(), status });
        }}
      >
        {/* Dot, name, key (`prototype.js:1019`). The dot is decoration — the
            name is right beside it — so it is hidden from the reading order
            rather than repeated in words. */}
        <p className="eyebrow quick-create-context">
          <ThemeDot theme={props.projectTheme} />
          {props.projectName} · {props.provisionalKey}
        </p>
        {/* Borderless, and its own label: the modal has no visible field
            names, so the accessible name is the only one there is. */}
        <input
          className="quick-create-title"
          autoFocus
          value={title}
          aria-label="Title"
          placeholder="Ticket title"
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="quick-create-meta">
          <MenuButton
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onPick={setStatus}
          />
        </div>
        <div className="editor-footer">
          <button
            tabIndex={0}
            className="ghost"
            type="button"
            onClick={() =>
              props.onOpenFullEditor({ title: title.trim(), status })
            }
          >
            Open full editor →
          </button>
          <code>↵ create · esc cancel</code>
          <button
            tabIndex={0}
            className="primary"
            type="submit"
            disabled={!title.trim()}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
