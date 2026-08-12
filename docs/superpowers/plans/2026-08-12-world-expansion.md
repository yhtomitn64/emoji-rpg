# World Expansion & UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single small overworld with a 3x3 grid of connected screens centered on Town, with monster difficulty rising by distance from Town; add a stats menu, a battle overlay (instead of full-screen takeover), and visited-tile tracking.

**Architecture:** The existing generic `mapScreen` renderer gains edge-transition detection (walking off a screen's edge reports the direction and target neighbor via callback, same "renders and reports, doesn't decide" pattern as today). `screenManager` gains a second mount surface (`mountOverlay`/`unmountOverlay`) alongside the existing `mountScreen`, so the battle screen and new stats panel render as floating panels over the still-mounted map instead of replacing it. New pure `systems/world.js` (edge-transition math) and `systems/exploration.js` (visited-tile tracking) follow the established pure-function-plus-`Object.assign` pattern.

**Tech Stack:** Same as the POC — plain HTML/CSS/JS (ES modules), no build tooling, no npm dependencies, `node:test` for pure-logic tests.

## Global Constraints

- No build tooling: no bundler, no transpiler, no npm dependencies.
- Node.js 18+ required to run tests (`npm test` runs `node --test tests/*.js`).
- Must be served over `http://`, not `file://`.
- Pure game-logic modules (`js/systems/*.js`, `js/state.js`) must have no `document`/`window`/DOM references, so they stay unit-testable under Node.
- All 9 new wilderness screens are a uniform 15 (wide) x 11 (tall) tile grid.
- Screen-to-screen transitions preserve the player's along-axis coordinate (the row when crossing east/west, the column when crossing north/south) — landing on the mirrored edge of the neighboring screen, not a fixed spawn point.
- Death still has no penalty: on defeat the player respawns in Town at full HP keeping all gold, items, gear, and XP — unchanged from the POC.
- No fog-of-war: visited-tile tracking only changes a tile's rendered background, never its visibility or walkability.

---

## File Structure

```
js/
  state.js                       # MODIFY: add `visited: {}` to createNewGame()
  systems/
    world.js                     # NEW: directionFromDelta, computeEdgeLandingPosition
    exploration.js                # NEW: markVisited, isVisited
  maps/
    townMap.js                    # unchanged
    dungeonMap.js                  # MODIFY: monsterTable/encounterChance retuned
    overworldMap.js                 # DELETE: replaced by maps/wilderness/*
    wilderness/
      center.js                     # NEW
      north.js                       # NEW
      south.js                        # NEW
      east.js                          # NEW
      west.js                           # NEW
      northeast.js                       # NEW
      northwest.js                        # NEW
      southeast.js                         # NEW (holds the dungeon entrance)
      southwest.js                          # NEW
  screens/
    screenManager.js               # MODIFY: add mountOverlay/unmountOverlay
    mapScreen.js                    # MODIFY: edge transitions, visited tiles, pause/resume
    battleScreen.js                  # MODIFY: becomes an overlay, enlarged monster emoji
    statsPanel.js                     # NEW: overlay screen showing player stats/equipment
    shopScreen.js                      # unchanged
    smithScreen.js                      # unchanged
  main.js                           # MODIFY: 11-map registry, edge transitions, stats icon
index.html                          # MODIFY: add #overlay container
css/styles.css                      # MODIFY: overlay/dimmed/visited/stats/emoji styling
tests/
  world.test.js                     # NEW
  exploration.test.js                # NEW
  maps.test.js                        # MODIFY: covers all 9 wilderness screens + connectivity
  data.test.js                         # unchanged (already generically validates all entries)
```

---

### Task 1: State Field & World/Exploration Systems

**Files:**
- Modify: `js/state.js`
- Modify: `tests/state.test.js` (one assertion updated for the new `map` default)
- Create: `js/systems/world.js`
- Create: `js/systems/exploration.js`
- Test: `tests/world.test.js`
- Test: `tests/exploration.test.js`

**Interfaces:**
- Produces: `directionFromDelta(dx, dy): 'north'|'south'|'east'|'west'|null`, `computeEdgeLandingPosition(direction, currentPosition, neighborMap): {x,y}`, `markVisited(visited, screenId, x, y): visited`, `isVisited(visited, screenId, x, y): boolean`
- `GameState` gains `visited: { [screenId]: { [\`${x},${y}\`]: true } }`

- [ ] **Step 1: Write the failing tests**

Create `tests/world.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { directionFromDelta, computeEdgeLandingPosition } from '../js/systems/world.js';

test('directionFromDelta maps movement deltas to compass directions', () => {
  assert.equal(directionFromDelta(1, 0), 'east');
  assert.equal(directionFromDelta(-1, 0), 'west');
  assert.equal(directionFromDelta(0, 1), 'south');
  assert.equal(directionFromDelta(0, -1), 'north');
});

test('computeEdgeLandingPosition places the player on the mirrored edge of the neighbor screen', () => {
  const currentPosition = { x: 5, y: 3 };
  const neighborMap = { rows: new Array(11).fill('.'.repeat(15)) };

  assert.deepEqual(computeEdgeLandingPosition('east', currentPosition, neighborMap), { x: 0, y: 3 });
  assert.deepEqual(computeEdgeLandingPosition('west', currentPosition, neighborMap), { x: 14, y: 3 });
  assert.deepEqual(computeEdgeLandingPosition('south', currentPosition, neighborMap), { x: 5, y: 0 });
  assert.deepEqual(computeEdgeLandingPosition('north', currentPosition, neighborMap), { x: 5, y: 10 });
});
```

Create `tests/exploration.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { markVisited, isVisited } from '../js/systems/exploration.js';

test('markVisited records a tile as visited for a given screen, immutably', () => {
  const visited = {};
  const next = markVisited(visited, 'center', 3, 4);
  assert.equal(isVisited(next, 'center', 3, 4), true);
  assert.deepEqual(visited, {});
});

test('isVisited returns false for unvisited tiles and unknown screens', () => {
  const visited = { center: { '3,4': true } };
  assert.equal(isVisited(visited, 'center', 5, 5), false);
  assert.equal(isVisited(visited, 'unknown', 3, 4), false);
});

test('markVisited preserves previously visited tiles on the same screen', () => {
  let visited = markVisited({}, 'center', 1, 1);
  visited = markVisited(visited, 'center', 2, 2);
  assert.equal(isVisited(visited, 'center', 1, 1), true);
  assert.equal(isVisited(visited, 'center', 2, 2), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/world.js` and `js/systems/exploration.js` do not exist yet.

- [ ] **Step 3: Create `js/systems/world.js`**

```js
export function directionFromDelta(dx, dy) {
  if (dx === 1) return 'east';
  if (dx === -1) return 'west';
  if (dy === 1) return 'south';
  if (dy === -1) return 'north';
  return null;
}

export function computeEdgeLandingPosition(direction, currentPosition, neighborMap) {
  if (direction === 'east') return { x: 0, y: currentPosition.y };
  if (direction === 'west') return { x: neighborMap.rows[0].length - 1, y: currentPosition.y };
  if (direction === 'south') return { x: currentPosition.x, y: 0 };
  return { x: currentPosition.x, y: neighborMap.rows.length - 1 };
}
```

- [ ] **Step 4: Create `js/systems/exploration.js`**

```js
export function markVisited(visited, screenId, x, y) {
  const key = `${x},${y}`;
  const screenVisited = { ...(visited[screenId] || {}), [key]: true };
  return { ...visited, [screenId]: screenVisited };
}

export function isVisited(visited, screenId, x, y) {
  return Boolean(visited[screenId] && visited[screenId][`${x},${y}`]);
}
```

- [ ] **Step 5: Add `visited` to `js/state.js`'s `createNewGame()`, and point new games at the `center` screen**

Modify `js/state.js` — in `createNewGame()`, add a `visited` field, and change the `map` default from `'overworld'` to `'center'` (the new world's hub screen, created in Task 3 — this is just a string id, not an import, so it's safe to reference before that file exists):

```js
export function createNewGame() {
  return {
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20 },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null },
    upgrades: {},
    inventory: [{ itemId: 'potion', quantity: 2 }],
    map: 'center',
    position: null,
    flags: { dungeonBossDefeated: false },
    visited: {},
  };
}
```

`tests/state.test.js` has an existing assertion `assert.equal(state.map, 'overworld');` (from the `createNewGame returns a fresh default state` test) that hard-codes the old default. Update that one line to `assert.equal(state.map, 'center');` — everything else in that test file is unchanged.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all previous tests + 6 new tests)

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/systems/world.js js/systems/exploration.js tests/world.test.js tests/exploration.test.js
git commit -m "feat: add screen-transition math and visited-tile tracking"
```

---

### Task 2: New Monster & Item Data (Orc, Wraith)

**Files:**
- Modify: `js/data/monsters.js`
- Modify: `js/data/items.js`

**Interfaces:**
- Produces: `MONSTERS.orc`, `MONSTERS.wraith`, `ITEMS.orcTusk`, `ITEMS.wraithEssence` — same shapes as existing entries
- Consumes: nothing new. `tests/data.test.js` already iterates every entry in `MONSTERS`/`ITEMS` generically, so it will validate these new entries without any test-file changes.

- [ ] **Step 1: Add the two new materials to `js/data/items.js`**

In the "Materials" section of `js/data/items.js`, add:

```js
  orcTusk: { id: 'orcTusk', name: 'Orc Tusk', emoji: '🦷', type: 'material' },
  wraithEssence: { id: 'wraithEssence', name: 'Wraith Essence', emoji: '💠', type: 'material' },
