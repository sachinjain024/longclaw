---
format: longclaw.ticket/v1
id: 51ecd5db-9da4-4a32-8175-ee0afef03c7b
key: LC-275n
title: "Polish the README for HN and Reddit: credible claims and a working first-agent workflow"
status: in_progress
priority: none
labels:
  - product
type: docs
created_at: 2026-09-25T13:32:47.752Z
updated_at: 2026-09-25T13:37:02.039Z
---

Follow-up to LC-274e and merged PR #62. The objective is to make the README credible, impressive, and easy to act on for a first-time Hacker News or Reddit visitor. The previous ticket substantially improved structure, installation, imagery, comparisons, and repository housekeeping. This follow-up focuses on accurate claims and the first successful human/agent workflow.

## Audit feedback

### Fix factual claims and runnable examples

- The CLI quickstart creates a ticket and then edits `MP-1`. New keys include a random trailing letter, so that sequence fails when followed literally. Use the key returned by `ticket create`, and verify the whole sequence in a fresh project against the downloaded release.
- Install step 3 says LongClaw creates `.longclaw/` and "writes nowhere else". The app also stores its registry and device preferences in Application Support. Suggested copy: "LongClaw stores your project's tickets in `.longclaw/` inside that folder."
- Replace "Completely Secure Local-first app" with "Privacy and network access". Local storage does not establish complete security. LC-274e records that the maintainer deliberately chose the original heading; this audit recommends revisiting that choice for launch credibility.
- Make the network description precise: distinguish optional background update checks and public GitHub star-count requests from user-triggered update downloads. Avoid implying two requests total. Suggested offline copy: "Ticket management works offline. Update checks, update downloads, and the GitHub star count require a connection." Verify what the Settings toggle disables and avoid implying that turning off automatic checks disables manual checks.
- Remove the unmeasured claim that direct file access is faster and costs fewer tokens than an API. Token use depends on payloads and history; ticket files themselves contain structured activity metadata. Suggested copy: "Agents read ticket context directly from your repository, without an API integration."
- Replace the absolute app/CLI claim "never disagree about the format" with "The app and CLI share the same ticket-writing code." Different installed and checkout versions can differ.

### Explain the benefit before the internals

Suggested opening:

> **A local-first issue tracker for developers working with coding agents.**
> Plan work on a Mac board. Let your agent update the same tickets through the CLI. Descriptions, checklists, and activity stay in Markdown files beside your code.

The current "stay accountable" and "write their context back" are abstract. The opening should name what the user does and what stays in their repository.

"How it works" currently starts with a lengthy event-metadata excerpt, and another file example follows later. Lead with a short three-step workflow: create a ticket, ask an agent to work on it, see the board reflect its updates. Keep one compact ticket example; move detailed event syntax into a collapsible example or the file-format docs.

Bring the existing AGENTS.md/CLAUDE.md setup snippets into onboarding rather than leaving them below the CLI examples. Explain how to merge the instructions into an existing context file and give a first-task prompt using the actual ticket key. Installing the app should lead clearly to experiencing the main benefit.

### Improve presentation and positioning

- The hero shows "Signing and notarization" in TODO while installation says the app is signed and notarized. Refresh illustrative tasks to avoid contradicting shipped features and demonstrate human/agent activity. Keep the existing scripted website-component export and approved README raster exception.
- Keep the honest comparison, but state when LongClaw is a good fit: a Mac desktop interface, repository-owned records, and visible agent activity. A board and shared Markdown workflow are not unique; Backlog.md documents both. Verify external claims against primary sources and link the alternatives.
- Add an obvious feedback destination. The current issue configuration offers bug reports, security reports, and documentation, but no clear feature-feedback route. Decide an appropriate existing or new route without requiring a broad community-platform change.
- Avoid growing the feature list into a release inventory. LC-274e explicitly mentioned the new status bar, which the README does not describe; prioritize major user benefits rather than adding a bullet solely for completeness.

## Acceptance and scope

Validate the onboarding against the current downloaded app in a fresh project, not only a development build. Complete one human-to-agent-to-board workflow using only the README and its linked setup instructions. Inspect GitHub's actual rendered README at phone width and in light and dark themes; inspect links, image legibility, tables, and code blocks.

