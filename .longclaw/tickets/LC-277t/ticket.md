---
format: longclaw.ticket/v1
id: 46331735-5887-4134-ad49-da41a81d23e5
key: LC-277t
title: Resolve open Dependabot alerts (2026-10-17)
status: todo
priority: none
labels:
  - platform
created_at: 2026-10-16T22:20:35.784Z
updated_at: 2026-10-16T22:36:27.041Z
---

Snapshot of the open Dependabot alerts on sachinjain024/longclaw, taken 2026-10-17: 27 alerts. Logged only — nothing is fixed by this ticket. Each checklist item is one alert, `#<n>` being its number under Security → Dependabot, grouped high → medium → low.

Tick an item once the alert is closed on GitHub (fixed or dismissed with a reason).

## Checklist

- [x] #29 [high] undici (apps/desktop) — undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool (>= 7.24.1, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_574ba956 -->
- [ ] #41 [high] devalue (apps/website) — devalue: Repeated primitive strings cause quadratic expansion in uneval (<= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_b36bc1bb -->
- [ ] #40 [high] devalue (apps/website) — devalue: `stringify`/`uneval` serialize shared memory (>= 5.1.0, <= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_dbbc7ef0 -->
- [ ] #39 [high] devalue (apps/website) — devalue: stringifyAsync can cause an unhandled rejection despite a caught returned promise (>= 5.8.0, <= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_f98acec6 -->
- [ ] #16 [high] fast-uri (apps/website) — fast-uri vulnerable to host confusion via an unclosed bracket in the URI authority (= 3.1.6; fix 3.1.7) <!-- longclaw:item=ck_48a0e758 -->
- [ ] #45 [high] http-cache-semantics (apps/website) — http-cache-semantics max-stale handling can disclose cross-user cached responses (<= 4.2.0; no patched version) <!-- longclaw:item=ck_a328f3a0 -->
- [ ] #25 [high] undici (apps/website) — undici vulnerable to Denial of Service via unrequested WebSocket subprotocol (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_b01e2d62 -->
- [ ] #22 [high] undici (apps/website) — undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_17c42019 -->
- [ ] #19 [high] undici (apps/website) — undici vulnerable to cross-origin cache poisoning via missing origin isolation in interceptors (>= 8.10.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_875a6ce1 -->
- [ ] #36 [medium] undici (apps/desktop) — undici vulnerable to cross-user cookie disclosure via Set-Cookie caching in shared caches (>= 7.0.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_9a556d7a -->
- [ ] #31 [medium] undici (apps/desktop) — undici vulnerable to Denial of Service via orphaned RetryHandler response body (>= 7.11.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_d7022063 -->
- [ ] #2 [medium] glib (apps/desktop/src-tauri) — Unsoundness in `Iterator` and `DoubleEndedIterator` impls for `glib::VariantStrIter` (>= 0.15.0, < 0.20.0; fix 0.20.0) <!-- longclaw:item=ck_009941f3 -->
- [ ] #44 [medium] devalue (apps/website) — devalue: Residual sparse-array CPU amplification in uneval (<= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_eb75f10c -->
- [ ] #42 [medium] devalue (apps/website) — devalue: Malformed null-prototype object keys bypass __proto__ rejection via property-key coercion (<= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_897d816b -->
- [ ] #7 [medium] fflate (apps/website) — fflate unzipSync can enter an infinite loop when parsing malformed ZIP64 archives (>= 0.7.0, < 0.7.5; fix 0.7.5) <!-- longclaw:item=ck_cfabc7d9 -->
- [ ] #28 [medium] undici (apps/website) — undici vulnerable to Denial of Service via orphaned RetryHandler response body (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_05716c61 -->
- [ ] #26 [medium] undici (apps/website) — undici vulnerable to Denial of Service via unbounded decompression of compressed responses (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_d1473965 -->
- [ ] #24 [medium] undici (apps/website) — undici vulnerable to cross-user cookie disclosure via Set-Cookie caching in shared caches (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_3e13e226 -->
- [ ] #20 [medium] undici (apps/website) — undici vulnerable to Denial of Service via WebSocketStream unclean close (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_6c41e7d3 -->
- [ ] #17 [medium] undici (apps/website) — undici vulnerable to Denial of Service via unhandled error in WebSocket permessage-deflate decompression (>= 8.1.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_ab1f6c9e -->
- [ ] #37 [low] undici (apps/desktop) — undici vulnerable to caching and replay of unsafe HTTP method responses (>= 7.0.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_550d4807 -->
- [ ] #34 [low] undici (apps/desktop) — undici vulnerable to downstream response splitting via retry interceptor (>= 7.0.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_c4e245df -->
- [ ] #32 [low] undici (apps/desktop) — undici vulnerable to response truncation via oversized chunked responses in the dump interceptor (>= 7.1.0, < 7.29.1; fix 7.29.1) <!-- longclaw:item=ck_f6d3b990 -->
- [ ] #43 [low] devalue (apps/website) — devalue: Sparse arrays emitted by uneval cause eager allocation when evaluated (>= 1.0.0, <= 5.9.2; fix 5.9.3) <!-- longclaw:item=ck_1ea8deb5 -->
- [ ] #27 [low] undici (apps/website) — undici vulnerable to response truncation via oversized chunked responses in the dump interceptor (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_d17e0e48 -->
- [ ] #23 [low] undici (apps/website) — undici vulnerable to downstream response splitting via retry interceptor (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_f2e2c18f -->
- [ ] #21 [low] undici (apps/website) — undici vulnerable to caching and replay of unsafe HTTP method responses (>= 8.0.0, < 8.10.2; fix 8.10.2) <!-- longclaw:item=ck_4f5ae594 -->

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
