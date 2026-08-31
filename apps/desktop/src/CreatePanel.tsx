/**
 * Full create: the ticket panel in create mode (`screen-specs.md:264-271`).
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
 *   tab stop (`keyboard-focus-map.md:61`).
 * - **Nothing has been written.** The description editor is write mode only —
 *   there is no file to preview against. The checklist rows are still drafts,
 *   but their boxes do tick (LC-242h): a ticket filed over work already half
 *   done has finished rows to describe, and the tick travels with the row into
 *   the file Rust renders rather than becoming an edit afterwards. Nothing is
 *   written until **Create ticket** either way.
 */

import { useEffect, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { useAddRowInView } from "./addRow";
import { useAutoGrow } from "./autoGrow";
import { RowActions, RowEditor } from "./ChecklistRow";
import { dropEdge, gapUnder, landingFor, reordered } from "./checklistOrder";
import { classes } from "./classes";
import { DescriptionEditor } from "./DescriptionEditor";
import { GhostBox } from "./GhostBox";
import { LabelMenuButton } from "./LabelMenu";
import { MenuButton } from "./Menu";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import type {
  CreateTicketRequest,
  Label,
  NewChecklistItem,
  TicketDraft,
  TicketStatus,
} from "./types";

/**
 * A draft row's checkbox, as the selector that finds it inside its own row.
 * Named once because focus is put back through it by hand (`followRow`) and the
 * string has to be the one the row actually renders.
 */
const CHECKLIST_BOX = 'input[type="checkbox"]';

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
  /**
   * Carried in from quick create's "Open full editor →"
   * (`screen-specs.md:258-259`) — all five fields it asks for, as one draft
   * rather than five props (`TicketDraft`).
   *
   * The door is what makes the narrow surface honest: "everything past these
   * lives over there" is only true if getting there costs nothing, so it is
   * the one place a field must not quietly go missing. Absent altogether is
   * full create opened on its own, where every field starts at its default.
   */
  initialDraft?: TicketDraft;
  onCancel: () => void;
  /** Fires and forgets: the create is optimistic, so the panel never waits. */
  onCreate: (request: Omit<CreateTicketRequest, "projectId">) => void;
}

