---
format: longclaw.ticket/v1
id: e788ddaf-3113-4b83-95ae-d65dc62e6a29
key: LC-66
title: The generated agent contract mints new example ids every time, so any project change dirties it
status: todo
priority: p4
labels:
  - format
created_at: 2026-08-05T14:49:04.286Z
updated_at: 2026-08-05T14:49:04.286Z
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
