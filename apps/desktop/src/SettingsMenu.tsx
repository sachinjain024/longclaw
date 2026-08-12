/**
 * The two menus settings is reached through (LC-208).
 *
 * The gear used to open the settings dialog outright, which answered every
 * question with the same six-section modal — including the one people actually
 * ask, which is *make this darker*. So the gear opens a menu instead: the theme
 * is changed from a submenu with no dialog in the way at all, and every other
 * row opens the settings panel already standing on the section it names.
 *
 * Two menus rather than one, because the ticket puts settings in two places and
 * they are asked from different positions. The **settings menu** hangs off the
 * gear on the board and is about the project you are looking at: its sections,
 * its theme, its files. The **project menu** hangs off the `⋮` on a side-panel
 * row and is about a project you may not have open: rename it, restyle it, star
 * it, forget it. `Theme` and `All settings…` are on both, which is deliberate —
 * they are the two things worth reaching from either place.
 *
 * Everything here is presentation over callbacks. Nothing in this file writes,
 * reads the disk, or knows what a section contains; `App` owns all of that, and
 * `ProjectSettings` owns the sections themselves.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  ColumnsGlyph,
  GearGlyph,
  KeyboardGlyph,
  ReloadGlyph,
  RenameGlyph,
  TagGlyph,
} from "./SettingsGlyphs";
import type { Appearance } from "./state";
import type { ThemeOption } from "./ThemePicker";
import { ThemeSwatch } from "./ThemeSwatch";
import { STATUSES } from "./tickets";
import type { ProjectReference } from "./types";

/**
 * A pane of the settings panel, and the thing a menu row opens it on.
 *
 * `general` is the panel's own landing section, so it is what the rows that do
 * not name a section — `All settings…`, `Rename` — open.
 */
export type SettingsSection =
  "general" | "theme" | "labels" | "status" | "shortcuts" | "danger";

/** How far below (or beside) its anchor a popover sits. */
const GAP = 4;

/**
 * One row. `action` runs and closes, `choice` runs and stays — the difference
 * between opening a section and trying a preset against the board behind the
 * menu, which is the whole reason the theme rows are in a menu at all.
 */
type MenuItem =
  | {
      kind: "action";
      id: string;
      label: string;
      glyph?: ReactNode;
      /** The quiet right-hand note: a count, a shortcut, the current value. */
      hint?: ReactNode;
      danger?: boolean;
      run: () => void;
    }
  | {
      kind: "choice";
      id: string;
      label: string;
      glyph?: ReactNode;
      checked: boolean;
      run: () => void;
    }
  | {
      kind: "submenu";
      id: string;
      label: string;
      glyph?: ReactNode;
      hint?: ReactNode;
      items: MenuItem[];
    }
  | { kind: "group"; id: string; label: string }
  | { kind: "rule"; id: string };

/** Rows the arrow keys stop on. Captions and rules are read, not landed on. */
function isStop(item: MenuItem) {
  return (
    item.kind === "action" || item.kind === "choice" || item.kind === "submenu"
  );
}

/**
 * The popover, and the only place in this file that knows about focus.
 *
 * It is recursive: a `submenu` row renders another one beside itself, which
 * takes focus while it is up and hands it back to the row it came from. That is
 * what makes `ArrowLeft`, `Escape` and click-away land on **one** rung each —
 * the nested list stops the events it answers, so the list behind it never sees
 * them (`keyboard-focus-map.md:19-21` — the ladder walks one rung at a time).
 */
