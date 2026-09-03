# Town Exits, Expansion, and Signage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace town's single door exit with 4 unmarked tree-gap exits (one per wall), route each to a matching landing spot just outside town, resize the town map to fit, and add always-on wooden signposts over every shop/feature.

**Architecture:** Town stays a self-contained interior map (same pattern as dungeons — entered/exited via fixed points, not part of the wilderness `worldGrid` cluster). Four new tile kinds each carry their own explicit action name (`exitTownNorth`/`South`/`East`/`West`), matching the codebase's existing per-thing-named-action convention. All 4 actions route to the one wilderness screen town has ever linked to (`center`), landing 1 tile out from the fixed `@` entrance point in the matching direction — no new per-town routing config. Signposts are a static tile-identity-keyed label rendered as an extra absolutely-positioned child in the existing per-cell render loop.

**Tech Stack:** Vanilla JS (no framework), `node:test` + `node:assert/strict` for tests, jsdom for DOM tests (`tests/helpers/dom.js`).

**Spec:** `docs/superpowers/specs/2026-09-03-town-exits-and-signage-design.md`

## Global Constraints

- `emoji: ''` on the 4 new tile kinds (not `undefined`) — `mapScreen.js`'s render branch (`else if (emoji) { cell.append(emoji); }`) treats both as falsy, but `''` matches the existing convention used by `TILES.water`'s blank variant.
- Town's `@` entrance point on `center` is `{x: 14, y: 12}` — do not change this; all 4 new exits are defined relative to it.
- The `exit`/`🚪` tile kind itself is NOT removed from `js/tiles.js` — dungeons and tool dungeons still use it. Only town's own `LEGEND` stops referencing it.
- No new per-town exit config/table — this is deliberately hardcoded to town's one real wilderness link, per the spec's explicit "don't over-engineer this" scope note.

---

## Task 1: New tile kinds + resized town map + data-level tests

**Files:**
- Modify: `js/tiles.js` (add 4 new tile kinds)
- Modify: `js/maps/townMap.js` (new legend, new 20×14 rows, new startPosition)
- Modify: `tests/maps.test.js` (update the town well-formed test, add a new center-entrance-adjacency test)

**Interfaces:**
- Produces: `TILES.treeGapNorth`/`treeGapSouth`/`treeGapEast`/`treeGapWest`, each `{ emoji: '', walkable: true, encounter: false, action: 'exitTownX', description: 'A break in the trees' }` — consumed by Task 2 (`main.js` routing) and Task 3 (`mapScreen.js` rendering).
- Produces: `townMap.legend` gains `n`/`s`/`e`/`w` → `treeGapNorth`/`South`/`East`/`West`, loses `E` → `exit`. `townMap.startPosition` becomes `{x: 10, y: 10}`.

- [ ] **Step 1: Write the failing tests in `tests/maps.test.js`**

Replace the existing town test (currently asserts `'exit'` is present):

```js
test('town map is well-formed and includes shop, smith, quest board, and all 4 directional tree-gap exits', () => {
  assertValidMap(townMap);
  const chars = townMap.rows.join('');
  const tileKeys = [...chars].map((c) => townMap.legend[c]);
  assert.ok(tileKeys.includes('shop'));
  assert.ok(tileKeys.includes('smith'));
  assert.ok(tileKeys.includes('questBoard'));
  assert.ok(tileKeys.includes('well'));
  assert.ok(tileKeys.includes('treeGapNorth'));
  assert.ok(tileKeys.includes('treeGapSouth'));
  assert.ok(tileKeys.includes('treeGapEast'));
  assert.ok(tileKeys.includes('treeGapWest'));
  assert.ok(!tileKeys.includes('exit'), 'town should no longer use the door tile - see docs/superpowers/specs/2026-09-03-town-exits-and-signage-design.md');
});
```

Add a new test directly after the existing `'center screen start position (where exiting town lands you) is orthogonally adjacent to the town entrance, not diagonal'` test (around line 420):

