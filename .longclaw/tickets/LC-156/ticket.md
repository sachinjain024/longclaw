---
format: longclaw.ticket/v1
id: 7d51585b-22f3-4051-8bea-640b74a5a054
key: LC-156
title: App shell — sidebar still carries two project-action buttons; the prototype has only section headers and project rows
status: canceled
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-06T06:37:41.923Z
updated_at: 2026-08-06T14:19:48.813Z
---

LC-73 moved \`Open folder\` / \`Create project\` from two filled buttons above the sections to one quiet ghost row at the foot of the list, taking the checklist's explicit "if they stay" branch.

They stayed for a reason that is still true: removing them would strand the user. \`Welcome\` renders only when no project is open (\`App.tsx:1102\`), and the palette root has no \`Open folder\` or \`Create project\` command — only \`Go to project…\`, which lists projects already registered (\`CommandPalette.tsx:150-211\`). With one project open there would be no way to add a second.

But the ticket's own header is **"Sidebar has only section headers and project rows"** (\`screen-specs.md:30-36\`), and a row holding two ghost buttons is not that. A code review read "one quiet ghost row" as one *affordance*, not one *line*, and on that reading LC-73 landed the fallback rather than the target.

Closing the gap is not a restyle. It needs the two checklist items below first — in particular a create-project surface that does not live in the sidebar, which no spec currently draws. That is why this is its own ticket and not a reopen.

## Source

\`docs/cc_screens_diff.md\` — **D-0B**, § App shell. Follow-up to LC-73.

## Checklist

- [ ] Add an Open folder command to the palette root, so registering a folder has a keyboard path that is not the sidebar <!-- longclaw:item=ck_788238e3 -->
- [ ] Give Create project a surface reachable with a project open — today CreateProjectForm is anchored in the sidebar section, and Welcome only renders when there is no project (App.tsx:1102) <!-- longclaw:item=ck_71cc2f70 -->
- [ ] Then delete the .project-actions row and update a11y-audit.mjs, whose A5 row tracks Open folder as a primary control <!-- longclaw:item=ck_34502da8 -->

## Activity

<!-- longclaw:event
id: evt_f580dc8f
kind: create
occurred_at: 2026-08-06T06:37:41.923Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c52b8371
kind: update
occurred_at: 2026-08-06T14:19:48.813Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: canceled
-->
### Claude Code updated this ticket

Canceled — the premise is gone.

This ticket existed to make deleting the sidebar row possible. Founder decision of 2026-08-06 (recorded on LC-73) is that the actions stay in the sidebar and move to the top, under the lockup. `screen-specs.md` § App shell now draws them and `cc_screens_diff.md` D-0B is struck through as "not a diff", so there is no longer a gap between spec and build to close.

Item by item:

- **Open folder in the palette** — still wanted, and independent of where the buttons live. Refiled as **LC-162**.
- **A create-project surface outside the sidebar** — canceled. This was the expensive item, and the one no spec drew. The sidebar is the surface that lists projects, so it is also where "add one" belongs; inventing a second home for it was the tail wagging the dog.
- **Delete the .project-actions row and update a11y-audit.mjs** — the delete is canceled. The audit half is done on LC-73: A5's selector moved to `.project-actions .ghost` and still passes.

Worth keeping from the analysis here, because it outlived the conclusion: the foot of the project list was never a safe home for these. `.project-nav` has no `overflow-y`, so a long enough list carries them off screen. That is part of why the top won.

Leaving the two dead checklist items unchecked rather than ticking them — they were not done, they were called off.
<!-- /longclaw:event -->
