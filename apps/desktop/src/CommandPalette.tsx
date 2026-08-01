/** Keyboard-first command palette: a combobox over the current command mode. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "./metaOptions";
import type {
  IndexedTicket,
  ProjectReference,
  TicketRow,
  TicketPriority,
  TicketStatus,
} from "./types";
import type { OrderingMode } from "./ordering";

type Mode =
  "root" | "status" | "priority" | "theme" | "project" | "search" | "ordering";
type Row = {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
  glyph?: ReactNode;
  reason?: string;
};

export function CommandPalette(props: {
  project: ProjectReference;
  ticket?: IndexedTicket;
  tickets: TicketRow[];
  searchResults?: TicketRow[];
  focusedTicket?: IndexedTicket;
  appearance: "system" | "light" | "dark";
  themes: Array<{ id: string; label: string }>;
  onClose: () => void;
  onCreate: () => void;
  onOpenTicket: (key: string) => void;
  onChangeStatus: (status: TicketStatus) => void;
  onChangePriority: (priority: TicketPriority) => void;
  onToggleStar: () => void;
  onToggleAppearance: () => void;
  onTheme: (theme: string) => void;
  onView: (view: "board" | "list") => void;
  onArchive: () => void;
  onOrdering: (mode: OrderingMode) => void;
  view: "board" | "list";
  initialMode?: Mode;
  onSearch: (query: string) => void;
}) {
  const targetTicket = props.ticket ?? props.focusedTicket;
  const [mode, setMode] = useState<Mode>(props.initialMode ?? "root");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const root: Row[] = [
    { id: "create", label: "Create ticket", hint: "C" },
    { id: "project", label: "Go to project…" },
    {
      id: "status",
      label: "Change status…",
      hint: "S",
      disabled: !targetTicket,
      reason: targetTicket ? undefined : "Open or focus a ticket",
    },
    {
      id: "priority",
      label: "Set priority…",
      hint: "P",
      disabled: !targetTicket,
      reason: targetTicket ? undefined : "Open or focus a ticket",
    },
    { id: "search", label: "Search tickets…" },
    {
      id: "star",
      label: props.project.starred ? "Unstar project" : "Star project",
    },
    { id: "appearance", label: `Toggle appearance (${props.appearance})` },
    { id: "theme", label: "Change project theme…" },
    {
      id: "archive",
      label:
        targetTicket && targetTicket.archivedAt
          ? "Unarchive ticket"
          : "Archive ticket",
      disabled: !targetTicket,
      reason: targetTicket ? undefined : "Open or focus a ticket",
    },
    { id: "ordering", label: "Change board ordering…" },
    { id: "view", label: "Switch board/list view" },
    { id: "terminal", label: "New terminal", disabled: true, hint: "PHASE 2" },
  ];
  const rows: Row[] =
    mode === "root"
      ? root
      : mode === "status"
        ? STATUS_OPTIONS.map((option) => ({
            id: option.id,
            label: option.label,
            glyph: option.glyph,
          }))
        : mode === "priority"
          ? PRIORITY_OPTIONS.map((option) => ({
              id: option.id,
              label: option.label,
              glyph: option.glyph,
            }))
          : mode === "theme"
            ? props.themes.map((theme) => ({
                id: theme.id,
                label: theme.label,
              }))
            : mode === "project"
              ? [{ id: props.project.id, label: props.project.name }]
              : mode === "search"
                ? (props.searchResults ?? props.tickets)
                    .filter(
                      (ticket) =>
                        ticket.key
                          .toLowerCase()
                          .includes(query.toLowerCase()) ||
                        (ticket.state === "indexed" &&
                          ticket.title
                            .toLowerCase()
                            .includes(query.toLowerCase())),
                    )
                    .map((ticket) => ({
                      id: ticket.key,
                      label:
                        ticket.state === "indexed"
                          ? `${ticket.key} — ${ticket.title}${ticket.archivedAt ? " · archived" : ""}`
                          : `${ticket.key} — unreadable`,
                    }))
                : [
                    { id: "priority", label: "Priority" },
                    { id: "manual", label: "Manual" },
                  ];
  const filtered = rows.filter(
    (row) => !query || row.label.toLowerCase().includes(query.toLowerCase()),
  );
  const select = (row: Row) => {
    if (row.disabled) return;
    if (mode === "root") {
      if (row.id === "create") props.onCreate();
      else if (
        [
          "status",
          "priority",
          "theme",
          "project",
          "search",
          "ordering",
        ].includes(row.id)
      ) {
        setMode(row.id as Mode);
        setQuery("");
        setActive(0);
      } else if (row.id === "star") {
        props.onToggleStar();
        props.onClose();
      } else if (row.id === "appearance") {
        props.onToggleAppearance();
        props.onClose();
      } else if (row.id === "archive") {
        props.onArchive();
        props.onClose();
      } else if (row.id === "view") {
        props.onView(props.view === "list" ? "board" : "list");
        props.onClose();
      }
    } else if (mode === "status") {
      props.onChangeStatus(row.id as TicketStatus);
      props.onClose();
    } else if (mode === "priority") {
      props.onChangePriority(row.id as TicketPriority);
      props.onClose();
    } else if (mode === "theme") {
      props.onTheme(row.id);
      props.onClose();
    } else if (mode === "ordering") {
      props.onOrdering(row.id as OrderingMode);
      props.onClose();
    } else if (mode === "project") {
      props.onClose();
    } else if (mode === "search") props.onOpenTicket(row.id);
  };
  function keyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (mode === "root") props.onClose();
      else {
        setMode("root");
        setQuery("");
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((x) => (x + 1) % Math.max(filtered.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(
        (x) =>
          (x - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) select(filtered[active]);
    }
  }
  return (
    <div className="modal-scrim" role="presentation">
      <section
        className="command-palette"
        role="dialog"
        aria-label="Command palette"
        onKeyDown={keyDown}
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (mode === "search") props.onSearch(e.target.value);
          }}
          placeholder={mode === "root" ? "Type a command…" : "Search…"}
          aria-label="Command palette input"
          role="combobox"
          aria-controls="command-palette-options"
          aria-expanded="true"
        />
        <div className="palette-mode">
          {mode !== "root" && (
            <button onClick={() => setMode("root")}>‹</button>
          )}{" "}
          {mode}
        </div>
        <div
          id="command-palette-options"
          role="listbox"
          aria-label={`${mode} commands`}
        >
          {filtered.map((row, index) => (
            <button
              key={row.id}
              role="option"
              aria-selected={index === active}
              disabled={row.disabled}
              className={index === active ? "active" : ""}
              onClick={() => select(row)}
            >
              {"glyph" in row && row.glyph}
              {row.label}
              {row.reason && <small>{row.reason}</small>}
              {row.hint && <kbd>{row.hint}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && <p role="status">No matches</p>}
        </div>
        <footer>↑↓ navigate · ↵ run · esc close/back</footer>
      </section>
    </div>
  );
}
