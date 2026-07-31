# Format-contract fixture corpus

Every directory here is one contract case for the on-disk format described in
[`../../docs/file_format.md`](../../docs/file_format.md). The corpus is the
executable half of the M1 data contract: it fixes what a conforming
implementation must accept, what it must reject, and what it must preserve.

Each case contains:

| File | Purpose |
|---|---|
| `ticket.md` | the exact bytes a human, agent, or editor put on disk |
| `expected.json` | the outcome a conforming reader must produce |
| `attachments/` | optional attachment bytes referenced by the registry |

`expected.json` fields:

- `summary` — why the case exists.
- `key` — the ticket directory the harness writes `ticket.md` into, so
  key/directory agreement is exercised.
- `projectKey` — the project the case is read as belonging to. Omit it and the
  directory's own prefix is used, which is what every case that is not about
  ownership wants. Set it to a different key to prove that a ticket key's prefix
  is the project that owns it.
- `outcome` — `valid` (parses into a ticket) or `degraded` (surfaced with a
  diagnostic, never rewritten).
- `code`, `diagnosticContains`, `readOnly` — expectations for degraded cases.
- `ticket` — the field-by-field projection a valid case must produce. Only the
  keys present are asserted, so a case stays focused on what it proves.

Two invariants are asserted for every case without being restated in each
`expected.json`:

1. Reading, indexing, and degrading a file never changes its bytes.
2. A valid case re-serializes byte-for-byte identically when nothing is
   mutated, and a mutation changes only the lines it is supposed to change.

The corpus is driven by
`apps/desktop/src-tauri/tests/file_format_contract.rs`. Add a directory to add
a case; no test code changes are required.

## Reader decisions this corpus fixes

The approved format leaves a few reader-level questions open. Step 6 settled
them the way the cases here describe; each decision has a fixture that would
fail if it changed.

| Decision | Why | Case |
|---|---|---|
| A reserved section runs to the next reserved heading or the end of the file | An ordinary heading such as `## Approach` after `## Checklist` stays where its author put it instead of splitting the description in two | `valid-headings-inside-event-body` |
| Fenced code and bounded records never end a section | An agent can quote `## Checklist` in a comment without changing what the file means | `valid-fenced-reserved-heading` |
| The description is the Markdown before the first reserved section | Gives the editor one unambiguous region to write back | `valid-rich` |
| An activity or attachment record found outside its section is reported, not relocated | Moving someone's content silently is the failure mode the whole format avoids | covered by unit tests in `core/ticket.rs` |
| An unfamiliar `kind` is preserved rather than dropped | A newer writer's timeline entry stays visible and intact | covered by unit tests in `core/ticket.rs` |
| Timestamps must be UTC; a local offset is refused with a diagnostic naming the rule | The format says UTC, and quietly converting a value would rewrite meaning | `invalid-non-utc-timestamp` |
| v0 reads LF files; CRLF is reported, never converted | Converting line endings would rewrite every line of a file the app was only asked to read | covered by unit tests in `core/ticket.rs` |
| One app write appends exactly one activity event | Two events sharing a timestamp would leave their order to the id tie-breaker. A note accompanying a change becomes that change event's body, which is the shape the format documents | asserted for every valid case |
| A checklist item an agent appended without a marker is adopted on the next app write | Otherwise the app could never attribute a change to that item | `valid-agent-checklist-without-ids` |
| A ticket key's prefix is the project that owns it, and ownership is settled before the contents are believed | A folder copied in from another project, or left by a renamed one, is a valid ticket of a project that is not this one; indexing it would put a key on the board that does not match the project it appears in | `invalid-key-foreign-project-prefix` |
