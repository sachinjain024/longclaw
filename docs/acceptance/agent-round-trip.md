---
title: "Acceptance scenario — the real agent round trip"
product: LongClaw
status: active
milestone: "M3 — Vertical slice ready (Step 8)"
---

# Acceptance scenario — the real agent round trip

This is the repeatable test for the product's central claim: a human plans in
LongClaw, a real external agent executes against the same files, and the result
comes back to the board and ticket panel without a refresh or manual
reconciliation.

Run it before every pilot session and before any release build. It is a scripted
scenario, not a demo — every step has a stated pass condition, and a failure in
the sections marked **release-blocking** stops the release.

## What is automated, and what a human still has to do

| Layer | Covered by | Command |
|---|---|---|
| File contract for a simulated agent write | `src-tauri/tests/agent_round_trip.rs` | `npm test` |
| External write → watcher → index | `src-tauri/tests/watcher_integration.rs` | `npm test` |
| Native FSEvents watcher | `filesystem_round_trip` (ignored by default) | `npm run test:watcher` |
| App write → disk → restart → rebuild | `src-tauri/tests/storage_integration.rs` | `npm test` |
| Acknowledgement and decay logic | `src/freshness.test.ts`, `src/state.test.ts` | `npm test` |
| Attribution and the conflict it raises | `src/attribution.test.ts` | `npm test` |
| The card treatment, its decay, and degraded rows | `src/Board.test.tsx` | `npm test` |
| Panel behaviour: tick attribution, conflict, drafts, disk-state | `src/TicketPanel.test.tsx` | `npm test` |
| Ticket creation input | `src/QuickCreate.test.tsx`, `src/tickets.test.ts` | `npm test` |
| The request shapes the UI sends | `src-tauri/tests/ipc_requests.rs` | `npm test` |
| **A real agent discovering, reading, and editing a ticket** | this document | manual |

The automated suite proves the pipeline and what each surface does with what it
is given. It cannot prove that a real agent — Claude Code, Cursor, or anything
else — can find the instructions and follow them, or that the result reads well
on screen. That is what this scenario exists for, so run it with your eyes on the
window rather than on the checklist.

## Preparation

1. Build or launch the app:
   - development: `npm run dev`
   - pilot build: `npm run build:app`, then launch the produced `.app`
2. Have an agent CLI or editor available in a terminal (Claude Code, Cursor, or
   equivalent) that can read and write files in a chosen folder.
3. Choose an empty folder, or a real repository you are willing to write a
   `.longclaw/` directory into.
4. Copy `examples/agent-context/AGENTS.md` content into the repository root's
   own `AGENTS.md` or `CLAUDE.md` if the agent does not otherwise look inside
   `.longclaw/`. LongClaw never writes a root-level instruction file itself.

## Scenario

### 1. Create the project (human)

1. Launch the app. On first launch the window is the welcome screen alone —
   there is no sidebar. Choose **Create a project** and pick the folder.
2. Read the form back: it names the folder you picked with the `/.longclaw` it
   will create inside it, and the Name field arrives holding the folder's own
   name with a key derived from it.
3. Type a name beginning with a digit — `30 July 4PM` — and read the key the
   form suggests.
4. Clear the key field, then type `3J4` by hand.
5. Restore a valid key, keep Indigo, and press **Create project**.

**Pass (release-blocking):** the chosen folder is untouched until a valid form
is submitted — a refused creation leaves no `.longclaw/` behind. At step 3 the
suggested key starts with a letter; at step 4 the invalid key is explained
inline and **Create project** is disabled, so nothing reaches the folder. Step 1
is what **Back** returns you to, and it leaves the folder untouched too.

The folder is answered first here, which is the two-step flow the welcome screen
regained on 2026-08-07 (LC-77). The **ordering** half of this check moved with
it: the reported failure was a user answering a native dialog before learning
the form was invalid, and on this path the dialog is over before the form
exists. The surface that still asks last is the sidebar's quick create —
**Create project** → fill the form → **Choose folder** — so walk step 6 for it.

6. Open the sidebar's **Create project**, type `3J4` into Key, and press
   **Choose folder**.

**Pass (release-blocking):** no native dialog opens. The key is explained inline
and **Choose folder** is disabled. See
[the resolved report](../plans/completed/project-key-derivation-bug.md).

**Pass:** the board opens empty, the header shows the folder path, and the
folder now contains `.longclaw/longclaw.yaml`, `.longclaw/AGENTS.md`, and
`.longclaw/tickets/`.

### 2. Create a ticket (human)

1. Press **New ticket**.
2. Fill in a title, a description, two or three checklist items, and leave the
   status as Todo.
3. Create it.

**Pass (release-blocking):** the card appears in the Todo column, the panel
opens, and `.longclaw/tickets/<KEY>-1/ticket.md` exists on disk with the title,
description, `- [ ]` checklist items carrying `longclaw:item=` markers, and one
`kind: create` activity record attributed to `type: human`.

