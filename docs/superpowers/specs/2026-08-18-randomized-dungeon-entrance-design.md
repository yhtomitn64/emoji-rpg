# Randomized Dungeon Entrance — Design

## Purpose

The dungeon entrance is currently one hardcoded tile (`D` at `(24, 10)` on
the southeast wilderness screen) — the same spot for every save, forever.
This build randomizes it per save: one of the 4 corner screens, at a
random walkable spot within it, rolled once at character creation. First
piece of the larger "multi-zone progression" backlog item (new zones will
need per-save placement logic anyway); scoped narrowly to just the
entrance, not zone content itself.

## Scope

**In scope:**
- A new pure module picking a random `{screenId, x, y}` among the 4
  corner screens' grass tiles.
- `state.dungeonEntrancePosition`, rolled once at character creation,
  read by the map screen to render/behave as the dungeon entrance at
  that one coordinate on that one screen, for that save only.
- Removing the static `D` tile from `southeast.js` — all 4 corners
  become plain grass at the map-data level; the per-save override is the
  only thing that ever produces an entrance.
- Backward compatibility: existing saves (no `dungeonEntrancePosition`
  field) keep landing at the historical southeast `(24, 10)` spot,
  unchanged.

**Out of scope (deliberately):**
- Zone content itself, zone unlocks gated by tools, non-store
  equipment — separate backlog threads, own future design passes.
- Anything about the dungeon's own interior layout or the boss fight
  once entered — only where you *enter from* changes.
- Randomizing anything about town, the center screen, or any non-corner
  wilderness screen.

## Mechanics

### Picking the position

New pure module `js/systems/dungeonEntrance.js`:

```js
export const CORNER_SCREEN_IDS = ['northeast', 'northwest', 'southeast', 'southwest'];

export function pickRandomEntrancePosition(cornerMaps, rng = Math.random) {
  const screenId = CORNER_SCREEN_IDS[Math.floor(rng() * CORNER_SCREEN_IDS.length)];
  const map = cornerMaps[screenId];
  const grassTiles = [];
  for (let y = 0; y < map.rows.length; y++) {
    for (let x = 0; x < map.rows[y].length; x++) {
      if (map.legend[map.rows[y][x]] === 'grass') {
        grassTiles.push({ x, y });
      }
    }
  }
  const { x, y } = grassTiles[Math.floor(rng() * grassTiles.length)];
  return { screenId, x, y };
}
```

`cornerMaps` is `{ northeast: northeastMap, northwest: northwestMap,
southeast: southeastMap, southwest: southwestMap }` — passed in by the
caller (not imported inside this module) so the module itself stays a
pure function of its inputs, easily tested against fixture maps or the
real ones.

Only `'grass'`-legend tiles are candidates — trees, water, and
tool-gated tiles (mountain/thicket) are automatically excluded since
they map to different legend keys. No walkability/reroll logic is
needed beyond "is it grass," since grass is always walkable.

### Wiring into character creation

`js/state.js` gains an exported default and a second `createNewGame`
parameter:

```js
export const DEFAULT_DUNGEON_ENTRANCE_POSITION = { screenId: 'southeast', x: 24, y: 10 };

export function createNewGame(heroEmoji = DEFAULT_HERO_EMOJI, dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION) {
  return {
    ...
    dungeonEntrancePosition,
  };
}
```

The default matches the exact tile the old hardcoded `D` used to
occupy — every existing test that calls `createNewGame()` with no second
argument keeps working unchanged, and it doubles as the legacy-save
backfill value (below). `state.js` itself imports no map data and stays
exactly as dependency-free as it is today; only the one real "new game"
entry point supplies a genuinely random position.

`js/systems/saveSlots.js`'s `createSlot()` — the only real caller of
`createNewGame` in the app (confirmed via grep; every other reference is
in tests) — imports the 4 corner wilderness maps and
`pickRandomEntrancePosition`, rolls a position, and passes it through:

```js
const state = createNewGame(heroEmoji, pickRandomEntrancePosition({
  northeast: northeastMap, northwest: northwestMap,
  southeast: southeastMap, southwest: southwestMap,
}));
```

### Making the map screen respect it

`js/screens/mapScreen.js`'s `tileAt(x, y)` — already the single
function both `render()` and `tryMove()` funnel through — checks the
override first:

