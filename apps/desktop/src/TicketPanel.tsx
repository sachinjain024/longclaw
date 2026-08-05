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
import { DescriptionEditor } from "./DescriptionEditor";
import { normalizeError } from "./errors";
import type { ExternalMark } from "./freshness";
import { acknowledgement, freshlyChecked } from "./freshness";
import { singleKeyShortcutAllowed } from "./keyContext";
import { LabelMenuButton } from "./LabelMenu";
import { sameLabels } from "./labels";
import { MarkdownView } from "./MarkdownView";
import { MenuButton } from "./Menu";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import { mutate, type Mutation } from "./mutations";
import { priorityLabel, statusLabel } from "./tickets";
import { metaFieldFor } from "./TicketMetaMenu";
import { Timeline } from "./Timeline";
import type {
  AppError,
  ChecklistItem,
  HeldConflict,
  Label,
  TicketDetail,
  TicketEdit,
  TicketPriority,
  TicketStatus,
  WriteResult,
} from "./types";
import { WriteIndicator } from "./WriteFeedback";

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
 * What the human has changed that the disk has not confirmed yet. The panel
 * renders these over the file's own values, which is what keeps a pick or a tick
 * from waiting on IPC.
 *
 * One object rather than four states because they are one claim — "this is not
 * on disk yet" — and they end together every time: a load, a save the conflict
 * banner blocked, a conflict raised by the write. Four separate resets is four
 * chances to leave one behind, rendering a value no file holds.
 */
interface Pending {
  /** Checkbox states the human set. Keyed by item id; other items may differ. */
  checks: Record<string, boolean>;
  status?: TicketStatus;
  priority?: TicketPriority;
  /** The whole list, because a label edit replaces it whole. */
  labels?: string[];
}

const NOTHING_PENDING: Pending = { checks: {} };

/**
 * Why the panel is reading the file.
 *
 * `open` starts fresh. `external` came from the watcher, so it is the only mode
 * that may attribute a checklist tick to somebody else. `local` follows the
 * app's own write, where nothing is new to the human who just did it.
 */
type LoadMode = "open" | "external" | "local";

function degradedHeading(detail: TicketDetail): string {
  return detail.readOnly
    ? "Newer format, shown read-only"
    : "Shown without repair";
}

function degradedNote(detail: TicketDetail): string {
  if (detail.readOnly) {
    return "This ticket was written by a newer LongClaw format. The file is shown exactly as it exists on disk, and this build will not rewrite it.";
  }
  return "The file is shown exactly as it exists on disk. Fix it in an editor, then reload or wait for the watcher to read it again.";
}

interface TicketPanelProps {
  projectId: string;
  ticketKey: string;
  /** The project's label definitions. A ticket carries slugs and nothing else. */
  labels: Record<string, Label>;
  /** An unreviewed external change to this ticket, if there is one. */
  mark?: ExternalMark;
  /** Bumped when an external change to this ticket lands, to re-read the file. */
  reloadSignal: number;
  /** Bumped when the watched ticket file disappeared while the panel is open. */
  removedSignal: number;
  now: number;
  /**
   * Whether the ticket carries an `archived_at` (ADR 0004), taken from the same
   * store row the board and the list read rather than from the file this panel
   * last read. Archiving is the one action here whose write is raised outside
   * the panel — it closes the panel — so this is what lets the optimistic flip
   * and a failed write's revert reach all three surfaces at once.
   */
  archived: boolean;
  /**
   * Whether the panel is the top layer. `App` is the only place that knows the
   * stack, and a modal above the panel — the palette, either create surface —
   * must not have its rows answer `S`/`P` down here (`keyboard-focus-map.md:23`).
   */
  shortcutsActive: boolean;
  /**
   * A conflict a write raised outside the panel, with the edit it was refused
   * for. `App` cannot render the banner — it is this panel's state — so it sends
   * the refused edit here instead, and the human gets the same Reload / Keep
   * mine choice they would have got had they made the change in the panel
   * (V0-29).
   */
  heldConflict?: HeldConflict;
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
  /**
   * A comment already on screen whose write has not returned. Posting is
   * optimistic (`screen-specs.md:193`), and this is the whole of it: the
   * timeline draws it as an entry that says it is still posting, and `load`
   * clears it when the file comes back carrying the real record.
   */
  const [pendingComment, setPendingComment] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{
    error: AppError;
    pending: TicketEdit;
  }>();
  const [unavailable, setUnavailable] = useState<AppError>();
  /** Checklist ids an external write ticked, for the agent treatment. */
  const [agentChecked, setAgentChecked] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending>(NOTHING_PENDING);

