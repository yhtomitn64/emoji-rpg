# Discoverable Loot Caches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ambient, low-chance discovery of loot caches while exploring — a step onto an eligible tile can reveal a small stash of gold (and sometimes an item), permanently marking that tile with 📦 and showing a non-blocking banner, capped per screen.

**Architecture:** A new pure, DOM-free `js/systems/caches.js` module (constants + immutable-update functions + a loot roll) mirrors the existing `exploration.js`/`screenSeen.js` pattern and is fully unit-tested without any DOM setup. `state.caches` is added to the save schema the same way `state.visited` already exists. Each map file gets a new `cacheChance` field alongside its existing `encounterChance`. `mapScreen.js`'s `tryMove()` rolls for a cache before rolling for a monster encounter (mutually exclusive per step) and `render()` overlays the 📦 marker on any tile with a recorded cache; `main.js` gets a new `onCacheFound` callback that applies the loot to state and shows the banner, following the exact same callback-driven shape as the existing `onEncounter`/`onAction` callbacks.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- `CACHE_CAP_PER_SCREEN = 3` — a single global constant, not per-map.
- `CACHE_ITEM_CHANCE = 0.3`, item picked uniformly from `CACHE_ITEM_POOL = ['potion', 'leatherScrap', 'batWing', 'snakeFang', 'ironScrap', 'wolfPelt', 'spiderSilk', 'orcTusk', 'wraithEssence']`.
- Gold reward is `5 + Math.floor(rng() * 11)` (5–15 inclusive).
- `cacheChance` per map: `0` for town, `0.03` for all 9 wilderness screens, `0.04` for the dungeon.
- Cache and monster-encounter rolls are mutually exclusive on the same step — cache is checked first; a cache hit skips that step's encounter roll entirely.
- A cache, once recorded, is permanent and one-time-only — no further reward or interaction from revisiting that tile.
- Marker emoji is 📦, which replaces the tile's normal emoji in rendering only (the underlying map data/tile type is never modified).

---

### Task 1: `js/systems/caches.js` — pure cache logic

**Files:**
- Create: `js/systems/caches.js`
- Test: `tests/caches.test.js`

**Interfaces:**
- Produces: `CACHE_CAP_PER_SCREEN` (number, `3`), `CACHE_ITEM_CHANCE` (number, `0.3`), `CACHE_ITEM_POOL` (string array, the 9 items listed in Global Constraints), `hasCache(caches, screenId, x, y)` → boolean, `countCaches(caches, screenId)` → number, `recordCache(caches, screenId, x, y)` → new caches object (immutable), `rollCacheLoot(rng = Math.random)` → `{ gold, item }` where `item` is a string or `null`. Task 4 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `tests/caches.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_CAP_PER_SCREEN,
  CACHE_ITEM_CHANCE,
  CACHE_ITEM_POOL,
  hasCache,
  countCaches,
  recordCache,
  rollCacheLoot,
} from '../js/systems/caches.js';

test('constants match the design', () => {
  assert.equal(CACHE_CAP_PER_SCREEN, 3);
  assert.equal(CACHE_ITEM_CHANCE, 0.3);
  assert.deepEqual(CACHE_ITEM_POOL, [
    'potion', 'leatherScrap', 'batWing', 'snakeFang', 'ironScrap', 'wolfPelt', 'spiderSilk', 'orcTusk', 'wraithEssence',
  ]);
});

test('recordCache marks a tile as having a cache for a given screen, immutably', () => {
  const caches = {};
  const next = recordCache(caches, 'center', 3, 4);
  assert.equal(hasCache(next, 'center', 3, 4), true);
  assert.deepEqual(caches, {});
});

test('hasCache returns false for tiles without a cache and unknown screens', () => {
  const caches = { center: { '3,4': true } };
  assert.equal(hasCache(caches, 'center', 5, 5), false);
  assert.equal(hasCache(caches, 'unknown', 3, 4), false);
});

test('recordCache preserves previously recorded caches on the same screen', () => {
  let caches = recordCache({}, 'center', 1, 1);
  caches = recordCache(caches, 'center', 2, 2);
  assert.equal(hasCache(caches, 'center', 1, 1), true);
  assert.equal(hasCache(caches, 'center', 2, 2), true);
});

test('countCaches counts caches on a screen and returns 0 for unknown screens', () => {
  let caches = recordCache({}, 'center', 1, 1);
  caches = recordCache(caches, 'center', 2, 2);
  assert.equal(countCaches(caches, 'center'), 2);
  assert.equal(countCaches(caches, 'unknown'), 0);
});

test('rollCacheLoot rolls maximum gold and no item when both rolls miss high', () => {
  const loot = rollCacheLoot(() => 0.9999);
  assert.equal(loot.gold, 15);
  assert.equal(loot.item, null);
});

test('rollCacheLoot rolls minimum gold and the first pool item when both rolls hit low', () => {
  const values = [0, 0, 0];
  let i = 0;
  const rng = () => values[i++];
  const loot = rollCacheLoot(rng);
  assert.equal(loot.gold, 5);
  assert.equal(loot.item, 'potion');
});

test('rollCacheLoot picks the item by index when the item roll hits', () => {
  const values = [0.5, 0.1, 0.5];
  let i = 0;
  const rng = () => values[i++];
  const loot = rollCacheLoot(rng);
  assert.equal(loot.gold, 10);
  assert.equal(loot.item, 'ironScrap');
});

test('rollCacheLoot returns no item when the item roll exactly equals the chance threshold', () => {
  const values = [0.5, CACHE_ITEM_CHANCE];
  let i = 0;
  const rng = () => values[i++];
  const loot = rollCacheLoot(rng);
  assert.equal(loot.item, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/caches.js` does not exist yet, so the import throws.