```

- [ ] **Step 2: Add the two new monsters to `js/data/monsters.js`**

Add to the `MONSTERS` object (these are the new "dungeon tier" monsters, tougher than the far-corner overworld monsters):

```js
  orc: {
    id: 'orc', name: 'Orc', emoji: '👹',
    hp: 30, attack: 11, defense: 4, speed: 5,
    xp: 28, goldRange: [8, 14],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', emoji: '👻',
    hp: 26, attack: 13, defense: 2, speed: 9,
    xp: 30, goldRange: [8, 15],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }],
  },
```

- [ ] **Step 3: Run tests to verify the new data is valid**

Run: `npm test`
Expected: PASS (all previous tests, unchanged count — `tests/data.test.js` validates the new entries via its existing generic loop, so no new test count, but the loop now also covers `orc`/`wraith`/`orcTusk`/`wraithEssence`)

- [ ] **Step 4: Commit**

```bash
git add js/data/monsters.js js/data/items.js
git commit -m "feat: add orc and wraith monsters for the dungeon tier"
```

---

### Task 3: Wilderness Screen Data (9 Screens) & Connectivity Tests

**Files:**
- Create: `js/maps/wilderness/center.js`
- Create: `js/maps/wilderness/north.js`
- Create: `js/maps/wilderness/south.js`
- Create: `js/maps/wilderness/east.js`
- Create: `js/maps/wilderness/west.js`
- Create: `js/maps/wilderness/northeast.js`
- Create: `js/maps/wilderness/northwest.js`
- Create: `js/maps/wilderness/southeast.js`
- Create: `js/maps/wilderness/southwest.js`
- Modify: `tests/maps.test.js`

**Interfaces:**
- Produces: 9 named exports (`centerMap`, `northMap`, `southMap`, `eastMap`, `westMap`, `northeastMap`, `northwestMap`, `southeastMap`, `southwestMap`), each `{ id, legend, rows, startPosition, encounterChance, monsterTable, neighbors: {north, south, east, west} }` — `neighbors` values are a screen id string or `null`
- Consumes: `TILES` from `js/tiles.js` (existing `grass`/`tree`/`water`/`townEntrance`/`dungeonEntrance` tile types — no new tile types needed)

Every screen is 15 tiles wide, 11 tiles tall. Every border edge that has a neighbor is fully walkable (grass) along its whole length, so any crossing point works. The interior of every screen shares the same water patch (rows 3-4, cols 6-7) and tree pair (row 7, cols 9-10) for simplicity — only the border walls, `neighbors`, tier (`encounterChance`/`monsterTable`), and the Town/Dungeon entrance tiles differ between screens.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/maps.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { townMap } from '../js/maps/townMap.js';
import { dungeonMap } from '../js/maps/dungeonMap.js';
import { centerMap } from '../js/maps/wilderness/center.js';
import { northMap } from '../js/maps/wilderness/north.js';
import { southMap } from '../js/maps/wilderness/south.js';
import { eastMap } from '../js/maps/wilderness/east.js';
import { westMap } from '../js/maps/wilderness/west.js';
import { northeastMap } from '../js/maps/wilderness/northeast.js';
import { northwestMap } from '../js/maps/wilderness/northwest.js';
import { southeastMap } from '../js/maps/wilderness/southeast.js';
import { southwestMap } from '../js/maps/wilderness/southwest.js';
import { MONSTERS } from '../js/data/monsters.js';

const WILDERNESS = {
  center: centerMap, north: northMap, south: southMap, east: eastMap, west: westMap,
  northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap,
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

function assertBorderWalkable(map, side) {
  const height = map.rows.length;
  const width = map.rows[0].length;
  if (side === 'north' || side === 'south') {
    const y = side === 'north' ? 0 : height - 1;
    for (let x = 0; x < width; x++) {
      const tileKey = map.legend[map.rows[y][x]];
      assert.ok(TILES[tileKey].walkable, `${map.id} ${side} border must be walkable at x=${x}`);
    }
  } else {
    const x = side === 'west' ? 0 : width - 1;
    for (let y = 0; y < height; y++) {
      const tileKey = map.legend[map.rows[y][x]];
      assert.ok(TILES[tileKey].walkable, `${map.id} ${side} border must be walkable at y=${y}`);
    }
  }
}

test('town map is well-formed and includes shop, smith, and exit tiles', () => {
  assertValidMap(townMap);
  const chars = townMap.rows.join('');
  const tileKeys = [...chars].map((c) => townMap.legend[c]);
  assert.ok(tileKeys.includes('shop'));
  assert.ok(tileKeys.includes('smith'));
  assert.ok(tileKeys.includes('exit'));
});

test('dungeon map is well-formed, includes a boss tile, and references a real boss monster', () => {
  assertValidMap(dungeonMap);
  const chars = dungeonMap.rows.join('');
  const tileKeys = [...chars].map((c) => dungeonMap.legend[c]);
  assert.ok(tileKeys.includes('boss'));
  assert.ok(MONSTERS[dungeonMap.bossMonsterId]);
});

test('every wilderness screen is well-formed with a walkable start position', () => {
  for (const map of Object.values(WILDERNESS)) {
    assertValidMap(map);
  }
});

test('every wilderness screen border is walkable exactly where a neighbor exists', () => {
  for (const map of Object.values(WILDERNESS)) {
    for (const side of ['north', 'south', 'east', 'west']) {
      if (map.neighbors[side]) {
        assertBorderWalkable(map, side);
      }
    }
  }
});

test('wilderness screen neighbor links are symmetric', () => {
  const opposite = { north: 'south', south: 'north', east: 'west', west: 'east' };
  for (const [id, map] of Object.entries(WILDERNESS)) {
    for (const side of ['north', 'south', 'east', 'west']) {
      const neighborId = map.neighbors[side];
      if (!neighborId) continue;
      const neighborMap = WILDERNESS[neighborId];
      assert.ok(neighborMap, `${id}'s ${side} neighbor '${neighborId}' must be a real screen`);
      assert.equal(
        neighborMap.neighbors[opposite[side]],
        id,
        `${neighborId} must link back to ${id} via ${opposite[side]}`
      );
    }
  }
});

