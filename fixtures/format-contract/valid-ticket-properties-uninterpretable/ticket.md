---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000011
key: LC-11
title: Property values this configuration cannot read
status: todo
priority: p2
type: epic
due: 28 Sep 2026
start: 2026-09-14
estimate: 5
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

Invariant 16, four ways over. None of these values is one this build would
write, and every one of them survives being read.

- `type: epic` is a slug the project does not define. It renders as itself, the
  way an undefined label slug does.
- `due: 28 Sep 2026` is a date in a shape the format does not store. It is not
  repaired into `2026-09-28`, because guessing what somebody meant and writing
  the guess back is the failure this whole format avoids.
- `start: 2026-09-14` is well-formed, and sits here to show that one bad value
  degrades alone rather than taking its neighbours with it.
- `estimate: 5` is a YAML integer rather than the string the format asks for,
  and reads as a Fibonacci `5` under a project on that scale. A missing pair of
  quotes is not a reason to lose a ticket.

None of them is an unknown key: this build knows all four, and it is the values
it declines to interpret. That is the line between invariant 11 and invariant 16.
