# Zone 1 Map Expansion (3x3 -> 5x5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the wilderness from a 3x3 grid (9 screens) to a 5x5 grid (25 screens), relocate the dragon's dungeon entrance into the new outer ring, drop the old `southeast` decoy-hint gimmick, and ship a browser-based terrain-painting tool so the world's terrain can later be hand-drawn as organic, connected shapes.

**Architecture:** 16 new wilderness screen modules ship with placeholder terrain (grass interior, tree border only where there's no neighbor) and correct `neighbors`/`monsterTable`/etc., following the exact same shape/field conventions as the 9 existing screens. The existing 9 screens' outward-facing `neighbors` (previously `null`, the literal edge of the old world) get filled in, with their border terrain opened up to match. `main.js` registers the 16 new maps and drops the now-meaningless decoy-hint branch. `dungeonEntrance.js`'s corner pool moves to the 4 new far corners. A new standalone HTML+JS dev tool (`tools/terrain-painter/`) loads all 25 real screens onto one continuous canvas for hand-painting; actually painting the final organic terrain is a manual step Timothy does afterward, not part of this plan.

**Tech Stack:** Vanilla JS ES modules, `node:test` + `node:assert/strict`, no build step; the painter tool is a static page served the same way as the game (`python3 -m http.server`), using dynamic `import()` and the Canvas 2D API, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-zone1-map-expansion-design.md`

## Global Constraints

- The existing 9 screen ids (`center`, `north`, `south`, `east`, `west`, `northeast`, `northwest`, `southeast`, `southwest`) never change — they're baked into save data, `FLAVOR_TEXT` keys, and (historically) `CORNER_SCREEN_IDS`.
- Every wilderness screen (new and existing) is exactly 22 rows x 30 columns.
- The 16 new screens ship with placeholder terrain only (grass interior, tree border where no neighbor) — no water/mountains/organic shapes in this plan.
- The 16 new screens all use the existing corner tier verbatim: `monsterTable: ['direWolf', 'spider', 'scorpion']`, `encounterChance: 0.15`, `cacheChance: 0.03`, `miniDungeonChance: 0.005`, `startPosition: { x: 15, y: 11 }`.
- No `FLAVOR_TEXT` entries are written for the 16 new screens — Timothy writes this game's narrative himself.
- `CORNER_SCREEN_IDS` (dungeon-entrance eligibility) becomes the 4 new far corners: `farNortheast`, `farNorthwest`, `farSoutheast`, `farSouthwest`.
- `DEFAULT_DUNGEON_ENTRANCE_POSITION` (`state.js`) and the legacy-save backfill stay untouched — still `{ screenId: 'southeast', x: 24, y: 10 }`.
- No save-migration logic is added — the existing `isValidSavedPosition` fallback (resets to a screen's `startPosition` when a saved position becomes invalid) is sufficient.

---

### Task 1: Expand wilderness topology to 5x5

**Files:**
- Create: `js/maps/wilderness/farNorthwest.js`, `js/maps/wilderness/northNorthwest.js`, `js/maps/wilderness/farNorth.js`, `js/maps/wilderness/northNortheast.js`, `js/maps/wilderness/farNortheast.js`, `js/maps/wilderness/westNorthwest.js`, `js/maps/wilderness/farWest.js`, `js/maps/wilderness/westSouthwest.js`, `js/maps/wilderness/eastNortheast.js`, `js/maps/wilderness/farEast.js`, `js/maps/wilderness/eastSoutheast.js`, `js/maps/wilderness/southSouthwest.js`, `js/maps/wilderness/farSouth.js`, `js/maps/wilderness/southSoutheast.js`, `js/maps/wilderness/farSouthwest.js`, `js/maps/wilderness/farSoutheast.js`
- Modify: `js/maps/wilderness/north.js`, `js/maps/wilderness/south.js`, `js/maps/wilderness/east.js`, `js/maps/wilderness/west.js`, `js/maps/wilderness/northeast.js`, `js/maps/wilderness/northwest.js`, `js/maps/wilderness/southeast.js`, `js/maps/wilderness/southwest.js`
- Test: `tests/maps.test.js`

**Interfaces:**
- Produces: 16 new exported map objects, one per new file, named `<screenId>Map` (e.g. `farNorthMap` from `farNorth.js`) — same shape as every existing wilderness map (`id`, `legend`, `rows`, `startPosition`, `encounterChance`, `cacheChance`, `miniDungeonChance`, `monsterTable`, `neighbors`). All 25 screens' `neighbors` now form a fully-connected, symmetric 5x5 grid with no dangling `null` except at the true outer edge.

This task is purely map data + its test coverage — no `main.js` changes yet (that's Task 2), so the game itself isn't playable-through-the-new-screens until Task 2 lands. `tests/maps.test.js` imports map files directly, so this task is fully verifiable on its own.

- [ ] **Step 1: Create the 3 "north wall only" screens**

These sit on the new top row, each bordered by wall only on their north side (their south/east/west neighbors already exist). All three share an identical terrain shape.

Create `js/maps/wilderness/northNorthwest.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '##############################',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '#............................#',
];

export const northNorthwestMap = {
  id: 'northNorthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: null, south: 'northwest', east: 'farNorth', west: 'farNorthwest' },
};
```

Create `js/maps/wilderness/farNorth.js` — identical `ROWS`/`legend`/tier fields, different `id`/`neighbors`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '##############################',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '#............................#',
];

export const farNorthMap = {
  id: 'farNorth',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: null, south: 'north', east: 'northNortheast', west: 'northNorthwest' },
};
```

Create `js/maps/wilderness/northNortheast.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '##############################',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '#............................#',
];

export const northNortheastMap = {
  id: 'northNortheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: null, south: 'northeast', east: 'farNortheast', west: 'farNorth' },
};
```

- [ ] **Step 2: Create the 3 "south wall only" screens**