test('center screen has the town entrance and southeast screen has the dungeon entrance', () => {
  const centerTileKeys = [...centerMap.rows.join('')].map((c) => centerMap.legend[c]);
  assert.ok(centerTileKeys.includes('townEntrance'));
  const southeastTileKeys = [...southeastMap.rows.join('')].map((c) => southeastMap.legend[c]);
  assert.ok(southeastTileKeys.includes('dungeonEntrance'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — the 9 `js/maps/wilderness/*.js` files do not exist yet.

- [ ] **Step 3: Create `js/maps/wilderness/center.js`**

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  '~': 'water',
  T: 'townEntrance',
};

const ROWS = [
  '...............',
  '...............',
  '...............',
  '......~~.......',
  '......~~.......',
  '.......T.......',
  '...............',
  '.........##....',
  '...............',
  '...............',
  '...............',
];

export const centerMap = {
  id: 'center',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 6 },
  encounterChance: 0,
  monsterTable: [],
  neighbors: { north: 'north', south: 'south', east: 'east', west: 'west' },
};
```

- [ ] **Step 4: Create `js/maps/wilderness/north.js`**

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '###############',
  '...............',
  '...............',
  '......~~.......',
  '......~~.......',
  '...............',
  '...............',
  '.........##....',
  '...............',
  '...............',
  '...............',
];

export const northMap = {
  id: 'north',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.1,
  monsterTable: ['boar', 'bat', 'snake', 'goblin'],
  neighbors: { north: null, south: 'center', east: 'northeast', west: 'northwest' },
};
```

- [ ] **Step 5: Create `js/maps/wilderness/south.js`**

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '...............',
  '...............',
  '...............',
  '......~~.......',
  '......~~.......',
  '...............',
  '...............',
  '.........##....',
  '...............',
  '...............',
  '###############',
];

export const southMap = {
  id: 'south',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.1,
  monsterTable: ['boar', 'bat', 'snake', 'goblin'],
  neighbors: { north: 'center', south: null, east: 'southeast', west: 'southwest' },
};
```

- [ ] **Step 6: Create `js/maps/wilderness/east.js`**

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '..............#',
  '..............#',
  '..............#',
  '......~~......#',
  '......~~......#',
  '..............#',
  '..............#',
  '.........##...#',
  '..............#',
  '..............#',
  '..............#',
];

export const eastMap = {
  id: 'east',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.1,
  monsterTable: ['boar', 'bat', 'snake', 'goblin'],
  neighbors: { north: 'northeast', south: 'southeast', east: null, west: 'center' },
};
```

- [ ] **Step 7: Create `js/maps/wilderness/west.js`**

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '#..............',
  '#..............',
  '#..............',
  '#.....~~.......',
  '#.....~~.......',
  '#..............',
  '#..............',
  '#........##....',
  '#..............',
  '#..............',
  '#..............',
];

