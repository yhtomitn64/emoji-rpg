# Mini-Dungeons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players discover, very rarely, a real nested cave mini-dungeon while exploring the wilderness — its own small map, orc/wraith fights, and one guaranteed treasure — reached and returned from via the same screen-swap mechanism the town/dungeon already use.

**Architecture:** A new pure `js/systems/miniDungeons.js` module (constants + immutable-update functions + rolls) mirrors `js/systems/caches.js`'s shape exactly. Three hand-authored interior maps are registered in `main.js`'s existing `MAPS` registry like any other map — `mapScreen.js`'s generic `mount()`/`render()`/`tryMove()` need no interior-specific logic, since an interior is mechanically just another map with its own action tiles (`exitMiniDungeon`, `collectTreasure`) routed through the existing `handleTileAction` dispatcher. The only new dynamic logic lives in `tryMove()`'s cache/encounter roll chain (a mini-dungeon entrance check is inserted with the highest priority, before caches) and in three new `main.js` handlers for entering, exiting, and collecting the interior's treasure.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- `MINI_DUNGEON_CAP_PER_SCREEN = 1` per wilderness screen (not per-map beyond that single global constant).
- `MINI_DUNGEON_VARIANT_IDS = ['miniDungeonA', 'miniDungeonB', 'miniDungeonC']`, one assigned uniformly at random per discovered entrance, permanently.
- `MINI_DUNGEON_TREASURE_ITEM_POOL = ['ironSword', 'ironHelm', 'ironArmor', 'ironGreaves', 'powerRing', 'luckyCharm']` — the treasure item is always granted (100% chance), unlike a cache's 30%.
- Treasure gold is `25 + Math.floor(rng() * 26)` (25–50 inclusive).
- `miniDungeonChance` is `0.005` on all 9 wilderness screens; town and the main dungeon do not get this field at all (not `0` — genuinely absent, matching how their maps have no `neighbors` field either when not applicable).
- Discovery and entry are the same event: a chance hit immediately assigns a variant, records the entrance, and enters it. A previously-discovered entrance re-enters the same way on every subsequent visit, with no separate "reveal" state.
- Mini-dungeon, cache, and encounter rolls are mutually exclusive per step, checked in that priority order (mini-dungeon first, then cache, then encounter) — exactly one outcome per step, at most.
- Interior monsters are always `['orc', 'wraith']` with `encounterChance: 0.2`, regardless of which wilderness screen the entrance was found on.
- Re-entering a mini-dungeon after the first visit still triggers orc/wraith encounters; the treasure tile only ever pays out once per discovered entrance.
- Interior tile palette: cave floor ⬛ (walkable, `encounter: true`), cave wall 🪨 (impassable), underground pool 💧 (impassable), entrance/exit 🪜 (walkable, `action: 'exitMiniDungeon'`, placed at `startPosition`), treasure 💰 (walkable, `action: 'collectTreasure'`). Overworld discovery marker: ⛏️, overlaid in rendering only (map data never mutated), same technique as the existing 📦 cache marker.

---

### Task 1: `js/systems/miniDungeons.js` — pure mini-dungeon logic

**Files:**
- Create: `js/systems/miniDungeons.js`
- Test: `tests/miniDungeons.test.js`

