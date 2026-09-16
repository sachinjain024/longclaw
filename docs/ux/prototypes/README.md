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

- [`LC-201-Bulk-Create-In-Quick-Create-Mode.html`](LC-201-Bulk-Create-In-Quick-Create-Mode.html)
  — quick create with a description, labels and a **Create more** loop
  (spec: `.longclaw/tickets/LC-201/ticket.md`).

  **Kept past its ticket on purpose.** LC-201 shipped and the rule above would
  delete this, but LC-237k's first step names this file as the model for the
  prototype it has yet to write, and a `todo` ticket pointing at a deleted file
  is worse than a stale example. It goes when LC-237k's own prototype lands.
  Read it for the shape, not for the rules: it predates the **copy deck**,
  which `AGENTS.md` has required since LC-249a and which a new prototype owes.

- [`LC-243d-Board-List-View-Switcher-Selected-State.html`](LC-243d-Board-List-View-Switcher-Selected-State.html)
  — three answers to one question: with the accent fill off the Board | List
  segment, what says which half is pressed? (spec:
  `.longclaw/tickets/LC-243d/ticket.md`, item `ck_73bf8498`, reopened after
  PR #47 shipped the fill.)

  The four scenes stand the shipped control and all three answers in the same
  header row, so the comparison is a look down a column rather than a memory
  test. Hover and focus are the browser's own — nothing here draws its own
  `:hover`, because a prototype that paints its own states is a prototype that
  only ever agrees with itself.

Two others have been here and are not any more, both deleted when their tickets
shipped: LC-236e (defining a label from inside the create flows) and LC-249a
(the `longclaw` command's install offer). They are in the history at `3ad94ef`.

## Imported prototypes

One entry here is not a single self-contained file: `LongClaw Settings Screen UI/`
is an external design-tool export that vendors its own design system under
`_ds/`, so it neither links the app's tokens nor follows the naming rule above.
It is the settings-screen source for **LC-223**, which cites this path, and the
directory name is kept as the export produced it so that citation stays valid.
Open `LongClaw Settings Prototype.dc.html` in a browser.