export const westMap = {
  id: 'west',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.1,
  monsterTable: ['boar', 'bat', 'snake', 'goblin'],
  neighbors: { north: 'northwest', south: 'southwest', east: 'center', west: null },
};
```

- [ ] **Step 8: Create `js/maps/wilderness/northeast.js`**

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '###############',
  '..............#',
  '..............#',
  '......~~......#',
  '......~~......#',
  '..............#',
  '..............#',
  '.........##...#',
  '..............#',
  '..............#',
  '..............#',
];

export const northeastMap = {
  id: 'northeast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: null, south: 'east', east: null, west: 'north' },
};
```

- [ ] **Step 9: Create `js/maps/wilderness/northwest.js`**

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '###############',
  '#..............',
  '#..............',
  '#.....~~.......',
  '#.....~~.......',
  '#..............',
  '#..............',
  '#........##....',
  '#..............',
  '#..............',
  '#..............',
];

export const northwestMap = {
  id: 'northwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: null, south: 'west', east: 'north', west: null },
};
```

- [ ] **Step 10: Create `js/maps/wilderness/southeast.js`** (holds the dungeon entrance)

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water', D: 'dungeonEntrance' };

const ROWS = [
  '..............#',
  '..............#',
  '..............#',
  '......~~......#',
  '......~~......#',
  '..............#',
  '............D.#',
  '.........##...#',
  '..............#',
  '..............#',
  '###############',
];

export const southeastMap = {
  id: 'southeast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: 'east', south: null, east: null, west: 'south' },
};
```

- [ ] **Step 11: Create `js/maps/wilderness/southwest.js`**

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '#..............',
  '#..............',
  '#..............',
  '#.....~~.......',
  '#.....~~.......',
  '#..............',
  '#..............',
  '#........##....',
  '#..............',
  '#..............',
  '###############',
];

export const southwestMap = {
  id: 'southwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: 'west', south: null, east: 'south', west: null },
};
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all previous tests + 6 tests from the rewritten `tests/maps.test.js`)

- [ ] **Step 13: Commit**

```bash
git add js/maps/wilderness tests/maps.test.js
git commit -m "feat: add 9-screen wilderness grid with connectivity tests"
```

---

### Task 4: Retune the Dungeon's Monster Tier & Remove the Old Overworld Map

**Files:**
- Modify: `js/maps/dungeonMap.js`
- Delete: `js/maps/overworldMap.js`

