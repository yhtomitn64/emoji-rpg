# Randomized Dungeon Entrance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the dungeon entrance from one hardcoded tile on the southeast wilderness screen to a position rolled once per save among the 4 corner screens' grass tiles.

**Architecture:** A new pure module picks a random `{screenId, x, y}` from the 4 corner maps. `state.js` carries a `dungeonEntrancePosition` field (defaulted to the historical southeast `(24,10)` spot for backward compatibility). `saveSlots.js`'s `createSlot()` is the one real call site that rolls a fresh position for new characters. `mapScreen.js`'s existing `tileAt(x, y)` chokepoint checks the override before falling back to static map data, so rendering/walkability/entry-trigger all pick it up for free. The static `D` tile is removed from `southeast.js` so it's plain grass like the other 3 corners.

**Tech Stack:** Vanilla JS ES modules, `node:test` + `node:assert/strict`, no build step.

**Spec:** `docs/superpowers/specs/2026-08-18-randomized-dungeon-entrance-design.md`

## Global Constraints

- `dungeonEntrance.js` is a pure module: it takes `cornerMaps` as a parameter, never imports map data itself, and takes an injectable `rng` defaulting to `Math.random`.
- The default position `{ screenId: 'southeast', x: 24, y: 10 }` must match the exact historical tile — this is both the `createNewGame` default and the legacy-save backfill value.
- `state.dungeonEntrancePosition` is set once at creation and never reassigned afterward — no code path in this plan mutates it after creation.
- Every existing test that calls `createNewGame()` with no second argument must keep passing unchanged.

---

### Task 1: `pickRandomEntrancePosition` pure module

**Files:**
- Create: `js/systems/dungeonEntrance.js`
- Test: `tests/dungeonEntrance.test.js`

**Interfaces:**
- Produces: `CORNER_SCREEN_IDS` (array of 4 strings: `'northeast'`, `'northwest'`, `'southeast'`, `'southwest'`), `pickRandomEntrancePosition(cornerMaps, rng = Math.random)` returning `{ screenId, x, y }`. `cornerMaps` is `{ northeast, northwest, southeast, southwest }` where each value is a map object with `.rows` (array of strings) and `.legend` (char → tile-type string).

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORNER_SCREEN_IDS, pickRandomEntrancePosition } from '../js/systems/dungeonEntrance.js';
import { northeastMap } from '../js/maps/wilderness/northeast.js';
import { northwestMap } from '../js/maps/wilderness/northwest.js';
import { southeastMap } from '../js/maps/wilderness/southeast.js';
import { southwestMap } from '../js/maps/wilderness/southwest.js';

const realCornerMaps = { northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap };

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('CORNER_SCREEN_IDS lists exactly the 4 corner screens', () => {
  assert.deepEqual(CORNER_SCREEN_IDS, ['northeast', 'northwest', 'southeast', 'southwest']);
});

test('pickRandomEntrancePosition can select each of the 4 corner ids', () => {
  const fixtureMap = { rows: ['..', '..'], legend: { '.': 'grass' } };
  const cornerMaps = { northeast: fixtureMap, northwest: fixtureMap, southeast: fixtureMap, southwest: fixtureMap };
  for (let i = 0; i < 4; i++) {
    const rng = fixedRng([i / 4, 0]);
    const result = pickRandomEntrancePosition(cornerMaps, rng);
    assert.equal(result.screenId, CORNER_SCREEN_IDS[i]);
  }
});

test('pickRandomEntrancePosition always lands on a grass tile in the real corner maps', () => {
  for (const screenId of CORNER_SCREEN_IDS) {
    const index = CORNER_SCREEN_IDS.indexOf(screenId);
    const rng = fixedRng([index / 4, 0.5]);
    const result = pickRandomEntrancePosition(realCornerMaps, rng);
    assert.equal(result.screenId, screenId);
    const map = realCornerMaps[screenId];
    const char = map.rows[result.y][result.x];
    assert.equal(map.legend[char], 'grass');
  }
});

test('pickRandomEntrancePosition is deterministic given a fixed rng sequence', () => {
  const first = pickRandomEntrancePosition(realCornerMaps, fixedRng([0.1, 0.4]));
  const second = pickRandomEntrancePosition(realCornerMaps, fixedRng([0.1, 0.4]));
  assert.deepEqual(first, second);
});

