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

### Connectivity: tracked per-edge, not inferred from neighbor state

**Superseded 2026-08-26 — see below for what actually ships.** The
original design (kept here for the record) inferred connectivity from
neighbor adjacency: at render time, a tile connected toward any
neighbor that was *also* visited, on the reasoning that "both neighbors
visited" and "you actually stepped directly between them" coincide in
essentially every real case, with a rare exception dismissed as
harmless. Live play proved that reasoning wrong: walking two parallel
corridors one tile apart made *every* column between them look
connected — a "ladder" of false rungs where the player never once
stepped sideways — and the same false-positive pattern showed up
constantly, not rarely, any time exploration doubled back near itself.
Timothy: "I only want where you walk to have a path... if you walk
north to a tile and then west you should only get a north path in that
tile half way and then a west path half way."

**What ships instead:** track, per tile, the literal set of edges
(`n`/`s`/`e`/`w`) the player has ever actually crossed there — no
inference, no neighbor lookup for connectivity at all. `state.visited`'s
per-tile entry becomes `{ count, dirs }` (see Data model below). A
single move updates both tiles it touches, symmetrically: the tile being
left gets the direction moved added to its own `dirs` (its exit edge),
and the tile being entered gets the *opposite* direction added to its
`dirs` (the edge it was entered through) — see `markVisited`/
`markDirection` in `js/systems/exploration.js` and their call sites in
`tryMove` (`js/screens/mapScreen.js`). Walking north then west produces
exactly the worked example above: the first tile gets `n` only, the
second gets `s` (entered from below) and `w` (left westward), the third
gets `e` (entered from the east) — because unlock order and array order
already happen to match, nothing about *which* edges get marked depends
on inferring anything from a neighbor.

Render-time connectivity is now trivial: a tile's connected directions
are just its own `dirs`, read directly (`getVisitDirs`). No
`isTrailConnected`/neighbor-inspection function exists anymore.

**The old entrance-anchor special case is gone, not replaced.** The
original design needed an explicit "landmark tiles always count as
connected" override because inferred connectivity had no other way to
handle the town gate reading as isolated right after exiting town. Under
per-edge tracking, that need disappears on its own: any tile — landmark
or not — only ever gets a `dirs` entry because the player actually
crossed that specific edge, at which point the tile on the other side of
that same move necessarily already has (or just gained) a real walk
count of its own. There's nothing left to special-case.

**The town-gate landing tile itself is a deliberate, explicitly-decided
exception to "always connects to the gate."** `exitMap` teleports the
player to `startPosition` — there's no directional keypress to record
for that specific transition, so that tile shows an isolated dot until
the player's first real step, exactly like landing on any other fresh
screen. Discussed directly with Timothy and decided in favor of strict
consistency ("keep the dot") over synthesizing a fake direction just to
preserve the old immediate-connection visual.

`center.js`'s wilderness `startPosition` (`{x: 15, y: 11}` originally,
where the player lands after `exitMap` from town) still moved to
`{x: 14, y: 11}` as part of the original work, and that nudge is still
worth keeping even though it's no longer load-bearing for an *immediate*
connection: it means the tile the player lands on is genuinely
orthogonally adjacent to the gate, so a player who takes their very
first step toward town connects to it in one move instead of needing a
detour first (the original diagonal placement made that literally
impossible in a single step, since movement — and now connectivity — is
4-directional only). This was checked only for the town/`center` case
Timothy raised; dungeon and tool-dungeon entrance landing positions
weren't audited for the same diagonal-offset issue.

**Backward compatibility carries over unchanged in spirit:** a shared
`normalizeEntry()` helper in `exploration.js` reads all three shapes a
saved entry has ever had — legacy `true`, the plain-number walk-count
format, and the current `{ count, dirs }` object — normalizing the first
two to `dirs: []`. An existing save's tiles all render as isolated dots
again until walked over post-upgrade, same graceful-degrade approach as
the original `true → 1` shim, still with no explicit migration step.

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

Used for stroke width, e.g. `10 + 8 * fraction` (in the same
`cqb`-relative sizing units the rest of `render()` already uses for
obstacles/markers) — **superseded 2026-08-26**, see below: width is no
longer purely this tile's own fraction, and wear is no longer
represented as opacity at all.

**Width, superseded:** a stroke's width is now the average of both
endpoints' fractions (`trailStrokeWidthBetween`), not just this tile's
own — symmetric, so the two tiles sharing an edge always compute the
same width for their half of that connection. The original design
deliberately used only this tile's own count so "a heavily-walked
stretch near town can read as more worn than a lightly-walked stretch
further out" — that intent is preserved (still no averaging for
*color*, still no cross-tile smoothing beyond one shared edge), but pure
per-tile width produced a visible hard step at a border between very
differently-worn tiles, reported live ("the thickness doesn't flow into
the thinner other line").

**Opacity, removed entirely:** the original design used
`0.25 + 0.55 * fraction` for stroke opacity, living as one flat
`<svg>`-level value per tile (needed to stop overlapping connector arms
at a junction's center from alpha-stacking into a dark blob — see
Rendering above). That flat-per-tile constraint turned out to make a
second, real bug possible: two tiles sharing an edge could have
gradient stop-colors that matched exactly, while rendering at very
different opacity (confirmed live against real save data — a tile
visited 38 times next to one visited once, 0.8 opacity meeting 0.305),
producing a hard seam since the low-opacity side blends into the grass
underneath and visibly shifts hue. Wear is now baked entirely into
color instead: `trailColorForFraction` blends between the tile's own
ground color (`getGroundColor` — the same hex each terrain's own
`.map-tile-*` CSS background already uses) at fraction 0 and the full
trail color at fraction 1. Every stroke is fully opaque; overlapping
ones at a center simply paint over each other with no compositing
artifact, sidestepping the original alpha-stacking problem without
needing a flat group-level value at all.

The isolated-tile worn dot (no connected neighbors — see Scope) uses
the same `trailWearFraction` off the same tile's count, sized as a
small centered circle instead of an edge-reaching stroke (radius
`6 + 6 * fraction` cqb-relative units), filled with
`trailColorForFraction` the same way a stroke's endpoint is. It
automatically upgrades to full connector strokes the moment a direction
is actually crossed — no separate state to track, since a tile's
connected directions are re-read fresh (`getVisitDirs`) every `render()`
call the same as everything else here.

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

`state.visited[screenId][x,y]` has taken three shapes over time, oldest
first: `true` (a boolean set), a plain `number` (walk count only — the
shape this feature originally shipped with), and now (2026-08-26)
`{ count, dirs }`, where `dirs` is the array of edges (`n`/`s`/`e`/`w`)
actually crossed at that tile — see the superseded-connectivity
discussion above. `markVisited`/`markDirection`/`isVisited`/
`getVisitCount`/`getVisitDirs` (`js/systems/exploration.js`) are the
only code that reads or writes this shape — no other file touches
`state.visited` directly (confirmed via grep). No explicit save
migration for either transition: a shared `normalizeEntry()` helper
reads all three legacy/current shapes into `{ count, dirs }`, and every
write from then on stores the current shape.

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