**Interfaces:**
- Produces: `MINI_DUNGEON_CAP_PER_SCREEN` (number, `1`), `MINI_DUNGEON_VARIANT_IDS` (string array, 3 ids), `MINI_DUNGEON_TREASURE_ITEM_POOL` (string array, 6 item ids), `hasMiniDungeonEntrance(miniDungeons, screenId, x, y)` → boolean, `countMiniDungeonEntrances(miniDungeons, screenId)` → number, `getMiniDungeonEntrance(miniDungeons, screenId, x, y)` → `{ variantId, treasureTaken } | undefined`, `isTreasureTaken(miniDungeons, screenId, x, y)` → boolean, `recordMiniDungeonEntrance(miniDungeons, screenId, x, y, variantId)` → new miniDungeons object (immutable), `markTreasureTaken(miniDungeons, screenId, x, y)` → new miniDungeons object (immutable), `shouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng = Math.random)` → boolean, `pickMiniDungeonVariant(rng = Math.random)` → one of `MINI_DUNGEON_VARIANT_IDS`, `rollMiniDungeonTreasure(rng = Math.random)` → `{ gold, item }` where `item` is always set (never `null`). Task 5 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `tests/miniDungeons.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MINI_DUNGEON_CAP_PER_SCREEN,
  MINI_DUNGEON_VARIANT_IDS,
  MINI_DUNGEON_TREASURE_ITEM_POOL,
  hasMiniDungeonEntrance,
  countMiniDungeonEntrances,
  getMiniDungeonEntrance,
  isTreasureTaken,
  recordMiniDungeonEntrance,
  markTreasureTaken,
  shouldRevealMiniDungeon,
  pickMiniDungeonVariant,
  rollMiniDungeonTreasure,
} from '../js/systems/miniDungeons.js';

test('constants match the design', () => {
  assert.equal(MINI_DUNGEON_CAP_PER_SCREEN, 1);
  assert.deepEqual(MINI_DUNGEON_VARIANT_IDS, ['miniDungeonA', 'miniDungeonB', 'miniDungeonC']);
  assert.deepEqual(MINI_DUNGEON_TREASURE_ITEM_POOL, [
    'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves', 'powerRing', 'luckyCharm',
  ]);
});

test('recordMiniDungeonEntrance records an entrance with its variant, immutably', () => {
  const miniDungeons = {};
  const next = recordMiniDungeonEntrance(miniDungeons, 'north', 5, 6, 'miniDungeonB');
  assert.equal(hasMiniDungeonEntrance(next, 'north', 5, 6), true);
  assert.deepEqual(getMiniDungeonEntrance(next, 'north', 5, 6), { variantId: 'miniDungeonB', treasureTaken: false });
  assert.deepEqual(miniDungeons, {});
});

test('hasMiniDungeonEntrance returns false for unrecorded tiles and unknown screens', () => {
  const miniDungeons = { north: { '5,6': { variantId: 'miniDungeonA', treasureTaken: false } } };
  assert.equal(hasMiniDungeonEntrance(miniDungeons, 'north', 1, 1), false);
  assert.equal(hasMiniDungeonEntrance(miniDungeons, 'unknown', 5, 6), false);
});

test('countMiniDungeonEntrances counts entrances on a screen and returns 0 for unknown screens', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(countMiniDungeonEntrances(miniDungeons, 'north'), 1);
  assert.equal(countMiniDungeonEntrances(miniDungeons, 'unknown'), 0);
});

test('getMiniDungeonEntrance returns undefined for unrecorded tiles', () => {
  assert.equal(getMiniDungeonEntrance({}, 'north', 5, 6), undefined);
});

test('markTreasureTaken marks the treasure taken without changing the variant, immutably', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonC');
  const next = markTreasureTaken(miniDungeons, 'north', 5, 6);
  assert.deepEqual(getMiniDungeonEntrance(next, 'north', 5, 6), { variantId: 'miniDungeonC', treasureTaken: true });
  assert.equal(getMiniDungeonEntrance(miniDungeons, 'north', 5, 6).treasureTaken, false);
});

test('isTreasureTaken reflects the treasureTaken flag and is false for unrecorded entrances', () => {
  assert.equal(isTreasureTaken({}, 'north', 5, 6), false);
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(isTreasureTaken(miniDungeons, 'north', 5, 6), false);
  const taken = markTreasureTaken(miniDungeons, 'north', 5, 6);
  assert.equal(isTreasureTaken(taken, 'north', 5, 6), true);
});

test('shouldRevealMiniDungeon returns false for a tile that already has an entrance, even under the cap', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(shouldRevealMiniDungeon(miniDungeons, 'north', 5, 6, 1, () => 0), false);
});

test('shouldRevealMiniDungeon returns false once the screen is at the cap, even for a fresh tile', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(shouldRevealMiniDungeon(miniDungeons, 'north', 9, 9, 1, () => 0), false);
});

test('shouldRevealMiniDungeon returns false when chance is 0, even for a fresh tile under the cap', () => {
  assert.equal(shouldRevealMiniDungeon({}, 'north', 5, 6, 0, () => 0), false);
});

test('shouldRevealMiniDungeon returns true for a fresh tile under the cap when the roll hits', () => {
  assert.equal(shouldRevealMiniDungeon({}, 'north', 5, 6, 1, () => 0), true);
});

test('pickMiniDungeonVariant picks by index across the full range', () => {
  assert.equal(pickMiniDungeonVariant(() => 0), 'miniDungeonA');
  assert.equal(pickMiniDungeonVariant(() => 0.5), 'miniDungeonB');
  assert.equal(pickMiniDungeonVariant(() => 0.9999), 'miniDungeonC');
});

test('rollMiniDungeonTreasure rolls gold in the 25-50 range and always includes an item', () => {
  const low = rollMiniDungeonTreasure(() => 0);
  assert.equal(low.gold, 25);
  assert.equal(low.item, 'ironSword');
  const high = rollMiniDungeonTreasure(() => 0.9999);
  assert.equal(high.gold, 50);
  assert.equal(high.item, 'luckyCharm');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/miniDungeons.js` does not exist yet, so the import throws.

- [ ] **Step 3: Implement `js/systems/miniDungeons.js`**

```js
export const MINI_DUNGEON_CAP_PER_SCREEN = 1;
export const MINI_DUNGEON_VARIANT_IDS = ['miniDungeonA', 'miniDungeonB', 'miniDungeonC'];
export const MINI_DUNGEON_TREASURE_ITEM_POOL = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves', 'powerRing', 'luckyCharm',
];

export function hasMiniDungeonEntrance(miniDungeons, screenId, x, y) {
  return Boolean(miniDungeons[screenId] && miniDungeons[screenId][`${x},${y}`]);
}

export function countMiniDungeonEntrances(miniDungeons, screenId) {
  return miniDungeons[screenId] ? Object.keys(miniDungeons[screenId]).length : 0;
}

export function getMiniDungeonEntrance(miniDungeons, screenId, x, y) {
  return miniDungeons[screenId] ? miniDungeons[screenId][`${x},${y}`] : undefined;
}

export function isTreasureTaken(miniDungeons, screenId, x, y) {
  const entrance = getMiniDungeonEntrance(miniDungeons, screenId, x, y);
  return Boolean(entrance && entrance.treasureTaken);
}

export function recordMiniDungeonEntrance(miniDungeons, screenId, x, y, variantId) {
  const key = `${x},${y}`;
  const screenEntrances = { ...(miniDungeons[screenId] || {}), [key]: { variantId, treasureTaken: false } };
  return { ...miniDungeons, [screenId]: screenEntrances };
}

export function markTreasureTaken(miniDungeons, screenId, x, y) {
  const key = `${x},${y}`;
  const existing = miniDungeons[screenId][key];
  const screenEntrances = { ...miniDungeons[screenId], [key]: { ...existing, treasureTaken: true } };
  return { ...miniDungeons, [screenId]: screenEntrances };
}

export function shouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng = Math.random) {
  return !hasMiniDungeonEntrance(miniDungeons, screenId, x, y)
    && countMiniDungeonEntrances(miniDungeons, screenId) < MINI_DUNGEON_CAP_PER_SCREEN
    && rng() < chance;
}

export function pickMiniDungeonVariant(rng = Math.random) {
  return MINI_DUNGEON_VARIANT_IDS[Math.floor(rng() * MINI_DUNGEON_VARIANT_IDS.length)];
}

export function rollMiniDungeonTreasure(rng = Math.random) {
  const gold = 25 + Math.floor(rng() * 26);
  const item = MINI_DUNGEON_TREASURE_ITEM_POOL[Math.floor(rng() * MINI_DUNGEON_TREASURE_ITEM_POOL.length)];
  return { gold, item };
}
```

