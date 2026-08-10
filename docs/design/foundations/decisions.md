# Design-system decision log — Phase 0, Step 1

Every **[proposed]** item from `docs/design_brief.md` (final iteration) and
every divergence flagged in the approved visual reference
(`fable-design-system-v1.mhtml` § 07), resolved. Statuses: **accepted** /
**rejected** / **adjusted**. All decisions below are staged for founder
sign-off at the M0 gate; none silently diverge from the brief.

## D1 — Theme preset set: 4 presets · accepted (count), proposed (new hues)

Indigo (default) · Clay · **Slate** · **Plum**. Brief allowed 4–5 including
Indigo and Clay with 2–3 new proposals; we ship two new proposals and stop at
four, because every additional preset must clear a shrinking safe-hue space
(see D2 rejections) and four already proves the token architecture.

| Preset | Human accent (light / dark) | Agent accent (light / dark) | Status |
|---|---|---|---|
| Indigo · default | `#6B5CF6` / `#887DF2` | `#279E52` / `#6CD592` | accepted — approved reference values |
| Clay | `#9C4126` / `#C57A55` | same | adjusted — see D10 |
| Slate | `#3D6BC4` / `#85A7EC` | same | proposed — steel blue, calm and technical |
| Plum | `#A23F9C` / `#D48BD0` | same | proposed — warm violet, clearly not Indigo |

The brief's Indigo working values (`#4B4EE7`/`#898CF6`) were superseded by
the approved reference's `#6B5CF6`/`#887DF2`; the reference sets these as its
root theme tokens and they test better against the status ramp.

**Rejected preset candidates** (recorded so they aren't re-proposed blind):

- **Teal/Emerald** — human accent would sit in the agent's hue band; breaks
  the exclusivity rule at a glance.
- **Amber/Gold** — collides with the In Progress status color.
- **Rose/Red** — collides with danger and the Urgent glyph.
- **Ink/Mono** (a colorless human accent) — elegant, but erases human
  presence from the timeline; the two-actor thesis loses one actor.

## D2 — Agent accent stays one green family across all themes · accepted

`#279E52` light / `#6CD592` dark in every preset. Agent activity must read
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

The approved reference is the visual truth, but seven of its values missed
WCAG AA when tested (`scripts/a11y-check.mjs`, results in
`accessibility.md`). Production values were nudged the minimum distance to
clear the gates; the look stays calm.

| Token | Reference | Production | Why |
|---|---|---|---|
| `ink-3` light | `#878CA0` | `#666B80` | 4.5:1 as meta text on wash/bg/surface |
| `ink-3` dark | `#676C80` | `#8A8FA3` | same, on dark surfaces |
| `status-backlog/todo` light | `#A9ADC0`/`#878CA0` | `#82879B` | 3:1 glyph stroke on bg |
| `status-in-progress` light | `#DE9B0D` | `#B47D0A` | amber failed 3:1 badly (2.1) |
| `status-in-review` light | `#E5732A` | `#C25C1B` | 3:1 on bg |
| `status-canceled` light/dark | `#C7CAD6`/`#3A3D4D` | `#82879B`/`#767B90` | fill 3:1 + X mark 3:1 on fill |
| `priority-urgent` light | `#E0762F` | `#C2591D` | fill and white mark both 3:1 |
| `warn` light | `#B45309` | `#9A5008` | 4.5:1 as banner text |
| `danger` light | `#D64545` | `#C43A3A` | 4.5:1 as button text |
| Clay human light | `#A9482C` (brief working value) | `#9C4126` | deuteranopia ΔL 9.6 → 13.3 vs agent green |
| Clay human dark | — (unspecified in brief) | `#C57A55` | deuteranopia ΔE 20.8 (clears the strict tier) |
| dark toast secondary | `#5A5F75` | `#4C5165` | 4.5:1 on inverse surface |

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

Two independent axes on the root element: `data-appearance` (light/dark) ×
`data-theme` (indigo/clay/slate/plum). A preset supplies **six values per
appearance** (accent, text variant, on-accent × two actors); every
soft/hover/ring/rail/wash variant derives via `color-mix(in oklab, …)` in
generated CSS. Neutrals, status, warn/error, and label colors are
theme-independent system tokens. The board proof (`proof/board.html`)
renders all 4 themes × 2 appearances from one DOM with zero component
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