**Interfaces:**
- Consumes: `MONSTERS.orc`/`MONSTERS.wraith` (Task 2)
- Produces: no interface change — `dungeonMap`'s shape is unchanged, only its `monsterTable`/`encounterChance` values change

- [ ] **Step 1: Update `js/maps/dungeonMap.js`'s monster tier**

Modify the `dungeonMap` export in `js/maps/dungeonMap.js` — change only `monsterTable` and `encounterChance`:

```js
export const dungeonMap = {
  id: 'dungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.25,
  monsterTable: ['orc', 'wraith'],
  bossMonsterId: 'dragon',
};
```

(`LEGEND` and `ROWS` are unchanged — only the four lines shown above differ from the current file.)

- [ ] **Step 2: Delete the old overworld map**

```bash
git rm js/maps/overworldMap.js
```

- [ ] **Step 3: Run tests to verify nothing else references the deleted file**

Run: `npm test`
Expected: PASS — no test file imports `js/maps/overworldMap.js` after Task 3's rewrite of `tests/maps.test.js`.

- [ ] **Step 4: Commit**

```bash
git add js/maps/dungeonMap.js
git commit -m "feat: retune dungeon to orc/wraith tier and remove the old single overworld map"
```

---

### Task 5: Screen Manager Overlay Support

**Files:**
- Modify: `js/screens/screenManager.js`

**Interfaces:**
- Consumes: nothing new
- Produces: `mountScreen(screen, props): void` (unchanged), `mountOverlay(overlay, props): void` (NEW), `unmountOverlay(): void` (NEW). Any screen module may now optionally export `pause()`/`resume()` in addition to `mount`/`unmount`; `mountOverlay` calls the currently-active base screen's `pause()` if present, `unmountOverlay` calls its `resume()` if present.

- [ ] **Step 1: Replace the contents of `js/screens/screenManager.js`**

```js
let activeScreen = null;
let activeOverlay = null;

export function mountScreen(screen, props) {
  if (activeOverlay) {
    unmountOverlay();
  }
  const root = document.getElementById('app');
  if (activeScreen && activeScreen.unmount) {
    activeScreen.unmount();
  }
  root.innerHTML = '';
  activeScreen = screen;
  screen.mount(root, props);
}

export function mountOverlay(overlay, props) {
  if (activeScreen && activeScreen.pause) {
    activeScreen.pause();
  }
  const root = document.getElementById('overlay');
  root.classList.add('open');
  document.getElementById('app').classList.add('dimmed');
  activeOverlay = overlay;
  overlay.mount(root, props);
}

export function unmountOverlay() {
  if (!activeOverlay) return;
  if (activeOverlay.unmount) {
    activeOverlay.unmount();
  }
  const root = document.getElementById('overlay');
  root.innerHTML = '';
  root.classList.remove('open');
  document.getElementById('app').classList.remove('dimmed');
  activeOverlay = null;
  if (activeScreen && activeScreen.resume) {
    activeScreen.resume();
  }
}
```

- [ ] **Step 2: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/screenManager.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count — this file has no unit tests, it's DOM-only)

- [ ] **Step 4: Commit**

```bash
git add js/screens/screenManager.js
git commit -m "feat: add overlay mount/unmount support to the screen manager"
```

---

### Task 6: Map Screen — Edge Transitions, Visited Tiles, Pause/Resume

**Files:**
- Modify: `js/screens/mapScreen.js`

**Interfaces:**
- Consumes: `directionFromDelta` (Task 1, `js/systems/world.js`), `markVisited`/`isVisited` (Task 1, `js/systems/exploration.js`)
- Produces: `mount(root, props)` / `unmount()` (unchanged signatures) plus NEW `pause()` / `resume()`. `mount` props gains a new required callback: `callbacks.onEdgeTransition(neighborId, direction, currentPosition)`, called when the player attempts to move off a screen edge that has a neighbor defined in `mapConfig.neighbors`.

- [ ] **Step 1: Replace the contents of `js/screens/mapScreen.js`**

```js
import { TILES } from '../tiles.js';
import { directionFromDelta } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';

let rootEl = null;
let state = null;
let mapConfig = null;
let callbacks = null;

const KEY_TO_DELTA = {
  ArrowUp: [0, -1], w: [0, -1],
  ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0],
};

function tileAt(x, y) {
  const row = mapConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  return TILES[mapConfig.legend[char]];
}

function isOutOfBounds(x, y) {
  return y < 0 || y >= mapConfig.rows.length || x < 0 || x >= mapConfig.rows[0].length;
}

function render() {
  const cols = mapConfig.rows[0].length;
  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let y = 0; y < mapConfig.rows.length; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = document.createElement('div');
      const tile = tileAt(x, y);
      const isPlayer = state.position.x === x && state.position.y === y;
      cell.className = 'map-tile' + (isVisited(state.visited, mapConfig.id, x, y) ? ' visited' : '');
      cell.textContent = isPlayer ? '🧑' : tile.emoji;
      grid.appendChild(cell);
    }
  }

  rootEl.innerHTML = '';
  rootEl.appendChild(grid);
}

function tryMove(dx, dy) {
  const nx = state.position.x + dx;
  const ny = state.position.y + dy;

  if (isOutOfBounds(nx, ny)) {
    const direction = directionFromDelta(dx, dy);
    const neighborId = mapConfig.neighbors && mapConfig.neighbors[direction];
    if (neighborId) {
      callbacks.onEdgeTransition(neighborId, direction, { ...state.position });
    }
    return;
  }

  const tile = tileAt(nx, ny);
  if (!tile || !tile.walkable) return;

  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });
  callbacks.onMove(state.position);

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    callbacks.onEncounter(monsterId);
    return;
  }

  render();
}

function handleKeydown(event) {
  const delta = KEY_TO_DELTA[event.key];
  if (!delta) return;
  tryMove(delta[0], delta[1]);
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  callbacks = props.callbacks;
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, state.position.x, state.position.y) });
  render();
  window.addEventListener('keydown', handleKeydown);
}

export function unmount() {
  window.removeEventListener('keydown', handleKeydown);
}

export function pause() {
  window.removeEventListener('keydown', handleKeydown);
}

export function resume() {
  window.addEventListener('keydown', handleKeydown);
}
```