```js
test('center screen has open, walkable ground on all 4 sides of the town entrance (every town exit direction needs a landing spot)', () => {
  const entranceChar = Object.entries(centerMap.legend).find(([, kind]) => kind === 'townEntrance')?.[0];
  assert.ok(entranceChar, 'center map legend must have a townEntrance character');
  let entranceX, entranceY;
  for (let y = 0; y < centerMap.rows.length; y++) {
    const x = centerMap.rows[y].indexOf(entranceChar);
    if (x >= 0) { entranceX = x; entranceY = y; }
  }
  const deltas = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  for (const [dir, [dx, dy]] of Object.entries(deltas)) {
    const x = entranceX + dx;
    const y = entranceY + dy;
    assert.ok(isWalkableAt(centerMap, x, y), `center (${x},${y}), one step ${dir} of the town entrance, must be walkable for the matching town exit to land there`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — the new test can't find `treeGapNorth`/etc. in town's legend yet (town still has `'exit'`, not the 4 new kinds); the well-formed test's `assert.ok(!tileKeys.includes('exit'))` fails since `'exit'` is still present today.

- [ ] **Step 3: Add the 4 new tile kinds to `js/tiles.js`**

Insert immediately after the existing `exit` entry:

```js
  exit: { emoji: '🚪', walkable: true, encounter: false, action: 'exitMap', description: 'Door — leave this area' },
  // Town's own exits (see docs/superpowers/specs/2026-09-03-town-exits-
  // and-signage-design.md) - deliberately no emoji ("not even a door,
  // just a break in the trees"), one tile kind per direction so each
  // carries its own explicit action, matching the enterAxeDungeon/
  // enterPickDungeon/etc. convention rather than inferring direction
  // from where the tile sits in the map. `exit` above is untouched and
  // still used by dungeon/tool-dungeon doors.
  treeGapNorth: { emoji: '', walkable: true, encounter: false, action: 'exitTownNorth', description: 'A break in the trees' },
  treeGapSouth: { emoji: '', walkable: true, encounter: false, action: 'exitTownSouth', description: 'A break in the trees' },
  treeGapEast: { emoji: '', walkable: true, encounter: false, action: 'exitTownEast', description: 'A break in the trees' },
  treeGapWest: { emoji: '', walkable: true, encounter: false, action: 'exitTownWest', description: 'A break in the trees' },
```

- [ ] **Step 4: Replace `js/maps/townMap.js` entirely**

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  Q: 'questBoard',
  W: 'well',
  n: 'treeGapNorth',
  s: 'treeGapSouth',
  e: 'treeGapEast',
  w: 'treeGapWest',
};

// Grown again 2026-09-03 (16x12 -> 20x14) alongside replacing the single
// south-ish door with 4 unmarked tree-gap exits, one centered on each
// wall - see docs/superpowers/specs/2026-09-03-town-exits-and-signage-
// design.md. Previously grown 2026-08-29 from the original 8x6 (see the
// history that used to live in this comment) when the viewport itself
// grew in 0.7.1 and made the old size read as tiny. Still just a hub,
// not exploration content - Timothy can hand-tune this layout further
// the same way he did last time.
const ROWS = [
  '##########n#########',
  '#..................#',
  '#....Q.............#',
  '#..................#',
  '#..................#',
  '#...S.........M....#',
  '#..................#',
  'w..................e',
  '#..................#',
  '#.............W....#',
  '#..................#',
  '#..................#',
  '#..................#',
  '##########s#########',
];

export const townMap = {
  id: 'town',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 10, y: 10 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
};
```

Note: `js/systems/portal.js`'s `TOWN_PORTAL_POSITION` is `{x: 7, y: 4}` — row 4, column 7 in the grid above is plain `.` (grass), so it's still valid; no change needed there.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/tiles.js js/maps/townMap.js tests/maps.test.js
git commit -m "feat: replace town's door with 4 directional tree-gap exits, resize to 20x14

