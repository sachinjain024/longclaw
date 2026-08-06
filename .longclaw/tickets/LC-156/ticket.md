---
format: longclaw.ticket/v1
id: 7d51585b-22f3-4051-8bea-640b74a5a054
key: LC-156
title: App shell — sidebar still carries two project-action buttons; the prototype has only section headers and project rows
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-06T06:37:41.923Z
updated_at: 2026-08-06T06:37:41.923Z
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
