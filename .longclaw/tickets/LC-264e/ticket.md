---
format: longclaw.ticket/v1
id: f2a29324-f726-4d39-80f2-40aafc419ee8
key: LC-264e
title: The online network audit's C6 refused 0.3.0's run, and the release shipped without it
status: todo
priority: p2
labels:
  - platform
created_at: 2026-09-22T08:02:12.998Z
updated_at: 2026-09-22T08:02:49.028Z
---

`npm run audit:network -- --phase online` is the release gate's process-monitor
pass, and for 0.3.0 it failed its own C6 control:

> the update check was observed in the online phase — no update check was
> observed, either it never fired or the sampler missed it, and either way this
> run says nothing about what else was quiet. Drive the Check now step

0.3.0 shipped anyway, as a deliberate call. This is the ticket that says so, and
that the evidence is still owed.

**The run was cut short, rather than the app being quiet.**
`dist-network-audit/network-audit-online.json` records 18 lsof samples at 500ms
— about nine seconds — with `connections: []` and `counters: []`, while listing
all eight driven steps as confirmed. The offline run in the same session sampled
215 times (~107s) and automatic-off 59 (~30s). Nine seconds cannot have covered
eight steps ending in *Settings → Updates → Check now*, so the sampler's window
closed before the step it exists to observe.

The other two phases passed 7/7 with zero connections, so what is missing is
specifically the positive control: the one run that would have observed the
sanctioned traffic and, by observing it, given weight to the silence everywhere
else.

**Why it matters more for this release than the last.** 0.3.0 adds the star
control, the first second kind of request — one `GET` to
`api.github.com/repos/sachinjain024/longclaw` — and the online phase is the only
pass that would see `api.github.com` at all. 0.2.0's online phase is not a
substitute: that build had no star request in it.

## What to do

- Re-drive `npm run audit:network -- --phase online` against the 0.3.0 bundle,
  on a quiet machine, letting the sampler run the full length of the eight steps
  and ending with *Check now*. Confirm C6 goes green and that the only
  connections recorded are to the sanctioned hosts.
- Check whether the harness should refuse a run whose sampling window is too
  short to contain the steps it was told were driven, instead of only noticing
  afterwards that C6 saw nothing. A run that claims eight confirmed steps in
  nine seconds is describable as wrong without knowing anything about what it
  observed.

## Activity

<!-- longclaw:event
id: evt_f21883d5
kind: create
occurred_at: 2026-09-22T08:02:12.998Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8368c7c9
kind: update
occurred_at: 2026-09-22T08:02:49.028Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: priority
    from: none
    to: p2
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
