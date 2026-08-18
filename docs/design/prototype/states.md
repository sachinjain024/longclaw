# LongClaw v0 — empty, loading, error, conflict & external-update states

> Phase 0, Step 2 deliverable. A files-on-disk app earns trust in its
> failure states; none of these may be defaulted at implementation time.
> Each state below specifies trigger, surface, anatomy (in tokens), motion,
> and recovery. Anatomy primitives (warn/danger banners, toasts, degraded
> cards) are in `../foundations/components.md`. Every state is live in
> `prototype.html` via the driver bar.

**The two invariants under every state:**

1. **Non-destructive always.** LongClaw never deletes, rewrites, or
   "repairs" content it cannot parse, and removing a project from the app
   never touches the folder.
2. **Never silent.** An external change earns the pulse, the footer, a
   timeline event, or a banner — a state the user can notice and review.

## Empty states

### No projects (first launch)

- **Trigger:** empty project registry.
- **Surface:** the welcome screen *is* this state (no separate design).
  Owl mark, display greeting, folder-on-disk subtitle, Create/Open buttons,
  mono trust line. No account step exists.
- **Recovery:** create or open a folder; both paths land on a board.

### Empty project

- **Trigger:** reachable project with zero ticket directories.
- **Surface:** full board scaffold (all columns, zero counts) — the app
  never hides the workspace. The Todo column hosts the guided card:
  dashed `line-strong` border, "Create your first ticket", one line of
  copy, `C` kbd chip. List view shows a centered equivalent.
- **Motion:** none.

### No filter matches

- **Trigger:** active filter query matches nothing.
- **Surface:** centered panel "No matches" + the echoed query + secondary
  **Clear filter** (also `Esc`).

## Loading states

### Project open / switch

- **Trigger:** selecting a project whose index isn't loaded.
- **Surface:** board-shaped skeleton (column heads + card blocks in `wash`
  with a 1.2s shimmer). No spinner overlay, no blocked input — the shell,
  sidebar, and palette stay interactive.
- **Budget:** skeleton appears only if the load exceeds ~100ms and must
  resolve in one visual step (no progressive pop-in).

### Mutation writes (optimistic states)

- **Rule (components.md):** optimistic UI first — every mutation renders
  its final state immediately; a spinner may appear only after 500ms of an
  unsettled write, and only on the disk-state indicator, never on the
  mutated element.
- **Surface:** the header disk-state line: `⟳ writing ticket.md…` (mono,
  `ink-3`) → `✓ ticket.md` (`ink-disabled`). Destructive-adjacent
  mutations (status, priority, archive/unarchive, create, check) also
  raise a toast with **Undo ⌘Z** (5s, bottom-center, single stack).
