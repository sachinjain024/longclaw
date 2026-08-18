# Design-system decision log — Phase 0, Step 1

Every **[proposed]** item from `docs/design_brief.md` (final iteration) and
every divergence flagged in the approved visual reference
(`fable-design-system-v1.mhtml` § 07), resolved. Statuses: **accepted** /
**rejected** / **adjusted**. All decisions below are staged for founder
sign-off at the M0 gate; none silently diverge from the brief.

## D1 — Theme preset set: 5 presets · accepted (count), proposed (new hues)

Indigo (default) · Clay · **Slate** · **Plum** · **Graphite**. Revised by
LC-192 (D17): Graphite comes across from the Claude Design v3 preset set, and
the founder asked for room to add more later.

| Preset           | Human accent (light / dark) | Agent accent (light / dark) | Status                                     |
| ---------------- | --------------------------- | --------------------------- | ------------------------------------------ |
| Indigo · default | `#5B4DEF` / `#887DF2`       | `#12946A` / `#66D4A1`       | revised — see D17                          |
| Clay             | `#A9482C` / `#DD8A6C`       | same                        | revised — see D17                          |
| Slate            | `#3A62BE` / `#85A7EC`       | same                        | proposed — steel blue, calm and technical  |
| Plum             | `#A23F9C` / `#D48BD0`       | same                        | proposed — warm violet, clearly not Indigo |
| Graphite         | `#525A6E` / `#A9AFC4`       | same                        | proposed — the quiet near-neutral option   |

**Rejected preset candidates** (recorded so they aren't re-proposed blind):

- **Teal/Emerald** — human accent would sit in the agent's hue band; breaks
  the exclusivity rule at a glance.
- **Amber/Gold** — collides with the In Progress status color.
- **Rose/Red** — collides with danger and the Urgent glyph.
- **Ink/Mono** (a colorless human accent) — elegant, but erases human
  presence from the timeline; the two-actor thesis loses one actor.

## D2 — Agent accent stays one green family across all themes · accepted

`#12946A` light / `#66D4A1` dark in every preset (values revised by D17). Agent activity must read
identically in every project — the differentiating surface never changes
costume. Tested against every human accent under protanopia, deuteranopia and
tritanopia (`accessibility.md`); the Clay pairing required a value adjustment
(D10) rather than a rule exception. The agent green also never collides with
a status color because Done is not green (D5).

## D3 — Status set & glyphs · revised (founder direction, 2026-07-28) · scope-adjusted by ADR 0002

> **ADR 0002 (2026-07-28):** statuses are **fixed in v0** — the
> user-defined-status creation row below is deferred to a later version,
> where statuses live per project outside `longclaw.yaml`. The dot+label
> visual language is unchanged.

**Current:** a status is a **color dot + text label**, one geometry for all —
the old Todo ring is the shape; the default state stays an unfilled grey
ring, every other state is the same dot filled with the status color.
Statuses are **user-definable**: creating one always assigns a color (grey
ring by default; the picker offers the eight label-ramp hues — never green,
per the exclusivity rule). The reference's bespoke half-pie/¾-pie/check/X
glyphs are retired; for status glyphs the reference is now historical.
`--lc-status-done-mark` and `--lc-status-canceled-mark` were retired with
the marks.

Built-in colors are unchanged (Backlog/Todo/Canceled grey, In Progress
amber, In Review orange, Done → human accent per D5), so all AA numbers
carry over. Losing the check/X shape channel is mitigated by the rule that
the dot never appears without its label (or its column header, on the
board); Backlog keeps the dashed ring as a shape cue.

<details><summary>Superseded original (accepted at Step 1)</summary>

Backlog · Todo · In Progress · In Review · Done · Canceled, with our own
glyph drawing (14×14, 1.6px stroke, dashed/open/half-pie/¾-pie/filled+check/
filled+X — geometry in `components.md`, masters in `assets/glyphs.svg`).
Status colors are system tokens, identical across themes. In Progress is
amber, In Review orange — warm working states, distinct from both actor
accents (light values AA-adjusted, D10).

</details>

## D4 — Priority set & glyphs · revised (founder direction, 2026-07-28)

**Current:** Urgent · **P1 · P2 · P3 · P4** · None. Urgent (orange square +
exclamation) and None (dash) keep the reference glyphs unchanged; the middle
levels are numbered chips with a simple 1px border — mono `P1`–`P4` label,
transparent fill, radius 3. Monochrome except Urgent still holds; the number
carries the level, so there is no fill hierarchy to read.

This is a deliberate deviation from the approved visual reference and the
brief's proposed set (both showed Linear-style High/Medium/Low bars,
originally accepted here). The founder directed the change after Step 1
review; for priority, the reference is now historical. Tokens
`--lc-priority-bar-on/off` were retired for `--lc-priority-chip-text/border`;
the chip label is real text and passes the 4.5:1 text gate in both
appearances (`accessibility.md`).

