---
format: longclaw.ticket/v1
id: e788ddaf-3113-4b83-95ae-d65dc62e6a29
key: LC-66
title: The generated agent contract mints new example ids every time, so any project change dirties it
status: backlog
priority: p4
labels:
  - format
created_at: 2026-08-05T14:49:04.286Z
updated_at: 2026-08-05T15:14:39.826Z
---

`render_agent_contract` builds its worked example with `Uuid::new_v4` and `mint_id` (`core/project.rs`), and `update_project_file` reprints the contract on every project edit. So changing the theme rewrites the file with a different example `id`, `ck_` and `evt_`:

```diff
-id: 4f48444e-d2ab-433c-8c86-01f4364433d6
+id: f1b31690-1b23-4724-8b76-36ad5f44b42c
-- [ ] An example task <!-- longclaw:item=ck_7bbca0c0 -->
+- [ ] An example task <!-- longclaw:item=ck_f1596736 -->
```

## Why it exists

The user guide recommends committing `.longclaw/`. A file that changes without meaning changing is noise in every review, and noise is what trains people to skim a diff — including the diffs where the contract really did change because the project was renamed.

Found on 2026-08-05: switching this project's theme to clay produced exactly the diff above and nothing else.

## Note

The example is documentation, not data. Nothing reads those ids, which is why fixed ones cost nothing.

## Checklist

- [ ] Changing a theme or a label leaves .longclaw/AGENTS.md byte-identical, with a test that writes the same project twice and compares <!-- longclaw:item=ck_8dbd312f -->

## Activity

<!-- longclaw:event
id: evt_bfbfaf52
kind: create
occurred_at: 2026-08-05T14:49:04.286Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_97a4914a
kind: update
occurred_at: 2026-08-05T15:14:39.826Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d636bf3e
kind: comment
occurred_at: 2026-08-11T14:04:41.728Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Still live — checked during a backlog sweep on 2026-08-11 and left open.

Worth recording where the minting actually is, because it is not where this ticket points and the obvious grep says the bug is gone. `render_agent_contract` (`core/project.rs:425`) is now a pure `format!` over literals — the worked example's `ck_7d2a` and `evt_4b91c07a` are hardcoded in the template, and neither `Uuid::new_v4` nor `mint_id` appears anywhere in `project.rs`. A grep scoped to that file therefore reads clean.

The non-determinism comes in one level down. The contract's `## A complete example` section is built by `example_ticket` (`core/project.rs:559`), which calls the real `render_new_ticket` — and that reaches `render_new_ticket_as` in `core/ticket.rs`, which mints `id: {Uuid::new_v4()}` (`:1199`) and `mint_id("ck")` (`:1225`). So the example ticket still gets fresh ids on every project write, which is exactly the diff this ticket recorded.

The existing test (`the_generated_agent_contract_carries_a_readable_example`) asserts `ck_7d2a`, but that is the template's literal in the § Checking off a checklist item section, not the example ticket's — so it passes either way and does not cover this. The checklist's "a test that writes the same project twice and compares" is still the right shape and still absent.
<!-- /longclaw:event -->