Note `shouldRevealMiniDungeon` mirrors `js/systems/caches.js`'s `shouldRevealCache` exactly (same three-clause shape: not-already-there, under-cap, roll-hits) — this is deliberate, not incidental duplication; the two systems are independent (different state fields, different caps) but the same correctness pattern applies to both, and `caches.js` is not modified by this task.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 13 new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/systems/miniDungeons.js tests/miniDungeons.test.js
git commit -m "feat: add pure mini-dungeon discovery and treasure logic"
```

---

### Task 2: `state.miniDungeons` and `state.activeMiniDungeon` in the save schema

**Files:**
- Modify: `js/state.js`
- Modify: `js/main.js:59-61`
- Modify: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: every state object (fresh or loaded) has `miniDungeons` (object, same shape family as `visited`/`caches`: `{ [screenId]: { "x,y": { variantId, treasureTaken } } }`) and `activeMiniDungeon` (`{ screenId, x, y } | null`). Task 5 reads/writes both directly.

- [ ] **Step 1: Write the failing test**

In `tests/state.test.js`, extend the existing `'createNewGame returns a fresh default state'` test (do not add a new test — same pattern the file already uses) by adding these two lines inside it, after the existing assertions (including the `state.caches` line already there from the loot-caches build):

```js
  assert.deepEqual(state.miniDungeons, {});
  assert.equal(state.activeMiniDungeon, null);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — both new fields are `undefined`.

- [ ] **Step 3: Add both fields to `createNewGame()` in `js/state.js`**

In `js/state.js`, change:

```js
    visited: {},
    seenScreens: {},
    caches: {},
  };
}
```

to:

```js
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Backfill both fields for existing saves in `js/main.js`**

In `js/main.js`, the load-time backward-compatibility block currently ends with (lines 59-61):

```js
if (!state.caches) {
  state.caches = {};
}
```

Change it to:

```js
if (!state.caches) {
  state.caches = {};
}
if (!state.miniDungeons) {
  state.miniDungeons = {};
}
if (!state.activeMiniDungeon) {
  state.activeMiniDungeon = null;
}
```

(The third block reassigning `null` to an already-`null` value on a normal save is a harmless no-op — it exists only to backfill genuinely old saves that predate this field, matching the exact style of the three blocks above it.) No automated test covers this block (same as the three it's modeled on) — verify by inspection that the added lines match the existing pattern exactly.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/main.js tests/state.test.js
git commit -m "feat: add miniDungeons and activeMiniDungeon fields to save state"
```

---

### Task 3: Cave tiles and the 3 interior maps

**Files:**
- Modify: `js/tiles.js`
- Create: `js/maps/miniDungeons/variantA.js`
- Create: `js/maps/miniDungeons/variantB.js`
- Create: `js/maps/miniDungeons/variantC.js`
- Test: `tests/miniDungeonMaps.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: 5 new entries in `TILES` (`caveFloor`, `caveWall`, `cavePool`, `miniDungeonEntrance`, `miniDungeonTreasure`). 3 map objects (`miniDungeonVariantA`, `miniDungeonVariantB`, `miniDungeonVariantC`), each with `id` matching one of `MINI_DUNGEON_VARIANT_IDS` from Task 1 (`'miniDungeonA'`/`'miniDungeonB'`/`'miniDungeonC'`), `legend`, `rows`, `startPosition`, `encounterChance: 0.2`, `monsterTable: ['orc', 'wraith']`. Task 5 imports and registers all 3 in `main.js`'s `MAPS`.

- [ ] **Step 1: Write the failing tests**

Create `tests/miniDungeonMaps.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { miniDungeonVariantA } from '../js/maps/miniDungeons/variantA.js';
import { miniDungeonVariantB } from '../js/maps/miniDungeons/variantB.js';
import { miniDungeonVariantC } from '../js/maps/miniDungeons/variantC.js';
import { isWalkableAt } from '../js/systems/world.js';
import { MINI_DUNGEON_VARIANT_IDS } from '../js/systems/miniDungeons.js';

const VARIANTS = {
  miniDungeonA: miniDungeonVariantA,
  miniDungeonB: miniDungeonVariantB,
  miniDungeonC: miniDungeonVariantC,
};

