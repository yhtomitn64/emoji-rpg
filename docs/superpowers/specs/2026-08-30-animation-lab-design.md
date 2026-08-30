# Animation Lab: a dev tool for designing weapon-swing keyframes

## Motivation

Weapon-swing attack animations (`js/screens/battleScreen.js`, `css/styles.css`)
shipped across 0.8.0–0.8.6 through a guess → push to prod → Timothy checks
`rpg.burghertime.com` → describe what's wrong → guess again loop, because
this session has no way to render the game. Two concrete problems came out
of the last round of feedback:

1. **Attack** rotates a full 360° around its own glyph center while
   translating along a bowed path — reads as "the blade spins in a circle"
   rather than a weapon swinging from a held position.
2. **Chop** anchors near the hero but via a small fixed offset that isn't
   tied to any real pivot — reads as "floating toward the hero" rather than
   striking from a fixed point.

The root cause of both: `swingKeyframesFor()` in `battleScreen.js` always
rotates the sprite around its own default `transform-origin` (glyph center)
while separately translating it. There's no way to pin rotation to a fixed
point near the hero's hand, the way a held weapon actually pivots.

Rather than keep iterating blind, this spec adds a dev tool —
**Animation Lab** — that lets Timothy design swing animations visually
(anchor point, keyframed position/rotation/scale, live preview using the
game's real rendering) and export the result straight into the real files.
It follows the same pattern already established by
`tools/terrain-painter/`: dev-only, never deployed, plain HTML/JS, no build
step, File System Access API for direct-to-disk export with a copy/paste
fallback.

This also directly fixes the Attack/Chop pin bugs, since the tool's core
mechanism *is* the transform-origin-pin fix — designing Attack/Chop in the
tool and exporting is the fix, not a separate step.

## Non-goals (explicitly out of scope for this spec)

- Keyframing the hero's own position/motion. The hero keeps its existing
  simple lunge-and-snap-back (`playHeroAttackLunge`, a fixed CSS class) —
  not editable in the tool. Could become its own track later if it turns
  out to matter once the tool is in use.
- Changing battle-zone layout so the hero visually repositions near the
  enemy to match an animation's landing spot. Raised as a maybe-later idea
  during brainstorming; it's a battle-screen layout change, not an
  animation-authoring one, and stays out of scope here.
- A generalized "any ability" system beyond Attack/Stab/Chop/Slash/Sweep —
  those are the five that exist today (`SWING_DURATION_MS`'s keys).
- Reachability/validation checks (terrain painter's "Check Map" has no
  analog here — there's no invalid state to flag for an animation).

## Data model

One unified keyframe model covers every case Timothy described (pinned
arc, free flight, boomerang, weapon-detaches-and-hits) — no separate
"modes" as different subsystems:

```
AnimationDesign = {
  abilityId: 'attack' | 'stab' | 'chop' | 'slash' | 'sweep',
  weaponEmojiOverride: string | null,   // preview only; real game still reads swingSpriteEmoji()
  anchor: { x: number, y: number },     // transform-origin, px offset from hero-zone center
  durationMs: number,
  keyframes: [
    { offset: number,  // 0..1
      x: number, y: number,   // px offset from hero-zone center
      rotate: number,          // degrees
      scale: number },         // 1 = natural size
    ...
  ],
  // Sweep only: not a flat keyframe list (playPlayerSweepSwing builds one
  // keyframe per *live* target at cast time, and target count varies), so
  // Sweep gets its own shape - a "default" template applied to every
  // target count, plus per-count "overrides":
  //   { default: { pinned, anchor, leadIn, perWaypoint }, overrides: {} }
  // `leadIn` is the fixed first keyframe (offset 0, matching today's
  // static "at rest" pose); `perWaypoint` describes one waypoint segment
  // ({ x, y, dxFactor, dyFactor, rotateStep, scale }) applied at each live
  // target in turn, with `rotate` accumulating as `(i + 1) * rotateStep` -
  // a direct generalization of today's hardcoded `(i + 1) * 120deg`.
}
```

- **Pinned arc** (Attack, Chop, single-target Sweep segment): `anchor` sits
  near the hero's hand; `x`/`y` stay small across keyframes; `rotate`/
  `scale` do the work. This is the direct fix for the "spins in a circle" /
  "floats" complaints — the sprite's `transform-origin` is set to `anchor`
  instead of the default center, so rotation pivots from a fixed point
  instead of the glyph's own middle.
- **Free flight / boomerang** (e.g. a redesigned Stab that detaches and
  flies to the target and back): `anchor` defaults to the sprite's own
  center (today's behavior); `x`/`y` range widely across keyframes so the
  sprite actually travels.

Same editor, same timeline, same keyframe shape in both cases — only where
`anchor` sits and how far `x`/`y` move differs.

## Tool layout

`tools/animation-lab/` — same conventions as `tools/terrain-painter/`:
dev-only, plain HTML/JS/CSS, no build step, run via
`python3 -m http.server 8000` from repo root, excluded from
`.github/workflows/deploy.yml`'s deploy allowlist.

- **Canvas**: loads the real `css/styles.css` and reuses the actual
  `hero-zone` / `monster-zone` DOM structure and classes from the battle
  screen, so the preview is WYSIWYG rather than a stylistic lookalike.
  Hero fixed on one side; target-count preset (1 / 3 / 4, extendable to the
  group-size cap of 6) lays out `monster-zone` markers matching the real
  battle grid.
- **Ability/weapon picker**: dropdown for attack/stab/chop/slash/sweep,
  plus a weapon-emoji override for preview (mirrors `swingSpriteEmoji`'s
  weapon-lookup, doesn't change real equip state).
- **Anchor handle**: a draggable pin/crosshair on the canvas, sets
  `anchor.x/y`.
- **Timeline**: add/remove keyframe stops along 0→1; selecting a stop shows
  drag handles on the canvas for that keyframe's position, a rotate ring,
  and a scale slider. Dragging updates that keyframe live.
- **Play/scrub**: previews using `spriteEl.animate(keyframes, { duration,
  easing: 'ease-out', fill: 'forwards' })` — the exact same
  `Element.animate` call `spawnSwingSprite` uses in the real game, so the
  preview *is* what ships, not an approximation.
- **Sweep-specific**: a target-count selector switches which
  `sweepProfiles[count]` you're editing; the preview applies that profile's
  keyframe shape across however many waypoints that count implies, matching
  how `playPlayerSweepSwing` staggers hits across live targets today.

## Persistence & export

Swing animations aren't stored as data today (they're imperative JS inside
`swingKeyframesFor`), unlike terrain painter's maps (already clean
LEGEND/ROWS data the painter can read straight back in). So instead of
reverse-parsing JS:

- Each ability's design is its **own JSON file**,
  `tools/animation-lab/designs/<abilityId>.json` — committed to the repo,
  human-diffable, and what the tool loads on open. This is the source of
  truth for the tool itself.
- Autosaves to `localStorage` while editing (same safety net as terrain
  painter — in-progress, unexported work survives a reload but not a
  cleared site data).
- **Export to Files** (Chrome/Edge, File System Access API, same
  "Choose Repo Folder" flow as terrain painter): writes the JSON design
  file, then patches **two** marker-wrapped locations in
  `battleScreen.js` per single-target ability, since `durationMs` and the
  keyframe shape live in different places today:
  - `// ANIMATION-DESIGNER:<abilityId>:KEYFRAMES:START` / `:END` around
    the relevant `case` body inside `swingKeyframesFor`.
  - `// ANIMATION-DESIGNER:<abilityId>:DURATION:START` / `:END` around
    that ability's entry in the `SWING_DURATION_MS` object literal.

  For Sweep, a single `// ANIMATION-DESIGNER:sweep:PROFILES:START` / `:END`
  block holds the whole `sweepProfiles` table (all target counts together),
  since `playPlayerSweepSwing` reads it as one structure.

  Only these marked blocks are ever rewritten; everything else in the
  file — comments, imports, unrelated code — is left untouched, same
  guarantee terrain painter gives for map files.
- **Firefox/Safari fallback** (no File System Access API): "Copy JSON" and
  "Copy generated code" buttons, paste-it-yourself — same fallback shape
  terrain painter uses for non-Chrome browsers.

The loop end to end: design in the tool → JSON (versioned, source of
truth) → generated code (derived, auto-patched into `battleScreen.js`) →
`npm run test` → commit.

## Testing

- `battleScreen.js`'s existing swing tests (DOM structure / emoji / class
  assertions, per that file's own stated jsdom scope — `Element.animate`
  isn't available there) should continue to pass unmodified once
  Attack/Chop are regenerated through the tool; the marker-comment patch
  only replaces keyframe/anchor values, not the surrounding function shape
  the tests assert against.
- The tool itself is unshipped dev tooling (same as terrain-painter, which
  has no test coverage) — no automated tests planned for the tool's own
  UI. Manual verification: design Attack/Chop in the tool, export, run
  `npm run test`, then Timothy checks live on `rpg.burghertime.com`.
