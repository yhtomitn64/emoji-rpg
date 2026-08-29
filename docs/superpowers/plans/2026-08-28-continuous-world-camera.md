# Continuous-World Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wilderness's discrete per-screen map rendering and hard screen-swap transitions with one continuous, camera-following viewport, so the player never "vanishes" walking from one screen's terrain into the next.

**Architecture:** A new pure topology module (`js/systems/worldGrid.js`) stitches the existing 25 wilderness screen files (unchanged) into one global tile-coordinate space by walking their existing `neighbors` links; town/dungeon screens each become their own trivial one-screen "cluster." `js/screens/mapScreen.js` renders a fixed-pixel-tile viewport window centered on the player (clamped at cluster edges) instead of one whole screen, resolving each visible cell back to its owning screen for all existing tile/trail/gate/cache lookups. Movement (`tryMove`) steps in global coordinates and swaps which screen is "current" inline, deleting the old teleport-based `handleEdgeTransition` path entirely — which also fixes a real bug where landing on a tool-gated tile via a screen transition never converted it to rubble/stump.

**Tech Stack:** Vanilla JS (ES modules), jsdom-based DOM tests (`node --test`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-continuous-world-camera-design.md`

## Global Constraints

- Every wilderness screen in `js/maps/wilderness/*.js` is a uniform 30x22 tile grid — this plan's `worldGrid.js` assumes uniform width/height within one connected cluster (non-uniform clusters are explicitly out of scope; see the spec's Non-goals).
- Camera re-centers **instantly** per step — no animated slide (backlogged separately per the spec).
- Town and dungeon screens must render and play identically to today (no visible change) — they're single-screen clusters that fit inside the viewport with no panning.
- `tests/mapScreenDom.test.js`, `tests/maps.test.js`, and `tests/world.test.js` must stay green (updated as needed) after every task; run `npm run test` (never `npx jest`/bare `node test.js` — this repo's real command) with full output.

---

## Task 1: `worldGrid.js` — world topology module

**Files:**
- Create: `js/systems/worldGrid.js`
- Test: `tests/worldGrid.test.js`

**Interfaces:**
- Produces: `buildWorldGrid(maps)`, `screenToGlobal(grid, screenId, localX, localY) -> {gx, gy}`, `globalToScreen(grid, screenId, gx, gy) -> {screenId, localX, localY} | null`, `clusterBounds(grid, screenId) -> {minGx, minGy, maxGx, maxGy}`. `maps` is any `{[screenId]: {id, rows, neighbors?}}` registry (only `rows` — for width/height — and `neighbors` are read).

- [ ] **Step 1: Write the failing tests**

```js
// tests/worldGrid.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldGrid, screenToGlobal, globalToScreen, clusterBounds } from '../js/systems/worldGrid.js';

function fakeScreen(id, width, height, neighbors) {
  return { id, rows: new Array(height).fill('.'.repeat(width)), neighbors };
}

test('screenToGlobal places a lone screen (no neighbors) at its own origin', () => {
  const maps = { town: fakeScreen('town', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(screenToGlobal(grid, 'town', 0, 0), { gx: 0, gy: 0 });
  assert.deepEqual(screenToGlobal(grid, 'town', 9, 7), { gx: 9, gy: 7 });
});

test('screenToGlobal offsets an east neighbor by the west screen\'s own width', () => {
  const maps = {
    west: fakeScreen('west', 10, 8, { east: 'east' }),
    east: fakeScreen('east', 10, 8, { west: 'west' }),
  };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(screenToGlobal(grid, 'east', 0, 0), { gx: 10, gy: 0 });
});

test('screenToGlobal offsets a south neighbor by the north screen\'s own height', () => {
  const maps = {
    north: fakeScreen('north', 10, 8, { south: 'south' }),
    south: fakeScreen('south', 10, 8, { north: 'north' }),
  };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(screenToGlobal(grid, 'south', 0, 0), { gx: 0, gy: 8 });
});

test('globalToScreen round-trips screenToGlobal across a 2x2 grid of screens', () => {
  const maps = {
    nw: fakeScreen('nw', 5, 5, { east: 'ne', south: 'sw' }),
    ne: fakeScreen('ne', 5, 5, { west: 'nw', south: 'se' }),
    sw: fakeScreen('sw', 5, 5, { east: 'se', north: 'nw' }),
    se: fakeScreen('se', 5, 5, { west: 'sw', north: 'ne' }),
  };
  const grid = buildWorldGrid(maps);
  for (const id of Object.keys(maps)) {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const { gx, gy } = screenToGlobal(grid, id, x, y);
        assert.deepEqual(globalToScreen(grid, id, gx, gy), { screenId: id, localX: x, localY: y });
      }
    }
  }
});

test('globalToScreen returns null one tile past a cluster\'s outer edge', () => {
  const maps = { town: fakeScreen('town', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.equal(globalToScreen(grid, 'town', 10, 0), null); // one past the east edge
  assert.equal(globalToScreen(grid, 'town', -1, 0), null); // one past the west edge
  assert.equal(globalToScreen(grid, 'town', 0, 8), null); // one past the south edge
});

test('globalToScreen never crosses between two unrelated one-screen clusters', () => {
  // Both "town" and "dungeon" have no neighbors, so both start at their own
  // (0,0) - a naive implementation without per-cluster scoping would let a
  // query anchored on "town" resolve into "dungeon"'s identically-numbered
  // tiles.
  const maps = { town: fakeScreen('town', 10, 8), dungeon: fakeScreen('dungeon', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(globalToScreen(grid, 'town', 3, 3), { screenId: 'town', localX: 3, localY: 3 });
});

test('clusterBounds spans every screen in a 2x2 grid, not just one screen', () => {
  const maps = {
    nw: fakeScreen('nw', 5, 5, { east: 'ne', south: 'sw' }),
    ne: fakeScreen('ne', 5, 5, { west: 'nw', south: 'se' }),
    sw: fakeScreen('sw', 5, 5, { east: 'se', north: 'nw' }),
    se: fakeScreen('se', 5, 5, { west: 'sw', north: 'ne' }),
  };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(clusterBounds(grid, 'se'), { minGx: 0, minGy: 0, maxGx: 9, maxGy: 9 });
});

test('clusterBounds for a lone screen is just that screen\'s own extent', () => {
  const maps = { town: fakeScreen('town', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(clusterBounds(grid, 'town'), { minGx: 0, minGy: 0, maxGx: 9, maxGy: 7 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test 2>&1 | tee /tmp/worldgrid-test-red.txt`
Expected: FAIL — `Cannot find module '../js/systems/worldGrid.js'` (or similar).

- [ ] **Step 3: Implement `js/systems/worldGrid.js`**

```js
// Stitches a set of screens - each with its own local rows/legend, linked
// via a `neighbors` field the way js/maps/wilderness/*.js already declares
// them - into one global tile-coordinate space per connected cluster. A
// screen with no `neighbors` at all (town, a dungeon) is its own
// one-screen cluster. Assumes every screen within one cluster shares the
// same width/height (true today for all 25 wilderness screens - see this
// plan's Global Constraints).
const DIRECTION_DELTA = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

export function buildWorldGrid(maps) {
  const clusterIdOfScreen = {};
  const originByScreen = {};
  const screensByCluster = {};

  for (const rootId of Object.keys(maps)) {
    if (clusterIdOfScreen[rootId]) continue;
    const clusterId = rootId;
    const rootMap = maps[rootId];
    originByScreen[rootId] = { gx: 0, gy: 0, width: rootMap.rows[0].length, height: rootMap.rows.length };
    clusterIdOfScreen[rootId] = clusterId;
    screensByCluster[clusterId] = [rootId];

    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift();
      const map = maps[id];
      const origin = originByScreen[id];
      if (!map.neighbors) continue;
      for (const [dir, neighborId] of Object.entries(map.neighbors)) {
        if (!neighborId || clusterIdOfScreen[neighborId]) continue;
        const neighborMap = maps[neighborId];
        const [dx, dy] = DIRECTION_DELTA[dir];
        const neighborWidth = neighborMap.rows[0].length;
        const neighborHeight = neighborMap.rows.length;
        const gx = dx === 1 ? origin.gx + origin.width : dx === -1 ? origin.gx - neighborWidth : origin.gx;
        const gy = dy === 1 ? origin.gy + origin.height : dy === -1 ? origin.gy - neighborHeight : origin.gy;
        originByScreen[neighborId] = { gx, gy, width: neighborWidth, height: neighborHeight };
        clusterIdOfScreen[neighborId] = clusterId;
        screensByCluster[clusterId].push(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return { originByScreen, clusterIdOfScreen, screensByCluster };
}

export function screenToGlobal(grid, screenId, localX, localY) {
  const origin = grid.originByScreen[screenId];
  return { gx: origin.gx + localX, gy: origin.gy + localY };
}

// `screenId` only anchors which cluster to search - the returned screenId
// may be a different screen in that same cluster. Returns null past the
// cluster's outer edge.
export function globalToScreen(grid, screenId, gx, gy) {
  const clusterId = grid.clusterIdOfScreen[screenId];
  for (const candidateId of grid.screensByCluster[clusterId]) {
    const origin = grid.originByScreen[candidateId];
    if (gx >= origin.gx && gx < origin.gx + origin.width && gy >= origin.gy && gy < origin.gy + origin.height) {
      return { screenId: candidateId, localX: gx - origin.gx, localY: gy - origin.gy };
    }
  }
  return null;
}

export function clusterBounds(grid, screenId) {
  const clusterId = grid.clusterIdOfScreen[screenId];
  let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
  for (const candidateId of grid.screensByCluster[clusterId]) {
    const origin = grid.originByScreen[candidateId];
    minGx = Math.min(minGx, origin.gx);
    minGy = Math.min(minGy, origin.gy);
    maxGx = Math.max(maxGx, origin.gx + origin.width - 1);
    maxGy = Math.max(maxGy, origin.gy + origin.height - 1);
  }
  return { minGx, minGy, maxGx, maxGy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test 2>&1 | tee /tmp/worldgrid-test-green.txt`
Expected: PASS — all 7 new tests green, and every pre-existing test still passes (this file is new and touches nothing else).

- [ ] **Step 5: Commit**

```bash
git add js/systems/worldGrid.js tests/worldGrid.test.js
git commit -m "feat: add worldGrid topology module for stitching linked screens into one global coordinate space"
```

---

## Task 2: `computeViewportOrigin` — camera clamp math

**Files:**
- Modify: `js/systems/world.js`
- Test: `tests/world.test.js`

**Interfaces:**
- Consumes: nothing new (pure math).
- Produces: `computeViewportOrigin(centerGx, centerGy, tilesWide, tilesTall, bounds) -> {originGx, originGy}`, where `bounds` is `{minGx, minGy, maxGx, maxGy}` (the shape `clusterBounds` from Task 1 returns).

- [ ] **Step 1: Write the failing tests**

Add to `tests/world.test.js`:

```js
import { computeViewportOrigin } from '../js/systems/world.js'; // add to existing import line

test('computeViewportOrigin centers the viewport on the player away from any edge', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 99, maxGy: 99 };
  assert.deepEqual(computeViewportOrigin(50, 50, 11, 7, bounds), { originGx: 45, originGy: 47 });
});

test('computeViewportOrigin clamps at the minimum edge instead of showing past it', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 99, maxGy: 99 };
  assert.deepEqual(computeViewportOrigin(1, 1, 11, 7, bounds), { originGx: 0, originGy: 0 });
});

test('computeViewportOrigin clamps at the maximum edge instead of showing past it', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 99, maxGy: 99 };
  assert.deepEqual(computeViewportOrigin(98, 98, 11, 7, bounds), { originGx: 89, originGy: 93 });
});

test('computeViewportOrigin centers a whole small map (viewport bigger than the world) with no panning', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 9, maxGy: 7 }; // a 10x8 town-sized map
  assert.deepEqual(computeViewportOrigin(3, 3, 21, 15, bounds), { originGx: -5, originGy: -3 });
  // moving the "player" elsewhere on the same small map doesn't move the origin at all
  assert.deepEqual(computeViewportOrigin(8, 6, 21, 15, bounds), { originGx: -5, originGy: -3 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test 2>&1 | tee /tmp/viewport-origin-red.txt`
Expected: FAIL — `computeViewportOrigin is not a function` (or similar import error).

- [ ] **Step 3: Implement in `js/systems/world.js`**

Add this function to `js/systems/world.js` (anywhere among the other exported pure helpers, e.g. right after `isChokepointTile`):

```js
// The camera's top-left global tile for a viewport of tilesWide x tilesTall,
// centered on (centerGx, centerGy) - except clamped so the viewport never
// shows past `bounds` (a cluster's outer extent, from worldGrid.js's
// clusterBounds). When the viewport is bigger than the world itself in a
// given axis (true of every town/dungeon screen today), that axis centers
// the whole world instead of the player, with no panning ever possible in
// it - see js/screens/mapScreen.js's render().
export function computeViewportOrigin(centerGx, centerGy, tilesWide, tilesTall, bounds) {
  const worldWidth = bounds.maxGx - bounds.minGx + 1;
  const worldHeight = bounds.maxGy - bounds.minGy + 1;

  const originGx = tilesWide >= worldWidth
    ? bounds.minGx - Math.floor((tilesWide - worldWidth) / 2)
    : Math.max(bounds.minGx, Math.min(centerGx - Math.floor(tilesWide / 2), bounds.maxGx - tilesWide + 1));

  const originGy = tilesTall >= worldHeight
    ? bounds.minGy - Math.floor((tilesTall - worldHeight) / 2)
    : Math.max(bounds.minGy, Math.min(centerGy - Math.floor(tilesTall / 2), bounds.maxGy - tilesTall + 1));

  return { originGx, originGy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test 2>&1 | tee /tmp/viewport-origin-green.txt`
Expected: PASS — all 4 new tests green, full suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/systems/world.js tests/world.test.js
git commit -m "feat: add computeViewportOrigin camera-clamp math to world.js"
```

---

## Task 3: Parameterize `mapScreen.js`'s tile resolution by an explicit screen (no behavior change)

This is a pure refactor: `tileAt`/`isSealedWorldEdge` currently close over the module-level `mapConfig` singleton. Cross-screen rendering (Task 5) needs them to resolve tiles for *any* screen, not just "the currently mounted one" — so they need to take that screen explicitly as a parameter. This task makes that change with **zero behavior change** (every call site still passes the current `mapConfig`), verified by the existing test suite staying green.

**Files:**
- Modify: `js/screens/mapScreen.js:168-200` (`isSealedWorldEdge`, `tileAt`) and their call sites at lines 213 (`isScreenChokepoint`), 365 (`render`), 506 (`tryMove`).

**Interfaces:**
- Produces: `tileAt(screenConfig, x, y)` (was `tileAt(x, y)`), `isSealedWorldEdge(screenConfig, x, y)` (was `isSealedWorldEdge(x, y)`).

- [ ] **Step 1: Change the function signatures**

In `js/screens/mapScreen.js`, replace:

```js
function isSealedWorldEdge(x, y) {
  if (!mapConfig.neighbors) return false;
  const width = mapConfig.rows[0].length;
  const height = mapConfig.rows.length;
  if (y === 0 && !mapConfig.neighbors.north) return true;
  if (y === height - 1 && !mapConfig.neighbors.south) return true;
  if (x === 0 && !mapConfig.neighbors.west) return true;
  if (x === width - 1 && !mapConfig.neighbors.east) return true;
  return false;
}

function tileAt(x, y) {
  const entrance = state.dungeonEntrancePosition;
  if (entrance && mapConfig.id === entrance.screenId && x === entrance.x && y === entrance.y) {
    return TILES.dungeonEntrance;
  }
  for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
    if (mapConfig.id === toolEntrance.screenId && x === toolEntrance.x && y === toolEntrance.y) {
      return TILES[toolEntrance.tileKind];
    }
  }
  if (isSealedWorldEdge(x, y)) return TILES.mountainWall;
  const row = mapConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  const rawTile = TILES[mapConfig.legend[char]];
  const clearedReplacement = CLEARED_GATE_REPLACEMENT.get(rawTile);
  if (clearedReplacement && isGateCleared(state.clearedGates, mapConfig.id, x, y)) {
    return clearedReplacement;
  }
  return rawTile;
}
```

with:

```js
function isSealedWorldEdge(screenConfig, x, y) {
  if (!screenConfig.neighbors) return false;
  const width = screenConfig.rows[0].length;
  const height = screenConfig.rows.length;
  if (y === 0 && !screenConfig.neighbors.north) return true;
  if (y === height - 1 && !screenConfig.neighbors.south) return true;
  if (x === 0 && !screenConfig.neighbors.west) return true;
  if (x === width - 1 && !screenConfig.neighbors.east) return true;
  return false;
}

function tileAt(screenConfig, x, y) {
  const entrance = state.dungeonEntrancePosition;
  if (entrance && screenConfig.id === entrance.screenId && x === entrance.x && y === entrance.y) {
    return TILES.dungeonEntrance;
  }
  for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
    if (screenConfig.id === toolEntrance.screenId && x === toolEntrance.x && y === toolEntrance.y) {
      return TILES[toolEntrance.tileKind];
    }
  }
  if (isSealedWorldEdge(screenConfig, x, y)) return TILES.mountainWall;
  const row = screenConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  const rawTile = TILES[screenConfig.legend[char]];
  const clearedReplacement = CLEARED_GATE_REPLACEMENT.get(rawTile);
  if (clearedReplacement && isGateCleared(state.clearedGates, screenConfig.id, x, y)) {
    return clearedReplacement;
  }
  return rawTile;
}
```

- [ ] **Step 2: Update the three call sites to pass `mapConfig` explicitly**

- `isScreenChokepoint` (around line 239): change `isPassableTile(tileAt(px, py))` to `isPassableTile(tileAt(mapConfig, px, py))`.
- `checkGateProximity` (around line 213): change `const neighborTile = tileAt(nx, ny);` to `const neighborTile = tileAt(mapConfig, nx, ny);`.
- `render()` (around line 365): change `const tile = tileAt(x, y);` to `const tile = tileAt(mapConfig, x, y);` (this call site is fully replaced by Task 5's viewport rewrite, but must compile and pass tests in the meantime).
- `tryMove` (around line 506): change `const tile = tileAt(nx, ny);` to `const tile = tileAt(mapConfig, nx, ny);` (also replaced by Task 6, same reasoning).

- [ ] **Step 3: Run the existing test suite to confirm no regression**

Run: `npm run test 2>&1 | tee /tmp/task3-refactor.txt`
Expected: PASS — every existing test (`tests/mapScreenDom.test.js`, `tests/maps.test.js`, plus everything from Tasks 1-2) stays green. No test changes needed in this task since behavior is identical.

- [ ] **Step 4: Commit**

```bash
git add js/screens/mapScreen.js
git commit -m "refactor: parameterize mapScreen.js's tileAt/isSealedWorldEdge by an explicit screen"
```

---

## Task 4: Thread `maps`/`worldGrid` into `mapScreen.mount()` and `main.js`

**Files:**
- Modify: `js/screens/mapScreen.js:148-151` (module state), `:624-637` (`mount`)
- Modify: `js/main.js:77-113` (`MAPS`), `:386-406` (`goToMap`)
- Modify: `tests/mapScreenDom.test.js:15-20` (`mountTown` helper)

**Interfaces:**
- Consumes: `buildWorldGrid` from Task 1 (`js/systems/worldGrid.js`).
- Produces: `mapScreen.mount(root, { state, mapConfig, maps, worldGrid, callbacks })` — `maps` and `worldGrid` are new required props.

- [ ] **Step 1: Add module-level state and accept the new props in `js/screens/mapScreen.js`**

Change:

```js
let rootEl = null;
let state = null;
let mapConfig = null;
let callbacks = null;
```

to:

```js
let rootEl = null;
let state = null;
let mapConfig = null;
let maps = null;
let worldGrid = null;
let callbacks = null;
```

And in `mount(root, props)`, change:

```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  callbacks = props.callbacks;
```

to:

```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  maps = props.maps;
  worldGrid = props.worldGrid;
  callbacks = props.callbacks;
```

- [ ] **Step 2: Build `WORLD_GRID` once in `main.js` and pass both new props**

Add the import (alongside the other `js/systems/*` imports near the top of `js/main.js`):

```js
import { buildWorldGrid } from './systems/worldGrid.js';
```

Right after the `const MAPS = { ... };` object literal in `js/main.js`, add:

```js
const WORLD_GRID = buildWorldGrid(MAPS);
```

In `goToMap(mapId)`, change:

```js
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    callbacks: {
```

to:

```js
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    maps: MAPS,
    worldGrid: WORLD_GRID,
    callbacks: {
```

- [ ] **Step 3: Update the DOM test helper**

In `tests/mapScreenDom.test.js`, add the import and pass the new props:

```js
import { buildWorldGrid } from '../js/systems/worldGrid.js';
```

Change `mountTown`:

```js
async function mountTown(state) {
  const { mount } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  const maps = { town: townMap };
  mount(root, { state, mapConfig: townMap, maps, worldGrid: buildWorldGrid(maps), callbacks: { onFirstVisit: () => {} } });
  return root;
}
```

- [ ] **Step 4: Run the test suite**

Run: `npm run test 2>&1 | tee /tmp/task4-props.txt`
Expected: PASS — `mapScreen.js` doesn't read `maps`/`worldGrid` anywhere yet (that's Tasks 5-6), so this is purely additive; every test stays green.

- [ ] **Step 5: Commit**

```bash
git add js/screens/mapScreen.js js/main.js tests/mapScreenDom.test.js
git commit -m "feat: thread a shared worldGrid + maps registry into mapScreen.mount()"
```

---

## Task 5: Fixed-tile-size camera viewport — rewire `render()`

This is the core visual change: `render()` stops drawing `mapConfig.rows` in full and instead draws a fixed-tile-count window centered on the player, resolving each visible cell back to its owning screen.

**Files:**
- Modify: `css/styles.css:1-29` (`.map-grid`, `.map-tile`)
- Modify: `js/screens/mapScreen.js` (imports, new constants, `render()`, `handleResize()`)
- Modify: `tests/mapScreenDom.test.js` (resize test)

**Interfaces:**
- Consumes: `screenToGlobal`, `globalToScreen`, `clusterBounds` (Task 1), `computeViewportOrigin` (Task 2), `tileAt` (Task 3, now screen-parameterized).
- Produces: a new `.map-viewport` element wrapping `.map-grid`; `render()` no longer assumes the whole current screen is what's drawn.

- [ ] **Step 1: Update the CSS**

In `css/styles.css`, replace:

```css
.map-grid {
  display: grid;
  gap: 0;
  /* A tall obstacle overlaps upward into the row above it (see
     .map-tile-obstacle below) - fine for an interior tile, since the row
     above absorbs it, but the top row and outer columns have no
     neighbor to absorb into, so the canopy used to bleed straight past
     the game's own border into the page/HUD behind it. Clipping here
     cuts that overflow at the map's own edge while leaving every
     interior overlap untouched. */
  overflow: hidden;
}
.map-tile {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  background: #333;
  position: relative;
  /* Lets .map-tile-obstacle size itself off this tile's own rendered
     height (cqb units), regardless of viewport/column count. */
  container-type: size;
}
```

with:

```css
/* The camera's visible window - a fixed real-world size (not stretched to
   fill the browser window, unlike the old whole-screen grid), so how much
   of the stitched world is visible depends on the player's actual screen
   size (mobile sees less land) rather than on the game itself. See
   docs/superpowers/specs/2026-08-28-continuous-world-camera-design.md. */