  /** Every field the disk has not confirmed goes back to the file's own value. */
  const clearPending = () => setPending(NOTHING_PENDING);

  /** Shows one picked value now, and returns the function that takes it back. */
  function hold<Field extends "status" | "priority" | "labels">(
    field: Field,
    value: Pending[Field],
  ): () => void {
    setPending((current) => ({ ...current, [field]: value }));
    return () => setPending((current) => ({ ...current, [field]: undefined }));
  }

  /** The same, for one checkbox: the others may have writes of their own out. */
  function holdCheck(itemId: string, checked: boolean): () => void {
    setPending((current) => ({
      ...current,
      checks: { ...current.checks, [itemId]: checked },
    }));
    return () =>
      setPending((current) => {
        const checks = { ...current.checks };
        delete checks[itemId];
        return { ...current, checks };
      });
  }

  /** The checklist as last read, so an external tick can be told from a stale one. */
  const loadedChecklist = useRef<ChecklistItem[]>([]);
  /**
   * The file as last read, for `save()` to take its `expectedHash` from.
   *
   * `detail` is the same value and is what the panel renders; this exists
   * because a save can be waiting on a read that has already landed but not yet
   * re-rendered, and the hash it sends has to be the one that came back.
   */
  const lastRead = useRef<TicketDetail>(undefined);
  /**
   * The re-read a conflict started, so Keep mine can wait for it.
   *
   * `takeConflict` raises the banner at once — an unresolved conflict is true
   * the moment the write is refused — but the read that makes Keep mine safe is
   * a round trip behind it. Without this the button is live in between, and it
   * would write against the hash the refusal already proved stale (V0-29).
   */
  const refreshing = useRef<Promise<unknown> | undefined>(undefined);
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
        const normalized = normalizeError(error);
        if (normalized.code === "ticket_not_found") {
          setUnavailable(normalized);
          clearPending();
          return undefined;
        }
        onErrorRef.current(normalized);
        return undefined;
      }
      setUnavailable(undefined);
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
      clearPending();
      setPendingComment(undefined);
      setDetail(next);
      lastRead.current = next;

      const unsaved = mode === "external" ? draftEdit() : undefined;
      if (unsaved) {
        // Disk moved under an open draft. The file's own state is now visible,
        // the drafts are untouched, and the human chooses.
        //
        // A conflict already up wins: it is holding the edit a write was
        // refused for, and this is only a second look at the same divergence.
        // Replacing it would drop that edit on the floor (V0-29).
        setConflict(
          (current) =>
            current ?? { error: externalEditConflict(next), pending: unsaved },
        );
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

  /**
   * Raises a conflict handed over from outside, once the panel is showing the
   * file it applies to.
   *
   * The gate on `detail` is the whole of the ordering: `load("open")` ends by
   * clearing the conflict, so seeding before it resolves would seed into a
   * banner about to be dismissed. Waiting for the file means the banner appears
   * over content the human can read, which is what makes Keep mine a decision
   * rather than a blind overwrite.
   */
  const seededHandOff = useRef<HeldConflict | undefined>(undefined);
  const heldConflict = props.heldConflict;
  useEffect(() => {
    if (!detail || !heldConflict || heldConflict.ticketKey !== ticketKey)
      return;
    if (seededHandOff.current === heldConflict) return;
    seededHandOff.current = heldConflict;
    setConflict({ error: heldConflict.error, pending: heldConflict.edit });
    // The panel may have been open and idle when the write was refused, in
    // which case what it is showing is older than the refusal. Keep mine waits
    // on this read rather than racing it.
    refreshing.current = load("external");
  }, [detail, heldConflict, ticketKey, load]);

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

  /**
   * `S`/`P` with the panel open (`keyboard-focus-map.md:66-69`): "they target
   * the open ticket". The board and the list bind them on their own containers,
   * and focus is in neither while the panel is up, so the binding is here — and
   * it opens the panel's *own* menus, because their picks carry the conflict
   * banner, the draft, and the reload that `App`'s write path knows nothing of.
   */
  const [metaMenu, setMetaMenu] = useState<"status" | "priority">();
  const shortcutsActive = props.shortcutsActive;
  useEffect(() => {
    if (!shortcutsActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented) return;
      if (!singleKeyShortcutAllowed(event.target)) return;
      const field = metaFieldFor(event.key);
      if (!field) return;
      event.preventDefault();
      setMetaMenu(field);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcutsActive]);

  const firstSignal = useRef(props.reloadSignal);
  useEffect(() => {
    if (props.reloadSignal === firstSignal.current) return;
    void load("external");
  }, [props.reloadSignal, load]);

  const lastRemovalSignal = useRef({
    ticketKey,
    signal: props.removedSignal,
  });
  useEffect(() => {
    if (ticketKey !== lastRemovalSignal.current.ticketKey) {
      lastRemovalSignal.current = { ticketKey, signal: props.removedSignal };
      return;
    }
    if (props.removedSignal === lastRemovalSignal.current.signal) return;
    lastRemovalSignal.current = { ticketKey, signal: props.removedSignal };
    setUnavailable({
      code: "ticket_not_found",
      message:
        "This ticket file was deleted or renamed on disk. LongClaw kept your panel state and did not write anything.",
      recoverable: true,
      context: { ticketKey },
    });
    setConflict(undefined);
    clearPending();
  }, [props.removedSignal, ticketKey]);

  /**
   * Hands a refused write to the banner instead of the failure toast.
   *
   * Rust refuses a stale write the app never saw an event for. That is a
   * decision for the human, not a failed write, so it never reverts and never
   * becomes a danger toast. Both directions get it — the save and the inverse
   * that Undo builds — because a conflict on the way back is the same situation
   * as a conflict on the way out, and it used to get a toast that stated the
   * fact and offered nothing (V0-29).
   */
  function takeConflict(edit: TicketEdit): (error: AppError) => boolean {
    return (error) => {
      if (error.code !== "conflict") return false;
      setConflict({ error, pending: edit });
      clearPending();
      // A conflict never reverts, so the composer has to be given its text
      // back by hand — the comment was not written and must not vanish.
      setPendingComment(undefined);
      if (edit.comment !== undefined) setCommentDraft(edit.comment);
      // Go back to the file. Rust refused this write because the bytes moved,
      // and until the panel re-reads them `detail` holds the hash that was just
      // rejected — so Keep mine would re-send it and be refused identically. It
      // worked at all only when the watcher's event happened to arrive first,
      // which is a race, not an offer.
      //
      // `external` is the mode for exactly this: the file moved, so drafts are
      // preserved rather than overwritten with what is now on disk.
      refreshing.current = load("external");
      return true;
    };
  }

  /**
   * The mutation that takes a save back, when the caller supplied an inverse.
   *
   * Taking `inverse` as a parameter is what proves it defined once, for both the
   * write and the conflict handler, rather than asserting it twice inside a
   * branch that already checked.
   */
  function undoing(
    inverse: TicketEdit | undefined,
    inverseToast: string | undefined,
  ): ((written: WriteResult) => Mutation) | undefined {
    if (inverse === undefined) return undefined;
    return (result) => ({
      path: result.ticket.relativePath,
      write: () =>
        editTicket({
          projectId,
          ticketKey,
          // The hash the first write left behind, so the inverse is not refused
          // as stale by its own predecessor.
          expectedHash: result.ticket.contentHash,
          edit: inverse,
        }),
      onWritten: (undone) => {
        props.onWrite(undone);
        void load("local");
      },
      toast: () => inverseToast ?? `${ticketKey} restored`,
      handles: takeConflict(inverse),
    });
  }

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
      clearPending();
      return;
    }
    // The last read rather than the last render: a save that waited on a read —
    // Keep mine does — must send the hash that came back, not the one that was
    // on screen when the button was pressed.
    const hash = lastRead.current?.contentHash;
    if (!hash || saving) return;
    setSaving(true);
    const written = await mutate({
      path: lastRead.current?.relativePath,
      apply: options?.apply,
      write: () =>
        editTicket({ projectId, ticketKey, expectedHash: hash, edit }),
      onWritten: (result) => {
        props.onWrite(result);
        setConflict(undefined);
      },
      toast: options?.toast === undefined ? undefined : () => options.toast!,
      undo: undoing(options?.inverse, options?.inverseToast),
      handles: takeConflict(edit),
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
    // The edit the conflict refused, not the panel's `pending` — that was
    // cleared when the banner went up.
    const refused = conflict?.pending;
    if (!refused || saving) return;
    // "As it is now" is a promise, and the read that keeps it may still be out.
    await refreshing.current;
    await save(refused, { resolvesConflict: true });
  }

  /**
   * Where focus goes when the editor closes: back to the description block
   * (`keyboard-focus-map.md:86`), but only when the human closed it themselves.
   * A reload that drops the editor should not steal focus from wherever they
   * are.
   */
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (editingDescription || !returnFocus.current) return;
    returnFocus.current = false;
    editButton.current?.focus();
  }, [editingDescription]);

  function openDescriptionEditor(description: string) {
    drafts.current.description = description;
    drafts.current.editing = true;
    setDescriptionDraft(description);
    setEditingDescription(true);
  }

  function closeDescriptionEditor() {
    returnFocus.current = true;
    drafts.current.editing = false;
    setEditingDescription(false);
  }

  /** The file's value, unless the human just clicked and the write is in flight. */
  function isChecked(item: ChecklistItem): boolean {
    const held = item.id === undefined ? undefined : pending.checks[item.id];
    return held ?? item.checked;
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
              tabIndex={0}
              className="ghost"
              onClick={() => props.onArchive(!props.archived)}
            >
              {props.archived ? "Unarchive" : "Archive"}
            </button>
          )}
          <button
            tabIndex={0}
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

      {unavailable && (
        <section className="missing-ticket-panel" role="alert">
          <h3>Ticket file is no longer available</h3>
          <p>{unavailable.message}</p>
          {(draftEdit() ||
            newItem.trim() ||
            commentDraft.trim() ||
            pendingComment) && (
            <div className="missing-draft">
              <strong>Unsaved draft kept in this panel</strong>
              {titleDraft.trim() && <p>Title: {titleDraft.trim()}</p>}
              {drafts.current.editing && descriptionDraft.trim() && (
                <pre>{descriptionDraft}</pre>
              )}
              {newItem.trim() && <p>Checklist item: {newItem.trim()}</p>}
              {commentDraft.trim() && <p>Comment: {commentDraft.trim()}</p>}
              {pendingComment && <p>Posting comment: {pendingComment}</p>}
            </div>
          )}
          <div className="toolbar-actions">
            <button
              tabIndex={0}
              className="secondary"
              onClick={() => void load("open")}
            >
              Try reading again
            </button>
            <button tabIndex={0} className="ghost" onClick={props.onClose}>
              Close panel
            </button>
          </div>
        </section>
      )}

      {unavailable ? null : !detail ? (
        <p className="panel-loading">Reading {ticketKey} from disk…</p>
      ) : !ticket ? (
        <section className="degraded-copy">
          <h3>{degradedHeading(detail)}</h3>
          <p>
            {detail.diagnostic?.line
              ? `${detail.relativePath}:${detail.diagnostic.line} — ${detail.diagnostic.message}`
              : detail.diagnostic?.message}
          </p>
          <p>{degradedNote(detail)}</p>
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
              value={pending.status ?? ticket.status}
              open={metaMenu === "status"}
              onOpenChange={(open) => setMetaMenu(open ? "status" : undefined)}
              onPick={(next) => {
                const previous = ticket.status;
                if (next === previous) return;
                void save(
                  { status: next },
                  {
                    apply: () => hold("status", next),
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
              value={pending.priority ?? ticket.priority}
              open={metaMenu === "priority"}
              onOpenChange={(open) =>
                setMetaMenu(open ? "priority" : undefined)
              }
              onPick={(next) => {
                const previous = ticket.priority;
                if (next === previous) return;
                void save(
                  { priority: next },
                  {
                    apply: () => hold("priority", next),
                    toast: `${ticketKey} → ${priorityLabel(next)}`,
                    inverse: { priority: previous },
                    inverseToast: `${ticketKey} back to ${priorityLabel(previous)}`,
                  },
                );
              }}
            />
            <span>Labels</span>
            <LabelMenuButton
              slugs={pending.labels ?? ticket.labels}
              definitions={props.labels}
              onToggle={(next, toggled) => {
                const previous = pending.labels ?? ticket.labels;
                // `TicketDocument::apply` refuses an edit that changes nothing.
                if (sameLabels(next, previous)) return;
                const added = next.includes(toggled.slug);
                void save(
                  { labels: next },
                  {
                    apply: () => hold("labels", next),
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
              <DescriptionEditor
                value={descriptionDraft}
                // `TicketDocument::apply` refuses an edit that changes nothing.
                canSave={descriptionDraft.trim() !== ticket.description}
                onChange={(next) => {
                  drafts.current.description = next;
                  setDescriptionDraft(next);
                }}
                onCancel={() => {
                  drafts.current.description = ticket.description;
                  setDescriptionDraft(ticket.description);
                  closeDescriptionEditor();
                }}
                onSave={() => {
                  closeDescriptionEditor();
                  // The draft, not a re-render of the parsed tree: the bytes the
                  // human typed are the bytes that reach the file.
                  void save({ description: descriptionDraft });
                }}
              />
            ) : ticket.description ? (
              <div className="description-view">
                <MarkdownView
                  source={ticket.description}
                  headingOffset={3}
                  className="markdown"
                />
                <button
                  tabIndex={0}
                  className="ghost description-edit"
                  ref={editButton}
                  onClick={() => openDescriptionEditor(ticket.description)}
                >
                  Edit description
                </button>
              </div>
            ) : (
              <button
                tabIndex={0}
                className="description-view empty"
                ref={editButton}
                onClick={() => openDescriptionEditor("")}
              >
                Add a description
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
                              apply: () => holdCheck(itemId, next),
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
            <Timeline
              events={ticket.activity}
              now={props.now}
              // So a change event names a label and a checklist item rather
              // than the slug and the id the record carries.
              labels={props.labels}
              checklist={ticket.checklist}
              pendingComment={pendingComment}
            />
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                const comment = commentDraft.trim();
                if (!comment) return;
                void save(
                  { comment },
                  {
                    // Clearing the field is part of the optimistic step, so a
                    // save the conflict banner refuses leaves the draft typed.
                    apply: () => {
                      setCommentDraft("");
                      setPendingComment(comment);
                      return () => {
                        setPendingComment(undefined);
                        setCommentDraft(comment);
                      };
                    },
                  },
                );
              }}
            >
              {/* Actor identity, which ADR 0001 permits and `screen-specs.md:193`
                  asks for. It is not an assignee and there is no assignee. */}
              <span className="actor-tile" aria-hidden="true">
                •
              </span>
              <textarea
                value={commentDraft}
                // Auto-growing, within reason: the panel scrolls, so a long
                // comment should not push the timeline off screen entirely.
                rows={Math.min(
                  10,
                  Math.max(2, commentDraft.split("\n").length),
                )}
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
                tabIndex={0}
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
