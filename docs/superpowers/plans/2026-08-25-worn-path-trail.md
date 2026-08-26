# Worn-Path Trail Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `.visited` background tint with a directional, wear-scaled dirt-trail effect rendered per tile, so walking around the map leaves a real connected path instead of a uniform color swap.

**Architecture:** `state.visited` upgrades from a per-tile boolean to a per-tile walk count (`js/systems/exploration.js`). A new pure module (`js/systems/trail.js`) computes wear fractions, per-edge waviness, connector-path geometry, and terrain-keyed trail color — all deterministic, all unit-testable without a DOM. `js/screens/mapScreen.js`'s existing per-cell `render()` loop appends one small inline SVG fragment per visited+passable tile (reaching toward connected neighbors, or a small dot if isolated), reusing the trail module's pure functions for the numbers and doing the actual `createElementNS` DOM construction itself, consistent with how obstacles/decorations already work in that file.

**Tech Stack:** Vanilla JS (ES modules), inline SVG (no library), `node --test` for unit tests. No jsdom in this repo — DOM/rendering behavior is verified manually in-browser, not by automated test.

**Spec:** `docs/superpowers/specs/2026-08-25-worn-path-trail-design.md`

## Global Constraints

- `isVisited(visited, screenId, x, y)`'s existing signature and truthy/falsy meaning must not change — every existing caller depends on it unchanged.
- Wear is capped at 10 visits (`TRAIL_WEAR_CAP = 10`); a visit count above the cap must clamp, never produce a fraction above 1.
- Connectivity is 4-directional only (north/south/east/west) — no diagonals, matching the game's own movement model.
- All pseudo-randomness reuses the existing `hash01(x, y)` from `js/systems/world.js` (the same deterministic-per-position utility obstacles/decorations already use) — never introduce a second RNG source.
- Always run the full suite with `npm run test` (never a subset, never piped through `tail`) after every task, and show full output.
- No jsdom in this repo: any step touching `js/screens/mapScreen.js`'s actual rendering output requires manual in-browser verification (a static file server + browser automation, or the dev server the project already uses), not an automated DOM test.

---

### Task 1: Walk-count data model

**Files:**
- Modify: `js/systems/exploration.js`
- Test: `tests/exploration.test.js`

**Interfaces:**
- Produces: `markVisited(visited, screenId, x, y) → visited` (unchanged signature, now increments instead of setting `true`), `isVisited(visited, screenId, x, y) → boolean` (unchanged signature/meaning), `getVisitCount(visited, screenId, x, y) → number` (new export — 0 for never-visited, the real count otherwise, and `1` for a legacy `true` entry).

- [ ] **Step 1: Write the failing tests**

Add to `tests/exploration.test.js` (keep the 3 existing tests as-is — they still pass unchanged against the new implementation; just add the import and these new tests):

```js
import { markVisited, isVisited, getVisitCount } from '../js/systems/exploration.js';

test('markVisited increments the walk count on repeated visits to the same tile', () => {
  let visited = markVisited({}, 'center', 3, 3);
  visited = markVisited(visited, 'center', 3, 3);
  visited = markVisited(visited, 'center', 3, 3);
  assert.equal(getVisitCount(visited, 'center', 3, 3), 3);
});

test('getVisitCount returns 0 for a tile that was never visited', () => {
  assert.equal(getVisitCount({}, 'center', 0, 0), 0);
  assert.equal(getVisitCount({ center: {} }, 'center', 0, 0), 0);
});

test('getVisitCount treats a legacy boolean true (old save format) as a count of 1', () => {
  const legacyVisited = { center: { '3,4': true } };
  assert.equal(getVisitCount(legacyVisited, 'center', 3, 4), 1);
  assert.equal(isVisited(legacyVisited, 'center', 3, 4), true);
});

test('markVisited on a legacy boolean entry upgrades it to a real count', () => {
  const legacyVisited = { center: { '3,4': true } };
  const next = markVisited(legacyVisited, 'center', 3, 4);
  assert.equal(getVisitCount(next, 'center', 3, 4), 2);
});
```