function assertValidMap(map) {
  const width = map.rows[0].length;
  for (const row of map.rows) {
    assert.equal(row.length, width, `${map.id} rows must all be the same width`);
    for (const char of row) {
      assert.ok(map.legend[char], `${map.id} legend missing entry for '${char}'`);
      assert.ok(TILES[map.legend[char]], `${map.id} legend points to unknown tile '${map.legend[char]}'`);
    }
  }
  const { x, y } = map.startPosition;
  const tileKey = map.legend[map.rows[y][x]];
  assert.ok(TILES[tileKey].walkable, `${map.id} startPosition must be walkable`);
}

function assertFullyReachable(map) {
  const height = map.rows.length;
  const width = map.rows[0].length;
  const { x: startX, y: startY } = map.startPosition;

  const visited = new Set();
  const queue = [[startX, startY]];
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (!isWalkableAt(map, nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWalkableAt(map, x, y)) {
        assert.ok(
          visited.has(`${x},${y}`),
          `${map.id} tile (${x},${y}) is walkable but unreachable from startPosition`
        );
      }
    }
  }
}

test('every mini-dungeon variant is registered and matches MINI_DUNGEON_VARIANT_IDS', () => {
  assert.deepEqual(Object.keys(VARIANTS).sort(), [...MINI_DUNGEON_VARIANT_IDS].sort());
  for (const id of MINI_DUNGEON_VARIANT_IDS) {
    assert.equal(VARIANTS[id].id, id);
  }
});

test('every mini-dungeon variant is well-formed with a walkable start position', () => {
  for (const map of Object.values(VARIANTS)) {
    assertValidMap(map);
  }
});

test('every walkable tile in every mini-dungeon variant is reachable from startPosition', () => {
  for (const map of Object.values(VARIANTS)) {
    assertFullyReachable(map);
  }
});

test('every mini-dungeon variant has exactly one entrance/exit tile and exactly one treasure tile', () => {
  for (const map of Object.values(VARIANTS)) {
    const chars = map.rows.join('');
    const tileKeys = [...chars].map((c) => map.legend[c]);
    const entranceCount = tileKeys.filter((k) => k === 'miniDungeonEntrance').length;
    const treasureCount = tileKeys.filter((k) => k === 'miniDungeonTreasure').length;
    assert.equal(entranceCount, 1, `${map.id} must have exactly one entrance/exit tile`);
    assert.equal(treasureCount, 1, `${map.id} must have exactly one treasure tile`);
  }
});

test("every mini-dungeon variant's startPosition is its entrance/exit tile", () => {
  for (const map of Object.values(VARIANTS)) {
    const { x, y } = map.startPosition;
    const tileKey = map.legend[map.rows[y][x]];
    assert.equal(tileKey, 'miniDungeonEntrance', `${map.id} startPosition must be the entrance/exit tile`);
  }
});

