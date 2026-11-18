---
title: "Startup tips: onboarding and feature discovery"
product: LongClaw
status: proposed
ticket: LC-286v
---

# Startup tips: onboarding and feature discovery

The spec for [LC-286v](../../.longclaw/tickets/LC-286v/ticket.md). Written on
2026-11-17 from the ticket as filed, the welcome and empty-project surfaces
(`screen-specs.md`, `states.md`), the keyboard map
([`keyboard-focus-map.md`](../design/prototype/keyboard-focus-map.md)), the
command palette, the user guide, and what the app ships today. It is a product
brief: the deck and the rules for when a tip appears. The chrome still needs a
prototype before anyone implements it.

## Problem Statement

The first launch is already designed. The welcome column asks for a folder,
the empty project shows a guide card that creates the first ticket, and
Settings → Command line (plus the first-launch offer) puts `longclaw` on
`PATH`. Those three steps get a human as far as a project and a ticket.

They do not get them as far as the product. After that, LongClaw is a
keyboard-first board over files, and most of what it can do lives in a
shortcut, a palette row, a pane, or a file the human has not opened. Nothing
on an ordinary launch names any of it. A person who already has a project
open can use LongClaw for weeks without finding `⌘K`, `⌘F`, `C`, the CLI,
attachments, archive, board keys, or how an agent's edit is meant to look.

The gap is discovery after the first ticket, not first-run setup.

## Solution

On each launch that opens onto a project, show **one** short tip from a
rotating deck of shipped capabilities. Each tip has a name, one sentence, and
the shortcut or address that finds the thing. Dismiss it, and it stays gone
for the rest of the session. The next launch shows the next tip.

This is a **startup tip**, not a hover tooltip and not a coachmark tour. A
hover tooltip only appears on a control the human has already found. A tour
that points at chrome covers the board it is trying to explain, and v0 has
no overlay of that kind. A small card that can be read and dismissed is the
shape that matches the rest of the shell: the write toast, the first-launch
CLI offer, the empty-project guide card.

The deck names only what the current build actually does. Terminals, sync,
teams, accounts, Windows, Linux, Intel, custom themes and hard deletion stay
off it. A row that would oversell v0 is a row that does not ship.

## When a tip appears

- After a project is open and the board or list has painted. Never on the
  welcome screen, and never over an unreachable project that has no board.
- One tip per launch. The deck advances even if the tip is dismissed unread,
  so relaunching is how the rest of the list is seen.
- Stand down while another overlay is up: the palette, a modal, the CLI
  install offer, a conflict banner that needs a choice. A tip is not a
  second layer on top of a layer.
- Keyboard: the card is in the tab order, `Esc` dismisses it (one rung of
  the existing ladder, above "nothing"), and it never steals a single-key
  shortcut from the board.
- Persistence lives in device preferences (ADR 0012): the last-shown index
  and a "don't show these" flag. Nothing about tips is written into the
  project.
- Settings gets one control that turns the deck off. Turning it off is how
  someone who has seen the list keeps the board empty on every launch.

Open, and left for the prototype:

- Exact placement. A card in the lower-right of the content pane, above the
  status bar, is the working guess: it does not cover the header controls
  and it does not sit in the toast stack, which is already the write-feedback
  channel.
- Whether a tip may carry a single action ("Open settings", "Try ⌘K") or is
  copy only. An action that opens the palette or Settings is useful; an
  action that creates a ticket or writes a file is not a tip.
- Whether the first launch after creating a project starts the deck, or
  waits until the second launch so it does not stack on the CLI offer.

## User Stories

1. As a person who just created a project, I want the next launches to name
   one useful thing I have not found yet, so that I learn the product without
   reading the user guide first.
2. As a person who already uses the board every day, I want each launch to
   cost at most one glance and one dismiss, so that a tip never becomes a
   nag.
3. As a keyboard-only person, I want to dismiss the tip with `Esc` and reach
   it with Tab, so that a new card is not pointer-only.
