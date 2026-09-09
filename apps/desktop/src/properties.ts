/**
 * The four opt-in ticket properties, as the app reads and writes them (LC-227).
 *
 * Rust carries these as raw strings and validates nothing about them on read: a
 * value the project's configuration cannot interpret is preserved rather than
 * corrected (`file_format.md` invariant 16). So every surface that wants one to
 * *mean* something comes here, and this module is the one place that decides
 * what a stored string means under a given project and a given day.
 *
 * Two rules run through all of it.
 *
 * **A date is a day, never an instant.** Everything works in local calendar
 * days, which is the whole reason `due` is not RFC 3339: a ticket due 28 Sep
 * goes overdue in Tokyo before it does in California, and that is correct for a
 * day-valued date rather than a defect.
 *
 * **A value this build cannot read is reported, never repaired.** A malformed
 * date reads as unreadable and keeps its bytes; an estimate written under
 * another system reads as foreign and is legible again the moment the project
 * switches back.
 */

import type {
  EstimateConfig,
  EstimateSystem,
  PropertiesConfig,
  TicketProperty,
  TicketRow,
  TicketStatus,
} from "./types";

/**
 * All four off, which is what a project file with no `properties:` block reads
 * as — every project written before this build, and every one created since
 * that has not turned one on.
 */
export const NO_PROPERTIES: PropertiesConfig = {
  type: { enabled: false, values: {} },
  due: { enabled: false, attentionDays: 7 },
  start: { enabled: false },
  estimate: {
    enabled: false,
    system: "tshirt",
    values: [],
    hoursPerDay: 8,
    daysPerWeek: 5,
  },
};

/** The four, in the order the format documents them. */
export const TICKET_PROPERTIES: TicketProperty[] = [
  "type",
  "due",
  "start",
  "estimate",
];

/**
 * What each property is called on screen, and what a ticket keeps when the
 * project turns it off — in both numbers, because the sentence is built around
 * a count and one is a number a project reaches.
 *
 * Here rather than at the two places that need them, because the settings row
 * and the write feedback say the same reassurance twice — "17 tickets keep their
 * dates" in the toast and beside the switched-off row — and two spellings of one
 * sentence is how they come to disagree.
 *
 * `name`, `field` and `said` are three names for one property and all three are
 * deliberate. `name` is the settings row's, where the four are listed with
 * nothing beside them. `field` is what a control's row wears — the panel's rail
 * and both create surfaces — and it names the property in full, because a row
 * label is read on its own before its neighbours are. `said` is the word a
 * write sentence uses, and it is the short one: the sentence already names the
 * ticket, so `LC-1 Due Date → 2026-09-20` says *date* twice.
 *
 * `field` was `Due` and `Start` until the copy deck was reviewed (LC-227,
 * 2026-09-09); the rows now read `Due Date` and `Start Date`. `said` is what
 * the old `field` was, kept for the sentence that still wants it.
 */
export const PROPERTY_LABELS: Record<
  TicketProperty,
  { name: string; field: string; said: string; kept: string; keptOne: string }
> = {
  type: {
    name: "Type",
    field: "Type",
    said: "Type",
    kept: "types",
    keptOne: "type",
  },
  due: {
    name: "Due date",
    field: "Due Date",
    said: "Due",
    kept: "dates",
    keptOne: "date",
  },
  start: {
    name: "Start date",
    field: "Start Date",
    said: "Start",
    kept: "dates",
    keptOne: "date",
  },
  estimate: {
    name: "Estimate",
    field: "Estimate",
    said: "Estimate",
    kept: "estimates",
    keptOne: "estimate",
  },
};

/** What each estimate system is called on screen. */
export const ESTIMATE_SYSTEMS: { id: EstimateSystem; label: string }[] = [
  { id: "tshirt", label: "T-shirt" },
  { id: "fibonacci", label: "Fibonacci" },
  { id: "duration", label: "Duration" },
];

/**
 * What a write to one of the four says it did, for the toast and its inverse.
 *
 * Two paths write these — the panel's rail through `save()`, and a card's
 * context menu through `mutate()` (LC-227) — and one sentence between them, so
 * the same act cannot be described two ways depending on where it was asked
 * for. `said` rather than `field` or `name`: the sentence already names the
 * ticket, and `LC-1 Due Date → 2026-09-20` says *date* twice.
 *
 * The value goes in verbatim, never reformatted. An inverse can carry a date in
 * a shape this project's configuration cannot read, and prettying that up would
 * say the file holds something it does not (invariant 16).
 */
