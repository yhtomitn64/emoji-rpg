# Town Exits, Expansion, and Signage — Design

## Purpose

Raised 2026-08-28 (`docs/superpowers/BACKLOG.md`, "Multi-zone
progression" section), Timothy's own words: "Door of town should be at
the bottom of town or not even a door just a break in the trees in the
south of town. Also can we expand town a bit and have a signpost or
something or a label above each shop type or feature in town. Also when
you exit town then you should appear in the map below the town if exit
in south and for future towns maybe you can exit in multiple
directions. Actually in first town let's have an exit in all directions
and that's the direction you appear on the map."

Four asks bundled together, all in scope for this one build per
Timothy's explicit call (2026-09-03) to do them together rather than
split into follow-on passes:

1. Replace the single `🚪` door tile with an unmarked gap in the tree
   wall — no door icon at all.
2. Four exits instead of one, one centered on each of town's 4 border
   walls.
3. Each exit lands the player just outside town in the matching
   direction, not always at the same spot.
4. Town gets a bit bigger, and every shop/feature gets a visible,
   always-on wooden signpost naming it — settled via a visual
   brainstorming pass (mockups in `.superpowers/brainstorm/`), Timothy
   picked the signpost style over a speech-bubble tag, floating text,
   and a HUD-style badge, and picked always-on labels over
   proximity-fade.

## Scope

In scope:
- `js/maps/townMap.js`: grow the tile grid from 16×12 to roughly 20×14;
  drop the single `E`/`exit` legend entry; add 4 new legend entries, one
  per direction, each centered on its wall.
- `js/tiles.js`: replace the `exit` tile kind *for town* with 4 new tile
  kinds (`treeGapNorth`/`South`/`East`/`West`) — walkable, no emoji,
  each with its own explicit `action` (`exitTownNorth` etc.), following
  the existing per-thing-named-action convention
  (`enterAxeDungeon`/`enterPickDungeon`/etc.) rather than inferring
  direction from tile position at runtime. `exit` itself is untouched
  and stays in use for dungeon/tool-dungeon doors — this only removes
  it from town's own legend.
- `js/main.js`'s `handleTileAction`: 4 new action branches, each calling
  `enterMap('center', <1 tile out from `@` in that direction>)`.
- `js/screens/mapScreen.js`: add the 4 new tile kinds to
  `GRASS_CONTEXT_MARKERS` (same grass-background treatment `exit`
  already gets today) so a gap reads as open ground, not a distinct
  object; add a small always-on signpost overlay for town's 4 existing
  labeled tile kinds (`shop`, `smith`, `questBoard`, `well`).
- `css/styles.css`: a `.map-tile-signpost` style (wooden plank + short
  post, matching the approved mockup) plus whatever supporting classes
  the render code needs.
- Re-placing `TOWN_PORTAL_POSITION` (`js/main.js`) if the resize moves
  its current spot (`{x:7,y:4}`) off open ground — verify after the
  resize, adjust only if needed.

Out of scope (unrelated open backlog items, not touched here):
- Any *other* town beyond town 1 — this doesn't build a general
  per-town exit config; a second town repeats this same pattern by hand
  when it's built.
- Town NPC hints, landmark naming — separate backlog entry.
- Any wilderness-side (`center` map) tile edits — verified below that
  none are needed.

## Mechanics

### Exit tiles and legend

Town's `LEGEND` drops `E: 'exit'` and gains 4 lowercase direction keys
(chosen to avoid clashing with the existing uppercase building letters:
`S` shop, `M` smith, `Q` questBoard, `W` well):

```js
const LEGEND = {
  '.': 'grass', '#': 'tree', S: 'shop', M: 'smith', Q: 'questBoard', W: 'well',
  n: 'treeGapNorth', s: 'treeGapSouth', e: 'treeGapEast', w: 'treeGapWest',
};
```

Each of the 4 new `TILES` entries:

```js
treeGapNorth: { emoji: '', walkable: true, encounter: false, action: 'exitTownNorth', description: 'A break in the trees' },
// ...South/East/West identical apart from the action name
```

`emoji: ''` is falsy, so `mapScreen.js`'s existing render branch
(`else if (emoji) { cell.append(emoji); }`) simply renders nothing —
same technique water's blank variant already uses to let a solid
background color show through uninterrupted. Adding all 4 to
`GRASS_CONTEXT_MARKERS` gives them the `.map-tile-grass` background
class so the gap reads as a continuation of the interior floor set
against the tree-wall border, not a distinct marked object.

Each gap sits at the horizontal/vertical center of its wall in the new
20×14 grid — row 0 for north, row 13 for south, column 0 for west,
column 19 for east — replacing one `#` in that row/column with the
matching lowercase legend character.

### Routing

`handleTileAction` in `js/main.js` gains 4 branches alongside the
existing dungeon/tool-dungeon ones:

```js
if (action === 'exitTownNorth') return enterMap('center', { x: TOWN_ENTRANCE.x, y: TOWN_ENTRANCE.y - 1 });
if (action === 'exitTownSouth') return enterMap('center', { x: TOWN_ENTRANCE.x, y: TOWN_ENTRANCE.y + 1 });
if (action === 'exitTownEast') return enterMap('center', { x: TOWN_ENTRANCE.x + 1, y: TOWN_ENTRANCE.y });
if (action === 'exitTownWest') return enterMap('center', { x: TOWN_ENTRANCE.x - 1, y: TOWN_ENTRANCE.y });
```

`TOWN_ENTRANCE` is a new constant (no equivalent exists today — the
`@` tile's position currently only lives implicitly inside `center.js`'s
`ROWS` string data), holding the `@` tile's fixed position on `center`
(`{x:14, y:12}` today), analogous to how `TOWN_PORTAL_POSITION`
(`js/systems/portal.js`) already holds a different fixed town-side
point as a named constant. This is the same landing town's single exit
already does — today's only exit lands at `center`'s `startPosition`
`{x:14,y:11}`, exactly 1 tile north of `@` — generalized to all 4
sides. Verified directly against `js/maps/wilderness/center.js`'s
`ROWS`: the tile 1 step north, south, east, and west of `@` is open
grass in every direction, so no edits are needed on the `center` side
for this to work. No new per-direction routing table or per-town config
is introduced — town has exactly one link to the wilderness (the `@`
point), and all 4 exits key off that same point. A second town would
need its own equivalent constant, hand-set the same way.

This was an explicit, deliberate simplification (Timothy, 2026-09-03):
"we should be... enforcing the placement of anything you can exit with
space around it for the character to land... town with 4 holes in the
map and you can leave any of them and exit on the side of the town the
hole is." Verifying today's terrain satisfies this is a one-time manual
check, not an enforced validation rule — town's position essentially
never changes once placed, so no new "Check Map" tooling is being added
for this (his own call, weighed against building a general invariant
check).

### Town resize

`ROWS` grows from 16×12 to roughly 20×14 — enough room for the 4
wall-gaps plus breathing room around the existing 4 features (shop,
smith, quest board, well) and the player's own starting position. Exact
tile-by-tile layout is a content/hand-editing task, not a design
decision — same as the 8×6→16×12 resize that already happened once
(see the comment already in `townMap.js`), Timothy can hand-tune the
final shape afterward.

### Signposts

A new small lookup, colocated with the render code in
`mapScreen.js`:

```js
const SIGN_LABEL_BY_TILE = new Map([
  [TILES.shop, 'Shop'],
  [TILES.smith, 'Blacksmith'],
  [TILES.questBoard, 'Quest Board'],
  [TILES.well, 'Well'],
]);
```

In the same per-cell render loop that already appends decorations,
mounts, and full-size markers, a tile with an entry in this map gets an
extra absolutely-positioned child appended above its emoji: a small
wooden-plank label (`.map-tile-signpost`) reading the mapped text,
always rendered — no proximity/fade logic, per the approved mockup.
Because `SIGN_LABEL_BY_TILE` is keyed by tile identity and these 4 tile
kinds only ever appear in `townMap.js`'s own legend, this is inherently
town-only without needing to gate on `mapConfig.id === 'town'`
explicitly.

Visual reference: the approved mockup in
`.superpowers/brainstorm/97357-1788458904/content/town-layout.html`
(option A, "all signs always on") — a brown plank with cream text over
a short dark post, sized to sit above the tile's emoji without
overlapping the row above.

## Testing

- `tests/maps.test.js` — town's legend/tile-grid shape: 4 new gap
  tiles present, walkable, correctly positioned at the center of each
  wall; old `exit`/`E` entry gone from town specifically (still present
  for dungeon maps).
- `tests/mapScreenDom.test.js` — walking onto each of the 4 gap tiles
  triggers its own `exitTownX` action and lands at the expected
  `center` position; signposts render (and only render) on the 4
  labeled town tile kinds; `.map-tile-grass` background class applies
  to the gap tiles.
- `tests/worldGrid.test.js` — confirm no `center`-side changes broke
  existing wilderness edge-transition behavior.
- `tests/portal.test.js` — `TOWN_PORTAL_POSITION` still lands on open,
  walkable ground after the resize.

## Follow-ups (explicitly not resolved by this build)

- A second town will need its own `TOWN_ENTRANCE`-equivalent constant
  and its own 4 gap placements — not generalized into reusable config
  here, per Timothy's own "don't over-engineer this" steer.
- Town NPC hints/landmarks (separate backlog entry) are a natural next
  layer on top of signage but not part of this build.