<details><summary>Superseded original (accepted at Step 1)</summary>

Urgent · High · Medium · Low · None. Quiet, monochrome except Urgent;
Linear-family language but our own weights and geometry (3px bars, rx1,
5.5/8.5/11.5 heights). The louder treatment was already rejected in the
brief; nothing here reopens it.

</details>

## D5 — Done takes the human accent, not green · accepted (reference divergence)

Green is reserved exclusively for agent activity. A green Done would read as
"an agent finished this"; completion is a human call. `--lc-status-done`
routes to `--lc-accent-human`, so Done is the one status that follows the
project theme. This is deliberate and tested for contrast in all presets.

## D6 — UI face is Geist, not Inter · accepted (reference divergence)

Same neutrality at 13px, slightly more personality, pairs cleanly with
Familjen Grotesk. Swap-back is one token (`--lc-font-ui`) if the founder
disagrees. Display: Familjen Grotesk 600–700. Mono: JetBrains Mono — the
file-native signature, pushed slightly further than Iteration 1 (IDs, paths,
timestamps, counts, kbd hints, agent names all run mono).

## D7 — Agent avatar: square terminal tile with ❯ prompt · accepted

26px tile, 4px radius, near-black `--lc-tile` in both appearances, mono `❯`
in agent accent, 1.5px agent ring. Of the three wired treatments (squircle ·
sharp tile · dashed circle) the reference's default stands. Reads "process,
not person" at 20px; ~~never appears in the assignee slot~~. The shape channel
is also the CVD fallback (D11).

> **ADR 0001 (2026-07-28):** there is no assignee slot in v0 for the tile to
> stay out of — local mode has no assignee. The rule returns with team
> projects.

## D8 — Shortcut set · accepted

`⌘K` palette · `C` create · `S` status · ~~`A` assign~~ · `P` priority ·
`↑↓`/`J K` and `←→`/`H L` navigation · `Enter` open · `Esc` close · `⌘Z`
undo · `⌘F` filter. Exactly the brief's proposed single-key set plus the
non-negotiable navigation/undo basics; no chords in v0. Full table in
`components.md`.

> **ADR 0001 (2026-07-28):** `A` assign is reserved, not bound, in v0 —
> local mode has no assignee. The binding returns with team projects.

## D9 — Side-panel project theme marker · accepted

A 6px dot in each project's own human accent, left of the project name.
Ships because it doubles as the theme-picker anatomy and is the cheapest
wayfinding cue; it is the only chrome element allowed to show another
project's accent. If it proves noisy in v0 usage it is one token-consumer to
delete — flagged for explicit founder confirmation.

## D10 — Accessibility adjustments to reference values · adjusted

The approved reference is the visual truth, but several of its values missed
WCAG AA when tested (`scripts/a11y-check.mjs`, results in
`accessibility.md`). LC-223 re-derived each production value as the nearest
point toward the DS hue that clears its gate; the look stays calm.

| Token                        | Reference                       | Production          | Why                                           |
| ---------------------------- | ------------------------------- | ------------------- | --------------------------------------------- |
| `ink-3` light                | `#878CA0`                       | `#686D80`           | 4.5:1 as meta text on wash/bg/surface         |
| `ink-3` dark                 | `#676C80`                       | `#7F8599`           | same, on dark surfaces                        |
| `status-backlog/todo` light  | `#A9ADC0`/`#878CA0`             | `#878CA0`           | todo grey passes 3:1; backlog shares it       |
| `status-in-progress` light   | `#DE9B0D`                       | `#C28000`           | amber lifted back to the 3:1 boundary         |
| `status-in-review` light     | `#E5732A`                       | `#DF6E23`           | 3:1 on bg                                     |
| `status-canceled` light/dark | `#C7CAD6`/`#3A3D4D`             | `#878CA0`/`#5F6375` | fill 3:1 + X mark 3:1 on fill                 |
| `priority-urgent` light      | `#E0762F`                       | `#DB7129`           | fill and white mark both 3:1                  |
| `warn` light                 | `#B45309`                       | `#B45309`           | the reference itself clears 4.5:1 (LC-223)    |
| `danger` light               | `#D64545`                       | `#C9393B`           | 4.5:1 as button text                          |
| Clay human light             | `#A9482C` (brief working value) | `#9C4126`           | deuteranopia ΔL 9.6 → 13.3 vs agent green     |
| Clay human dark              | — (unspecified in brief)        | `#C57A55`           | deuteranopia ΔE 20.8 (clears the strict tier) |
| dark toast secondary         | `#5A5F75`                       | `#4C5165`           | 4.5:1 on inverse surface                      |