Replace the existing `import { markVisited, isVisited } from '../js/systems/exploration.js';` line with the one above (adds `getVisitCount` to the same import).

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm run test`
Expected: the 4 new tests FAIL (`getVisitCount` is not exported yet); the 3 pre-existing tests in this file still PASS.

- [ ] **Step 3: Implement**

Replace the full contents of `js/systems/exploration.js` with:

```js
export function markVisited(visited, screenId, x, y) {
  const key = `${x},${y}`;
  const screenVisited = { ...(visited[screenId] || {}) };
  screenVisited[key] = getVisitCount(visited, screenId, x, y) + 1;
  return { ...visited, [screenId]: screenVisited };
}

export function isVisited(visited, screenId, x, y) {
  return getVisitCount(visited, screenId, x, y) > 0;
}

export function getVisitCount(visited, screenId, x, y) {
  const raw = visited[screenId] && visited[screenId][`${x},${y}`];
  if (raw === true) return 1; // legacy saves stored a boolean
  return raw || 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: full suite PASSES, including all 7 tests now in `tests/exploration.test.js`.

- [ ] **Step 5: Commit**

```bash
git add js/systems/exploration.js tests/exploration.test.js
git commit -m "feat: track walk count per tile instead of a visited boolean"
```

---

### Task 2: Pure trail-logic module

**Files:**
- Create: `js/systems/trail.js`
- Test: `tests/trail.test.js`

**Interfaces:**
- Consumes: `TILES` from `js/tiles.js`; `hash01(x, y)` from `js/systems/world.js`.
- Produces: `TRAIL_WEAR_CAP` (number, `10`), `trailWearFraction(visitCount) → number` (0..1), `trailStrokeOpacity(fraction) → number`, `trailStrokeWidth(fraction) → number`, `trailDotRadius(fraction) → number`, `edgeOwner(x, y, direction) → {x, y, axis}` where `direction` is one of `'n'|'s'|'e'|'w'` and `axis` is `'h'|'v'`, `edgeJitter(x, y, axis) → number` (-0.5..0.5), `connectorPathD(direction, jitterFraction, size = 100) → string` (an SVG path `d` attribute value), `getTrailColor(tile) → string` (a hex color).

- [ ] **Step 1: Write the failing tests**

Create `tests/trail.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import {
  TRAIL_WEAR_CAP, trailWearFraction, trailStrokeOpacity, trailStrokeWidth, trailDotRadius,
  edgeOwner, edgeJitter, connectorPathD, getTrailColor,
} from '../js/systems/trail.js';

test('trailWearFraction scales linearly from 0 to 1 and clamps at the cap', () => {
  assert.equal(trailWearFraction(0), 0);
  assert.equal(trailWearFraction(5), 0.5);
  assert.equal(trailWearFraction(TRAIL_WEAR_CAP), 1);
  assert.equal(trailWearFraction(TRAIL_WEAR_CAP + 5), 1);
});

test('trailStrokeOpacity and trailStrokeWidth are never zero at fraction 0 (a first connection is faintly visible, not invisible)', () => {
  assert.equal(trailStrokeOpacity(0), 0.25);
  assert.equal(trailStrokeOpacity(1), 0.8);
  assert.equal(trailStrokeWidth(0), 10);
  assert.equal(trailStrokeWidth(1), 18);
});

test('trailDotRadius scales with wear fraction the same way', () => {
  assert.equal(trailDotRadius(0), 6);
  assert.equal(trailDotRadius(1), 12);
});

test('edgeOwner resolves a shared edge to the same lower-coordinate tile from either side', () => {
  assert.deepEqual(edgeOwner(5, 5, 'e'), { x: 5, y: 5, axis: 'h' });
  assert.deepEqual(edgeOwner(6, 5, 'w'), { x: 5, y: 5, axis: 'h' });
  assert.deepEqual(edgeOwner(5, 5, 's'), { x: 5, y: 5, axis: 'v' });
  assert.deepEqual(edgeOwner(5, 6, 'n'), { x: 5, y: 5, axis: 'v' });
});

test('edgeJitter is deterministic for the same inputs', () => {
  assert.equal(edgeJitter(5, 5, 'h'), edgeJitter(5, 5, 'h'));
});

test('edgeJitter uses independent streams for the two axes at the same coordinates', () => {
  assert.notEqual(edgeJitter(5, 5, 'h'), edgeJitter(5, 5, 'v'));
});

test('edgeJitter stays within the expected -0.5..0.5 range', () => {
  for (let x = 0; x < 20; x++) {
    const j = edgeJitter(x, 3, 'h');
    assert.ok(j >= -0.5 && j < 0.5, `jitter ${j} out of range`);
  }
});

test('connectorPathD draws toward east with zero jitter', () => {
  assert.equal(connectorPathD('e', 0, 100), 'M 50 50 Q 75.00 50.00 100 50');
});

test('connectorPathD bows perpendicular to the direction when jitter is nonzero', () => {
  assert.equal(connectorPathD('n', 0.5, 100), 'M 50 50 Q 67.50 25.00 50 0');
  assert.equal(connectorPathD('s', -0.3, 100), 'M 50 50 Q 60.50 75.00 50 100');
  assert.equal(connectorPathD('w', 0.25, 100), 'M 50 50 Q 25.00 41.25 0 50');
});

test('connectorPathD throws for an unknown direction', () => {
  assert.throws(() => connectorPathD('nowhere', 0, 100));
});

test('getTrailColor returns the grass color for grass and falls back to it for an unmapped tile', () => {
  assert.equal(getTrailColor(TILES.grass), '#6b4a2f');
  assert.equal(getTrailColor(TILES.water), '#6b4a2f');
});

test('getTrailColor returns a distinct color for cave floor', () => {
  assert.equal(getTrailColor(TILES.caveFloor), '#7a7a7a');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `js/systems/trail.js` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `js/systems/trail.js`:

```js
import { TILES } from '../tiles.js';
import { hash01 } from './world.js';

// How many distinct visits it takes for a tile's trail to reach full wear -
// see docs/superpowers/specs/2026-08-25-worn-path-trail-design.md.
export const TRAIL_WEAR_CAP = 10;

export function trailWearFraction(visitCount) {
  return Math.min(visitCount, TRAIL_WEAR_CAP) / TRAIL_WEAR_CAP;
}

// A first-time connection is already faintly visible, never fully invisible.
export function trailStrokeOpacity(fraction) {
  return 0.25 + 0.55 * fraction;
}

export function trailStrokeWidth(fraction) {
  return 10 + 8 * fraction;
}

export function trailDotRadius(fraction) {
  return 6 + 6 * fraction;
}

// The edge between two adjacent tiles is always "owned" by whichever tile
// has the lower coordinate on that axis, so both tiles compute the exact
// same (x, y, axis) for their shared border and therefore the same jitter -
// see edgeJitter below. Without this, two tiles independently jittering
// "their own" idea of the same edge would produce a visible seam.
export function edgeOwner(x, y, direction) {
  if (direction === 'e') return { x, y, axis: 'h' };
  if (direction === 'w') return { x: x - 1, y, axis: 'h' };
  if (direction === 's') return { x, y, axis: 'v' };
  if (direction === 'n') return { x, y: y - 1, axis: 'v' };
  throw new Error(`Unknown trail direction: ${direction}`);
}

// Independent salted hash01 stream per axis (same salted-offset convention
// js/screens/mapScreen.js already uses for decoration placement), so a
// tile's north/south edge waviness doesn't move in lockstep with its
// east/west edge waviness.
export function edgeJitter(x, y, axis) {
  const salt = axis === 'h' ? 6000 : 7000;
  return hash01(x + salt, y + salt) - 0.5;
}

// SVG path 'd' for a quadratic curve from a tile's center to the midpoint
// of one edge, bowed perpendicular to that direction by `jitterFraction`
// (-0.5..0.5, from edgeJitter) so it reads as a soft wavy stroke instead of
// a straight line. `size` is the tile's own coordinate-space size (a 0..size
// square) - render() uses a 0..100 SVG viewBox per tile, so callers there
// pass size=100 (the default) and the wear-amount functions above already
// return numbers in that same 0..100-ish scale.
export function connectorPathD(direction, jitterFraction, size = 100) {
  const cx = size / 2, cy = size / 2;
  const targets = { n: [cx, 0], s: [cx, size], w: [0, cy], e: [size, cy] };
  const target = targets[direction];
  if (!target) throw new Error(`Unknown trail direction: ${direction}`);
  const [tx, ty] = target;
  const mx = (cx + tx) / 2, my = (cy + ty) / 2;
  const dx = tx - cx, dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const amp = jitterFraction * size * 0.35;
  const qx = mx + px * amp, qy = my + py * amp;
  return `M ${cx} ${cy} Q ${qx.toFixed(2)} ${qy.toFixed(2)} ${tx} ${ty}`;
}

// Terrain-keyed trail color, not a hardcoded one, so future terrain types
// (sand/swamp/ice - see backlog) are a data addition here, not a rendering
// change. Falls back to the grass color for anything not yet in the map.
const TRAIL_COLOR_BY_TILE = new Map([
  [TILES.grass, '#6b4a2f'],
  [TILES.caveFloor, '#7a7a7a'],
]);
const DEFAULT_TRAIL_COLOR = '#6b4a2f';

export function getTrailColor(tile) {
  return TRAIL_COLOR_BY_TILE.get(tile) || DEFAULT_TRAIL_COLOR;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: full suite PASSES, including all of `tests/trail.test.js`.

- [ ] **Step 5: Commit**

```bash
git add js/systems/trail.js tests/trail.test.js
git commit -m "feat: add pure trail wear/connectivity/color logic module"
```

---

### Task 3: Town landing position — orthogonal adjacency to the gate

**Files:**
- Modify: `js/maps/wilderness/center.js`
- Test: `tests/maps.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `centerMap.startPosition` becomes `{ x: 14, y: 11 }` (was `{ x: 15, y: 11 }`) — later tasks don't depend on this directly, but the trail's entrance-anchor rule (Task 4) only actually connects visually because of this change.

- [ ] **Step 1: Write the failing test**

In `tests/maps.test.js`, find:

```js
test('center screen has the town entrance', () => {
  const centerTileKeys = [...centerMap.rows.join('')].map((c) => centerMap.legend[c]);
  assert.ok(centerTileKeys.includes('townEntrance'));
});
```

and insert immediately after its closing `});`:

```js
test('center screen start position (where exiting town lands you) is orthogonally adjacent to the town entrance, not diagonal', () => {
  let entranceX, entranceY;
  for (let y = 0; y < centerMap.rows.length; y++) {
    const x = centerMap.rows[y].indexOf('@');
    if (x >= 0) { entranceX = x; entranceY = y; }
  }
  const { x: startX, y: startY } = centerMap.startPosition;
  const dx = Math.abs(startX - entranceX);
  const dy = Math.abs(startY - entranceY);
  assert.equal(dx + dy, 1, `startPosition (${startX},${startY}) must be exactly one orthogonal step from the town entrance (${entranceX},${entranceY})`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: this new test FAILS (current `startPosition` `{x:15,y:11}` is diagonal to the entrance `{x:14,y:12}` — Manhattan distance 2, not 1).

- [ ] **Step 3: Implement**

In `js/maps/wilderness/center.js`, change:

```js
  startPosition: { x: 15, y: 11 },
```

to:

```js
  startPosition: { x: 14, y: 11 },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test`
Expected: full suite PASSES, including the new adjacency test.

- [ ] **Step 5: Commit**

```bash
git add js/maps/wilderness/center.js tests/maps.test.js
git commit -m "fix: land players orthogonally adjacent to the town gate, not diagonal"
```

---

### Task 4: Wire the trail into map rendering

**Files:**
- Modify: `js/screens/mapScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `getVisitCount` from `js/systems/exploration.js` (Task 1); `trailWearFraction`, `trailStrokeOpacity`, `trailStrokeWidth`, `trailDotRadius`, `edgeOwner`, `edgeJitter`, `connectorPathD`, `getTrailColor` from `js/systems/trail.js` (Task 2).
- Produces: no new exports — this is the DOM-rendering wiring, verified manually (no jsdom in this repo, per Global Constraints).

This task has no isolated unit test of its own (it's DOM construction glue over the already-fully-tested `trail.js`), so it's implement-then-manually-verify rather than red/green. Run the full test suite after implementing to confirm no regressions, then verify visually in a real browser before committing.

- [ ] **Step 1: Update imports**

In `js/screens/mapScreen.js`, change:

```js
import { markVisited, isVisited } from '../systems/exploration.js';
```

to:

```js
import { markVisited, isVisited, getVisitCount } from '../systems/exploration.js';
```

Add a new import line right after it:

```js
import { trailWearFraction, trailStrokeOpacity, trailStrokeWidth, trailDotRadius, edgeOwner, edgeJitter, connectorPathD, getTrailColor } from '../systems/trail.js';
```

- [ ] **Step 2: Add trail-rendering constants**

In `js/screens/mapScreen.js`, find the end of the `FULL_SQUARE_MARKERS` set definition:

```js
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
]);
```

and insert immediately after its closing `]);`:

```js

