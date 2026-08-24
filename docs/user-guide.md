---
title: "Using LongClaw"
product: LongClaw
status: active
milestone: "M6 — Release candidate"
---

# Using LongClaw

LongClaw keeps your tickets as Markdown files inside your project, so you and
the coding agents you work with are reading and writing the same records.

It runs entirely on your machine. There is no account, no sign-in, no sync, and
no network connection — not as a setting you can turn on, but as something the
app cannot do. Everything below follows from that: your tickets are files you
own, in a folder you chose, that keep working whether or not LongClaw is
installed.

This guide covers the five things worth knowing before you rely on it.

---

## 1. Your project folder

When you point LongClaw at a folder, it creates one directory inside it:

```text
your-project/
└── .longclaw/
    ├── longclaw.yaml     the project's name, key, theme, people, and labels
    ├── AGENTS.md         the editing contract agents read
    └── tickets/
        └── LC-1/
            ├── ticket.md          the whole ticket
            └── attachments/       files attached to it
```

That is everything. **LongClaw writes inside `.longclaw/` and nowhere else.** It
does not touch your source files, your `README`, or a root `AGENTS.md` you
already keep — the contract it maintains is `.longclaw/AGENTS.md`, which is a
different file on purpose.

Point it at the same folder as your code. The tickets live beside the work they
describe, which is what lets an agent read a ticket and the code it refers to in
one place.

**The project key** — the `LC` in `LC-1` — prefixes every ticket. Pick it when
you create the project; it becomes permanent once the first ticket exists,
because changing it would rename every ticket and every directory.

---

## 2. What a ticket is

One ticket is one directory, and `ticket.md` is the whole record: fields at the
top, then the description, checklist, attachments, comments, and history.

```markdown
---
format: longclaw.ticket/v1
id: 019c8c7e-5f42-7b09-a07c-7411ef79e129
key: LC-1
title: Load canonical ticket files
status: in_progress
priority: p2
labels:
  - storage
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T09:12:31Z
---

The description goes here, as ordinary Markdown.

## Checklist

- [ ] Something to do
```

It is a text file. You can read it in any editor, grep it, diff it, and open it
on a machine that has never heard of LongClaw. Nothing is stored in a database
that the files do not already say.

The full specification is [the file format](file_format.md), if you want to
generate or transform tickets yourself.

---

## 3. Backups and version control

**Commit `.longclaw/` to git.** It is the recommended backup, and it is the
reason the format is text: tickets diff, merge, review, and revert like the rest
of your project. A ticket's history is visible in `git log` the same way your
code's is.

There is nothing else to back up. LongClaw keeps one thing outside your project
— a list of which folders you have opened, in
`~/Library/Application Support/io.longclaw.desktop/` — and losing it costs you
nothing but re-opening your folders. **No ticket data lives there.**

If you would rather not commit tickets, they are still just files: copy the
folder, or let whatever backs up the rest of your disk back them up too.

---

## 4. Working with agents

This is what LongClaw is for. An agent with access to your project folder can
read and update tickets directly, and its edits appear in the app without a
refresh.

**Point your agent at the tickets once.** Add a short section to the file your
agent already reads — `AGENTS.md`, `CLAUDE.md`, or whatever it is — telling it
where the tickets are and to read the contract first. There is a copyable
example in [`examples/agent-context/AGENTS.md`](../examples/agent-context/AGENTS.md).

**`.longclaw/AGENTS.md` is the contract, and the app maintains it.** You do not
write it and should not need to edit it. It tells an agent how to update a
ticket without corrupting it: keep the fields valid, append history rather than
rewriting it, and never invent a ticket key.

**You will see who did what.** Edits made by an agent are attributed to an agent
in the ticket's history, separately from yours. That separation is the point —
you stay accountable for the plan, and the record shows which changes were not
yours.

**Agents create tickets through the `longclaw` CLI.** The CLI is the creation
surface agents use — it allocates the ticket key, so an agent never invents one,
and it requires `--agent-id`, so every agent-filed ticket is attributed as agent
work. You create tickets in the app; either way, the plan stays yours to review.

---

## 5. When something goes wrong

LongClaw is built to fail visibly and without destroying anything. In every case
below, your file is left exactly as it is.

**A ticket someone edited while you had it open.** LongClaw notices the file
changed underneath you and says *"Changed on disk"* rather than overwriting it.
It never silently discards either version — you are shown the conflict and
choose.

**A ticket that will not parse.** A malformed `ticket.md` stays visible as a
degraded ticket, in the column it was already in, instead of vanishing from the
board. Opening it shows the file itself, line-numbered with the offending line
marked, and the error names the line it happened on. **Open in editor** hands the file to
whatever you open Markdown with; fix it there and it returns on its own, or
press **Retry parse** rather than waiting. LongClaw will not "repair" it for
you, because a repair is a guess about what you meant.

**A ticket from a newer version of LongClaw.** Shown read-only —
*"Newer format, shown read-only"* — rather than migrated. Upgrade the app to
edit it.

**A project folder that moved.** The project is marked unreachable rather than
forgotten, and you can point LongClaw at its new location. Nothing is deleted;
it stopped being able to find your folder, not your work.

**The project list itself is corrupt.** LongClaw fails closed: it will not reset
the file or silently forget your projects. Quit the app, and in
`~/Library/Application Support/io.longclaw.desktop/` copy
`project-registry.backup.json` over `project-registry.json`, then restart. If
the backup is unusable too, just open your project folders again — **this list
is not your data.** Your tickets are in your project, untouched.

**The window comes back on the wrong appearance or the wrong project.** Those
choices live in `device-preferences.json`, in the same folder as the project
list. Unlike the list, it fails open: one LongClaw cannot read is renamed to
`device-preferences.invalid.json` and the app starts on its defaults rather than
refusing to start. Deleting it is a supported way to start over — it holds no
ticket, and nothing in it is your data.

**Anything else.** LongClaw says what it was doing, which file it was doing it
to, and what to try. If you want more than the window shows, launch it from a
terminal:

```sh
LONGCLAW_LOCAL_DIAGNOSTIC=1 /Applications/LongClaw.app/Contents/MacOS/longclaw-desktop
```

It prints lines prefixed with `LONGCLAW_LOCAL_DIAGNOSTIC` to stdout and sends
them nowhere — they go to your terminal and stop there. Expect a small channel
rather than a log: how long the first board took to appear, and a line if the
watcher ever loses filesystem events and rebuilds the index. If you are
reporting a problem, this is the output worth pasting.

---

## What this version does not do

v0 is deliberately small. There are no terminals inside the app, no sync, no
teams, no accounts, and no cross-platform builds — those are later phases and
are not partially present here. What you get is the local loop: you plan, agents
execute, and the ticket record is shared between you.
