# Backlog — Shipped Archive

Everything from [BACKLOG.md](BACKLOG.md) that's already shipped, split
out 2026-08-28 to keep the open list short and skimmable. Organized
under the same section headers as the original, in the same order, so
history is easy to find. Historical record only — not prioritized,
nothing here needs action. See `CHANGELOG.md` for the actual code-level
detail behind most of these.

## Pacing / progression

### ~~Fun animation for items landing in inventory~~ Shipped 2026-08-22
Went with the toast/pop alternative flagged below, not a literal
cross-screen flight path (still not feasible — no live item-icon
starting position exists at the trigger point). See CHANGELOG. Scoped
to battle drops via `grantDropItem` only — cache/treasure/quest-reward
pickups don't get the toast, that wasn't part of what was asked.

## ~~Zone 1 map expansion + organic terrain~~ **All three pieces shipped — mechanics 2026-08-24, hand-painted terrain by 2026-08-25 (commit `8615045`, touched up in `b721864`).**

Raised 2026-08-23, distinct from Multi-zone progression — this was
about the *existing* single zone getting physically bigger and more
detailed, not about zones 2/3/4 having different mechanics.

Timothy's own words: "I'm thinking we should expand the zone 1 map to be 1
whole square larger. So the town is 1 square then we have a 9x9 grid so a
5x5 grid. Dragon cave goes in the new area. Also the mountains, lakes,
woods or whatever need to all be more interesting. Not just square/rectangle
but interesting patterns and things and also can the water connect so it's
not a bunch of squares but actual connected water?"

Three related pieces, all shipped:
- ~~**Grow the wilderness grid from 3x3 (9 screens) to 5x5 (25 screens).**~~
  **Shipped 2026-08-24.** Town stays its own separate interior map,
  unaffected — this was purely about the wilderness ring. The existing
  topology generalized cleanly: each wilderness map already defined its own
  `neighbors: { north, south, east, west }` object (`js/maps/wilderness/
  *.js`), looked up generically in `mapScreen.js`/`handleEdgeTransition`
  (`js/main.js`) — not hardcoded to a 3x3 assumption, so the *mechanism*
  generalized. 16 new screen map files were added with correct `neighbors`
  wiring across the whole new grid; all 16 reuse the existing far-corner
  monster tier (`['direWolf','spider','scorpion']`, 0.15 encounter chance)
  rather than getting their own tier or a spatial difficulty gradient —
  that idea is still open, tracked under "spatial difficulty gradient" in
  Multi-zone progression (see BACKLOG.md). See CHANGELOG.
- ~~**Move the dragon's dungeon into the new outer ring.**~~ **Shipped
  2026-08-24.** The dungeon entrance eligibility (`js/systems/
  dungeonEntrance.js`, `CORNER_SCREEN_IDS`) moved from the old 3x3 grid's
  4 corner screens to the new 5x5 grid's 4 far-corner screens
  (`farNortheast`/`farNorthwest`/`farSoutheast`/`farSouthwest`), so it
  stays at the true edge of the expanded world. See CHANGELOG.
- ~~**More organic terrain, especially connected water — and terrain
  features should be able to span across screens.**~~ **Shipped.** All 25
  wilderness screens (`js/maps/wilderness/*.js`) now carry hand-painted
  mountains/lakes/woods instead of the old rectangular blocks, painted
  using `tools/terrain-painter/`'s continuous-canvas view so shapes
  (including water) connect coherently across screen boundaries by
  construction — confirmed directly in the map files, not just via the
  tool. The cross-screen-continuity *test coverage* gap this entry
  originally flagged (`tests/maps.test.js` checks border walkability and
  neighbor-link symmetry, but nothing asserts a terrain feature's edge
  tiles actually line up with the matching tiles on the neighboring
  screen) was never specifically closed — worth a follow-up test if a
  seam-at-the-border bug ever turns up here, but not blocking since the
  painting is already done and visually verified.

## Multi-zone progression

### ~~Guaranteed-drop "tool dungeons," separate from the existing random mini-dungeon treasure system~~ Mechanic and placement UI shipped 2026-08-24
Hand-placed, fixed-position mini-dungeons whose guardian guarantees a
specific tool drop (axe and pick so far, expandable), distinct from
and not replacing the existing per-step random mini-dungeon reveal +
6-item shared treasure pool (`js/systems/miniDungeons.js`), which was
left untouched as asked. Shipped: `js/data/toolDungeons.js`
(`TOOL_DUNGEON_ENTRANCES`, config-level fixed positions, parallel to
`DEFAULT_DUNGEON_ENTRANCE_POSITION`), two new interior maps
(`js/maps/toolDungeons/`), `axeGuardian`/`pickGuardian` monsters with a
`forceFullBattle` flag (chance-1 drop, deliberately not `isBoss` - see
commit for why), and the terrain painter's "Place Tool Dungeon
Entrance" mode with a reward dropdown. Verified end-to-end in the
running game. (The staged/tool-sequence-aware reachability checker this
depends on is still open — see BACKLOG.md.)

### ~~Randomize the dungeon entrance's location per new character. Shipped 2026-08-18.~~
New saves now roll `state.dungeonEntrancePosition` once
at creation among the 4 corner screens' grass tiles
(`js/systems/dungeonEntrance.js`); the old hardcoded southeast `D`
tile is gone. Legacy saves backfill to the historical southeast
(24,10) spot unchanged. Design:
`docs/superpowers/specs/2026-08-18-randomized-dungeon-entrance-design.md`.
Plan: `docs/superpowers/plans/2026-08-18-randomized-dungeon-entrance.md`.
First piece of the larger multi-zone-progression idea to ship — the
per-save placement pattern established here is reusable if/when new
zones get built.

### ~~Smaller, sooner: a dragon-zone (dungeon) shortcut using the axe, and better tool-drop flavor~~ Already shipped 2026-08-17, backlog just never updated
Discovered 2026-08-23 while working this list top to bottom: both pieces
were already live, `git log` just never got a corresponding strikethrough
here. No new work was needed.