Claude-Session: https://claude.ai/code/session_012MRYhk1NfhwNHLcmvhfXLh"
```

---

## Task 2: Route the 4 new exits in `main.js`

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `TILES.treeGapNorth`/etc.'s `action` values from Task 1 (`exitTownNorth`/`South`/`East`/`West`); the existing `enterMap(mapId, position)` function (`js/main.js`, unchanged signature).
- Produces: nothing consumed by a later task — this is the terminal handler for the new actions.

No automated test for this step: `handleTileAction`'s routing branches (`enterShop`, `enterSmith`, `bossBattle`, the existing `exitMap` dungeon/tool-dungeon branches, etc.) have no unit test coverage anywhere in this codebase today — `main.js` isn't imported by any test file, and `mapScreenDom.test.js` calls `mapScreen.js`'s `mount()` directly with its own stub callbacks, bypassing `main.js` entirely. This task follows that same existing precedent rather than inventing new test infrastructure for just this one set of branches. Verify manually per Step 3 below.

- [ ] **Step 1: Add the `TOWN_ENTRANCE` constant**

In `js/main.js`, right after the existing `const WORLD_GRID = buildWorldGrid(MAPS);` line:

```js
const WORLD_GRID = buildWorldGrid(MAPS);

// The @ tile's fixed position on 'center' - town's only real link to the
// wilderness (see docs/superpowers/specs/2026-09-03-town-exits-and-
// signage-design.md). All 4 town exits land 1 tile out from this point
// in the matching direction; verified walkable on all 4 sides by
// tests/maps.test.js's "center screen has open, walkable ground..." test.
const TOWN_ENTRANCE = { x: 14, y: 12 };
```

- [ ] **Step 2: Replace the `exitMap` handler and add the 4 new branches**

Find this block in `handleTileAction`:

```js
  if (action === 'exitMap') {
    if (state.map === 'town') return enterMap('center');
    // Land back on the exact entrance tile, not the destination screen's
    // generic startPosition - otherwise leaving a dungeon drops the player
    // somewhere else on the screen entirely, with no immediate way back to
    // use whatever the dungeon just gave them (e.g. a tool-dungeon's own
    // shortcut, raised 2026-08-28).
    if (state.map === 'dungeon') {
      const { screenId, x, y } = state.dungeonEntrancePosition;
      return enterMap(screenId, { x, y });
    }
    for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
      if (state.map === toolEntrance.mapId) {
        return enterMap(toolEntrance.screenId, { x: toolEntrance.x, y: toolEntrance.y });
      }
    }
    return;
  }
```

Replace it with (the `state.map === 'town'` line is gone — town no longer produces an `'exitMap'` action at all, only dungeons and tool dungeons do):

```js
  if (action === 'exitTownNorth') return enterMap('center', { x: TOWN_ENTRANCE.x, y: TOWN_ENTRANCE.y - 1 });
  if (action === 'exitTownSouth') return enterMap('center', { x: TOWN_ENTRANCE.x, y: TOWN_ENTRANCE.y + 1 });
  if (action === 'exitTownEast') return enterMap('center', { x: TOWN_ENTRANCE.x + 1, y: TOWN_ENTRANCE.y });
  if (action === 'exitTownWest') return enterMap('center', { x: TOWN_ENTRANCE.x - 1, y: TOWN_ENTRANCE.y });
  if (action === 'exitMap') {
    // Land back on the exact entrance tile, not the destination screen's
    // generic startPosition - otherwise leaving a dungeon drops the player
    // somewhere else on the screen entirely, with no immediate way back to
    // use whatever the dungeon just gave them (e.g. a tool-dungeon's own
    // shortcut, raised 2026-08-28).
    if (state.map === 'dungeon') {
      const { screenId, x, y } = state.dungeonEntrancePosition;
      return enterMap(screenId, { x, y });
    }
    for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
      if (state.map === toolEntrance.mapId) {
        return enterMap(toolEntrance.screenId, { x: toolEntrance.x, y: toolEntrance.y });
      }
    }
    return;
  }
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev` (or whatever this repo's local dev server command is — check `package.json`'s `scripts` if unsure)

In the browser: start/load a game, walk into town, and walk out through each of the 4 gaps (north, south, east, west — the openings at the middle of each wall). Confirm each one drops you onto `center`, immediately outside town in the matching direction, and that walking back through the entrance (`@`) returns you to town. Confirm no console errors.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: route town's 4 directional exits to the matching side of the town entrance

Claude-Session: https://claude.ai/code/session_012MRYhk1NfhwNHLcmvhfXLh"
```

