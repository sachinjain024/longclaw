# Ticket prototypes

One HTML file per ticket that proposes a visible change, named for its key.
Each is standalone: open it in a browser, no server and no build.

They are **not** the v0 prototype. `docs/design/prototype/` is the end-to-end
handoff bundle that the app was built from and that the design docs cite; these
are single-question pages that exist to be reviewed before code is written and
that stop mattering once the ticket ships.

Each one links the app's own `tokens/design-tokens.css` and `styles.css` and
renders the components' real markup, so what is on screen is what would ship.
The CSS a ticket proposes goes in a `<style id="proposed">` block and the
harness's own in `<style id="harness">`, kept apart so a review can tell which
is which.

Each one also ends in a **copy deck**: every user-facing string it proposes,
collected in one scene so the copy can be reviewed as copy rather than found
scene by scene. The scenes and the deck render from the same object, so the two
cannot drift. See `AGENTS.md` § UX prototypes for what belongs in it.

- [`LC-256a-Auto-Update.html`](LC-256a-Auto-Update.html)
  — the update notice in the sidebar footer, the gear menu with its two
  app-level rows removed, and the **Updates** pane in twelve states
  (ticket: `.longclaw/tickets/LC-256a/ticket.md`, which carries the settled
  copy deck; spec: `docs/specs/LC-256a-auto-update.md`, whose D6 this
  supersedes).

- [`LC-201-Bulk-Create-In-Quick-Create-Mode.html`](LC-201-Bulk-Create-In-Quick-Create-Mode.html)
  — quick create with a description, labels and a **Create more** loop
  (spec: `.longclaw/tickets/LC-201/ticket.md`).

  **Kept past its ticket on purpose.** LC-201 shipped and the rule above would
  delete this, but LC-237k's first step names this file as the model for the
  prototype it has yet to write, and a `todo` ticket pointing at a deleted file
  is worse than a stale example. It goes when LC-237k's own prototype lands.
  Read it for the shape, not for the rules: it predates the **copy deck**,
  which `AGENTS.md` has required since LC-249a and which a new prototype owes.

Three others have been here and are not any more, all deleted when their
tickets settled: LC-236e (defining a label from inside the create flows) and
LC-249a (the `longclaw` command's install offer), both in the history at
`3ad94ef`, and LC-243d (three answers to what says which half of the Board |
List segment is pressed — option B was chosen), at `567d0cf`.

## Imported prototypes

One entry here is not a single self-contained file: `LongClaw Settings Screen UI/`
is an external design-tool export that vendors its own design system under
`_ds/`, so it neither links the app's tokens nor follows the naming rule above.
It is the settings-screen source for **LC-223**, which cites this path, and the
directory name is kept as the export produced it so that citation stays valid.
Open `LongClaw Settings Prototype.dc.html` in a browser.