.map-viewport {
  width: min(100%, 900px);
  height: min(70vh, 660px);
  margin: 0 auto;
  /* A tall obstacle overlaps upward into the row above it (see
     .map-tile-obstacle below) - clipping here cuts that overflow at the
     viewport's own edge while leaving every interior overlap untouched. */
  overflow: hidden;
}
.map-grid {
  display: grid;
  gap: 0;
}
.map-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  background: #333;
  position: relative;
  /* Lets .map-tile-obstacle size itself off this tile's own rendered
     height (cqb units) - a fixed pixel size now, not a 1fr-stretched
     column. */
  container-type: size;
}
```

- [ ] **Step 2: Add imports and constants to `js/screens/mapScreen.js`**

Add to the existing import block at the top of the file:

```js
import { screenToGlobal, globalToScreen, clusterBounds } from '../systems/worldGrid.js';
import { computeViewportOrigin } from '../systems/world.js';
```

(Note: `directionFromDelta`, `pickTileVariant`, `hash01`, `isChokepointTile` are already imported from `../systems/world.js` on line 2 — add `computeViewportOrigin` to that same import line rather than a new one.)

Add new constants near the top of the file, alongside the other layout constants (e.g. right after `FULL_SQUARE_CQB`/`HERO_AND_LOOT_CQB`):

```js
// Fixed real pixel size for every tile - the viewport's own CSS size
// (.map-viewport in css/styles.css) then determines how many whole tiles
// fit, which is what makes a smaller window/screen naturally show less of
// the stitched world. Tunable; not load-bearing for correctness.
const TILE_SIZE_PX = 48;
// jsdom has no real layout engine (tests/helpers/dom.js), so
// .clientWidth/.clientHeight always read 0 there - this is the fallback
// viewport size used whenever a real measurement isn't available, keeping
// DOM tests deterministic without needing to stub layout.
const DEFAULT_VIEWPORT_TILES_WIDE = 15;
const DEFAULT_VIEWPORT_TILES_TALL = 11;
```

- [ ] **Step 3: Add the viewport tile-count measurement helper**

Add this function near `render()`:

```js
function computeViewportTileCount(viewportEl) {
  const width = viewportEl.clientWidth;
  const height = viewportEl.clientHeight;
  if (!width || !height) {
    return { tilesWide: DEFAULT_VIEWPORT_TILES_WIDE, tilesTall: DEFAULT_VIEWPORT_TILES_TALL };
  }
  return {
    tilesWide: Math.max(1, Math.floor(width / TILE_SIZE_PX)),
    tilesTall: Math.max(1, Math.floor(height / TILE_SIZE_PX)),
  };
}
```

- [ ] **Step 4: Rewrite `render()`**

Replace the whole `render()` function body. The per-cell logic inside the loop is unchanged from today's version *except* every reference to `mapConfig`/`mapConfig.id` becomes the per-cell resolved `screenConfig`/`screenId`, and `x`/`y` (the loop variables) become the resolved `localX`/`localY` (renamed `x`/`y` again inside the loop body below so the rest of the per-cell code needs no further edits):

```js
function render() {
  const viewport = document.createElement('div');
  viewport.className = 'map-viewport';
  rootEl.innerHTML = '';
  rootEl.appendChild(viewport);

  const { tilesWide, tilesTall } = computeViewportTileCount(viewport);
  const centerGlobal = screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y);
  const bounds = clusterBounds(worldGrid, mapConfig.id);
  const { originGx, originGy } = computeViewportOrigin(centerGlobal.gx, centerGlobal.gy, tilesWide, tilesTall, bounds);

  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.gridTemplateColumns = `repeat(${tilesWide}, ${TILE_SIZE_PX}px)`;
  grid.style.gridTemplateRows = `repeat(${tilesTall}, ${TILE_SIZE_PX}px)`;

  for (let row = 0; row < tilesTall; row++) {
    for (let col = 0; col < tilesWide; col++) {
      const gx = originGx + col;
      const gy = originGy + row;
      const resolved = globalToScreen(worldGrid, mapConfig.id, gx, gy);
      // Unreachable in practice: computeViewportOrigin always clamps the
      // window fully inside clusterBounds, so every visible cell resolves.
      // Kept as a defensive skip rather than assuming that invariant blindly.
      if (!resolved) continue;
      const { screenId, localX: x, localY: y } = resolved;
      const screenConfig = maps[screenId];

      const cell = document.createElement('div');
      const tile = tileAt(screenConfig, x, y);
      const isPlayer = screenId === mapConfig.id && state.position.x === x && state.position.y === y;
      const hasMiniDungeon = hasMiniDungeonEntrance(state.miniDungeons, screenId, x, y);
      const hasTileCache = hasCache(state.caches, screenId, x, y);
      // A tile currently blocking the way is never shown as visited, even if
      // state.visited has a stale record from before the map was repainted
      // (the player really did stand on grass there once, but that record
      // shouldn't outlive the terrain it was standing on) - a permanent or
      // still-locked obstacle can never actually have been walked on.
      const isCurrentlyPassable = isPassableTile(tile);
      // Obstacles grow out of the grass, so they keep its green background
      // rather than looking like a hole cut in the field - see
      // RANDOM_SIZE_OBSTACLES above. Grass-context landmarks (town/
      // wilderness/dungeon action tiles) are their own distinct tile type
      // but conceptually sit on that same grass, so they get it too - see
      // GRASS_CONTEXT_MARKERS above. Stump/rubble (what those obstacles
      // become once cleared - see STUMP_AND_RUBBLE above) get the same
      // treatment as grass itself, not just the obstacle set.
      cell.className = 'map-tile'
        + (tile === TILES.grass || STUMP_AND_RUBBLE.has(tile) || RANDOM_SIZE_OBSTACLES.has(tile) || GRASS_CONTEXT_MARKERS.has(tile) ? ' map-tile-grass' : '')
        + (tile === TILES.water ? ' map-tile-water' : '')
        + (isPlayer ? ' map-tile-player' : '')
        // Visible from a distance so a completed quest doesn't only turn up
        // by walking in and checking - see docs/superpowers/BACKLOG.md's
        // "Quest board should glow..." item.
        + (tile === TILES.questBoard && hasAnyQuestReady(state) ? ' map-tile-quest-ready' : '');
      // A tile's own worn-path trail: dirt strokes reaching toward whichever
      // directions the player has actually walked across at this exact tile
      // (getVisitDirs - never inferred from a neighbor's own state, see
      // exploration.js), or a small dot if it's been visited but nothing's
      // been walked across it yet. Appended first so it paints underneath
      // every other *positioned* branch below (mount/rider, obstacle,
      // fullsize marker, decoration - same "append earlier = paints behind"
      // rule the decoration-behind-hero fix uses), with one exception: the
      // plain in-flow `cell.append(emoji)` fallback branch has no
      // `position`, and non-positioned in-flow content always paints before
      // positioned descendants regardless of DOM order - so on a tile that
      // falls through to that branch, the trail SVG actually paints ON TOP
      // of the emoji, not underneath it.
      if (isCurrentlyPassable && isVisited(state.visited, screenId, x, y)) {
        const fraction = trailWearFraction(getVisitCount(state.visited, screenId, x, y));
        const color = getTrailColor(tile);
        const groundColor = getGroundColor(tile);
        const dirs = getVisitDirs(state.visited, screenId, x, y);
        cell.appendChild(buildTrailFragment(x, y, dirs, fraction, color, groundColor));
      }
      // Depth-sort by viewport row instead of a fixed always-on-top/always-
      // behind z-index: a row's cells sit above every cell in the row above
      // it, so a tall obstacle's canopy (which overflows upward into the row
      // above, see .map-tile-obstacle) correctly paints over whatever's
      // there - including the player - while a player standing in a row
      // below an obstacle still renders in front of it, same as any other
      // ground content would.
      cell.style.zIndex = String(row);
      const emoji = hasMiniDungeon ? MINI_DUNGEON_MARKER_EMOJI : hasTileCache ? CACHE_MARKER_EMOJI : pickTileVariant(tile, x, y);
      const mountEmoji = isPlayer && tile.requiresTool && hasRequiredTool(tile, state.inventory)
        ? MOUNT_EMOJI_FOR_TOOL[tile.requiresTool] : null;
      const isRandomSizeObstacle = !hasMiniDungeon && !hasTileCache && RANDOM_SIZE_OBSTACLES.has(tile);
      const isFullSquareMarker = hasMiniDungeon || hasTileCache || FULL_SQUARE_MARKERS.has(tile);
      const isDecoratedGrass = !isFullSquareMarker && (tile === TILES.grass || STUMP_AND_RUBBLE.has(tile)) && emoji !== '';
      // Appended before the hero/marker span below (when both apply to the
      // same tile) so the decoration sits underneath it in paint order,
      // peeking out from around the edges instead of hiding whatever's
      // standing on the tile.
      function appendDecoration() {
        const decoration = document.createElement('span');
        decoration.className = 'map-tile-decoration';
        decoration.textContent = emoji;
        // Independently-salted hash streams so size and position don't
        // move in lockstep with each other or with the decoration pick.
        const scale = DECORATION_MIN_SCALE + hash01(x + 1000, y + 1000) * (DECORATION_MAX_SCALE - DECORATION_MIN_SCALE);
        const left = DECORATION_POSITION_MIN_PCT + hash01(x + 2000, y + 2000) * (DECORATION_POSITION_MAX_PCT - DECORATION_POSITION_MIN_PCT);
        const top = DECORATION_POSITION_MIN_PCT + hash01(x + 3000, y + 3000) * (DECORATION_POSITION_MAX_PCT - DECORATION_POSITION_MIN_PCT);
        decoration.style.fontSize = `${(DECORATION_BASE_REM * scale).toFixed(2)}rem`;
        decoration.style.left = `${left.toFixed(1)}%`;
        decoration.style.top = `${top.toFixed(1)}%`;
        cell.appendChild(decoration);
      }
      if (mountEmoji) {
        const mount = document.createElement('span');
        mount.className = 'map-tile-mount';
        mount.textContent = mountEmoji;
        const rider = document.createElement('span');
        rider.className = 'map-tile-rider';
        rider.textContent = state.player.emoji;
        cell.append(mount, rider);
      } else if (isRandomSizeObstacle) {
        const obstacle = document.createElement('span');
        obstacle.className = 'map-tile-obstacle';
        obstacle.textContent = emoji;
        const size = FULL_SQUARE_CQB * (1 + hash01(x, y) * OBSTACLE_MAX_EXTRA);
        obstacle.style.fontSize = `${size.toFixed(1)}cqb`;
        cell.appendChild(obstacle);
      } else if (isFullSquareMarker || isPlayer) {
        // The hero can land on a decorated grass tile - render the
        // decoration first so it still peeks out from behind the hero
        // instead of the hero vanishing behind it (the old bug: this
        // branch used to be checked *after* isDecoratedGrass, so the
        // decoration won outright and hid the player entirely).
        if (isDecoratedGrass) appendDecoration();
        // The hero is always full-square. cqb units only resolve against
        // the nearest ANCESTOR query container - .map-tile establishes
        // that containment itself, so this has to be a child span, not a
        // class on the cell, or cqb falls through past it to the
        // viewport (an early version of this did exactly that).
        const marker = document.createElement('span');
        marker.className = 'map-tile-fullsize';
        marker.textContent = isPlayer ? state.player.emoji : emoji;
        // Hero and loot read better a touch smaller than town/cave
        // entrances - the CSS class's own font-size (FULL_SQUARE_CQB)
        // stays the default for everything else in this branch.
        const isHeroOrLoot = isPlayer || hasTileCache || tile === TILES.miniDungeonTreasure;
        if (isHeroOrLoot) marker.style.fontSize = `${HERO_AND_LOOT_CQB}cqb`;
        cell.appendChild(marker);
      } else if (isDecoratedGrass) {
        appendDecoration();
      } else if (emoji) {
        cell.append(emoji);
      }
      cell.title = hasMiniDungeon ? MINI_DUNGEON_MARKER_DESCRIPTION : hasTileCache ? CACHE_MARKER_DESCRIPTION : tile.description;
      grid.appendChild(cell);
    }
  }

  viewport.appendChild(grid);
}
```

- [ ] **Step 5: Simplify `handleResize()`**

The old Safari workaround (toggling `.map-grid`'s `display`) targeted the `repeat(N, 1fr)` track-sizing bug specific to `1fr`-stretched grid tracks — the grid no longer uses `1fr` tracks (Step 1/4 above use fixed pixel sizes), and `render()` now rebuilds the viewport/grid from scratch on every call, which is a strict superset of what the old toggle accomplished. Replace:

```js
function handleResize() {
  if (!rootEl) return;
  const grid = rootEl.querySelector('.map-grid');
  if (!grid) return;
  grid.style.display = 'none';
  void grid.offsetHeight;
  grid.style.display = '';
}
```

with:

```js
// Window resize can change how many tiles fit in the viewport (see
// computeViewportTileCount) - re-render from scratch to pick that up,
// which also sidesteps the old Safari-specific grid-track-sizing bug this
// function used to work around (that bug was specific to 1fr-stretched
// tracks, which the fixed-pixel-size grid above no longer uses).
function handleResize() {
  if (!rootEl || !mapConfig) return;
  render();
}
```

- [ ] **Step 6: Update the resize test**

The old test asserted the specific display-toggle sequence, which no longer happens. Replace it in `tests/mapScreenDom.test.js`:

```js
// Old Safari-specific bug: a CSS Grid whose tracks size aspect-ratio
// children (.map-grid / .map-tile) didn't reliably re-run its track-sizing
// pass on a live window resize. The grid is fixed-pixel-sized now (not
// 1fr-stretched), and render() rebuilds the whole viewport/grid from
// scratch, so this now just confirms a resize triggers a fresh render
// rather than leaving the old grid element in place.
test('mapScreen DOM - resize triggers a fresh render', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('window resize replaces the mounted map grid element', async () => {
    const root = await mountTown(baseState());
    const gridBefore = root.querySelector('.map-grid');

    window.dispatchEvent(new Event('resize'));

    const gridAfter = root.querySelector('.map-grid');
    assert.notEqual(gridBefore, gridAfter, 'expected resize to rebuild the map grid element');
  });
});
```

- [ ] **Step 7: Run the test suite**

Run: `npm run test 2>&1 | tee /tmp/task5-viewport.txt`
Expected: PASS — the quest-board-glow tests still pass (town is smaller than the default 15x11 viewport, so it renders fully, same as today); the new resize test passes.

- [ ] **Step 8: Commit**

```bash
git add css/styles.css js/screens/mapScreen.js tests/mapScreenDom.test.js
git commit -m "feat: render mapScreen through a fixed-tile-size camera viewport instead of the whole screen"
```

---

## Task 6: Global-coordinate movement — rewire `tryMove`

Replaces the out-of-bounds-triggers-a-teleport model with stepping in global coordinates and swapping the current screen inline when a step crosses into a different one. This also removes the old `onEdgeTransition` callback and, as a side effect, fixes the mountain-gate-doesn't-break-on-landing bug (see spec's Problem section) since crossing a screen boundary now runs through the exact same tool-gate logic as any other step.

**Files:**
- Modify: `js/screens/mapScreen.js` (`mount()`, `tryMove()`)

**Interfaces:**
- Consumes: `screenToGlobal`, `globalToScreen` (Task 1).
- Removes: the `onEdgeTransition` callback entirely (no replacement callback needed — see Step 3's rationale).

- [ ] **Step 1: Extract the "first visit to this screen" check into a shared helper**

Today this check only runs once, inline in `mount()`. It needs to run again every time `tryMove` crosses into a new screen, so extract it. Replace, in `mount()`:

```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  maps = props.maps;
  worldGrid = props.worldGrid;
  callbacks = props.callbacks;
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, state.position.x, state.position.y) });
  render();
  if (!hasSeenScreen(state.seenScreens, mapConfig.id)) {
    Object.assign(state, { seenScreens: markScreenSeen(state.seenScreens, mapConfig.id) });
    callbacks.onFirstVisit(mapConfig.id);
  }
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);
}
```

with:

```js
// Fires callbacks.onFirstVisit the first time the player ever sets foot on
// `screenConfig` - called once from mount() for the screen the game
// actually starts/resumes on, and again from tryMove() whenever a step
// crosses into a screen that isn't the one just left (see tryMove below).
function announceScreenIfNew(screenConfig) {
  if (!hasSeenScreen(state.seenScreens, screenConfig.id)) {
    Object.assign(state, { seenScreens: markScreenSeen(state.seenScreens, screenConfig.id) });
    callbacks.onFirstVisit(screenConfig.id);
  }
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  maps = props.maps;
  worldGrid = props.worldGrid;
  callbacks = props.callbacks;
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, state.position.x, state.position.y) });
  render();
  announceScreenIfNew(mapConfig);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);
}
```

- [ ] **Step 2: Rewrite `tryMove`'s entry to resolve the step via `worldGrid` instead of `isOutOfBounds`**

Replace the opening of `tryMove` (from the function signature through the `!tile.walkable` block's screen-id reference):

```js
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
  if (!tile) return;
  if (!tile.walkable) {
    if (!tile.requiresTool) return;
    if (!hasRequiredTool(tile, state.inventory)) {
      callbacks.onLockedGate(getLockedGateMessage(tile.requiresTool));
      return;
    }
    callbacks.onToolGateCleared(getToolClearedMessage(tile.requiresTool));
    // Permanently convert thicket/mountain to a stump/rubble marker the
    // first time it's crossed - water is absent from CLEARED_GATE_REPLACEMENT
    // on purpose, so canoeing across it never changes the tile (raised
    // 2026-08-28).
    if (CLEARED_GATE_REPLACEMENT.has(tile)) {
      Object.assign(state, { clearedGates: markGateCleared(state.clearedGates, mapConfig.id, nx, ny) });
    }
  }