```js
function tileAt(x, y) {
  const entrance = state.dungeonEntrancePosition;
  if (entrance && mapConfig.id === entrance.screenId && x === entrance.x && y === entrance.y) {
    return TILES.dungeonEntrance;
  }
  const row = mapConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  return TILES[mapConfig.legend[char]];
}
```

Because `render()` and `tryMove()` (movement + the `action: 'enterDungeon'`
trigger) both already call `tileAt`, this one change covers rendering the
🕳️ emoji, walkability, and triggering dungeon entry — no other file needs
to know the override exists.

### Removing the static tile

`js/maps/wilderness/southeast.js`: the `D: 'dungeonEntrance'` legend
entry is removed, and the one `D` character in `ROWS[10]` (column 24)
becomes `.`. Southeast's map data is now identical in kind to the other
3 corners — plain grass, no baked-in entrance — consistent with "the
per-save override is the only thing that ever produces an entrance."

### Legacy saves

`js/main.js`'s `startGame()` already backfills missing fields on load
(`gateRewards`, `lossStreak`, following the exact same `if (!state.x) {
state.x = ...; }` shape). One more line joins that block:

```js
if (!state.dungeonEntrancePosition) {
  state.dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION;
}
```

An existing character's dungeon location doesn't move under them —
only new saves created after this ships get a randomized entrance.

## Data model

`state.dungeonEntrancePosition: { screenId: string, x: number, y: number }`
— new field, set once at creation, read-only for the life of the save
(never reassigned after creation; no code path mutates it once set).
Three primitive values, no nested structure, no migration beyond the
one backfill line above.

## Wiring changes

- **New:** `js/systems/dungeonEntrance.js` — pure, `CORNER_SCREEN_IDS`,
  `pickRandomEntrancePosition(cornerMaps, rng)`.
- **Modify:** `js/state.js` — new export `DEFAULT_DUNGEON_ENTRANCE_POSITION`;
  `createNewGame` gains the second parameter and includes it in the
  returned object.
- **Modify:** `js/systems/saveSlots.js` — `createSlot()` imports the 4
  corner maps + `pickRandomEntrancePosition`, passes a rolled position
  to `createNewGame`.
- **Modify:** `js/screens/mapScreen.js` — `tileAt(x, y)` checks the
  override before the static legend lookup.
- **Modify:** `js/maps/wilderness/southeast.js` — remove the `D` legend
  entry and the one `D` character in the map data (becomes `.`).
- **Modify:** `js/main.js` — `startGame()` gains the one-line
  `dungeonEntrancePosition` backfill, alongside the existing
  `gateRewards`/`lossStreak` backfills.

## Testing

- `dungeonEntrance.test.js` (new): `pickRandomEntrancePosition` — with
  an injected rng, verify each of the 4 corner ids is selectable;
  verify the returned `x`/`y` always lands on a tile whose legend char
  is `'grass'` in that screen's real, currently-imported map data (not
  a fixture — so a future map edit that removes all grass from a corner
  fails this test loudly instead of silently); verify determinism given
  a fixed rng sequence (same draws in, same position out).
- `state.test.js`: extend — `createNewGame()` with no second argument
  returns `dungeonEntrancePosition` equal to
  `DEFAULT_DUNGEON_ENTRANCE_POSITION`; passing an explicit position uses
  it verbatim, unchanged.
- `maps.test.js`: update the existing southeast-specific assertion
  (`"southeast screen has the dungeon entrance"` or equivalent) to stop
  expecting a static `dungeonEntrance` tile in the raw map data; add an
  assertion that `southeast`'s legend/rows no longer contain `D`
  anywhere, confirming the removal actually happened.
- Manual verification (no automated test covers actual gameplay
  discovery): create several new characters in a row, confirm via a
  quick `localStorage` read that `dungeonEntrancePosition` differs
  screen-to-screen across them; walk to the rolled position on the
  rolled screen in at least one of them and confirm the 🕳️ emoji
  renders there, is walkable, and triggers dungeon entry; simulate an
  old save (strip the field from a save's JSON, or use a save created
  before this ships) and confirm it still lands at the historical
  southeast `(24, 10)` spot after the backfill runs.
