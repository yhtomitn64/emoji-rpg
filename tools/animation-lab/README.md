# Animation Lab

A browser-based, dev-only tool for designing the battle screen's
weapon-swing animations (Attack/Stab/Chop/Slash/Sweep). Reuses the real
`css/styles.css` and battle-screen markup so the preview is what the game
actually renders, and previews using the exact same `Element.animate()`
call `js/screens/battleScreen.js` uses in the real game.

It is never deployed - `.github/workflows/deploy.yml` stages an explicit
allowlist of files/dirs into the live build, and `tools/` isn't on it. It
only exists locally.

## Run it

```bash
python3 -m http.server 8000
```
from the repo root, then open http://localhost:8000/tools/animation-lab/index.html.

## The animation model

Every single-target ability (`attack`/`stab`/`chop`/`slash`) is a list of
keyframes on a 0-1 timeline, each with `x`/`y`/`rotate`/`scale`, plus one
`anchor` point and a `pinned` toggle:

- **Pinned** (Attack/Chop should be this): the glyph rotates around the
  fixed `anchor` point, riding a rigid arm out to each keyframe's position -
  like a weapon actually held at a fixed point in the hero's hand.
- **Free** (a thrown/flying weapon): the glyph rotates about its own center
  while translating along the keyframe path - the anchor is ignored.

Every `x`/`y` (and the anchor's own `x`/`y`) is `base + dx * dxFactor`
where `dx`/`dy` are the live distance to whatever target is actually being
hit that battle - matching the `dx * 0.15 + 40` pattern already used
throughout `battleScreen.js` before this tool existed.

Sweep is shaped differently (`designs/sweep.json`'s `default`/`overrides`
by target count) since it plays through several live targets in sequence
rather than one fixed keyframe list - not yet editable in this tool's UI
(no export path either). Hand-edit `designs/sweep.json`, then hand-edit
the matching `SWEEP_PROFILES` value between the
`// ANIMATION-DESIGNER:sweep:PROFILES:...` markers in
`js/screens/battleScreen.js` to match - there's no automated patcher for
Sweep yet, both files have to be kept in sync by hand until the UI catches
up.

## How saving actually works

Same shape as `tools/terrain-painter/`'s workflow:

- Autosaves to `localStorage` (key `animation-lab-autosave-v1`) as you
  edit. If you clear your browser's site data before exporting,
  unexported changes are gone - the tool falls back to loading straight
  from `designs/<ability>.json` on the next open.
- **Export to Files** (Chrome/Edge): click "Choose Repo Folder" once per
  session, pick the repo's root folder, then "Export to Files" writes the
  design JSON and patches the matching marker-commented block in
  `js/screens/battleScreen.js` - only that block, nothing else in the file
  is touched.
- **Firefox/Safari**: "Choose Repo Folder"/"Export to Files" are disabled
  (no File System Access API) - use "Copy JSON" and "Copy generated code"
  and paste them in by hand: the JSON into
  `tools/animation-lab/designs/<ability>.json`, the code between the
  matching `// ANIMATION-DESIGNER:<ability>:...` marker comments in
  `js/screens/battleScreen.js`.
- Always run `npm run test` after exporting, then commit.

## Known gaps (not built yet)

- Sweep has no timeline/inspector UI - its `leadIn`/`perWaypoint` fields
  are hand-edited JSON only.
- No keyframing of the hero's own position/motion (it keeps its existing
  fixed lunge-and-snap-back) - out of scope by design, see
  `docs/superpowers/specs/2026-08-30-animation-lab-design.md`.
