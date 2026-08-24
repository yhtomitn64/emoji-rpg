# Zone 1 Map Expansion (3x3 -> 5x5) — Design

## Purpose

The wilderness is a 3x3 grid of 9 screens around Town (`center`, 4
cardinal, 4 corners). This grows it to a 5x5 grid of 25 screens by adding
a new outer ring of 16 screens, relocates the dragon's dungeon entrance
into that new ring (today it's randomized among the 4 corners of the 3x3
grid), and delivers a terrain-painting tool so the resulting world can be
drawn with organic, connected shapes (especially water) instead of
today's hand-typed rectangular blocks. Raised 2026-08-23 (see
`docs/superpowers/BACKLOG.md`, "Zone 1 map expansion + organic terrain").

The topology mechanism already generalizes cleanly: every wilderness
screen looks up its neighbors by id (`neighbors: {north, south, east,
west}`), resolved generically in `main.js`'s `handleEdgeTransition` and
nowhere hardcoded to a 3x3 assumption. The real work here is content
(16 new screens), two small reworks (dungeon eligibility, the
`southeast` decoy-hint gimmick), and new tooling (the painter) — not
engine changes.

## Scope

**In scope:**
- 16 new wilderness screen modules in `js/maps/wilderness/`, registered
  in `MAPS` (`main.js`), each shipped with placeholder terrain (grass
  interior, tree border on any side with no neighbor) and correct
  `neighbors`/`monsterTable`/`encounterChance`/`cacheChance`/
  `miniDungeonChance`.
- Reworking `js/systems/dungeonEntrance.js`'s `CORNER_SCREEN_IDS` to
  point at the 4 new far corners, and `saveSlots.js`'s corner-map
  wiring to match.
- Removing the `southeast`-specific decoy-hint branch in
  `handleFirstVisit` (`main.js`).
- A new browser-based terrain painting tool: one continuous canvas
  representing the full 5x5 world (all 25 screens, existing 9
  included), used to hand-draw organic terrain shapes that read as
  connected across screen boundaries by construction (one canvas, not
  25 independently-authored ones). Exports per-screen `ROWS`/`legend`
  data for pasting into the corresponding map file.
- Test coverage: neighbor-grid symmetry across all 25 screens, dungeon
  entrance eligibility limited to the 4 new far corners, placeholder
  screens passing the existing map-validity checks (well-formed,
  30x22, fully reachable, correct border walkability).

**Out of scope (deliberately):**
- Actually drawing the final organic terrain. That's a manual step
  Timothy does with the shipped painter tool, after this lands —
  placeholder terrain (plain grass, tree-bordered) is what ships from
  the coding work itself.
- Flavor text for the 16 new screens (`js/data/flavorText.js`).
  Timothy writes this game's narrative himself — `FLAVOR_TEXT` entries
  are left unwritten; `handleFirstVisit` already no-ops safely when a
  screen id has no entry.
- A spatial monster-difficulty gradient. The new ring reuses the
  existing corner tier (`['direWolf','spider','scorpion']` @ 0.15)
  verbatim — no new tier, no gradient. (A gradient is a separate,
  already-flagged backlog item under "Multi-zone progression.")
- Any decoy/hint mechanic for the relocated dungeon. The old
  `southeast`-only decoy is deleted, not replaced or moved.
- Save-data migration for terrain changes under a player's feet.
  Existing `isValidSavedPosition` already resets to a screen's
  `startPosition` when a saved position becomes invalid; that's
  sufficient, since resets on the existing 9 are acceptable.
- Town's interior map, dungeon interior, mini-dungeons — untouched.

## Mechanics

### Grid layout and naming

The existing 3x3 occupies the center of the new 5x5 grid. New screen
ids extend the existing compass names outward — each new screen is
named for the existing column/row it sits beyond:

```
farNorthwest   northNorthwest   farNorth        northNortheast   farNortheast
westNorthwest  [northwest]      [north]         [northeast]      eastNortheast
farWest        [west]           [center]        [east]           farEast
westSouthwest  [southwest]      [south]         [southeast]      eastSoutheast
farSouthwest   southSouthwest   farSouth        southSoutheast   farSoutheast
```

(`[bracketed]` = existing 9, ids untouched — they're baked into save
data (`state.map`), `FLAVOR_TEXT` keys, and `CORNER_SCREEN_IDS`, so
none of those 9 ids change.)

### Neighbor wiring

Every screen's `neighbors` object follows directly from grid position
(no diagonals — only N/S/E/W, same as today). Two categories of
change:

1. **The existing 9's outward-facing `null`s get filled in** — each of
   the 3x3's 8 outer-facing sides (the ones that were the literal edge
   of the old world) now points at a new screen instead of `null`:
   `north.north`, `south.south`, `east.east`, `west.west` each gain one
   new neighbor; `northeast`/`northwest`/`southeast`/`southwest` each
   gain two (their two outward-facing sides). `center`'s neighbors are
   unaffected — it never touched the old edge.
