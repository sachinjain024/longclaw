/**
 * Quick create: title, description, status, priority and labels — and a loop
 * (`screen-specs.md:253-262`).
 *
 * It used to ask for six fields, which made it the only create surface and made
 * it the wrong one — labels in particular were a comma-separated text box, typed
 * against definitions the project keeps in `longclaw.yaml` and the app has had a
 * real menu for since V0-10. V0-16 cut it to title and status, LC-186 put
 * priority back, and LC-201 put description and labels back with it.
 *
 * **That last one is not the narrowing being undone.** Labels were cut because
 * the *control* was wrong, and `LabelMenuButton` cannot produce a slug
 * `longclaw.yaml` does not define, so the menu re-introduces nothing. The
 * description was cut to keep quick create quick, which holds for one ticket
 * and stops holding under **Create more**: a bulk run is where someone has
 * eight small things in their head at once, and a line each is the difference
 * between eight tickets an agent can start on and eight titles somebody has to
 * reopen and explain. **The checklist stays in full create** — it is the one of
 * the three whose case does not change, because draft rows, drag reordering and
 * an add-row that has to stay on screen are the shape of a surface you sit in.
 *
 * **Priority is here because urgency is known when the ticket is thought of**
 * (LC-186). V0-16's narrowing kept status alone, and the cost was that every
 * urgent ticket was created at `none` and then edited — two writes and a trip
 * to the panel for a fact the person filing it already had. It is the same
 * `MenuButton` over the same `PRIORITY_OPTIONS` as the panel and full create,
 * so there is one priority vocabulary in the app and quick create does not
 * introduce a second.
 *
 * The key is not asked for. Rust allocates it from the project's own directory
 * names, so two creations cannot claim the same one; the context line shows the
 * next one as a guess — and during a run it counts up, because it is read off
 * the rows on screen and the last create put one there.
 */

import { useRef, useState } from "react";
import { useAutoGrow } from "./autoGrow";
import { LabelMenuButton } from "./LabelMenu";
import { MenuButton } from "./Menu";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import { ThemeDot } from "./ThemeSwatch";
import type {
  CreateTicketRequest,
  Label,
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
   * The project's label definitions, for the menu on the meta row (LC-201).
   * A ticket carries slugs and nothing else, and the menu can only offer what
   * `longclaw.yaml` defines — which is the whole reason labels may be here at
   * all. V0-16 removed a comma-separated text box, not the field.
   */
  labels: Record<string, Label>;
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
  /**
   * Fires and forgets: the create is optimistic, so the modal never waits.
   *
   * `createMore` rides in the options rather than in the request, the way
   * `openPanel` already does in `App`: the request is exactly what Rust is
   * handed, and a surface decision inside it would be a field to remember to
   * strip at the IPC boundary.
   */
  onCreate: (
    request: Omit<CreateTicketRequest, "projectId">,
    options: { createMore: boolean },
  ) => void;
  /**
   * Hands what has been typed to full create, rather than throwing it away.
   *
   * All five fields since LC-201, not three. The door is what makes the narrow
   * surface honest — "everything past these lives over there" is only true if
   * getting there costs nothing — so it is the one place two of them must not
   * quietly go missing.
   */
  onOpenFullEditor: (draft: {
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    labels: string[];
  }) => void;
}

