/**
 * Full create: the ticket panel in create mode (`screen-specs.md:209-216`).
 *
 * It sits beside `TicketPanel` rather than inside it, and wears the same
 * `.ticket-panel` treatment. The panel is built around a file: it reads one on
 * open, carries the hash every save is written against, raises a conflict when
 * disk moves under a draft, and shows the timeline that file records. A create
 * has none of that, so none of those branches would run — and `detail ===
 * undefined`, the state a create would live in, already means "still reading from
 * disk" there. What the two genuinely share is vocabulary, and that is a module
 * import: `metaOptions`, `MenuButton`, `LabelMenuButton`, `DescriptionEditor`.
 *
 * Two things this surface must not claim:
 *
 * - **The ID is a guess.** Rust allocates the real key from the project's own
 *   directory names. The chip says `KEY-n · new` and is display-only, never a
 *   tab stop (`keyboard-focus-map.md:57`).
 * - **Nothing has been written.** The description editor is write mode only —
 *   there is no file to preview against — and the checklist rows are drafts, so
 *   their boxes cannot be ticked: `NewTicket.checklist` is a list of strings and
 *   a created item is always open.
 */

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useAutoGrow } from "./autoGrow";
import { DescriptionEditor } from "./DescriptionEditor";
import { GhostBox } from "./GhostBox";
import { LabelMenuButton } from "./LabelMenu";
import { MenuButton } from "./Menu";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import type {
  CreateTicketRequest,
  Label,
  TicketPriority,
  TicketStatus,
} from "./types";

interface CreatePanelProps {
  /**
   * The key the create is about to be given, read off the rows on screen — and
   * `undefined` when there are none to read it off yet, which is a project that
   * has been switched to and has not answered. See `QuickCreate`: the surface
   * says it does not know rather than naming `KEY-1` against an empty board,
   * because that is a key the project has usually already spent (LC-188).
   */
  provisionalKey?: string;
  /** The project's label definitions. A ticket carries slugs and nothing else. */
  labels: Record<string, Label>;
  /** Carried in from quick create's "Open full editor →" (`screen-specs.md:202`). */
  initialTitle?: string;
  initialStatus?: TicketStatus;
  /**
   * Quick create asks for a priority too (LC-186), so the move between the
   * surfaces has one to carry. Absent means nobody chose, which is `none`.
   */
  initialPriority?: TicketPriority;
  onCancel: () => void;
  /** Fires and forgets: the create is optimistic, so the panel never waits. */
  onCreate: (request: Omit<CreateTicketRequest, "projectId">) => void;
}

