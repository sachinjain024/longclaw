/**
 * The ticket panel: the one surface where a human reads and changes a ticket, and
 * where an agent's changes arrive while they are looking at it.
 *
 * Three rules shape it:
 *
 * - The file is the record. Every mutation goes through `edit_ticket` with the
 *   hash the panel read, so a newer file on disk becomes a conflict the human
 *   resolves rather than an overwrite.
 * - A draft is never overwritten, in either direction. When a change lands on
 *   disk while a draft is open, the panel raises the conflict itself rather than
 *   waiting for a save to be refused — and the drafts stay exactly as typed.
 * - Attribution is never inferred. Records render the actor the file named; an
 *   agent gets the agent treatment and can never become an assignee, because v0
 *   has no assignee at all (ADR 0001).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { editTicket, readTicket } from "./api";
import { externalEditConflict } from "./attribution";
import { ConflictBanner } from "./ConflictBanner";
import { normalizeError } from "./errors";
import type { ExternalMark } from "./freshness";
import { acknowledgement, freshlyChecked } from "./freshness";
import { LabelMenuButton } from "./LabelMenu";
import { sameLabels } from "./labels";
import { MenuButton } from "./Menu";
import { mutate } from "./mutations";
import { PriorityGlyph } from "./PriorityGlyph";
import { StatusDot } from "./StatusDot";
import { PRIORITIES, priorityLabel, statusLabel, STATUSES } from "./tickets";
import { Timeline } from "./Timeline";
import type {
  AppError,
  ChecklistItem,
  Label,
  TicketDetail,
  TicketEdit,
  TicketPriority,
  TicketStatus,
  WriteResult,
} from "./types";
import { WriteIndicator } from "./WriteFeedback";

/**
 * Every menu row carries the option's own glyph (`screen-specs.md:240`), and the
 * status menu's glyph is the coloured dot. Built once: the rows never differ per
 * ticket.
 */
const STATUS_OPTIONS = STATUSES.map((option) => ({
  id: option.id,
  label: option.label,
  glyph: <StatusDot status={option.id} decorative />,
}));

const PRIORITY_OPTIONS = PRIORITIES.map((option) => ({
  id: option.id,
  label: option.label,
  glyph: <PriorityGlyph priority={option.id} decorative />,
}));

/**
 * What a destructive-adjacent change adds to a save: the state it shows before
 * the write returns, the toast copy, and the edit that takes it back
 * (`states.md:62-63`). Status and check use it today; priority, archive, and
 * unarchive are the same shape.
 */
export interface SaveFeedback {
  /** Renders the change now; the returned function puts it back on failure. */
  apply?: () => () => void;
  toast?: string;
  /** The inverse, written the ordinary way against the hash the write returned. */
  inverse?: TicketEdit;
  inverseToast?: string;
}

/**
 * Why the panel is reading the file.
 *
 * `open` starts fresh. `external` came from the watcher, so it is the only mode
 * that may attribute a checklist tick to somebody else. `local` follows the
 * app's own write, where nothing is new to the human who just did it.
 */
type LoadMode = "open" | "external" | "local";

interface TicketPanelProps {
  projectId: string;
  ticketKey: string;
  /** The project's label definitions. A ticket carries slugs and nothing else. */
  labels: Record<string, Label>;
  /** An unreviewed external change to this ticket, if there is one. */
  mark?: ExternalMark;
  /** Bumped when an external change to this ticket lands, to re-read the file. */
  reloadSignal: number;
  now: number;
  /**
   * Whether the ticket carries an `archived_at` (ADR 0004), taken from the same
   * store row the board and the list read rather than from the file this panel
   * last read. Archiving is the one action here whose write is raised outside
   * the panel — it closes the panel — so this is what lets the optimistic flip
   * and a failed write's revert reach all three surfaces at once.
   */
  archived: boolean;
  onClose: () => void;
  /** Asks for the flip. The panel writes nothing here; see `archived`. */
  onArchive: (archived: boolean) => void;
  onWrite: (result: WriteResult) => void;
  onError: (error: AppError) => void;
}