export function propertyToast(
  ticketKey: string,
  property: TicketProperty,
  value: string | undefined,
): string {
  const name = PROPERTY_LABELS[property].said;
  return value === undefined
    ? `${ticketKey} ${name} cleared`
    : `${ticketKey} ${name} → ${value}`;
}

/** Whether the project has turned one property on. */
export function isPropertyEnabled(
  config: PropertiesConfig,
  property: TicketProperty,
): boolean {
  return config[property].enabled;
}

/**
 * Which of the four this project has turned on, in the order the format
 * documents. What a count is taken over, and what a surface mirroring the file
 * would read.
 *
 * A surface that *edits* them wants [`enabledPropertyFields`] instead — the
 * file's order and a control's order are not the same order.
 */
export function enabledProperties(config: PropertiesConfig): TicketProperty[] {
  return TICKET_PROPERTIES.filter((property) =>
    isPropertyEnabled(config, property),
  );
}

/**
 * The order a surface that offers all four puts them in: what the ticket *is*,
 * then what kind of work it is and how much, then when.
 *
 * Not the format's order, and the difference is the point. `type due start
 * estimate` is right for bytes and wrong for a person: it separates the two
 * dates with an estimate, and it puts Due above Start, when the pair reads
 * chronologically and the forward-only grammar is a trade made for exactly that
 * adjacency.
 */
export const PROPERTY_FIELDS: TicketProperty[] = [
  "type",
  "estimate",
  "start",
  "due",
];

/**
 * The ones this project turned on, in the order a control draws them. One
 * spelling for the panel's rail, full create and quick create, so three
 * surfaces cannot come to disagree about what order the four read in.
 */
export function enabledPropertyFields(
  config: PropertiesConfig,
): TicketProperty[] {
  return PROPERTY_FIELDS.filter((property) =>
    isPropertyEnabled(config, property),
  );
}

/**
 * How many of these tickets carry a value for each property.
 *
 * Off the rows rather than out of the project file, which is what makes the
 * count available *while the property is off*: a disabled property is still on
 * every ticket that had one, and the settings row saying so is then the only
 * place in the app that fact is visible. A degraded row is not counted, because
 * it has no fields to count — its bytes are on disk and unread.
 */
export function propertyCounts(
  tickets: TicketRow[],
): Record<TicketProperty, number> {
  const counts = { type: 0, due: 0, start: 0, estimate: 0 };
  for (const ticket of tickets) {
    if (ticket.state !== "indexed") continue;
    for (const property of TICKET_PROPERTIES) {
      if (ticket[property]) counts[property] += 1;
    }
  }
  return counts;
}

// ------------------------------------------------------------ calendar days

/** The local day `at` falls on, as a Date at local midnight. */
export function startOfDay(at: number | Date): Date {
  const date = typeof at === "number" ? new Date(at) : at;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
}

/**
 * The same day-of-month in another month, clamped to that month's length, so
 * stepping a calendar from 31 Jan lands on 28 Feb rather than 3 March.
 */
export function addMonths(day: Date, months: number): Date {
  const first = new Date(day.getFullYear(), day.getMonth() + months, 1);
  const lastDay = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  return new Date(
    first.getFullYear(),
    first.getMonth(),
    Math.min(day.getDate(), lastDay),
  );
}

/**
 * How long until the next local midnight, which is when every rung on screen
 * changes and nothing writes a file to say so.
 *
 * Calendar arithmetic rather than `now + 86_400_000`: a day is 23 or 25 hours
 * twice a year, and a timer set to a fixed day length drifts across both of
 * those and then keeps the drift. The extra second is so a timer armed with
 * this never fires a hair early and reads the same day again — which would
 * leave a board a whole day behind until something else re-rendered it.
 */
export function untilNextDay(now: number): number {
  return addDays(startOfDay(now), 1).getTime() - now + 1_000;
}

