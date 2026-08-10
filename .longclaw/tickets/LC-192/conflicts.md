# LC-192 — Design system conflicts: Claude Design v3 ↔ GitHub repo

## What the two sides actually are

|                | Claude Design                                                                                      | GitHub repo                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Artifact       | Project **“LC Fable v3 Design System”** (`809bce20-a672-4824-a618-dd6c07d85f62`, type `PROJECT`)   | `apps/desktop/src/tokens/` (ships) + `docs/design/foundations/` (documents)             |
| Structure      | Binds design system `d34ededb…` (the **v1** system) under `_ds/`, then overlays **`theme-v3.css`** | `design-tokens.json` → `build.mjs` → `design-tokens.css`, guarded by `tokens:check`     |
| Spec page      | `LongClaw DS v3.dc.html` — 7 sections, ends “stop point: review before screens”                    | `decisions.md` D1–D16, `components.md`, `accessibility.md`                              |
| Companion docs | `uploads/design-brief-v3.html` (draft v0.5), `uploads/vision-scope-v3.html`                        | `docs/design_brief.md` (**canonical**, later iteration), `archive/v3/` (same two files) |

**The v3 project is a design-time proposal that stopped before screens. The repo is that proposal carried through implementation, an accessibility pass, and eleven months of founder revisions.** Most conflicts below are the repo moving on without the Claude Design side being updated. A few are the repo silently ignoring a v3 decision.

The v3 page's own §07 “flagged for review — proposed, not settled” lists six open questions. **Three of them the repo has already answered — differently.** Those are C1, C2 and C4 below and they are the ones that actually need your call.

---

## A. Architecture & token contract

| #   | Item                       | Claude Design v3                                                                 | Repo                                                                                                  | Note                                                                                                                     |
| --- | -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Theme attribute**        | `data-lc-theme="indigo…"` = preset<br>`data-theme="light\|dark"` = appearance    | `data-theme="indigo…"` = preset<br>`data-appearance="light\|dark"` = appearance                       | **Direct collision** — `data-theme` means opposite things on the two sides. Any copy-paste between them silently breaks. |
| A2  | **Token namespace**        | `--accent-human`, `--accent-agent`, plus v1 aliases `--human`, `--bg`, `--ink`   | `--lc-*` throughout; `token-guard.mjs` fails the build on a `--lc-` declaration outside `src/tokens/` | Repo namespace is enforced by CI; v3 is not.                                                                             |
| A3  | **Source of truth format** | Hand-written CSS (`theme-v3.css`)                                                | JSON → generated CSS; `tokens:check` fails if the CSS drifts from the JSON                            | v3 has no generator, so its 5 presets × 2 appearances are 10 hand-maintained blocks.                                     |
| A4  | **Text-variant tokens**    | None. §07-05 _proposes_ `--accent-agent-text: #0B7D59` if strict 4.5:1 is wanted | Ships `human-text` **and** `agent-text` per preset per appearance                                     | Repo answered the proposal — but at a different hex (see C4).                                                            |
| A5  | **Derived-variant set**    | soft, hover, active, focus-ring, agent-ring, agent-border                        | Adds `wash`, `rail`, `avatar-ring`, `acknowledged-ring`, `acknowledged-border`                        | Repo-only additions; no v3 equivalent to reconcile against.                                                              |

## B. Presets

| #   | Item                | Claude Design v3                                    | Repo                                                      | Note                                                                                                                                                                              |
| --- | ------------------- | --------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Preset set**      | 5: indigo · clay · plum · **cobalt** · **graphite** | 4: indigo · clay · **slate** · plum                       | `slate #3D6BC4` is neither cobalt `#2168CE` nor graphite `#525A6E`. v3 §07-04 says “drop to 4 if cobalt feels redundant” — the repo dropped _both_ and added a third hue instead. |
| B2  | **Preset metadata** | none                                                | `default: true` on indigo; `proposed: true` on slate/plum | Repo tracks approval state in the tokens; v3 tracks it in §07 prose.                                                                                                              |

## C. Accent hues — the substantive ones