- [ ] **Step 2: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/mapScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count)

- [ ] **Step 4: Commit**

```bash
git add js/screens/mapScreen.js
git commit -m "feat: add edge-transition detection and visited-tile marking to map screen"
```

---

### Task 7: Battle Screen Becomes an Overlay

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: unchanged (`MONSTERS`, `ITEMS`, `combat.js`, `getEquipmentBonuses`)
- Produces: `mount(root, props)` / `unmount()` — same signatures as before. The only behavioral change is presentational (wraps content in `.overlay-panel`, enlarges the monster's emoji) and where it's mounted (Task 9 will mount it via `mountOverlay` instead of `mountScreen`, but that's a caller-side change — this file's own contract is unchanged).

- [ ] **Step 1: Update `render()` in `js/screens/battleScreen.js`**

Replace the `render()` function's body with:

```js
function render() {
  if (battleOver) return;

  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen">
      <div class="combatant"><span class="battle-monster-emoji">${monsterCombatant.emoji}</span> ${monsterCombatant.name} — HP ${monsterCombatant.hp}/${monsterCombatant.maxHp}</div>
      <div class="combatant">${playerCombatant.emoji} You — HP ${playerCombatant.hp}/${playerCombatant.maxHp}</div>
      <div class="battle-log">${log.slice(-4).join('<br>')}</div>
      <div class="battle-menu" id="battle-menu"></div>
    </div>
  `;

  if (isReady(playerCombatant.atb)) {
    renderMenu();
  }
}
```

(This adds the `if (battleOver) return;` guard, wraps the markup in `.overlay-panel battle-screen`, and wraps the monster's emoji in a `.battle-monster-emoji` span for the enlarged-size CSS in Task 9. The `isReady(playerCombatant.atb) && !battleOver` check simplifies to just `isReady(playerCombatant.atb)` since the function now returns early when `battleOver` is true. Every other function in the file — `buildPlayerCombatant`, `buildMonsterCombatant`, `renderMenu`, `playerAttack`, `playerUseItem`, `playerFlee`, `monsterAttack`, `checkOutcome`, `tick`, `endBattle`, `mount`, `unmount` — stays exactly as-is.)

- [ ] **Step 2: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/battleScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count)

- [ ] **Step 4: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: render battle screen as an overlay panel with a larger monster emoji"
```

---

### Task 8: Stats Panel

**Files:**
- Create: `js/screens/statsPanel.js`

**Interfaces:**
- Consumes: `ITEMS` (`js/data/items.js`), `xpForLevel` (`js/systems/leveling.js`), `getEquipmentBonuses` (`js/systems/inventory.js`)
- Produces: `mount(root, props)` / `unmount()`. `mount` props: `{ state, callbacks: { onClose() } }`

- [ ] **Step 1: Create `js/screens/statsPanel.js`**

```js
import { ITEMS } from '../data/items.js';
import { xpForLevel } from '../systems/leveling.js';
import { getEquipmentBonuses } from '../systems/inventory.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory'];

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const bonuses = getEquipmentBonuses(state);
  const xpNeeded = xpForLevel(state.player.level);

  const equipRows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="stats-slot">${slot}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    return `<div class="stats-slot">${slot}: ${item.emoji} ${item.name} +${level}</div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="overlay-panel stats-panel">
      <h2>Stats</h2>
      <div>Level ${state.player.level} (XP ${state.player.xp}/${xpNeeded})</div>
      <div>HP: ${state.player.hp}/${state.player.maxHp + bonuses.maxHp}</div>
      <div>Attack: ${state.player.attack + bonuses.attack}</div>
      <div>Defense: ${state.player.defense + bonuses.defense}</div>
      <div>Speed: ${state.player.speed + bonuses.speed}</div>
      <div>Gold: ${state.player.gold}</div>
      <h3>Equipment</h3>
      ${equipRows}
      <button id="btn-close-stats">Close</button>
    </div>
  `;

  document.getElementById('btn-close-stats').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
```

- [ ] **Step 2: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/statsPanel.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Commit**

```bash
git add js/screens/statsPanel.js
git commit -m "feat: add stats panel overlay screen"
```

---

### Task 9: Main Wiring, HUD Stats Icon, HTML & CSS

