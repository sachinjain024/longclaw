# LongClaw Design System

**LongClaw** (by Fable) is a local-first issue tracker for AI-native startups where **humans plan and agents execute**. Tickets are plain files on disk (`~/dev/longclaw/.tickets/lc-128.md`); the app is a Linear-grade UI over them, and coding agents (e.g. claude-code) act on the same files. Tagline: *"One canvas. Two actors. Files on disk."*

> **Reconciled with the GitHub repo, 2026-08-10 (LC-192).** The accent layer now lives in `tokens/themes.css`, which is **generated** from `apps/desktop/src/tokens/design-tokens.json` in the repo and pushed here. Do not hand-edit it. Everything else in this project is still hand-authored — and a few parts of it have been superseded by decisions the repo made after this system was built; they are marked **[superseded]** below rather than deleted, so nobody rebuilds from them by accident.

## Sources
- `uploads/Fable LongClaw Design System.html` + `uploads/saved_resource.html` — a "Fable LongClaw Design System v0.1" specimen document authored in Claude Design (artifact `6889b822`, saved page). The original ground truth: logomark, colors (light+dark), type, space/radius/motion, core components, agent-presence patterns.
- The repo's `apps/desktop/src/tokens/design-tokens.json` — **the token source of truth as of LC-192.** It is the one file both the app and this system derive from.

## The two rules that carry the brand
1. **Two actors, two hues.** The human accent means a person planned it; green means an agent did it. **The exclusivity rule:** green appears *only* when an agent acted — never decorative, never a generic "success" color, never a status. Done is therefore the **human accent**, not green (completion is a human call).
2. **Monospace wherever the files show through.** IDs (`LC-128`), paths, frontmatter-ish metadata, keyboard hints, section labels — all JetBrains Mono. It keeps the app honest about being files on disk.

## Theme presets

Five, fixed, no custom colors. Set `data-lc-theme="<preset>"` for the theme and `data-theme="light|dark"` for the appearance — both may sit on the same element or an ancestor.

| Preset | Human accent (light / dark) |
| --- | --- |
| **Indigo** · default | `#5B4DEF` / `#887DF2` |
| Clay | `#A9482C` / `#DD8A6C` |
| Slate | `#3A62BE` / `#85A7EC` |
| Plum | `#A23F9C` / `#D48BD0` |
| Graphite | `#525A6E` / `#A9AFC4` |

The **agent accent is constant in every preset** — `#12946A` light / `#66D4A1` dark — so agent presence reads identically in every project. Its AA-safe text variant is `#0B7D59`.

Two of these values are the repo's rather than this system's, and the reason matters: the repo runs a contrast and color-vision checker over every pair (226 checks). Clay's dark accent and Slate's light accent both failed the human/agent separation test under deuteranopia and tritanopia respectively at the values proposed here, and were moved until they passed. **Propose hues here; let the checker settle them.**

## CONTENT FUNDAMENTALS
- Sentence case everywhere; terse, engineer-plain: "Fix watcher debounce on rename", "Moved to Done", "Changed on disk while you were editing."
- Section labels are lowercase mono with markdown flavor: `## 01 · logomark`, `in progress · 4`. Middle dot `·` is the universal separator (`12s · via file edit`, `design-system · v0.1`).
- The app is honest about provenance: agent entries say `via file edit`; freshness reads `updated by agent · 12s`.
- Buttons are verbs, 1–2 words: "New ticket", "Filter", "Reload file", "Keep mine". Keyboard hints ride inside buttons/toasts as mono chips (`C`, `⌘Z`).
- No emoji. Unicode glyphs as icons: `❯` (agent prompt), `●` (dots), `·`. First person rarely; imperative voice.
- Naming: tickets `LC-###`; agents get tool-names (`claude-code`), humans get real names (Mara Kim).

