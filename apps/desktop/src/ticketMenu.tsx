/**
 * What right-clicking a ticket offers (LC-222, LC-227).
 *
 * A pure function of the ticket, the project's configuration and the day,
 * deliberately: the board and the list both open this menu, and two lists built
 * in two places are two lists that drift. It is the same bargain
 * `metaOptions.tsx` strikes for the status, priority and type rows — which are
 * exactly what this reuses for three of its submenus, so the values a card can
 * be moved to are the values the panel offers, always.
 *
 * The ticket asked for three rows: a status submenu, a priority submenu, and the
 * file path. It also asked *what else*, and the answer is bounded by a rule —
 * only actions the app already has, reachable from somewhere else, so the menu
 * is a shortcut rather than a second place where things are decided. That admits
 * archiving it (the palette) and copying the key (the panel's chip). It excludes
 * labels, which no surface but the panel can write today, and deleting, which
 * the app does not do at all.
 *
 * The four opt-in properties join them under the same rule and one more of
 * their own: **a row exists only for a property the project has enabled**
 * (LC-227). They all ship off, so the menu a default project draws is exactly
 * the five rows above, and a project that turns everything on gets nine. That
 * is the only reason four more rows are affordable here at all. The one row
 * that does not decide anything is `Pick a date…`, which declines to grow a
 * calendar inside a popover and hands the day to the panel's own control.
 *
 * An `Open ticket` row was here and came off: the card is a `<button>` and a
 * left-click on it already opens the panel, so the row spent the top of the
 * menu — and its first keyboard stop — on the one action a person right-clicking
 * a ticket has demonstrably not chosen. A degraded file keeps its `Open file`,
 * which is not the same offer: the row it belongs to opens a raw file view, and
 * that row is the only other thing the menu has to say.
 *
 * Nothing here writes. Every row raises what it means to `App`, which owns
 * `mutate()`, exactly as the `S`/`P` menu does.
 */

import type { ReactNode } from "react";
import { CalendarGlyph } from "./DateField";
import { FolderGlyph } from "./FolderGlyph";
import type { MenuItem } from "./MenuList";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, typeOptions } from "./metaOptions";
import { PriorityGlyph } from "./PriorityGlyph";
import {
  addDays,
  displayDate,
  enabledPropertyFields,
  estimateScale,
  fromIso,
  PROPERTY_LABELS,
  readEstimate,
  startOfDay,
  toIso,
} from "./properties";
import { StatusDot } from "./StatusDot";
import { isArchived, priorityLabel, statusLabel } from "./tickets";
import { ArchiveGlyph, CopyGlyph, OpenGlyph } from "./TicketMenuGlyphs";
import type {
  IndexedTicket,
  PropertiesConfig,
  TicketPriority,
  TicketProperty,
  TicketRow,
  TicketStatus,
} from "./types";

/** What the rows raise. The surface wires each to `App` and closes the menu. */
export interface TicketMenuActions {
  /** The degraded menu's `Open file`, which is the only row that still opens. */
  onOpen: () => void;
  onChangeStatus: (next: TicketStatus) => void;
  onChangePriority: (next: TicketPriority) => void;
  /** One of the four opt-in properties set, or cleared with `undefined`. */
  onChangeProperty: (
    property: TicketProperty,
    next: string | undefined,
  ) => void;
  /**
   * `Pick a date…`: the menu giving up and handing the job to the panel, which
   * is what keeps a calendar out of a popover.
   *
   * The two dates only, because they are the only submenus that offer the row:
   * a type is its project's whole vocabulary and an estimate is its scale, and
   * neither has a value off the list to escape to.
   */
  onPickDate: (property: "due" | "start") => void;
  onArchive: () => void;
  onCopyKey: () => void;
  onCopyPath: () => void;
}

/**
 * What the project has turned on, and the day a quick pick resolves against.
 *
 * One argument rather than two, because they travel together and always will:
 * every row this adds is a row a project enabled, and every date it offers is
 * a date relative to a `today` this app injects rather than reads.
 */
export interface TicketMenuContext {
  properties: PropertiesConfig;
  today: number;
}