Dark-appearance status values keep the reference hues (`#E7B23A`,
`#EC8B4C`, `#E0762F`) — they all pass on dark surfaces. Where a color is
both a fill and a text, a separate `-text` variant exists so fills keep the
brand hue while text clears 4.5:1 (e.g. agent green text `#1B7A3D` light).

## D11 — CVD policy · accepted

Human/agent distinction must hold under protanopia, deuteranopia and
tritanopia: ΔE ≥ 20, or ΔE ≥ 12 with ΔL ≥ 10 — the relaxed tier exists
because hue is never the only channel (circle vs tile, sans vs mono, `agent`
badge, rail). All 32 pairs pass; Clay was the only preset that needed a value
change to get there.

## D12 — Label ramp: 8 fixed hues, no green band · accepted

blue · cyan · purple · pink · red · orange · amber · gray, each with
light/dark values. System tokens, never themed, no custom colors. The green
band (hue 120–165) is deliberately absent — the exclusivity rule extends to
labels and to the human-avatar tint recipe, which draws from this same ramp.

## D13 — Owl mark: variant A "talon" · accepted

The original geometric owl from the approved reference: six straight cuts and
four circles — two ear points, a level gaze, a face tapering to a single
talon point (the claw in LongClaw). No body reference, color scheme, or
silhouette from any existing character; the geometry is pure abstraction
(hexagonal shield + circles) and stands on its own. Variants B–D (tufts,
barn, glyph-only) are retired. Two-actor duotone eyes are reserved for
marketing moments, never in-app chrome. Master: `assets/owl-mark.svg`.

## D14 — Command palette v0 command set · accepted

**Current:** create ticket · go to project · change status · ~~assign~~ · set
priority · search tickets · star project · toggle appearance · change project
theme · archive/unarchive ticket · change board ordering · switch board/list
view · new terminal (Phase 2 slot, visible but disabled). "Change project theme"
ships in the palette per the brief's proposal.

> **ADR 0001 (2026-07-28):** "assign" is dropped from the v0 palette —
> no assignee in local mode.

> **P1 accepted (2026-08-01):** ~~The Step 2 bundle additionally stages
> set-priority, view-toggle, archive (ADR 0004) and board-ordering
> (ADR 0003) commands for sign-off~~ — the founder accepted those four on
> 2026-08-01, so they are v0 commands rather than proposals. See
> `../prototype/README.md` § Proposals. The M0 gate itself is still open, so
> this file's opening note about founder sign-off stands.

<details><summary>Superseded original (accepted at Step 1)</summary>

create ticket · go to project · change status · assign · search tickets ·
star project · toggle appearance · change project theme · new terminal
(Phase 2 slot, visible but disabled). "Change project theme" ships in the
palette per the brief's proposal.

</details>

## D15 — Token architecture · accepted (hard requirement, verified)

Two independent axes on the root element: `data-theme` (light/dark) ×
`data-lc-theme` (indigo/clay/slate/plum). A preset supplies **six values per
appearance** (accent, text variant, on-accent × two actors); every
soft/hover/ring/rail/wash variant derives via `color-mix(in oklab, …)` in
generated CSS. Neutrals, status, warn/error, and label colors are
theme-independent system tokens. The board proof (`proof/board.html`)
renders all 5 themes × 2 appearances from one DOM with zero component
overrides — switching is a token swap and nothing else.

## D16 — The header gear's hover fades its glyph colour · accepted (reference divergence)

The prototype's gear (`prototype.css:322-323`) shifts both `background` and
`color` on hover with no transition on either. The app's fades both at
`--lc-motion-fast`, which `components.md:28` asks of a hover in any case.

The divergence is not a divergence in intent. The prototype's gear is a bare
`<button>` carrying no shared button class, so it inherits no transition and
never had one to keep; the app's is a `.ghost`, so the background half of that
hover already cross-fades from the button foundation. What was actually open
was whether to hold the glyph colour out of it, and a snapping glyph over a
fading background is one hover disagreeing with itself.