export function TicketPanel(props: TicketPanelProps) {
  const { projectId, ticketKey } = props;
  /**
   * The error reporter, held in a ref: reading the file is expensive, so the
   * loader must not be rebuilt — and the file re-read — because a parent
   * re-rendered with a new callback identity.
   */
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;
  const [detail, setDetail] = useState<TicketDetail>();
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{
    error: AppError;
    pending: TicketEdit;
  }>();
  /** Checklist ids an external write ticked, for the agent treatment. */
  const [agentChecked, setAgentChecked] = useState<string[]>([]);
  /**
   * Checkbox states the human set that are still being written. Rendering these
   * over the file's own values is what keeps a tick from waiting on the disk.
   */
  const [pendingChecks, setPendingChecks] = useState<Record<string, boolean>>(
    {},
  );
  /** The status the human just picked, rendered over the file's until it lands. */
  const [pendingStatus, setPendingStatus] = useState<TicketStatus>();
  /** Same, for priority. */
  const [pendingPriority, setPendingPriority] = useState<TicketPriority>();
  /** Same, for labels — the whole list, because a label edit replaces it whole. */
  const [pendingLabels, setPendingLabels] = useState<string[]>();

  /** The checklist as last read, so an external tick can be told from a stale one. */
  const loadedChecklist = useRef<ChecklistItem[]>([]);
  /**
   * What the loader needs to know about drafts, as a ref: it must not overwrite
   * what the human is typing, and it must not be rebuilt every keystroke.
   */
  const drafts = useRef({
    title: "",
    description: "",
    editing: false,
    loadedTitle: "",
    loadedDescription: "",
  });

  function draftEdit(): TicketEdit | undefined {
    const edit: TicketEdit = {};
    if (drafts.current.title.trim() !== drafts.current.loadedTitle) {
      edit.title = drafts.current.title.trim();
    }
    if (
      drafts.current.editing &&
      drafts.current.description.trim() !== drafts.current.loadedDescription
    ) {
      edit.description = drafts.current.description;
    }
    return edit.title === undefined && edit.description === undefined
      ? undefined
      : edit;
  }

  const load = useCallback(
    async (mode: LoadMode) => {
      let next: TicketDetail;
      try {
        next = await readTicket(projectId, ticketKey);
      } catch (error) {
        onErrorRef.current(normalizeError(error));
        return undefined;
      }
      const checklist = next.ticket?.checklist ?? [];
      const title = next.ticket?.title ?? "";
      const description = next.ticket?.description ?? "";
      // Only a change from outside can have ticked something on somebody else's
      // behalf. The human's own tick is not news to them.
      setAgentChecked(
        mode === "external"
          ? freshlyChecked(loadedChecklist.current, checklist)
          : [],
      );
      loadedChecklist.current = checklist;
      setPendingChecks({});
      setPendingStatus(undefined);
      setPendingPriority(undefined);
      setPendingLabels(undefined);
      setDetail(next);

      const unsaved = mode === "external" ? draftEdit() : undefined;
      if (unsaved) {
        // Disk moved under an open draft. The file's own state is now visible,
        // the drafts are untouched, and the human chooses.
        setConflict({ error: externalEditConflict(next), pending: unsaved });
      } else {
        drafts.current.title = title;
        drafts.current.description = description;
        setTitleDraft(title);
        setDescriptionDraft(description);
      }
      drafts.current.loadedTitle = title;
      drafts.current.loadedDescription = description;

      if (mode === "open") {
        drafts.current.editing = false;
        setEditingDescription(false);
        setNewItem("");
        setCommentDraft("");
        setConflict(undefined);
      }
      return next;
    },
    [projectId, ticketKey],
  );

  useEffect(() => {
    void load("open");
  }, [load]);

  // The panel is an overlay, so Escape has to close it from anywhere, and opening
  // it has to move focus into it.
  const panelRef = useRef<HTMLElement>(null);
  const onClose = props.onClose;
  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const firstSignal = useRef(props.reloadSignal);
  useEffect(() => {
    if (props.reloadSignal === firstSignal.current) return;
    void load("external");
  }, [props.reloadSignal, load]);

  /**
   * Writes one edit. An unresolved conflict blocks every save except the one
   * that resolves it, so a draft can never slip past the banner.
   */
  async function save(
    edit: TicketEdit,
    options?: { resolvesConflict?: boolean } & SaveFeedback,
  ) {
    if (conflict && !options?.resolvesConflict) {
      // The banner stays up and the optimistic tick snaps back, so nothing
      // pretends to have been written while the conflict is open.
      setPendingChecks({});
      setPendingStatus(undefined);
      setPendingPriority(undefined);
      setPendingLabels(undefined);
      return;
    }
    const hash = detail?.contentHash;
    if (!hash || saving) return;
    setSaving(true);
    const written = await mutate({
      path: detail?.relativePath,
      apply: options?.apply,
      write: () =>
        editTicket({ projectId, ticketKey, expectedHash: hash, edit }),
      onWritten: (result) => {
        props.onWrite(result);
        setConflict(undefined);
      },
      toast: options?.toast === undefined ? undefined : () => options.toast!,
      undo:
        options?.inverse === undefined
          ? undefined
          : (result) => ({
              path: result.ticket.relativePath,
              write: () =>
                editTicket({
                  projectId,
                  ticketKey,
                  // The hash the first write left behind, so the inverse is not
                  // refused as stale by its own predecessor.
                  expectedHash: result.ticket.contentHash,
                  edit: options.inverse!,
                }),
              onWritten: (undone) => {
                props.onWrite(undone);
                void load("local");
              },
              toast: () => options.inverseToast ?? `${ticketKey} restored`,
            }),
      // Rust refuses a stale write the app never saw an event for. That is a
      // decision for the human, not a failed write, so it never reverts and
      // never becomes a danger toast.
      handles: (error) => {
        if (error.code !== "conflict") return false;
        setConflict({ error, pending: edit });
        setPendingChecks({});
        setPendingStatus(undefined);
        setPendingPriority(undefined);
        setPendingLabels(undefined);
        return true;
      },
    });
    if (written) await load("local");
    setSaving(false);
  }

  /** Takes the newer file, discarding the drafts that lost. */
  async function reloadOverDraft() {
    setConflict(undefined);
    drafts.current.editing = false;
    setEditingDescription(false);
    await load("open");
  }

  /** Keeps the human's edit by re-applying it on top of the file as it is now. */
  async function keepMine() {
    const pending = conflict?.pending;
    if (!pending) return;
    await save(pending, { resolvesConflict: true });
  }

  function openDescriptionEditor(description: string) {
    drafts.current.description = description;
    drafts.current.editing = true;
    setDescriptionDraft(description);
    setEditingDescription(true);
  }

  function closeDescriptionEditor() {
    drafts.current.editing = false;
    setEditingDescription(false);
  }

  /** The file's value, unless the human just clicked and the write is in flight. */
  function isChecked(item: ChecklistItem): boolean {
    const pending = item.id === undefined ? undefined : pendingChecks[item.id];
    return pending ?? item.checked;
  }

  const ticket = detail?.ticket;

  return (
    <aside
      className="ticket-panel"
      aria-label={`Ticket ${ticketKey}`}
      ref={panelRef}
      tabIndex={-1}
    >
      <header className="panel-header">
        <span className="ticket-key">{ticketKey}</span>
        <WriteIndicator idle={detail?.relativePath} />
        <div className="panel-header-actions">
          {props.archived && <span className="archived-chip">archived</span>}
          {/* A file this build cannot read has no frontmatter to flip. The
              label is the action, not the state, so it is also the name
              assistive technology reads. */}
          {ticket && (
            <button
              className="ghost"
              onClick={() => props.onArchive(!props.archived)}
            >
              {props.archived ? "Unarchive" : "Archive"}
            </button>
          )}
          <button
            className="ghost"
            onClick={props.onClose}
            aria-label="Close ticket"
          >
            ✕
          </button>
        </div>
      </header>

      {props.mark && (
        <p
          className={
            props.mark.actorType === "unknown"
              ? "panel-acknowledgement unattributed"
              : "panel-acknowledgement"
          }
        >
          {acknowledgement(props.mark, props.now)}
        </p>
      )}

      {conflict && (
        <ConflictBanner
          error={conflict.error}
          onReload={() => void reloadOverDraft()}
          onKeepMine={() => void keepMine()}
        />
      )}

      {!detail ? (
        <p className="panel-loading">Reading {ticketKey} from disk…</p>
      ) : !ticket ? (
        <section className="degraded-copy">
          <h3>
            {detail.readOnly ? "Shown read-only" : "Shown without repair"}
          </h3>
          <p>
            {detail.diagnostic?.line
              ? `${detail.relativePath}:${detail.diagnostic.line} — ${detail.diagnostic.message}`
              : detail.diagnostic?.message}
          </p>
          <pre className="raw-file">{detail.raw}</pre>
        </section>
      ) : (
        <>
          <textarea
            className="panel-title"
            value={titleDraft}
            rows={2}
            aria-label="Title"
            onChange={(event) => {
              drafts.current.title = event.target.value;
              setTitleDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                drafts.current.title = ticket.title;
                setTitleDraft(ticket.title);
              }
            }}
            onBlur={() => {
              const next = titleDraft.trim();
              if (!next || next === ticket.title) {
                drafts.current.title = ticket.title;
                setTitleDraft(ticket.title);
                return;
              }
              void save({ title: next });
            }}
          />

          <div className="meta-grid">
            <span>Status</span>
            <MenuButton
              label="Status"
              options={STATUS_OPTIONS}
              value={pendingStatus ?? ticket.status}
              onPick={(next) => {
                const previous = ticket.status;
                if (next === previous) return;
                void save(
                  { status: next },
                  {
                    apply: () => {
                      setPendingStatus(next);
                      return () => setPendingStatus(undefined);
                    },
                    toast: `${ticketKey} → ${statusLabel(next)}`,
                    inverse: { status: previous },
                    inverseToast: `${ticketKey} back to ${statusLabel(previous)}`,
                  },
                );
              }}
            />
            <span>Priority</span>
            <MenuButton
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={pendingPriority ?? ticket.priority}
              onPick={(next) => {
                const previous = ticket.priority;
                if (next === previous) return;
                void save(
                  { priority: next },
                  {
                    apply: () => {
                      setPendingPriority(next);
                      return () => setPendingPriority(undefined);
                    },
                    toast: `${ticketKey} → ${priorityLabel(next)}`,
                    inverse: { priority: previous },
                    inverseToast: `${ticketKey} back to ${priorityLabel(previous)}`,
                  },
                );
              }}
            />
            <span>Labels</span>
            <LabelMenuButton
              slugs={pendingLabels ?? ticket.labels}
              definitions={props.labels}
              onToggle={(next, toggled) => {
                const previous = pendingLabels ?? ticket.labels;
                // `TicketDocument::apply` refuses an edit that changes nothing.
                if (sameLabels(next, previous)) return;
                const added = next.includes(toggled.slug);
                void save(
                  { labels: next },
                  {
                    apply: () => {
                      setPendingLabels(next);
                      return () => setPendingLabels(undefined);
                    },
                    toast: `${ticketKey} ${added ? "labeled" : "unlabeled"} ${toggled.name}`,
                    // A label edit replaces the list, so its inverse is the
                    // whole list as it was — not the one slug that moved.
                    inverse: { labels: [...previous] },
                    inverseToast: `${ticketKey} ${added ? "unlabeled" : "labeled"} ${toggled.name}`,
                  },
                );
              }}
            />
            <span>Updated</span>
            <code>{ticket.updatedAt}</code>
          </div>

          <section className="panel-section">
            <h3>Description</h3>
            {editingDescription ? (
              <div className="description-editor">
                <textarea
                  value={descriptionDraft}
                  rows={8}
                  aria-label="Description"
                  onChange={(event) => {
                    drafts.current.description = event.target.value;
                    setDescriptionDraft(event.target.value);
                  }}
                />
                <div className="editor-footer">
                  <code>writes to ticket.md on save</code>
                  <button
                    className="ghost"
                    onClick={() => {
                      drafts.current.description = ticket.description;
                      setDescriptionDraft(ticket.description);
                      closeDescriptionEditor();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary"
                    disabled={descriptionDraft.trim() === ticket.description}
                    onClick={() => {
                      closeDescriptionEditor();
                      void save({ description: descriptionDraft });
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="description-view"
                onClick={() => openDescriptionEditor(ticket.description)}
              >
                {ticket.description || "Add a description"}
              </button>
            )}
          </section>

          <section className="panel-section">
            <h3>
              Checklist
              <span
                className={
                  agentChecked.length > 0
                    ? "checklist-fraction fresh"
                    : "checklist-fraction"
                }
              >
                {ticket.checklist.filter(isChecked).length}/
                {ticket.checklist.length}
              </span>
            </h3>
            <ul className="checklist">
              {ticket.checklist.map((item, index) => {
                const fresh =
                  item.id !== undefined && agentChecked.includes(item.id);
                const checked = isChecked(item);
                return (
                  <li
                    key={item.id ?? `unadopted-${index}`}
                    className={fresh ? "checklist-row fresh" : "checklist-row"}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={item.id === undefined}
                        title={
                          item.id === undefined
                            ? "Appended without an id. Saving any change adopts it."
                            : undefined
                        }
                        onChange={(event) => {
                          const itemId = item.id;
                          if (!itemId) return;
                          const next = event.target.checked;
                          void save(
                            { checklist: [{ itemId, checked: next }] },
                            {
                              // Show the tick now; the file catches up.
                              apply: () => {
                                setPendingChecks((current) => ({
                                  ...current,
                                  [itemId]: next,
                                }));
                                return () =>
                                  setPendingChecks((current) => {
                                    const reverted = { ...current };
                                    delete reverted[itemId];
                                    return reverted;
                                  });
                              },
                              toast: `${ticketKey} ${next ? "checked" : "unchecked"} · ${item.text}`,
                              inverse: {
                                checklist: [{ itemId, checked: !next }],
                              },
                              inverseToast: `${ticketKey} ${next ? "unchecked" : "checked"} · ${item.text}`,
                            },
                          );
                        }}
                      />
                      <span>{item.text}</span>
                    </label>
                    {fresh && <em className="agent-note">❯ just now</em>}
                  </li>
                );
              })}
            </ul>
            <form
              className="checklist-add"
              onSubmit={(event) => {
                event.preventDefault();
                const text = newItem.trim();
                if (!text) return;
                setNewItem("");
                void save({ addChecklistItems: [text] });
              }}
            >
              <input
                value={newItem}
                placeholder="Add a checklist item"
                aria-label="Add a checklist item"
                onChange={(event) => setNewItem(event.target.value)}
              />
            </form>
          </section>

          <section className="panel-section">
            <h3>Activity</h3>
            {ticket.historyIncomplete && (
              <p className="history-note">
                This ticket changed without a matching activity entry. The state
                stands; the history is incomplete.
              </p>
            )}
            <Timeline events={ticket.activity} now={props.now} />
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                const comment = commentDraft.trim();
                if (!comment) return;
                setCommentDraft("");
                void save({ comment });
              }}
            >
              <textarea
                value={commentDraft}
                rows={2}
                placeholder="Comment"
                aria-label="Comment"
                onChange={(event) => setCommentDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                className="primary"
                type="submit"
                disabled={!commentDraft.trim()}
              >
                Comment
              </button>
            </form>
          </section>
        </>
      )}
    </aside>
  );
}
