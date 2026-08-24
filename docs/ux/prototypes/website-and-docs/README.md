# Website design handoff (LC-205)

`Homepage token implementation review.zip` is the Claude Design export the
public site was built from — the "LongClaw Website" design system (the ochre
marketing palette, separate from the app's system) plus the six generated
pages.

```sh
unzip -q "Homepage token implementation review.zip" -d _unzipped   # gitignored
```

Inside:

| Path | What it is |
| --- | --- |
| `LongClaw Homepage.dc.html` | The home page, including both interactive tours |
| `LongClaw Docs.dc.html` | The docs shell, with Getting started as the worked example |
| `LongClaw CLI.dc.html` | The CLI reference and its command blocks |
| `LongClaw Blog.dc.html`, `LongClaw Blog Post.dc.html` | Blog index and post template |
| `LongClaw Changelog.dc.html` | The changelog |
| `_ds/…/tokens/*.css` | The design tokens, transcribed into `apps/website/src/styles/tokens/` |
| `_ds/…/readme.md` | The system's own rules: voice, colour, flatness, iconography |
| `assets/longclaw-mark-*.png` | The owl mark, from which `Mark.astro`'s vector geometry was traced |

The implementation lives in [`apps/website`](../../../../apps/website). Two
things it deliberately does differently, both recorded in the code:

- **Fonts are self-hosted**, not imported from Google Fonts as
  `tokens/fonts.css` does.
- **`--text-faint` is darkened** (light) and **lightened** (dark). The exported
  value fails WCAG AA at the small sizes the design uses it at. `--surface-alt`
  is also a plain token rather than a runtime `color-mix`.

Fold both back into the design system when it is next revised. The companion
documents are [`docs/design/website-content-brief.md`](../../../design/website-content-brief.md)
(sourcing and decisions) and [`docs/design/website-prompts.md`](../../../design/website-prompts.md)
(the prompts that generated these pages).