**Files:**
- Modify: `js/main.js`
- Modify: `index.html`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes everything from Tasks 1-8: `computeEdgeLandingPosition` (world.js), the 9 wilderness map exports, `mountOverlay`/`unmountOverlay` (screenManager.js), `statsPanel`, the updated `mapScreen`/`battleScreen`, `getEquipmentBonuses` (inventory.js, already existed)

- [ ] **Step 1: Add the `#overlay` container to `index.html`**

Modify `index.html` — replace:
```html
  <div id="app"></div>
  <script type="module" src="js/main.js"></script>
```
with:
```html
  <div id="app"></div>
  <div id="overlay"></div>
  <script type="module" src="js/main.js"></script>
```

- [ ] **Step 2: Append overlay/dimmed/visited/stats styling to `css/styles.css`**

Append to `css/styles.css`:

```css
#overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
#overlay.open {
  display: flex;
}

#app.dimmed {
  filter: brightness(0.6);
}

.overlay-panel {
  background: rgba(17, 17, 17, 0.97);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 16px;
  max-width: 480px;
  width: 90%;
}

.map-tile.visited {
  background: #3a3a3a;
}

.battle-monster-emoji {
  font-size: 2rem;
}

.stats-slot {
  padding: 4px 0;
  border-bottom: 1px solid #333;
}

#hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

- [ ] **Step 3: Replace the contents of `js/main.js`**

```js
import { createNewGame, loadState, saveState } from './state.js';
import { mountScreen, mountOverlay, unmountOverlay } from './screens/screenManager.js';
import * as mapScreen from './screens/mapScreen.js';
import * as battleScreen from './screens/battleScreen.js';
import * as shopScreen from './screens/shopScreen.js';
import * as smithScreen from './screens/smithScreen.js';
import * as statsPanel from './screens/statsPanel.js';
import { townMap } from './maps/townMap.js';
import { dungeonMap } from './maps/dungeonMap.js';
import { centerMap } from './maps/wilderness/center.js';
import { northMap } from './maps/wilderness/north.js';
import { southMap } from './maps/wilderness/south.js';
import { eastMap } from './maps/wilderness/east.js';
import { westMap } from './maps/wilderness/west.js';
import { northeastMap } from './maps/wilderness/northeast.js';
import { northwestMap } from './maps/wilderness/northwest.js';
import { southeastMap } from './maps/wilderness/southeast.js';
import { southwestMap } from './maps/wilderness/southwest.js';
import { MONSTERS } from './data/monsters.js';
import { ITEMS } from './data/items.js';
import { applyXp } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem, equipItem, getEquipmentBonuses } from './systems/inventory.js';
import { computeEdgeLandingPosition } from './systems/world.js';

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

const state = loadState() || createNewGame();
if (state.map === 'overworld') {
  state.map = 'center';
  state.position = null;
}
if (!state.position) {
  state.position = { ...MAPS[state.map].startPosition };
}
if (!state.visited) {
  state.visited = {};
}

function renderHud() {
  const bonuses = getEquipmentBonuses(state);
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp + bonuses.maxHp} Gold:${state.player.gold}`;

  const statsButton = document.createElement('button');
  statsButton.id = 'btn-open-stats';
  statsButton.textContent = '📊 Stats';
  statsButton.onclick = openStats;

  hud.appendChild(label);
  hud.appendChild(statsButton);
}

function openStats() {
  mountOverlay(statsPanel, {
    state,
    callbacks: { onClose: () => unmountOverlay() },
  });
}

function goToMap(mapId) {
  state.map = mapId;
  renderHud();
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    callbacks: {
      onMove: () => saveState(state),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
    },
  });
}

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
    if (!state.flags.dungeonBossDefeated) {
      handleEncounter(dungeonMap.bossMonsterId);
    }
    return;
  }
}

function enterMap(mapId) {
  state.position = { ...MAPS[mapId].startPosition };
  state.map = mapId;
  saveState(state);
  goToMap(mapId);
}

function handleEdgeTransition(neighborId, direction, currentPosition) {
  const neighborMap = MAPS[neighborId];
  state.position = computeEdgeLandingPosition(direction, currentPosition, neighborMap);
  state.map = neighborId;
  saveState(state);
  goToMap(neighborId);
}

function goToShop() {
  mountScreen(shopScreen, {
    state,
    callbacks: {
      onPurchase: () => { saveState(state); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}

function goToSmith() {
  mountScreen(smithScreen, {
    state,
    callbacks: {
      onUpgrade: () => { saveState(state); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}

function handleEncounter(monsterId) {
  mountOverlay(battleScreen, {
    state,
    monsterId,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}

function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();

  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const { player } = applyXp(state.player, monster.xp);
    state.player = player;

    const drop = rollDrop(monster);
    Object.assign(state, addGold(state, drop.gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
      const droppedItemDef = ITEMS[drop.item];
      if (droppedItemDef.slot) {
        Object.assign(state, equipItem(state, drop.item, droppedItemDef.slot));
      }
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }

    saveState(state);
    renderHud();
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp;
    state.position = { ...townMap.startPosition };
    state.map = 'town';
    saveState(state);
    renderHud();
    goToMap('town');
  } else if (outcome === 'fled') {
    saveState(state);
    renderHud();
  }
}

renderHud();
goToMap(state.map);
```

