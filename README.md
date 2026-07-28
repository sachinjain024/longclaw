# LongClaw

LongClaw is a local-first project manager for humans and AI agents. Humans plan and remain accountable for tickets; agents execute work and contribute their context back to the same ticket record stored beside the code.

The product is currently in its foundation and specification phase.

## Product principles

- Files on disk are the source of truth.
- The on-disk format is designed for reliable agent reads and writes.
- Humans and agents collaborate on the same tickets, while assignees remain human.
- The desktop experience targets Linear-grade speed and polish.
- Local use requires no account or telemetry.

## Documentation

- [Vision and scope](docs/vision.md)
- [Design brief](docs/design_brief.md)
- [MVP execution plan](docs/mvp_plan_order.md)
- [On-disk file format and data model](docs/file_format.md)
- [Domain language](CONTEXT.md)

## v0 ticket layout

Each ticket owns a stable directory containing its canonical Markdown record and attachments:

```text
.longclaw/tickets/LC-42/
├── ticket.md
└── attachments/
```

`ticket.md` stores the ticket's structured metadata, description, checklist, attachment registry, comments, and activity. Text, image, and video attachment files live under the ticket's `attachments/` directory.

See [docs/file_format.md](docs/file_format.md) for the approved contract.