const SVG_NS = 'http://www.w3.org/2000/svg';
// Every trail fragment's SVG uses this fixed 0..100 coordinate space
// (independent of the tile's actual rendered pixel size) - trail.js's
// wear/geometry functions already return numbers on roughly this scale.
const TRAIL_VIEWBOX_SIZE = 100;
const TRAIL_DIRECTIONS = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
```

- [ ] **Step 3: Add the passability/connectivity/fragment-building helpers**

In `js/screens/mapScreen.js`, find the end of the `checkGateProximity` function:

```js
    Object.assign(state, { toolGateHintsShown: markGateHintShown(state.toolGateHintsShown, mapConfig.id, nx, ny) });
    const hasTool = hasRequiredTool(neighborTile, state.inventory);
    callbacks.onToolGateNearby(getGateProximityMessage(neighborTile.requiresTool, hasTool));
    return;
  }
}
```

and insert immediately after its closing `}` (before `function render() {`):

```js
function isPassableTile(t) {
  return Boolean(t) && (t.walkable || (t.requiresTool && hasRequiredTool(t, state.inventory)));
}

// A neighbor counts as "connected" for trail purposes if it's ground the
// player has actually walked (currently-passable and visited), OR it's a
// landmark tile (town/dungeon/tool-dungeon entrance, shop, well, ...) -
// every player has necessarily passed through one even though it never
// accumulates its own walk count (stepping onto it triggers a map-switch
// action before it would render as ordinary ground). See the "Entrance/
// landmark tiles" section of the design doc.
function isTrailConnected(nx, ny) {
  if (isOutOfBounds(nx, ny)) return false;
  const t = tileAt(nx, ny);
  if (!t) return false;
  if (FULL_SQUARE_MARKERS.has(t)) return true;
  return isPassableTile(t) && isVisited(state.visited, mapConfig.id, nx, ny);
}

// One tile's own trail fragment: a wavy stroke reaching toward each
// connected neighbor direction, or (if none are connected) a small
// centered dot - see docs/superpowers/specs/2026-08-25-worn-path-trail-
// design.md's "Rendering" and "Wear amount" sections.
function buildTrailFragment(x, y, dirs, fraction, color) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'map-tile-trail');
  svg.setAttribute('viewBox', `0 0 ${TRAIL_VIEWBOX_SIZE} ${TRAIL_VIEWBOX_SIZE}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  if (dirs.length === 0) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', TRAIL_VIEWBOX_SIZE / 2);
    circle.setAttribute('cy', TRAIL_VIEWBOX_SIZE / 2);
    circle.setAttribute('r', trailDotRadius(fraction));
    circle.setAttribute('fill', color);
    circle.setAttribute('opacity', trailStrokeOpacity(fraction));
    svg.appendChild(circle);
    return svg;
  }
  for (const dir of dirs) {
    const owner = edgeOwner(x, y, dir);
    const jitter = edgeJitter(owner.x, owner.y, owner.axis);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', connectorPathD(dir, jitter, TRAIL_VIEWBOX_SIZE));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', trailStrokeWidth(fraction));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', trailStrokeOpacity(fraction));
    svg.appendChild(path);
  }
  return svg;
}
```

- [ ] **Step 4: Wire it into `render()`, remove the old `.visited` class**

In `js/screens/mapScreen.js`'s `render()` function, replace:

```js
      const isCurrentlyPassable = tile.walkable || (tile.requiresTool && hasRequiredTool(tile, state.inventory));
      // Obstacles grow out of the grass, so they keep its green background
      // rather than looking like a hole cut in the field - see
      // RANDOM_SIZE_OBSTACLES above.
      cell.className = 'map-tile'
        + (tile === TILES.grass || RANDOM_SIZE_OBSTACLES.has(tile) ? ' map-tile-grass' : '')
        + (tile === TILES.water ? ' map-tile-water' : '')
        + (isCurrentlyPassable && isVisited(state.visited, mapConfig.id, x, y) ? ' visited' : '')
        + (isPlayer ? ' map-tile-player' : '');
```

with:

```js
      const isCurrentlyPassable = isPassableTile(tile);
      // Obstacles grow out of the grass, so they keep its green background
      // rather than looking like a hole cut in the field - see
      // RANDOM_SIZE_OBSTACLES above.
      cell.className = 'map-tile'
        + (tile === TILES.grass || RANDOM_SIZE_OBSTACLES.has(tile) ? ' map-tile-grass' : '')
        + (tile === TILES.water ? ' map-tile-water' : '')
        + (isPlayer ? ' map-tile-player' : '');
      // A tile's own worn-path trail: dirt strokes reaching toward whichever
      // neighbors are also visited (or a landmark everyone necessarily
      // passes through), or a small dot if nothing connects yet. Appended
      // first so it paints underneath every other branch below, same
      // "append earlier = paints behind" rule the decoration-behind-hero
      // fix uses.
      if (isCurrentlyPassable && isVisited(state.visited, mapConfig.id, x, y)) {
        const fraction = trailWearFraction(getVisitCount(state.visited, mapConfig.id, x, y));
        const color = getTrailColor(tile);
        const dirs = TRAIL_DIRECTIONS
          .filter(([, dx, dy]) => isTrailConnected(x + dx, y + dy))
          .map(([dir]) => dir);
        cell.appendChild(buildTrailFragment(x, y, dirs, fraction, color));
      }
```

- [ ] **Step 5: Update `css/styles.css`**

Delete these 3 rules (currently around line 520-531):

```css
.map-tile.visited {
  background: #5c4a35;
}
/* Higher specificity than .map-tile.visited so visited grass stays green
   (with a slight tint) instead of losing its color entirely. */
.map-tile.map-tile-grass.visited {
  background: #4f5c30;
}
/* Same idea for water (reachable, and visitable, once boat-cleared). */
.map-tile.map-tile-water.visited {
  background: #395a78;
}
```

Add a new rule right after the existing `.map-tile-decoration` block. Find:

```css
.map-tile-decoration {
  position: absolute;
  transform: translate(-50%, -50%);
  line-height: 1;
  pointer-events: none;
}
```

and insert immediately after its closing `}`:

```css

.map-tile-trail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
```

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: full suite PASSES (this task changes no exported function signatures other tests depend on).

- [ ] **Step 7: Manual verification in a real browser**

No jsdom in this repo, so this step is required, not optional (see Global Constraints). Start a static file server from the repo root (e.g. `python3 -m http.server 8934`) and open the game in a browser (Chrome automation tools, if available, work well here — otherwise a real browser window). Using an existing or new save:

1. Walk around on a wilderness screen. Confirm a straight walked stretch, a corner, and a tile you've walked over multiple times all show a connected wavy dirt trail (not blobs, not a flat tinted square) — the trail should visually resemble the approved mockup from the design session.
2. Confirm an unwalked tile shows its fully natural color (no tint at all) — the flat `.visited` background is gone.
3. Exit town and confirm the trail already connects to the town gate on the very first frame you land in the wilderness — no isolated dot next to it.
4. Trigger the isolated worn-dot case: cross an edge transition onto a wilderness screen you haven't visited on this save before (its per-screen `visited` map starts empty) and confirm the landing tile shows a small centered dot, not a connector stroke (since nothing on that screen is visited yet unless the landing tile happens to also be adjacent to a landmark).
5. Re-walk the same tile many times (10+) and confirm the trail visibly darkens/thickens up to a cap, not indefinitely.
6. If any earlier joints/seams between adjacent tiles look visually broken (a hard kink where two tiles' strokes meet rather than a smooth-ish curve), that's an acceptable known simplification per the design doc's "Rendering" section (independent per-tile fragments vs. one shared canvas) — note it, but it isn't a blocker unless it reads badly enough to need a follow-up amplitude/width tweak. If needed, adjust `trailStrokeWidth`'s formula in `js/systems/trail.js` (a wider stroke hides small seam kinks) and re-verify.

- [ ] **Step 8: Commit**

```bash
git add js/screens/mapScreen.js css/styles.css
git commit -m "feat: render a connected worn-path trail instead of a flat visited tint"
```