---

## Task 3: Signposts + grass-background rendering, with DOM tests

**Files:**
- Modify: `js/screens/mapScreen.js`
- Modify: `css/styles.css`
- Modify: `tests/mapScreenDom.test.js`

**Interfaces:**
- Consumes: `TILES.treeGapNorth`/etc. and `TILES.shop`/`smith`/`questBoard`/`well` (already imported in `mapScreen.js` via `import { TILES } from '../tiles.js'`).
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Write the failing tests in `tests/mapScreenDom.test.js`**

Add a new top-level test block. This file already has a `mountTown(state)` helper (see the top of the file) that mounts town with `callbacks: { onFirstVisit: () => {} }` — the new block below needs its own mount call with `onMove`/`onAction` added, so don't reuse `mountTown` directly for the action-dispatch sub-tests.

```js
test('mapScreen DOM - town exits and signage', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  async function mountTownWithActionCapture(position) {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    let capturedAction = null;
    mount(root, {
      state: baseState({ position }),
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onMove: () => {}, onAction: (action) => { capturedAction = action; } },
    });
    return { root, getAction: () => capturedAction };
  }

  await t.test('walking onto the north gap fires exitTownNorth', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 10, y: 1 });
    keydown('ArrowUp');
    assert.equal(getAction(), 'exitTownNorth');
  });

  await t.test('walking onto the south gap fires exitTownSouth', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 10, y: 12 });
    keydown('ArrowDown');
    assert.equal(getAction(), 'exitTownSouth');
  });

  await t.test('walking onto the west gap fires exitTownWest', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 1, y: 7 });
    keydown('ArrowLeft');
    assert.equal(getAction(), 'exitTownWest');
  });

  await t.test('walking onto the east gap fires exitTownEast', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 18, y: 7 });
    keydown('ArrowRight');
    assert.equal(getAction(), 'exitTownEast');
  });

  await t.test('no door emoji renders anywhere in town', async () => {
    const root = await mountTown(baseState());
    assert.ok(!root.textContent.includes('🚪'), 'town should not render the door emoji anymore');
  });

  await t.test('all 4 town features get a signpost with the right label, and nothing else does', async () => {
    const root = await mountTown(baseState());
    const signposts = [...root.querySelectorAll('.map-tile-signpost')];
    const labels = signposts.map((el) => el.textContent).sort();
    assert.deepEqual(labels, ['Blacksmith', 'Quest Board', 'Shop', 'Well']);
  });
});
```

Add `import { buildWorldGrid } from '../js/systems/worldGrid.js';` to this file's imports if not already present (it already is, per the existing `mountTown` helper).

- [ ] **Step 2: Run the tests to verify the signage ones fail**