4. As a person who has seen the list, I want to turn it off in Settings, so
   that my board looks the way it did before this shipped.
5. As a person on the welcome screen, I want no tip at all, so that the two
   buttons that create or open a project stay the whole of that screen.

## The first deck

Sixteen tips, in this order. The order is the teaching order: move around,
make tickets, work with agents, then the quieter file and project facts.
Copy is draft. Each row has an id so a review can say `tip.palette → …`
rather than quoting the sentence.

| Id | Title | Body | Shortcut / address |
|---|---|---|---|
| `tip.palette` | Command palette | Every action the board can take is in one list. Open it, type, press Enter. | `⌘K` |
| `tip.create` | Quick create | Press C to file a ticket in the current project. The column `+` buttons preseed that column's status. | `C` |
| `tip.create-more` | Create more | Turn on Create more in quick create and the dialog stays open after each ticket, keeping status, priority and labels. | Quick create |
| `tip.filter` | Filter the board | ⌘F focuses the filter and selects what is already there. The query is for this session; it is not written to disk. | `⌘F` |
| `tip.search-key` | Open a ticket by key | In the palette, type `LC-12` or just `12`. The matching ticket is offered above the commands. | `⌘K`, then a key |
| `tip.board-keys` | Move without a pointer | J and K move within a column, H and L across columns. Enter opens the focused ticket. | `J` `K` `H` `L` `Enter` |
| `tip.status-priority` | Status and priority | With a ticket focused, S changes status and P sets priority. The same keys work in the panel. | `S` `P` |
| `tip.undo` | Undo the last write | ⌘Z undoes the last mutation, paired with the toast. In a text field it is the field's own undo. | `⌘Z` |
| `tip.projects` | Jump to a project | ⌘1 through ⌘9 open the project at that place in the sidebar. Drag a row, or press ⌥↑ and ⌥↓, to change the order. | `⌘1`…`⌘9` |
| `tip.cli` | The `longclaw` command | Agents create tickets through the CLI, which ships inside the app. One press in Settings → Command line puts it on your PATH. | Settings → Command line |
| `tip.agents` | Point an agent at the folder | `.longclaw/AGENTS.md` is the contract the app maintains. Tell your agent to read it, then to drive the project with `longclaw`. | `.longclaw/AGENTS.md` |
| `tip.acknowledgement` | An agent's edit is visible | A ticket that changed on disk wears a ring and a pulse, with the actor and age, until you open it or two minutes pass. | the card |
| `tip.attach` | Attach a file | In the description or a comment, paste with ⌘V, drop a file, or press the paperclip. Images show inline; other files become chips. | paperclip / `⌘V` |
| `tip.archive` | Archive, not delete | Archive takes a ticket off the board and keeps its file and history. The list has an Archived group; unarchive puts it back. | palette → Archive |
| `tip.view` | Board and list | The same tickets, two densities. Switch from the header or the palette. | palette → Switch view |
| `tip.files` | Tickets are files | Each ticket is a directory of Markdown inside `.longclaw/`. Commit that folder; it is the backup, and agents read the same files you do. | `.longclaw/tickets/` |

## Candidate list

Everything that could earn a tip, including the first deck. Use this to
extend or swap after review. Rows marked **first** are in the table above.

### Moving around

