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
// Aliased because the panel also binds `keydown` on `document`, where the type
// is the DOM's own `KeyboardEvent` and shadowing it would silently retype those.
import type { DragEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { editTicket, openTicketFile, readTicket } from "./api";
import {
  actorGlyph,
  externalEditConflict,
  acknowledgementClass,
} from "./attribution";
import { useAddRowInView } from "./addRow";
import { useAutoGrow } from "./autoGrow";
import {
  dropEdge,
  gapUnder,
  heldOrder,
  landingFor,
  moveOf,
  reordered,
} from "./checklistOrder";
import { RowActions, RowEditor } from "./ChecklistRow";
import { classes } from "./classes";
import { ConflictBanner } from "./ConflictBanner";
import { DescriptionEditor } from "./DescriptionEditor";
import { normalizeError } from "./errors";
import { FolderGlyph } from "./FolderGlyph";
import type { ExternalMark } from "./acknowledgement";
import { acknowledgementInFull, newlyChecked } from "./acknowledgement";
import { GhostBox } from "./GhostBox";
import { singleKeyShortcutAllowed } from "./keyContext";
import { LabelMenuButton } from "./LabelMenu";
import { sameLabels } from "./labels";
import { MarkdownView } from "./MarkdownView";
import { MenuButton } from "./Menu";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./metaOptions";
import { PencilGlyph } from "./PencilGlyph";
import { mutate, type Mutation, useMutationStore } from "./mutations";
import { RawFileView } from "./RawFileView";
import { priorityLabel, statusLabel } from "./tickets";
import { metaFieldFor } from "./TicketMetaMenu";
import { Timeline } from "./Timeline";
import { isComment } from "./timelineEvents";
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
import { diskLabel, WriteIndicator } from "./WriteFeedback";

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
  /** The checklist's ids in the order a move left them, for the same reason. */
  order?: string[];
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

/**
 * The ticket's key as a chip that copies it (`screen-specs.md:218`, D-38).
 *
 * The same bargain as the header's path chip: a piece of identity that reads as
 * text, and one click to take it somewhere else — a terminal, a commit message,
 * a prompt. It wears the human accent because copying is a person's own action,
 * and it is the panel's first Tab stop (`keyboard-focus-map.md:61`).
 */
function IdChip(props: { ticketKey: string }) {
  const raise = useMutationStore((state) => state.raise);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.ticketKey);
      raise({ message: `${props.ticketKey} copied`, tone: "default" });
    } catch {
      raise({ message: `Could not copy ${props.ticketKey}`, tone: "danger" });
    }
  };
  return (
    <button
      tabIndex={0}
      className="id-chip"
      aria-label={`Copy ${props.ticketKey}`}
      title={`Copy ${props.ticketKey}`}
      onClick={() => void copy()}
    >
      {props.ticketKey}
    </button>
  );
}

/**
 * The ticket's file, named where the ticket is read (`screen-specs.md:218-219`,
 * D-39): the disk made visible, and static, so it holds still while the
 * indicator beside it reports the writes.
 *
 * Not a button. The header's project path is one because an absolute path is
 * worth taking away; this one is `tickets/<key>/ticket.md` for every ticket
 * there has ever been, and the key beside it already copies.
 */
function TicketPathChip(props: { path: string }) {
  return (
    <span className="path-chip plain" title={props.path}>
      <FolderGlyph />
      <span className="txt">{diskLabel(props.path)}</span>
    </span>
  );
}

/** Which half of the record the panel is showing (LC-211). */
type HistoryTab = "comments" | "activity";

/**
 * The two tabs over the ticket's record (LC-211).
 *
 * A real `tablist`, so the pair costs the panel's Tab order one stop rather than
 * two and the arrows move between them — the roving pattern the board's columns
 * already use, and the one a screen reader announces as a set rather than as two
 * unrelated buttons.
 *
 * Activity is first and selected on open, because it is the whole record and
 * this panel's reason for existing is that an agent's changes arrive in it while
 * somebody is looking. Comments is the same stream with everything that is not
 * somebody's words taken out. The composer sits under both.
 */