export function QuickCreate(props: QuickCreateProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
  const [labels, setLabels] = useState<string[]>([]);
  /**
   * Whether the modal stays up after a create (LC-201).
   *
   * Local state with no `initial…` prop beside it, on purpose: it is a mode for
   * the run in front of you, not a preference. It is never written to device
   * preferences and never carried across a close, so someone who presses `C`
   * next week to file one thing gets the surface they have always had — and a
   * create surface that quietly stayed in bulk mode would be a surface that
   * files a ticket you thought you were cancelling.
   */
  const [createMore, setCreateMore] = useState(false);
  /**
   * The description grows with what is typed, so the field never hands the
   * human a resize grabber for a box that is too short — the pair
   * `field-guard.mjs` holds together.
   */
  const descriptionField = useAutoGrow(description);
  /**
   * The title, so the loop can put the caret back in it. Nothing else in the
   * modal moves focus: `focusCard` must not run on this path either, which is
   * `App`'s half of the same rule.
   */
  const titleField = useRef<HTMLInputElement>(null);
  /**
   * A title, and a project that can say which key is free. Both, because the
   * card this raises appears under the guessed key before the write returns —
   * so a create with no key to guess would put a card in some real ticket's
   * seat on the board.
   */
  const canCreate = title.trim() !== "" && props.provisionalKey !== undefined;

  function create() {
    if (!canCreate) return;
    props.onCreate(
      {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        labels,
      },
      { createMore },
    );
    if (!createMore) return;
    // What the next ticket in the run is: two empty fields, and the meta
    // already right. Status, priority and labels stay because a run almost
    // always shares them — that is the whole complaint LC-201 is about.
    //
    // The modal owns this reset rather than being told to do it, so `App`
    // never reaches in; and the reset is here rather than in an effect on the
    // write's return, because the human is already typing the next title by
    // then and clearing it under them would read as dropped keystrokes.
    setTitle("");
    setDescription("");
    titleField.current?.focus();
  }

  return (
    <div className="modal-scrim" role="presentation">
      <form
        className="quick-create-modal"
        aria-label="Create a ticket"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            props.onCancel();
            return;
          }
          // `⌘↵` creates from anywhere in the modal, which is what makes a
          // textarea safe to put here at all: `↵` in the description is a
          // newline, because a description is markdown and needs them. The
          // title's own `↵` still submits the form, as it always has. Both
          // halves are full create's binding (`CreatePanel.tsx:202-205`).
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            create();
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        {/* Dot, name, key (`prototype.js:1019`). The dot is decoration — the
            name is right beside it — so it is hidden from the reading order
            rather than repeated in words. */}
        <p className="eyebrow quick-create-context">
          <ThemeDot theme={props.projectTheme} />
          {props.projectName} · {props.provisionalKey ?? "opening…"}
          {/* The word, doing what it says (LC-201). This modal has no
              **Cancel** and its scrim does not dismiss, so before this there
              was no exit that was not a create — **Open full editor →** is the
              only other control that leaves, and it does not leave.

              Not the palette's `kbd-chip`: that one is a `<kbd>` in a box
              reporting a key it cannot perform, and a box up here competes
              with the two fields under it for the only edge this modal has to
              spend.

              `tabIndex={-1}`, stated rather than defaulted
              (`tab-order-guard.mjs`): its keyboard path is the key it is named
              after, which is the purest form of the focus map's rule 1, and a
              stop in front of the title for a control the keyboard already has
              is a press paid on every open. */}
          <button
            tabIndex={-1}
            className="quick-create-esc"
            type="button"
            aria-label="Close"
            onClick={props.onCancel}
          >
            esc
          </button>
        </p>
        {/* Borderless, and its own label: the modal has no visible field
            names, so the accessible name is the only one there is. */}
        <input
          className="quick-create-title"
          ref={titleField}
          autoFocus
          value={title}
          aria-label="Title"
          placeholder="Ticket title"
          onChange={(event) => setTitle(event.target.value)}
        />
        {/* Three lines to start, growing with what is typed, capped so a long
            one scrolls itself rather than pushing the footer off the modal —
            `.composer textarea`'s shape, because the app already has a
            bordered auto-growing markdown field and a second kind here would
            be a second answer to a solved question. Not `DescriptionEditor`:
            its tabstrip and six formatting buttons are nine controls, and this
            modal is meant to be crossed in a few presses of Tab. */}
        <textarea
          className="quick-create-description"
          ref={descriptionField}
          rows={3}
          value={description}
          aria-label="Description"
          placeholder="What should happen? Agents read this before they start."
          onChange={(event) => setDescription(event.target.value)}
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
          {/* The project's own definitions, never a text box: V0-10 gave the
              app a real label menu and plan 22 removed the comma-separated
              field that predated it, so a slug this menu produces is a slug
              `longclaw.yaml` carries. It is the same `LabelMenuButton` the
              panel and full create wear — one label affordance in the app. */}
          <LabelMenuButton
            slugs={labels}
            definitions={props.labels}
            onToggle={(next) => setLabels(next)}
          />
        </div>
        <div className="editor-footer">
          <button
            tabIndex={0}
            className="ghost"
            type="button"
            onClick={() =>
              props.onOpenFullEditor({
                title: title.trim(),
                description: description.trim(),
                status,
                priority,
                labels,
              })
            }
          >
            Open full editor →
          </button>
          {/* Immediately left of **Create**: the control it changes is the next
              thing both the eye and the Tab key reach. The checkbox states its
              own `tabIndex` for the reason every control here does — WebKit
              follows the macOS *Keyboard navigation* setting and skips
              checkboxes with it off, which is the half of
              `tab-order-guard.mjs` that hid in the checklist rows until
              LC-185. */}
          <label className="create-more">
            <input
              tabIndex={0}
              type="checkbox"
              checked={createMore}
              onChange={(event) => setCreateMore(event.target.checked)}
            />
            Create more
          </label>
          <button
            tabIndex={0}
            className="primary"
            type="submit"
            disabled={!canCreate}
          >
            {/* The binding on the control that performs it, the way full
                create's own footer writes it (`CreatePanel.tsx:408`). The mono
                hints line that used to repeat this and `esc cancel` is gone:
                both now sit on controls of their own. */}
            Create <kbd aria-hidden="true">⌘↵</kbd>
          </button>
        </div>
      </form>
    </div>
  );
}