/** Whole calendar days between two days, signed. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

/** The canonical on-disk form, and the only form the CLI accepts. */
export function toIso(day: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/**
 * A stored date, or `undefined` for anything that is not one.
 *
 * Strict about width and about the calendar: `2026-9-8` is refused because only
 * one of the two spellings sorts as text, and `2026-02-31` is refused rather
 * than silently becoming 3 March. Both come back as unreadable rather than as
 * a repair, which is what keeps the bytes on disk.
 */
export function fromIso(text: string): Date | undefined {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!parts) return undefined;
  const [, year, month, day] = parts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return undefined;
  }
  return date;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ------------------------------------------------------------------ display

/**
 * What a **card** shows: `28 Sep`, and `28 Sep 2027` when the year is not the
 * current one.
 *
 * Day-then-month is a choice rather than a deduction — there is no `Intl` call
 * anywhere in this app and every age it prints is hand-formatted — and it is
 * the input grammar's mirror, so what is displayed is a form the grammar reads.
 */
export function displayDate(day: Date, now: number): string {
  const month = MONTHS[day.getMonth()].slice(0, 3);
  const year =
    day.getFullYear() === new Date(now).getFullYear()
      ? ""
      : ` ${day.getFullYear()}`;
  return `${day.getDate()} ${month}${year}`;
}

/**
 * What a **field** shows, which is not the same thing.
 *
 * "What is displayed is a form the grammar reads" is true of `displayDate` and
 * it is not enough, because a form with no year means the nearest *future*
 * occurrence. A ticket due 5 Sep 2026 opened on 8 Sep 2026 renders `5 Sep`,
 * which the grammar reads back as **5 Sep 2027** — so the field would be
 * showing a string that does not mean the day it is showing it for, and the
 * first person to retype what is already in front of them moves the date a year
 * without being told.
 *
 * So a field carries the year whenever the value would not round-trip without
 * it: when it is not in the current year, **or when it is in the past**. A card
 * needs none of this, because nobody types into a card.
 */
export function fieldDate(day: Date, now: number): string {
  const today = startOfDay(now);
  const roundTrips =
    day.getFullYear() === today.getFullYear() && daysBetween(today, day) >= 0;
  const month = MONTHS[day.getMonth()].slice(0, 3);
  return `${day.getDate()} ${month}${roundTrips ? "" : ` ${day.getFullYear()}`}`;
}

/**
 * The echo's fuller form — `Tue 28 Sep 2027` — which is what makes the year
 * rule visible while somebody is typing.
 */