function HistoryTabs(props: {
  tab: HistoryTab;
  onPick: (tab: HistoryTab) => void;
  activityCount: number;
  commentCount: number;
}) {
  const tabs: { id: HistoryTab; label: string; count: number }[] = [
    { id: "activity", label: "Activity", count: props.activityCount },
    { id: "comments", label: "Comments", count: props.commentCount },
  ];
  return (
    <div className="panel-tabs" role="tablist" aria-label="Ticket record">
      {tabs.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          className={classes("panel-tab", props.tab === id && "selected")}
          aria-selected={props.tab === id}
          aria-controls={`panel-tab-${id}`}
          // The selected tab is the set's only stop; the arrows own the rest.
          tabIndex={props.tab === id ? 0 : -1}
          onClick={() => props.onPick(id)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const next = tabs[(tabs.findIndex((one) => one.id === id) + 1) % 2];
            props.onPick(next.id);
            // Selection follows focus, which is the pattern for a tabset whose
            // panels are already rendered and cost nothing to show.
            document.getElementById(`tab-${next.id}`)?.focus();
          }}
        >
          {label}
          <span className="section-count">{count}</span>
        </button>
      ))}
    </div>
  );
}

interface TicketPanelProps {
  projectId: string;
  ticketKey: string;
  /**
   * The project's root as the header shows it — tilde-abbreviated, for display
   * only. The raw-file view names the file in full (`screen-specs.md:351`) and
   * a `TicketDetail` carries only the half below the project root.
   */
  projectPath: string;
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
  /**
   * The file the index says will not parse, as the degraded row carries it:
   * project-relative, present only for a card the board drew as degraded.
   *
   * It decides nothing about which surface is finally drawn — the read does
   * (see the raw-file branch) — and buys two things while the read is out: the
   * card the human clicked does not flash the panel it was never going to keep,
   * and the modal can say which file it is about before anything has come back.
   */
  degradedPath?: string;
  onClose: () => void;
  /** Asks for the flip. The panel writes nothing here; see `archived`. */
  onArchive: (archived: boolean) => void;
  onWrite: (result: WriteResult) => void;
  /**
   * A file that would not parse does now. The panel has the ticket back, but
   * the board and the list are still showing the degraded row the index holds,
   * and nothing else will correct it until the watcher fires — which is the
   * wait `Retry parse` exists to end (`states.md:102-104`). Fetching the
   * snapshot is `App`'s job, not the panel's (ADR 0006).
   */
  onReparsed: () => void;
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
   * optimistic (`screen-specs.md:248`), and this is the whole of it: the
   * timeline draws it as an entry that says it is still posting, and `load`
   * clears it when the file comes back carrying the real record.
   */
  const [pendingComment, setPendingComment] = useState<string>();
  /**
   * Which half of the record is showing (LC-211). Panel state rather than a
   * preference: it is a question about the ticket in front of the human, and
   * the next ticket opens on the composer the same way this one did.
   */
  const [historyTab, setHistoryTab] = useState<HistoryTab>("activity");
  /**
   * Whether a write of this panel's is out. One hash means one edit at a time,
   * and this is what every save is refused against.
   *
   * A ref rather than state, and it was state until LC-193. Nothing renders it —
   * the disk-state indicator reads the mutation store — so the only thing the
   * state bought was a re-render per write and a value a render behind the
   * truth, which is a value two Enters in one frame can both find false.
   */
  const writing = useRef(false);
  /** A `Retry parse` read that has not come back, so the button cannot stack. */
  const [retrying, setRetrying] = useState(false);
  const raise = useMutationStore((state) => state.raise);
  const [conflict, setConflict] = useState<{
    error: AppError;
    pending: TicketEdit;
  }>();
  const [unavailable, setUnavailable] = useState<AppError>();
  /** Checklist ids an external write ticked, for the acknowledgement. */
  const [externallyCheckedIds, setExternallyCheckedIds] = useState<string[]>(
    [],
  );
  const [pending, setPending] = useState<Pending>(NOTHING_PENDING);
  /** The checklist row in the air, and the gap it would land in (LC-185). */
  const [dragItem, setDragItem] = useState<string>();
  const [dropGap, setDropGap] = useState<number>();

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
      setExternallyCheckedIds(
        mode === "external"
          ? newlyChecked(loadedChecklist.current, checklist)
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
  /**
   * Opening is the whole of this, which is why it depends on the ticket rather
   * than on the callback below.
   *
   * Together with the listener it followed a new `onClose` identity, and `App`
   * hands one over whenever it re-renders — which every write makes it do. So a
   * write took focus off whatever the human was working in and put it on the
   * panel itself, and the second `⌥↓` of a reorder went nowhere
   * (`a11y-audit.mjs`, A1). The panel is *entered* once; it does not re-enter
   * itself because something above it changed shape.
   */
  useEffect(() => {
    panelRef.current?.focus();
  }, [ticketKey]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /**
   * `S`/`P` with the panel open (`keyboard-focus-map.md:71-74`): "they target
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
    if (!hash || writing.current) return;
    writing.current = true;
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
    writing.current = false;
    // Whatever was typed while this was out goes now.
    void drainNewItems();
  }

  /**
   * Checklist items typed while a write was in flight.
   *
   * A write blocks the next one — one hash, one edit — and until LC-193 that
   * block was a *drop*: the submit handler had already cleared the field, so an
   * item typed during the round trip left the field empty, never reached the
   * file, and said nothing about it. Rapid entry is the whole reason Enter
   * leaves focus where it is (`keyboard-focus-map.md:63`), and a surface that
   * loses the second item of it is not offering rapid entry.
   *
   * A ref, not state: nothing renders it, and the queue has to be exact at the
   * moment of the keystroke rather than a render later.
   */
  const queuedItems = useRef<string[]>([]);

  /** Sends everything queued, as one edit, as soon as the disk is free. */
  async function drainNewItems() {
    if (writing.current || queuedItems.current.length === 0) return;
    // Spliced before the await, so a keystroke during this write queues behind
    // it rather than being sent twice.
    const items = queuedItems.current.splice(0);
    await save({ addChecklistItems: items });
  }

  /** Takes the newer file, discarding the drafts that lost. */
  async function reloadOverDraft() {
    setConflict(undefined);
    drafts.current.editing = false;
    setEditingDescription(false);
    await load("open");
  }

  /**
   * Reads the file again on demand (`states.md:102-104`).
   *
   * Every outcome says something. A file that parses gives the ticket back and
   * tells `App` the row it holds is stale; one that still does not re-renders
   * the raw view — with whatever the parser says now, which may be a different
   * line — and says so, because a button whose success and failure look
   * identical is one a human cannot learn anything from.
   */
  async function retryParse() {
    if (retrying) return;
    setRetrying(true);
    const next = await load("open");
    setRetrying(false);
    if (!next) return;
    if (next.ticket) {
      raise({ message: `${ticketKey} parsed`, tone: "default" });
      props.onReparsed();
      return;
    }
    raise({ message: `${ticketKey} still does not parse`, tone: "danger" });
  }

  /**
   * Hands the file to the editor the human already uses for Markdown.
   *
   * A failure toasts rather than going to `props.onError`, which is the split
   * the panel already runs on: `load` routes a *read* the panel depends on to
   * the app's banner, because there is nothing on screen without it, while a
   * button the human just pressed — copy, a refused write, this — answers where
   * they pressed it. The raw file is still readable either way.
   */
  async function openInEditor() {
    try {
      await openTicketFile(projectId, ticketKey);
    } catch (error) {
      raise({ message: normalizeError(error).message, tone: "danger" });
    }
  }

  /** Keeps the human's edit by re-applying it on top of the file as it is now. */
  async function keepMine() {
    // The edit the conflict refused, not the panel's `pending` — that was
    // cleared when the banner went up.
    const refused = conflict?.pending;
    if (!refused || writing.current) return;
    // "As it is now" is a promise, and the read that keeps it may still be out.
    await refreshing.current;
    await save(refused, { resolvesConflict: true });
  }

  /**
   * Where focus goes when the editor closes: back to the description block
   * (`keyboard-focus-map.md:91`), but only when the human closed it themselves.
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

  const titleField = useAutoGrow(titleDraft);
  const commentField = useAutoGrow(commentDraft);

  const ticket = detail?.ticket;
  /**
   * How many boxes are ticked, counted once. The heading's fraction and the
   * meter beside it are two readings of the same number, and an optimistic tick
   * moves it before the write returns — counting it twice is two chances for
   * them to disagree in front of the human (D-3D).
   */
  const checkedCount = ticket?.checklist.filter(isChecked).length ?? 0;

  /**
   * The checklist as the human is looking at it: the file's items, in the order
   * they last left them (LC-185). Everything below reads its indices off this
   * one list, so a drop lands where the row *is* rather than where the file
   * still says it is while the write is out.
   */
  const checklist = heldOrder(ticket?.checklist ?? [], pending.order);
  /**
   * The comment records, for the tab that is about them (LC-211). Filtered by
   * kind rather than by shape: an unfamiliar kind is drawn as a message too, and
   * filing one under Comments would be this build claiming to know what it is.
   */
  const comments = (ticket?.activity ?? []).filter((event) =>
    isComment(event.kind),
  );
  /**
   * Whether the list can be reordered at all.
   *
   * A move names the row it lands under, and a task an agent appended as plain
   * Markdown has no id to be named by — so a list holding one has landings that
   * cannot be written down, and the one that cannot is the row *above* the
   * landing rather than the row being dragged. That is not a distinction worth
   * asking a human to hold, so the whole list waits, exactly as long as the
   * boxes beside those rows do: the next write adopts every id.
   */
  const reorderable =
    checklist.length > 1 && checklist.every((item) => item.id !== undefined);
  /**
   * The add-row follows the list down as it grows, so the field the human is
   * typing in does not end up under the bottom edge of the panel (LC-193).
   */
  const addField = useAddRowInView(checklist.length);

  /** Puts the list in the order the human left it; the file catches up. */
  function holdOrder(order: string[]): () => void {
    setPending((current) => ({ ...current, order }));
    return () => setPending((current) => ({ ...current, order: undefined }));
  }

  /**
   * The row being retyped, by id, and nothing else: the text lives in the field
   * itself until it is committed, so a keystroke does not re-render the list.
   */
  const [editingItem, setEditingItem] = useState<string>();

  /**
   * Writes one row's new wording (LC-215).
   *
   * The id is what makes this an edit rather than a delete and an add: the box
   * keeps its state, the row keeps its place, and the history keeps its subject.
   * A commit that changed nothing writes nothing — Rust would refuse it as an
   * edit that matches the file, and a refusal is not what closing a field means.
   */
  function editRow(itemId: string, was: string, text: string) {
    setEditingItem(undefined);
    const next = text.trim();
    if (!next || next === was) return;
    void save(
      { editChecklistItem: { itemId, text: next } },
      {
        toast: `${ticketKey} reworded · ${next}`,
        inverse: { editChecklistItem: { itemId, text: was } },
        inverseToast: `${ticketKey} wording restored · ${was}`,
      },
    );
  }

  /**
   * Takes one row out of the list, and offers it back (LC-215).
   *
   * The undo is a restore rather than an append, because an append lands at the
   * end and the row was not at the end. It names the row it followed for the
   * reason a move does: by the time undo is pressed the list may have grown a
   * row, and a neighbour still means the same place when an index does not.
   *
   * The removed row is not held optimistically. A tick can be shown before the
   * file agrees because a box that snaps back is a box; a row that vanished and
   * came back is the list rearranging itself twice.
   */
  function removeRow(index: number) {
    const item = checklist[index];
    const itemId = item.id;
    if (!itemId) return;
    void save(
      { removeChecklistItem: itemId },
      {
        toast: `${ticketKey} removed · ${item.text}`,
        inverse: {
          restoreChecklistItem: {
            text: item.text,
            after: checklist[index - 1]?.id ?? null,
            checked: isChecked(item),
          },
        },
        inverseToast: `${ticketKey} restored · ${item.text}`,
      },
    );
  }

  /**
   * Writes one row's new place, wherever the gesture came from.
   *
   * Both gestures end here because they are one change — and because the undo
   * has to be the same one either way (`states.md:62-63`): the toast says which
   * row moved, and `⌘Z` puts it back under the row it came from.
   */
  function moveRow(from: number, to: number) {
    const ids = checklist
      .map((item) => item.id)
      .filter((id) => id !== undefined);
    if (ids.length !== checklist.length) return;
    const decided = moveOf(ids, from, to);
    if (!decided) return;
    const next = reordered(ids, from, to);
    const text = checklist[from].text;
    void save(
      { moveChecklistItem: decided.move },
      {
        apply: () => holdOrder(next),
        toast: `${ticketKey} moved · ${text}`,
        inverse: { moveChecklistItem: decided.inverse },
        inverseToast: `${ticketKey} order restored · ${text}`,
      },
    );
  }

  /** The row an event happened on, by the id its element carries. */
  function rowIndexAt(target: EventTarget | null): number {
    const row = (target as HTMLElement | null)?.closest?.(".checklist-row");
    const id = (row as HTMLElement | null)?.dataset.itemId;
    return id === undefined
      ? -1
      : checklist.findIndex((item) => item.id === id);
  }

  function pickUpRow(event: DragEvent<HTMLElement>) {
    const index = rowIndexAt(event.target);
    if (!reorderable || index < 0) return;
    // WebKit will not start a drag with an empty data transfer (`dragging.ts`).
    event.dataTransfer?.setData("text/plain", checklist[index].id ?? "");
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    setDragItem(checklist[index].id);
  }

  function overRow(event: DragEvent<HTMLElement>) {
    if (dragItem === undefined) return;
    const gap = gapUnder(event, rowIndexAt);
    if (gap === undefined) return;
    // Without this the drop never fires: the default is "this is not a target".
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    // `dragover` fires many times a second over the same gap, and an unchanged
    // number is a render React can skip.
    setDropGap((current) => (current === gap ? current : gap));
  }

  function dropRow(event: DragEvent<HTMLElement>) {
    const gap = gapUnder(event, rowIndexAt);
    const from = checklist.findIndex((item) => item.id === dragItem);
    endDrag();
    if (gap === undefined || from < 0) return;
    event.preventDefault();
    moveRow(from, landingFor(from, gap));
  }

  function endDrag() {
    setDragItem(undefined);
    setDropGap(undefined);
  }

  /**
   * `⌥↑` / `⌥↓` on a row, which is the whole of the keyboard's reorder
   * (`keyboard-focus-map.md:62`). The row keeps focus across the move because
   * React keys the list by item id and moves the node rather than rewriting it.
   */
  function moveByKey(event: ReactKeyboardEvent<HTMLElement>) {
    if (!event.altKey || event.metaKey || event.ctrlKey) return;
    const step =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0 || !reorderable) return;
    const from = rowIndexAt(event.target);
    const to = from + step;
    if (from < 0 || to < 0 || to >= checklist.length) return;
    event.preventDefault();
    moveRow(from, to);
  }

  /**
   * A file that will not parse gets the modal the spec draws rather than this
   * panel (`screen-specs.md:349-356`, D-51 / LC-134), so it is returned instead
   * of the panel and not inside it: the panel is a surface for editing a ticket,
   * and there is no ticket here to edit.
   *
   * The panel is still the thing that reads the file, and everything the modal
   * offers is the panel's — the load, the retry, the editor hand-off, the
   * `Esc` that closes the layer. What changes is only what is drawn.
   *
   * The question is asked of the file rather than of the index row:
   * `props.degradedPath` is only what the board believed when the card was
   * clicked, and all it buys is opening the modal *while the read is out*, so a
   * degraded card does not flash a panel on its way to one. Which surface is
   * finally drawn is the read's answer, in both directions — a row the index
   * still calls readable whose file has since broken lands here too.
   *
   * The path is the same answer as the surface, so it is one value: the file
   * the modal is about, from the read when it has come back and from the row
   * the card was drawn from until then. The heading is the *full* path
   * (`screen-specs.md:351`), and taking the row's half means it is the full one
   * from the first frame rather than a directory name that grows into a path
   * when the read lands.
   */
  const rawFilePath =
    unavailable || ticket
      ? undefined
      : (detail?.relativePath ?? props.degradedPath);

  /**
   * The banner, the fraction, the meter and the ticked rows are one
   * acknowledgement of one external write, so they read one mark and settle
   * together.
   *
   * `externallyCheckedIds` only knows *which* rows a write ticked — it is a
   * before/after
   * diff of the checklist and never sees an actor — so on its own it dressed an
   * unclaimed change in agent green directly under this panel's warn banner,
   * which is D-62's "two vocabularies" a second time (LC-148). Gating on the
   * mark also gives the rows the banner's lifetime: they used to outlive it and
   * sit there green with nothing left on screen saying who.
   */
  const accentClass = props.mark && acknowledgementClass(props.mark.actorType);
  const acknowledgedChecks = props.mark ? externallyCheckedIds : [];
  const checklistAcknowledged = acknowledgedChecks.length > 0;
  // The effect below wants the transition, not the path: a re-read of the same
  // broken file returns an equal string and must not re-run it.
  const showingRawFile = rawFilePath !== undefined;

  /**
   * Where focus goes when the file parses under the modal — a retry that
   * worked, or the watcher arriving with a fixed file.
   *
   * The modal is replaced by the panel, so the control focus was on is gone
   * from the document, and focus with nowhere to go lands on `<body>`: the
   * layer changed under a human who is now standing outside both
   * (`keyboard-focus-map.md:16-18`). The panel takes it, which is where the
   * panel's own open puts it.
   */
  const wasShowingRawFile = useRef(false);
  useEffect(() => {
    if (wasShowingRawFile.current && !showingRawFile) panelRef.current?.focus();
    wasShowingRawFile.current = showingRawFile;
  }, [showingRawFile]);

  if (rawFilePath !== undefined) {
    return (
      <RawFileView
        detail={detail}
        path={rawFilePath}
        ticketKey={ticketKey}
        projectPath={props.projectPath}
        retrying={retrying}
        onRetry={() => void retryParse()}
        onOpenInEditor={() => void openInEditor()}
        onClose={props.onClose}
      />
    );
  }

  return (
    <aside
      className="ticket-panel"
      aria-label={`Ticket ${ticketKey}`}
      ref={panelRef}
      tabIndex={-1}
    >
      <header className="panel-header">
        <IdChip ticketKey={ticketKey} />
        {detail && <TicketPathChip path={detail.relativePath} />}
        {/* The path is the chip's, so this one is only ever the news: writing,
            or the ✓ that stands briefly after (`states.md:178-180`). `idle` is
            still the file it belongs to, which is what keeps another ticket's
            settled mark out of this header. */}
        <WriteIndicator idle={detail?.relativePath} transient />
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
          className={classes(
            "panel-acknowledgement",
            props.mark.actorType === "unknown" && "unattributed",
          )}
        >
          {acknowledgementInFull(props.mark, props.now)}
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
      ) : /* A file with no ticket in it left through the raw-file modal above;
             this arm is how the fields below know they have one. */
      !ticket ? null : (
        <>
          <textarea
            className="panel-title"
            ref={titleField}
            value={titleDraft}
            // One row, then as many as the title needs: the field carries no
            // resize grabber, so `rows` is a floor and not the size (LC-108).
            rows={1}
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
          </div>

          <section className="panel-section description-block">
            <h3>
              Description
              {/* The affordance lives in the header row, where none of the
                  ticket's own text can be under it (LC-99).

                  The prototype renders it whenever the editor is closed and
                  makes the body a click target too (`prototype.js:718-725`).
                  Here the empty state is a button in its own right rather than
                  a `div` with a click handler, so the header stays bare there:
                  one editor behind two Tab stops, one of them named `Edit` for
                  a description that does not exist yet, is worse than the
                  invitation already on screen. */}
              {!editingDescription && ticket.description ? (
                <button
                  tabIndex={0}
                  className="ghost small description-edit"
                  ref={editButton}
                  aria-label="Edit description"
                  onClick={() => openDescriptionEditor(ticket.description)}
                >
                  <PencilGlyph />
                  Edit
                </button>
              ) : null}
            </h3>
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
                className={classes(
                  "section-count",
                  checklistAcknowledged && "acknowledged",
                  checklistAcknowledged && accentClass,
                )}
              >
                {checkedCount}/{ticket.checklist.length}
              </span>
              {/* The meter the cards have always had, in the panel too
                  (`screen-specs.md:241-242`, D-3D): the fraction is the exact
                  answer and this is the one a glance gives. It reads the same
                  count the fraction does, so it cannot disagree with the number
                  beside it while a tick's write is still out. It wears the
                  accent of whoever the file said made the change, for the same
                  reason an acknowledged card's does — the change the acknowledgement is
                  about is usually this. Hidden from the reading, because the
                  fraction beside it already says it in words. */}
              {ticket.checklist.length > 0 && (
                <span
                  className={classes(
                    "progress panel-progress",
                    checklistAcknowledged && "acknowledged",
                    checklistAcknowledged && accentClass,
                  )}
                  aria-hidden="true"
                >
                  <i
                    style={{
                      width: `${Math.round(
                        (checkedCount / ticket.checklist.length) * 100,
                      )}%`,
                    }}
                  />
                </span>
              )}
            </h3>
            <ul
              className="checklist"
              onDragStart={pickUpRow}
              onDragOver={overRow}
              onDrop={dropRow}
              onDragEnd={endDrag}
              onDragLeave={(event) => {
                // Leaving for a row of the same list is not leaving; the next
                // `dragover` would put the line back a frame later, which reads
                // as a flicker under the pointer.
                if (event.currentTarget.contains(event.relatedTarget as Node))
                  return;
                setDropGap(undefined);
              }}
              onKeyDown={moveByKey}
            >
              {checklist.map((item, index) => {
                const acknowledged =
                  item.id !== undefined && acknowledgedChecks.includes(item.id);
                const checked = isChecked(item);
                return (
                  <li
                    key={item.id ?? `unadopted-${index}`}
                    data-item-id={item.id}
                    draggable={reorderable}
                    // `checked` carries the settled treatment — `ink-3` and a
                    // line through the text (`components.md:218`). The
                    // acknowledgement is
                    // the state above it and takes both back, because a row
                    // something outside just ticked is news to read, not a line
                    // to skip.
                    className={classes(
                      "checklist-row",
                      reorderable && "draggable",
                      item.id === dragItem && "dragging",
                      dropEdge(index, checklist.length, dropGap),
                      checked && "checked",
                      acknowledged && "acknowledged",
                      acknowledged && accentClass,
                    )}
                  >
                    {/* The affordance, not the mechanism: the row is what is
                        draggable, and this is what says so. Decorative, because
                        the keyboard's way in is `⌥↑`/`⌥↓` on the row itself
                        (`keyboard-focus-map.md:62`) — a grip that took a Tab
                        stop of its own would put a second stop on every row to
                        offer what the row already answers. */}
                    {reorderable && (
                      <span className="row-grip" aria-hidden="true">
                        ⠿
                      </span>
                    )}
                    {editingItem !== undefined && editingItem === item.id ? (
                      <RowEditor
                        text={item.text}
                        onCommit={(next) => editRow(item.id!, item.text, next)}
                        onCancel={() => setEditingItem(undefined)}
                      />
                    ) : (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            // The row's own Tab stop, and the only one it has. A
                            // checkbox is skipped by WebKit on a default Mac
                            // exactly as a button is (`tab-order-guard.mjs`), so
                            // without this the rows are pointer-only — against the
                            // panel's Tab order and the two gestures bound to a
                            // focused row (`keyboard-focus-map.md:61-62`). The
                            // accessibility audit found it while proving `⌥↓`
                            // reachable, which it was not (LC-185).
                            tabIndex={0}
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
                        {/* The glyph is the actor's, like every other one the app
                        draws: a row an unclaimed write ticked gets the warn
                        triangle, not the agent's chevron (LC-148). */}
                        {acknowledged && props.mark && (
                          <em
                            className={classes(
                              "acknowledged-note",
                              accentClass,
                            )}
                          >
                            {actorGlyph(props.mark.actorType)} just now
                          </em>
                        )}
                        {/* Both gestures need an id to name the row by, and an
                        agent's plain Markdown task has none until the next
                        write adopts it — the same reason its box is disabled
                        (LC-215). */}
                        {item.id !== undefined && (
                          <RowActions
                            text={item.text}
                            onEdit={() => setEditingItem(item.id)}
                            onRemove={() => removeRow(index)}
                          />
                        )}
                      </>
                    )}
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
                // Enter appends and leaves focus where it is, for rapid entry
                // (`keyboard-focus-map.md:63`) — nothing here blurs the field.
                setNewItem("");
                // Queued rather than written, because the field is cleared
                // either way and a write already out would otherwise refuse this
                // one silently (LC-193). It goes now if the disk is free.
                queuedItems.current.push(text);
                void drainNewItems();
              }}
            >
              <GhostBox />
              <input
                className="checklist-add-field"
                ref={addField}
                value={newItem}
                placeholder="Add a checklist item"
                aria-label="Add a checklist item"
                onChange={(event) => setNewItem(event.target.value)}
              />
            </form>
          </section>

          {/* Two tabs over one record (LC-211). Comments were entries in the
              merged stream, where a run of agent status changes buried the one
              thing a person had written; the stream is still whole under
              Activity, with each comment as the line that says it happened. */}
          <section className="panel-section">
            <HistoryTabs
              tab={historyTab}
              onPick={setHistoryTab}
              /* The count of what is on screen, not of what the file holds
                 (LC-109): posting is optimistic, so the pending comment is an
                 entry in the stream and has to be an entry in the count. A tab
                 that said one fewer than the reader can see would be the one
                 place the panel argued with itself. */
              activityCount={ticket.activity.length + (pendingComment ? 1 : 0)}
              commentCount={comments.length + (pendingComment ? 1 : 0)}
            />
            {historyTab === "activity" ? (
              <div
                role="tabpanel"
                id="panel-tab-activity"
                aria-labelledby="tab-activity"
              >
                {/* Here rather than beside the comments: an entry the file is
                    missing is a hole in the record, and the record is this
                    tab. */}
                {ticket.historyIncomplete && (
                  <p className="history-note">
                    This ticket changed without a matching activity entry. The
                    state stands; the history is incomplete.
                  </p>
                )}
                <Timeline
                  events={ticket.activity}
                  now={props.now}
                  // So a change event names a label and a checklist item rather
                  // than the slug and the id the record carries.
                  labels={props.labels}
                  checklist={ticket.checklist}
                  commentsAsLines
                  // Drawn under both tabs, because it is the one entry that is
                  // not a record yet and a tab counting something the reader
                  // cannot see is the argument LC-109 settled.
                  pendingComment={pendingComment}
                />
              </div>
            ) : (
              <div
                role="tabpanel"
                id="panel-tab-comments"
                aria-labelledby="tab-comments"
              >
                <Timeline
                  events={comments}
                  now={props.now}
                  labels={props.labels}
                  checklist={ticket.checklist}
                  pendingComment={pendingComment}
                />
              </div>
            )}
            {/* Outside both panels, because it belongs to neither: posting is
                the panel's action, and a composer that lived under Comments
                would put a click between reading what an agent did and saying
                something about it. */}
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
              {/* Actor identity, which ADR 0001 permits and `screen-specs.md:248`
                  asks for. It is not an assignee and there is no assignee. */}
              <span className="actor-tile" aria-hidden="true">
                •
              </span>
              <textarea
                ref={commentField}
                value={commentDraft}
                // Auto-growing, within reason: the field grows to its text and
                // the stylesheet caps it, because the panel scrolls and a long
                // comment should not push the timeline off screen entirely.
                rows={1}
                // The shortcut is named where it is used, because the button
                // that used to stand for the action is no longer on screen
                // until there is text to post (`prototype.js:752` carries the
                // same hint for the same reason).
                placeholder="Leave a comment… ⌘↵ to post"
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
              {/* ⌘↵ posts, so the button is the second way in rather than the
                  first, and it arrives with the text it would post (LC-107). A
                  disabled button standing over an empty field was a control
                  that could never be pressed and a Tab stop that led nowhere;
                  the quiet variant is the one the prototype gives this exact
                  control (`prototype.js:753`, `btn btn-secondary btn-sm`). */}
              {commentDraft.trim() ? (
                <button tabIndex={0} className="secondary small" type="submit">
                  Comment
                </button>
              ) : null}
            </form>
          </section>
        </>
      )}
    </aside>
  );
}