- [ ] **Step 3: Implement `js/systems/caches.js`**

```js
export const CACHE_CAP_PER_SCREEN = 3;
export const CACHE_ITEM_CHANCE = 0.3;
export const CACHE_ITEM_POOL = [
  'potion', 'leatherScrap', 'batWing', 'snakeFang', 'ironScrap', 'wolfPelt', 'spiderSilk', 'orcTusk', 'wraithEssence',
];

export function hasCache(caches, screenId, x, y) {
  return Boolean(caches[screenId] && caches[screenId][`${x},${y}`]);
}

export function countCaches(caches, screenId) {
  return caches[screenId] ? Object.keys(caches[screenId]).length : 0;
}

export function recordCache(caches, screenId, x, y) {
  const key = `${x},${y}`;
  const screenCaches = { ...(caches[screenId] || {}), [key]: true };
  return { ...caches, [screenId]: screenCaches };
}

export function rollCacheLoot(rng = Math.random) {
  const gold = 5 + Math.floor(rng() * 11);
  let item = null;
  if (rng() < CACHE_ITEM_CHANCE) {
    item = CACHE_ITEM_POOL[Math.floor(rng() * CACHE_ITEM_POOL.length)];
  }
  return { gold, item };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 9 new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/systems/caches.js tests/caches.test.js
git commit -m "feat: add pure cache discovery logic"
```

---

### Task 2: `state.caches` in the save schema

**Files:**
- Modify: `js/state.js`
- Modify: `js/main.js:56-58`
- Modify: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: every state object (fresh or loaded) has a `caches` field of the same shape as `visited` (`{ [screenId]: { "x,y": true } }`). Task 4 reads/writes `state.caches` directly.

- [ ] **Step 1: Write the failing test**

In `tests/state.test.js`, extend the existing `'createNewGame returns a fresh default state'` test (do not add a new test — this is the same pattern the file already uses for checking default fields) by adding this line inside it, after the existing assertions:

```js
  assert.deepEqual(state.caches, {});
```

The full test should read:

```js
test('createNewGame returns a fresh default state', () => {
  const state = createNewGame();
  assert.equal(state.player.level, 1);
  assert.equal(state.player.gold, 20);
  assert.equal(state.map, 'center');
  assert.equal(state.equipment.weapon, 'starterSword');
  assert.deepEqual(state.caches, {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `state.caches` is `undefined`, `assert.deepEqual(undefined, {})` fails.

- [ ] **Step 3: Add `caches` to `createNewGame()` in `js/state.js`**

In `js/state.js`, change:

```js
    visited: {},
    seenScreens: {},
  };
}
```

to:

```js
    visited: {},
    seenScreens: {},
    caches: {},
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Backfill `state.caches` for existing saves in `js/main.js`**

In `js/main.js`, the load-time backward-compatibility block currently reads (lines 53-58):

```js
if (!state.visited) {
  state.visited = {};
}
if (!state.seenScreens) {
  state.seenScreens = {};
}
```

Change it to:

```js
if (!state.visited) {
  state.visited = {};
}
if (!state.seenScreens) {
  state.seenScreens = {};
}
if (!state.caches) {
  state.caches = {};
}
```