export function echoDate(day: Date): string {
  const month = MONTHS[day.getMonth()].slice(0, 3);
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${month} ${day.getFullYear()}`;
}

/** The month a calendar grid is headed with. */
export function monthName(day: Date): string {
  return MONTHS[day.getMonth()];
}

// -------------------------------------------------------------- the grammar

export type ParsedDate =
  | { kind: "empty" }
  | { kind: "date"; date: Date }
  | { kind: "refused"; why: string };

/**
 * One rule generates all of it: **the month is named, or the order is ISO.**
 *
 * A date input's worst failure is not refusing something a person meant — they
 * see that and retype it — but silently storing a different day from the one
 * they meant. So every form that would need a locale to resolve is refused, and
 * everything a named month makes unambiguous is accepted.
 *
 * `why` is a whole sentence rather than a code, because it is the only thing
 * the person sees and each refusal has a different next move.
 *
 * Parsing happens on commit — Enter or blur — never per keystroke: `28 Se` is
 * not a state worth reporting on.
 */
export function parseDate(raw: string, now: number): ParsedDate {
  const text = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!text) return { kind: "empty" };

  // The two words a person types *instead* of thinking, rather than words that
  // ask the app to think. Resolved against the same injected `now` the rungs
  // use, so nothing here reads the clock on its own.
  const today = startOfDay(now);
  if (text === "today") return { kind: "date", date: today };
  if (text === "tomorrow") return { kind: "date", date: addDays(today, 1) };

  // Anything carrying a time. Accepting one only to drop it would store
  // something other than what was typed.
  if (/\d\s*(?::\d|am\b|pm\b)|\bt\d{2}:/.test(text)) {
    return {
      kind: "refused",
      why: "A date here is a day, with no time on it.",
    };
  }

  const isoDate = fromIso(text);
  if (isoDate) return { kind: "date", date: isoDate };
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    return {
      kind: "refused",
      why: "That day does not exist. ISO dates are YYYY-MM-DD.",
    };
  }

  // All-numeric forms that are not ISO. This is the rule's whole reason: the
  // app has no locale, so nothing in it can say whether `3/4` is March or
  // April, and a guess would be silently wrong for half the world.
  if (/^\d+[\s\-/.][\d\s\-/.]*$/.test(text)) {
    return {
      kind: "refused",
      why: "Numeric dates are read as YYYY-MM-DD only. Try 28 Sep, or 2026-09-28.",
    };
  }

  const separator = "[\\s\\-/]+";
  const dayPart = "(\\d{1,2})(?:st|nd|rd|th)?";
  const monthPart = "([a-z]+)";
  const yearPart = "(\\d{2,4})";
  const tail = `(?:,?${separator}${yearPart})?$`;

  let day: string | undefined;
  let monthText: string | undefined;
  let year: string | undefined;
  const dayFirst = new RegExp(
    `^${dayPart}${separator}${monthPart}${tail}`,
  ).exec(text);
  if (dayFirst) [, day, monthText, year] = dayFirst;
  const monthFirst =
    dayFirst ??
    new RegExp(`^${monthPart}${separator}${dayPart}${tail}`).exec(text);
  if (!dayFirst && monthFirst) [, monthText, day, year] = monthFirst;

  if (!monthFirst) {
    // A month with no day, and the weekday and relative family, each named so
    // the field says what to do next rather than only that it failed. What
    // falls past both is the general refusal, which names no next move: the
    // placeholder is already `28 Sep` (LC-227, copy review 2026-09-09).
    if (MONTHS.some((name) => isMonthWord(name, text))) {
      return {
        kind: "refused",
        why: "Which day? A month on its own is not a date.",
      };
    }
    if (
      /^(mon|tues?|wed|thur?s?|fri|sat|sun)/.test(text) ||
      /^(next|last|in )/.test(text)
    ) {
      return {
        kind: "refused",
        why: "Dates are typed, not computed. Try 28 Sep, or use the calendar.",
      };
    }
    return {
      kind: "refused",
      why: "Invalid date format.",
    };
  }

  const monthIndex = MONTHS.findIndex((name) =>
    isMonthWord(name, monthText as string),
  );
  if (monthIndex < 0) {
    return {
      kind: "refused",
      why: "Invalid date format.",
    };
  }

  // Two-digit years. Unambiguous on their own, and the habit that produces
  // `9/28/26`.
  if (year !== undefined && year.length !== 4) {
    return { kind: "refused", why: "Write the year in full — 28 Sep 2026." };
  }

  const dayNumber = Number(day);
  const resolve = (whichYear: number): Date | undefined => {
    const date = new Date(whichYear, monthIndex, dayNumber);
    return date.getMonth() === monthIndex && date.getDate() === dayNumber
      ? date
      : undefined;
  };

  if (year !== undefined) {
    const exact = resolve(Number(year));
    return exact
      ? { kind: "date", date: exact }
      : { kind: "refused", why: "That day does not exist in that month." };
  }

  // A form with no year means the nearest future occurrence, and **today counts
  // as future**: `28 Sep` typed on 28 Sep is today, not next year. Typed on
  // 5 Oct it means next year, and that is the price — the past is reachable by
  // typing the year, and it is both the rarer direction and the riskier one,
  // because a date that silently lands in the past reads as an overdue ticket
  // nobody created.
  const thisYear = resolve(today.getFullYear());
  if (thisYear && daysBetween(today, thisYear) >= 0) {
    return { kind: "date", date: thisYear };
  }
  const nextYear = resolve(today.getFullYear() + 1);
  if (nextYear) return { kind: "date", date: nextYear };
  // 29 Feb in a year that has no 29 Feb: walk forward to one that does, rather
  // than refusing a day that plainly exists.
  for (let ahead = 2; ahead <= 8; ahead += 1) {
    const later = resolve(today.getFullYear() + ahead);
    if (later) return { kind: "date", date: later };
  }
  return { kind: "refused", why: "That day does not exist in that month." };
}

function isMonthWord(name: string, text: string): boolean {
  const lower = name.toLowerCase();
  return lower === text || lower.slice(0, 3) === text;
}

// ---------------------------------------------------------------- the rungs

export type DueRung = "overdue" | "today" | "approaching" | "beyond";

/**
 * Which of the four rungs a due date is on, or `undefined` when there is no
 * readable date to be on one.
 *
 * **The rungs stand down on a ticket that is done, canceled or archived.** A
 * finished ticket that was due last week is not overdue, it is finished, and a
 * Done column drawn in `--lc-danger` teaches people to ignore the colour that
 * was supposed to mean something. The date still shows, in the beyond
 * treatment.
 *
 * Never call this to decide a height. Status and dates are row data, so a rung
 * changes a treatment; a height derived from one would change at midnight with
 * no file write, shifting every column's offsets under a scrolled board.
 */
export function dueRung(
  due: string | undefined,
  now: number,
  attentionDays: number,
  status: TicketStatus,
  archived: boolean,
): DueRung | undefined {
  const day = due === undefined ? undefined : fromIso(due);
  if (!day) return undefined;
  if (archived || status === "done" || status === "canceled") return "beyond";
  const days = daysBetween(startOfDay(now), day);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  // `0` is legal and empties the approaching rung, leaving today and beyond.
  if (days <= attentionDays) return "approaching";
  return "beyond";
}

/**
 * What the chip says.
 *
 * A chip is not the date field and does not have to mirror the grammar: nobody
 * types into a card, so it is free to say the shortest true thing, and `in 3d`
 * reuses the relative vocabulary `describeAge` already speaks rather than
 * inventing a second one.
 */
export function dueChipText(day: Date, now: number, rung: DueRung): string {
  const days = daysBetween(startOfDay(now), day);
  if (rung === "overdue") return `${Math.abs(days)}d overdue`;
  if (rung === "today") return "Today";
  if (rung === "approaching") return `in ${days}d`;
  return displayDate(day, now);
}

// ------------------------------------------------------------- the estimate

export type ReadEstimate =
  /** A value this project's system reads, and how to render it. */
  | { kind: "known"; text: string }
  /**
   * A value this project's system cannot read — written under another one, or
   * by hand. It is not converted and not dropped: it is legible again the
   * moment the project switches back (invariant 16).
   */
  | { kind: "foreign"; text: string };

const FIBONACCI_SCALE = ["1", "2", "3", "5", "8", "13"];

const DURATION = /^(\d+(?:\.\d+)?)([mhdw])$/;

export function readEstimate(
  value: string | undefined,
  config: EstimateConfig,
): ReadEstimate | undefined {
  if (!value) return undefined;
  if (config.system === "tshirt") {
    return config.values.includes(value)
      ? { kind: "known", text: value.toUpperCase() }
      : { kind: "foreign", text: value };
  }
  if (config.system === "fibonacci") {
    return FIBONACCI_SCALE.includes(value)
      ? { kind: "known", text: value }
      : { kind: "foreign", text: value };
  }
  return DURATION.test(value)
    ? { kind: "known", text: value }
    : { kind: "foreign", text: value };
}

/**
 * A duration in minutes, so `4h` and `1d` can be ordered against each other.
 *
 * The conversion is the project's rather than a constant, because a project on
 * a six-hour day would otherwise order those two wrongly. Changing it changes
 * no stored value.
 */
export function estimateMinutes(
  value: string | undefined,
  config: EstimateConfig,
): number | undefined {
  const parts = DURATION.exec(value ?? "");
  if (!parts) return undefined;
  const amount = Number(parts[1]);
  const hour = 60;
  const day = config.hoursPerDay * hour;
  const week = config.daysPerWeek * day;
  return { m: amount, h: amount * hour, d: amount * day, w: amount * week }[
    parts[2] as "m" | "h" | "d" | "w"
  ];
}

/**
 * A duration as its two halves, for the control that edits them separately.
 *
 * The unit is a menu rather than something to be typed, because `m h d w` is
 * the one part of this grammar nothing on screen would otherwise teach. Split
 * here rather than in the control, so the regex that decides what a duration is
 * stays the only one in the app.
 */
export function splitDuration(
  value: string | undefined,
): { amount: string; unit: string } | undefined {
  const parts = DURATION.exec(value ?? "");
  return parts ? { amount: parts[1], unit: parts[2] } : undefined;
}

/** The values a project's estimate control offers, in the scale's own order. */
export function estimateScale(config: EstimateConfig): string[] {
  if (config.system === "tshirt") return config.values;
  if (config.system === "fibonacci") return FIBONACCI_SCALE;
  return ["30m", "1h", "2h", "4h", "1d", "2d", "1w"];
}