export function CreatePanel(props: CreatePanelProps) {
  const [title, setTitle] = useState(props.initialTitle ?? "");
  const [status, setStatus] = useState<TicketStatus>(
    props.initialStatus ?? "todo",
  );
  const [priority, setPriority] = useState<TicketPriority>(
    props.initialPriority ?? "none",
  );
  const [labels, setLabels] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const addItem = useRef<HTMLInputElement>(null);
  const titleField = useAutoGrow(title);

  /** A title, and a project that can say which key is free. See `QuickCreate`. */
  const canCreate = title.trim() !== "" && props.provisionalKey !== undefined;

  function create() {
    if (!canCreate) return;
    props.onCreate({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      labels,
      checklist,
    });
  }

  /**
   * `⌘↵` creates from anywhere in the panel and `Esc` cancels it
   * (`screen-specs.md:269-271`). Both are panel-wide because the footer is the only
   * commit — the menus and the description editor stop their own keys before
   * they reach here.
   */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      props.onCancel();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      create();
    }
  }

  return (
    <aside
      className="ticket-panel create-panel"
      aria-label={
        props.provisionalKey
          ? `New ticket ${props.provisionalKey}`
          : "New ticket"
      }
      onKeyDown={onKeyDown}
    >
      <header className="panel-header">
        {/* The same chip the panel's own key wears (D-4A), so the two headers
            read as the same object — but a `span`, because this one is display
            only: it is not the ticket's key until Rust says so, and a chip that
            copied it would put a guess on the clipboard. */}
        <span className="id-chip provisional">
          {props.provisionalKey ?? "opening…"}{" "}
          <span className="provisional-mark">· new</span>
        </span>
      </header>

      <textarea
        className="panel-title"
        ref={titleField}
        value={title}
        // One row, then as many as the title needs. `.panel-title` draws no
        // grabber and hides its overflow, so `rows` is a floor and the height
        // is the field's own job (LC-153).
        rows={1}
        autoFocus
        aria-label="Title"
        placeholder="Ticket title"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          // A title is a single line, here as much as in the panel.
          if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
          }
        }}
      />

      <div className="meta-grid">
        <span>Status</span>
        <MenuButton
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onPick={setStatus}
        />
        <span>Priority</span>
        <MenuButton
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={priority}
          onPick={setPriority}
        />
        <span>Labels</span>
        <LabelMenuButton
          slugs={labels}
          definitions={props.labels}
          onToggle={(next) => setLabels(next)}
        />
      </div>

      <section className="panel-section">
        <h3>Description</h3>
        <DescriptionEditor
          writeOnly
          // The one line saying what this field is for, and who reads it
          // (D-4B). Only the create surface carries it: an edit is opened
          // against a description that is already there.
          placeholder="What should happen? Agents read this before they start."
          value={description}
          onChange={setDescription}
        />
      </section>

      <section className="panel-section">
        {/* No fraction here, at any length (D-4D, `prototype.js:889`). Create's
            items are all open by construction — `NewTicket.checklist` is a list
            of strings — so the numerator can never move, and `0/3` says only
            what the three rows on screen already say. The panel's own count
            earns its place because there the numerator means something. */}
        <h3>Checklist</h3>
        <ul className="checklist">
          {checklist.map((text, index) => (
            // Keyed by position: a draft item has no id to key by, and two rows
            // may legitimately carry the same text until the file mints them.
            <li className="checklist-row draft" key={index}>
              <label>
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  readOnly
                  title="A new ticket's items start unchecked."
                />
                <span>{text}</span>
              </label>
              <button
                tabIndex={0}
                className="ghost row-remove"
                type="button"
                aria-label={`Remove ${text}`}
                onClick={() => {
                  setChecklist((rows) =>
                    rows.filter((_, position) => position !== index),
                  );
                  // Removing a row must not drop focus on the floor, and the
                  // add-row is the one control that is always there.
                  addItem.current?.focus();
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form
          className="checklist-add"
          onSubmit={(event) => {
            event.preventDefault();
            const text = newItem.trim();
            if (!text) return;
            setChecklist((rows) => [...rows, text]);
            // Enter appends and keeps focus, for rapid entry
            // (`screen-specs.md:189`).
            setNewItem("");
          }}
        >
          {/* The create surface's add-row is the list's next row here too
              (`prototype.js:895-897`); without the box its borderless field
              would sit a checkbox's width out of line with the rows above. */}
          <GhostBox />
          <input
            className="checklist-add-field"
            ref={addItem}
            value={newItem}
            placeholder="Add a checklist item"
            aria-label="Add a checklist item"
            onChange={(event) => setNewItem(event.target.value)}
          />
        </form>
      </section>

      <div className="editor-footer">
        {/* The key is a guess, so the note says where the file lands without
            promising which folder it claims. */}
        <code>writes one ticket.md under .longclaw/tickets/</code>
        <button
          tabIndex={0}
          className="ghost"
          type="button"
          onClick={props.onCancel}
        >
          Cancel <kbd aria-hidden="true">Esc</kbd>
        </button>
        <button
          tabIndex={0}
          className="primary"
          type="button"
          disabled={!canCreate}
          onClick={create}
        >
          Create ticket <kbd aria-hidden="true">⌘↵</kbd>
        </button>
      </div>
    </aside>
  );
}