- **Dungeon shortcut**: commit `02ff847` ("add axe-gated thicket shortcut
  in the dungeon") — column 15 was a solid wall from row 3-8 in
  `js/maps/dungeonMap.js`, forcing a loop back through the top rows; a
  single tile at (15,7) is now a thicket, connecting the interior
  corridor straight into the boss corridor for anyone holding the axe.
- **Tool-drop pickup moment**: commit `d7ac975` ("flavor banner on
  tool-gate clear, celebration on first tool pickup") — `grantDropItem`
  (`js/main.js`) already gives a first-time `playCelebration` naming the
  tool and its `description` (e.g. "Clears thicket gates blocking the
  way") the moment you first pick one up; any repeat drop is a quiet
  ordinary toast instead.
- The separate "flavor text near a tool-gated tile" ask (a related but
  distinct item under Feature requests) was already independently
  marked shipped 2026-08-22.

## ~~Terrain painter: small UX polish items~~ All three shipped 2026-08-26

Raised 2026-08-24 while Timothy was actively painting. Small, independent
fixes - not a design pass, just a punch list.

- ~~**Page scroll fights with painting near the canvas edges.**~~ **Shipped.**
  Timothy's words: "disable scroll while drawing on the map? It keeps
  moving around driving me nuts." Root cause: trackpad two-finger scroll
  fires as a `wheel` event on desktop Chrome/Firefox (not a touch event),
  so `touch-action` alone doesn't stop it - it scrolls the page mid-stroke,
  shifting the canvas under the cursor. Fixed with a non-passive `wheel`
  listener on the canvas that calls `preventDefault()` only while a stroke
  is actively in progress (`painting === true`), so scrolling to see the
  rest of the map still works normally between strokes. `touch-action: none`
  also added to the canvas defensively for actual touchscreen input.
  Verified via a real `WheelEvent` dispatch: default scroll behavior
  allowed when idle, prevented mid-stroke.
- ~~**No indicator of the brush's shape/size before you click.**~~
  **Shipped.** "I keep making bigger shapes by accident." Hovering the
  canvas (when not actively painting) now draws a translucent white
  outline over exactly the cells the current `brushSize`/`brushShape`
  would paint - shares the same cell-offset calculation (`brushCells`)
  the actual paint stroke uses, so the preview can't drift out of sync
  with what a click does. Verified in-browser at brush sizes 1 and 5, both
  square and circle shapes - preview shape matched the brush exactly, and
  disappears while a stroke is active or the cursor leaves the canvas.
- ~~**Keyboard shortcuts to bump brush size up/down**~~ **Shipped**
  (`[`/`]`), raised alongside the hover-indicator ask, same underlying
  complaint - wants faster/more precise control over accidentally-large
  strokes. Clamped to the same 1-15 range as the brush-size slider, and
  keeps the slider/label in sync. Verified via dispatched keydown events:
  clamps correctly at both ends.

## ~~Character/tree layering + a real worn-path trail effect~~ All three shipped 2026-08-26

Raised 2026-08-25, right after the "non-moving obstacles render
full-square with randomized overlap" pass shipped
(`js/screens/mapScreen.js`, `css/styles.css` - commits `41ce69c`/
`5bd0452`/`0de74f9`). Three related layering/rendering issues Timothy
wanted to brainstorm together next session - the two bugs below turned
out simple enough to just fix directly instead, and the worn-path idea
(design session, SDD build, then several rounds of live-play polish -
see the two "Shipped"/"fix:" entries in CHANGELOG.md) is now done too.

### ~~Bug: the hero disappears behind a grass decoration (clover/flower)~~ Fixed 2026-08-25

Went with the layered version Timothy wanted to look at first, not the
simpler branch-order fallback: `render()` in `js/screens/mapScreen.js`
now appends the decoration span (when the tile has one) *and* the hero/
landmark marker span into the same cell, decoration first so it paints
underneath and still peeks out from behind the hero instead of being
suppressed outright. Verified in-browser: standing on a decorated grass
tile now shows both, hero on top.

### ~~Character vs. tall-tree overlap: wrong depth order~~ Fixed 2026-08-25

Replaced the fixed `.map-tile-player { z-index: 10 }` override (which
always painted the hero over everything, including a tree canopy
overlapping up from the row below) with real per-row depth sorting:
`render()` now sets every `.map-tile` cell's `z-index` to its own row
index, so a row's content always paints above the row directly north of
it - a general rule, not hero-specific, matching normal top-down 2.5D
depth conventions. A tall tree in the row below the hero now correctly
overlaps in front of him. Verified in-browser via a scripted DOM
inspection (found a live tree-below-player case, confirmed z-index
ordering and visual paint order) plus a zoomed screenshot showing the
tree tip rendering over the character's torso.

### ~~Idea: a real worn-path/trail effect instead of a flat visited tint~~ Fixed 2026-08-25

Shipped as the worn-path trail effect: `state.visited` became a walk-
count per tile instead of a boolean, and `js/systems/trail.js` +
`js/screens/mapScreen.js` now render a wear-scaled, directionally-
connected dirt-trail stroke per tile (or a small dot if isolated)
instead of the old flat tint, with trail color keyed by terrain
(grass/cave floor/water) and landmark tiles acting as an implicit
connected anchor so the trail visibly emerges from town's gate. See
`docs/superpowers/specs/2026-08-25-worn-path-trail-design.md` and
`docs/superpowers/plans/2026-08-25-worn-path-trail.md` for the full
design/plan.

## ~~Strip emoji background boxes so the tile color shows through~~ Shipped 2026-08-26

Raised 2026-08-26, mid worn-path-trail polish. Timothy's example: the
house/town-entrance emoji currently renders with its own baked-in
square-ish background tint (visible as a dark box around it) instead of
sitting directly on the tile's actual color. His ask: remove that
per-emoji background so whatever's actually underneath (grass green,
dirt trail, water blue, etc.) shows through around the glyph, the same
way a plain text emoji already does elsewhere.

Not an emoji-rendering issue after all: the dark box was `.map-tile`'s
own bare default background (`#333`) showing through, because these
landmark tiles (shop, smith, quest board, well, exit, town/dungeon
entrances) are each their own distinct tile type in a map's `ROWS` grid
and never matched the `tile === TILES.grass` check that gives obstacles
their green background. Fixed by adding a `GRASS_CONTEXT_MARKERS` set in
`js/screens/mapScreen.js` for the subset of landmarks that always sit on
a grass floor - see CHANGELOG. Same session, Timothy also caught tree
canopies bleeding past the map's own border at the top row/outer
columns (no neighboring row to absorb the overlap into there) - fixed
alongside this with `overflow: hidden` on `.map-grid`.

## ~~Terrain visuals: mountains feel small and don't sit in the world~~ Shipped 2026-08-28

Timothy: "Mountains look small. The ones you can never pass and no
background under them. Maybe they just sit on the green so they match."
Confirmed: "the ones you can never pass" is `mountainWall` specifically
(no tool ever clears it, unlike `mountain`/`mountainCache` which already
had the sizing/background treatment from earlier work) - and it turned
out `RANDOM_SIZE_OBSTACLES` (`js/screens/mapScreen.js`) excluded it on a
now-wrong assumption ("it's the auto-sealed world-edge marker, not
painted terrain"): 10 wilderness screens actually paint it directly as
real interior terrain via their own map `LEGEND`
(e.g. `js/maps/wilderness/south.js`'s `'W'`). Added `TILES.mountainWall`
to `RANDOM_SIZE_OBSTACLES`, which gets it both fixes in one move - full
obstacle sizing (100-150% of a tile, same as trees/mountain/thicket) and
the grass-matched background, since that same Set already gates both via
the existing `map-tile-grass` OR-condition (no separate background-only
list needed, unlike the landmark case `GRASS_CONTEXT_MARKERS` handled).
Applies uniformly to both painted-interior mountainWall and the
auto-sealed true-world-edge cells, since both render the same tile
object.

## Bugs

### ~~HUD's HP readout doesn't update during battle~~ Shipped 2026-08-28
Timothy: "my HP in the main game window with the map doesn't update while
in battle and I think it should becaause I look up there sometimes." The
persistent top HUD (`#hud`, a sibling of `#app`/`#overlay` - still fully
visible, just with its buttons disabled, while a battle overlay is open on
top) reads `state.player.hp` directly, but that only ever got synced from
the battle's own live `playerCombatant.hp` once at `endBattle()` - for the
whole fight before that, the HUD showed whatever HP the player had at the
moment the battle started. Fixed at `updateHpBars()`
(`js/screens/battleScreen.js`), the single function already called after
every player-HP-changing event in battle (hits taken, lifesteal, delayed
Slash damage, potions): it now also syncs `state.player.hp` and fires a new
`callbacks.onHpChange` the HUD wires to `renderHud` (`js/main.js`).
Deliberately no `persist()` call added here - a hit lands far more often
than the game otherwise writes to localStorage (attack-spam can be
sub-second), and mid-battle HP was never guaranteed durable across a reload
anyway; only the visible readout needed to stop lying.

### ~~Tool-dungeon guardian drops undermine the "no chance, find it" design intent~~ Shipped 2026-08-28
Timothy: "I just got the axe dropped by a slippery breakstick and I want
the axe/pick/canoe to only come from the special place I put on the map
behind a special boss. It shouldn't be chance. the gamer has to figure
out where to go!" Confirmed in code: alongside the guaranteed
`axeGuardian` drop (`js/data/monsters.js:77`, `chance: 1`, behind its own
gated dungeon), the regular wraith encounter (Ghost Apple Supreme) also
carried a stray `{ itemId: 'axe', chance: 0.25 }` in its own dropTable —
a leftover chance-based path that directly contradicted the tool-gating
design's whole point (see
`docs/superpowers/specs/2026-08-16-metroidvania-tool-gating-design.md`).
Both removed. The original investigation's claim that "no stray
`pick`/`boat` chance-drops [existed] elsewhere" turned out to be a false
negative — it grepped for the literal string `'pick'`, which doesn't
match `'miningPick'`, so it missed an identical stray
`{ itemId: 'miningPick', chance: 0.25 }` on the orc (Super Mean
Meatloaf). Fixed alongside the wraith one; a new test
(`tests/data.test.js`) now asserts no non-guardian monster carries any
tool-type drop at all, so this class of regression can't come back
silently. See CHANGELOG.

### ~~Re-entering a mini-dungeon that blocks the only path forward is clunky~~ Shipped 2026-08-28
Timothy: "a mini dungeon appears in a path where I could not go around
it which feels clunky because when you go over it you have to go back
in and then when you come back you have to go in again and right back
out." Confirmed: mini-dungeon placement (`js/systems/miniDungeons.js`)
had no constraint at all against gating the *only* path across a screen —
any encounter-eligible tile could get one, chokepoint or not, and every
step onto it force-enters the interior with no way to just walk over it.
Fixed at the placement step rather than changing that force-enter
behavior (which is otherwise fine for a one-off find): a new pure,
DOM-free articulation-point check, `isChokepointTile`
(`js/systems/world.js`, unit tested directly in `tests/world.test.js`),
flood-fills the screen's currently-passable tiles with the candidate tile
blocked and reports whether that would disconnect anything — reusing the
same "live tool ownership counts as passable" notion the rest of movement
already uses. Wired through `js/screens/mapScreen.js`'s
`isScreenChokepoint` → `resolveStepDiscovery` →
`shouldRevealMiniDungeon`; a roll that would have placed an entrance on a
chokepoint now just falls through to a cache roll or nothing instead. See
CHANGELOG.

### ~~After clearing a tool-dungeon guardian, the player lands back outside the whole zone instead of at the entrance/shortcut~~ Shipped 2026-08-28
Timothy: "after I kill axe guardian and walked back out of that mini
forest zone the game placed me outside of the forst I was just in and I
didn't even get to use the new axe to get out of there. so it should
have placed me right back on the axe guardian entrance so I could use
the shortcut my new axe ability gave me." Confirmed: `enterMap`
(`js/main.js`) unconditionally set `state.position` to the destination
screen's generic `startPosition`, and the `exitMap` action handler
relied on that default for *both* the main dungeon and every
tool-dungeon exit — never the actual entrance coordinates the player
walked in through. `enterMap` now accepts an optional target position,
and `exitMap` passes `state.dungeonEntrancePosition`'s or
`TOOL_DUNGEON_ENTRANCES`'s own `{x, y}` instead of omitting it. Fixed
for the main dungeon exit too, since it shared the identical bug shape
even though only the tool-dungeon case was reported. See CHANGELOG.

## Feature requests

*(Everything originally in this section shipped 2026-08-17; see
CHANGELOG. One thing was dropped rather than shipped: swapping monster
emoji to match their silly food names — Timothy likes them as they are,
e.g. "Slippery Breadstick" for the snake. Not tracked anywhere; revisit
only if it comes up again for a future zone. Items below were raised
mid-combat-pass, later than that original batch.)*

### ~~Log out / back to title screen, to switch characters~~ Shipped 2026-08-22
A new HUD button unmounts back to `mountStartScreen()` behind a
confirmation overlay (`js/screens/logoutConfirmScreen.js`). See
CHANGELOG.

### ~~Boat tool to cross water, obtainable in zone 1 like the axe/pick~~ Shipped 2026-08-24

Went with the same-shape model as axe/mountain: `water` now carries
`requiresTool: 'boat'` (`js/tiles.js`) and clears permanently everywhere
once owned, via the existing live `hasRequiredTool` per-move check
(`js/systems/toolGates.js`) — resolving the one open design question
this entry raised. Drop source is a third tool dungeon (`canoeDungeon`,
`js/maps/toolDungeons/canoeDungeon.js`) guarded by `boatGuardian`
(`js/data/monsters.js`), same guaranteed-drop/`forceFullBattle` pattern
as the axe/pick guardians; entrance position tracked in
`TOOL_DUNGEON_ENTRANCES.canoe` (`js/data/toolDungeons.js`), gated behind
already having both axe and pick per Timothy's own map design (not
enforced in code). While riding it across water, the player's own emoji
renders layered on top of a canoe emoji (`js/screens/mapScreen.js`,
`MOUNT_EMOJI_FOR_TOOL`) rather than replacing it, per Timothy's
follow-up request.

### ~~Hero emoji picker needs way more options, including skin tones~~ Shipped 2026-08-22
Grew from 8 to 23 options plus a real skin-tone selector, only after
actually rendering every candidate base+modifier combo to confirm which
ones recolor (2 of the original 8 — fencer, zombie — turned out not to;
tone dropdown auto-disables for those, kept per Timothy's call rather
than dropping them). See CHANGELOG.

### ~~Shop: equip gear right after buying it, or offer to~~ Shipped 2026-08-22
Went with the opt-in prompt (Timothy's "even better" option), not
auto-equip — doesn't relitigate the deliberate no-auto-equip-on-pickup
call from `docs/superpowers/specs/2026-08-16-inventory-equipment-
design.md`. See CHANGELOG. Surfaced and fixed a real pre-existing bug
along the way: `getItemStatDelta` showed `enemySlowPercent NaN` against
any empty slot (also affected the Inventory screen's gear list before
this).

### ~~Splash/landing screen needs real visual polish, raised 2026-08-22~~ Shipped 2026-08-22
Timothy: "please add to our backlog a better splash page/landing screen
and also anytime you go back to the game it loads that screen so you can
select a different character. Also maybe put a bunch of the enemies, and
some sort of background and trees/mountains or something on the splash
page/loading screen. Basically if you hit refresh while playing game it
doesn't go right back to game it goes to loading screen." Two related
asks, both resolved:
- **Visual richness — shipped.** The start screen (`js/screens/
  startScreen.js`) now has a dusk-gradient background scene, a scatter of
  9 monster emoji (including the dragon) gently floating via CSS
  animation, and a tree/mountain emoji horizon — pure CSS/emoji, no image
  assets, same approach as the battle screen's existing gradient scenes.
  The save-slot panel is unchanged functionally, just restyled as a
  translucent card over the scene; decorative layer is `pointer-events:
  none`. Verified in-browser at desktop and narrow/mobile widths, plus
  through the New Game form flow — no click-through issues, no console
  errors.
- **Refresh always lands here — already true, confirmed not a bug.**
  `mountStartScreen()` runs unconditionally on every page load
  (`js/main.js`) with no auto-continue logic — `Continue` is a manual
  per-slot button click. No code change was needed for this half.

### ~~Fast-travel back to the dungeon entrance after death, for a gold cost~~ Shipped 2026-08-22
A loss now offers a choice (`js/screens/postDeathTravelScreen.js`):
free return to town, or warp straight to `state.dungeonEntrancePosition`
for `10 × level` gold. See CHANGELOG.

### ~~Flavor-text nudge near tool-gated tiles, raised 2026-08-20~~ Shipped 2026-08-22
Walking adjacent to a tool-gated tile now shows a one-time hint before
you ever bump into it (`js/systems/toolGates.js`'s `getGateProximityMessage`
+ `hasShownGateHint`/`markGateHintShown`). See CHANGELOG.

### ~~Choose which dragon strength to fight, raised 2026-08-20~~ Shipped 2026-08-22
The rematch prompt (`js/screens/bossPromptScreen.js`) now shows one
button per tier from 0 through the next uncleared tier, each labeled
with its HP multiplier and a ⭐ if already cleared, instead of a single
button that always auto-escalated. See CHANGELOG.

### ~~Fade out (don't just disable) the smith Upgrade button when you can't afford it~~ Shipped 2026-08-28
Timothy: "Fade out upgrade buttons if you can't afford/don't have
materials. Well if you don't have materials already works like that so
just do that for can't afford." The missing-materials case already
dimmed/disabled correctly; `js/screens/smithScreen.js` now also disables
the button when `state.player.gold < cost`, reusing the existing generic
`button:disabled` fade styling. See CHANGELOG.

### ~~An explicit "X" / close control on store and upgrade screens~~ Shipped 2026-08-28
Timothy: "Also include an X to leave stores/upgrade area because I keep
looking for an X and not just the leave button." Added a "✕" button in
the top-right corner, alongside (not replacing) the existing Leave
button, for `js/screens/shopScreen.js` and `js/screens/smithScreen.js`
(`css/styles.css`'s new `.screen-close-x`). See CHANGELOG.

### ~~More single-key shortcuts beyond Tab navigation~~ Shipped 2026-08-28
Timothy: "Full keyboard navigation I guess we already have it with tab
but what else could help like 'l' for leave or something?" Added a
single-key `l`/`L` shortcut to leave the screen on Shop, Smith, and the
Quest Board — the three screens with an existing Leave action. Skipped
while a `<select>` has focus (Smith's material picker) to avoid
hijacking the browser's own type-ahead select behavior. Each screen
gained real `pause`/`resume` lifecycle methods (matching
`js/screens/mapScreen.js`'s own pattern) so the shortcut doesn't also
fire while an unrelated HUD overlay (inventory, stats, etc.) is open on
top of it — caught by tracing `screenManager.js`'s `mountOverlay`, which
calls `pause()` (not `unmount()`) on the screen underneath. The Close-
labeled overlays (inventory/stats/message-log/loot-reference) weren't
touched — a different action semantically, not part of what was asked.
See CHANGELOG.

### ~~Chopping/mining a gated tile should leave a visible stump/rubble; canoeing across water shouldn't change the tile at all~~ Shipped 2026-08-28
Timothy: "Also when using axe, pick and walking into those blocks they
should get cut down and leave a stump or rubble or something. water
should not do anything from canoe. That just let's you canoe over."
Confirmed: clearing a tool-gated tile never mutated the map data at all
— `tileAt()` (`js/screens/mapScreen.js`) always re-derived the tile fresh
from the map's own `LEGEND`/`ROWS` every render, so thicket/mountain
stayed visually unchanged forever regardless of how many times crossed;
only a live `isPassableTile` check made it walkable. Two new walkable
tiles (`js/tiles.js`): `stump` 🪵 and `rubble` 🪨, same encounter odds as
grass. New `state.clearedGates` (`{screenId: {"x,y": true}}`, same shape
as the existing `gateRewards`/`toolGateHintsShown`) records which
specific tiles have been crossed; `isGateCleared`/`markGateCleared`
(`js/systems/toolGates.js`) read/write it, marked the moment
`onToolGateCleared` fires. `tileAt()` now swaps in the stump/rubble
replacement once a tile's been cleared, via a `CLEARED_GATE_REPLACEMENT`
map keyed by the *specific* tile object (thicket/thicketCache → stump,
mountain/mountainCache → rubble) — water is deliberately absent from
that map, so canoeing across it is untouched, exactly as asked. Cleared
tiles get the same grass background + always-visible-marker treatment as
grass's own decorative clover/flower, not the full obstacle-sizing
treatment (they're flat ground now, not a tall blocking obstacle).

## Quests / economy

### ~~Quest turn-in scaling: more kills required each level, rewards scale up but with diminishing returns~~ Shipped 2026-08-22
Each monster now has its own `questLevel` (starts at 1, uncapped);
requirement grows by 1 kill/level, reward quantity grows as
`1 + floor(log2(level))`. See CHANGELOG.

## Combat pass ideas

### ~~Potions currently cost a full turn like an attack.~~ Already shipped, backlog just never updated — caught 2026-08-28 while triaging small combat-pass items
`resolvePotionUse` (`js/systems/combat.js`)
returns no `playerAtb` field at all, and `playerUseItem()`
(`js/screens/battleScreen.js`) never touches `playerCombatant.atb` -
the Item button/`i` key are gated only on owning a potion
(`hasPotion`), not on `isReady()`. A potion has been off the shared
turn-cooldown for a while now; the original note's own cited line
numbers no longer matched the current file when this was caught.

### ~~Potions should be able to crit-heal occasionally.~~ Already shipped, backlog just never updated — caught 2026-08-28 alongside the item above
`resolvePotionUse` (`js/systems/combat.js`) rolls
`rollCrit`/`applyCritMultiplier`, the exact same crit system attacks
use, and `playerUseItem()` logs "Critical! You drink a potion..." on a
crit-heal. Covered by `tests/combat.test.js`'s "resolvePotionUse can
crit-heal, reusing the same crit system as attacks".

### ~~Themed attack animations per monster — projectile vs. melee.~~ Already shipped (commit `bb13e9d`, 2026-08-23), backlog just never updated — caught 2026-08-28
Every ranged monster has its own
food-themed `projectileEmoji` in `js/data/monsters.js` (Eight-Leg
Eggroll's 🥟, etc.) driving a distinct thrown-projectile windup
animation in `js/screens/battleScreen.js`, versus a melee lunge for
`attackStyle: 'melee'` monsters - not a shared generic hit-flash.

### ~~Attack-mash fatigue.~~ Shipped in pieces, 2026-08-22 and 2026-08-22
Repeatedly mashing the attack button now costs
progressively more: damage decays to a 40% floor, knockback decays to
0, and — new as of fresh playtesting still showing fights too easy — the
cooldown between attacks itself now grows uncapped with the streak
instead of staying flat. See CHANGELOG.

### ~~Swing-timer knockback on hit.~~ Already shipped, backlog just never updated — caught 2026-08-28 alongside the potions/animations items above
`applyKnockback` (`js/systems/combat.js`) is called both
directions: landing a player hit knocks the monster's ATB back
(`resolvePlayerAttack`/`resolveAbilityUse`), and a monster's own attack
knocks the player's ATB back in turn (`resolveMonsterAttack`) - the
"unlosable exploit" bug/fix thread (see the Attack-mash-fatigue/Ability-
rotation-redesign entry below) already confirmed this mechanic is real
and live, just never struck through here.

### ~~Combo-priming's timing bonus (the "green section") can show before it does anything, raised 2026-08-28.~~ Shipped 2026-08-28
Timothy: "If we don't get a bonus for the level 2 ability when you hit
space and it's in the green section then don't show the green section
until you get the next ability which actual benefits from that
timing." At level 2 the player only has Stab; Stab's timing-hit green
zone exists to prime Chop's combo bonus, but Chop doesn't unlock until
level 4 — so the green zone showed (and could be hit) for two levels
before it did anything. New `comboTimingHintUnlocked`
(`js/systems/abilities.js`) hides the timing meter's bonus-zone visual
until the payoff ability a setup ability primes is actually unlocked;
the timing hit is still scored underneath, so priming works instantly
the moment the payoff unlocks — only the misleading visual was hidden.
See CHANGELOG. (Also raised in the same note: a general in-game
tutorial/popup ask for explaining mechanics — see "In-game tutorials /
mechanic explainers" in BACKLOG.md — still open.)

### ~~Chop should be usable immediately after a timing-hit Stab primes it, not gated on its own cooldown, raised 2026-08-28.~~ Shipped 2026-08-28
Timothy: "Chop should reset cooldown after successful #1
timing hit so that you can always do it right away." Confirmed against
the shipped combo system (`canUseAbility`, `js/systems/abilities.js`):
a primed payoff only bypassed the swing-timer/`ready` gate, not Chop's
own real-time `onCooldown` gate — so if Chop was still cooling down
when Stab primed it, the combo couldn't actually be used right away
despite being primed. `canUseAbility` now bypasses both gates for a
primed payoff; the ability button also no longer shows a stale
cooldown countdown in that state (`js/screens/battleScreen.js`). See
CHANGELOG.

### ~~Parry mechanic, raised 2026-08-18.~~ Shipped 2026-08-19
Monster attacks now telegraph via a ~1.2s wind-up bar before landing,
with a parry-able zone in the final 20% (`s` or click the bar). A
successful parry fully negates the hit and reflects half the incoming
damage back at the monster (bypassing its defense), plus resets the
monster's ATB to empty. No cap/cooldown on attempts — shipped
deliberately unlimited, to be tuned later against real playtesting of
both this and the just-shipped abilities system, per Timothy's explicit
call. Design: `docs/superpowers/specs/2026-08-18-parry-mechanic-design.md`.
Plan: `docs/superpowers/plans/2026-08-18-parry-mechanic.md`.
Known follow-up from final review (not blocking, documented in
`js/systems/parry.js` and the balance-simulator comments): the wind-up's
real wall-clock timing is ~1200ms with only a single 300ms tick actually
landing inside the parry zone, due to tick-loop quantization — worth
revisiting once there's real play data to tune against (see the related
still-open "Parry timing may feel earlier than the visible red zone"
item in BACKLOG.md).

### ~~Abilities gained on level-up.~~ Shipped 2026-08-18 (Phase 1, single-target)
Five fixed-order abilities — Stab (2), Chop (4),
Slash (6), Sweep (8), Super Scream (10) — each with its own real-time
cooldown independent of the ATB gauge, a rotation bonus around Super
Scream's buff window, and a never-fails timing minigame. See
`docs/superpowers/specs/2026-08-17-combat-abilities-design.md` and
`js/systems/abilities.js`. Deliberately scoped to today's
single-monster battles — **multi-enemy targeting is Phase 2**, a
separate project (shipped 2026-08-21, see "Multi-mob encounters in zone
1" below, since Slash/Sweep were specifically built to extend to real
multi-target without rework once that landed).

### ~~Hide locked abilities entirely instead of showing them disabled, raised 2026-08-26.~~ Shipped 2026-08-26
Timothy's own words: "don't show abilities until you leveled up enough to acquire them. so the start of the game you just have attack and item and then slowly you get more things." `abilityButtonsHtml()` (`js/screens/battleScreen.js`) now maps over `getUnlockedAbilities(state.player.level)` instead of the full `ABILITIES` array, and the digit-key handler (`handleKeydown`, same file) looks up `getUnlockedAbilities(state.player.level)[Number(key) - 1]` instead of indexing the full array, with a guard for a key beyond however many abilities are currently unlocked - keeps the filtered-list index consistent between what a button shows and what its key press fires, exactly as the note flagged. Verified in-browser (not just unit tests, since this repo has no jsdom setup for `battleScreen.js`) by mounting real battle instances at levels 1, 3, 5, and 10: level 1 shows zero ability buttons, each unlock threshold shows exactly the right buttons with correctly-numbered key labels, and dispatched keydown events for keys beyond the unlocked count no-op with no errors. Super Scream (Space-bound, exempt from numbered slots) unaffected. A related add-on the same day: a level-up battle now also announces any ability newly unlocked that battle (`js/main.js`), staggered after the level-up celebration so the two banners don't clobber each other - see CHANGELOG.

### ~~Ability rotation redesign — combo chains, key ergonomics, and visibility, raised 2026-08-20.~~ All pieces shipped by 2026-08-23
Timothy's own extended pitch after playing the shipped
Phase 1 abilities: "the combat feels good but a little clunky. I don't
really understand the different power levels of the abilities... not
sure why I would use different single target or different multi
target. Does one buff the other or what?" Several distinct threads in
one note, kept together since they're all reactions to the same
rotation:
- ~~**Combo/buff chaining between abilities.**~~ **Shipped.** Stab and
  Chop, and Slash and Sweep, are now paired combo lanes: landing the
  setup (Stab or Slash) primes its payoff (Chop or Sweep) for a 1.5x
  damage bonus and lets it fire even before the swing timer is full;
  landing the payoff returns a smaller 1.15x bonus to the setup in
  turn, keeping the lane going if you alternate — matches the "1 and 3
  small, 2 and 4 big if primed, payoff also feeds back to the setup"
  shape from the original note. A primed ability's button glows and
  relabels itself ("Combo Ready" / "Bonus Ready") — the "indicator on
  what to hit next" this note asked for. Sweep also became a
  full-damage AOE hitting every living monster (the group-fight role
  flagged as a dependency when multi-mob-encounters shipped). Design:
  `docs/superpowers/specs/2026-08-21-ability-rotation-redesign-design.md`.
  Plan: `docs/superpowers/plans/2026-08-21-ability-rotation-redesign.md`.
  **Refined 2026-08-22:** Timothy: "I think if you hit the timing
  window of 1/3 then 2/4 light up respectively and they are instant.
  No bar at all and no timing game for those abilities. So timing
  game only for 1/3 and if you do it right that's when you get the
  bonus for 2/4." Priming now requires actually hitting Stab/Slash's
  timing window, not just landing the ability at all (a miss still
  deals normal damage, never-fails is unchanged, it just no longer
  primes the payoff). Chop/Sweep dropped the timing minigame entirely
  — never shown, whether triggered via a primed instant-cast or their
  own swing timer — their reward is the combo multiplier itself, not
  a stacked timing bonus. Standalone use of Chop/Sweep (without
  priming) still waits on the normal swing timer, per Timothy's
  explicit call not to make that path combo-only. Verified via a
  scripted battle: a missed Stab left Chop un-primed and gated on its
  own swing timer; a timing-hit Stab primed Chop (damage estimate
  jumped from the buff correctly applying) and made it instantly
  pressable; no timing meter ever appeared during Chop's use either
  way.
- ~~**Key ergonomics.**~~ **Shipped 2026-08-22.** "My fingers dancing
  from 1, 2, 3, 4, 5 back to a, s is a little funky... fingers are on
  1, 2, 3, 4 and I have to look down for 5." Super Scream now fires on
  Space instead of key `5` (digit keys `1`-`4` are unchanged for
  Stab/Chop/Slash/Sweep), is usable the instant it's off its own 30s
  cooldown regardless of the swing-timer gauge, and no longer resets
  the gauge when used — a genuinely free action layered on the
  rotation. `canUseAbility` gained an `alwaysReady` bypass
  (`js/systems/abilities.js`) for this.
- ~~**What is Attack for?**~~ **Shipped 2026-08-22.** "I feel like we
  don't need it... or you make it auto attack or something that does
  trivial damage," with a follow-up alternate idea: Attack stays
  manual but usable off the global ability cooldown, dealing
  progressively less damage the more it's spammed unless "charged up"
  somehow. Went with the decay direction (no charge-up): Attack now
  drops the swing-timer requirement too, but each consecutive press
  (without landing an ability or letting the gauge refill first) deals
  less damage, floored at 40% of normal, with the live penalty shown
  on the button. New `attackStreakMultiplier` in `js/systems/combat.js`;
  `resolvePlayerAttack` gained an optional 4th `streakMultiplier` param
  (defaults to `1`, so `scripts/simulate-balance.js`'s existing calls
  are unaffected — the simulator doesn't model this new mechanic yet,
  same precedent as it not modeling abilities).
  ~~**Regression found in play, raised 2026-08-22 — makes every fight
  unlosable:**~~ **Fixed 2026-08-22.** Timothy: "I can hit attack a bunch of times in a row
  and even though it gets weaker it sets the enemy timer back so the
  enemy can never attack me... I think it needs a global cooldown or
  something and it needs to get bad enough that it's not worth using
  and at some point not slow enemy bar." Confirmed in the code: this
  same shipped change removed Attack's swing-timer gate entirely
  (previously the one thing rate-limiting how often it could fire),
  and every Attack — `resolvePlayerAttack`, `js/systems/combat.js:76`
  — also calls `applyKnockback(monster.atb, ATB_KNOCKBACK)` (knockback
  = 15, `js/systems/combat.js:19-23`), the pre-existing "Swing-timer
  knockback on hit" mechanic above. That knockback was designed "small
  and non-stacking," true only when something gates how often it can
  apply. With no gate left and the streak decay floor stopping at 40%
  damage (never 0), a player can click Attack fast enough that the
  -15 knockback lands more often than the monster's own speed stat can
  refill its gauge past that knockback — the monster's ATB never
  reaches `ATB_MAX`, so it can never wind up or attack at all, while
  the player keeps dealing at-minimum 40% damage forever. Damage decay
  alone doesn't fix this — the exploit isn't about damage-per-hit, it's
  about total lockout of the enemy's turn. Timothy's own diagnosis
  lines up with the code: needs *some* hard rate limit on Attack (a
  real cooldown, not just decaying damage), and probably the knockback
  itself shouldn't apply at full strength (or at all) once the streak
  has decayed past some point, so a spam-clicked Attack stops
  suppressing the enemy's gauge even though it still lands. Not yet
  designed — needs a dedicated look at how the cooldown interacts with
  the ability-rotation's own timing (Attack was deliberately freed from
  the swing timer specifically so it wouldn't compete with abilities;
  a fix here needs to not silently re-couple them).
  **Fix shipped 2026-08-22, two changes:** (1) a short flat 500ms
  real-time cooldown on Attack (`ATTACK_COOLDOWN_MS`,
  `js/screens/battleScreen.js`), separate from the swing timer it was
  deliberately freed from — stops literal machine-gun clicking without
  re-coupling it to the ability rotation's own gauge. (2) The real
  fix: a new `attackKnockbackMultiplier` (`js/systems/combat.js`)
  decays the ATB knockback with the same spam streak that already
  decays damage, but faster and with no floor — it reaches exactly 0
  by the 3rd-4th consecutive Attack, unlike damage which only floors
  at 40%. Once knockback is fully gone, the enemy's own speed-driven
  gauge growth is uncontested, so it's guaranteed to eventually wind
  up regardless of click rate — that's what actually closes the hole,
  the cooldown just keeps pacing sane in the meantime. Verified with a
  scripted battle: clicking Attack as fast as a Playwright harness
  could (far beyond human speed) for 15s straight, the monster still
  landed hits (player dropped to 13/20 HP) before dying — under the
  old bug the player would have stayed at full HP the entire fight.
  ~~**Still too easy, raised again 2026-08-22 from fresh playtesting:**~~
  **Fixed 2026-08-22.** The unlosable exploit was closed, but sustained
  spam at a flat 500ms cooldown and a 40%-floor damage was apparently
  still out-DPSing the ability rotation the balance pass tuned around.
  Timothy's own proposed fixes: floor damage closer to 0, or make the
  cooldown itself grow the longer you keep spamming. Went with the
  cooldown-growth direction, leaving the 40% floor as-is for now:
  `attackCooldownMsForStreak` in `js/systems/combat.js` (`500 + streak
  × 200`ms, uncapped) replaces the flat `ATTACK_COOLDOWN_MS`. Verified
  via a real in-browser battle: attack frequency dropped sharply over
  a sustained multi-second click burst (damage log showed decay toward
  the 40% floor — 10→11→10→9→6→4 — while the dragon landed far more
  hits in return as its own knockback-lockout faded), rather than
  trying to pin down exact cooldown-vs-real-time numbers, since this
  environment's background-tab timer throttling makes precise timing
  assertions unreliable.
  ~~**Still too strong once abilities are all unlocked, raised
  2026-08-23.**~~ **Two more rounds shipped 2026-08-23.** Round one: the
  40% damage floor now scales down with unlocked ability count instead
  of staying flat forever (`ATTACK_STREAK_FLOOR_PER_ABILITY`,
  `js/systems/combat.js`) — 40% at level 1 down to a literal 0% floor
  once the full rotation is unlocked at level 10 — plus a one-time
  battle-log taunt nudging toward abilities once it bottoms out. Round
  two, after Timothy kept finding himself holding Attack down anyway:
  the decay itself got much steeper (`ATTACK_STREAK_DECAY` 0.15→0.35,
  floor reached by the 2nd press instead of the 4th) and the passive
  recharge — previously "streak resets the instant your swing-timer
  gauge refills" — got much slower via a new real-time-only
  `ATTACK_STREAK_RECOVERY_MS` (8000ms), deliberately decoupled from that
  gauge since it caps at `ATB_MAX` and abilities share it for their own
  readiness. **Known trade-off, deliberately accepted:** in the balance
  simulator, `geared L6 (full iron)` vs. Dragon tier 0 dropped from 84%
  win to 0% — the two changes compound enough to flip some already-close
  matchups. Timothy's call: keep both as shipped, revisit with real
  playtesting data rather than chase the bot's approximation of
  ability-rotation play. See CHANGELOG.
- ~~**Information density on the ability buttons.**~~ **Shipped
  2026-08-22.** Each damage-type ability button now shows a live
  estimated damage number against the current target (average roll +
  active buff/combo bonus, deliberately excluding crit/timing luck —
  `estimateAbilityDamage` in `js/systems/abilities.js`), plus a
  per-ability icon (🗡️🪓⚔️🌪️📢), plus a brief scale/brighten flash on
  the button when pressed.

### ~~Timing-meter clarity and crit/damage-number visual polish, raised 2026-08-20.~~ Both halves shipped 2026-08-22
Two related
requests: (1) Timothy wasn't sure what the green zone at the end of
the hero's own swing timer indicates, or whether there's a timing
mechanic tied to it — worth a tooltip/label or other in-context
explanation, not just discoverable by accident. Fixed as part of the
ability rotation redesign pass above: the timing meter shows a "Press
Space!" label once its fill crosses into the sweet-spot zone. (2)
Damage numbers on a crit should "really pop," and damage numbers in
general should be bigger, persist longer, and float higher (even
above the dialog if possible); crits should also trigger a bigger
environmental reaction. Damage numbers are now `position: fixed`
(positioned from the target zone's `getBoundingClientRect()`) instead
of clipped inside the dialog's `overflow: hidden`, so they genuinely
float above it; bigger, last longer (0.9s → 1.4s). Crits get their
own distinct gold/glowing number with an entrance bounce, plus a
stronger shake across the whole dialog and a brief sway on the
background scenery layer — regular hits are unchanged. Verified
in-browser with a forced-crit run (screenshots at multiple points in
the animation), plus the full test suite (300 passing, none of which
cover this presentational layer directly).

### ~~Death animation for a defeated enemy, raised 2026-08-20.~~ Shipped 2026-08-22
Timothy: "the emoji rotates in a circle and
gets smaller until you can't see it, timed with the dialog closing."
A killed monster's emoji now spins 720° in place while shrinking to
nothing and fading out over 900ms (`.battle-death-spin`,
`js/screens/battleScreen.js`/`css/styles.css`), triggered the instant
its HP hits 0 and timed to finish right before the slot hides and the
battle dialog closes. Deliberately no sideways drift, unlike the
existing shrink-and-slide *flee* animation used by weak-mob
surrender — a kill now reads visually distinct from an escape.
Verified via computed-style polling on a forced kill (rotation matrix
and opacity tracked smoothly from full to ~0 over the animation
window, position stayed put) rather than just eyeballing screenshots.

### Monster name/stat variants, and a rare near-dragon elite encounter
A significantly fleshed-out follow-up to the "roaming rare monster" idea
(see the still-open "Mob leveling" backburner item in BACKLOG.md) —
Timothy's view on it clearly moved from "backburner, questionable
value" to a concrete, wanted feature. Two related but separable pieces,
both shipped:

- ~~**Named stat variants per monster type.**~~ **Shipped 2026-08-23.**
  Every regular wilderness/dungeon-tier encounter (dragon excluded — it
  already has its own boss-tier system) now rolls one of 5 tiers —
  `Puny`/`Lesser`/(baseline)/`Greater`/`Savage`, a ±15% hp/attack spread —
  via `pickMonsterVariant` in the new `js/systems/monsterVariants.js`,
  reusing the same scaled-override pattern `bossTiers.js`/`ngPlus.js`
  already established. Still the same `monsterId` for quest/drop-table
  purposes — only display name and hp/attack vary, rolled independently
  per monster in a multi-mob group. See CHANGELOG. **Possible future
  hook, still open:** these variants could be distributed by
  distance-from-town instead of purely random, to back a Dragon-
  Warrior-style spatial difficulty gradient — see the "spatial
  difficulty gradient" idea in BACKLOG.md's Multi-zone progression
  section; not decided, just a noted connection between the two ideas —
  today's implementation is purely random, no distance signal wired in.
- ~~**A rare, near-dragon-difficulty elite encounter**~~, and ~~**adaptive
  flavor text based on estimated win chance**~~ — **both shipped
  2026-08-23.** Jurassic Jerky 🦖 (`js/data/monsters.js`), a flat 5% chance
  (`js/systems/eliteEncounter.js`) to replace any regular wilderness or
  dungeon encounter, always solo, stats at 88% of the dragon's own tier-0.
  Deliberately not `isBoss`, so `playerFlee()`'s existing boss-only block
  never applies — turned out to need no special "but still fleeable"
  treatment at all, just not setting that one flag. Drops a new unique
  weapon, Fossil Fang. Went with the lighter in-game estimate for the
  adaptive line (not `scripts/simulate-balance.js`'s heavier logic) —
  `getEliteAppearLine` reuses the same average-damage/hits-to-kill
  technique `isMonsterOutclassed` already uses for the weak-mob check,
  bucketed into outmatched/close-fight/favorable framing. See CHANGELOG.

### ~~Multi-mob encounters in zone 1, raised 2026-08-18.~~ Shipped 2026-08-21
After killing 10+ of a given monster type (tracked
forever, per-species, in `state.monsterKillCounts`), wilderness
encounters with that species now have a 30% chance to spawn a group
of 2-3 instead of a lone target. Click a monster (or cycle with
Left/Right/Tab) to select a target — Attack/abilities hit only the
selection, while every monster in the group ticks its own ATB/wind-up
independently. The parry key (`s`) is a deliberate global sweep: it
parries every monster currently in its own parry window at once,
regardless of which is selected — Timothy's explicit call, to be
tuned by feel. Killing a monster removes it from the row and reflows
the rest; a partial-kill-then-flee banks full reward (gold/xp/quest/
kill-count) for each monster already killed, nothing for survivors —
confirmed via a live in-browser test (exact delta: +1 kill, +16 xp,
+4 gold for fleeing with 1 of 2 dead). Solo encounters are unchanged.
Deliberately scoped OUT: any redesign of the 5 existing abilities'
targeting/timing (see "Ability rotation redesign" above), and any
AOE/multi-target ability. Design:
`docs/superpowers/specs/2026-08-21-multi-mob-encounters-design.md`.
Plan: `docs/superpowers/plans/2026-08-21-multi-mob-encounters.md`.
This was the largest single-file rework attempted so far
(`battleScreen.js`'s entire data model went from one monster to an
array). Final whole-branch review caught and fixed one real
regression before merge: the pre-existing weak-mob "surrender"
payout had gone silently to zero (the array-shaped reward loop only
iterates killed monsters, and a surrender leaves the monster at full
HP), plus a killing blow's hit-effect/damage-number rendering onto an
already-hidden monster slot in multi-mob fights. Both fixed; full
detail in `.superpowers/sdd/2026-08-21-multi-mob-encounters/progress.md`
history if that workspace still exists, otherwise see the branch's
commit history.

### ~~Outclassed weak mobs should give up or flee, not just always fight to the death.~~ Shipped 2026-08-17
A non-boss monster killable
within 3 average hits now has a 35% chance per encounter to surrender
(full win rewards), flee dropping loot (gold/item only), or flee
empty-handed (nothing) — each with its own battle-log line and a
shrink-and-slide flee animation on the monster's emoji. See
`isMonsterOutclassed`/`resolveWeakMobEncounter` in `js/systems/combat.js`
and the CHANGELOG. Verified end-to-end in-browser (all three outcomes),
not just unit tests. Overlapped with the "faster timer against weaker
enemies" open question (see BACKLOG.md) for the fights below the
surrender threshold that aren't quite trivial either.

### ~~Weak-mob surrender/flee shouldn't open the battle dialog at all, raised 2026-08-20.~~ Shipped 2026-08-23
Timothy: "when the mobs
are weak and you will auto kill don't even bring up the dialog. Just
show them on the map and have them fly off the screen in random
directions or something." The `resolveWeakMobEncounter` check moved
from inside `battleScreen.mount()` to `main.js`'s `handleEncounter`,
running before the overlay ever mounts. A new `mapScreen.
playMonsterFleeEffect(emoji)` shows the monster flying off the
player's tile in a random direction. See CHANGELOG.

## Balance / design gaps

### ~~Abilities have made the game too easy overall, raised 2026-08-22~~ Balance pass shipped 2026-08-22
Timothy: "game seems too easy now with all the abilities so we will
need to address this and make stuff harder or abilities weaker." A
broader complaint than the specific Attack/knockback exploit (under
"What is Attack for?" above, fixed separately first) — this was Timothy's
read that even setting that aside, the abilities system as a whole had
pushed overall combat power too high. Addressed via a two-phase,
data-driven balance pass (Phase A: extended `scripts/simulate-balance.js`
to actually model abilities instead of only plain Attack. Phase B:
the actual tuning, design at `docs/superpowers/specs/2026-08-22-balance-
pass-design.md`).

**What shipped:** Stab 1.3→0.8 and Chop 1.8→1.1 damage multipliers (the
early/spammable abilities), Slash 1.0→0.85 and Sweep 1.5→1.3 (lighter
cut), player attack growth for levels 2-9 alternating +2/+1 instead of
flat +2, and `xpForLevel`'s base coefficient 10→12 (20% more XP per
level). Full before/after numbers and reasoning in the CHANGELOG's
Phase B entry.

**What this pass could NOT fix, and why (worth knowing before revisiting):**
- Near-town wilderness (55-100 HP monsters) stayed at 100% win / 100%
  HP-left no matter how hard abilities or base attack were cut — this
  turned out to be structural: a monster that slow/squishy dies within a
  handful of player actions regardless of per-hit damage, before its own
  wind-up ever completes. Not fixable without touching monster HP/speed
  (out of scope, per the standing "zone 1 should keep getting easier"
  call) or crushing player power hard enough to break every other tier.
  Treated as intentional, matching that standing design call.
- `prepared L9`/`veteran L11` (fully "prepared" builds) stayed at 100%
  win rate against dungeon-tier and boss-tier-0 even after stacking
  ability cuts with the base-attack cut — real HP/potion cost does show
  up, but not the win/loss outcome. Decided this is correct, not a bug:
  a min-maxed "prepared" build reliably winning what it prepared for is
  the point of preparation. Attrition, not win rate, is the right signal
  for that tier.
- **Known regression, not specifically protected against:** `veteran
  L11` vs. Dragon tier 1 dropped from 57% (the only build that could
  previously touch it) to ~0-2%, a side effect of the leveling-curve
  change. Left as-is — flagging for whoever next touches these numbers,
  since restoring it without re-breaking L9/dungeon-tier would need
  another real tuning pass, not a quick fix.

If "too easy" comes up again, it's likely one of: (a) the near-town/
prepared-build cases above being reframed as real problems after all
(they were deliberately accepted here, not overlooked), or (b) the
still-unaddressed "abilities have made gear/potions matter less"
framing needing a genuinely different lever than damage/XP tuning —
see the "research: ability/skill synergies vs. raw stat inflation" idea
in BACKLOG.md's Combat pass ideas section, never pursued.

### ~~NG+ doesn't reset `lossStreak`~~ Decided and fixed 2026-08-23
Timothy's call: reset it, matching every other NG+ reset (`bossTier`,
`caches`, `gateRewards`, etc.) — NG+ is a fresh start, so a streak from
the previous cycle shouldn't grant a comeback-potion bonus before any
loss has actually happened in the new one. `resetWorldForNgPlus`
(`js/systems/ngPlus.js`) now also zeroes `lossStreak`. See CHANGELOG.
(Surfaced by the final whole-branch review of the comeback-mechanic
plan, 2026-08-17.)

### ~~Hero-revival glow may cancel the death-blow hit-flash/shake~~ Fixed 2026-08-23
Confirmed, not just theoretical: live computed-style polling on a forced
killing blow showed the red flash/shake genuinely never rendered at all
(not just visually dominated) — `.battle-hit-shake`/`.battle-revive-glow`
both set the `animation` shorthand on the hero zone, and
`.battle-hit-flash`/`.battle-revive-glow` both set `filter` on the hero
emoji, so the later-declared `.battle-revive-glow` won outright on both
properties every time. Fixed per this item's own suggested resolution:
`playReviveEffect` now only targets the emoji (not the whole zone), and
the revive pulse's keyframes animate `box-shadow` instead of `filter`.
Re-verified live: flash, shake, and glow all render together on the
killing blow now. See CHANGELOG. (Surfaced by the final whole-branch
review of the comeback-mechanic plan, 2026-08-17.)

## Infrastructure / deployment

### ~~Testing infra: jsdom (or similar) for battleScreen.js's DOM/timing logic~~ Shipped 2026-08-28
Deferred twice before this (2026-08-23, then flagged again with new cost
evidence 2026-08-26 - a single live-browser verification task burned
~367k tokens/358 tool calls) - Timothy asked to finally build it 2026-08-28
("let's tackle jest test setup stuff next so we don't have to rely on
[the] chrome plugin and hopefully it uses less context"; clarified he meant
jsdom + the existing `node:test` runner, not an actual Jest migration - no
reason to convert the 459 existing lightweight tests).

- **`jsdom` added as the first-ever dependency** (`package.json`,
  `package-lock.json`) - this repo previously had zero npm packages at
  all. Added `node_modules/` to `.gitignore` (was missing).
- **`tests/helpers/dom.js`**: shared `setupDom`/`teardownDom`/`createRoot`/
  `click`/`keydown` helpers. Lives outside `tests/` proper so `node --test
  tests/*.js` never tries to run it as its own test file. Two real jsdom
  gotchas found and worked around: (1) Node's own built-in `navigator`
  global is a getter-only accessor property - naive `global.navigator = x`
  throws, needs `Object.defineProperty`; (2) swapping in jsdom's own
  `Performance` object as the global `performance` triggers an infinite
  recursion (`Performance.now -> PerformanceImpl.now -> ...`, a jsdom
  cross-realm quirk) the moment it's called as a bare global rather than
  via `window.performance` - fixed by simply not touching `performance` at
  all, since Node already provides its own perfectly good monotonic clock
  globally.
- **`tests/battleScreenDom.test.js`**: the reference implementation proving
  the pattern works end-to-end against the single most complex/highest-
  value screen (the one the original deferred backlog note was about) -
  9 tests covering mount() DOM structure, ability unlock gating, a real
  dispatched click resolving an Attack (HP bar text updates), the `a`
  keyboard shortcut, Item/potion use, a locked ability's key press being a
  no-op, a full timing-hit Stab→Chop combo-priming interaction (one real
  ~900ms wait to land inside the timing sweet spot - proves the harness
  can drive the same minigame a real player interacts with, not just
  instant synchronous clicks), and unmount() actually detaching its
  keydown listener.
- **Real bug found while writing these tests, fixed same session:**
  `attackCooldownMs` (`js/screens/battleScreen.js`) was never reset in
  `mount()`, unlike every other per-battle Attack counter next to it
  (`attackStreak`, `attackStreakIdleMs`, `attackTauntShown`, etc.) - a
  battle ending while Attack was mid-cooldown (e.g. the winning blow was
  itself an Attack) silently disabled Attack for a moment at the start of
  the *next* battle, self-healing within a second or two via `tick()`'s
  own decay so easy to miss live. Exactly the "does clicking this button
  do the right thing" class of bug this infra was built to catch cheaply.
- **`.github/workflows/deploy.yml` fixed alongside this**: it ran
  `npm run test` directly with no install step at all, which only "worked"
  because the project had zero dependencies before jsdom. Added `npm ci`
  (with `actions/setup-node@v4`'s `cache: npm`) before the test step, or
  every future push to master would have failed CI the moment this landed.
- **Scope, matching the original backlog note's own boundary**: this
  covers DOM structure and event wiring, not pixel-level
  rendering/CSS/animation-timing - jsdom's layout engine is a no-op, so an
  occasional live-browser look is still the right tool for that class of
  check (see the separate, still-open "Pixel-level visual regression
  test" item in BACKLOG.md). Only `battleScreen.js` has real coverage so
  far - `mapScreen.js`, `shopScreen.js`, `smithScreen.js`, etc. can gain it
  incrementally using the same `tests/helpers/dom.js` pattern, not
  something this pass tried to backfill for every screen at once.

### ~~Host on Cloudflare (free tier) with GitHub Actions auto-publish, raised 2026-08-20~~ Shipped 2026-08-22
Timothy: "I want to host this on cloudflare free tier and push to my
personal github and then have a github action that lets me easily
publish new versions." Live end to end:

- **Code**: public repo `github.com/yhtomitn64/emoji-rpg` (Timothy's
  personal GitHub account, distinct from his work GHE account — `gh` now
  holds separate logins for both hosts side by side in
  `~/.config/gh/hosts.yml`). `master` is the default branch; push to it
  to publish.
- **CI/deploy**: `.github/workflows/deploy.yml` runs `npm run test`, then
  `wrangler pages deploy` on every push to `master`. Uses
  `cloudflare/wrangler-action@v3`, not `cloudflare/pages-action` — the
  latter 404s unless the Pages project already exists, wrangler doesn't
  have that limitation.
- **Hosting**: Cloudflare Pages project `emoji-rpg` (direct-upload, no
  Git connection — Cloudflare's own Git integration was deliberately
  skipped so the GitHub Action stays the single deploy path instead of
  two competing ones). Serves `emoji-rpg.pages.dev` directly, plus the
  custom domain `rpg.burghertime.com` (a `rpg` subdomain, not a
  `/rpg` path — Cloudflare Pages custom domains map whole (sub)domains,
  not URL paths, so a path-based setup would have needed an extra Worker
  proxy layer; the subdomain avoids that entirely and was Timothy's
  choice once the tradeoff was explained).
- **Gotcha worth remembering**: this Pages project has no Git repo
  connected, so it has no "Production branch" setting in its dashboard
  Settings tab. For a direct-upload project, `wrangler pages deploy`'s
  `--branch` flag is just a label compared against the project's
  internal production-branch value (defaults to `main`) — it does *not*
  need to match the repo's real branch name. The workflow deploys with
  `--branch=main` even though the repo's actual branch is `master`;
  using `--branch=master` there silently produces a *preview* deploy
  (served at `master.emoji-rpg.pages.dev`, marked `x-robots-tag:
  noindex`) instead of production.
- **Secrets**: `CLOUDFLARE_API_TOKEN` is a GitHub Actions secret, scoped
  to just `Account: Cloudflare Pages: Edit` + `Zone: DNS: Edit` on the
  `burghertime.com` zone specifically (not account-wide). Set via
  `gh secret set` reading from a local file the token was never pasted
  into chat for — the file was deleted immediately after. I never saw
  the token value myself. `CLOUDFLARE_ACCOUNT_ID` is a plain (non-secret)
  repo variable.
- **Repo hygiene**: confirmed no secrets anywhere in the code, working
  tree, or full commit history before or after making the repo public.
  GitHub secret scanning + push protection are both `enabled` (automatic
  for public repos). `.gitignore` hardened to cover `.DS_Store`,
  `.env*`, `*.pem`, `*.key`, `credentials.json`.
- **DNS safety**: confirmed via `dig` after the custom-domain setup that
  burghertime.com's MX records (icloud mail) and apex domain were
  untouched — only a new `rpg.burghertime.com` record was added, via
  Cloudflare's own custom-domain flow (not a manual DNS edit).

**~~Known, non-blocking follow-up~~ Fixed 2026-08-22:** the deployed site
used to include the whole repo root (tests/, scripts/, docs/,
package.json, etc.), not just the game's actual files — harmless (no
secrets in any of them, confirmed above) but meant things like
`rpg.burghertime.com/package.json` were technically fetchable. Rather
than reorganizing the repo's file layout, `.github/workflows/deploy.yml`
now stages just `index.html`, `css/`, and `js/` into a `dist/` directory
in the CI runner and deploys that instead of `.` — no source-tree
changes needed.

**Cosmetic, no action needed:** the workflow's actions log a "Node.js 20
is deprecated" warning from GitHub (the actions still work, forced onto
Node 24 automatically) — unless it becomes a hard failure later.

## Discoverability / monetization

### ~~SEO pass to make the game more findable via search engines~~ Shipped 2026-08-22
Real `<meta name="description">`, more descriptive `<title>`, Open
Graph/Twitter card tags (with a real screenshot-based OG image, not a
placeholder), canonical link, `sitemap.xml`, `robots.txt`, and a
`<noscript>` fallback with a semantic heading. See CHANGELOG. The
deeper SPA limitation (crawlers that don't execute JS see only the
static shell/noscript content, not the actual game) wasn't addressed —
would need real SSR/prerendering, a much bigger project, not attempted
here. (The privacy-friendly-analytics suggestion raised alongside this
is still open — see BACKLOG.md.)