## VISUAL FOUNDATIONS
- **Color:** neutral ink-on-paper app; accents only where an actor acted. Light: bg `#F4F5F8`, surface `#FFFFFF`, ink `#171923`/`#4C5165`, line `#E3E5EE`. Dark is first-class (bg `#0F1015`, surface `#16171E`, raised `#1C1E27`). Status hues: In Progress amber, In Review orange — warm working states distinct from both actor accents. *(The repo carries AA-adjusted variants of several neutrals and status hues; reconciling those is open work — see LC-192 § E.)*
- **Type:** three voices — Familjen Grotesk (display, 600–700 only), Geist (UI at 13–13.5px desktop density; 500 titles, 600 emphasis), JetBrains Mono (files/labels). Exact scale in `tokens/typography.css`; sizes are fractional (13.5, 12.5, 10.5) — never round them.
- **Space:** 4px base (4·8·12·16·20·24·32·40). List rows 36, controls 30, card padding 12, gutters 16/24. Dense, but breathing.
- **Radius:** controls 5 · cards 8 · panels 10 · modals & palette 14. Never pill-shaped containers (small label chips are the one capsule).
- **Borders & shadows:** 1px hairlines everywhere (`--line`, `--ctrl-border` for controls). Shadows are whispers: cards `0 1px 2px rgba(23,25,35,.04)`; toasts `0 6px 18px`. Dark theme drops card shadows, relies on surface steps.
- **Motion:** state, never decoration. 80ms hover/press · 120ms state change · 150ms panel/palette, ease `cubic-bezier(0.2,0,0,1)`. The one exception is the agent acknowledgement pulse. *(This system defines it as `lcPulse` 1.8s infinite; the repo ships 900ms × 2 beats. Open — LC-192 § G8.)*
- **Focus/selection:** accent border + 3px `color-mix` ring (14% light / 18% dark).
- **Backgrounds:** flat token colors only. No gradients (sole exception: the macOS app icon tile), no textures, no imagery, no illustrations, no blur.
- **Agent presence:** agent avatar = terminal tile (26px, radius 4, near-black, mono `❯`, agent-green 1.5px ring at 65–70% mix) — never in the assignee slot; humans are circle avatars with initials. Agent timeline entries get a 2px green hairline border-left; agent-touched cards get green border + ring + pulse dot.

## ICONOGRAPHY
- No icon font and no third-party set. All icons are tiny **inline SVGs on a 14×14 viewBox**, stroke ~1.3–1.6, explicit token hues.
- Unicode as icons: `❯` for agent, `●` for label dots, `⌘Z`-style kbd chips.
- Logomark: an original geometric owl, "the watcher" — six straight cuts + four circles, tapering to a talon point. Variant A (talon) is current. Scales 16/24/32. Duotone is marketing-only, never in-app. Files: `assets/logo.svg`, `assets/logo-dark.svg`, `assets/logo-duotone.svg`.
- Lockup: mark + "LongClaw" in Familjen Grotesk 700, -0.03em.

## Components
`components/actions/` Button · `components/forms/` Input · `components/chips/` Chip · `components/indicators/` StatusIcon + PriorityIcon · `components/avatars/` Avatar · `components/cards/` BoardCard · `components/feedback/` Toast + Banner · `components/timeline/` TimelineEntry + Checklist.

Theming: wrap any subtree in `data-lc-theme` / `data-theme`; every component reads tokens only.

### [superseded] — do not build on these
Three things in this kit were overruled by founder direction after it was authored. They are kept for history; the repo's `docs/design/foundations/decisions.md` is authoritative.

- **`StatusIcon`** — the pie/ring/check/X glyph set is retired (**D3**). A status is now a **color dot + text label**, one geometry for all; the dot never appears without its label.
- **`PriorityIcon`** — the High/Medium/Low bar glyphs are retired (**D4**). The set is Urgent · **P1 · P2 · P3 · P4** · None, the middle four as bordered mono chips.
- **The assignee slot** — removed entirely (**ADR 0001**): a local project has exactly one human and no assignee concept. `Avatar`'s "never in the assignee slot" rule has no slot to stay out of in v0.

## Index
- `styles.css` → `tokens/` (fonts, colors, typography, spacing, **themes**) — import this one file.
- `tokens/themes.css` — **generated**, five presets × two appearances. Regenerate in the repo with `npm --prefix apps/desktop run design:emit`.
- `assets/` — logo.svg, logo-dark.svg, logo-duotone.svg.
- `guidelines/` — specimen cards (Design System tab).
- `components/` — see inventory above; each folder has `.jsx`, `.d.ts`, `.prompt.md`, card html.
- `ui_kits/longclaw-app/` — app shell + board view composed from the components.
- `SKILL.md` — agent-skill entrypoint.

## Caveats
- **Fonts:** no font binaries were provided; loaded from Google Fonts. All three families are on Google Fonts — exact matches, no substitution.
- **UI kit is an extrapolation:** treat its layout as provisional.
- **This project is the system.** The document project *LC Fable v3 Design System* holds a **vendored snapshot** of it under `_ds/`, not a live binding — changes here do not appear there until that project is re-synced.
