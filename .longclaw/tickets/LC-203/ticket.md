---
format: longclaw.ticket/v1
id: 8bf3e40c-f151-475f-98cd-9642a36e7873
key: LC-203
title: "[Depends on LC-202] User should be able to write comments on the Markdown File"
status: backlog
priority: p2
created_at: 2026-08-11T14:27:03.398Z
updated_at: 2026-08-11T14:27:03.398Z
---

There should be a Toolbar with options like Edit, Add Comments and When user clicks on Add Comments, there should be a right panel which pops up.

Now user can click on any title, text selection, etc and then add a comment on it. All the comments should be visible as boxes on the right side which are clickable and when user clicks on the box then that particular section of the box gets highlighted.

There should be a button in the right panel which says Copy Comments or Share with LLM, when user clicks on this button we provide all the relevant information to coding agent in a particular format (e.g. JSON) which tells the right identifier to the LLM as well the user feedback and then LLM can process the comments one by one. 

The user feedback isn’t saved anywhere. When user copies comments and clicks on Finish Review, it gets lost.

## Activity

<!-- longclaw:event
id: evt_0c1a6e6a
kind: create
occurred_at: 2026-08-11T14:27:03.398Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->