**Pass:** the board does *not* show the acknowledgement treatment for the
human's own write — no ring, no pulse, no "updated by" footer.

### 3. Let a real agent work on it (agent)

In the agent terminal, from the project folder, use a prompt of this shape (a
copy-pasteable version is in `examples/agent-context/prompt.md`):

> Read `.longclaw/AGENTS.md`, then read `.longclaw/tickets/<KEY>-1/ticket.md`.
> Move the ticket to `in_progress`, add a short paragraph to the description
> saying what you found, check off the first checklist item, and append one
> activity record attributed to yourself as an agent. Follow the instructions in
> `.longclaw/AGENTS.md` exactly and do not change `format`, `id`, `key`,
> `created_at`, or `rank`.

Do not tell the agent the file format. Discovering it from
`.longclaw/AGENTS.md` is part of the test.

**Pass (release-blocking):** the agent completes all five steps —
discover instructions, read the ticket, change state or description, tick a
checklist item, append an agent-attributed record — without being handed the
format.

If the agent needs correction, record exactly what it got wrong. That is
evidence about the instruction contract, not a tester error.

### 4. Watch it return (human, no refresh)

Keep the app in the foreground while the agent writes.

**Pass (release-blocking):**

- the card updates without any refresh, rebuild, or restart;
- the card carries the agent acknowledgement: agent-green ring, one pulse of the
  dot beside the key (two beats, never looping), and the footer
  `❯ updated by <agent> · <age> · via file edit`;
- the card has moved to the In Progress column if the agent changed status;
- with the panel open on that ticket, the description, checklist, and timeline
  update in place, the ticked row shows the agent treatment with `❯ just now`,
  and the header briefly confirms `✓ .longclaw/tickets/<KEY>-1/ticket.md`;
- the timeline entry shows the agent's name, an `AGENT` badge, and
  `via file edit`.

**Pass (release-blocking):** nowhere does the agent appear as an assignee. v0
renders no assignee at all; if the agent wrote an `assignee` field, the value is
preserved in the file and never presented as a human assignee.

**Pass:** if the agent's record carried no actor metadata, the acknowledgement
reads `⚠ file changed on disk — actor unknown` rather than crediting an agent.

**Accepted addition beyond the approved prototype:** a change whose newest record
is a *person* (a hand edit in an editor, say) is acknowledged too, with the human
accent and `• changed on disk · <age> · via file edit`. The prototype specifies
the treatment for agent and unknown actors only; showing nothing for a human file
edit would be the silent re-render the design forbids, so it was kept. Watch it
in the pilot: if it reads as noise, the treatment is one branch in
`src/freshness.ts` and one CSS variant to remove.

### 5. Review and answer (human)

1. In the panel, tick another checklist item.
2. Post a comment.
3. Change the status.

**Pass (release-blocking):** each change is written to `ticket.md`, the agent's
records are still present and unchanged, and the human's records are attributed
to `type: human`. Nothing the agent wrote is lost or rewritten.

**Pass (release-blocking):** the checklist item *you* ticked shows the ordinary
checked state — never the agent treatment. Only an external write earns
`❯ just now`.

**Pass:** the acknowledgement decays once the ticket has been opened, and it
decays on its own two minutes after the last external write.

**Pass:** each save shows `⟳ writing …ticket.md` in the panel header, then
`✓ …ticket.md`. A tick appears immediately rather than after the write returns.

### 6. Restart and rebuild

1. Quit the app and launch it again.
2. Open the project, then press **Rebuild index**.

**Pass (release-blocking):** after both the restart and the rebuild, the board
and panel show the same state — status, checklist counts, description, and the
full merged timeline with agent and human records in order.

### 7. Conflict path (human + agent, optional but recommended)

1. Open the ticket and start editing the description without saving.
2. Have the agent write the same ticket again.
3. Save your edit.

**Pass (release-blocking):** the banner appears **as the agent's change lands**,
not only when you press save. It names who changed the file, offers **Reload
file** and **Keep mine**, keeps your draft exactly as typed, and blocks further
saves until you choose. Choosing **Keep mine** re-applies your edit on top of the
current file; **Reload file** discards your draft and shows the agent's version.

**Pass (release-blocking):** your unsaved title and description survive the
agent's write untouched until you choose.

## Recording a run

For each run, record:

- date, build (dev or packaged), and macOS version;
- agent tool and version;
- the exact prompt used;
- pass or fail per numbered step;
- for any failure: the ticket file before and after, and what the agent did.

Store redacted session notes under [`docs/pilot/sessions/`](../pilot/sessions/).
A run with any release-blocking failure means the slice is not ready to show.
Use [the mid-v0 pilot session notes template](../pilot/session-notes-template.md)
when the run is part of a participant session.