function MenuList(props: {
  label: string;
  items: MenuItem[];
  /** Fixed viewport coordinates. The root has them; a submenu is placed in CSS. */
  position?: { top: number; left: number };
  /** `Escape`, `ArrowLeft`, or a pick: what takes this list down. */
  onDismiss: () => void;
  /**
   * The control this list hangs off, excluded from click-away.
   *
   * Without it a trigger cannot close its own menu: the press dismisses on
   * `mousedown`, React re-renders with the menu shut, and the `click` that
   * follows lands on a handler that now reads `open === false` and opens it
   * straight back up. `Menu.tsx` has always excluded its anchor for this
   * reason; the gear and the `⋮` both went two rounds of review with a menu
   * that could only be closed by `Esc` or by clicking somewhere else.
   */
  anchor?: HTMLElement | null;
  /** A submenu, which owes `ArrowLeft` a step back rather than a close. */
  nested?: boolean;
}) {
  const stops = props.items.filter(isStop);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [openSub, setOpenSub] = useState<string>();
  const { onDismiss } = props;

  useLayoutEffect(() => {
    // Only while this list owns focus: a parent whose submenu is up must not
    // pull focus back out of it on every render.
    if (openSub === undefined) rows.current[active]?.focus();
  }, [active, openSub]);

  function move(step: number) {
    setActive((index) => (index + step + stops.length) % stops.length);
  }

  /** Steps into a submenu row, from `ArrowRight` or from a click. */
  function enter(id: string) {
    setOpenSub(id);
  }

  /**
   * Steps back out. Focus is inside the list that is going away, and the effect
   * above is what puts it back — `openSub` is one of its dependencies precisely
   * so that closing a submenu re-focuses the row it belongs to, in the same
   * commit rather than a frame later.
   */
  const leave = useCallback(() => setOpenSub(undefined), []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // A submenu is up and owns the keyboard; it stops what it answers.
    if (openSub !== undefined) return;
    const item = stops[active];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "ArrowRight" && item?.kind === "submenu") {
      event.preventDefault();
      event.stopPropagation();
      enter(item.id);
      return;
    }
    if (event.key === "Escape" || (event.key === "ArrowLeft" && props.nested)) {
      event.preventDefault();
      // The press this list answered is spent: `App`'s own `Esc` ladder and the
      // list behind this one must not also take a layer down.
      event.stopPropagation();
      onDismiss();
    }
  }

  const popover = useRef<HTMLDivElement>(null);
  const { anchor } = props;
  useEffect(() => {
    // Click-away belongs to the outermost list only. A press inside a submenu
    // is inside this one too, since the submenu is rendered within it.
    if (props.nested) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popover.current?.contains(target)) return;
      // The trigger's own press is its toggle, not a dismissal.
      if (anchor?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [anchor, onDismiss, props.nested]);

  let index = -1;
  return (
    <div
      className={props.nested ? "menu-popover menu-sub" : "menu-popover"}
      role="menu"
      aria-label={props.label}
      ref={popover}
      style={props.position}
      onKeyDown={onKeyDown}
    >
      {props.items.map((item) => {
        if (item.kind === "rule")
          return <hr key={item.id} className="menu-rule" />;
        if (item.kind === "group")
          return (
            <p key={item.id} className="menu-caption">
              {item.label}
            </p>
          );
        index += 1;
        const at = index;
        const checked = item.kind === "choice" ? item.checked : undefined;
        return (
          <div
            key={item.id}
            className={item.kind === "submenu" ? "menu-anchor" : undefined}
          >
            <button
              // Never a submit: the gear sits in a header and the `⋮` sits in a
              // row, and neither is a form today — but `Menu` learned this the
              // hard way and the rule is cheap to keep.
              type="button"
              className={
                item.kind === "action" && item.danger
                  ? "menu-row danger"
                  : "menu-row"
              }
              role={item.kind === "choice" ? "menuitemradio" : "menuitem"}
              aria-checked={checked}
              aria-haspopup={item.kind === "submenu" ? "menu" : undefined}
              aria-expanded={
                item.kind === "submenu" ? openSub === item.id : undefined
              }
              tabIndex={at === active ? 0 : -1}
              ref={(element) => {
                rows.current[at] = element;
              }}
              onFocus={() => setActive(at)}
              onClick={() => {
                if (item.kind === "submenu") {
                  enter(item.id);
                  return;
                }
                item.run();
                // A choice stays: the menu is how presets are tried against the
                // board behind it. An action has opened something, so it goes.
                if (item.kind === "action") onDismiss();
              }}
            >
              {item.glyph && <span className="menu-glyph">{item.glyph}</span>}
              <span className="menu-label">{item.label}</span>
              {item.kind !== "choice" && item.hint && (
                <span className="menu-hint">{item.hint}</span>
              )}
              {item.kind === "submenu" && <SubmenuChevron />}
              {checked && (
                <span className="menu-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
            {item.kind === "submenu" && openSub === item.id && (
              <MenuList
                nested
                label={item.label}
                items={item.items}
                onDismiss={leave}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Decorative: `aria-haspopup` on the row says the same thing, and better. */
function SubmenuChevron() {
  return (
    <svg
      className="menu-chevron"
      width="11"
      height="11"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M5 3 L9.5 7 L5 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** What both menus are handed: a project, the two theme axes, and a way out. */
interface MenuContext {
  project: ProjectReference;
  themes: ThemeOption[];
  appearance: Appearance;
  /** What the popover hangs off and hands focus back to. */
  anchor: HTMLElement | null;
  onAppearance: (appearance: Appearance) => void;
  onTheme: (theme: string) => void;
  onOpenSection: (section: SettingsSection) => void;
  onClose: () => void;
}

/**
 * The three appearances, in the order the segment and the submenu both draw
 * them. Exported because `ProjectSettings` renders the same three as a 3-up
 * segment, and two lists that could drift are two chances to disagree about
 * what `System` means.
 */
export const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/**
 * The `Theme ▸` row, shared by both menus.
 *
 * It carries **both** axes, which is what the ticket asks for and what makes it
 * worth being a submenu rather than two rows: appearance is a device preference
 * and the preset is project data written to `longclaw.yaml`, and the captions
 * say which is which rather than leaving a person to find out by switching
 * machines. The trailing hint on the parent row is the pair as it stands now,
 * so the answer is legible without opening anything.
 */
function themeSubmenu(context: MenuContext): MenuItem {
  const preset = context.themes.find(
    (option) => option.id === context.project.theme,
  );
  const appearance = APPEARANCES.find(
    (option) => option.id === context.appearance,
  );
  return {
    kind: "submenu",
    id: "theme",
    label: "Theme",
    glyph: <ThemeSwatch theme={context.project.theme} />,
    hint: `${preset?.label ?? context.project.theme} · ${appearance?.label ?? ""}`,
    items: [
      {
        kind: "group",
        id: "appearance-caption",
        label: "appearance · this device",
      },
      ...APPEARANCES.map((option): MenuItem => ({
        kind: "choice",
        id: `appearance-${option.id}`,
        label: option.label,
        checked: option.id === context.appearance,
        run: () => context.onAppearance(option.id),
      })),
      { kind: "rule", id: "theme-rule" },
      {
        kind: "group",
        id: "preset-caption",
        label: "color theme · longclaw.yaml",
      },
      ...context.themes.map((option): MenuItem => ({
        kind: "choice",
        id: `theme-${option.id}`,
        label: option.label,
        glyph: <ThemeSwatch theme={option.id} />,
        checked: option.id === context.project.theme,
        run: () => context.onTheme(option.id),
      })),
    ],
  };
}

/** The row every menu ends on, and the shortcut that reaches it directly. */
function allSettings(context: MenuContext): MenuItem {
  return {
    kind: "action",
    id: "all",
    label: "All settings…",
    hint: <kbd>⌘,</kbd>,
    run: () => context.onOpenSection("general"),
  };
}

/**
 * Where the popover goes: under the gear, left edges aligned.
 *
 * Measured once, when it opens, for the reason `Menu` measures once — the row
 * it hangs off can move underneath it (the header's disk-state line arrives
 * mid-write and pushes the identity box around), and a popover that re-measured
 * on every render would walk out from under the pointer that is using it.
 */
function usePlacement(anchor: HTMLElement | null) {
  const placed = useRef<{ top: number; left: number } | undefined>(undefined);
  if (!placed.current && anchor) {
    const rect = anchor.getBoundingClientRect();
    placed.current = { top: rect.bottom + GAP, left: rect.left };
  }
  return placed.current;
}

/**
 * Focus back where it came from when the menu goes, whatever took it down —
 * a pick, `Escape`, or a click on the board. Captured on open, because by the
 * time this runs the menu holds focus itself.
 */
function useFocusReturn(anchor: HTMLElement | null) {
  const returnTo = useRef<HTMLElement | null | undefined>(undefined);
  if (returnTo.current === undefined) {
    returnTo.current = anchor ?? (document.activeElement as HTMLElement | null);
  }
  useEffect(
    () => () => {
      const element = returnTo.current;
      if (element?.isConnected) element.focus();
    },
    [],
  );
}

/**
 * The gear's menu on the board (`screen-specs.md` § Project settings).
 *
 * The sections are listed in the panel's own order so the menu and the panel's
 * side nav read as the same list — because they are. Each row's hint is the
 * thing you would open the section to find out: how many labels there are, what
 * the theme is set to, which fields the key and folder rows hold.
 */
export function SettingsMenu(
  props: MenuContext & {
    /** Re-reads the folder. The one row here that is not a settings section. */
    onReload: () => void;
  },
) {
  useFocusReturn(props.anchor);
  const position = usePlacement(props.anchor);
  const labelCount = Object.keys(props.project.labels).length;
  const items: MenuItem[] = [
    themeSubmenu(props),
    { kind: "rule", id: "sections-rule" },
    {
      kind: "action",
      id: "general",
      glyph: <GearGlyph />,
      label: "General",
      hint: "name · key · folder",
      run: () => props.onOpenSection("general"),
    },
    {
      kind: "action",
      id: "labels",
      glyph: <TagGlyph />,
      label: "Labels",
      hint: <code>{labelCount}</code>,
      run: () => props.onOpenSection("labels"),
    },
    {
      kind: "action",
      id: "status",
      glyph: <ColumnsGlyph />,
      label: "Status fields",
      // The count its neighbour has, from the one list the board is built
      // from — the six are fixed in v0 (ADR 0002), so this is a constant, but
      // reading it off `STATUSES` is what keeps it true when they stop being.
      hint: <code>{STATUSES.length}</code>,
      run: () => props.onOpenSection("status"),
    },
    {
      kind: "action",
      id: "shortcuts",
      glyph: <KeyboardGlyph />,
      label: "Keyboard shortcuts",
      run: () => props.onOpenSection("shortcuts"),
    },
    { kind: "rule", id: "disk-rule" },
    {
      kind: "action",
      id: "reload",
      glyph: <ReloadGlyph />,
      label: "Reload from disk",
      run: props.onReload,
    },
    { kind: "rule", id: "all-rule" },
    allSettings(props),
  ];
  return (
    <MenuList
      label="Project settings"
      items={items}
      position={position}
      anchor={props.anchor}
      onDismiss={props.onClose}
    />
  );
}

/**
 * The `⋮` menu on a side-panel row (LC-208: "the Menu which gets opened through
 * 3 vertical dots in front of Project Name").
 *
 * It is about the row rather than about the board, so it holds the two things
 * that were previously only reachable by opening the project first — its theme
 * and its removal — plus the star, which was a bare `★` glyph beside the name
 * that said nothing about what pressing it would do.
 */
export function ProjectMenu(
  props: MenuContext & {
    onStar: () => void;
    onRemove: () => void;
  },
) {
  useFocusReturn(props.anchor);
  const position = usePlacement(props.anchor);
  const items: MenuItem[] = [
    {
      kind: "action",
      id: "rename",
      glyph: <RenameGlyph />,
      label: "Rename…",
      // The name field lives in General and commits on `Enter` or blur; a
      // second inline editor on the row would be a second way to write the
      // same line of `longclaw.yaml`.
      run: () => props.onOpenSection("general"),
    },
    themeSubmenu(props),
    { kind: "rule", id: "star-rule" },
    {
      kind: "action",
      id: "star",
      glyph: (
        <span className="menu-star" aria-hidden="true">
          {props.project.starred ? "★" : "☆"}
        </span>
      ),
      // Named for what pressing it does, not for what is true now.
      label: props.project.starred ? "Unstar project" : "Star project",
      run: props.onStar,
    },
    { kind: "rule", id: "danger-rule" },
    {
      kind: "action",
      id: "remove",
      danger: true,
      glyph: (
        <span className="menu-cross" aria-hidden="true">
          ✕
        </span>
      ),
      // The ellipsis is the promise: this raises the confirm that names the
      // path and repeats the guarantee (`screen-specs.md:335-336`).
      label: "Remove from app…",
      run: props.onRemove,
    },
    { kind: "rule", id: "all-rule" },
    allSettings(props),
  ];
  return (
    <MenuList
      label="Project menu"
      items={items}
      position={position}
      anchor={props.anchor}
      onDismiss={props.onClose}
    />
  );
}
