# Worn-Path Trail Effect — Design

## Purpose

"You've walked here" is currently a single flat background-color swap
per tile (`.visited` / `.map-tile-grass.visited` in `css/styles.css`,
driven by a boolean per-tile set in `state.visited`) — binary, no sense
of *how much* a tile's been walked, and no visual connection between
adjacent walked tiles. Timothy wants something closer to an actual dirt
path that visibly builds up the more a tile is re-walked, and reads as
directionally connected across tiles — "if you walk north one tile then
east, the path should be drawn like you went north a bit into a tile
then east a bit to the next tile," not a grid of independently-tinted
squares. Raised 2026-08-25 (`docs/superpowers/BACKLOG.md`'s "Character/
tree layering + a real worn-path trail effect" entry), refined through a
live mockup session the same day.

## Scope

**In scope:**
- Upgrading `state.visited` from a boolean-per-tile set to a walk-count
  per tile.
- Removing the flat `.visited` tint entirely — a walked tile keeps its
  natural, un-tinted color (bright grass green, natural cave floor).
  Wear is shown *only* by the trail fragments below; the base tile
  color no longer changes on its own.
- Rendering a wavy, connected dirt-trail stroke per tile, reaching
  toward whichever of its 4 neighbors are also visited, with opacity/
  thickness scaling by that tile's own walk count (10 levels, capped).
- A small centered worn dot (same wear-scaling, no connector arms) for
  the rare case where a visited tile has no visited neighbor at all.
  Discussed explicitly with Timothy: normal movement always lands
  adjacent to an already-visited tile, so in practice this is mostly a
  future-proofing fallback (e.g. a hypothetical future flying-machine
  landing spot) rather than something that shows up often today, once
  the entrance-anchor rule and town-landing nudge below are in.
- Landmark/entrance tiles (`FULL_SQUARE_MARKERS` — town entrance,
  dungeon entrance, the tool dungeon entrances, mini dungeon entrances)
  count as an implicit, always-visited neighbor for connectivity
  purposes, since every player has necessarily walked through one even
  though, the very first time a screen renders one as a neighbor, its
  own walk count can still be 0 (that first crossing hasn't registered
  yet).
- A one-line map-data nudge to `js/maps/wilderness/center.js`'s
  `startPosition` (`{x:15,y:11}` → `{x:14,y:11}`), so the tile you land
  on when exiting town is orthogonally adjacent to the town-entrance
  tile instead of diagonal to it — without this, the anchor rule above
  can't actually connect on the first frame after exiting town, since
  connectivity (like movement) is 4-directional only.
- A trail-color lookup keyed by the underlying tile type, populated for
  the two ground types that exist today (grass, cave floor), trivially
  extensible when sand/swamp/ice ship later.

**Out of scope (deliberately):**
- Sand/swamp/ice terrain types themselves — separate backlog item ("New
  terrain types: sand and tarpit"), not yet built. This design only
  makes the trail-color lookup ready to accept them.
- Any change to which tiles get their own entry in `state.visited` or
  when — reuses the exact same `isCurrentlyPassable && isVisited` gate
  the flat tint already used. The entrance-anchor rule below only
  changes how the *neighbor-connectivity check* treats landmark tiles;
  it never causes one to gain its own walk count.
- Per-tile-kind monster tables, movement-speed tiles (tarpit), or any
  other still-open backlog item these might eventually interact with.
- The bigger "continuous scrolling map instead of discrete screens"
  idea floated the same session — unrelated, tracked separately under
  "Roaming visible enemies" in the backlog.
- Auditing dungeon/tool-dungeon entrance landing positions for the same
  diagonal-offset issue found on `center.js` — only the town case was
  checked, since it's the one Timothy raised.

## Mechanics

### Walk-count data model

`js/systems/exploration.js` changes from a boolean set to a counter:

```js
export function markVisited(visited, screenId, x, y) {
  const key = `${x},${y}`;
  const screenVisited = { ...(visited[screenId] || {}) };
  screenVisited[key] = getVisitCount(visited, screenId, x, y) + 1;
  return { ...visited, [screenId]: screenVisited };
}

export function isVisited(visited, screenId, x, y) {
  return getVisitCount(visited, screenId, x, y) > 0;
}

export function getVisitCount(visited, screenId, x, y) {
  const raw = visited[screenId] && visited[screenId][`${x},${y}`];
  if (raw === true) return 1; // legacy saves stored a boolean
  return raw || 0;
}
```

`isVisited` keeps its existing signature and meaning (used unchanged
everywhere it's already called — the `isCurrentlyPassable` staleness
check that now gates the trail fragment instead of the old `.visited`
class). No save migration step is
needed: an old save's `true` is read as count 1 by `getVisitCount`, and
every write from that point on stores a real number. Legacy and fresh
saves converge on the same shape the first time a tile gets walked
again.

`markVisited` is called on every successful move (`tryMove` in
`js/screens/mapScreen.js`) and once on screen mount for the landing
tile (`mount()`) — both already exist today; neither call site changes,
they just now increment instead of set.

### Connectivity: inferred from neighbor adjacency, not tracked history

No new data structure for "which exact tiles you walked between." At
render time, for each visited+passable tile, check its 4 neighbors
(`tileAt(x, y±1)`, `tileAt(x±1, y)`) — if a neighbor is also
currently-visited and currently-passable, that direction counts as
connected and gets a trail stroke drawn toward it.

This was the one real trade-off discussed and deliberately chosen over
tracking literal step-by-step transitions: since a tile can only ever
become visited by walking from an already-adjacent tile (or as a
screen's landing tile on entry), "both neighbors visited" and "you
actually stepped directly between them" coincide in essentially every
real case. The rare exception — two separately-explored patches later
joined by a single tile visited between them — just reads as the worn
areas merging into one connected trail, which is the desired look
anyway, not a bug. This keeps the data model to a single per-tile
counter (needed for wear amount regardless) with no separate edge/
transition storage to bound or cap.

**Entrance/landmark tiles count as an implicit, always-visited anchor.**
Raised by Timothy: walking out of town for the very first time should
visibly read as the trail emerging from the town gate, not as an
isolated dot floating next to it. `tryMove` (`js/screens/mapScreen.js`)
does mark a landmark tile visited, and does render its own trail
fragment for it, before firing that tile's action callback — so a
`townEntrance` tile (or any other `FULL_SQUARE_MARKERS` landmark —
`dungeonEntrance`, the axe/pick/canoe dungeon entrances,
`miniDungeonEntrance`) isn't fundamentally exempt from the normal walk
count. The problem is narrower and only bites on a first crossing: the
very first time a screen renders such a tile as a *neighbor* of the
player's current position, that landmark's own count can still be 0 in
this screen's `state.visited`, because the crossing that would have
incremented it hasn't happened yet from this screen's side — most
concretely, exiting town for the first time lands the player adjacent
to the town gate without ever having stepped onto that gate tile in the
wilderness screen's own data. So the neighbor check above treats any
`FULL_SQUARE_MARKERS` tile as connected/visited automatically,
without needing its own count in `state.visited` — a plain rule, not a
special case, since it reuses the same `FULL_SQUARE_MARKERS` set
`render()` already has.

That rule alone isn't sufficient for the town case specifically,
though: `center.js`'s wilderness `startPosition` (`{x: 15, y: 11}`,
where the player lands after `exitMap` from town) turns out to be
*diagonal* to the town-entrance tile at `{x: 14, y: 12}`, not
orthogonally adjacent — and connectivity here, like movement, is only
ever 4-directional. Verified via the actual map data
(`js/maps/wilderness/center.js`) that all 4 of the entrance's true
cardinal neighbors are plain grass, so `startPosition` moves to
`{x: 14, y: 11}` (directly north of the gate) as part of this work —
a one-line map-data nudge, not a rendering change. This was checked
only for the town/`center` case Timothy raised; dungeon and tool-
dungeon entrance landing positions weren't audited for the same
diagonal-offset issue and may or may not need the same nudge — flagged
here rather than silently assumed fixed.

### Rendering: a trail fragment per tile, not one shared canvas

The mockup session validated the *look* (soft wavy S-curve strokes,
chained per continuous walk so joints stay smooth, no round-cap
"blobs") using one shared SVG canvas that could see the whole route at
once. The real game renders each screen as an independent grid of
`.map-tile` divs (`render()` in `js/screens/mapScreen.js`) with no
single canvas that spans them — and the per-row depth-sorting shipped
earlier the same session (`cell.style.zIndex = String(y)`, see
CHANGELOG) depends on trail content living inside its own cell like
everything else, not floating above the whole grid on one layer.

So each tile draws only its *own* fragment: a small inline SVG, a child
of that `.map-tile` cell (same pattern as the existing obstacle/
decoration spans), containing one short wavy stroke from the tile's
center toward the midpoint of each connected edge. Two adjacent tiles
each draw half of what looks like one continuous line — for the seam
to line up, both halves need to agree on the same waviness at their
shared border.

That's done by keying the jitter to the *edge*, not the tile, reusing
the existing `hash01(x, y)` deterministic-pseudo-random utility
(`js/systems/world.js`, already used for obstacle sizing and decoration
placement) with the same salted-offset convention decoration already
uses (`hash01(x + 1000, y + 1000)` etc. for independent streams):

```js
// Both the east-connector of (x, y) and the west-connector of (x+1, y)
// call this with the SAME (x, y) - the lower-coordinate tile owns the
// edge's identity - so they compute identical jitter.
function edgeJitter(x, y, axis) {
  // axis: 'h' for the vertical edge between (x,y)-(x+1,y),
  //       'v' for the horizontal edge between (x,y)-(x,y+1)
  const salt = axis === 'h' ? 6000 : 7000;
  return hash01(x + salt, y + salt) - 0.5; // -0.5..0.5
}
```

A tile computes each of its 4 possible edges' canonical owner as
whichever of itself/neighbor has the lower coordinate on the relevant
axis (e.g. its east edge and its neighbor's west edge both resolve to
`edgeJitter(x, y, 'h')`), so both sides always call the same inputs.

### Wear amount: 10 capped levels, formula-driven

Timothy's call: 10 levels. No hand-authored discrete CSS classes for
each — a tile's own connector strokes scale continuously off its own
walk count, capped at 10:

```js
const TRAIL_WEAR_CAP = 10;
function trailWearFraction(visitCount) {
  return Math.min(visitCount, TRAIL_WEAR_CAP) / TRAIL_WEAR_CAP;
}
```

Used for both stroke opacity and stroke width, e.g. opacity
`0.25 + 0.55 * fraction` (a first-time connection is already faintly
visible, never invisible) and width `10 + 8 * fraction` (in the same
`cqb`-relative sizing units the rest of `render()` already uses for
obstacles/markers). A tile's own count drives its own fragment only —
not an average with its neighbor's count — so a heavily-walked stretch
near town can read as more worn than a lightly-walked stretch further
out even where they connect, which matches how real trails erode
unevenly.

The isolated-tile worn dot (no connected neighbors — see Scope) uses
the same `trailWearFraction` off the same tile's count, sized as a
small centered circle instead of an edge-reaching stroke, e.g. radius
`6 + 6 * fraction` cqb-relative units and the same opacity formula
above. It automatically upgrades to full connector strokes the moment a
neighbor also becomes visited — no separate state to track, since
"connected or not" is re-evaluated fresh every `render()` call the same
as everything else here.

### Terrain-aware trail color

A small lookup, not a hardcoded color, so future terrain types are a
data addition:

```js
const TRAIL_COLOR_BY_TILE = new Map([
  [TILES.grass, '#6b4a2f'],
  [TILES.caveFloor, '#7a7a7a'],
]);
const DEFAULT_TRAIL_COLOR = '#6b4a2f';
```

Looked up once per tile fragment by whatever `tileAt(x, y)` returns for
that tile, falling back to the grass color for any tile kind not yet in
the map (keeps this from ever rendering nothing). Sand/swamp/ice just
add entries here whenever those tiles actually ship — no rendering
logic changes.

### Where this sits in `render()`

The trail fragment is appended to `cell` *before* the existing
mountEmoji/obstacle/decoration/marker if/else chain runs, so it paints
underneath all of that — same "append earlier = paints behind" rule the
decoration-behind-hero fix established the same session. It's computed
independent of which of those branches ends up firing (a tool-gated
tile a player has walked across, e.g. a cleared thicket or water tile
under the canoe mount, still accumulates and shows wear the same as
plain grass).

The `.visited` CSS rules (`.map-tile.visited`, `.map-tile.map-tile-
grass.visited`, `.map-tile.map-tile-water.visited` in `css/styles.css`)
are deleted outright, and `render()` stops appending the `' visited'`
class string — nothing else keys off that class (confirmed via grep;
it was purely a styling hook). A tile with zero connected-and-visited
neighbors instead gets the small centered worn-dot fragment described
above (same wear-scaling, same trail color lookup, just no connector
arms since there's nothing to reach toward yet) — so every visited tile
always renders *something*, but it's always part of the same trail-
fragment system, never a whole-tile background change.

## Data model

`state.visited[screenId][x,y]`: was `true`, now a `number` (walk count).
`markVisited`/`isVisited`/`getVisitCount` (`js/systems/exploration.js`)
are the only code that reads or writes this shape — no other file
touches `state.visited` directly (confirmed via grep). No explicit save
migration: `getVisitCount` normalizes a legacy `true` to `1` on read,
and every write from then on stores a real number.

## Wiring changes

- **Modify:** `js/systems/exploration.js` — `markVisited` increments
  instead of setting `true`; new export `getVisitCount`; `isVisited`
  reimplemented in terms of it (same signature/behavior).
- **Modify:** `js/screens/mapScreen.js` — `render()` gains the
  per-tile trail-fragment step (edge lookup via `tileAt`, jitter via
  `hash01`, wear fraction via `getVisitCount`), appended before the
  existing branch chain for each cell; the neighbor-connectivity check
  treats any `FULL_SQUARE_MARKERS` tile as connected/visited.
- **New (small, inline in `mapScreen.js` or a new module if it grows
  past a couple dozen lines):** `TRAIL_COLOR_BY_TILE` lookup,
  `TRAIL_WEAR_CAP`, `trailWearFraction`, `edgeJitter`.
- **Modify:** `js/maps/wilderness/center.js` — `startPosition` moves
  from `{x:15,y:11}` to `{x:14,y:11}` (orthogonally adjacent to the
  town-entrance tile instead of diagonal to it).
- **Modify:** `css/styles.css` — delete `.map-tile.visited`,
  `.map-tile.map-tile-grass.visited`, `.map-tile.map-tile-water.visited`.
- **Modify:** `js/screens/mapScreen.js` — `render()`'s cell `className`
  build stops appending `' visited'` (dead weight once its only CSS
  effect is gone).
- **No change:** `tryMove`/`mount` call sites of `markVisited` (same
  call shape, new behavior under the hood), any other consumer of
  `isVisited`.

## Testing

- `exploration.test.js`: extend for the counter behavior —
  `markVisited` called twice on the same tile increments to 2 (not
  just staying `true`); `getVisitCount` returns 0 for never-visited,
  correct count for visited; `getVisitCount`/`isVisited` treat a
  legacy `true` value as count 1 (construct a `visited` object with a
  raw `true` by hand, don't go through `markVisited`, to simulate an
  old save's shape).
- New `trailRendering.test.js` (or similar), testing the pure pieces
  independent of DOM: `edgeJitter(x, y, axis)` returns the same value
  regardless of which of the two adjacent tiles' perspective it's
  computed from (i.e. the function contract itself, called with the
  canonical lower-coordinate tile, is what both sides must use —
  covers the "seams line up" requirement at the logic level even
  though the actual DOM seam can only be eyeballed); `trailWearFraction`
  clamps correctly at and beyond the cap (0, 1, 10, 15 all produce
  fractions in `[0,1]`, 10 and 15 both yield exactly 1).
- `maps.test.js` or `state.test.js`: extend/add an assertion that
  `center.js`'s `startPosition` is orthogonally adjacent (not diagonal)
  to its `townEntrance` tile, so a future map edit that moves either one
  fails loudly instead of silently reintroducing the diagonal gap.
- No DOM/rendering test coverage is possible for the actual visual
  result (no jsdom in this repo, same limitation noted in the CHANGELOG
  for the parry-timing fix) — manual verification in-browser is
  required: walk a corner, a straight stretch, and a revisited/
  backtracked stretch on a real screen and confirm the trail reads as
  connected and directional (matching the approved mockup); confirm an
  unvisited tile stays fully natural-colored (no tint at all); confirm
  exiting town shows the trail already connected to the gate on the very
  first frame (no isolated dot); confirm the isolated worn dot still
  shows correctly on a genuinely disconnected landing tile — the
  easiest real trigger is an edge transition onto a *fresh* neighboring
  wilderness screen away from any entrance, since that landing tile has
  no visited neighbors on that screen yet either; confirm wear visibly
  increases after re-walking the same tile several times up to the
  10-visit cap, and confirm an existing (pre-this-change) save still
  renders its already-visited tiles correctly (legacy `true` values
  read as count 1) without any explicit migration step.
