---
format: longclaw.ticket/v1
id: 46331735-5887-4134-ad49-da41a81d23e5
key: LC-277t
title: Resolve open Dependabot alerts (2026-10-17)
status: in_progress
priority: none
labels:
  - platform
created_at: 2026-10-16T22:20:35.784Z
updated_at: 2026-10-17T17:39:19.343Z
---

Snapshot of the open Dependabot alerts on sachinjain024/longclaw, taken 2026-10-17: 27 alerts. Logged only — nothing is fixed by this ticket. Each checklist item is one alert, `#<n>` being its number under Security → Dependabot, grouped high → medium → low.

Tick an item once the alert is closed on GitHub (fixed or dismissed with a reason).

## Checklist

- [x] #29 [high] undici (apps/desktop) — undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool (>= 7.24.1, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_574ba956 -->
- [x] #41 [high] devalue (apps/website) — devalue: Repeated primitive strings cause quadratic expansion in uneval (<= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_b36bc1bb -->
- [x] #40 [high] devalue (apps/website) — devalue: `stringify`/`uneval` serialize shared memory (>= 5.1.0, <= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_dbbc7ef0 -->
- [x] #39 [high] devalue (apps/website) — devalue: stringifyAsync can cause an unhandled rejection despite a caught returned promise (>= 5.8.0, <= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_f98acec6 -->
- [x] #16 [high] fast-uri (apps/website) — fast-uri vulnerable to host confusion via an unclosed bracket in the URI authority (= 3.1.6; fix 3.1.7) <!-- longclaw:item=ck_48a0e758 -->
- [ ] #45 [high] http-cache-semantics (apps/website) — http-cache-semantics max-stale handling can disclose cross-user cached responses (<= 4.2.0; no patched version) <!-- longclaw:item=ck_a328f3a0 -->
- [x] #25 [high] undici (apps/website) — undici vulnerable to Denial of Service via unrequested WebSocket subprotocol (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_b01e2d62 -->
- [x] #22 [high] undici (apps/website) — undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_17c42019 -->
- [x] #19 [high] undici (apps/website) — undici vulnerable to cross-origin cache poisoning via missing origin isolation in interceptors (>= 8.10.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_875a6ce1 -->
- [ ] #36 [medium] undici (apps/desktop) — undici vulnerable to cross-user cookie disclosure via Set-Cookie caching in shared caches (>= 7.0.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_9a556d7a -->
- [ ] #31 [medium] undici (apps/desktop) — undici vulnerable to Denial of Service via orphaned RetryHandler response body (>= 7.11.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_d7022063 -->
- [ ] #2 [medium] glib (apps/desktop/src-tauri) — Unsoundness in `Iterator` and `DoubleEndedIterator` impls for `glib::VariantStrIter` (>= 0.15.0, < 0.20.0; fix 0.20.0) <!-- longclaw:item=ck_009941f3 -->
- [x] #44 [medium] devalue (apps/website) — devalue: Residual sparse-array CPU amplification in uneval (<= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_eb75f10c -->
- [x] #42 [medium] devalue (apps/website) — devalue: Malformed null-prototype object keys bypass __proto__ rejection via property-key coercion (<= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_897d816b -->
- [x] #7 [medium] fflate (apps/website) — fflate unzipSync can enter an infinite loop when parsing malformed ZIP64 archives (>= 0.7.0, < 0.7.5; fix 0.7.5) <!-- longclaw:item=ck_cfabc7d9 -->
- [x] #28 [medium] undici (apps/website) — undici vulnerable to Denial of Service via orphaned RetryHandler response body (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_05716c61 -->
- [x] #26 [medium] undici (apps/website) — undici vulnerable to Denial of Service via unbounded decompression of compressed responses (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_d1473965 -->
- [x] #24 [medium] undici (apps/website) — undici vulnerable to cross-user cookie disclosure via Set-Cookie caching in shared caches (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_3e13e226 -->
- [x] #20 [medium] undici (apps/website) — undici vulnerable to Denial of Service via WebSocketStream unclean close (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_6c41e7d3 -->
- [x] #17 [medium] undici (apps/website) — undici vulnerable to Denial of Service via unhandled error in WebSocket permessage-deflate decompression (>= 8.1.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_ab1f6c9e -->
- [ ] #37 [low] undici (apps/desktop) — undici vulnerable to caching and replay of unsafe HTTP method responses (>= 7.0.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_550d4807 -->
- [ ] #34 [low] undici (apps/desktop) — undici vulnerable to downstream response splitting via retry interceptor (>= 7.0.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_c4e245df -->
- [ ] #32 [low] undici (apps/desktop) — undici vulnerable to response truncation via oversized chunked responses in the dump interceptor (>= 7.1.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_f6d3b990 -->
- [x] #43 [low] devalue (apps/website) — devalue: Sparse arrays emitted by uneval cause eager allocation when evaluated (>= 1.0.0, <= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_1ea8deb5 -->
- [x] #27 [low] undici (apps/website) — undici vulnerable to response truncation via oversized chunked responses in the dump interceptor (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_d17e0e48 -->
- [x] #23 [low] undici (apps/website) — undici vulnerable to downstream response splitting via retry interceptor (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_f2e2c18f -->
- [x] #21 [low] undici (apps/website) — undici vulnerable to caching and replay of unsafe HTTP method responses (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_4f5ae594 -->
- [x] #56 [high] sharp (apps/website) — sharp: Vulnerability in librsvg dependency CVE-2026-96889 (< 0.35.5; fix 0.35.5) <!-- longclaw:item=ck_8a62152c -->
- [x] #54 [high] source-map-js (apps/website) — source-map-js allows event-loop denial of service through indexed source-map section offsets (>= 1.0.0, < 1.2.2; fix 1.2.2) <!-- longclaw:item=ck_fa3fd40e -->
- [x] #51 [high] source-map-js (apps/desktop) — source-map-js allows event-loop denial of service through indexed source-map section offsets (>= 1.0.0, < 1.2.2; fix 1.2.2) <!-- longclaw:item=ck_10eea202 -->
- [ ] #55 [medium] smol-toml (apps/website) — smol-toml: Quadratic-time parse() from parseKey rescanning to end of document on each key line (<= 1.8.0; fix 1.9.0) <!-- longclaw:item=ck_62c6b161 -->
- [ ] #50 [medium] brace-expansion (apps/desktop) — brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service (< 1.1.21; fix 1.1.21) <!-- longclaw:item=ck_f09519cc -->
- [ ] #49 [medium] brace-expansion (apps/desktop) — brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service (>= 4.0.0, < 5.0.12; fix 5.0.12) <!-- longclaw:item=ck_899d6884 -->