2. **All 16 new screens get a full `{north,south,east,west}` object.**
   Every new screen has exactly one or two `null` sides (one for an
   edge screen, two for a true corner — same shape as today's existing
   `north`/`northeast` screens), matching the new outer boundary of
   the 5x5 grid. The 4 new corners (`farNortheast`, `farNorthwest`,
   `farSoutheast`, `farSouthwest`) are structurally identical in shape
   to today's 4 old corners — same "2 null sides" pattern, just at the
   new boundary — so no new topology logic is needed, only more data.

The existing `maps.test.js` test "wilderness screen neighbor links are
symmetric" already validates this generically across whatever's in its
`WILDERNESS` map (n/a to a specific grid size) — extending that map to
all 25 screens is sufficient to catch any wiring mistake in either
category above.

### Placeholder terrain for the 16 new screens

Each new screen ships as: tree border (`#`) on exactly the side(s)
with a `null` neighbor, walkable border elsewhere, plain grass (`.`)
interior — mirroring exactly how today's `north`/`northeast`/etc.
screens are already shaped (compare `js/maps/wilderness/northeast.js`'s
top row `'##...##'` for its `null` north side against its walkable
south/west borders). `startPosition: { x: 15, y: 11 }` (matching the
majority convention already used by 6 of the 9 existing screens — the
placeholder interior is uniform grass, so this is walkable regardless
of exact position). No water/mountain/thicket features — those are
added later, by hand, via the painter tool.

`legend`, `monsterTable`, `encounterChance`, `cacheChance`, and
`miniDungeonChance` for all 16: identical to today's 4 old corners —
`{ '.': 'grass', '#': 'tree' }`, `['direWolf','spider','scorpion']`,
`0.15`, `0.03`, `0.005`.

### Dungeon entrance relocation

`js/systems/dungeonEntrance.js`'s `CORNER_SCREEN_IDS` changes from the
4 old corners to the 4 new far corners:

```js
export const CORNER_SCREEN_IDS = ['farNortheast', 'farNorthwest', 'farSoutheast', 'farSouthwest'];
```

`pickRandomEntrancePosition` itself is untouched — it already takes
`cornerMaps` as a parameter rather than importing specific screens, so
it's agnostic to which 4 screens are "corners." `saveSlots.js`'s
`createSlot()` swaps its `CORNER_MAPS` object to import and key off the
4 new far-corner map modules instead of the old 4. The old 4 corners
(`northeast`/`northwest`/`southeast`/`southwest`) become plain interior
screens — no longer dungeon candidates, same as `center`/`north`/etc.
today.

`DEFAULT_DUNGEON_ENTRANCE_POSITION` (`state.js`, the legacy-save
backfill value) is untouched — it still points at the historical
`southeast (24, 10)` spot, which remains a valid, walkable, grass tile
on the (now-interior) `southeast` screen. Old saves that never got a
`dungeonEntrancePosition` still land there exactly as before; only
*new* saves roll among the new far corners.

### Decoy hint removal

`main.js`'s `handleFirstVisit` drops the `isFalseDungeonHint`
special-case entirely:

```js
// before
function handleFirstVisit(screenId) {
  const isFalseDungeonHint =
    screenId === 'southeast' && state.dungeonEntrancePosition.screenId !== 'southeast';
  const text = FLAVOR_TEXT[screenId];
  if (text && !isFalseDungeonHint) {
    showFlavorBanner(text);
  }
  persist();
}

// after
function handleFirstVisit(screenId) {
  const text = FLAVOR_TEXT[screenId];
  if (text) {
    showFlavorBanner(text);
  }
  persist();
}
```

It was a minor gimmick tied specifically to the old 4-corner layout;
with the real dungeon now always in the new outer ring, a decoy on an
interior screen doesn't read as a meaningful red herring anymore. Not
replaced with an equivalent in the new ring — Timothy can add a new one
later, as a text/narrative decision, if he wants one.

### Terrain painting tool

A new static HTML+JS page (served the same way as the game itself —
`python3 -m http.server`, same-origin `fetch`/dynamic `import()` of the
real ES module map files, no build step, no new dependency). One
canvas laid out as the true 5x5 world: 150 columns x 110 rows of cells
(5 screens x 30 cols, 5 screens x 22 rows), each screen's block
positioned at its real grid location.

**Loading:** on open, the tool dynamically `import()`s all 25 real map
modules and paints each screen's block from its `rows`/`legend` —
translated through `legend[char] -> tileKey` (e.g. `'grass'`,
`'tree'`, `'water'`, `'mountain'`, `'mountainCache'`, `'thicket'`,
`'thicketCache'`, `'townEntrance'`) so the tool works in tile-*kind*
space, not each file's arbitrary character choices (today's files
don't agree on characters for the same tile — `'M'` means `mountain`
in `east.js` but `mountainCache` in `northwest.js`). All 25 screens are
editable, including the existing 9 (per Timothy: fine to touch up an
existing lake/forest shape so it extends cleanly into new territory).