Notes on what changed from the previous `main.js`: the `MAPS` registry now has 11 entries (town, dungeon, 9 wilderness screens) instead of 3; a one-time migration bumps any pre-existing save's `state.map === 'overworld'` to `'center'` (clearing `position` so it re-derives from `center`'s `startPosition`); `renderHud` now factors in equipment bonuses for max HP (fixing the pre-existing HUD-vs-effective-max-HP mismatch) and renders a Stats button; `exitMap` now branches on which map you're leaving instead of always returning to a single overworld; `handleEncounter`/`handleBattleEnd` use `mountOverlay`/`unmountOverlay` instead of `mountScreen`, and `'won'`/`'fled'` no longer call `goToMap` at all — the map screen was never unmounted during the battle overlay, so it's already showing the correct state once the overlay closes.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests from Tasks 1-4)

- [ ] **Step 5: Manual full-loop playtest**

Run: `python3 -m http.server 8000` from the project root, then open `http://localhost:8000`. Work through:

- Fresh load spawns on the `center` screen; walking off each of its 4 edges transitions to `north`/`south`/`east`/`west` and back, landing on the correct mirrored row/column each time
- From a cardinal screen, walking off the correct edges reaches the correct corner screen (e.g., `north`'s east edge reaches `northeast`); corner screens' outer edges (world boundary) block movement instead of transitioning
- Cardinal screens trigger Boar/Bat/Snake/Goblin encounters; corner screens trigger Dire Wolf/Spider encounters more often
- The dungeon entrance is on the `southeast` screen; entering it, encounters are Orc/Wraith; the boss tile still triggers the (already-fixed) gated Dragon fight
- Tiles you've stood on stay visibly dimmed/tinted after you leave and return
- The Stats button in the HUD opens a panel showing correct live stats/XP/equipment, and Close returns to the map with movement still working
- A battle now opens as a floating panel with the world still dimly visible behind it, not a full takeover; the monster's emoji is visibly larger than its map-tile size
- Winning, losing, and fleeing all behave correctly (no stale battle panel lingering, map immediately interactive again); losing still sends you to Town at full HP with everything intact regardless of which screen you died on
- Reloading mid-session restores map/position/visited tiles/stats all correctly from `localStorage`

- [ ] **Step 6: Commit**

```bash
git add index.html css/styles.css js/main.js
git commit -m "feat: wire the 9-screen world, edge transitions, and stats/battle overlays together"
```

---

### Task 10: Playtest-Driven Dungeon & Boss Rebalance

**Files:**
- Modify: `js/data/monsters.js` (only if the playtest/simulation below shows it's warranted)

**Interfaces:** none new — this task only tunes existing values based on evidence.

- [ ] **Step 1: Assess whether the boss balance still holds for the new, longer journey**

The dragon's stats (`attack: 24, speed: 10, hp: 60, defense: 5`) were tuned against a "level 6, full shop iron gear" baseline from the original POC's shorter map. The new world requires crossing 1-2 near-town screens and at least one far-corner screen (Dire Wolf/Spider) before even reaching the dungeon's Orc/Wraith tier, so a player who reaches the boss now is very likely higher level and better-equipped than that original baseline.

Write a throwaway Node simulation (same technique used for the original dragon tuning): drive the real `calculateDamage`/`tickGauge`/`isReady` from `js/systems/combat.js` against a few representative "arrived at the boss" player builds — e.g. a level 8-10 character with full shop iron gear, and a lower-level/lightly-geared character who rushed there. You're checking that the fight is still winnable-but-risky for a reasonably-prepared arrival, not a foregone conclusion either way (mirroring the standard set in the POC's original balance fix — no exact win-rate target required, just confirm it's not back to trivial in either direction now that "reasonably prepared" likely means a higher level than before).

- [ ] **Step 2: Apply a retune only if the simulation shows a real problem**

If the dragon is now too easy (a well-prepared higher-level arrival wins with near-certainty and high HP remaining) or too hard (even a well-prepared arrival rarely wins), adjust `js/data/monsters.js`'s `dragon` entry (`hp`/`attack`/`defense`/`speed`) and re-run the simulation to confirm the new numbers land in a reasonable range. If the existing tuning already holds up against the new expected arrival state, no change is needed — say so explicitly rather than tuning for its own sake.

- [ ] **Step 3: Run the full test suite after any tuning changes**

Run: `npm test`
Expected: PASS — tuning `dragon`'s stats doesn't affect any existing assertion (no test hard-codes dragon's specific stat values).

- [ ] **Step 4: Commit** (only if Step 2 made a change)

```bash
git add js/data/monsters.js
git commit -m "chore: rebalance dragon for the expanded world's expected arrival state"
```

If no change was needed, skip the commit for this task.

---

### Task 11: README Update

**Files:**
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `README.md`'s controls section**

Modify the "Controls" section of `README.md` to mention the Stats button and the wider world, replacing the existing Controls section with:

```markdown
## Controls

Arrow keys or WASD to move. Walking off the edge of a screen crosses into the next one — the world is a 3x3 grid of screens centered on Town, and monsters get tougher the further you travel from it. Click the 📊 Stats button in the top bar to check your stats and equipment. In battle, click the action buttons (Attack / Item / Flee) once your ATB gauge is full.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for the expanded world and stats panel"
```