```

with:

```js
function tryMove(dx, dy) {
  const currentGlobal = screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y);
  const resolved = globalToScreen(worldGrid, mapConfig.id, currentGlobal.gx + dx, currentGlobal.gy + dy);
  // Past this cluster's outer edge - e.g. a one-screen map's (town,
  // dungeon) own array bounds, or (in principle) the wilderness cluster's
  // outermost rectangle, though that's unreachable in practice since
  // isSealedWorldEdge already makes every true boundary ring impassable
  // before a step could ever resolve past it.
  if (!resolved) return;
  const { screenId: nextScreenId, localX: nx, localY: ny } = resolved;
  const screenConfig = maps[nextScreenId];

  const tile = tileAt(screenConfig, nx, ny);
  if (!tile) return;
  if (!tile.walkable) {
    if (!tile.requiresTool) return;
    if (!hasRequiredTool(tile, state.inventory)) {
      callbacks.onLockedGate(getLockedGateMessage(tile.requiresTool));
      return;
    }
    callbacks.onToolGateCleared(getToolClearedMessage(tile.requiresTool));
    // Permanently convert thicket/mountain to a stump/rubble marker the
    // first time it's crossed - water is absent from CLEARED_GATE_REPLACEMENT
    // on purpose, so canoeing across it never changes the tile (raised
    // 2026-08-28). This now also fires correctly when the gate sits on the
    // very first tile of a screen crossed into from another screen -
    // previously handled by a separate teleport path (handleEdgeTransition)
    // that never ran this check at all (bug raised 2026-08-28).
    if (CLEARED_GATE_REPLACEMENT.has(tile)) {
      Object.assign(state, { clearedGates: markGateCleared(state.clearedGates, screenConfig.id, nx, ny) });
    }
  }
