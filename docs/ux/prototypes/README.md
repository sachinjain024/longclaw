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

- [`LC-201-Bulk-Create-In-Quick-Create-Mode.html`](LC-201-Bulk-Create-In-Quick-Create-Mode.html)
  — quick create with a description, labels and a **Create more** loop
  (spec: `.longclaw/tickets/LC-201/ticket.md`).

## Imported prototypes

One entry here is not a single self-contained file: `LongClaw Settings Screen UI/`
is an external design-tool export that vendors its own design system under
`_ds/`, so it neither links the app's tokens nor follows the naming rule above.
It is the settings-screen source for **LC-223**, which cites this path, and the
directory name is kept as the export produced it so that citation stays valid.
Open `LongClaw Settings Prototype.dc.html` in a browser.