test('every mini-dungeon variant uses the orc/wraith monster table at 0.2 encounter chance', () => {
  for (const map of Object.values(VARIANTS)) {
    assert.deepEqual(map.monsterTable, ['orc', 'wraith']);
    assert.equal(map.encounterChance, 0.2);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/tiles.js` doesn't have the new tile types yet and the 3 map files don't exist yet, so imports throw.

- [ ] **Step 3: Add the 5 new tile types to `js/tiles.js`**

In `js/tiles.js`, add these 5 entries directly before the closing `};` of the `TILES` object (after the existing `boss` entry):

```js
  caveFloor: { emoji: '⬛', walkable: true, encounter: true },
  caveWall: { emoji: '🪨', walkable: false, encounter: false },
  cavePool: { emoji: '💧', walkable: false, encounter: false },
  miniDungeonEntrance: { emoji: '🪜', walkable: true, encounter: false, action: 'exitMiniDungeon' },
  miniDungeonTreasure: { emoji: '💰', walkable: true, encounter: false, action: 'collectTreasure' },
```

- [ ] **Step 4: Create the 3 interior map files**

These three layouts have already been verified (equal row widths, fully walled borders, exactly one entrance/exit tile at `startPosition`, exactly one treasure tile, and full flood-fill reachability of every walkable tile from `startPosition`) — use them exactly as given, do not modify the `rows` content.

Create `js/maps/miniDungeons/variantA.js`:

```js
const LEGEND = {
  '.': 'caveFloor',
  '#': 'caveWall',
  '~': 'cavePool',
  E: 'miniDungeonEntrance',
  T: 'miniDungeonTreasure',
};

const ROWS = [
  '##############',
  '#E...........#',
  '#............#',
  '#..##....##..#',
  '#..##....##..#',
  '#............#',
  '#....~~......#',
  '#....~~....T.#',
  '#............#',
  '##############',
];

export const miniDungeonVariantA = {
  id: 'miniDungeonA',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.2,
  monsterTable: ['orc', 'wraith'],
};
```

Create `js/maps/miniDungeons/variantB.js`:

```js
const LEGEND = {
  '.': 'caveFloor',
  '#': 'caveWall',
  '~': 'cavePool',
  E: 'miniDungeonEntrance',
  T: 'miniDungeonTreasure',
};

const ROWS = [
  '##############',
  '#E....#......#',
  '#.....#......#',
  '#.....#......#',
  '#.........~~.#',
  '#.....#......#',
  '#.....#....T.#',
  '#.....#......#',
  '#.....#......#',
  '##############',
];

export const miniDungeonVariantB = {
  id: 'miniDungeonB',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.2,
  monsterTable: ['orc', 'wraith'],
};
```

Create `js/maps/miniDungeons/variantC.js`:

```js
const LEGEND = {
  '.': 'caveFloor',
  '#': 'caveWall',
  E: 'miniDungeonEntrance',
  T: 'miniDungeonTreasure',
};

const ROWS = [
  '##############',
  '#E...........#',
  '#.##.....##..#',
  '#.##.....##..#',
  '#............#',
  '#..##.....##.#',
  '#..##.....##.#',
  '#............#',
  '#...........T#',
  '##############',
];

export const miniDungeonVariantC = {
  id: 'miniDungeonC',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.2,
  monsterTable: ['orc', 'wraith'],
};
```

Note variant C's `LEGEND` has no `'~': 'cavePool'` entry — it doesn't use that character, so the entry is correctly omitted (an unused legend entry isn't wrong, but leaving it out here matches how existing map files only declare the characters they actually use).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 6 new tests in `tests/miniDungeonMaps.test.js` plus the full existing suite.

- [ ] **Step 6: Commit**

```bash
git add js/tiles.js js/maps/miniDungeons/ tests/miniDungeonMaps.test.js
git commit -m "feat: add cave tiles and 3 mini-dungeon interior maps"
```

---

### Task 4: `miniDungeonChance` on every wilderness screen

**Files:**
- Modify: `js/maps/wilderness/center.js:39`
- Modify: `js/maps/wilderness/north.js:34`
- Modify: `js/maps/wilderness/south.js:34`
- Modify: `js/maps/wilderness/east.js:34`
- Modify: `js/maps/wilderness/west.js:34`
- Modify: `js/maps/wilderness/northeast.js:34`
- Modify: `js/maps/wilderness/northwest.js:34`
- Modify: `js/maps/wilderness/southeast.js:34`
- Modify: `js/maps/wilderness/southwest.js:34`
- Modify: `tests/maps.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-3.
- Produces: every wilderness map object has `miniDungeonChance: 0.005`. Town and the dungeon map are NOT touched by this task (no field added). Task 5's `mapScreen.js` reads `mapConfig.miniDungeonChance` (`undefined` on town/dungeon/interior maps is intentional — see Task 5's notes).

- [ ] **Step 1: Write the failing test**

Add this test to `tests/maps.test.js`, directly after the existing `'every map has a valid cacheChance, and town has caches disabled'` test:

```js
test('every wilderness screen has a miniDungeonChance of 0.005, town and dungeon do not have the field', () => {
  for (const [id, map] of Object.entries(WILDERNESS)) {
    assert.equal(map.miniDungeonChance, 0.005, `${id} miniDungeonChance must be 0.005`);
  }
  assert.equal(townMap.miniDungeonChance, undefined, 'town must not have a miniDungeonChance field');
  assert.equal(dungeonMap.miniDungeonChance, undefined, 'dungeon must not have a miniDungeonChance field');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `miniDungeonChance` is `undefined` on every wilderness map (the first assertion in the loop fails).

- [ ] **Step 3: Add `miniDungeonChance` to the 9 wilderness map files**

In each file below, find the existing `cacheChance:` line at the given line number and add a `miniDungeonChance:` line directly after it. Example for `js/maps/wilderness/north.js:34` (currently `  cacheChance: 0.03,`) becomes:

```js
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
```

Apply this same pattern to all 9 files (every one gets exactly `0.005`, regardless of its `encounterChance`/`cacheChance` values):

| File | Line |
|---|---|
| `js/maps/wilderness/center.js` | 39 |
| `js/maps/wilderness/north.js` | 34 |
| `js/maps/wilderness/south.js` | 34 |
| `js/maps/wilderness/east.js` | 34 |
| `js/maps/wilderness/west.js` | 34 |
| `js/maps/wilderness/northeast.js` | 34 |
| `js/maps/wilderness/northwest.js` | 34 |
| `js/maps/wilderness/southeast.js` | 34 |
| `js/maps/wilderness/southwest.js` | 34 |

Do NOT touch `js/maps/townMap.js` or `js/maps/dungeonMap.js` in this task — they intentionally get no `miniDungeonChance` field at all.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, all suites including the new maps.test.js test.

- [ ] **Step 5: Commit**

```bash
git add js/maps/wilderness/*.js tests/maps.test.js
git commit -m "feat: add miniDungeonChance to every wilderness screen"
```

---

### Task 5: Wire mini-dungeon discovery, entry, exit, and treasure into `mapScreen.js` and `main.js`

**Files:**
- Modify: `js/screens/mapScreen.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `hasMiniDungeonEntrance`, `recordMiniDungeonEntrance`, `shouldRevealMiniDungeon`, `pickMiniDungeonVariant`, `getMiniDungeonEntrance`, `isTreasureTaken`, `markTreasureTaken`, `rollMiniDungeonTreasure` from `js/systems/miniDungeons.js` (Task 1); `state.miniDungeons`/`state.activeMiniDungeon` (Task 2); the 3 map objects and their `id`s (Task 3); `mapConfig.miniDungeonChance` (Task 4, `undefined` on town/dungeon/interior maps — see notes below); `addGold`, `addItem`, `equipItem` from `js/systems/inventory.js` (pre-existing); `ITEMS` from `js/data/items.js` (pre-existing); `showFlavorBanner` from `js/screens/flavorBanner.js` (pre-existing).
- Produces: `callbacks.onEnterMiniDungeon(screenId, x, y)` — a new callback fired by `mapScreen.js` when a wilderness tile's mini-dungeon entrance (freshly discovered or already known) is stepped onto. Handled by `main.js`'s new `handleEnterMiniDungeon(screenId, x, y)`. Two new `tile.action` values (`'exitMiniDungeon'`, `'collectTreasure'`) routed through the existing `onAction`/`handleTileAction` path, handled by new `main.js` functions `handleExitMiniDungeon()` and `handleTreasureFound()` (both read `state.activeMiniDungeon`, no extra parameters needed since `tile.action` dispatch only ever passes the action string).

This task has no dedicated automated test, matching Task 4 of the loot-caches plan — `mapScreen.js` and `main.js` have no test harness in this project (DOM-driving orchestration code, same as `battleScreen.js`). Correctness rests on the manual verification in Step 6 plus the fact that every piece of logic this task calls is already unit-tested (Tasks 1 and 3).

**Why `mapConfig.miniDungeonChance` being `undefined` inside interior maps and on town/dungeon is safe, not a bug:** `undefined < X` and `rng() < undefined` both evaluate to `false` in JavaScript, so `shouldRevealMiniDungeon`'s roll clause never passes when `chance` is `undefined` — town, the main dungeon, and every mini-dungeon interior are automatically excluded from ever rolling a *new* entrance, with no extra guard code needed anywhere. The same reasoning already applies to `mapConfig.cacheChance` being absent on interior maps (caches can't spawn inside a mini-dungeon either, for the identical reason) — this is an intentional, load-bearing consequence of the data model, not an oversight. Preserve this — do not add defensive `if (mapConfig.miniDungeonChance !== undefined)` guards; they'd be dead code.

- [ ] **Step 1: Update `js/screens/mapScreen.js` imports and add the marker constant**

At the top of `js/screens/mapScreen.js`, change:

```js
import { TILES } from '../tiles.js';
import { directionFromDelta } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache, recordCache, rollCacheLoot, shouldRevealCache } from '../systems/caches.js';

const CACHE_MARKER_EMOJI = '📦';
```

to:

```js
import { TILES } from '../tiles.js';
import { directionFromDelta } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache, recordCache, rollCacheLoot, shouldRevealCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance, recordMiniDungeonEntrance, shouldRevealMiniDungeon, pickMiniDungeonVariant } from '../systems/miniDungeons.js';

const CACHE_MARKER_EMOJI = '📦';
const MINI_DUNGEON_MARKER_EMOJI = '⛏️';
```

- [ ] **Step 2: Update `render()` to show the mini-dungeon marker**

In `js/screens/mapScreen.js`, change the `render()` function's marker line from:

```js
      const emoji = hasCache(state.caches, mapConfig.id, x, y) ? CACHE_MARKER_EMOJI : tile.emoji;
```

to:

```js
      const emoji = hasCache(state.caches, mapConfig.id, x, y)
        ? CACHE_MARKER_EMOJI
        : hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, x, y)
        ? MINI_DUNGEON_MARKER_EMOJI
        : tile.emoji;
```

(Post-ship correction: the original claim here — "a tile can never have both a cache and a mini-dungeon entrance recorded on it in practice" — was wrong. Mutual exclusivity in `tryMove` holds per *step*, not per *tile*: a tile that already has a cache recorded still rolls `shouldRevealMiniDungeon` on every later visit, since that roll never consults `hasCache`. Over enough revisits a tile can end up with both recorded, and the marker priority matters. The final whole-branch review caught this and reordered `render()` to check `hasMiniDungeonEntrance` before `hasCache` — see the whole-branch review's fix commit — since the entrance marker is actionable and the cache marker is purely a historical memento.)

- [ ] **Step 3: Update `tryMove()` to check for and roll mini-dungeon entrances**

In `js/screens/mapScreen.js`, replace the entire `tryMove` function body from `state.position = { x: nx, y: ny };` onward — i.e. replace:

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

with:

```js
  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });

  let cacheLoot = null;
  let enteringMiniDungeon = false;
  // Safe only because no tile.action tile also has tile.encounter: true (see js/tiles.js) — an
  // action tile hitting this branch would record a cache or mini-dungeon entrance with no
  // reward/entry ever delivered.
  if (tile.encounter && hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, nx, ny)) {
    enteringMiniDungeon = true;
  } else if (tile.encounter && shouldRevealMiniDungeon(state.miniDungeons, mapConfig.id, nx, ny, mapConfig.miniDungeonChance)) {
    const variantId = pickMiniDungeonVariant();
    Object.assign(state, { miniDungeons: recordMiniDungeonEntrance(state.miniDungeons, mapConfig.id, nx, ny, variantId) });
    enteringMiniDungeon = true;
  } else if (tile.encounter && shouldRevealCache(state.caches, mapConfig.id, nx, ny, mapConfig.cacheChance)) {
    Object.assign(state, { caches: recordCache(state.caches, mapConfig.id, nx, ny) });
    cacheLoot = rollCacheLoot();
  }

  // Render before firing any callback: an action may swap screens and an
  // encounter opens a battle *overlay* on top of this still-mounted map, so the
  // world underneath must already show the tile the player just stepped onto
  // (including a freshly discovered cache or mini-dungeon marker).
  render();

  callbacks.onMove(state.position);

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (enteringMiniDungeon) {
    callbacks.onEnterMiniDungeon(mapConfig.id, nx, ny);
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

The `if`/`else if`/`else if` chain guarantees at most one of {enter mini-dungeon, find cache} happens per step, checked in that priority order, and the subsequent `if (enteringMiniDungeon) { ...; return; }` / `if (cacheLoot) { ...; return; }` pair (each returning before the next check) guarantees the encounter roll only ever runs when neither fired.

- [ ] **Step 4: Register the 3 interior maps and add mini-dungeon imports in `js/main.js`**

In `js/main.js`, change the import block from:

```js
import { southeastMap } from './maps/wilderness/southeast.js';
import { southwestMap } from './maps/wilderness/southwest.js';
import { MONSTERS } from './data/monsters.js';
import { ITEMS } from './data/items.js';
import { FLAVOR_TEXT } from './data/flavorText.js';
import { showFlavorBanner } from './screens/flavorBanner.js';
import { applyXp } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem, equipItem, getEquipmentBonuses } from './systems/inventory.js';
import { computeEdgeLandingPosition, isWalkableAt } from './systems/world.js';

const MAPS = {
  town: townMap,
  dungeon: dungeonMap,
  center: centerMap,
  north: northMap,
  south: southMap,
  east: eastMap,
  west: westMap,
  northeast: northeastMap,
  northwest: northwestMap,
  southeast: southeastMap,
  southwest: southwestMap,
};
```

to:

```js
import { southeastMap } from './maps/wilderness/southeast.js';
import { southwestMap } from './maps/wilderness/southwest.js';
import { miniDungeonVariantA } from './maps/miniDungeons/variantA.js';
import { miniDungeonVariantB } from './maps/miniDungeons/variantB.js';
import { miniDungeonVariantC } from './maps/miniDungeons/variantC.js';
import { MONSTERS } from './data/monsters.js';
import { ITEMS } from './data/items.js';
import { FLAVOR_TEXT } from './data/flavorText.js';
import { showFlavorBanner } from './screens/flavorBanner.js';
import { applyXp } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem, equipItem, getEquipmentBonuses } from './systems/inventory.js';
import { computeEdgeLandingPosition, isWalkableAt } from './systems/world.js';
import { getMiniDungeonEntrance, isTreasureTaken, markTreasureTaken, rollMiniDungeonTreasure } from './systems/miniDungeons.js';

const MAPS = {
  town: townMap,
  dungeon: dungeonMap,
  center: centerMap,
  north: northMap,
  south: southMap,
  east: eastMap,
  west: westMap,
  northeast: northeastMap,
  northwest: northwestMap,
  southeast: southeastMap,
  southwest: southwestMap,
  miniDungeonA: miniDungeonVariantA,
  miniDungeonB: miniDungeonVariantB,
  miniDungeonC: miniDungeonVariantC,
};
```

- [ ] **Step 5: Add the `onEnterMiniDungeon` callback and the two new handlers in `js/main.js`**

Change `goToMap()`'s callbacks object from:

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

to:

```js
    callbacks: {
      onMove: () => saveState(state),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
      onCacheFound: handleCacheFound,
      onEnterMiniDungeon: handleEnterMiniDungeon,
    },
```

Change `handleTileAction()` from:

```js
function handleTileAction(action) {
  if (action === 'enterTown') return enterMap('town');
  if (action === 'enterDungeon') return enterMap('dungeon');
  if (action === 'exitMap') {
    if (state.map === 'town') return enterMap('center');
    if (state.map === 'dungeon') return enterMap('southeast');
    return;
  }
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
  if (action === 'bossBattle') {
    handleEncounter(dungeonMap.bossMonsterId);
    return;
  }
}
```

to:

```js
function handleTileAction(action) {
  if (action === 'enterTown') return enterMap('town');
  if (action === 'enterDungeon') return enterMap('dungeon');
  if (action === 'exitMap') {
    if (state.map === 'town') return enterMap('center');
    if (state.map === 'dungeon') return enterMap('southeast');
    return;
  }
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
  if (action === 'bossBattle') {
    handleEncounter(dungeonMap.bossMonsterId);
    return;
  }
  if (action === 'exitMiniDungeon') return handleExitMiniDungeon();
  if (action === 'collectTreasure') return handleTreasureFound();
}
```

Add three new functions directly after the existing `handleCacheFound` function (after its closing brace, before `function goToShop()`):

```js
function handleEnterMiniDungeon(screenId, x, y) {
  const entrance = getMiniDungeonEntrance(state.miniDungeons, screenId, x, y);
  state.activeMiniDungeon = { screenId, x, y };
  state.position = { ...MAPS[entrance.variantId].startPosition };
  state.map = entrance.variantId;
  saveState(state);
  goToMap(entrance.variantId);
}

function handleExitMiniDungeon() {
  const { screenId, x, y } = state.activeMiniDungeon;
  state.position = { x, y };
  state.map = screenId;
  state.activeMiniDungeon = null;
  saveState(state);
  goToMap(screenId);
}

function handleTreasureFound() {
  const { screenId, x, y } = state.activeMiniDungeon;
  if (isTreasureTaken(state.miniDungeons, screenId, x, y)) return;
  Object.assign(state, { miniDungeons: markTreasureTaken(state.miniDungeons, screenId, x, y) });
  const loot = rollMiniDungeonTreasure();
  Object.assign(state, addGold(state, loot.gold));
  Object.assign(state, addItem(state, loot.item, 1));
  const itemDef = ITEMS[loot.item];
  if (itemDef.slot) {
    Object.assign(state, equipItem(state, loot.item, itemDef.slot));
  }
  showFlavorBanner(`You found a treasure: ${loot.gold} gold and a ${itemDef.name}!`);
  saveState(state);
  renderHud();
}
```

`handleTreasureFound`'s `isTreasureTaken(...)` guard at the top is load-bearing, not defensive boilerplate: unlike the ambient cache/mini-dungeon-entrance rolls (which only ever fire once per tile because `shouldRevealCache`/`shouldRevealMiniDungeon` check `hasCache`/`hasMiniDungeonEntrance` first), the treasure tile is a *static* `tile.action` — like every other action tile in this game, `tile.action` fires unconditionally every time the tile is stepped on, with no automatic exactly-once protection. Walking onto the treasure tile a second time (which the "re-enterable for fights" design explicitly allows) must not grant a second reward.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 7: Manual verification**

Run: `python3 -m http.server` from the repo root, open `http://localhost:8000` in a browser.

- Walk around any wilderness screen and confirm normal play (movement, encounters, caches, town/shop/smith/dungeon entry) still works exactly as before.
- Mini-dungeon discovery is extremely rare (0.5% per step) — temporarily edit one wilderness map file's `miniDungeonChance` from `0.005` to `1` (e.g. `js/maps/wilderness/north.js`), reload, and take one step onto any grass tile.
  - Confirm you're immediately taken into a small cave map (screen fully swaps, not an overlay), your HUD still works, and the overworld tile you stepped from now permanently shows ⛏️.
  - Walk to the treasure tile (💰) — confirm a banner announces gold + a named item, your gold increases, and the item appears equipped (check the Stats panel) or in inventory.
  - Step onto the treasure tile again — confirm no second banner/reward.
  - Fight an orc or wraith inside if one appears (encounter chance is 0.2 per step on cave floor) — confirm the battle overlay works exactly as it does anywhere else.
  - Walk back onto the entrance/exit tile (🪜, the tile you started on) — confirm you're returned to the exact overworld screen and tile you entered from.
  - Leave and walk back onto the same overworld ⛏️ tile — confirm you re-enter the same interior variant (same layout), and the treasure tile still shows no reward, but a fresh orc/wraith encounter can still happen.
  - Reload the page mid-interior (after entering, before exiting) — confirm you're still inside the mini-dungeon on reload (state.map/state.position/state.activeMiniDungeon all persisted correctly).
- Confirm the cap: with `miniDungeonChance` still at `1` on that screen, after the first entrance is discovered, keep walking onto new tiles on that same screen — no second entrance should ever appear (no second ⛏️, stepping onto other wild tiles should still occasionally roll cache/encounter instead).
- **Revert the temporary `miniDungeonChance: 1` edit back to `0.005` before committing.**

- [ ] **Step 8: Commit**

```bash
git add js/screens/mapScreen.js js/main.js
git commit -m "feat: wire mini-dungeon discovery, entry, exit, and treasure into map exploration"
```

---

## Self-Review Notes

- **Spec coverage:** ambient discovery + immediate entry (Task 5), cap of 1 per screen (Task 1's `MINI_DUNGEON_CAP_PER_SCREEN` + Task 5's use of `shouldRevealMiniDungeon`), 3 variants randomly and permanently assigned (Task 1's `pickMiniDungeonVariant` + `recordMiniDungeonEntrance`, Task 3's 3 map files), underground tile palette (Task 3), orc/wraith encounters at 0.2 (Task 3's map data), guaranteed treasure with one-time-only semantics (Task 1's `rollMiniDungeonTreasure`/`markTreasureTaken`/`isTreasureTaken`, Task 5's `handleTreasureFound` guard), re-enterable for fights (Task 5 — nothing blocks re-entry, only the treasure is guarded), exact-tile return on exit (Task 5's `state.activeMiniDungeon` + `handleExitMiniDungeon`), wilderness-only eligibility (Task 4 explicitly excludes town/dungeon), mutual exclusivity with caches/encounters (Task 5's `tryMove` if/else-if chain) — all covered. No procedural generation, no new monster types, no difficulty scaling anywhere in this plan, matching the design's non-goals.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code, and the 3 map layouts were verified programmatically (width consistency, border walls, single entrance/single treasure, full reachability) before being written into this plan, not hand-traced.
- **Type consistency:** `getMiniDungeonEntrance` returns `{ variantId, treasureTaken }` — used identically in Task 1's tests, Task 5's `handleEnterMiniDungeon` (`entrance.variantId`) and implicitly relied on by `handleTreasureFound`/`isTreasureTaken`. `shouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng)` signature matches between Task 1's definition/tests and Task 5's call site (`mapConfig.miniDungeonChance` passed positionally as `chance`, default `rng`). `state.activeMiniDungeon`'s `{ screenId, x, y }` shape is set once in `handleEnterMiniDungeon` and destructured identically in both `handleExitMiniDungeon` and `handleTreasureFound`. All 3 map `id`s (`miniDungeonA`/`B`/`C`, Task 3) match `MINI_DUNGEON_VARIANT_IDS` (Task 1) and the keys used to register them in `MAPS` (Task 5).