Scoped to `.content-header .settings-button` rather than added to `.ghost`: the
gear is the only button whose glyph carries the hover, and on the shared
foundation a third animated property would also land on `button:disabled`, a
state `components.md:32` gives no motion at all.

> Raised as item 4 of LC-158, from the review of LC-70. Items 1-3 and 5 of that
> ticket were defects; this one was a question, recorded here rather than
> answered in a CSS comment nobody would find from the prototype side.

## D17 — Reconciled with Claude Design v3 · accepted (LC-192)

The repo and the Claude Design project **LongClaw DS v3** were never parent and
child. Both were built from the same two inputs — the v1 specimen
(`fable-design-system-v1.mhtml`, saved by hand) and the brief's instruction to
move accents into theme tokens — and each invented its own preset hues. That
predicts exactly what LC-192 found: where both copied v1 the values match to
the digit (focus-ring 14/18, agent-ring 10/13, agent-border 38/42), and where
both invented, they diverge.

Resolved in favour of Claude Design, because those hues were chosen against the
settled docs while the repo's were carried over from a specimen's tweak state:

|                      | was                   | now                   | why                                                                                                                                                                                                                                                       |
| -------------------- | --------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Indigo human · light | `#6B5CF6`             | `#5B4DEF`             | v3 retires `#6B5CF6` outright. Its own `#4B4EE7` sits 5° from Linear's `#5E6AD2` in hue; the brand goal is not to be mistaken for Linear, so this keeps v3's weight at 245° — 11° off Linear — and clears 5.60:1 on white where `#6B5CF6` scraped 4.68:1. |
| Agent · light/dark   | `#279E52` / `#6CD592` | `#12946A` / `#66D4A1` | v3's green. v1's own `lcPulse` keyframe already hardcoded `rgba(18,148,106,.38)` — the specimen disagreed with itself and v3 is the resolution.                                                                                                           |
| Agent text           | `#1B7A3D` / `#7FDCA0` | `#0B7D59` / `#66D4A1` | v3 §07-05 proposed `#0B7D59` for strict 4.5:1; it clears 5.13:1 on white and 4.54:1 on the agent soft chip.                                                                                                                                               |
| Clay human           | `#9C4126` / `#C57A55` | `#A9482C` / `#DD8A6C` | v3's pair, dark adjusted — see below.                                                                                                                                                                                                                     |

**Two values are ours, not v3's, and the checker is why.** v3 §07-06 asserted
that the clay/agent-green pair stays separable under deuteranopia because of
its lightness gap. It does not: v3's clay dark `#E29277` against the new agent
green scores ΔE 18.03 / ΔL 5.53, under the ΔE ≥ 20 (or ΔE ≥ 12 with ΔL ≥ 10)
bar. `#DD8A6C` clears it. Separately the new green is teal-shifted enough to
collide with Slate under tritanopia (ΔE 17.91), so Slate light moves
`#3D6BC4` → `#3A62BE`. Sweeping the green itself fixed neither and made clay
worse — the old `#6CD592` scores ΔE 10.77 there.

This is the whole argument for the repo holding the token ledger: v3 has no
checker, so it shipped a pair its own prose claimed was safe. All 226 checks
pass at the landed values.

**Also settled here:** the appearance/preset attributes were swapped relative
to the design system — the repo used `data-theme` for the preset and
`data-appearance` for light/dark, while `theme-v3.css` uses `data-lc-theme`
and `data-theme`. Same attribute name, opposite meaning, so no markup could
move between them. The repo adopted v3's contract (LC-192 § A1).

**And the fork:** `docs/design/foundations/tokens/` was a second
`design-tokens.json` labelled the source of truth while the app shipped
another. `a11y-check.mjs` read the stale one, so this document's AA guarantee
was being proved against values no user saw. Deleted; the prototype, both
proof pages and the checker now read `apps/desktop/src/tokens/`, and
`scripts/token-source-guard.mjs` fails the build if a second copy reappears.

> Filed as LC-192. The full item-by-item comparison is
> `.longclaw/tickets/LC-192/conflicts.md`.

## D18 — Prototype-first re-derivation of the adjusted values · accepted (LC-223)

LC-223 set the direction for every value D10 adjusted: the Claude Design
rendering wins wherever the checker allows it. Each adjusted value was
re-derived as the nearest point toward the DS hue (an oklab lightness
search) that still clears its gate, replacing nudges that had been made
from the repo's side of the fence:

- `warn` light returns to the reference `#B45309` — it clears 4.5:1; the
  earlier `#9A5008` had over-darkened.