test('pickRandomEntrancePosition uses Math.random by default', () => {
  const result = pickRandomEntrancePosition(realCornerMaps);
  assert.ok(CORNER_SCREEN_IDS.includes(result.screenId));
  assert.equal(typeof result.x, 'number');
  assert.equal(typeof result.y, 'number');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/dungeonEntrance.test.js`
Expected: FAIL — `js/systems/dungeonEntrance.js` does not exist (module not found error).

- [ ] **Step 3: Write the implementation**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/dungeonEntrance.test.js`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all prior tests still green plus the 5 new ones.

- [ ] **Step 6: Commit**

```bash
git add js/systems/dungeonEntrance.js tests/dungeonEntrance.test.js
git commit -m "feat: add pickRandomEntrancePosition pure module"
```

---

### Task 2: `state.js` default position + `createNewGame` second parameter

**Files:**
- Modify: `js/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DEFAULT_DUNGEON_ENTRANCE_POSITION` (exported const, `{ screenId: 'southeast', x: 24, y: 10 }`); `createNewGame(heroEmoji, dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION)` — returned state object gains a `dungeonEntrancePosition` field.

- [ ] **Step 1: Write the failing tests**

Add to `tests/state.test.js` (alongside the existing `createNewGame` tests):

```js
import { createNewGame, serializeState, deserializeState, saveState, loadState, slotSaveKey, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION } from '../js/state.js';
```

(replace the existing import line at the top of the file with this one, adding `DEFAULT_DUNGEON_ENTRANCE_POSITION`)

```js
test('createNewGame defaults dungeonEntrancePosition to the historical southeast spot', () => {
  const state = createNewGame();
  assert.deepEqual(state.dungeonEntrancePosition, DEFAULT_DUNGEON_ENTRANCE_POSITION);
  assert.deepEqual(state.dungeonEntrancePosition, { screenId: 'southeast', x: 24, y: 10 });
});

test('createNewGame uses an explicit dungeonEntrancePosition when passed', () => {
  const custom = { screenId: 'northwest', x: 3, y: 7 };
  const state = createNewGame(DEFAULT_HERO_EMOJI, custom);
  assert.deepEqual(state.dungeonEntrancePosition, custom);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/state.test.js`
Expected: FAIL — `dungeonEntrancePosition` is `undefined`, and `DEFAULT_DUNGEON_ENTRANCE_POSITION` is not exported.

- [ ] **Step 3: Write the implementation**

In `js/state.js`, add the new export near the top (after the existing `HERO_EMOJI_OPTIONS` const) and thread the new parameter through `createNewGame`:

```js
export const DEFAULT_DUNGEON_ENTRANCE_POSITION = { screenId: 'southeast', x: 24, y: 10 };
```

```js
export function createNewGame(heroEmoji = DEFAULT_HERO_EMOJI, dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION) {
  return {
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20, emoji: heroEmoji },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null },
    upgrades: {},
    inventory: [{ itemId: 'potion', quantity: 2 }],
    map: 'center',
    position: null,
    flags: { dungeonBossDefeated: false, firstKillCelebrated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
    ngPlusCycle: 0,
    questProgress: { boar: 0, bat: 0, snake: 0, goblin: 0, direWolf: 0, spider: 0, orc: 0, wraith: 0 },
    gateRewards: {},
    lossStreak: 0,
    dungeonEntrancePosition,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/state.test.js`
Expected: PASS, all tests green including the 2 new ones.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS. The `serializeState`/`deserializeState` round-trip test in `state.test.js` will exercise the new field automatically since it does a `deepEqual` on the whole state object — no separate round-trip test needed.

- [ ] **Step 6: Commit**

```bash
git add js/state.js tests/state.test.js
git commit -m "feat: add dungeonEntrancePosition to createNewGame"
```

---

### Task 3: Remove the static `D` tile from `southeast.js`

**Files:**
- Modify: `js/maps/wilderness/southeast.js`
- Test: `tests/maps.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `southeastMap.legend` no longer has a `D` key; `southeastMap.rows` no longer contains the character `D` anywhere; `southeastMap.legend` no longer maps anything to `'dungeonEntrance'`.

- [ ] **Step 1: Update the failing/changing test**

In `tests/maps.test.js`, replace the existing test (currently at line 203-208):

```js
test('center screen has the town entrance and southeast screen has the dungeon entrance', () => {
  const centerTileKeys = [...centerMap.rows.join('')].map((c) => centerMap.legend[c]);
  assert.ok(centerTileKeys.includes('townEntrance'));
  const southeastTileKeys = [...southeastMap.rows.join('')].map((c) => southeastMap.legend[c]);
  assert.ok(southeastTileKeys.includes('dungeonEntrance'));
});
```

with:

```js
test('center screen has the town entrance', () => {
  const centerTileKeys = [...centerMap.rows.join('')].map((c) => centerMap.legend[c]);
  assert.ok(centerTileKeys.includes('townEntrance'));
});

test('southeast screen has no static dungeon entrance tile — the entrance is a per-save override now', () => {
  assert.ok(!Object.values(southeastMap.legend).includes('dungeonEntrance'));
  assert.ok(!southeastMap.rows.join('').includes('D'));
});
```

- [ ] **Step 2: Run tests to verify the new assertions fail**

Run: `node --test tests/maps.test.js`
Expected: FAIL on the new `southeast screen has no static dungeon entrance tile` test — `southeastMap.legend` still has `D: 'dungeonEntrance'` and row 10 still contains `D`.

- [ ] **Step 3: Update the map data**

In `js/maps/wilderness/southeast.js`, change the legend line from:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water', D: 'dungeonEntrance' };
```

to:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };
```

And change row 10 (the row `'........................D....#'`) from:

```js
  '........................D....#',
```

to:

```js
  '.........................'.padEnd(30, '.') + '#',
```

Actually — write the row explicitly rather than computing it, to keep the map data as plain literal strings like every other row. Row 10 currently reads (24 dots, `D`, 4 dots, `#` — 30 chars total before the wall). Replace the single `D` at index 24 with `.`, giving a row of 30 dots followed by `#`:

```js
  '..............................#',
```

Count check: the existing row `'........................D....#'` is 24 dots + `D` + 4 dots + `#` = 30 characters. Replacing `D` with `.` gives 30 dots + `#` = 31 characters, which must match the width of every other row in `ROWS` (they are all `'.............................#'` — 29 dots + `#` = 30 characters, or with water/tree segments, still 30 wide total). Before editing, count the exact width of a neighboring row (e.g. row 0) and match it exactly — the replacement must be the same length as the row it replaces, just with `D` swapped for `.`, not recomputed from a fresh count.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/maps.test.js`
Expected: PASS, including the map-width/rectangularity tests elsewhere in the same file (they'll fail loudly if the row length was changed rather than just the one character).

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/maps/wilderness/southeast.js tests/maps.test.js
git commit -m "feat: remove static dungeon entrance tile from southeast screen"
```

---

### Task 4: Wire `pickRandomEntrancePosition` into `createSlot()`

**Files:**
- Modify: `js/systems/saveSlots.js`
- Test: `tests/saveSlots.test.js`

**Interfaces:**
- Consumes: `pickRandomEntrancePosition(cornerMaps, rng)` and `CORNER_SCREEN_IDS` from Task 1 (`js/systems/dungeonEntrance.js`); `createNewGame(heroEmoji, dungeonEntrancePosition)` from Task 2.
- Produces: `createSlot(name, heroEmoji, storage)` — its returned `state.dungeonEntrancePosition.screenId` is now one of `CORNER_SCREEN_IDS`, not always `'southeast'`.

- [ ] **Step 1: Write the failing test**

Add to `tests/saveSlots.test.js`. First add this import alongside the existing ones at the top of the file:

```js
import { CORNER_SCREEN_IDS } from '../js/systems/dungeonEntrance.js';
```

Then add the test:

```js
test('createSlot rolls a dungeonEntrancePosition on one of the 4 corner screens', () => {
  const storage = createFakeStorage();
  const { state } = createSlot('Hero', DEFAULT_HERO_EMOJI, storage);
  assert.ok(CORNER_SCREEN_IDS.includes(state.dungeonEntrancePosition.screenId));
  assert.equal(typeof state.dungeonEntrancePosition.x, 'number');
  assert.equal(typeof state.dungeonEntrancePosition.y, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/saveSlots.test.js`
Expected: This particular assertion actually passes trivially right now since `createNewGame`'s default (`southeast`) is itself one of the 4 corner ids — so instead verify the *wiring* is missing by checking the test fails for the right reason. Since the plain "is one of the 4 corners" check can't distinguish "always southeast" from "actually randomized," strengthen the test before running it:

```js
test('createSlot rolls a dungeonEntrancePosition on one of the 4 corner screens', () => {
  const storage = createFakeStorage();
  const seenScreenIds = new Set();
  for (let i = 0; i < 40; i++) {
    const { state } = createSlot(`Hero${i}`, DEFAULT_HERO_EMOJI, storage);
    assert.ok(CORNER_SCREEN_IDS.includes(state.dungeonEntrancePosition.screenId));
    seenScreenIds.add(state.dungeonEntrancePosition.screenId);
  }
  assert.ok(seenScreenIds.size > 1, 'expected createSlot to roll different corner screens across many calls, not always the same one');
});
```

Run: `node --test tests/saveSlots.test.js`
Expected: FAIL — `seenScreenIds.size` is 1 (always `'southeast'`, the `createNewGame` default), since `createSlot` doesn't yet call `pickRandomEntrancePosition`.

- [ ] **Step 3: Write the implementation**

In `js/systems/saveSlots.js`, add imports for the 4 corner maps and the picker function:

```js
import { createNewGame, saveState, slotSaveKey, STORAGE_KEY, deserializeState, DEFAULT_HERO_EMOJI } from '../state.js';
import { pickRandomEntrancePosition } from './dungeonEntrance.js';
import { northeastMap } from '../maps/wilderness/northeast.js';
import { northwestMap } from '../maps/wilderness/northwest.js';
import { southeastMap } from '../maps/wilderness/southeast.js';
import { southwestMap } from '../maps/wilderness/southwest.js';

const CORNER_MAPS = { northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap };
```

Then change `createSlot`'s body from:

```js
export function createSlot(name, heroEmoji = DEFAULT_HERO_EMOJI, storage = globalThis.localStorage) {
  const id = generateSlotId();
  const state = createNewGame(heroEmoji);
```

to:

```js
export function createSlot(name, heroEmoji = DEFAULT_HERO_EMOJI, storage = globalThis.localStorage) {
  const id = generateSlotId();
  const state = createNewGame(heroEmoji, pickRandomEntrancePosition(CORNER_MAPS));
```

(the rest of the function body is unchanged)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/saveSlots.test.js`
Expected: PASS — with 40 iterations and a true 1-in-4 random draw per call, `seenScreenIds.size > 1` passes with overwhelming probability (odds of all 40 landing on the same corner are `(1/4)^39`, astronomically small). All other existing `saveSlots.test.js` tests remain green since none of them assert a specific `dungeonEntrancePosition` value.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/systems/saveSlots.js tests/saveSlots.test.js
git commit -m "feat: roll a random dungeon entrance position for new save slots"
```

---

### Task 5: Make `mapScreen.js` respect the per-save override

**Files:**
- Modify: `js/screens/mapScreen.js:27-33`

**Interfaces:**
- Consumes: `state.dungeonEntrancePosition` (module-level `state` variable already set elsewhere in this file, per the existing pattern at line 16 `let state = null;`); `mapConfig.id` (module-level `mapConfig` variable, existing pattern at line 17); `TILES.dungeonEntrance` (already imported from `../tiles.js` at line 1, already exists as a tile type — used to be reached only via the `D` legend char, and the tile definition itself is unchanged by this plan).
- Produces: `tileAt(x, y)` now returns `TILES.dungeonEntrance` at the overridden position on the overridden screen, regardless of what the underlying map data says there.

This task is not independently unit-testable — `mapScreen.js` has no existing test file (it's a DOM-driving screen module, matching this codebase's established convention of leaving screen modules to manual/integration verification, same as `battleScreen.js`). Task 6 covers combined manual verification for this change together with the `main.js` backfill.

- [ ] **Step 1: Make the change**

In `js/screens/mapScreen.js`, replace the current `tileAt` function (lines 27-33):

```js
function tileAt(x, y) {
  const row = mapConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  return TILES[mapConfig.legend[char]];
}
```

with:

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

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS — no automated test exercises `mapScreen.js`'s `tileAt` directly, so this step confirms nothing elsewhere broke, not that this change works (Task 6 covers that manually).

- [ ] **Step 3: Commit**

```bash
git add js/screens/mapScreen.js
git commit -m "feat: make mapScreen render/walk/trigger the per-save dungeon entrance override"
```

---

### Task 6: Legacy-save backfill in `main.js`, plus full manual verification

**Files:**
- Modify: `js/main.js:112-114`

**Interfaces:**
- Consumes: `DEFAULT_DUNGEON_ENTRANCE_POSITION` from `js/state.js` (Task 2).
- Produces: `startGame()` backfills `state.dungeonEntrancePosition` for any save created before this feature shipped.

- [ ] **Step 1: Add the import**

In `js/main.js`, change the existing import line (line 1):

```js
import { loadState, saveState, DEFAULT_HERO_EMOJI } from './state.js';
```

to:

```js
import { loadState, saveState, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION } from './state.js';
```

- [ ] **Step 2: Add the backfill**

In `js/main.js`, in `startGame()`, immediately after the existing `lossStreak` backfill block (lines 112-114):

```js
  if (!state.lossStreak) {
    state.lossStreak = 0;
  }
```

add:

```js
  if (!state.dungeonEntrancePosition) {
    state.dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION;
  }
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all tests green (this codebase has no `main.js`-specific test file — `main.js` wires screens together and is verified manually, matching existing convention for `gateRewards`/`lossStreak` backfills before it).

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: backfill dungeonEntrancePosition for legacy saves"
```

- [ ] **Step 5: Manual verification — new characters land on varied corners**

Start the app locally (check `package.json` / README for the dev-server command used elsewhere in this project; if none is documented, serve the repo root with any static file server, e.g. `npx serve .` or `python3 -m http.server`). In the browser:

1. Create a new character (start screen → new game).
2. Open DevTools → Application → Local Storage, find the save's key (`emoji-rpg-save-<slot-id>`), and read the `dungeonEntrancePosition` field from the JSON value.
3. Delete that save, repeat steps 1-2 for 3-4 more characters.
4. Confirm `screenId` varies across characters (not always `southeast`) — with a true 1-in-4 roll per character, seeing at least 2 distinct screen ids across 4-5 characters is expected; if all land on the same screen, re-run once or twice before treating it as a bug (small samples can coincidentally repeat).

- [ ] **Step 6: Manual verification — the rolled tile actually works in-game**

For at least one of the characters created above:

1. Navigate the map screen to the corner wilderness screen named in that save's `dungeonEntrancePosition`.
2. Walk to the `(x, y)` coordinate from that field.
3. Confirm the 🕳️ (dungeon entrance) emoji renders at that tile.
4. Confirm the tile is walkable (the player can step onto it, unlike a tree or water tile).
5. Confirm stepping onto it triggers dungeon entry (the game transitions into the dungeon map).

- [ ] **Step 7: Manual verification — legacy saves are unaffected**

1. In DevTools → Application → Local Storage, take an existing save's JSON value (or a freshly created one), and manually delete the `dungeonEntrancePosition` key from it, then write it back under the same storage key.
2. Reload the app and load that save.
3. Confirm (via DevTools re-reading the saved JSON after loading, or by observing in-game) that `dungeonEntrancePosition` is now `{ screenId: 'southeast', x: 24, y: 10 }` — the historical spot — matching the backfill.
4. Navigate to southeast `(24, 10)` and confirm the entrance still renders/works there exactly as it did before this change.

- [ ] **Step 8: Manual verification — southeast is now plain grass absent the override**

For a save whose rolled `dungeonEntrancePosition.screenId` is NOT `southeast`, walk to southeast `(24, 10)` (the old static spot) and confirm it now renders as plain grass — no entrance there for that save.

---

## Self-Review Notes

- **Spec coverage:** All 6 "Wiring changes" bullets from the spec map 1:1 to Tasks 1, 2, 4, 5, 3, 6 respectively. The "Testing" section's `dungeonEntrance.test.js`, `state.test.js`, and `maps.test.js` items are Tasks 1-3; the spec's "Manual verification" bullet is Task 6 Steps 5-8.
- **Placeholder scan:** No TBD/TODO markers; every step has literal code or an exact manual procedure.
- **Type consistency:** `{ screenId, x, y }` shape is identical across `dungeonEntrance.js` (Task 1), `state.js` (Task 2), `saveSlots.js` (Task 4), `mapScreen.js` (Task 5), and `main.js` (Task 6) — no renaming drift.
- **Ordering:** Task 4 (saveSlots wiring) depends on both Task 1 (picker) and Task 2 (`createNewGame` second param) — placed after both. Task 5 (mapScreen) depends on Task 2 (`state.dungeonEntrancePosition` existing) and is independent of Task 3/4, but placed after them since manual verification in Task 6 needs the full chain (Tasks 1-5) working end-to-end. Task 3 (removing the static tile) is independent of the others and could run anywhere in the sequence; placed early since it's a pure data change with no dependencies.