| Id | Feature | Why it is easy to miss | First deck |
|---|---|---|---|
| `tip.palette` | Command palette (`⌘K`) | No chrome advertises it once the window is open. | first |
| `tip.board-keys` | `J` `K` `H` `L` / arrows, `Enter` | Roving focus is invisible until a key is pressed. | first |
| `tip.filter` | Filter field (`⌘F`) | A 190px field in the header; easy to treat as decoration. | first |
| `tip.search-key` | Type a ticket key in the palette | A query that looks like a key is a ticket, not a failed command search. | first |
| `tip.projects` | `⌘1`–`⌘9`, drag, `⌥↑` `⌥↓` | Chords follow sidebar order; order is stored, not alphabetical. | first |
| `tip.view` | Board ↔ list | The control is small; list is the density that pays off at hundreds of tickets. | first |
| `tip.esc` | Escape ladder | `Esc` walks menu → overlay → edit → panel → filter → nothing. People mash it. | candidate |
| `tip.context-menu` | Card menu (`⇧F10`) | Keyboard path to archive, properties and the rest of the card menu. | candidate |
| `tip.zoom` | Zoom (`⌘=` `⌘-` `⌘0`) | Also in View. Needed when the board is dense, never discovered otherwise. | candidate |
| `tip.settings` | Project settings (`⌘,`) | Gear is in the side panel; the chord is the keyboard path. | candidate |

### Creating and editing

| Id | Feature | Why it is easy to miss | First deck |
|---|---|---|---|
| `tip.create` | Quick create (`C`) | The header button is labelled; the key is the thing people do not try. | first |
| `tip.create-more` | Create more | A toggle inside quick create; filing a run of tickets is the pain it solves. | first |
| `tip.status-priority` | `S` / `P` on the focused ticket | Single-key shortcuts stand down in fields, so they feel absent in the panel until the title is not focused. | first |
| `tip.undo` | Undo (`⌘Z`) plus the toast | The toast is easy to dismiss without noticing it undoes. | first |
| `tip.attach` | Paste, drop, or paperclip | Attachments shipped after v0.1.0; there is no empty-state copy that names them. | first |
| `tip.checklist` | Checklist reorder (`⌥↑` `⌥↓`) | Enter toggles; the move keys are on the row, not in a menu. | candidate |
| `tip.markdown` | Description toolbar | Bold, italic, code, lists, link, checklist wrap the selection. Easy to type Markdown by hand and never notice. | candidate |
| `tip.comment` | Comments vs Activity | Two records in one panel. `⌘↵` posts. People look for a single timeline. | candidate |
| `tip.full-create` | Full create | Labels, description and checklist live on the larger create surface, not in the quick dialog (except the two LC-201 reopened). | candidate |

### Agents and the CLI

| Id | Feature | Why it is easy to miss | First deck |
|---|---|---|---|
| `tip.cli` | Install `longclaw` | Offered once on first launch; after Skip it lives only in Settings. | first |
| `tip.agents` | `.longclaw/AGENTS.md` | Generated, rewritten by the app, easy to confuse with a root `AGENTS.md`. | first |
| `tip.acknowledgement` | Agent acknowledgement | The ring decays in two minutes. If you were not looking, the moment is gone. | first |
| `tip.project-md` | `.longclaw/PROJECT.md` | Created empty, never rewritten. The place for this project's conventions. | candidate |
| `tip.attribution` | Activity names the actor | Human and agent are distinct in history. The format refuses to guess. | candidate |

### Files, recovery, project shape

| Id | Feature | Why it is easy to miss | First deck |
|---|---|---|---|
| `tip.archive` | Archive / unarchive | There is no Delete. Archive is how a ticket leaves the board. | first |
| `tip.files` | Markdown on disk, commit `.longclaw/` | The whole pitch, and still the thing a Linear-shaped expectation hides. | first |
| `tip.conflict` | Changed on disk | The app never overwrites a file that changed under you. You choose. | candidate |
| `tip.unreadable` | Open in editor / Retry parse | A broken `ticket.md` stays on the board as a degraded card instead of vanishing. | candidate |
| `tip.unreachable` | Folder moved | The project is marked unreachable, not forgotten. Point it at the new path. | candidate |
| `tip.finder` | Show in Finder | Attachments and references open or reveal; a name macOS might run is reveal-only. | candidate |
| `tip.references` | Doc references | A spec stays where it is; `longclaw ticket reference` records it. Not a copy into `attachments/`. | candidate |
| `tip.properties` | Type, estimate, start, due | Opt-in per project in Settings. Projects created before this build have none. | candidate |
| `tip.labels` | Labels are project-defined | A slug the project has not defined is refused. The CLI and the app agree. | candidate |
| `tip.ordering` | Priority vs Manual | Default order is priority; Manual is a drop that rewrites rank. Filter-on drops only rank the visible rows. | candidate |
| `tip.theme` | Five themes, light and dark | Theme is per project; appearance is per device. Easy to think they are one control. | candidate |
| `tip.star` | Star a project | Palette and the sidebar. Starred is a view of the same order, not a second list. | candidate |
| `tip.updates` | Settings → Updates | The one network path. Offline, everything else is unchanged. | candidate |
| `tip.local` | No account, no sync, no telemetry | Worth saying once, in the product's own voice, for anyone who arrived from a cloud tracker. | candidate |
| `tip.github` | Status bar GitHub control | New in 0.3.0, easy to read as chrome rather than a control. | candidate |