export function CreatePanel(props: CreatePanelProps) {
  const draft = props.initialDraft;
  const [title, setTitle] = useState(draft?.title ?? "");
  const [status, setStatus] = useState<TicketStatus>(draft?.status ?? "todo");
  const [priority, setPriority] = useState(draft?.priority ?? "none");
  const [labels, setLabels] = useState<string[]>(draft?.labels ?? []);
  const [description, setDescription] = useState(draft?.description ?? "");
  const [checklist, setChecklist] = useState<NewChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  /**
   * The add-row, which is both where focus goes when a row is removed and the
   * row that has to follow the list down as it grows (LC-193). The create
   * surface scrolls exactly as the panel does, and its add-row is the same
   * object — so it cannot answer this differently.
   */
  const addItem = useAddRowInView(checklist.length);
  const titleField = useAutoGrow(title);
  /** The draft row in the air, and the gap it would land in (LC-185). */
  const [dragRow, setDragRow] = useState<number>();
  const [dropGap, setDropGap] = useState<number>();
  const rows = useRef<HTMLUListElement>(null);
  /**
   * Where a keyboard move sent a row, so focus can follow it there — and which
   * of the row's controls to hand back.
   *
   * The panel's rows key by position, because a draft item has no id and two of
   * them may read the same. That is right for React and wrong for focus: the
   * element the human was on keeps its place while the text inside it changes,
   * so without this `⌥↓` would leave them holding the row they just moved past.
   *
   * **The control matters as much as the row.** This used to send focus to `✕`
   * whichever control the gesture came from, which was harmless while the box
   * was not a tab stop: the only places `⌥↓` could be pressed from were the two
   * buttons. LC-242h made the box a stop, and the box is the natural place to
   * press `⌥↓` from (`keyboard-focus-map.md:62`) — so landing on a destructive
   * button would mean the next `Space`, which the human presses to untick,
   * removes the row instead.
   */
  const [followRow, setFollowRow] = useState<{
    index: number;
    control: string;
  }>();
  useEffect(() => {
    if (!followRow) return;
    setFollowRow(undefined);
    // Found through the row rather than by counting controls across the list: a
    // row being retyped draws a field instead of its box and buttons, so the
    // nth `.row-remove` is not always the nth row's.
    const row = rows.current?.querySelector<HTMLElement>(
      `[data-row-index="${followRow.index}"]`,
    );
    row?.querySelector<HTMLElement>(followRow.control)?.focus();
  }, [followRow]);

  /**
   * Which of a row's controls an event came from, as the selector that finds
   * the same one again on the row's new line.
   */
  function controlAt(target: EventTarget | null): string {
    const element = target as HTMLElement | null;
    if (element?.closest(".row-edit")) return ".row-edit";
    if (element?.closest(".row-remove")) return ".row-remove";
    return CHECKLIST_BOX;
  }

  /** The row being retyped, by position — a draft row has no id to name. */
  const [editingRow, setEditingRow] = useState<number>();
  /** A row whose edit button should take focus back, by position. */
  const [refocusRow, setRefocusRow] = useState<number>();
  useEffect(() => {
    if (refocusRow === undefined) return;
    setRefocusRow(undefined);
    const buttons = rows.current?.querySelectorAll<HTMLElement>(".row-edit");
    buttons?.[refocusRow]?.focus();
  }, [refocusRow]);

  /**
   * Changes one part of one draft row, by the position it sits at.
   *
   * Position is the identity here — a draft row has no id, and two of them may
   * legitimately read the same until the file mints one — so this is the single
   * place that rule is written down. What is not changed is carried through by
   * the spread, which is what keeps a reword from moving a tick.
   */
  function patchRow(index: number, patch: Partial<NewChecklistItem>) {
    setChecklist((rows) =>
      rows.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    );
  }

  /**
   * Replaces one draft row's text (LC-215). An empty field leaves the row as it
   * was — the same answer the panel gives, and the reason is the same one: a
   * field is where words are changed and `✕` is where a row is removed, so a
   * field that also deleted would be two gestures wearing one control.
   */
  function editRow(index: number, text: string) {
    setEditingRow(undefined);
    // Closing the field unmounts what holds focus, and focus on nothing is
    // focus on `<body>` — the end of the keyboard's path through the list. The
    // button that opened it is where the human was.
    setRefocusRow(index);
    const next = text.trim();
    if (!next) return;
    // Text alone: the tick survives a reword, for the reason the panel's own
    // edit keeps the item id behind it (LC-215) — changing what a row says is
    // not changing whether it is done.
    patchRow(index, { text: next });
  }

  /**
   * Ticks or unticks a draft row (LC-242h).
   *
   * No toast and no undo entry, unlike the panel's own box: those exist because
   * a tick there is a write to a file that a human may want back. Here it is a
   * keystroke in a form nobody has committed, and `Esc` already discards the
   * whole of it.
   */
  function toggleRow(index: number, checked: boolean) {
    patchRow(index, { checked });
  }

  /** Takes a draft row off the list. Nothing is written; nothing was. */
  function removeRow(index: number) {
    setChecklist((rows) => rows.filter((_, position) => position !== index));
    // Removing a row must not drop focus on the floor, and the add-row is the
    // one control that is always there.
    addItem.current?.focus();
  }

  /** Which draft row an event happened on, by the position its element carries. */
  function rowIndexAt(target: EventTarget | null): number {
    const row = (target as HTMLElement | null)?.closest?.(".checklist-row");
    const index = (row as HTMLElement | null)?.dataset.rowIndex;
    return index === undefined ? -1 : Number(index);
  }

  /**
   * The draft list, rearranged. Nothing is written: these rows are not a file
   * yet, so the order is simply the order they will be created in — which is the
   * one thing about a create surface that a move can change.
   */
  function moveDraft(from: number, to: number, follow?: string) {
    if (from === to) return;
    setChecklist((current) => reordered(current, from, to));
    if (follow) setFollowRow({ index: to, control: follow });
  }

  /** Whether there is another row for one to be dragged past. */
  const reorderable = checklist.length > 1;

  function pickUpRow(event: DragEvent<HTMLElement>) {
    const index = rowIndexAt(event.target);
    if (!reorderable || index < 0) return;
    // WebKit will not start a drag with an empty data transfer (`dragging.ts`).
    event.dataTransfer?.setData("text/plain", checklist[index].text);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    setDragRow(index);
  }

  function overRow(event: DragEvent<HTMLElement>) {
    if (dragRow === undefined) return;
    const gap = gapUnder(event, rowIndexAt);
    if (gap === undefined) return;
    // Without this the drop never fires: the default is "this is not a target".
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setDropGap((current) => (current === gap ? current : gap));
  }

  function dropRow(event: DragEvent<HTMLElement>) {
    const gap = gapUnder(event, rowIndexAt);
    const from = dragRow;
    endDrag();
    if (gap === undefined || from === undefined) return;
    event.preventDefault();
    // Focus is wherever the pointer left it, so a drop does not move it — only
    // the keyboard's own gesture does.
    moveDraft(from, landingFor(from, gap));
  }

  function endDrag() {
    setDragRow(undefined);
    setDropGap(undefined);
  }

  /** `⌥↑` / `⌥↓` on a row, the same binding the ticket panel's list carries. */
  function moveByKey(event: KeyboardEvent<HTMLElement>) {
    if (!event.altKey || event.metaKey || event.ctrlKey) return;
    const step =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0) return;
    const from = rowIndexAt(event.target);
    const to = from + step;
    if (from < 0 || to < 0 || to >= checklist.length) return;
    event.preventDefault();
    moveDraft(from, to, controlAt(event.target));
  }

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
        {/* Still no fraction here, at any length (D-4D, `prototype.js:889`).
            The prototype draws none in create mode, and that cell is what
            settled the row. The second argument D-4D offered alongside it is
            retired: draft items are no longer all open by construction
            (LC-242h), so the numerator does move. Adding a counter here would
            be reopening a decision this ticket did not ask about. */}
        <h3>Checklist</h3>
        <ul
          className="checklist"
          ref={rows}
          onDragStart={pickUpRow}
          onDragOver={overRow}
          onDrop={dropRow}
          onDragEnd={endDrag}
          onDragLeave={(event) => {
            // Leaving for a row of the same list is not leaving; the next
            // `dragover` would put the line back a frame later.
            if (event.currentTarget.contains(event.relatedTarget as Node))
              return;
            setDropGap(undefined);
          }}
          onKeyDown={moveByKey}
        >
          {checklist.map((item, index) => (
            // Keyed by position: a draft item has no id to key by, and two rows
            // may legitimately carry the same text until the file mints them.
            <li
              className={classes(
                "checklist-row",
                "draft",
                reorderable && "draggable",
                index === dragRow && "dragging",
                dropEdge(index, checklist.length, dropGap),
                // The drawn half of a tick (`components.md:218`): ink-3 and a
                // line through the text. The panel's rows have carried it
                // since LC-185, and a box that moved while the row it belongs
                // to did not would be half a state on screen.
                item.checked && "checked",
              )}
              key={index}
              data-row-index={index}
              draggable={reorderable}
            >
              {reorderable && (
                <span className="row-grip" aria-hidden="true">
                  ⠿
                </span>
              )}
              {editingRow === index ? (
                <RowEditor
                  text={item.text}
                  onCommit={(next) => editRow(index, next)}
                  onCancel={() => setEditingRow(undefined)}
                />
              ) : (
                <>
                  <label>
                    <input
                      type="checkbox"
                      // A real stop, as the panel's own box is: WebKit skips a
                      // checkbox on a default Mac exactly as it skips a button
                      // (`tab-order-guard.mjs`), and a box the keyboard cannot
                      // reach is a box only a mouse can tick.
                      //
                      // `keyboard-focus-map.md` states the checklist row's
                      // order once, for the panel's view mode
                      // (`keyboard-focus-map.md:61-62`): box → edit → remove,
                      // with `⌥↑`/`⌥↓` on the row. This surface has no section
                      // of its own there, and it should not need one — a draft
                      // row is the same row, and this is the stop that makes
                      // the two orders identical rather than nearly so.
                      tabIndex={0}
                      checked={item.checked}
                      // No `aria-label`: the wrapping label holds the row's
                      // text, which is what names the panel's own box too
                      // (`TicketPanel.tsx`). A second name for the same control
                      // in the second surface would be two vocabularies for one
                      // gesture, which is what quick create refused for
                      // priority.
                      onChange={(event) =>
                        toggleRow(index, event.target.checked)
                      }
                    />
                    <span>{item.text}</span>
                  </label>
                  <RowActions
                    text={item.text}
                    onEdit={() => setEditingRow(index)}
                    onRemove={() => removeRow(index)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
        <form
          className="checklist-add"
          onSubmit={(event) => {
            event.preventDefault();
            const text = newItem.trim();
            if (!text) return;
            // Appended open. A row is ticked by ticking it, never by typing
            // it: the add-row is where words arrive and the box is where done
            // is said, which is the split the panel keeps too.
            setChecklist((rows) => [...rows, { text, checked: false }]);
            // Enter appends and keeps focus, for rapid entry
            // (`screen-specs.md:244`).
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