- **Failure:** a failed write re-raises the toast as a danger banner state
  with retry; the optimistic value stays visible and marked unsaved.
  (Write-failure UI is exercised in Step 6+ with real storage; the pattern
  is the conflict banner's anatomy with danger tokens.)

## Error states

### Folder missing / moved

- **Trigger:** project path unreachable at launch, on watcher signal, or
  on any failed read.
- **Surfaces:**
  - Sidebar row: theme dot → 12px warn triangle (`--lc-warn`), name dims
    to `ink-3`; the project **stays listed** and selectable.
  - Main area: centered state panel — 30px warn triangle, "Folder not
    found", the full path in mono, copy that names the likely causes and
    the guarantee ("Your tickets are safe in their files — LongClaw never
    deletes or rewrites them"), actions **Locate folder…** (native picker;
    on success: re-point registry, rescan, toast) and **Remove from app**
    (ghost → confirm dialog repeating the guarantee).
- **Never:** auto-remove, auto-search the disk, or show cached tickets as
  if they were live.

### Unparseable ticket file

- **Trigger:** a ticket.md that fails the format contract (frontmatter
  error, structural corruption) after write-debounce settles.
- **Surfaces:**
  - Board: degraded card — danger border, warn glyph + `can't parse` in
    the ID slot, mono filename as title, single action **View raw file**.
  - List: degraded row, same anatomy at row height.
  - Raw file view (modal): full path, danger banner with parser error
    (mono, `file:line`), line-numbered raw content with the offending line
    highlighted, note "shown exactly as it is on disk", actions **Open in
    editor** and **Retry parse**.
- **Semantics:** the file is displayed read-only and byte-exact. Other
  tickets are unaffected; an invalid embedded record (per the format spec)
  degrades only that entry, not the whole ticket.
- **Recovery:** fix externally → watcher re-parses automatically, or
  **Retry parse** on demand. Success returns the ticket silently to its
  normal card (plus toast).

### Waitlist failures

- **Invalid email:** field border `danger`, inline message with warn glyph.
  Never color-only.
- **Offline / endpoint unreachable:** inline danger message "Couldn't
  reach the waitlist — you look offline. Local projects are unaffected;
  try again later." The modal stays open; nothing in the app changes.
  Waitlist failure must never affect any local feature.

## Conflict state — external edit while editing in-app

- **Trigger:** the watcher reports a change to the open ticket's file
  while the user has unsaved edits (detected by content hash recorded at
  edit start — per `../../file_format.md` § Write and conflict rules).
- **Surface:** warn banner pinned at the top of the ticket panel:
  - warn triangle + **"Changed on disk while you were editing."** +
    attribution and age ("claude-code edited this ticket's file 4s ago.
    Your unsaved edit is preserved either way.")
  - actions: **Reload file** (small secondary, `warn-border-strong`) —
    replaces the draft with the on-disk content; **Keep mine** (small
    ghost, `warn-ink`) — keeps the draft in the editor.
- **Semantics:**
  - The banner never interrupts typing (no modal, no focus steal).
  - *Reload file* discards the draft explicitly — the only way a draft is
    ever lost is this user choice.
  - *Keep mine* continues the edit; the eventual save writes the draft as
    the new content **and** the overridden external version remains
    recoverable in the activity history; the save's change event is
    annotated ("overrode an external edit").
  - A stale draft is **never silently written over** newer disk content —
    saving with an unresolved conflict re-raises the banner.
  - Non-conflicting external changes (e.g. agent checks an item while the
    description is being edited) apply live and use the external-update
    treatment below; the banner is reserved for genuine overlap.

## External-update states — the designed agent moment

External file edits are the product's magic moment and are **never a
silent re-render**.

### Acknowledged ticket (board card / list row)

- **Trigger:** watcher ingests an external change to a ticket (agent or
  unknown actor).
- **Card:** border → `accent-agent-acknowledged-border`, 3px
  `accent-agent-acknowledged-ring`, 8px pulse dot beside the ID (`lc-pulse`
  1.8s ease-out, looping until decay), footer line `❯ updated by agent · 12s`
  (mono, `accent-agent-text`) above a soft divider. Checklist fraction and
  progress fill switch to `accent-agent` while acknowledged. If the change moved
  the ticket's status, the card moves columns with the standard 120ms
  reorder *plus* the acknowledgement.
- **List row:** 7px agent pulse dot beside the title.
- **Decay:** on open (reviewed), or 2 minutes after the last agent write.
  Multiple writes in a session re-pulse but never stack rings.

### Agent-checked checklist rows (panel)

- Acknowledged: box fills `accent-agent` with `on-accent-agent` mark, row bg
  `accent-agent-wash`, trailing mono `❯ just now`. Settles to the standard
  checked state once the ticket is viewed.

### Timeline attribution

- Every external mutation lands as timeline entries with the agent
  treatment (tile avatar, rail, AGENT badge, `via file edit` meta).
  Attribution comes only from the file's explicit actor records — the app
  never guesses. An observed external change without actor metadata logs
  as `file changed on disk — actor unknown` with a warn glyph.

### While the panel is open

- Non-conflicting external changes apply live: checklist rows flip with
  the agent acknowledgement, new timeline entries append, the description
  updates if not being edited. The panel header's file path briefly shows
  the disk-state line (`✓ ticket.md`).

## State × surface coverage matrix

| State | Sidebar | Board | List | Panel | Modal/Toast |
|---|---|---|---|---|---|
| No projects | — (empty shell hidden) | welcome | welcome | — | — |
| Empty project | normal | guide card | centered guide | — | — |
| Loading project | normal | skeleton | skeleton | — | — |
| Write in flight | — | disk-state | disk-state | disk-state | toast + undo |
| Folder missing | warn row | state panel | state panel | closed | confirm on remove |
| Unparseable file | normal | degraded card | degraded row | — | raw file view |
| Conflict | normal | acknowledged card | acknowledged row | warn banner | — |
| External update | normal | acknowledged card | acknowledged dot | live apply + agent rows | — |
| Waitlist error | normal | — | — | — | inline danger |
