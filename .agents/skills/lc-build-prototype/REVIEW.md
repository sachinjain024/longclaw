# Taking feedback, then settling

Feedback arrives as the Markdown that the Feedback scene produces, or as loose
notes that name scene labels and copy ids.

## While the review is open

1. **Change the prototype, not `src/`.**
   - Copy changes go in `COPY.rows`, the one place a string lives.
   - Layout changes go in `#proposed` and in the scene's markup.
   - Mark each row you touch `changed`, and keep it `new` if it was new against
     the shipped app.
2. **Answer every point.** Apply it, or explain why not in a note on the scene
   or on the deck row.
3. **Look again** with step 6 of [SKILL.md](SKILL.md), at least on the scenes
   you changed.
4. **Hand back:** list what changed against each point of feedback, and what is
   still open.

**Done when:** every point of feedback has either a change or a recorded reason
against it.

## When the review settles

The prototype is deleted, and nothing it decided goes with it.

1. **Write the decisions into the ticket** under `## Review decisions`: which
   variant won, and why, one line per scene ask.
2. **Write the settled deck into the ticket** under `## Copy deck`, as a table
   of id, kind, where and text. Copy that only lived in a deleted file gets
   argued over again by whoever ships it.
3. **Move keyboard decisions** into `docs/design/prototype/keyboard-focus-map.md`.
   It is citation-pinned, so follow AGENTS.md's rules for editing it.
4. **Delete the file**, and move its README entry into the paragraph that lists
   past prototypes, with the commit that still holds the file.

All ticket edits go through `longclaw ticket edit` with `--agent-id`.

**Done when:**
- the ticket carries both sections;
- the file is gone;
- the README names the commit that still holds the file.