Same shape, rotated to the bottom row (wall on the last row instead of the first, open elsewhere).

Create `js/maps/wilderness/southSouthwest.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '##############################',
];

export const southSouthwestMap = {
  id: 'southSouthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'southwest', south: null, east: 'farSouth', west: 'farSouthwest' },
};
```

Create `js/maps/wilderness/farSouth.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '##############################',
];

export const farSouthMap = {
  id: 'farSouth',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'south', south: null, east: 'southSoutheast', west: 'southSouthwest' },
};
```

Create `js/maps/wilderness/southSoutheast.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '##############################',
];

export const southSoutheastMap = {
  id: 'southSoutheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'southeast', south: null, east: 'farSoutheast', west: 'farSouth' },
};
```

- [ ] **Step 3: Create the 3 "west wall only" screens**

Wall on the first column only (`#` at `x=0` for rows 1-20), open elsewhere.

Create `js/maps/wilderness/westNorthwest.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#............................#',
];

export const westNorthwestMap = {
  id: 'westNorthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'farNorthwest', south: 'farWest', east: 'northwest', west: null },
};
```

Create `js/maps/wilderness/farWest.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#............................#',
];

export const farWestMap = {
  id: 'farWest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'westNorthwest', south: 'westSouthwest', east: 'west', west: null },
};
```

Create `js/maps/wilderness/westSouthwest.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#............................#',
];

export const westSouthwestMap = {
  id: 'westSouthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'farWest', south: 'farSouthwest', east: 'southwest', west: null },
};
```

- [ ] **Step 4: Create the 3 "east wall only" screens**

Wall on the last column only (`#` at `x=29` for rows 1-20), open elsewhere.

Create `js/maps/wilderness/eastNortheast.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '#............................#',
];

export const eastNortheastMap = {
  id: 'eastNortheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'farNortheast', south: 'farEast', east: null, west: 'northeast' },
};
```

Create `js/maps/wilderness/farEast.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '#............................#',
];

export const farEastMap = {
  id: 'farEast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'eastNortheast', south: 'eastSoutheast', east: null, west: 'east' },
};
```

Create `js/maps/wilderness/eastSoutheast.js`:

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '#............................#',
];

export const eastSoutheastMap = {
  id: 'eastSoutheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'farEast', south: 'farSoutheast', east: null, west: 'southeast' },
};
```

- [ ] **Step 5: Create the 4 true corner screens**

Each of these sits at an actual corner of the new 5x5 world — two walls, not one.

Create `js/maps/wilderness/farNorthwest.js` (north + west walls):

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '##############################',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#............................#',
];

export const farNorthwestMap = {
  id: 'farNorthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: null, south: 'westNorthwest', east: 'northNorthwest', west: null },
};
```

Create `js/maps/wilderness/farNortheast.js` (north + east walls):

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '##############################',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '#............................#',
];

export const farNortheastMap = {
  id: 'farNortheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: null, south: 'eastNortheast', east: null, west: 'northNortheast' },
};
```

Create `js/maps/wilderness/farSouthwest.js` (south + west walls):

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '##############################',
];

export const farSouthwestMap = {
  id: 'farSouthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'westSouthwest', south: null, east: 'southSouthwest', west: null },
};
```

Create `js/maps/wilderness/farSoutheast.js` (south + east walls):

```js
const LEGEND = { '.': 'grass', '#': 'tree' };

const ROWS = [
  '#............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '##############################',
];

export const farSoutheastMap = {
  id: 'farSoutheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'eastSoutheast', south: null, east: null, west: 'southSoutheast' },
};
```

- [ ] **Step 6: Open the existing 9 screens' outward borders and wire their new neighbors**