The README should remain consistent with shipped behavior and the website's claims. Do not introduce unsupported platform, sync, team, or security promises. Recheck the claims in this audit against the implementation at the time of the change.

PR #62's description was stale at audit time: it described only the structure changes and called completed work out of scope. It is now merged; describe the full final scope accurately in the new follow-up PR rather than treating the old PR as pending work.

## Launch context (advice, not publishing authorization)

Show HN favors something people can try, low barriers, and an explanation of why the maker built it. LongClaw's downloadable, account-free app fits that. The maintainer should write the launch story personally: current HN guidelines prohibit generated or AI-edited posts and comments. Do not solicit votes. On Reddit, read each target community's rules, disclose authorship, and ask for specific feedback relevant to that community. No launch posts or outbound messages are authorized by this ticket.

Sources checked during the audit:
- https://news.ycombinator.com/showhn.html
- https://news.ycombinator.com/newsguidelines.html
- https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette
- https://github.com/MrLesk/Backlog.md

## Checklist

- [x] (CLI) Fix the quickstart to use the allocated ticket key, including its random trailing letter. <!-- longclaw:item=ck_3d4aa94b -->
- [ ] (Accuracy) Replace the claim that LongClaw writes nowhere outside .longclaw with precise project-storage copy. <!-- longclaw:item=ck_b9b2d906 -->
- [ ] (Privacy) Settle a factual privacy heading and distinguish background checks, manual update downloads, and offline ticket management. <!-- longclaw:item=ck_9059e999 -->
- [ ] (Claims) Remove unsupported speed/token comparisons and the absolute app/CLI format guarantee. <!-- longclaw:item=ck_a31e97ed -->
- [ ] (Opening) Rewrite the pitch around developers, the Mac board, coding agents, and repository-owned Markdown records. <!-- longclaw:item=ck_7df9b9b3 -->
- [ ] (Workflow) Lead How it works with create, delegate, and observe; consolidate the two long file/event examples. <!-- longclaw:item=ck_dacb6a19 -->
- [ ] (Onboarding) Bring AGENTS.md/CLAUDE.md setup into installation and include a first-task prompt using the actual ticket key. <!-- longclaw:item=ck_596009f2 -->
- [ ] (Hero) Refresh illustrative tasks so they match shipped capabilities and demonstrate agent activity; regenerate with the existing script. <!-- longclaw:item=ck_0cf08e91 -->
- [ ] (Comparison) Verify and link competitor claims; explain LongClaw's fit without implying shared features are unique. <!-- longclaw:item=ck_51cf2263 -->
- [ ] (Feedback) Add a clear route for feature feedback alongside bug reporting. <!-- longclaw:item=ck_e8b97e30 -->
- [ ] (Validation) Follow the README against the downloaded release in a fresh project and complete one human-to-agent-to-board workflow. <!-- longclaw:item=ck_b17f5508 -->
- [ ] (Validation) Inspect GitHub rendering on mobile and both themes; check links, image legibility, tables, and code blocks. <!-- longclaw:item=ck_3a7209fe -->
- [ ] (Final pass) Check copy against shipped behavior and website claims, prioritize major user benefits, and describe the final scope accurately in the follow-up PR. <!-- longclaw:item=ck_be9a72ab -->

## Activity

<!-- longclaw:event
id: evt_ce553041
kind: create
occurred_at: 2026-09-25T13:32:47.752Z
actor:
  type: agent
  id: codex
  name: Codex
-->
### Codex created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2b30634f
kind: update
occurred_at: 2026-09-25T13:34:39.066Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9ceeb3af
kind: update
occurred_at: 2026-09-25T13:37:02.039Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: checklist.ck_3d4aa94b.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket

Completed the first checklist item: split the README quickstart after ticket creation and explain copying the returned key, including its random trailing letter, into the edit command. Verified with the installed CLI in a fresh temporary project: create returned MP-1b, edit set it to in_progress, and list and help succeeded. The remaining README improvements stay open.
<!-- /longclaw:event -->