| #      | Item                       | Claude Design v3                 | Repo                                   | Note                                                                                                                                                                                               |
| ------ | -------------------------- | -------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | **Indigo human**           | `#4B4EE7` light / `#8B8DF4` dark | `#6B5CF6` light / `#887DF2` dark       | 🔴 v3 §07-03 says explicitly: _“the v1 specimen’s tweaked #6B5CF6 is **retired**”_ — **the repo ships the retired value.** Either the repo never got the memo or the memo was reversed off-record. |
| **C2** | **Agent green**            | `#12946A` light / `#66D4A1` dark | `#279E52` light / `#6CD592` dark       | 🔴 Different green entirely. v1’s `lcPulse` keyframe hardcodes `rgba(18,148,106,.38)` = `#12946A`, confirming v3’s value is the intended one.                                                      |
| C3     | **Clay human**             | `#A9482C` / `#E29277`            | `#9C4126` / `#C57A55`                  | Both differ; dark is a large gap.                                                                                                                                                                  |
| **C4** | **Agent text variant**     | proposed `#0B7D59`               | ships `#1B7A3D` light / `#7FDCA0` dark | 🔴 Repo implemented v3’s proposal at a different hue — and derived from the _wrong base green_ (C2).                                                                                               |
| C5     | **Plum human**             | `#A33E9C` / `#DE8FD6`            | `#A23F9C` / `#D48BD0`                  | Near-identical light, drifted dark.                                                                                                                                                                |
| C6     | **`on-accent-agent` dark** | `#101116`                        | `#0F1015`                              | 1-value drift; repo uses `#101116` for `on-human` dark, so this is likely a repo typo.                                                                                                             |

## D. Derivation math

| #   | Item                                 | Claude Design v3                                               | Repo                                                       | Note                                                                   |
| --- | ------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1  | **hover / active**                   | 86% / 76%, mixed toward `#14161F` (light) and `#FFFFFF` (dark) | 90% / 82%, mixed toward `--lc-ink` in **both** appearances | Both the percentages and the mix target differ. Repo hover is subtler. |
| D2  | **soft (human)**                     | 9% light / 15% dark                                            | 10% / 15%                                                  | Repo uses one `soft` for both actors; v3 differentiates.               |
| D3  | **soft (agent)**                     | 10% light / 16% dark                                           | 10% / 15%                                                  |                                                                        |
| D4  | focus-ring, agent-ring, agent-border | 14/18 · 10/13 · 38/42                                          | 14/18 · 10/13 · 38/42                                      | ✅ **match**                                                           |
| D5  | `--status-done` → human accent       | yes                                                            | yes (D5)                                                   | ✅ **match** — and v3 §07-02 asks you to confirm it. Repo already did. |

## E. Neutrals, status, priority, feedback

All repo values are AA adjustments recorded in `decisions.md` D10 and verified by `scripts/a11y-check.mjs` (204 checks). v3 carries the unadjusted v1 values.

| #   | Token                                              | v3 / v1                                 | Repo                                      |                                                        |
| --- | -------------------------------------------------- | --------------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| E1  | `ink-3`                                            | `#878CA0`                               | `#666B80`                                 | AA                                                     |
| E2  | `ink-4` / `ink-disabled`                           | `#B7BBC9`                               | `#A9ADC0`                                 |                                                        |
| E3  | `warn`                                             | `#B45309`                               | `#9A5008`                                 | AA                                                     |
| E4  | `danger`                                           | `#D64545`                               | `#C43A3A`                                 | AA                                                     |
| E5  | `status-backlog`                                   | `#A9ADC0`                               | `#82879B`                                 |                                                        |
| E6  | `status-todo`                                      | `#878CA0`                               | `#82879B`                                 | repo collapses backlog/todo/canceled to one grey       |
| E7  | `status-progress`                                  | `#DE9B0D`                               | `#B47D0A`                                 | AA                                                     |
| E8  | `status-review`                                    | `#E5732A`                               | `#C25C1B`                                 | AA                                                     |
| E9  | `status-canceled`                                  | `#C7CAD6`                               | `#82879B`                                 |                                                        |
| E10 | `priority-urgent`                                  | `#E0762F`                               | `#C2591D` light, `#E0762F` dark           | AA in light only                                       |
| E11 | `priority-off` / `chip-border`                     | `#DCDFE9`                               | `#B9BDCC`                                 | token renamed with D4                                  |
| E12 | `priority-none`                                    | `#A9ADC0`                               | `#8A8FA3`                                 |                                                        |
| E13 | **Label ramp**                                     | 3 named: `--label-infra/watcher/design` | 8-hue ramp, **green band excluded** (D12) | Repo’s 3 overlapping hues match exactly; repo added 5. |
| E14 | **Human avatar hues**                              | `--avatar-1/2/3` bg+fg trio             | **absent**                                | Repo derives only accent rings. Gap.                   |
| E15 | `check-border` `#C9CCDA`                           | present                                 | **absent**                                |                                                        |
| E16 | `warn-ink`, `warn-border-strong`, `danger-surface` | absent                                  | present                                   | repo-only                                              |