## Out of the deck

Do not add a tip for these, even as candidates:

- **New terminal.** The palette row is disabled and labelled Phase 2. A tip
  that names it is a promise.
- **Sync, teams, accounts, Windows, Linux, Intel, custom themes, hard
  deletion.** The website content brief's §6 list; the user guide's "What
  this version does not do."
- **Assignee.** Local mode has none (ADR 0001). There is no `A` shortcut.
- **Group-by.** Grouping is status only. There is no group-by control.
- **The welcome screen itself.** A person standing on it has no project yet;
  the two buttons are the onboarding.
- **The empty-project guide card.** It already is the invitation to create
  the first ticket. A startup tip on that frame would say the same sentence
  twice.

## Copy rules

- Calm, precise, no exclamation marks. The user-guide voice.
- One sentence of body. A shortcut or address on its own line, not buried
  in the sentence, so a glance finds the key.
- Name the thing the way the app names it: ticket, project, archive,
  Command line, Show in Finder. Not issue, workspace, delete, terminal.
- Mark each row new against shipped chrome, once a prototype exists, so
  review knows which sentences are being asked about.
- Include the `aria-label` of the card and its dismiss control in the
  prototype copy deck. Those are read out loud and have never been reviewed.

## Implementation notes

For whoever ships this after the prototype is reviewed. Not decisions yet.

- New copy lives in one object, like the rest of the shell's named strings.
  Scenes and the on-screen card both read it.
- Device preferences (ADR 0012) hold `tips.enabled` and `tips.nextIndex`.
  A missing file fails open: tips on, index 0.
- The card is a real control: explicit `tabIndex={0}` on the dismiss
  button (`scripts/tab-order-guard.mjs`).
- Do not put the tip in the write-toast stack. A create's undo toast and a
  discovery sentence are different jobs; stacking them trains people to
  dismiss both.
- `a11y:audit` when the card is in the tab order, because it is a new stop
  on the shell. `probe:header` if placement competes with the content
  header.

## Testing Decisions

- A launch with no registered project paints welcome and no tip.
- A launch with a project paints the board, then one tip, the next in the
  deck from the stored index.
- Dismiss advances the index and hides the card for the rest of the
  session; a second tip does not replace it without a relaunch.
- Settings off: no card, index left untouched.
- Palette open, CLI offer up, or conflict banner up: no card until that
  layer is gone, still the same tip for this launch.
- Copy for a candidate that is not in the first deck is not rendered.
- Turning a project unreachable while a tip is showing dismisses it.

## Prototype

Build with `lc-build-prototype` against this spec, before any `src/` work.
Scenes worth having:

1. Ordinary launch, board, one tip (palette).
2. Next launch, next tip (quick create).
3. Welcome screen: no tip.
4. Palette open: no tip until it closes.
5. Settings pane with the off control.
6. Keyboard: focus on the card, `Esc` dismisses, focus returns.
7. Copy deck as the last scene.

Settled copy is written back into the ticket after review. The prototype is
deleted once that happens; the deck in the ticket is then the source.