**Painting:** a palette of tile-kind brushes (grass, tree, water,
mountain, mountainCache, thicket, thicketCache) with click/click-drag
to paint cells. Because it's one continuous canvas, a lake painted
across a screen boundary is connected by construction — there's no
separate edge-matching step or validation pass needed. `townEntrance`
is shown as a fixed, non-paintable landmark (it must stay exactly on
`center`, and moving Town's entrance is out of scope).

**Export:** per screen, a "Copy" button serializes that screen's 22
rows back into a `ROWS` array plus a regenerated `legend` object
(assigning its own consistent character-per-tile-kind, since it no
longer needs to preserve any file's original arbitrary characters) to
the clipboard, formatted as ready-to-paste JS matching the existing
file style. Workflow: paint the whole world once, then for each screen
that changed, paste its `ROWS`/`legend` over the corresponding block in
that screen's file — other fields (`id`, `startPosition`,
`monsterTable`, `neighbors`, etc.) are untouched by the paste.
Clipboard copy-paste was chosen over the File System Access API (which
could write files directly) or a zip download — it's the least new
surface area for a tool with exactly one user, and the 25-screen paste
is a one-time cost. If that turns out tedious in practice, direct
file-write is a reasonable follow-up, not a day-one requirement.

## Data model

No `state` shape changes. `dungeonEntrancePosition` keeps its existing
`{ screenId, x, y }` shape — only the *set* of screen ids it can name
(for new saves) changes, via `CORNER_SCREEN_IDS`.

## Wiring changes

- **New:** 16 files in `js/maps/wilderness/` — `farNorthwest.js`,
  `northNorthwest.js`, `farNorth.js`, `northNortheast.js`,
  `farNortheast.js`, `westNorthwest.js`, `eastNortheast.js`,
  `farWest.js`, `farEast.js`, `westSouthwest.js`, `eastSoutheast.js`,
  `farSouthwest.js`, `southSouthwest.js`, `farSouth.js`,
  `southSoutheast.js`, `farSoutheast.js`.
- **New:** terrain painter tool (page + supporting JS) at
  `tools/terrain-painter/` — a new top-level directory, since
  `scripts/` is currently Node-only balance-simulation scripts, a
  different kind of tool than a browser page.
- **Modify:** `js/main.js` — import and register the 16 new maps in
  `MAPS`; fill in the 8 previously-`null` neighbor slots on the
  existing 9's outward sides; delete the `isFalseDungeonHint` branch in
  `handleFirstVisit`.
- **Modify:** `js/systems/dungeonEntrance.js` — `CORNER_SCREEN_IDS`
  values change to the 4 new far corners.
- **Modify:** `js/systems/saveSlots.js` — `CORNER_MAPS` imports/keys
  swap to the 4 new far-corner map modules.
- **Unmodified:** `js/state.js`'s `DEFAULT_DUNGEON_ENTRANCE_POSITION`,
  the 9 existing screens' own terrain data (only their `neighbors`
  objects change), `js/systems/world.js`, `js/screens/mapScreen.js`,
  `js/systems/screenSeen.js` — all already grid-size-agnostic.

## Testing

- `maps.test.js`: extend `WILDERNESS` to all 25 screens. This alone
  extends "every wilderness screen is well-formed," "is exactly
  30x22," "is fully reachable from startPosition," and "border is
  walkable exactly where a neighbor exists" to cover the 16 new
  screens for free.
- `maps.test.js`: the FLAVOR_TEXT completeness test currently requires
  *every* wilderness screen to have an entry — narrow that check to
  just the original 9 (which already have and will always require
  text), since the 16 new screens deliberately ship without any. Keep
  the "every key matches a real screen id" half of the check as-is
  across all 25.
- `maps.test.js`: add an assertion that all 16 new screens'
  `monsterTable` matches the corner tier (parallel to the existing
  "new roster monsters are wired into the right monsterTables" test's
  `farCornerScreens` check).
- `dungeonEntrance.test.js` / `tests/saveSlots.test.js`: update the
  hardcoded `CORNER_SCREEN_IDS` expectations to the 4 new far-corner
  ids.
- Manual verification: run the local server, walk from each of the 4
  original corners outward and confirm the new screens connect
  correctly and render as plain grass; create a few new saves and
  confirm the dungeon only ever lands in one of the 4 new far corners;
  open the painter tool, confirm it loads all 25 screens' current
  terrain in their correct grid positions, paint a test shape crossing
  a screen boundary, copy the export for one screen, and confirm the
  pasted result is valid (passes `maps.test.js` after pasting).