- `todo`/`backlog` light take the DS todo grey `#878CA0` outright (3.34:1
  and 3.06:1 on bg and surface); `canceled` light shares it, keeping the
  D10 collapse. Dark: todo `#7E8398` (DS as-is), backlog/canceled
  `#5F6375` (derived).
- `in-review` light `#DF6E23`, `in-progress` light `#C28000`,
  `priority-urgent` light `#DB7129`, `danger` light `#C9393B` — each the
  boundary value toward the DS hue.
- `ink-3` barely moves (`#686D80` light, `#7F8599` dark): 4.5:1 as meta
  text binds, and the DS greys sit far outside it. This is the one place
  the prototype's lighter voice cannot be had without giving up AA.
- `ink-disabled` adopts the DS values as-is (`#B7BBC9` / `#4A4E60`) — WCAG
  exempts disabled elements, so no gate binds.
- The agent pulse follows the DS spec again (G8): 1.8s ease-out, looping
  while the acknowledged state lasts; the state decays on open or after
  two minutes, which ends the loop.
- `shadow.raised` (`0 1px 3px` at .10 light / .40 dark) joins the
  elevation scale from the DS (G10). `shadow-icon` stays out — it exists
  for the marketing app-icon tile, which the app never draws.
- Not adopted, gates unmoved: distinct backlog/todo/canceled greys
  (indistinguishable once each is forced to 3:1), and `priority-off` /
  `priority-none` recolors (those values belong to the D4-retired bar
  glyphs and have no rendering in the prototype).

Checker after the change: 186 contrast pairs + 40 CVD pairs, all pass;
`accessibility.md` regenerated. The push of these resolved values back to
Claude Design rides LC-223's sync items.

## D19 — Titles wear the display face · accepted (LC-223, F1)

The one F-group conflict LC-195 flagged as a design call, now called: the
`title` role moves from Geist to Familjen Grotesk, as the DS always
specified (`typography.css`: "title 17 · display 600"). Panel titles, the
board title, the create form's heading and the ticket title editor flip
with the token; board card titles stay in the UI face (they are `ui` role,
13px, and the DS BoardCard agrees). The wordmark takes the DS lockup
exactly — display 700 at 15.5px, −0.03em — and the 700 weight ships as a
real latin subset (OFL, Google Fonts v11) in both copies of `fonts.css`,
because `font-synthesis: none` would otherwise render a silent 600.

## D20 — The type scale's F-group residue · accepted (LC-223, F4–F6)

Three values return to the DS scale: `micro` is the 10.5px mono voice
again ("card IDs, tiny meta" — the 11.5px UI size it had drifted to was
really chip text, which now lives on the Chip component as its own
11.5/500, exactly what the DS Chip specifies); the `label` role tracks
at +0.09em; `display` tightens to −0.02em. Re-pointed off the role and
pinned at 11.5px UI: label chips, menu hints, settings notes and field
labels, the create-more label, and the theme preset names (the preset
cards item redraws those). The degraded list row keeps the role — it
renders a path, and 10.5 mono is exactly that voice.

## D21 — The label ramp takes the prototype's picker strip · accepted (LC-223, E13)

The settings prototype's colour picker is the ramp's reference now: cyan
`#2AA8A0`, purple `#8B6CF0`, red `#E05B5B`, orange `#E0762F`, amber
`#DFA412`, gray `#878CA0` (blue and pink already matched). No gate binds
label dots — they are reinforcement beside mandatory chip text — but two
rules were checked before adopting: the prototype cyan sits at hue 176°,
outside D12's excluded green band (120–165); and against agent green it
holds ΔE 22.0 / 21.1 / 20.2 under normal, protanopia and deuteranopia —
the checker's clearly-distinct tier — while its tritanopia ΔE 9.4 merely
matches the old cyan's 8.9, where hue was never the distinction anyway.
Dark siblings derive by applying each old pair's oklab light→dark lift to
the new light hue. The DS's own `--label-watcher: #E1703C` disagrees with
its prototype's picker (`#E0762F`); the picker is the newer artifact and
wins, and the sync push carries the resolution back.

## D22 — The header takes the prototype's band · accepted (LC-223, supersedes D16)

A 62px band with a full-width hairline below, the project name (16.5px,
display face) stacked over its path line (mono 10.5 `ink-3`), and the gear
at 26px whose hover fills `line-soft` like every other icon button — the
prototype's header, replacing the padded block. D16 accepted the gear's
colour-only hover as a reference divergence; the divergence is retired
with the rest of them.