## Activity

<!-- longclaw:event
id: evt_b8fc1c72
kind: create
occurred_at: 2026-10-16T22:20:35.784Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b4c7f534
kind: update
occurred_at: 2026-10-16T22:36:27.041Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_574ba956.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4aae8eba
kind: update
occurred_at: 2026-10-16T22:51:04.930Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_48a0e758.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a7723bae
kind: update
occurred_at: 2026-10-16T22:55:21.978Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b01e2d62.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e989de14
kind: update
occurred_at: 2026-10-16T22:55:22.038Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_17c42019.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0ddd56ae
kind: update
occurred_at: 2026-10-16T22:55:22.230Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_875a6ce1.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cbe5022e
kind: update
occurred_at: 2026-10-16T22:55:22.267Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_05716c61.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_93d84f3e
kind: update
occurred_at: 2026-10-16T22:55:22.301Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d1473965.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9d3358ab
kind: update
occurred_at: 2026-10-16T22:55:22.336Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3e13e226.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ff356492
kind: update
occurred_at: 2026-10-16T22:55:22.372Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6c41e7d3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_800ffb4d
kind: update
occurred_at: 2026-10-16T22:55:22.408Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ab1f6c9e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5527f503
kind: update
occurred_at: 2026-10-16T22:55:22.445Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d17e0e48.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_da587f05
kind: update
occurred_at: 2026-10-16T22:55:22.479Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f2e2c18f.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_275be40c
kind: update
occurred_at: 2026-10-16T22:55:22.514Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_4f5ae594.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5323018f
kind: update
occurred_at: 2026-10-16T22:59:25.763Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8a62152c.added
    to: "#56 [high] sharp (apps/website) — sharp: Vulnerability in librsvg dependency CVE-2026-96889 (< 0.35.5; fix 0.35.5)"
  - field: checklist.ck_fa3fd40e.added
    to: "#54 [high] source-map-js (apps/website) — source-map-js allows event-loop denial of service through indexed source-map section offsets (>= 1.0.0, < 1.2.2; fix 1.2.2)"
  - field: checklist.ck_10eea202.added
    to: "#51 [high] source-map-js (apps/desktop) — source-map-js allows event-loop denial of service through indexed source-map section offsets (>= 1.0.0, < 1.2.2; fix 1.2.2)"
  - field: checklist.ck_62c6b161.added
    to: "#55 [medium] smol-toml (apps/website) — smol-toml: Quadratic-time parse() from parseKey rescanning to end of document on each key line (<= 1.8.0; fix 1.9.0)"
  - field: checklist.ck_f09519cc.added
    to: "#50 [medium] brace-expansion (apps/desktop) — brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service (< 1.1.21; fix 1.1.21)"
  - field: checklist.ck_899d6884.added
    to: "#49 [medium] brace-expansion (apps/desktop) — brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service (>= 4.0.0, < 5.0.12; fix 5.0.12)"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_96534bae
kind: update
occurred_at: 2026-10-16T23:00:25.806Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_dbbc7ef0.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_df6262b7
kind: update
occurred_at: 2026-10-16T23:00:25.966Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b36bc1bb.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_16ebb004
kind: update
occurred_at: 2026-10-16T23:00:26.008Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f98acec6.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_05a3248c
kind: update
occurred_at: 2026-10-16T23:00:26.044Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_eb75f10c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4bca5ea4
kind: update
occurred_at: 2026-10-16T23:00:26.080Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_897d816b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e93217a9
kind: update
occurred_at: 2026-10-16T23:00:26.118Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1ea8deb5.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2b5e11f3
kind: update
occurred_at: 2026-10-17T10:21:34.415Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_10eea202.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1b9fbd6e
kind: update
occurred_at: 2026-10-17T16:53:24.584Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fa3fd40e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_574f84aa
kind: update
occurred_at: 2026-10-17T16:56:33.602Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8a62152c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ccf8d6d3
kind: update
occurred_at: 2026-10-17T17:38:20.233Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_cfabc7d9.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_eb8aa33e
kind: update
occurred_at: 2026-10-17T17:39:19.343Z
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