## F. Typography

| #   | Item                                                      | Claude Design v3                                              | Repo                            |                                                                                             |
| --- | --------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| F1  | **Title face**                                            | `title 17 · **display** 600` (Familjen Grotesk) — v3 page §03 | `title 17 · **ui** 600` (Geist) | 🟠 Ticket titles render in a different typeface on the two sides.                           |
| F2  | `hero 46 · display 700 · -0.025em`                        | present                                                       | **absent**                      |                                                                                             |
| F3  | `h2 27 · display 600 · -0.015em`                          | present                                                       | **absent**                      |                                                                                             |
| F4  | `display` tracking                                        | `-0.02em`                                                     | `-0.015em`                      |                                                                                             |
| F5  | `label` tracking                                          | `+0.09em`                                                     | `+0.06em`                       |                                                                                             |
| F6  | `micro`                                                   | `10.5px **mono**`                                             | `11.5px **ui** 500`             | 🟠 Same token name, different size _and_ different family. Repo has no 10.5px token at all. |
| F7  | `heading 14.5 ui 600`, `kbd 10 mono`                      | absent                                                        | present                         | repo-only                                                                                   |
| F8  | Three families: Familjen Grotesk / Geist / JetBrains Mono | ✅                                                            | ✅                              | **match** (D6)                                                                              |
| F9  | body 13.5 · ui 13 · small 12.5 · code 12 · label 11       | ✅                                                            | ✅                              | **match**                                                                                   |

## G. Space, radius, motion, elevation

| #   | Item                                                                   | Claude Design v3                     | Repo                                      |                                                                                     |
| --- | ---------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| G1  | Space scale 4·8·12·16·20·24·32·40                                      | ✅                                   | ✅                                        | **match**                                                                           |
| G2  | rows 36 · controls 30 · gutters 16/24                                  | ✅                                   | ✅                                        | **match**                                                                           |
| G3  | Radius controls 5 · cards 8 · panels 10 · modals 14                    | ✅                                   | ✅                                        | **match**                                                                           |
| G4  | Card padding                                                           | `12` single                          | `x 12 / y 10`                             | repo split                                                                          |
| G5  | Chip radius                                                            | `11px` (capsule)                     | `full: 999`                               | same intent, different expression                                                   |
| G6  | `tile: 4` radius                                                       | absent                               | present                                   | repo-only                                                                           |
| G7  | Motion 80 / 120 / 150 · ease `cubic-bezier(0.2,0,0,1)`                 | ✅                                   | ✅                                        | **match**                                                                           |
| G8  | **Agent pulse**                                                        | `lcPulse 1.8s ease-out **infinite**` | `900ms × **2 iterations**`                | 🟠 v3 calls it “the one animated exception”; the repo made it finite and halved it. |
| G9  | `spinner 900ms`                                                        | absent                               | present                                   | repo-only (delayed write indicator)                                                 |
| G10 | `--shadow-raised 0 1px 3px .10`, `--shadow-icon 0 4px 14px`            | present                              | **absent**                                |                                                                                     |
| G11 | `modal 0 16px 48px` elevation                                          | absent                               | present                                   | repo-only                                                                           |
| G12 | card `0 1px 2px .04`, toast/overlay `0 6px 18px .22`, dark card `none` | ✅                                   | ✅                                        | **match**                                                                           |
| G13 | **z-index scale** (6 layers)                                           | absent                               | present, enforced by `stacking-guard.mjs` | repo-only                                                                           |
| G14 | `board-card 108 / acknowledged 136`, `board-stack`                     | absent                               | present                                   | repo-only                                                                           |

## H. Component & product decisions (foundations prose)

