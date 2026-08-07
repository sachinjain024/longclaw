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
  /** The key the create is about to be given, read off the rows on screen. */
  provisionalKey: string;
  /** The project's label definitions. A ticket carries slugs and nothing else. */
  labels: Record<string, Label>;
  /** Carried in from quick create's "Open full editor →" (`screen-specs.md:202`). */
  initialTitle?: string;
  initialStatus?: TicketStatus;
  onCancel: () => void;
  /** Fires and forgets: the create is optimistic, so the panel never waits. */
  onCreate: (request: Omit<CreateTicketRequest, "projectId">) => void;
}

export function CreatePanel(props: CreatePanelProps) {
  const [title, setTitle] = useState(props.initialTitle ?? "");
  const [status, setStatus] = useState<TicketStatus>(
    props.initialStatus ?? "todo",
  );
  const [priority, setPriority] = useState<TicketPriority>("none");
  const [labels, setLabels] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const addItem = useRef<HTMLInputElement>(null);

  const canCreate = title.trim() !== "";

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
   * (`screen-specs.md:214`). Both are panel-wide because the footer is the only
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
      aria-label={`New ticket ${props.provisionalKey}`}
      onKeyDown={onKeyDown}
    >
      <header className="panel-header">
        {/* Display only. It is not the ticket's key until Rust says so. */}
        <span className="ticket-key provisional">
          {props.provisionalKey} <span className="provisional-mark">· new</span>
        </span>
      </header>

      <textarea
        className="panel-title"
        value={title}
        rows={2}
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
          value={description}
          onChange={setDescription}
        />
      </section>

      <section className="panel-section">
        <h3>
          Checklist
          <span className="section-count">0/{checklist.length}</span>
        </h3>
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
