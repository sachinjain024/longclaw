# Acceptance prompt for a real agent

Paste this into the agent, from the project folder, replacing `<KEY>-1` with the
ticket the human created. Do not describe the file format to the agent —
discovering it is part of the test.

```text
Read .longclaw/AGENTS.md, then read .longclaw/tickets/<KEY>-1/ticket.md.

Then, following .longclaw/AGENTS.md exactly:

1. Move the ticket to in_progress.
2. Add a short paragraph to the description saying what you found.
3. Check off the first unchecked checklist item.
4. Append one activity record attributed to yourself with type: agent, saying
   what you did and what is left.

Do not change format, id, key, created_at, or rank. Keep any field you do not
understand exactly as it is. Write the file atomically: write a sibling
temporary file and rename it over ticket.md.
```

## A second run: the conflict path

With the ticket open in the app and an unsaved description edit in progress:

```text
Append one more activity record to .longclaw/tickets/<KEY>-1/ticket.md as a
comment from you, following .longclaw/AGENTS.md. Change nothing else.
```

The app must then offer the conflict choice rather than overwriting either side.