```

- [ ] **Step 3: Update the rest of `tryMove` to key off `screenConfig`/`nextScreenId` and swap the current screen inline**

Replace the remainder of `tryMove` (from the trail-marking block through the end of the function):

```js
  // Record which edge this step actually crossed on both sides of it: the
  // tile being left gets the direction moved (its own exit edge), the tile
  // being entered gets the opposite (the edge it was entered through) - see
  // exploration.js's markDirection/markVisited. This is what replaces
  // inferring a trail's connected directions from "is the neighbor also
  // visited," which produced false connections (a "ladder" of rungs
  // between two separately-walked parallel corridors) whenever two tiles
  // happened to both be visited without the player ever actually stepping
  // directly between them.
  const exitDir = trailDirFromDelta(dx, dy);
  if (exitDir) {
    Object.assign(state, { visited: markDirection(state.visited, mapConfig.id, state.position.x, state.position.y, exitDir) });
  }
  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny, exitDir ? TRAIL_OPPOSITE_DIR[exitDir] : undefined) });

  const discovery = resolveStepDiscovery(state, mapConfig, nx, ny, tile, Math.random, isScreenChokepoint);
  if (discovery.miniDungeons) {
    Object.assign(state, { miniDungeons: discovery.miniDungeons });
  }
  if (discovery.caches) {
    Object.assign(state, { caches: discovery.caches });
  }

  let gateReward = null;
  if (tile.hasReward && !isGateRewardCollected(state.gateRewards, mapConfig.id, nx, ny)) {
    Object.assign(state, { gateRewards: markGateRewardCollected(state.gateRewards, mapConfig.id, nx, ny) });
    gateReward = rollGateReward();
  }

  // Render before firing any callback: an action may swap screens and an
  // encounter opens a battle *overlay* on top of this still-mounted map, so the
  // world underneath must already show the tile the player just stepped onto
  // (including a freshly discovered cache or mini-dungeon marker).
  render();

  callbacks.onMove(state.position);
  checkGateProximity(nx, ny);

  if (gateReward) {
    callbacks.onGateReward(gateReward);
    return;
  }

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (discovery.outcome === 'enterMiniDungeon') {
    callbacks.onEnterMiniDungeon(mapConfig.id, nx, ny);
    return;
  }

  if (discovery.outcome === 'cache') {
    callbacks.onCacheFound(discovery.cacheLoot);
    return;
  }

  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    // A flat 5% chance for any encounter (wilderness or dungeon) to be the
    // rare elite instead of the normal roll - always solo, bypassing the
    // multi-mob grouping below entirely. The empty-override array (matching
    // the boss-fight pattern) tells handleEncounter this monster's stats are
    // already final, skipping the random stat-variant roll.
    if (rollEliteEncounter()) {
      callbacks.onEncounter([ELITE_MONSTER_ID], [{}]);
      return;
    }
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts);
    callbacks.onEncounter(monsterIds);
  }
}
```

with (every `mapConfig.id`/`mapConfig` reference below now reads `screenConfig.id`/`screenConfig`, and the current-screen swap happens right after `state.position` updates, before `render()`):

```js
  // Record which edge this step actually crossed on both sides of it - see
  // exploration.js's markDirection/markVisited. Recorded against
  // mapConfig.id (the screen being LEFT) before the current-screen swap
  // below, and against screenConfig.id (the screen being ENTERED) after -
  // these are usually the same screen, and are deliberately different ids
  // exactly when this step crosses a screen boundary.
  const exitDir = trailDirFromDelta(dx, dy);
  if (exitDir) {
    Object.assign(state, { visited: markDirection(state.visited, mapConfig.id, state.position.x, state.position.y, exitDir) });
  }
  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, screenConfig.id, nx, ny, exitDir ? TRAIL_OPPOSITE_DIR[exitDir] : undefined) });

  // Swap which screen is "current" inline - no remount, no teleport, no
  // separate onEdgeTransition callback. state.map is set directly (mirrors
  // every other state.* field this function already writes for
  // persistence's benefit, e.g. state.visited/state.clearedGates above) so
  // main.js's own persist()/exitMap logic sees the right screen without a
  // dedicated callback round-trip.
  if (screenConfig.id !== mapConfig.id) {
    mapConfig = screenConfig;
    state.map = screenConfig.id;
    announceScreenIfNew(screenConfig);
  }

  const discovery = resolveStepDiscovery(state, mapConfig, nx, ny, tile, Math.random, isScreenChokepoint);
  if (discovery.miniDungeons) {
    Object.assign(state, { miniDungeons: discovery.miniDungeons });
  }
  if (discovery.caches) {
    Object.assign(state, { caches: discovery.caches });
  }

  let gateReward = null;
  if (tile.hasReward && !isGateRewardCollected(state.gateRewards, mapConfig.id, nx, ny)) {
    Object.assign(state, { gateRewards: markGateRewardCollected(state.gateRewards, mapConfig.id, nx, ny) });
    gateReward = rollGateReward();
  }

  // Render before firing any callback: an action may swap screens and an
  // encounter opens a battle *overlay* on top of this still-mounted map, so the
  // world underneath must already show the tile the player just stepped onto
  // (including a freshly discovered cache or mini-dungeon marker).
  render();

  callbacks.onMove(state.position);
  checkGateProximity(nx, ny);

  if (gateReward) {
    callbacks.onGateReward(gateReward);
    return;
  }

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (discovery.outcome === 'enterMiniDungeon') {
    callbacks.onEnterMiniDungeon(mapConfig.id, nx, ny);
    return;
  }

  if (discovery.outcome === 'cache') {
    callbacks.onCacheFound(discovery.cacheLoot);
    return;
  }

  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    // A flat 5% chance for any encounter (wilderness or dungeon) to be the
    // rare elite instead of the normal roll - always solo, bypassing the
    // multi-mob grouping below entirely. The empty-override array (matching
    // the boss-fight pattern) tells handleEncounter this monster's stats are
    // already final, skipping the random stat-variant roll.
    if (rollEliteEncounter()) {
      callbacks.onEncounter([ELITE_MONSTER_ID], [{}]);
      return;
    }
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts);
    callbacks.onEncounter(monsterIds);
  }
}
```

Note `isOutOfBounds` and `directionFromDelta` are no longer called from `tryMove`, but `isOutOfBounds` is still used by `checkGateProximity`/`isScreenChokepoint` (local-only neighbor checks, unchanged per the spec's accepted chokepoint limitation) — do not remove it. `directionFromDelta` becomes unused in this file; leave its import in `js/systems/world.js` alone (Task 8 checks for any other remaining usages before touching that export).

- [ ] **Step 4: Run the test suite**

Run: `npm run test 2>&1 | tee /tmp/task6-trymove.txt`
Expected: FAIL at this point specifically in `tests/mapScreenDom.test.js`/`tests/maps.test.js` is *not* expected yet, since those don't exercise `tryMove`'s keyboard path directly — but `main.js` still calls `callbacks.onEdgeTransition` in its own `goToMap`, which is now a no-op callback name mismatch, not a crash (mapScreen.js just never calls it anymore). Confirm: PASS with no regressions. If anything fails, it means a call site of `tileAt`/`isOutOfBounds` was missed — check the diff against Task 3's signature change.

- [ ] **Step 5: Commit**

```bash
git add js/screens/mapScreen.js
git commit -m "feat: step movement in global coordinates, removing the teleport-based screen transition"
```

---

## Task 7: Remove the dead edge-transition path from `main.js`

**Files:**
- Modify: `js/main.js:62` (import), `:396` (`goToMap` callbacks), `:467-473` (`handleEdgeTransition`)

**Interfaces:**
- Removes: `handleEdgeTransition`, the `onEdgeTransition` callback wiring, the `computeEdgeLandingPosition` import.

- [ ] **Step 1: Remove the callback wiring**

In `goToMap`, remove the `onEdgeTransition: handleEdgeTransition,` line from the callbacks object (mapScreen.js no longer calls this callback as of Task 6).

- [ ] **Step 2: Delete `handleEdgeTransition`**

Remove the whole function:

```js
function handleEdgeTransition(neighborId, direction, currentPosition) {
  const neighborMap = MAPS[neighborId];
  state.position = computeEdgeLandingPosition(direction, currentPosition, neighborMap);
  state.map = neighborId;
  persist();
  goToMap(neighborId);
}
```

- [ ] **Step 3: Update the import**

Change:

```js
import { computeEdgeLandingPosition, isValidSavedPosition } from './systems/world.js';
```

to:

```js
import { isValidSavedPosition } from './systems/world.js';
```

- [ ] **Step 4: Run the test suite**

Run: `npm run test 2>&1 | tee /tmp/task7-mainjs.txt`
Expected: PASS — nothing in the test suite imports `main.js` directly (it self-executes `mountStartScreen()` at module load, which none of the existing tests trigger), so this is a safe deletion confirmed by the full suite staying green.

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "refactor: remove the now-dead teleport-based screen transition from main.js"
```