Run: `npm run test`
Expected: The 4 `exitTownX` action-dispatch tests PASS already — they only depend on Task 1's tile data plus `mapScreen.js`'s existing generic `if (tile.action) callbacks.onAction(tile.action)` dispatch, not on Task 2's `main.js` routing (this test's own stub `onAction` callback bypasses `main.js` entirely, same as every other test in this file). The 'no door emoji' test PASSES already too (Task 1 already removed `exit` from town's legend). The 'all 4 town features get a signpost' test FAILS — `.map-tile-signpost` doesn't exist yet.

- [ ] **Step 3: Add `GRASS_CONTEXT_MARKERS` entries and the signpost lookup in `js/screens/mapScreen.js`**

Add the 4 new tile kinds to the existing `GRASS_CONTEXT_MARKERS` set (around line 107-118):

```js
const GRASS_CONTEXT_MARKERS = new Set([
  TILES.townEntrance,
  TILES.dungeonEntrance,
  TILES.axeDungeonEntrance,
  TILES.pickDungeonEntrance,
  TILES.canoeDungeonEntrance,
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
  TILES.treeGapNorth,
  TILES.treeGapSouth,
  TILES.treeGapEast,
  TILES.treeGapWest,
]);
```

Add a new lookup near the other tile-kind constants at the top of the file (e.g. right after `MOUNT_EMOJI_FOR_TOOL`):

```js
// Town's always-on signpost labels (see docs/superpowers/specs/2026-09-03-
// town-exits-and-signage-design.md) - keyed by tile identity, not gated on
// mapConfig.id === 'town', since these 4 tile kinds only ever appear in
// js/maps/townMap.js's own legend.
const SIGN_LABEL_BY_TILE = new Map([
  [TILES.shop, 'Shop'],
  [TILES.smith, 'Blacksmith'],
  [TILES.questBoard, 'Quest Board'],
  [TILES.well, 'Well'],
]);
```

- [ ] **Step 4: Append the signpost in the render loop**

In the per-cell render loop, right before `grid.appendChild(cell);` (the very end of the loop body, after the `else if (emoji) { cell.append(emoji); }` branch and the `cell.title = ...` line):

```js
      cell.title = hasMiniDungeon ? MINI_DUNGEON_MARKER_DESCRIPTION : hasTileCache ? CACHE_MARKER_DESCRIPTION : tile.description;
      const signLabel = SIGN_LABEL_BY_TILE.get(tile);
      if (signLabel) {
        const signpost = document.createElement('span');
        signpost.className = 'map-tile-signpost';
        signpost.textContent = signLabel;
        cell.appendChild(signpost);
      }
      grid.appendChild(cell);
```

- [ ] **Step 5: Add the CSS rule**

In `css/styles.css`, right after `.map-tile-decoration`'s rule block:

```css
/* Town's always-on in-world label for shop/smith/quest-board/well - a
   short wooden plank anchored to the top of the tile, overflowing
   upward into the row above (same visual trick .map-tile-obstacle uses
   to overlap into the row above it) so it reads as planted next to the
   feature rather than fighting its emoji for space. Text is set inline
   per tile - see SIGN_LABEL_BY_TILE in js/screens/mapScreen.js. */
.map-tile-signpost {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  background: #8a5a2b;
  border: 1px solid #5c3a19;
  color: #fff5e0;
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 0.6rem;
  font-weight: 700;
  white-space: nowrap;
  line-height: 1.4;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
```

- [ ] **Step 6: Run the tests to verify they all pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add js/screens/mapScreen.js css/styles.css tests/mapScreenDom.test.js
git commit -m "feat: always-on wooden signposts over town's shop/smith/quest board/well

Claude-Session: https://claude.ai/code/session_012MRYhk1NfhwNHLcmvhfXLh"
```

---

## Task 4: Changelog entries + version bump

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `js/data/playerChangelog.js`

Per this repo's own `CLAUDE.md` versioning checklist: every push needs an `Unreleased` → dated version bump, and a matching player-facing entry. This is a player-visible feature change (new exits, resized town, signposts), so it's a MINOR bump — check `CHANGELOG.md`'s own header for the exact MINOR-vs-PATCH rule and the current version number before picking the next one.

- [ ] **Step 1: Add the `CHANGELOG.md` entry**

Read `CHANGELOG.md`'s current `## [Unreleased]` section (if any) and the most recent version entry first, to match this repo's existing entry style and confirm the next version number. Add a dated section describing: the 4 directional tree-gap exits replacing the single door, the town resize to 20x14, and the always-on signposts, referencing `docs/superpowers/specs/2026-09-03-town-exits-and-signage-design.md`.

- [ ] **Step 2: Add the matching `js/data/playerChangelog.js` entry**

Add a new entry at the top of the `PLAYER_CHANGELOG` array (newest first) with the same version number, player-facing wording only (e.g. "Town now has 4 exits — one on each side — and always shows a sign over the shop, blacksmith, quest board, and well.").

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS, including `tests/versionSync.test.js` (fails if `CHANGELOG.md`'s newest version and `PLAYER_CHANGELOG[0].version` don't match).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md js/data/playerChangelog.js
git commit -m "docs: changelog entry for town exits/signage rework

Claude-Session: https://claude.ai/code/session_012MRYhk1NfhwNHLcmvhfXLh"
```