export function ticketMenuItems(
  ticket: TicketRow,
  run: TicketMenuActions,
  context: TicketMenuContext,
): MenuItem[] {
  const copyPath: MenuItem = {
    kind: "action",
    id: "copy-path",
    label: "Copy file path",
    glyph: <FolderGlyph />,
    run: run.onCopyPath,
  };

  // A file that would not read has no status to move, no priority to set, no
  // archived flag to turn over and no key worth copying — its `key` is the
  // directory's name, which nothing has vetted. What it has is a path, and a
  // path is most of the reason to right-click one.
  if (ticket.state === "degraded") {
    return [
      {
        kind: "action",
        id: "open",
        label: "Open file",
        glyph: <OpenGlyph />,
        run: run.onOpen,
      },
      { kind: "rule", id: "open-rule" },
      copyPath,
    ];
  }

  return [
    {
      kind: "submenu",
      id: "status",
      label: "Move to",
      glyph: <StatusDot status={ticket.status} decorative />,
      hint: statusLabel(ticket.status),
      items: STATUS_OPTIONS.map((option) => ({
        kind: "choice",
        id: `status-${option.id}`,
        label: option.label,
        glyph: option.glyph,
        checked: option.id === ticket.status,
        run: () => run.onChangeStatus(option.id),
      })),
    },
    {
      kind: "submenu",
      id: "priority",
      label: "Priority",
      glyph: <PriorityGlyph priority={ticket.priority} decorative />,
      hint: priorityLabel(ticket.priority),
      items: PRIORITY_OPTIONS.map((option) => ({
        kind: "choice",
        id: `priority-${option.id}`,
        label: option.label,
        glyph: option.glyph,
        checked: option.id === ticket.priority,
        run: () => run.onChangePriority(option.id),
      })),
    },
    // The properties go under the two rows they read with rather than under the
    // archive rule: these say what the ticket *is*, and everything below the
    // rule is something done to it.
    ...propertyRows(ticket, run, context),
    { kind: "rule", id: "archive-rule" },
    {
      kind: "action",
      id: "archive",
      // Named for what pressing it does, not for what is true now — the same
      // way the project menu's star row is.
      label: isArchived(ticket) ? "Unarchive ticket" : "Archive ticket",
      glyph: <ArchiveGlyph />,
      run: run.onArchive,
    },
    { kind: "rule", id: "copy-rule" },
    {
      kind: "action",
      id: "copy-key",
      label: "Copy key",
      glyph: <CopyGlyph />,
      // Mono, the way a key is set everywhere else it is shown: on the card,
      // on the panel's chip, in the palette's search rows.
      hint: <code>{ticket.key}</code>,
      run: run.onCopyKey,
    },
    copyPath,
  ];
}

/**
 * A mark slot with nothing in it.
 *
 * `.menu-glyph` is a fixed 14px box, and a row that skips it starts 22px left
 * of its neighbours — which on a nine-row menu reads as a mistake rather than
 * as an absence. Estimate is the one row here with no mark to draw: every other
 * row wears its current value's own, and a size has none. `Clear` and the date
 * picks are the same case one rung down.
 */
const NO_MARK = <span />;

/**
 * The four days a date submenu offers, and the reason it needs no calendar.
 *
 * Each row says the day it resolves to, so nothing is computed silently — which
 * is the whole of the objection the typed grammar raises against `next week`.
 * Refusing to *parse* a computed phrase and offering it as a row a person points
 * at are different acts, and only the first one guesses.
 *
 * `due` and `start` are handed the same four. Two adjacent controls whose
 * vocabulary differs is what the grammar section already refused for the typed
 * forms, and the argument is unchanged one surface over.
 */
function datePicks(today: number): { id: string; label: string; day: Date }[] {
  const from = startOfDay(today);
  // The next one, never today: a Monday asking for `Next Monday` means the one
  // after this.
  const monday = (8 - from.getDay()) % 7 || 7;
  return [
    { id: "today", label: "Today", day: from },
    { id: "tomorrow", label: "Tomorrow", day: addDays(from, 1) },
    { id: "monday", label: "Next Monday", day: addDays(from, monday) },
    { id: "week", label: "In a week", day: addDays(from, 7) },
  ];
}

/**
 * A submenu per property the project has turned on — and none at all for a
 * project that has turned none on, which is every project written before this
 * build and the only reason four more rows are affordable here.
 *
 * `enabledPropertyFields` rather than a list written out: the panel's rail,
 * full create and quick create already read the four in that order, and a
 * fourth surface with an order of its own is the disagreement that function
 * exists to prevent. The prototype drew estimate last; the rail draws it
 * second, and one order across four surfaces is worth more than the
 * prototype's grouping of the two dates.
 */