---

## Task 8: Retire `computeEdgeLandingPosition` and migrate its remaining test usage

`computeEdgeLandingPosition` is now unused by runtime code (Task 7), but two test files still call it as a pure "mirrored edge landing" helper for their own reachability graph-walks. Since `worldGrid.js` computes the exact same thing (for a uniform grid, crossing a screen boundary always lands on the neighbor's mirrored edge — that's what `screenToGlobal`/`globalToScreen` already prove via Task 1's round-trip test), migrate both to use `worldGrid` and delete the old function so there's only one implementation of this logic.

**Files:**
- Modify: `tests/maps.test.js:33` (import), `:120-164` (`floodFillWholeWorld`)
- Modify: `tests/world.test.js:3`, `:12-20` (remove the `computeEdgeLandingPosition` test)
- Modify: `js/systems/world.js` (delete `computeEdgeLandingPosition`)

- [ ] **Step 1: Migrate `tests/maps.test.js`'s `floodFillWholeWorld`**

Change the import (line 33):

```js
import { isWalkableAt, isValidSavedPosition, computeEdgeLandingPosition } from '../js/systems/world.js';
```

to:

```js
import { isWalkableAt, isValidSavedPosition } from '../js/systems/world.js';
import { buildWorldGrid, screenToGlobal, globalToScreen } from '../js/systems/worldGrid.js';
```

Change `floodFillWholeWorld` (the function using `computeEdgeLandingPosition` at line 149):

```js
function floodFillWholeWorld(wilderness, start, isPassable) {
  const tileKey = (id, x, y) => `${id}:${x},${y}`;
  const visited = new Set([tileKey(start.id, start.x, start.y)]);
  const queue = [start];

  while (queue.length > 0) {
    const { id, x, y } = queue.shift();
    const map = wilderness[id];
    const width = map.rows[0].length;
    const height = map.rows.length;
    for (const [dir, [dx, dy]] of Object.entries(EDGE_DIRECTIONS)) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        const neighborId = map.neighbors[dir];
        if (!neighborId) continue;
        const landing = computeEdgeLandingPosition(dir, { x, y }, wilderness[neighborId]);
        const k = tileKey(neighborId, landing.x, landing.y);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ id: neighborId, x: landing.x, y: landing.y });
        continue;
      }
      if (!isPassable(map, nx, ny)) continue;
      const k = tileKey(id, nx, ny);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ id, x: nx, y: ny });
    }
  }
  return { visited, tileKey };
}
```

to (the `worldGrid` is built once outside the function, since `wilderness` is the same fixed registry across every call in this file):

```js
function floodFillWholeWorld(wilderness, start, isPassable) {
  const grid = buildWorldGrid(wilderness);
  const tileKey = (id, x, y) => `${id}:${x},${y}`;
  const visited = new Set([tileKey(start.id, start.x, start.y)]);
  const queue = [start];

  while (queue.length > 0) {
    const { id, x, y } = queue.shift();
    const map = wilderness[id];
    const width = map.rows[0].length;
    const height = map.rows.length;
    for (const [dir, [dx, dy]] of Object.entries(EDGE_DIRECTIONS)) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        const neighborId = map.neighbors[dir];
        if (!neighborId) continue;
        const { gx, gy } = screenToGlobal(grid, id, x, y);
        const landing = globalToScreen(grid, id, gx + dx, gy + dy);
        const k = tileKey(landing.screenId, landing.localX, landing.localY);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ id: landing.screenId, x: landing.localX, y: landing.localY });
        continue;
      }
      if (!isPassable(map, nx, ny)) continue;
      const k = tileKey(id, nx, ny);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ id, x: nx, y: ny });
    }
  }
  return { visited, tileKey };
}
```

Also update the comment right above this function (originally referencing `js/main.js's handleEdgeTransition`/`computeEdgeLandingPosition`, both now deleted):

```js
// Wilderness screens are not self-contained: a screen can legitimately be
// split by a mountain range or river into two halves that each only connect
// out through a *different* neighboring screen, never to each other
// locally - so checking each screen in isolation from its own generic
// center point produces massive false positives (an earlier version of this
// check flagged 13 of 25 screens, thousands of tiles). Any real reachability
// check has to walk the whole stitched 5x5 world the same way the real game
// does (js/systems/worldGrid.js - a landing tile is always a valid graph
// node even if it isn't itself "passable"). Shared by both the whole-world
// walk and the staged tool-unlock-order walk below.
```

- [ ] **Step 2: Remove the `computeEdgeLandingPosition` test from `tests/world.test.js`**

Delete this test:

```js
test('computeEdgeLandingPosition places the player on the mirrored edge of the neighbor screen', () => {
  const currentPosition = { x: 5, y: 3 };
  const neighborMap = { rows: new Array(11).fill('.'.repeat(15)) };

  assert.deepEqual(computeEdgeLandingPosition('east', currentPosition, neighborMap), { x: 0, y: 3 });
  assert.deepEqual(computeEdgeLandingPosition('west', currentPosition, neighborMap), { x: 14, y: 3 });
  assert.deepEqual(computeEdgeLandingPosition('south', currentPosition, neighborMap), { x: 5, y: 0 });
  assert.deepEqual(computeEdgeLandingPosition('north', currentPosition, neighborMap), { x: 5, y: 10 });
});
```

And remove `computeEdgeLandingPosition` from the import line at the top of the file (keep `directionFromDelta` and everything else — `directionFromDelta`'s own test stays, since it's a separate, still-used pure helper).

- [ ] **Step 3: Delete `computeEdgeLandingPosition` from `js/systems/world.js`**

Remove:

```js
export function computeEdgeLandingPosition(direction, currentPosition, neighborMap) {
  if (direction === 'east') return { x: 0, y: currentPosition.y };
  if (direction === 'west') return { x: neighborMap.rows[0].length - 1, y: currentPosition.y };
  if (direction === 'south') return { x: currentPosition.x, y: 0 };
  return { x: currentPosition.x, y: neighborMap.rows.length - 1 };
}
```

- [ ] **Step 4: Confirm nothing else references it**

Run: `grep -rn "computeEdgeLandingPosition" js/ tests/`
Expected: no matches.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test 2>&1 | tee /tmp/task8-cleanup.txt`
Expected: PASS — every test in `tests/maps.test.js` (including the whole-world and staged-tool-unlock reachability walks) and `tests/world.test.js` still passes, now backed by `worldGrid` instead of the deleted function.

- [ ] **Step 6: Commit**

```bash
git add js/systems/world.js tests/maps.test.js tests/world.test.js
git commit -m "refactor: retire computeEdgeLandingPosition now that worldGrid covers the same logic"
```

---

## Task 9: Manual verification pass

No code changes — this is the spec's own testing checklist, run against the real game in a real browser (jsdom, per `tests/helpers/dom.js`'s own header, has no real layout engine and can't verify actual pixel geometry/CSS/animation timing).

- [ ] **Step 1: Start the app locally and walk every wilderness screen boundary**

Serve `index.html` locally (e.g. `npx serve .` or any static file server) and, playing as far as save state allows (or starting a fresh character), walk across several of the 25 wilderness screen boundaries in each direction. Confirm: no visual pop/cut when crossing, the character emoji is always visible (never hidden inside a mountain/tree obstacle graphic on landing), and the camera stays centered on the player except near the outer edge of the whole wilderness, where it stops panning and the player visibly approaches the edge of the viewport.

- [ ] **Step 2: Verify the tool-gate landing bug is fixed**

With the pick (or axe/canoe) in inventory, approach a screen boundary where a mountain/thicket/water gate tile sits on or near the far side, and cross into it. Confirm it converts to rubble/stump (or renders the mount emoji for water) immediately, the same as walking into one mid-screen already does today.

- [ ] **Step 3: Verify town and dungeon interiors are visually unchanged**

Enter town and each dungeon (main dungeon, axe/pick/canoe tool dungeons, a mini-dungeon). Confirm each still shows its full extent on screen with no panning, matching today's behavior.

- [ ] **Step 4: Verify window resize**

Resize the browser window (both directions) while on a wilderness screen. Confirm the viewport reflows to show more/less of the world (no stale/stuck sizing — this is also what replaces the old Safari-specific resize workaround; see Task 5 Step 5). If a Safari browser/device is available, check there specifically, since that's where the original bug this replaces was reported.

- [ ] **Step 5: Spot-check for a visual seam at former screen boundaries**

Walk along a couple of wilderness screen boundaries and look for any obvious visual "seam" in decoration placement or obstacle sizing exactly at the old screen edge (each screen's own tile-hash-based decoration/obstacle sizing is deterministic per *local* coordinate, per screen — see `js/systems/world.js`'s `hash01`/`pickTileVariant` — so two screens' edges were never previously visible side-by-side to compare). This is a known, accepted possibility per the spec, not a blocker — note anything visually jarring for a future follow-up rather than treating it as a bug to fix in this plan.

- [ ] **Step 6: Confirm no console errors**

Open the browser devtools console during the above and confirm no errors/warnings appear from `js/screens/mapScreen.js`, `js/systems/worldGrid.js`, or `js/main.js`.
