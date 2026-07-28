# Domain Docs

How the engineering skills should consume this repository's domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- `docs/adr/` entries that affect the area being explored.

If these files do not exist, proceed silently. Domain-modeling skills create them lazily when terminology or decisions are resolved.

## File structure

This is a single-context repository:

/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, proposal, hypothesis, or test—use the term defined in `CONTEXT.md`.

If a needed concept is absent, reconsider whether the term belongs to the project or note the gap for domain modeling.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding the decision.
