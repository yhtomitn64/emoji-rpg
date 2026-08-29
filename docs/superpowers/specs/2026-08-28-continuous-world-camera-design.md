# Continuous-world camera design

Raised 2026-08-28. Timothy's own words: "walk from a grass on one
map/screen to a mountain on another screen and you can't see your
character because they are in the mountain so you have to hit up or
something to walk out of the mountain... I think I want the game to go
in a direction of the character always centered until you get closer to
an edge so the whole map moves as the character walks around." This is
the third time this idea has been raised (2026-08-24 and 2026-08-25, see
`docs/superpowers/BACKLOG.md`'s "Roaming visible enemies..." section) —
this doc gives it its own design pass, separate from the roaming-enemies
idea it was originally bundled with.

## Problem

Today, `js/screens/mapScreen.js` renders one wilderness screen at a time
as a CSS grid that stretches to fill the browser window
(`grid-template-columns: repeat(cols, 1fr)`, `.map-tile { aspect-ratio:
1 }`). Moving between the 25 wilderness screens
(`js/maps/wilderness/*.js`, linked via each screen's `neighbors` field)
is a hard swap: `tryMove` detects an out-of-bounds step, calls
`onEdgeTransition`, and `handleEdgeTransition` in `js/main.js` computes
a landing tile (`computeEdgeLandingPosition` in `js/systems/world.js`)
on the neighbor screen and remounts the whole map component there. If
the landing tile happens to be visually large (e.g. a mountain obstacle,
which overlaps into the tile above it — see `RANDOM_SIZE_OBSTACLES` in
mapScreen.js), the player's own emoji renders underneath it, so the
character appears to vanish until they step off that tile.

**Related bug folded into this fix:** `handleEdgeTransition` teleports
the player directly, bypassing `tryMove`'s tile-passability/tool-gate
logic entirely. So landing on a tool-gated tile (e.g. a mountain, with
the pick already in inventory) never runs the "convert thicket/mountain
to stump/rubble" logic (`CLEARED_GATE_REPLACEMENT` in mapScreen.js) —
confirmed via code inspection, matches Timothy's 2026-08-28 report that
crossing into a screen with a tool doesn't "break the mountain" the way
walking into one normally does.

## Goals

- The visible map scrolls continuously as the player walks, rather than
  swapping to a new fully-rendered screen at a hard edge.
- The player's own tile stays centered in the viewport, except near a
  world boundary, where the camera stops panning and the player visibly
  approaches the edge of the viewport instead.
- Build this as one generic mechanism on the map screen, not a
  wilderness-only special case — any map (wilderness, town, a dungeon)
  renders through it. A map smaller than the viewport (true of every
  town/dungeon screen today) just shows fully, with no panning — visually
  unchanged from today. This leaves the door open for a future large or
  multi-floor dungeon to reuse the same mechanism without new engine
  work, without building any of that now (YAGNI).
- Tile size is fixed in real pixels (not stretched to fill the window),
  so how much of the world is visible depends on the player's actual
  screen size — a smaller viewport (mobile) naturally shows less land,
  per Timothy's own framing in the 2026-08-25 backlog note.
- Camera re-centers instantly per step (same per-keypress feel as
  today) — no animated slide. Timothy considered an animated slide "more
  fun" but explicitly asked to backlog it and ship the instant version
  first (see Non-goals).

## Non-goals

- **Smooth animated camera panning.** Backlogged per Timothy's own
  call — instant snap ships first; revisit only if the instant version
  doesn't feel right in practice.
- **True large or multi-floor dungeons.** This design makes them
  possible to build later on the same machinery; it does not build any
  of that machinery's content or floor-transition mechanics now.
- **Fog-of-war stitched overview map.** Separate existing backlog item
  (BACKLOG.md, "Fog-of-war reveal map"). Compatible with this design (a
  global coordinate system is a natural building block for it) but not
  built here.
- **Roaming enemies crossing screen borders.** Separate existing
  backlog item this idea was originally bundled with (BACKLOG.md,
  "Roaming visible enemies..."). Not built here.
- **Non-uniform screen sizes within one connected cluster.** Every
  wilderness screen today is a uniform 30x22 tiles. This design assumes
  that holds for any cluster of neighbor-linked screens; a future
  dungeon needing mixed sizes within one cluster would need this
  revisited.

## Architecture

### `js/systems/worldGrid.js` (new)

At load time, groups screens into **clusters**: connected components of
the graph formed by each screen's `neighbors` field. The 25 wilderness
screens form one cluster (confirmed: all mutually linked, uniform 30x22
size). Town and each dungeon interior have no `neighbors` and so are
each their own one-screen cluster.

For each cluster, assigns every member screen a `(gx, gy)` position in
*screen* units via BFS from an arbitrary start screen, stepping by
whole screen-widths/heights in the direction of each `neighbors` link.

Exposes:
- `screenToGlobal(screenId, localX, localY) -> { gx, gy }` — this
  screen's local tile converted to the cluster's global tile space.
- `globalToScreen(clusterId, gx, gy) -> { screenId, localX, localY } |
  null` — the reverse; `null` means past the cluster's outer edge (the
  world boundary).

Pure/data-only module — no DOM, no game state — so it's unit-testable
the same way `js/systems/world.js` is today.

### Movement (`js/screens/mapScreen.js`, `js/main.js`)

`tryMove(dx, dy)` computes the next **global** position and resolves it
via `globalToScreen`. If `null` (past the cluster's outer edge), the
step is blocked — replacing today's per-screen sealed-edge
`mountainWall` rendering with a derived cluster-boundary check. If
resolved, the exact same passability/tool-gate/discovery/cache/encounter
logic that runs today executes against the resolved `(screenId, localX,
localY)` — no behavior change to any of those systems, just a different
lookup path than "always the currently-mounted `mapConfig`."

`state.map` (today's "current screen," driving `monsterTable` /
`encounterChance` / first-visit flavor banners / `screenSeen` /
`persist()`) updates to whichever screen the resolved position belongs
to, inline within the move — same trigger points as today
(`handleFirstVisit`, `persist()`), just fired as a side effect of
stepping instead of from a dedicated remount callback.

**Removed:** `handleEdgeTransition`, `computeEdgeLandingPosition`, the
`onEdgeTransition` callback. Crossing a screen boundary is no longer a
distinct code path — it's the same step logic as any other move, which
is what fixes the tool-gate-on-landing bug (see Problem) as a side
effect: there's no more separate "teleport" path that can skip the
gate-clearing check.

### Camera & viewport (`js/screens/mapScreen.js`, `css/styles.css`)

- A new fixed tile size (`--tile-size`, e.g. `48px`), one value for all
  devices.
- The map container becomes a fixed-size viewport (`overflow: hidden`)
  instead of a grid stretched to fill its parent. On mount and on
  resize, JS measures the container's rendered size and computes how
  many whole tiles fit (`floor(width / tileSize)` ×
  `floor(height / tileSize)`).
- Camera center = the player's global tile (via `screenToGlobal`). Each
  render asks `worldGrid` for the surrounding window of that size and
  draws it, resolving each cell back to its owning screen (via
  `globalToScreen`) for tile/legend/trail/gate/cache lookups — reusing
  all of `mapScreen.js`'s existing per-tile rendering logic
  (obstacle sizing, trail SVGs, decorations, full-square markers),
  just parameterized per-cell by whichever screen that cell belongs to
  instead of a single closed-over `mapConfig`.
- The camera center is clamped to the cluster's outer tile bounds, so
  near a boundary the camera stops moving and the player visually
  approaches the edge of the viewport — this is the "centered until you
  get near an edge" behavior. A cluster smaller than the viewport (every
  town/dungeon today) is clamped to always show its full extent
  centered, with no panning ever possible — visually equivalent to
  today's "whole screen always visible."
- Render stays a full redraw of the visible window per step (same
  pattern as today's full `render()` per move), just windowed to the
  viewport instead of the whole screen.

## Known limitation (accepted, not fixed here)

`isScreenChokepoint`'s articulation-point check (`isChokepointTile` in
`js/systems/world.js`) only considers one screen's local grid. A tile
right at a screen boundary could theoretically have a bypass through the
*neighboring* screen that this check can't see, so it might occasionally
treat a boundary tile as more of a chokepoint than it really is (this
only affects mini-dungeon-entrance placement, via
`isScreenChokepoint`/`resolveStepDiscovery`). This is a pre-existing
blind spot, not a regression introduced here — flagged so it isn't
mistaken for a bug later.

## Testing

- `worldGrid.js` gets direct unit tests (cluster derivation from
  `neighbors`, `screenToGlobal`/`globalToScreen` round-tripping,
  boundary `null` cases) — same style as `tests/world.test.js`.
- `tests/mapScreenDom.test.js` and `tests/maps.test.js` need updating
  for the new render path (viewport window instead of whole-screen
  grid) and the removed edge-transition callback.
- Manual verification: walk across every one of the 25 wilderness
  screen boundaries and confirm no visual pop/cut, confirm a
  mountain/thicket gate crossed with the right tool converts to
  rubble/stump immediately on the landing step, and confirm town/dungeon
  screens still render exactly as they do today (no panning, whole map
  visible).