function propertyRows(
  ticket: IndexedTicket,
  run: TicketMenuActions,
  context: TicketMenuContext,
): MenuItem[] {
  return enabledPropertyFields(context.properties).map((property) => {
    const face = propertyFace(ticket, property, run, context);
    return {
      kind: "submenu",
      id: property,
      // The settings row's name rather than a control's: the four are listed
      // here with nothing beside them, and `Due` alone among `Move to` and
      // `Archive ticket` would not say what kind of thing it is.
      label: PROPERTY_LABELS[property].name,
      glyph: face.mark,
      hint: face.hint,
      items: [...face.values, ...clearRow(ticket, property, run)],
    };
  });
}

/**
 * One property's three answers, decided in one cascade: the mark the row
 * wears, what the row says before it is opened, and what the submenu offers.
 *
 * Together rather than a function each, because a fifth property — or a change
 * to what an estimate is — should be one branch to write and not three to find.
 * It is the bargain `PropertyControl.tsx` strikes for the same four one surface
 * over: the switch on *which* property this is lives in one place per surface.
 *
 * A value this project cannot read is shown as the file writes it rather than
 * as an empty slot: the bytes are preserved on disk (invariant 16), and a row
 * that showed nothing would say the ticket holds nothing.
 */
function propertyFace(
  ticket: IndexedTicket,
  property: TicketProperty,
  run: TicketMenuActions,
  context: TicketMenuContext,
): { mark: ReactNode; hint: string | undefined; values: MenuItem[] } {
  const held = ticket[property];
  if (property === "type") {
    const vocabulary = context.properties.type.values;
    const defined = held ? vocabulary[held] : undefined;
    return {
      // A slug nothing defines has no colour to draw, which is not the same as
      // holding nothing — the hint still says what the file holds.
      mark: defined ? (
        <span className={`label-dot label-${defined.color}`} />
      ) : (
        NO_MARK
      ),
      hint: held ? (defined?.name ?? held) : undefined,
      // The same registry the panel, full create and quick create read, minus
      // its `None` row: clearing is the rule's own row below, under the word
      // every other submenu uses for it.
      values: typeOptions(vocabulary)
        .filter((option) => option.id !== "")
        .map((option) => ({
          kind: "choice",
          id: `type-${option.id}`,
          label: option.label,
          glyph: option.glyph,
          checked: option.id === held,
          run: () => run.onChangeProperty("type", option.id),
        })),
    };
  }
  if (property === "estimate") {
    const config = context.properties.estimate;
    return {
      mark: NO_MARK,
      hint: readEstimate(held, config)?.text,
      values: estimateScale(config).map((value) => ({
        kind: "choice",
        id: `estimate-${value}`,
        // Rendered by the reader the rest of the app shows an estimate
        // through, so a t-shirt size is upper case here exactly as on a card.
        label: readEstimate(value, config)?.text ?? value,
        glyph: NO_MARK,
        checked: value === held,
        run: () => run.onChangeProperty("estimate", value),
      })),
    };
  }
  const day = held ? fromIso(held) : undefined;
  return {
    mark: <CalendarGlyph />,
    hint: held ? (day ? displayDate(day, context.today) : held) : undefined,
    values: [
      ...datePicks(context.today).map((pick) => ({
        kind: "choice" as const,
        id: `${property}-${pick.id}`,
        label: pick.label,
        glyph: NO_MARK,
        hint: displayDate(pick.day, context.today),
        // Compared as the format spells it, which is exact rather than a day
        // apart: `fromIso` accepts only the canonical shape, so a stored date
        // this build cannot read matches no pick — and it is not one of them.
        checked: held === toIso(pick.day),
        run: () => run.onChangeProperty(property, toIso(pick.day)),
      })),
      {
        kind: "action",
        id: `${property}-pick`,
        label: "Pick a date…",
        glyph: NO_MARK,
        // The way out, and what keeps a calendar out of a popover: anything
        // the four rows cannot reach is reached where the field and the picker
        // already live.
        run: () => run.onPickDate(property),
      },
    ],
  };
}

/**
 * `Clear`, under a rule, for a property that holds something.
 *
 * Clearing is first-class everywhere else this ticket touches, and a submenu
 * that can only ever *set* a property is a one-way door. Only where there is
 * something to clear: a row that cannot do anything is worse than no row,
 * because it says the ticket holds a value.
 */
function clearRow(
  ticket: IndexedTicket,
  property: TicketProperty,
  run: TicketMenuActions,
): MenuItem[] {
  if (!ticket[property]) return [];
  return [
    { kind: "rule", id: `${property}-clear-rule` },
    {
      kind: "action",
      id: `${property}-clear`,
      label: "Clear",
      glyph: NO_MARK,
      run: () => run.onChangeProperty(property, undefined),
    },
  ];
}
