# LongClaw app icon — "White on Orange" (#FFFFFF on #B45F06)

Generated from the LongClaw owl mark, product-icon variant 4, selected from
the Aug 13 2026 concept round (LC-62). The concept sheets themselves were not
kept.

## icons/

**This directory is the source of truth for the app icon.**
`apps/desktop/src-tauri/icons/` is a copy of it — the two are byte-identical
except for `icon.png`, the 1024 master, which is gitignored on the app side
(`apps/desktop/.gitignore`) and tracked only here. Change the icon here, then
copy the whole folder over; never edit the copy, because nothing would tell you
the two had diverged.

The complete Tauri set:
- icon.png (1024, master), 32x32.png, 128x128.png, 128x128@2x.png — Linux/general
- icon.ico — Windows (16-256 px, PNG-compressed)
- icon.icns — macOS (rounded corners + Apple 824/1024 inset baked in)
- Square*Logo.png, StoreLogo.png — Windows Store/MSIX

tauri.conf.json:
```json
"bundle": {
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

To regenerate all sizes from the master instead: `npm run tauri icon src-tauri/icons/icon.png`
(note: the CLI output won't have the macOS rounded-corner inset baked like icon.icns here).

## in-app/
- longclaw-mark-white.png — transparent white mark, for dark/ochre surfaces
- longclaw-mark-ochre.png — transparent #B45F06 mark, for paper/white surfaces
- app-tile-rounded-512.png — rounded app tile for about screens / splash

Brand: no gradients or shadows; never enclose the mark in circles; clear space = beak height on all sides.
