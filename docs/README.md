# Project docs

The documents behind LongClaw: how it is built, how agents work in this
repository, and the evidence behind each release. For using
LongClaw, start with the [user guide](user-guide.md) or
[longclaw.io/docs](https://longclaw.io/docs/).

## How it is built

- [On-disk file format and data model](file_format.md)
- [Architecture decisions](adr/)
- [Domain language](../CONTEXT.md) — the vocabulary every surface and document uses
- [Design docs](design/) — the prototype bundle the app was built from
- [App-specific notes](../apps/desktop/README.md) — registry recovery, device preferences
- [The website](../apps/website/README.md) — longclaw.io: structure, content model, deployment

## Working with agents

- [Instructions for agents](../AGENTS.md) — the contract an agent in this repository follows
- [Issue tracker surface](agents/issue-tracker.md), [triage labels](agents/triage-labels.md), [domain docs](agents/domain.md)

## Release evidence

- [Acceptance scenarios and records](acceptance/README.md)
- [Mid-v0 pilot protocol](pilot/README.md) · [response memo](pilot/response-memo.md)
- [v0 release risks](release-risks.md)