| #      | Item                                  | Claude Design v3                                              | Repo                                                                                           |                                                                                  |
| ------ | ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **H1** | **Status glyphs**                     | Six drawn glyphs — ring / half-pie / ¾-pie / check / X (§05)  | **Retired.** Status = colour dot + text label, one geometry (D3, founder direction 2026-07-28) | 🔴 v3 page still renders the retired glyph set.                                  |
| **H2** | **Priority set**                      | Urgent · **High · Medium · Low** · None, Linear-style bars    | Urgent · **P1 · P2 · P3 · P4** · None, bordered mono chips (D4, founder direction 2026-07-28)  | 🔴 Different level count _and_ different glyph language.                         |
| **H3** | **Assignee**                          | Exists; “agents never sit in the assignee slot” (§05)         | **Concept removed entirely** — ADR 0001, no assignee in local mode                             | 🔴 v3’s avatar row and the `A` shortcut both assume a slot the app doesn’t have. |
| H4     | Terminal region                       | Brief: reserve collapsible bottom region, design geometry now | Cut from v0 — no handle, no reserved geometry (LC-74)                                          | Repo brief already records this; v3’s uploaded brief doesn’t.                    |
| H5     | Waitlist / sign-up                    | Brief: quiet persistent side-panel button → modal             | Cut (LC-75)                                                                                    | same                                                                             |
| H6     | Agent avatar = terminal tile with `❯` | ✅                                                            | ✅ (D7)                                                                                        | **match**                                                                        |
| H7     | Agent accent constant across presets  | ✅ (§07-01, proposed)                                         | ✅ (D2, accepted)                                                                              | **match**                                                                        |

## I. Drift inside the repo itself

| #   | Item                 | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | **Two token copies** | `docs/design/foundations/tokens/design-tokens.json` is labelled “**Token source of truth**” in its README, but `apps/desktop/src/tokens/design-tokens.json` is what ships and what `tokens:check` guards. The docs copy is **19 tokens behind** (`size.board-card*`, `size.board-stack`, all six `z.*`, `motion.spinner`, `color.neutral.raised-hover`, the `alias.code-*` group) plus 3 stale `role`/`note` strings. **No conflicting values** — purely stale. Last touched by `fdc3d6a` (LC-183); the app copy has moved twice since. |
| I2  | **Brief lineage**    | The v3 project uploads `design-brief-v3.html` (status: _draft v0.5_). The repo’s `docs/design_brief.md` is marked **canonical** and is a later iteration — it records the LC-74/LC-75 cuts and the “Iteration 1 / Appendix A” framing. Claude Design is reading a superseded brief.                                                                                                                                                                                                                                                     |

## J. Out of scope but worth a decision

| #   | Item                                   | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J1  | **Two stale published design systems** | `d34ededb…` “LongClaw Design System” = the v1 system the v3 project binds. Still carries `#6B5CF6` (retired by v3) and `#279E52`. Editing v3’s hues means editing `theme-v3.css`, not this — but the v1 bundle’s own `colors.css` and `lcPulse` keyframe now disagree with each other.                                                                                                                                                   |
| J2  | **The retired v2 project**             | `8d082e76…` “LongClaw Design System” is the **Clay / warm-paper originality program** (Schibsted Grotesk, IBM Plex Mono, clay `#A3481F` + teal `#0E7386`, bracket status tokens, no shadows). The v3 brief retires it explicitly: _“the v2 originality program is retired”_, surviving only as the Clay **preset**. It is 20 components and 18 guideline cards of a direction nothing should follow. Decide: archive, rename, or delete. |

---

## Recommended resolution

**Repo wins** — E1–E12 (AA-verified, 204 checks), H1–H3 (post-v3 founder direction), A2–A3, D5, G13–G14, I1, I2.

**Claude Design v3 wins** — C1, C2, C4 (v3 explicitly retires `#6B5CF6`; the repo shipping it looks like drift, not a decision), F2–F5.

**Needs your call** — A1 (attribute names: one side has to move), B1 (slate vs cobalt+graphite), C3/C5, D1–D3, F1, F6, G8, E14.

---

# Resolution log (2026-08-10)

## Settled

| #   | Decision                                               | Landed                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Indigo human → **`#5B4DEF`** / `#887DF2`               | Neither side's value. v3 retires `#6B5CF6`; but v3's `#4B4EE7` sits 5° from Linear's `#5E6AD2` and "not Linear" is the brand goal. `#5B4DEF` keeps v3's weight at 245° — 11° off Linear — and measures **5.60:1** on white vs `#6B5CF6`'s 4.68:1. |
| C2  | Agent → **`#12946A`** / `#66D4A1`                      | v3's green. v1's own `lcPulse` keyframe already hardcoded `rgba(18,148,106)`, so the specimen contradicted itself.                                                                                                                                |
| C3  | Clay → **`#A9482C`** / **`#DD8A6C`**                   | v3's light; dark adjusted from v3's `#E29277` — see below.                                                                                                                                                                                        |
| C4  | Agent text → **`#0B7D59`** / `#66D4A1`                 | v3 §07-05's proposal, measured at 5.13:1 on white and 4.54:1 on the agent soft chip.                                                                                                                                                              |
| A1  | `data-lc-theme` = preset · `data-theme` = appearance   | v3's contract. 124 references across 20 files.                                                                                                                                                                                                    |
| B1  | 5 presets: indigo · clay · slate · plum · **graphite** | Graphite from v3. Cobalt dropped — v3 §07-04 sanctions it as redundant with indigo. Slate kept.                                                                                                                                                   |
| I1  | One token file                                         | Fork deleted; prototype, both proof pages and `a11y-check.mjs` read `apps/desktop/src/tokens/`. `token-source-guard.mjs` enforces it.                                                                                                             |
| J2  | v2 warm-paper project removed                          | No longer in the writable project list.                                                                                                                                                                                                           |