Each edit below changes exactly one `neighbors` field value and re-opens the matching border (only the interior of that border, i.e. not the four true corner cells — that matches the existing convention of leaving corner cells as `#` even where an adjacent side is open, e.g. today's `northeast.js` south border already does this).

In `js/maps/wilderness/north.js`, change the `neighbors` line:

```js
  neighbors: { north: null, south: 'center', east: 'northeast', west: 'northwest' },
```

to:

```js
  neighbors: { north: 'farNorth', south: 'center', east: 'northeast', west: 'northwest' },
```

and change `ROWS[0]` (currently the full wall row) from:

```js
  '##############################',
```

to:

```js
  '#............................#',
```

In `js/maps/wilderness/south.js`, change the `neighbors` line:

```js
  neighbors: { north: 'center', south: null, east: 'southeast', west: 'southwest' },
```

to:

```js
  neighbors: { north: 'center', south: 'farSouth', east: 'southeast', west: 'southwest' },
```

and change `ROWS[21]` (the last row, currently the full wall row) from:

```js
  '##############################',
```

to:

```js
  '#............................#',
```

In `js/maps/wilderness/east.js`, change the `neighbors` line:

```js
  neighbors: { north: 'northeast', south: 'southeast', east: null, west: 'center' },
```

to:

```js
  neighbors: { north: 'northeast', south: 'southeast', east: 'farEast', west: 'center' },
```

and replace the entire `ROWS` array (every row's last character changes from `#` to `.`, except the first and last rows which stay as they are — this is a full-array replace since the edit touches every row) from:

```js
const ROWS = [
  '.............................#',
  '.............................#',
  '.............................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##.....~~~~~~........#',
  '...MM...##.....~~~~~~........#',
  '...##...##.....~~~~~~........#',
  '...##...##.....~~~~~~........#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '.............................#',
  '.............................#',
  '.............................#',
];
```

to:

```js
const ROWS = [
  '.............................#',
  '..............................',
  '..............................',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '...##...##.....~~~~~~.........',
  '...MM...##.....~~~~~~.........',
  '...##...##.....~~~~~~.........',
  '...##...##.....~~~~~~.........',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '...##...##....................',
  '..............................',
  '..............................',
  '.............................#',
];
```

(Row 0 and row 21 — the two rows whose last character is a true corner — keep their trailing `#` unchanged; every row in between loses its trailing `#`.)

In `js/maps/wilderness/west.js`, change the `neighbors` line:

```js
  neighbors: { north: 'northwest', south: 'southwest', east: 'center', west: null },
```

to:

```js
  neighbors: { north: 'northwest', south: 'southwest', east: 'center', west: 'farWest' },
```

and replace the entire `ROWS` array (every row's first character changes from `#` to `.`, except the first and last rows, which stay as `#.............................` — this is a west-side-only change, so no row loses its trailing content) with:

```js
const ROWS = [
  '#.............................',
  '..............................',
  '..............................',
  '..............~~~~............',
  '....##........~~~~............',
  '....##........~~~~............',
  '....................##........',
  '....................##........',
  '..............................',
  '..........##..................',
  '..........##..................',
  '..............................',
  '..............................',
  '..............................',
  '......................##......',
  '......##..............##......',
  '......##......................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '#.............................',
];
```

In `js/maps/wilderness/northeast.js`, change the `neighbors` line:

```js
  neighbors: { north: null, south: 'east', east: null, west: 'north' },
```

to:

```js
  neighbors: { north: 'northNortheast', south: 'east', east: 'eastNortheast', west: 'north' },
```

and replace the entire `ROWS` array from:

```js
const ROWS = [
  '##############################',
  '.............................#',
  '.............................#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '....########....######.......#',
  '................######.......#',
  '................######.......#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '................######.......#',
  '................######.......#',
  '....########....######.......#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '.............................#',
  '.............................#',
  '.............................#',
];
```

to:

```js
const ROWS = [
  '#............................#',
  '..............................',
  '..............................',
  '....########..................',
  '....########..................',
  '....########..................',
  '....########....######........',
  '................######........',
  '................######........',
  '....########..................',
  '....########..................',
  '....########..................',
  '....########..................',
  '................######........',
  '................######........',
  '....########....######........',
  '....########..................',
  '....########..................',
  '....########..................',
  '..............................',
  '..............................',
  '.............................#',
];
```

In `js/maps/wilderness/northwest.js`, change the `neighbors` line:

```js
  neighbors: { north: null, south: 'west', east: 'north', west: null },
```

to:

```js
  neighbors: { north: 'northNorthwest', south: 'west', east: 'north', west: 'westNorthwest' },
```

and replace the entire `ROWS` array (the north row opens except for its two corners, and every row's first character changes from `#` to `.` except the first and last rows) with:

```js
const ROWS = [
  '#............................#',
  '..............................',
  '..............................',
  '..............##########......',
  '..............M#########......',
  '..............##########......',
  '..............................',
  '..............................',
  '....~~~~~.....................',
  '....~~~~~.....####..####......',
  '....~~~~~.....####..####......',
  '....~~~~~.....####..####......',
  '..............................',
  '..............................',
  '..............................',
  '..............##########......',
  '..............##########......',
  '..............##########......',
  '..............................',
  '..............................',
  '..............................',
  '#.............................',
];
```

In `js/maps/wilderness/southeast.js`, change the `neighbors` line:

```js
  neighbors: { north: 'east', south: null, east: null, west: 'south' },
```

to:

```js
  neighbors: { north: 'east', south: 'southSoutheast', east: 'eastSoutheast', west: 'south' },
```

and replace the entire `ROWS` array from:

```js
const ROWS = [
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~.................#',
  '.............................#',
  '.............................#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~.................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '##############################',
];
```

to:

```js
const ROWS = [
  '.............................#',
  '..............................',
  '..............................',
  '..............................',
  '....~~~~~~~~....####..........',
  '....~~~~~~~~....####..........',
  '....~~~~~~~~....####..........',
  '....~~~~~~~~..................',
  '....~~~~~~~~..................',
  '....~~~~~~~~..................',
  '..............................',
  '..............................',
  '....~~~~~~~~..................',
  '....~~~~~~~~..................',
  '....~~~~~~~~....####..........',
  '....~~~~~~~~....####..........',
  '....~~~~~~~~....####..........',
  '....~~~~~~~~..................',
  '..............................',
  '..............................',
  '..............................',
  '#............................#',
];
```

In `js/maps/wilderness/southwest.js`, change the `neighbors` line:

```js
  neighbors: { north: 'west', south: null, east: 'south', west: null },
```

to:

```js
  neighbors: { north: 'west', south: 'southSouthwest', east: 'south', west: 'westSouthwest' },
```

and replace the entire `ROWS` array from:

```js
const ROWS = [
  '#.............................',
  '#.............................',
  '#.............................',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...X####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#.............................',
  '#.............................',
  '##############################',
];
```

to:

```js
const ROWS = [
  '#.............................',
  '..............................',
  '..............................',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....X####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '....#####...~~~...#####.......',
  '..............................',
  '..............................',
  '#............................#',
];
```

- [ ] **Step 7: Extend `tests/maps.test.js` to cover all 25 screens**

Add the 16 new imports after the existing 9 wilderness imports (after the `southwestMap` import line):

```js
import { farNorthwestMap } from '../js/maps/wilderness/farNorthwest.js';
import { northNorthwestMap } from '../js/maps/wilderness/northNorthwest.js';
import { farNorthMap } from '../js/maps/wilderness/farNorth.js';
import { northNortheastMap } from '../js/maps/wilderness/northNortheast.js';
import { farNortheastMap } from '../js/maps/wilderness/farNortheast.js';
import { westNorthwestMap } from '../js/maps/wilderness/westNorthwest.js';
import { farWestMap } from '../js/maps/wilderness/farWest.js';
import { westSouthwestMap } from '../js/maps/wilderness/westSouthwest.js';
import { eastNortheastMap } from '../js/maps/wilderness/eastNortheast.js';
import { farEastMap } from '../js/maps/wilderness/farEast.js';
import { eastSoutheastMap } from '../js/maps/wilderness/eastSoutheast.js';
import { southSouthwestMap } from '../js/maps/wilderness/southSouthwest.js';
import { farSouthMap } from '../js/maps/wilderness/farSouth.js';
import { southSoutheastMap } from '../js/maps/wilderness/southSoutheast.js';
import { farSouthwestMap } from '../js/maps/wilderness/farSouthwest.js';
import { farSoutheastMap } from '../js/maps/wilderness/farSoutheast.js';
```

Replace the `WILDERNESS` constant:

```js
const WILDERNESS = {
  center: centerMap, north: northMap, south: southMap, east: eastMap, west: westMap,
  northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap,
};
```

with:

```js
const WILDERNESS = {
  center: centerMap, north: northMap, south: southMap, east: eastMap, west: westMap,
  northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap,
  farNorthwest: farNorthwestMap, northNorthwest: northNorthwestMap, farNorth: farNorthMap,
  northNortheast: northNortheastMap, farNortheast: farNortheastMap,
  westNorthwest: westNorthwestMap, farWest: farWestMap, westSouthwest: westSouthwestMap,
  eastNortheast: eastNortheastMap, farEast: farEastMap, eastSoutheast: eastSoutheastMap,
  southSouthwest: southSouthwestMap, farSouth: farSouthMap, southSoutheast: southSoutheastMap,
  farSouthwest: farSouthwestMap, farSoutheast: farSoutheastMap,
};

const ORIGINAL_NINE_SCREEN_IDS = [
  'center', 'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest',
];
```

Replace the FLAVOR_TEXT completeness test:

```js
test('every FLAVOR_TEXT key is a real wilderness screen or an explicitly allowed extra, and every wilderness screen has flavor text', () => {
  const screenIds = Object.keys(WILDERNESS);
  // 'town' is a deliberate addition (a first-visit nudge to buy armor before
  // heading out, added 2026-08-17) - not a wilderness screen, but a real map id.
  const allowedExtraKeys = ['town'];
  for (const key of Object.keys(FLAVOR_TEXT)) {
    assert.ok(
      screenIds.includes(key) || allowedExtraKeys.includes(key),
      `FLAVOR_TEXT key '${key}' does not match a real wilderness screen id or an allowed extra`
    );
  }
  for (const id of screenIds) {
    assert.ok(FLAVOR_TEXT[id], `wilderness screen '${id}' is missing a FLAVOR_TEXT entry`);
  }
});
```

with:

```js
test('every FLAVOR_TEXT key is a real wilderness screen or an explicitly allowed extra', () => {
  const screenIds = Object.keys(WILDERNESS);
  // 'town' is a deliberate addition (a first-visit nudge to buy armor before
  // heading out, added 2026-08-17) - not a wilderness screen, but a real map id.
  const allowedExtraKeys = ['town'];
  for (const key of Object.keys(FLAVOR_TEXT)) {
    assert.ok(
      screenIds.includes(key) || allowedExtraKeys.includes(key),
      `FLAVOR_TEXT key '${key}' does not match a real wilderness screen id or an allowed extra`
    );
  }
});

test('every one of the original 9 wilderness screens has flavor text', () => {
  // The 16 screens added by the 5x5 map expansion (2026-08-23) deliberately ship
  // without flavor text - Timothy writes this game's narrative himself, at his
  // own pace, rather than it being drafted here.
  for (const id of ORIGINAL_NINE_SCREEN_IDS) {
    assert.ok(FLAVOR_TEXT[id], `wilderness screen '${id}' is missing a FLAVOR_TEXT entry`);
  }
});
```

Replace the "new roster monsters" test:

```js
test('new roster monsters are wired into the right monsterTables', () => {
  const nearTownScreens = { east: eastMap, north: northMap, south: southMap, west: westMap };
  for (const [id, map] of Object.entries(nearTownScreens)) {
    assert.ok(map.monsterTable.includes('frog'), `${id} monsterTable should include frog`);
  }
  const farCornerScreens = { northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap };
  for (const [id, map] of Object.entries(farCornerScreens)) {
    assert.ok(map.monsterTable.includes('scorpion'), `${id} monsterTable should include scorpion`);
  }
  assert.ok(dungeonMap.monsterTable.includes('skeleton'), 'dungeon monsterTable should include skeleton');
});
```

with:

```js
test('new roster monsters are wired into the right monsterTables', () => {
  const nearTownScreens = { east: eastMap, north: northMap, south: southMap, west: westMap };
  for (const [id, map] of Object.entries(nearTownScreens)) {
    assert.ok(map.monsterTable.includes('frog'), `${id} monsterTable should include frog`);
  }
  const farCornerScreens = { northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap };
  for (const [id, map] of Object.entries(farCornerScreens)) {
    assert.ok(map.monsterTable.includes('scorpion'), `${id} monsterTable should include scorpion`);
  }
  assert.ok(dungeonMap.monsterTable.includes('skeleton'), 'dungeon monsterTable should include skeleton');
});

test('all 16 outer-ring screens from the 5x5 expansion use the corner monster tier', () => {
  const outerRingIds = [
    'farNorthwest', 'northNorthwest', 'farNorth', 'northNortheast', 'farNortheast',
    'westNorthwest', 'farWest', 'westSouthwest', 'eastNortheast', 'farEast', 'eastSoutheast',
    'southSouthwest', 'farSouth', 'southSoutheast', 'farSouthwest', 'farSoutheast',
  ];
  for (const id of outerRingIds) {
    const map = WILDERNESS[id];
    assert.deepEqual(map.monsterTable, ['direWolf', 'spider', 'scorpion'], `${id} monsterTable should match the corner tier`);
    assert.equal(map.encounterChance, 0.15, `${id} encounterChance should be 0.15`);
  }
});
```

- [ ] **Step 8: Run the full test suite**

Run: `node --test`
Expected: PASS — the extended `WILDERNESS` map now drives "every wilderness screen is well-formed," "is exactly 30x22," "is fully reachable from startPosition," "border is walkable exactly where a neighbor exists," and "neighbor links are symmetric" across all 25 screens automatically, plus the new/updated FLAVOR_TEXT and monster-tier tests.

If any test fails, the most likely causes are: a row that isn't exactly 30 characters (miscount during a border edit), a `neighbors` typo (a screen id that doesn't match any real file), or an asymmetric link (screen A points to B but B doesn't point back to A) — the failure message names the exact screen and side.

- [ ] **Step 9: Commit**

```bash
git add js/maps/wilderness/ tests/maps.test.js
git commit -m "feat: expand wilderness topology from 3x3 to 5x5"
```

---

### Task 2: Wire the new screens into `main.js`

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: the 16 new map exports from Task 1 (`farNorthwestMap`, `northNorthwestMap`, `farNorthMap`, `northNortheastMap`, `farNortheastMap`, `westNorthwestMap`, `farWestMap`, `westSouthwestMap`, `eastNortheastMap`, `farEastMap`, `eastSoutheastMap`, `southSouthwestMap`, `farSouthMap`, `southSoutheastMap`, `farSouthwestMap`, `farSoutheastMap`).
- Produces: `MAPS` (the module-level registry `handleEdgeTransition` looks up neighbors through) now resolves all 25 wilderness screen ids; `handleFirstVisit` no longer has any decoy-hint special case.

`main.js` isn't unit-tested (no test file — same established convention as `mapScreen.js`/`battleScreen.js`), so this task's verification is a manual playthrough at the end.

- [ ] **Step 1: Add the 16 new imports**

In `js/main.js`, after the existing wilderness imports (after the `southwestMap` import, around line 24):

```js
import { farNorthwestMap } from './maps/wilderness/farNorthwest.js';
import { northNorthwestMap } from './maps/wilderness/northNorthwest.js';
import { farNorthMap } from './maps/wilderness/farNorth.js';
import { northNortheastMap } from './maps/wilderness/northNortheast.js';
import { farNortheastMap } from './maps/wilderness/farNortheast.js';
import { westNorthwestMap } from './maps/wilderness/westNorthwest.js';
import { farWestMap } from './maps/wilderness/farWest.js';
import { westSouthwestMap } from './maps/wilderness/westSouthwest.js';
import { eastNortheastMap } from './maps/wilderness/eastNortheast.js';
import { farEastMap } from './maps/wilderness/farEast.js';
import { eastSoutheastMap } from './maps/wilderness/eastSoutheast.js';
import { southSouthwestMap } from './maps/wilderness/southSouthwest.js';
import { farSouthMap } from './maps/wilderness/farSouth.js';
import { southSoutheastMap } from './maps/wilderness/southSoutheast.js';
import { farSouthwestMap } from './maps/wilderness/farSouthwest.js';
import { farSoutheastMap } from './maps/wilderness/farSoutheast.js';
```

- [ ] **Step 2: Register them in `MAPS`**

In `js/main.js`, change the `MAPS` object:

```js
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
  miniDungeonD: miniDungeonVariantD,
  miniDungeonE: miniDungeonVariantE,
};
```

to:

```js
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
  farNorthwest: farNorthwestMap,
  northNorthwest: northNorthwestMap,
  farNorth: farNorthMap,
  northNortheast: northNortheastMap,
  farNortheast: farNortheastMap,
  westNorthwest: westNorthwestMap,
  farWest: farWestMap,
  westSouthwest: westSouthwestMap,
  eastNortheast: eastNortheastMap,
  farEast: farEastMap,
  eastSoutheast: eastSoutheastMap,
  southSouthwest: southSouthwestMap,
  farSouth: farSouthMap,
  southSoutheast: southSoutheastMap,
  farSouthwest: farSouthwestMap,
  farSoutheast: farSoutheastMap,
  miniDungeonA: miniDungeonVariantA,
  miniDungeonB: miniDungeonVariantB,
  miniDungeonC: miniDungeonVariantC,
  miniDungeonD: miniDungeonVariantD,
  miniDungeonE: miniDungeonVariantE,
};
```

- [ ] **Step 3: Remove the decoy-hint branch**

In `js/main.js`, change `handleFirstVisit`:

```js
function handleFirstVisit(screenId) {
  const isFalseDungeonHint =
    screenId === 'southeast' && state.dungeonEntrancePosition.screenId !== 'southeast';
  const text = FLAVOR_TEXT[screenId];
  if (text && !isFalseDungeonHint) {
    showFlavorBanner(text);
  }
  persist();
}
```

to:

```js
function handleFirstVisit(screenId) {
  const text = FLAVOR_TEXT[screenId];
  if (text) {
    showFlavorBanner(text);
  }
  persist();
}
```

- [ ] **Step 4: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS — no test file exercises `main.js` directly, so this confirms nothing elsewhere broke.

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: register the 16 new wilderness screens and drop the southeast decoy hint"
```

- [ ] **Step 6: Manual verification — the new ring is reachable and connected**

Start a local server (`python3 -m http.server 8000` from the repo root) and open `http://localhost:8000` in a browser.

1. Create or load a save, walk to the `north` screen, then keep walking north.
2. Confirm you cross into `farNorth` (plain grass, tree-bordered) rather than being blocked at the old edge.
3. From `farNorth`, walk west and confirm you reach `northNorthwest`, then further west into `farNorthwest` (a true corner — bordered by trees on two sides now, open on the other two).
4. Repeat spot-checks in at least one other direction (e.g. walk east from `east` into `farEast`, then south into `eastSoutheast`) to confirm the grid connects correctly on more than one side.
5. Confirm no flavor-text banner appears on first entering any of the 16 new screens (expected — they have no `FLAVOR_TEXT` entry yet), and that first-visit banners on the original 9 screens still appear as before.
6. Walk to the old `southeast` screen while your save's `dungeonEntrancePosition` points elsewhere, and confirm the "cold draft" decoy banner no longer appears there (it should show southeast's ordinary flavor text, unchanged, with no suppression logic).

---

### Task 3: Relocate dungeon-entrance eligibility to the new far corners

**Files:**
- Modify: `js/systems/dungeonEntrance.js`
- Modify: `js/systems/saveSlots.js`
- Modify: `tests/dungeonEntrance.test.js`
- Test: `tests/dungeonEntrance.test.js`, `tests/saveSlots.test.js`

**Interfaces:**
- Consumes: `farNortheastMap`, `farNorthwestMap`, `farSoutheastMap`, `farSouthwestMap` (Task 1).
- Produces: `CORNER_SCREEN_IDS` now equals `['farNortheast', 'farNorthwest', 'farSoutheast', 'farSouthwest']`; `pickRandomEntrancePosition` and `createSlot()` are otherwise unchanged in behavior (still pick uniformly among whatever 4 ids `CORNER_SCREEN_IDS` names).

- [ ] **Step 1: Update `tests/dungeonEntrance.test.js` to expect the new corner ids**

Replace the whole file:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORNER_SCREEN_IDS, pickRandomEntrancePosition } from '../js/systems/dungeonEntrance.js';
import { farNortheastMap } from '../js/maps/wilderness/farNortheast.js';
import { farNorthwestMap } from '../js/maps/wilderness/farNorthwest.js';
import { farSoutheastMap } from '../js/maps/wilderness/farSoutheast.js';
import { farSouthwestMap } from '../js/maps/wilderness/farSouthwest.js';

const realCornerMaps = { farNortheast: farNortheastMap, farNorthwest: farNorthwestMap, farSoutheast: farSoutheastMap, farSouthwest: farSouthwestMap };

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('CORNER_SCREEN_IDS lists exactly the 4 new far-corner screens', () => {
  assert.deepEqual(CORNER_SCREEN_IDS, ['farNortheast', 'farNorthwest', 'farSoutheast', 'farSouthwest']);
});

test('pickRandomEntrancePosition can select each of the 4 corner ids', () => {
  const fixtureMap = { rows: ['..', '..'], legend: { '.': 'grass' } };
  const cornerMaps = { farNortheast: fixtureMap, farNorthwest: fixtureMap, farSoutheast: fixtureMap, farSouthwest: fixtureMap };
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
Expected: FAIL — `CORNER_SCREEN_IDS` in `js/systems/dungeonEntrance.js` still lists the old 4 corners.

- [ ] **Step 3: Update `CORNER_SCREEN_IDS`**

In `js/systems/dungeonEntrance.js`, change:

```js
export const CORNER_SCREEN_IDS = ['northeast', 'northwest', 'southeast', 'southwest'];
```

to:

```js
export const CORNER_SCREEN_IDS = ['farNortheast', 'farNorthwest', 'farSoutheast', 'farSouthwest'];
```

- [ ] **Step 4: Update `saveSlots.js`'s corner-map wiring**

In `js/systems/saveSlots.js`, change:

```js
import { northeastMap } from '../maps/wilderness/northeast.js';
import { northwestMap } from '../maps/wilderness/northwest.js';
import { southeastMap } from '../maps/wilderness/southeast.js';
import { southwestMap } from '../maps/wilderness/southwest.js';

const CORNER_MAPS = { northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap };
```

to:

```js
import { farNortheastMap } from '../maps/wilderness/farNortheast.js';
import { farNorthwestMap } from '../maps/wilderness/farNorthwest.js';
import { farSoutheastMap } from '../maps/wilderness/farSoutheast.js';
import { farSouthwestMap } from '../maps/wilderness/farSouthwest.js';

const CORNER_MAPS = { farNortheast: farNortheastMap, farNorthwest: farNorthwestMap, farSoutheast: farSoutheastMap, farSouthwest: farSouthwestMap };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/dungeonEntrance.test.js tests/saveSlots.test.js`
Expected: PASS. `tests/saveSlots.test.js` needs no edits — it only imports `CORNER_SCREEN_IDS` and checks membership, so it automatically picks up the new values.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/systems/dungeonEntrance.js js/systems/saveSlots.js tests/dungeonEntrance.test.js
git commit -m "feat: relocate dungeon entrance eligibility to the 4 new far corners"
```

- [ ] **Step 8: Manual verification**

With the local server still running:

1. Create 3-4 new characters in a row, and for each, read `dungeonEntrancePosition` from that save's localStorage entry (DevTools → Application → Local Storage).
2. Confirm `screenId` is always one of `farNortheast`, `farNorthwest`, `farSoutheast`, `farSouthwest` — never one of the old 4 corners.
3. For one of them, navigate to the named screen and coordinate, and confirm the 🕳️ dungeon-entrance emoji renders there, is walkable, and triggers dungeon entry.
4. Load an existing save that predates this change (or strip `dungeonEntrancePosition` from a save's JSON and reload) and confirm it still backfills to the historical `southeast (24, 10)` spot, unaffected by this task.

---

### Task 4: Terrain painting tool

**Files:**
- Create: `tools/terrain-painter/index.html`
- Create: `tools/terrain-painter/painter.js`

**Interfaces:**
- Consumes: all 25 real map modules via dynamic `import()` at runtime (not a build-time dependency) — relies on every wilderness file following the established `<id>.js` exports `<id>Map` naming convention (true for all 9 existing screens and all 16 screens created in Task 1).
- Produces: a browser page, served the same way as the game itself, with no code interface other files depend on — this is a standalone dev tool.

This tool has no automated test (it's a manual-use dev page, same category as `mapScreen.js`) — verification is entirely manual, at the end of this task.

- [ ] **Step 1: Create the page**

Create `tools/terrain-painter/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Terrain Painter</title>
<style>
  body { background: #111; color: #eee; font-family: monospace; margin: 0; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { font-size: 12px; color: #aaa; max-width: 900px; }
  #palette { margin-top: 12px; }
  #palette button {
    margin-right: 4px; margin-bottom: 4px; padding: 6px 10px;
    background: #222; color: #eee; border: 2px solid #444; cursor: pointer; font-family: monospace;
  }
  #palette button.active { border-color: #fff; }
  canvas { border: 1px solid #444; cursor: crosshair; display: block; margin-top: 12px; }
  #exportRow { margin-top: 12px; display: flex; align-items: center; gap: 8px; }
  #exportOutput {
    width: 100%; max-width: 900px; height: 140px; margin-top: 8px;
    background: #000; color: #0f0; font-family: monospace; font-size: 12px;
  }
</style>
</head>
<body>
<h1>Wilderness Terrain Painter</h1>
<p>
  Loads all 25 wilderness screens onto one continuous canvas, laid out exactly
  like the real 5x5 world, so terrain painted across a screen boundary is
  connected by construction. Pick a brush, click or click-drag to paint.
  Export copies one screen's <code>LEGEND</code>/<code>ROWS</code> to the
  clipboard, ready to paste over that screen's existing declaration in its
  file under <code>js/maps/wilderness/</code>.
</p>
<div id="palette">
  <button data-kind="grass">Grass</button>
  <button data-kind="tree">Tree</button>
  <button data-kind="water">Water</button>
  <button data-kind="mountain">Mountain</button>
  <button data-kind="mountainCache">Mountain Cache</button>
  <button data-kind="thicket">Thicket</button>
  <button data-kind="thicketCache">Thicket Cache</button>
</div>
<canvas id="worldCanvas" width="1200" height="880"></canvas>
<div id="exportRow">
  <label for="exportSelect">Export screen:</label>
  <select id="exportSelect"></select>
  <button id="exportBtn">Copy LEGEND/ROWS</button>
  <span id="exportStatus"></span>
</div>
<textarea id="exportOutput" readonly placeholder="Copied output also appears here, in case clipboard access is blocked."></textarea>
<script type="module" src="painter.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the tool logic**

Create `tools/terrain-painter/painter.js`:

```js
const SCREEN_W = 30;
const SCREEN_H = 22;
const CELL = 8;

const GRID_LAYOUT = {
  farNorthwest: { col: 0, row: 0 }, northNorthwest: { col: 1, row: 0 }, farNorth: { col: 2, row: 0 },
  northNortheast: { col: 3, row: 0 }, farNortheast: { col: 4, row: 0 },
  westNorthwest: { col: 0, row: 1 }, northwest: { col: 1, row: 1 }, north: { col: 2, row: 1 },
  northeast: { col: 3, row: 1 }, eastNortheast: { col: 4, row: 1 },
  farWest: { col: 0, row: 2 }, west: { col: 1, row: 2 }, center: { col: 2, row: 2 },
  east: { col: 3, row: 2 }, farEast: { col: 4, row: 2 },
  westSouthwest: { col: 0, row: 3 }, southwest: { col: 1, row: 3 }, south: { col: 2, row: 3 },
  southeast: { col: 3, row: 3 }, eastSoutheast: { col: 4, row: 3 },
  farSouthwest: { col: 0, row: 4 }, southSouthwest: { col: 1, row: 4 }, farSouth: { col: 2, row: 4 },
  southSoutheast: { col: 3, row: 4 }, farSoutheast: { col: 4, row: 4 },
};

const WORLD_W = SCREEN_W * 5;
const WORLD_H = SCREEN_H * 5;

const TILE_COLORS = {
  grass: '#4a7c3f',
  tree: '#1f4d1f',
  water: '#2b6cb0',
  mountain: '#8a8a8a',
  mountainCache: '#c9a227',
  thicket: '#2f5d34',
  thicketCache: '#c9a227',
  townEntrance: '#d9534f',
};

const CHAR_FOR_KIND = {
  grass: '.', tree: '#', water: '~', mountain: 'M', mountainCache: 'K',
  thicket: 'T', thicketCache: 'X', townEntrance: '@',
};

const PAINTABLE_KINDS = new Set(['grass', 'tree', 'water', 'mountain', 'mountainCache', 'thicket', 'thicketCache']);

let grid = [];
let activeBrush = 'grass';
let painting = false;

async function loadAllScreens() {
  const newGrid = Array.from({ length: WORLD_H }, () => new Array(WORLD_W).fill('grass'));
  for (const [id, pos] of Object.entries(GRID_LAYOUT)) {
    const mod = await import(`../../js/maps/wilderness/${id}.js`);
    const map = mod[`${id}Map`];
    const originX = pos.col * SCREEN_W;
    const originY = pos.row * SCREEN_H;
    for (let y = 0; y < SCREEN_H; y++) {
      const row = map.rows[y];
      for (let x = 0; x < SCREEN_W; x++) {
        const kind = map.legend[row[x]];
        newGrid[originY + y][originX + x] = kind;
      }
    }
  }
  return newGrid;
}

function render(ctx) {
  ctx.clearRect(0, 0, WORLD_W * CELL, WORLD_H * CELL);
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      ctx.fillStyle = TILE_COLORS[grid[y][x]] || '#000';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= 5; c++) {
    ctx.beginPath();
    ctx.moveTo(c * SCREEN_W * CELL, 0);
    ctx.lineTo(c * SCREEN_W * CELL, WORLD_H * CELL);
    ctx.stroke();
  }
  for (let r = 0; r <= 5; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * SCREEN_H * CELL);
    ctx.lineTo(WORLD_W * CELL, r * SCREEN_H * CELL);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '10px monospace';
  for (const [id, pos] of Object.entries(GRID_LAYOUT)) {
    ctx.fillText(id, pos.col * SCREEN_W * CELL + 2, pos.row * SCREEN_H * CELL + 10);
  }
}

function paintAt(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
  if (grid[y][x] === 'townEntrance') return;
  grid[y][x] = activeBrush;
}

function exportScreen(id) {
  const pos = GRID_LAYOUT[id];
  const originX = pos.col * SCREEN_W;
  const originY = pos.row * SCREEN_H;
  const usedKinds = new Set();
  const rows = [];
  for (let y = 0; y < SCREEN_H; y++) {
    let row = '';
    for (let x = 0; x < SCREEN_W; x++) {
      const kind = grid[originY + y][originX + x];
      usedKinds.add(kind);
      row += CHAR_FOR_KIND[kind];
    }
    rows.push(row);
  }
  const legendEntries = [...usedKinds].map((kind) => `'${CHAR_FOR_KIND[kind]}': '${kind}'`).join(', ');
  const rowsEntries = rows.map((r) => `  '${r}',`).join('\n');
  return `const LEGEND = { ${legendEntries} };\n\nconst ROWS = [\n${rowsEntries}\n];`;
}

async function init() {
  const canvas = document.getElementById('worldCanvas');
  const ctx = canvas.getContext('2d');

  grid = await loadAllScreens();
  render(ctx);

  document.querySelectorAll('#palette button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeBrush = btn.dataset.kind;
      document.querySelectorAll('#palette button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelector('#palette button[data-kind="grass"]').classList.add('active');

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / CELL),
      y: Math.floor((e.clientY - rect.top) / CELL),
    };
  }

  canvas.addEventListener('mousedown', (e) => {
    painting = true;
    const { x, y } = cellFromEvent(e);
    paintAt(x, y);
    render(ctx);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!painting || !PAINTABLE_KINDS.has(activeBrush)) return;
    const { x, y } = cellFromEvent(e);
    paintAt(x, y);
    render(ctx);
  });
  window.addEventListener('mouseup', () => {
    painting = false;
  });

  const exportSelect = document.getElementById('exportSelect');
  for (const id of Object.keys(GRID_LAYOUT)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    exportSelect.appendChild(opt);
  }

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const text = exportScreen(exportSelect.value);
    document.getElementById('exportOutput').value = text;
    const status = document.getElementById('exportStatus');
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied to clipboard.';
    } catch (err) {
      status.textContent = 'Clipboard blocked — copy from the text box below.';
    }
  });
}

init();
```

- [ ] **Step 3: Manual verification**

With the local server still running (`python3 -m http.server 8000` from the repo root):

1. Open `http://localhost:8000/tools/terrain-painter/index.html`.
2. Confirm the canvas renders all 25 screens in their correct grid positions, with the 9 existing screens showing their real terrain (e.g. the lake in `north`, the pillar maze in `east`, the two lakes in `southwest`) and the 16 new screens showing plain grass with tree borders on their outer sides.
3. Select the Water brush, then click-drag a short stroke that crosses from `north`'s existing lake northward into `farNorth`'s placeholder grass — confirm it paints continuously across that screen boundary with no visible seam or gap.
4. Select `farNorth` in the export dropdown, click "Copy LEGEND/ROWS," and confirm the text box below shows a `LEGEND`/`ROWS` block whose `ROWS` array has exactly 22 entries, each 30 characters long, and includes a `~` character from the test water stroke.
5. Temporarily paste that exported block over `farNorth.js`'s existing `LEGEND`/`ROWS` declaration, run `node --test`, and confirm the suite still passes (this validates the exported format is genuinely usable, not just visually plausible).
6. Revert that temporary paste (`git checkout -- js/maps/wilderness/farNorth.js`) — actually painting the real terrain is a manual step Timothy does later, not part of this task, so no painted terrain should be committed here.

- [ ] **Step 4: Commit**

```bash
git add tools/terrain-painter/
git commit -m "feat: add browser-based terrain painting tool for the 5x5 wilderness"
```

---

## Self-Review Notes

- **Spec coverage:** Spec's "16 new wilderness screen modules... shipped with placeholder terrain" and "correct neighbors/monsterTable/..." → Task 1. "Reworking dungeonEntrance.js's CORNER_SCREEN_IDS... and saveSlots.js's corner-map wiring" → Task 3. "Removing the southeast-specific decoy-hint branch" → Task 2 Step 3. "New browser-based terrain painting tool" → Task 4. "Test coverage: neighbor-grid symmetry... dungeon entrance eligibility... placeholder screens passing the existing map-validity checks" → Task 1 Step 7-8 and Task 3 Steps 1-6.
- **Placeholder scan:** No TBD/TODO markers. Every map file is given complete, literal content; the painter tool is complete, runnable code, not a sketch.
- **Type consistency:** The `{ screenId, x, y }` shape for `dungeonEntrancePosition` is untouched throughout (Task 3 only changes which 4 ids are eligible, not the shape). `neighbors: { north, south, east, west }` shape is identical across all 25 screens in Task 1. The painter tool's `<id>Map` export-naming assumption (Task 4) is verified against the actual convention used by every file created in Task 1 and every pre-existing file.
- **Ordering:** Task 1 must land first — Tasks 2, 3, and 4 all import files it creates. Task 2 (main.js registration) is independent of Task 3 (dungeon relocation) but both depend only on Task 1, so either order would work; placed main.js wiring first since it's what makes the new screens reachable/playable at all, before narrowing what's *inside* one specific corner of them. Task 4 depends only on Task 1 (it imports real map files directly, not through `main.js` or `dungeonEntrance.js`), so it could technically run any time after Task 1, but is placed last since it's the least urgent piece (a tool for a future manual step, not runtime behavior).