This has no automated test (this block has none for `visited`/`seenScreens` either — it's plain startup code with no test harness for `main.js` in this project). Verify by inspection only: confirm the added block matches the existing two exactly in shape.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/main.js tests/state.test.js
git commit -m "feat: add caches field to save state"
```

---

### Task 3: `cacheChance` on every map

**Files:**
- Modify: `js/maps/townMap.js:23`
- Modify: `js/maps/dungeonMap.js:27`
- Modify: `js/maps/wilderness/center.js:38`
- Modify: `js/maps/wilderness/north.js:33`
- Modify: `js/maps/wilderness/south.js:33`
- Modify: `js/maps/wilderness/east.js:33`
- Modify: `js/maps/wilderness/west.js:33`
- Modify: `js/maps/wilderness/northeast.js:33`
- Modify: `js/maps/wilderness/northwest.js:33`
- Modify: `js/maps/wilderness/southeast.js:33`
- Modify: `js/maps/wilderness/southwest.js:33`
- Modify: `tests/maps.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: every map object exported from these 11 files has a numeric `cacheChance` field. Task 4's `mapScreen.js` reads `mapConfig.cacheChance`.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/maps.test.js`, after the existing `'every wilderness screen border is walkable exactly where a neighbor exists'` test:

```js
test('every map has a valid cacheChance, and town has caches disabled', () => {
  const allMaps = { ...WILDERNESS, town: townMap, dungeon: dungeonMap };
  for (const [id, map] of Object.entries(allMaps)) {
    assert.equal(typeof map.cacheChance, 'number', `${id} cacheChance must be a number`);
    assert.ok(map.cacheChance >= 0 && map.cacheChance <= 1, `${id} cacheChance must be between 0 and 1`);
  }
  assert.equal(townMap.cacheChance, 0, 'town must have caches disabled');
  assert.equal(dungeonMap.cacheChance, 0.04, 'dungeon cacheChance must be 0.04');
  for (const [id, map] of Object.entries(WILDERNESS)) {
    assert.equal(map.cacheChance, 0.03, `${id} cacheChance must be 0.03`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `cacheChance` is `undefined` on every map, so `typeof map.cacheChance === 'number'` fails first.

- [ ] **Step 3: Add `cacheChance` to every map file**

In each file below, find the existing `encounterChance:` line at the given line number and add a `cacheChance:` line directly after it, with the exact value shown. Example for `js/maps/wilderness/north.js:33` (currently `  encounterChance: 0.1,`) becomes:

```js
  encounterChance: 0.1,
  cacheChance: 0.03,
```

Apply this same pattern (existing `encounterChance` line unchanged, new `cacheChance` line added directly below it) to all 11 files:

| File | Line | Existing `encounterChance` | Add `cacheChance` |
|---|---|---|---|
| `js/maps/townMap.js` | 23 | `0` | `0` |
| `js/maps/dungeonMap.js` | 27 | `0.25` | `0.04` |
| `js/maps/wilderness/center.js` | 38 | `0` | `0.03` |
| `js/maps/wilderness/north.js` | 33 | `0.1` | `0.03` |
| `js/maps/wilderness/south.js` | 33 | `0.1` | `0.03` |
| `js/maps/wilderness/east.js` | 33 | `0.1` | `0.03` |
| `js/maps/wilderness/west.js` | 33 | `0.1` | `0.03` |
| `js/maps/wilderness/northeast.js` | 33 | `0.15` | `0.03` |
| `js/maps/wilderness/northwest.js` | 33 | `0.15` | `0.03` |
| `js/maps/wilderness/southeast.js` | 33 | `0.15` | `0.03` |
| `js/maps/wilderness/southwest.js` | 33 | `0.15` | `0.03` |

Note every wilderness screen (including `center`, despite its `encounterChance: 0`) gets `cacheChance: 0.03` — this is deliberate per the approved design, not an oversight.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, all suites including the new maps.test.js test.

- [ ] **Step 5: Commit**

```bash
git add js/maps/townMap.js js/maps/dungeonMap.js js/maps/wilderness/*.js tests/maps.test.js
git commit -m "feat: add cacheChance to every map"
```

---

### Task 4: Wire cache discovery into `mapScreen.js` and `main.js`

**Files:**
- Modify: `js/screens/mapScreen.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `hasCache`, `countCaches`, `recordCache`, `rollCacheLoot`, `CACHE_CAP_PER_SCREEN` from `js/systems/caches.js` (Task 1); `state.caches` (Task 2); `mapConfig.cacheChance` (Task 3); `addGold(state, amount)` and `addItem(state, itemId, quantity)` from `js/systems/inventory.js` (pre-existing, same signatures already used in `handleBattleEnd`); `ITEMS[itemId].name` from `js/data/items.js` (pre-existing); `showFlavorBanner(text)` from `js/screens/flavorBanner.js` (pre-existing).
- Produces: `callbacks.onCacheFound(loot)` — a new callback shape (`loot` is `{ gold, item }` from `rollCacheLoot`), fired by `mapScreen.js` and handled by `main.js`'s new `handleCacheFound(loot)`.

This task has no dedicated automated test — `mapScreen.js` and `main.js` have no test files anywhere in this project (they're DOM-driving orchestration code with no test harness, same as `battleScreen.js`). Correctness here rests on the manual verification in Step 4 plus the fact that every piece of logic it calls (`caches.js`, `inventory.js`) is already unit-tested.

- [ ] **Step 1: Update `js/screens/mapScreen.js` imports and add the marker constant**

At the top of `js/screens/mapScreen.js`, change:

```js
import { TILES } from '../tiles.js';
import { directionFromDelta } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
```

to:

```js
import { TILES } from '../tiles.js';
import { directionFromDelta } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache, countCaches, recordCache, rollCacheLoot, CACHE_CAP_PER_SCREEN } from '../systems/caches.js';

const CACHE_MARKER_EMOJI = '📦';
```

- [ ] **Step 2: Update `render()` to show the cache marker**

In `js/screens/mapScreen.js`, change the `render()` function's inner loop body from:

```js
      const cell = document.createElement('div');
      const tile = tileAt(x, y);
      const isPlayer = state.position.x === x && state.position.y === y;
      cell.className = 'map-tile' + (isVisited(state.visited, mapConfig.id, x, y) ? ' visited' : '');
      cell.textContent = isPlayer ? '🧑' : tile.emoji;
```

to:

```js
      const cell = document.createElement('div');
      const tile = tileAt(x, y);
      const isPlayer = state.position.x === x && state.position.y === y;
      cell.className = 'map-tile' + (isVisited(state.visited, mapConfig.id, x, y) ? ' visited' : '');
      const emoji = hasCache(state.caches, mapConfig.id, x, y) ? CACHE_MARKER_EMOJI : tile.emoji;
      cell.textContent = isPlayer ? '🧑' : emoji;
```

- [ ] **Step 3: Update `tryMove()` to roll for and record caches**

In `js/screens/mapScreen.js`, replace the entire `tryMove` function body from `state.position = { x: nx, y: ny };` onward (the rest of the function is unchanged above that line) — i.e. replace:

```js
  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });

  // Render before firing any callback: an action may swap screens and an
  // encounter opens a battle *overlay* on top of this still-mounted map, so the
  // world underneath must already show the tile the player just stepped onto.
  render();

  callbacks.onMove(state.position);

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    callbacks.onEncounter(monsterId);
  }
}
```

with:

```js
  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });

  let cacheLoot = null;
  // Safe only because no tile.action tile also has tile.encounter: true (see js/tiles.js) — an
  // action tile hitting this branch would record a cache with no reward ever delivered.
  if (tile.encounter && shouldRevealCache(state.caches, mapConfig.id, nx, ny, mapConfig.cacheChance)) {
    Object.assign(state, { caches: recordCache(state.caches, mapConfig.id, nx, ny) });
    cacheLoot = rollCacheLoot();
  }

  // Render before firing any callback: an action may swap screens and an
  // encounter opens a battle *overlay* on top of this still-mounted map, so the
  // world underneath must already show the tile the player just stepped onto
  // (including a freshly discovered cache marker).
  render();

  callbacks.onMove(state.position);

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (cacheLoot) {
    callbacks.onCacheFound(cacheLoot);
    return;
  }

  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    callbacks.onEncounter(monsterId);
  }
}
```

Note the cache roll and the encounter roll are mutually exclusive by construction: `cacheLoot` is only truthy when the cache branch already fired, and the final `if` block only runs when `cacheLoot` is falsy (the `if (cacheLoot) { ...; return; }` above it exits first).

**Post-ship update:** this `if` condition originally shipped without a `!hasCache(...)` check, causing duplicate rewards on revisit — fixed in commit `336a840` by adding that check directly into the condition. A later whole-branch review flagged that the condition (the one place a real bug had already landed) had zero automated test coverage, since it lived inside this DOM-driving function. The four-clause decision was subsequently extracted into a pure, independently testable `shouldRevealCache(caches, screenId, x, y, cacheChance, rng = Math.random)` function in `js/systems/caches.js` (with `Math.random()` becoming an injectable `rng` parameter), and `tryMove()` was updated to call it as shown above. See `tests/caches.test.js` for the regression coverage this added.

- [ ] **Step 4: Wire `onCacheFound` into `js/main.js`**

In `js/main.js`, change the `goToMap()` function's callbacks object from:

```js
    callbacks: {
      onMove: () => saveState(state),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
    },
```

to:

```js
    callbacks: {
      onMove: () => saveState(state),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
      onCacheFound: handleCacheFound,
    },
```

Then add a new `handleCacheFound` function in `js/main.js`, placed directly after the existing `handleFirstVisit` function (after its closing brace, before `function goToShop()`):

```js
function handleCacheFound(loot) {
  Object.assign(state, addGold(state, loot.gold));
  let message = `You found a stash: ${loot.gold} gold`;
  if (loot.item) {
    Object.assign(state, addItem(state, loot.item, 1));
    message += `, 1 ${ITEMS[loot.item].name}`;
  }
  message += '!';
  showFlavorBanner(message);
  saveState(state);
  renderHud();
}
```

`addGold`, `addItem`, `ITEMS`, and `showFlavorBanner` are all already imported at the top of `js/main.js` (used identically in `handleBattleEnd` and `handleFirstVisit`) — no new imports needed for this step.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions (this task adds no new automated tests but must not break existing ones).

- [ ] **Step 6: Manual verification**

Run: `python3 -m http.server` from the repo root, open `http://localhost:8000` in a browser.

- Walk around any wilderness screen for a while and confirm normal play (movement, monster encounters, town/shop/smith/dungeon entry) still works exactly as before — this task touches the same `tryMove`/`render` functions every other interaction goes through, so a regression here would be highly visible.
- Cache discovery is rare (3-4% per step) — to verify it end-to-end without an extended play session, temporarily edit one wilderness map file's `cacheChance` from `0.03` to `1` (e.g. `js/maps/wilderness/north.js`), reload, and take one step onto any grass tile. Confirm: a banner appears reading "You found a stash: N gold!" (or "...N gold, 1 <Item Name>!"), the gold shown in the HUD increases by that amount, and the tile you just stepped onto now permanently shows 📦 instead of grass. Step off and back onto that same tile — confirm no second banner and no additional reward. Reload the page (localStorage persistence) — confirm the 📦 marker is still there.
- Confirm the cap: with `cacheChance` still at `1`, keep walking onto new tiles — after 3 caches are found on that screen, further steps should never trigger a 4th (no banner, no marker) even though the forced chance is 100%.
- **Revert the temporary `cacheChance: 1` edit back to `0.03` before committing** — this was a local-only testing aid, not part of the shipped change.

- [ ] **Step 7: Commit**

```bash
git add js/screens/mapScreen.js js/main.js
git commit -m "feat: wire discoverable loot caches into map exploration"
```

---

## Self-Review Notes

- **Spec coverage:** Ambient per-step roll (Task 4), mutual exclusivity with encounters (Task 4), per-screen cap (Task 1's `CACHE_CAP_PER_SCREEN` + Task 4's use of `countCaches`), reward shape (Task 1's `rollCacheLoot`), non-blocking banner (Task 4 Step 4, reusing `showFlavorBanner`), permanent 📦 marker (Task 4 Steps 2-3), `state.caches` persistence including backward-compat for existing saves (Task 2), per-map `cacheChance` values including town's exclusion (Task 3) — all covered. Mini-dungeons are explicitly out of scope per the design and are not referenced anywhere in this plan.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code or an exact table of values.
- **Type consistency:** `rollCacheLoot()` returns `{ gold, item }` — used identically in Task 1's tests, Task 4's `cacheLoot` variable, and `handleCacheFound(loot)`'s destructuring-by-property-access. `hasCache`/`countCaches`/`recordCache` all take `(caches, screenId, x, y)` (or `(caches, screenId)` for `countCaches`) consistently between Task 1's definitions, its own tests, and Task 4's call sites. `mapConfig.cacheChance` (Task 3) matches the property name read in Task 4's `tryMove()`.