## Two values are the repo's, not v3's

v3 §07-06 asserts the clay/agent-green pair survives deuteranopia on its lightness gap. **It doesn't.** Against the new green, v3's clay dark `#E29277` scores ΔE 18.03 / ΔL 5.53 — under the ΔE ≥ 20 (or ΔE ≥ 12 with ΔL ≥ 10) bar. And the new green is teal-shifted enough to collide with Slate under **tritanopia** (ΔE 17.91).

Nine candidate greens were swept. None fixed both; the old `#279E52`/`#6CD592` made clay _worse_ (ΔE 10.77). The drivers were the two human accents, not the green:

- clay dark `#E29277` → **`#DD8A6C`**
- slate light `#3D6BC4` → **`#3A62BE`**

All 226 checks pass at the landed values. **v3 has no checker — that is the argument for the repo holding the ledger.**

## `_ds/` is a vendored snapshot — confirmed by experiment

Pushed `tokens/themes.css` + an updated `styles.css` to the design system, then re-read the copy inside `LC Fable v3 Design System`:

|                              | after the push           |
| ---------------------------- | ------------------------ |
| `d34ededb…/styles.css`       | has the new `@import` ✅ |
| `809bce20…/_ds/…/styles.css` | unchanged ❌             |
| `809bce20…/_ds/…/tokens/`    | no `themes.css` ❌       |

**Updating the design system does not refresh the v3 doc page.** `_ds/` is a frozen copy taken when the page was bound. The page must be re-synced in the Claude Design UI to pick up changes.

Consequence for the workflow: the design system (`d34ededb…`) is the sync endpoint and is fully read/write. The v3 doc page is a _rendering_ of a snapshot — treat it as a document, not as the system.

## The sync practice

```
explore in Claude Design  →  npm run design:check   (fails on drift)
                          →  land it in design-tokens.json
                          →  npm run check          (AA + guards gate it)
                          →  push tokens/themes.css to d34ededb…
```

One JSON, two emitters: `build.mjs` → `--lc-*` for the app; `emit-design-system.mjs` → `--accent-*` + v1 aliases for Claude Design. Neither generated file is hand-edited, and `design:check` is wired into `tokens:check`, so a hand edit on either side fails the build.

## Still open — filed as follow-ups

Split rather than left on this ticket, because the four differ in surface and in
who can decide them.

| Ticket     | Covers                                                                                                                                                                                                                                                       |               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| **LC-195** | **E1–E16 · F1–F9 · G8 · G10/G11** — the AA-adjusted neutrals/status/priority hues, the 8-hue label ramp vs v3's 3, the human-avatar trio, `check-border`; typography (`title` face, `micro`, `hero`/`h2`, tracking); the agent pulse; the two shadow tokens. | p1 · design   |
| **LC-196** | **H1–H3** — the design system still _renders_ the retired StatusIcon pies, the High/Medium/Low priority bars and the assignee slot, and uploads the superseded v0.5 brief. Claude Design work, not repo work.                                                | p2 · design   |
| **LC-197** | The `components.md` contract guard — nothing connects the spec to either implementation, which is exactly how H1–H3 stayed invisible for three months.                                                                                                       | p2 · design   |
| **LC-198** | The prototype's reference surface — ~7,000 lines reimplementing a product that also exists in `apps/desktop/src`. D16 is the receipt for that drift.                                                                                                         | p3 · frontend |

**E is the one that matters soonest.** The design system renders its own components against unadjusted neutrals and status hues, so anything designed there looks subtly unlike the app it is a design for — which undermines designing there first.

**F cannot be delegated.** Familjen Grotesk vs Geist for ticket titles is a design call, not contrast math.
