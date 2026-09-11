---
format: longclaw.ticket/v1
id: e788ddaf-3113-4b83-95ae-d65dc62e6a29
key: LC-66
title: The generated agent contract mints new example ids every time, so any project change dirties it
status: done
priority: p4
labels:
  - format
created_at: 2026-08-05T14:49:04.286Z
updated_at: 2026-09-10T07:29:33.248Z
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

- [x] Changing a theme or a label leaves .longclaw/AGENTS.md byte-identical, with a test that writes the same project twice and compares <!-- longclaw:item=ck_8dbd312f -->

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

<!-- longclaw:event
id: evt_f1181dc5
kind: comment
occurred_at: 2026-09-08T15:03:08.210Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

LC-227 made this fire far more often. The settings Properties pane routes all eight of its writes through registry.rs's update_project_file, which calls write_agent_contract on every one — so every property toggle reprints .longclaw/AGENTS.md with three fresh minted ids, where previously a theme or label change was the only trigger. LC-227 also gave the contract real content to lose in that noise: it now carries a table row per enabled property, so ticking Types on produces three meaningful new lines delivered alongside three meaningless ones. The app's own test suite already works around this with a without_minted_ids helper in storage_integration.rs. Filed at p4 when the trigger was rare; the trigger is no longer rare.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_93dd29c0
kind: update
occurred_at: 2026-09-10T07:29:33.248Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
  - field: checklist.ck_8dbd312f.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Fixed on LC-214's branch, and closed by it rather than separately.

The minting was in `render_new_ticket_as` (`core/ticket.rs`), reached from `example_ticket` — exactly where the 2026-08-11 comment said it was. `core/ticket.rs` now carries an `Ids` seam: `Ids::Minted` for every real create, and `Ids::Fixed` for the single caller whose output is documentation rather than data. `render_example_ticket` is that caller's entry point, so the example is still a real render through the same code a create takes; only the three ids it invents are literals now.

This ticket's checklist item is done, in the shape it asked for: `the_contract_is_byte_identical_two_renders_running` (`core/project.rs`) renders the same project twice and compares. Whole bytes rather than the tables — the ids were the part that moved, so a comparison filtered down to the property rows would have passed throughout the bug.

Two things it also unblocked. `the_example_projects_agent_contract_matches_the_generator` compared the committed fixture to the generator through a `without_minted_ids` mask; that helper is deleted and the test compares bytes. And LC-214's version banner and reprint-on-every-project-edit made byte stability worth more than it was when this was filed at p4: with LC-227's eight property controls all routing through `update_project_file`, the churn had stopped being rare.

Verified by hand as well as by test: two `label add` runs against a fresh project produce a diff of exactly the label rows.
<!-- /longclaw:event -->
