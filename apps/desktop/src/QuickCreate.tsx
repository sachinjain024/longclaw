/**
 * Quick create: title, status and priority, and nothing else
 * (`screen-specs.md:253-262`).
 *
 * It used to ask for six fields, which made it the only create surface and made
 * it the wrong one — labels in particular were a comma-separated text box, typed
 * against definitions the project keeps in `longclaw.yaml` and the app has had a
 * real menu for since V0-10. Everything past those three now lives in full
 * create, and **Open full editor →** carries what has been typed there.
 *
 * **Priority is here because urgency is known when the ticket is thought of**
 * (LC-186). V0-16's narrowing kept status alone, and the cost was that every
 * urgent ticket was created at `none` and then edited — two writes and a trip
 * to the panel for a fact the person filing it already had. It is the same
 * `MenuButton` over the same `PRIORITY_OPTIONS` as the panel and full create,
 * so there is one priority vocabulary in the app and quick create does not
 * introduce a second. What it is *not* is a door to the rest: labels,
 * description and checklist stay in full create, where the menus and drafts
 * that make them safe already are.
 *
 * The key is not asked for. Rust allocates it from the project's own directory
 * names, so two creations cannot claim the same one; the context line shows the
 * next one as a guess.
 */

import { useState } from "react";
import { MenuButton } from "./Menu";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import { ThemeDot } from "./ThemeSwatch";
import type {
  CreateTicketRequest,
  TicketPriority,
  TicketStatus,
} from "./types";

interface QuickCreateProps {
  projectName: string;
  /**
   * The project's own preset, for the dot the context line carries (D-48). The
   * modal names which project the ticket lands in, and the dot is how that name
   * is recognised everywhere else in the app.
   */
  projectTheme: string;
  /**
   * The key the create is about to be given, read off the rows on screen — and
   * `undefined` when there are no rows to read it off yet, which is a project
   * that has been switched to and has not answered. A guess against an empty
   * board is `KEY-1`, a key the project has usually already spent, so the
   * surface says it does not know rather than naming one (LC-140, LC-188).
   */
  provisionalKey?: string;
  /**
   * The status the modal opens on — "defaults Todo; preseeded from a column
   * `+`" (`screen-specs.md:257`). A board column's `+` chooses it, so
   * the create starts in the column it was pressed in.
   */
  initialStatus?: TicketStatus;
  /**
   * The priority the modal opens on. Nothing preseeds it today — no column is
   * a priority — so it exists for the same reason `initialStatus` does: coming
   * back from **Open full editor →** must not forget what was chosen (LC-186).
   */
  initialPriority?: TicketPriority;
  onCancel: () => void;
  /** Fires and forgets: the create is optimistic, so the modal never waits. */
  onCreate: (request: Omit<CreateTicketRequest, "projectId">) => void;
  /** Hands what has been typed to full create, rather than throwing it away. */
  onOpenFullEditor: (draft: {
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
  }) => void;
}

export function QuickCreate(props: QuickCreateProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TicketStatus>(
    props.initialStatus ?? "todo",
  );
  /**
   * `none` is a priority a ticket can hold, not a missing answer, so the modal
   * opens on it and sends it — the same default `CreatePanel` carries.
   */
  const [priority, setPriority] = useState<TicketPriority>(
    props.initialPriority ?? "none",
  );
  /**
   * A title, and a project that can say which key is free. Both, because the
   * card this raises appears under the guessed key before the write returns —
   * so a create with no key to guess would put a card in some real ticket's
   * seat on the board.
   */
  const canCreate = title.trim() !== "" && props.provisionalKey !== undefined;

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
          if (!canCreate) return;
          props.onCreate({ title: title.trim(), status, priority });
        }}
      >
        {/* Dot, name, key (`prototype.js:1019`). The dot is decoration — the
            name is right beside it — so it is hidden from the reading order
            rather than repeated in words. */}
        <p className="eyebrow quick-create-context">
          <ThemeDot theme={props.projectTheme} />
          {props.projectName} · {props.provisionalKey ?? "opening…"}
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
        {/* Status then priority, which is the meta grid's order in the panel
            and in full create (`screen-specs.md:229`). Both wear D-49's bare
            trigger: the rule is on `.quick-create-meta .menu-trigger`, so the
            second one is bare for the same reason the first is. */}
        <div className="quick-create-meta">
          <MenuButton
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onPick={setStatus}
          />
          <MenuButton
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={priority}
            onPick={setPriority}
          />
        </div>
        <div className="editor-footer">
          <button
            tabIndex={0}
            className="ghost"
            type="button"
            onClick={() =>
              props.onOpenFullEditor({ title: title.trim(), status, priority })
            }
          >
            Open full editor →
          </button>
          <code>↵ create · esc cancel</code>
          <button
            tabIndex={0}
            className="primary"
            type="submit"
            disabled={!canCreate}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
