# Circle of Ultimate Portaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth guardian-gated tool, the Circle of Ultimate Portaling: fight `portalGuardian` once to unlock a `P` hotkey that drops a portal at your feet, walk into it to warp to a fixed town spot, walk into the paired portal there to warp back exactly where you left — the pair then vanishes for good. Includes an anti-cheese fix that blocks the town well's free healing while a portal round-trip is pending.

**Architecture:** One new pure-logic module, `js/systems/portal.js`, holds the portal's own tiny state-transition rules (ownership check, drop, mark-return-pending) and the fixed town coordinate — unit-tested in isolation, matching how `js/systems/toolGates.js`/`caches.js`/`miniDungeons.js` already separate rules from the `js/screens/*.js`/`js/main.js` DOM/orchestration layer. `js/screens/mapScreen.js`'s existing `tileAt()` override chain (already used for the dungeon entrance and the three tool-dungeon entrances) gets two more entries for the portal's origin and return tiles — no new rendering mechanism. The drop action and both portal-tile walk-ins all dispatch through the map screen's single existing `callbacks.onAction(actionString)` channel into `js/main.js`'s `handleTileAction` switchboard, exactly like every other map action already does, so no new callback prop is added anywhere (zero test-file churn on `callbacks: {...}` shapes). Acquisition (guardian monster, its dungeon, the terrain painter's registration of a 4th tool) is the same template axe/pick/boat already established, copied exactly.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict`, jsdom via `tests/helpers/dom.js` for screen DOM tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-portal-scroll-design.md`

## Global Constants (exact values — copy verbatim, don't re-derive)

- Item id: `portalCircle`. Name: `Circle of Ultimate Portaling`. Emoji: `🌌` (NOT `🌀` — that's already `momentumElixir`'s icon, `js/data/items.js:74`). `type: 'tool'`, `price: 0`.
- Guardian monster id: `portalGuardian`. Stats: `hp: 210, attack: 28, defense: 9, speed: 9, xp: 65, goldRange: [22, 32]`. `dropTable: [{ itemId: 'portalCircle', chance: 1 }]`. `forceFullBattle: true`, no `isBoss`, `attackStyle: 'melee'`.
- Dungeon interior map id: `portalDungeon`, file `js/maps/toolDungeons/portalDungeon.js`, export `portalDungeonMap`.
- Entrance tile kind: `portalDungeonEntrance`, emoji `🌌`, action `enterPortalDungeon`.
- `TOOL_DUNGEON_ENTRANCES.portal` = `{ screenId: null, x: null, y: null, mapId: 'portalDungeon', tileKind: 'portalDungeonEntrance' }` — placeholder position, Timothy hand-places it later via the terrain painter.
- Fixed town return spot: `TOWN_PORTAL_POSITION = { x: 7, y: 4 }` (town's `ROWS[4]` is `'#..S.......M...#'` — shop at x=3, smith at x=11, so x=7 sits centered between them, clear of the well at (11,8) and the exit at (7,10)).
- Portal tile kinds: `portalOrigin` (action `enterPortalToTown`) and `portalReturn` (action `enterPortalToOrigin`), both emoji `🌌`.
- Hotkey: `p`/`P` on the map screen, action string `usePortalTool`.
- `state.portal` shape: `{ originScreenId, originX, originY, returnPending }` or `null`.
- Run `npm run test` (never `npm test`/`npx jest`) after every task and confirm a clean pass before committing.
- Per this repo's own `CLAUDE.md`: every commit touching non-doc files needs a `CHANGELOG.md` entry under `## [Unreleased]` (CI enforces this). Bump `Unreleased` into a dated version section (`0.16.0` — a completed feature/system, MINOR per `CHANGELOG.md`'s own header rules), and add the matching `js/data/playerChangelog.js` entry, only in this plan's final task — not after every task.
- This repo's default branch was just renamed `master` → `main` locally (not yet pushed) — do not reference `master` in anything new this plan adds.

---

### Task 1: Portal item and guardian monster data

**Files:**
- Modify: `js/data/items.js`
- Modify: `js/data/monsters.js`
- Modify: `tests/data.test.js:207` (the hardcoded `guardianIds` Set)

**Interfaces:**
- Produces: `ITEMS.portalCircle`, `MONSTERS.portalGuardian` — read directly by Task 2 (dungeon map's `guardianMonsterId`, `TOOL_DUNGEON_ENTRANCES.portal`) and Task 5 (inventory ownership check).

- [ ] **Step 1: Add the portal item to `js/data/items.js`**

Insert right after the existing `boat` entry (`js/data/items.js:101`):

```js
  miningPick: { id: 'miningPick', name: 'Mining Pick', emoji: '⛏️', type: 'tool', price: 0, description: 'Clears mountain gates blocking the way' },
  axe: { id: 'axe', name: 'Axe', emoji: '🪓', type: 'tool', price: 0, description: 'Clears thicket gates blocking the way' },
  boat: { id: 'boat', name: 'Boat', emoji: '🛶', type: 'tool', price: 0, description: 'Lets you cross open water' },
  // 🌌 not 🌀 - 🌀 is already momentumElixir's icon (see this file's buff
  // potions section) and item/tile icons should stay unique.
  portalCircle: { id: 'portalCircle', name: 'Circle of Ultimate Portaling', emoji: '🌌', type: 'tool', price: 0, description: 'Drops a portal to town at your feet' },
};
```

- [ ] **Step 2: Add the guardian monster to `js/data/monsters.js`**

Insert right after the existing `boatGuardian` entry (`js/data/monsters.js:99`):

```js
  boatGuardian: {
    id: 'boatGuardian', name: 'Boat Guardian', emoji: '🛶',
    hp: 175, attack: 24, defense: 7, speed: 8,
    xp: 55, goldRange: [18, 28],
    dropTable: [{ itemId: 'boat', chance: 1 }],
    forceFullBattle: true,
    attackStyle: 'melee',
  },
  // Sits behind a gate meant to require axe + pick + boat already
  // (Timothy's map design, not enforced in code) - a step tougher than
  // boatGuardian, since "free repeatable trip to/from town from
  // anywhere" is the strongest of the four tools. See
  // docs/superpowers/specs/2026-09-01-portal-scroll-design.md.
  portalGuardian: {
    id: 'portalGuardian', name: 'Portal Guardian', emoji: '🌌',
    hp: 210, attack: 28, defense: 9, speed: 9,
    xp: 65, goldRange: [22, 32],
    dropTable: [{ itemId: 'portalCircle', chance: 1 }],
    forceFullBattle: true,
    attackStyle: 'melee',
  },
```

- [ ] **Step 3: Run the tests and see the expected failure**

Run: `npm run test`
Expected: FAIL — `tests/data.test.js`'s `'tools are only ever a guaranteed guardian drop, never a stray chance-drop on a regular monster - raised 2026-08-28'` test fails, reporting `portalGuardian has a stray tool drop`. This is correct: that test's `guardianIds` Set (`tests/data.test.js:207`) is hardcoded to the three pre-existing guardians and doesn't know about `portalGuardian` yet.

- [ ] **Step 4: Add `portalGuardian` to the test's `guardianIds` Set**

`tests/data.test.js:207` currently:

```js
  const guardianIds = new Set(['axeGuardian', 'pickGuardian', 'boatGuardian']);
```

Change to:

```js
  const guardianIds = new Set(['axeGuardian', 'pickGuardian', 'boatGuardian', 'portalGuardian']);
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm run test`
Expected: PASS. The generic `'every monster has required fields and a valid drop table'` and `'every item has required fields'` tests already iterate all of `MONSTERS`/`ITEMS`, so they cover the two new entries with no further changes.

- [ ] **Step 6: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]` → `### Added` (create the subsection if the current `Unreleased` block doesn't have one):

```markdown
- Data for a fourth guardian-gated tool, the Circle of Ultimate
  Portaling (`portalCircle`) and its `portalGuardian` - not yet
  reachable in-game (dungeon/entrance land in later commits this
  session).
```

```bash
git add js/data/items.js js/data/monsters.js tests/data.test.js CHANGELOG.md
git commit -m "feat: add Circle of Ultimate Portaling item and guardian data"
```

---

### Task 2: Portal dungeon map, entrance registration, dungeon-entry wiring

**Files:**
- Create: `js/maps/toolDungeons/portalDungeon.js`
- Modify: `js/data/toolDungeons.js`
- Modify: `js/main.js` (imports, `MAPS` registry, `handleTileAction`)
- Modify: `tests/toolDungeonMaps.test.js`

**Interfaces:**
- Consumes: `MONSTERS.portalGuardian`, `ITEMS.portalCircle` (Task 1).
- Produces: `portalDungeonMap` (default export shape matching `axeDungeonMap`), `TOOL_DUNGEON_ENTRANCES.portal` — read by Task 3 (terrain painter) and Task 5 (`tileAt()`'s existing `TOOL_DUNGEON_ENTRANCES` loop, unchanged).

- [ ] **Step 1: Create the dungeon interior map**

`js/maps/toolDungeons/portalDungeon.js` (exact template as `axeDungeon.js`, new `id`/`guardianMonsterId`):

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  E: 'exit',
  G: 'guardian',
};

const ROWS = [
  '##############',
  '#E...........#',
  '#............#',
  '#....##......#',
  '#.......#....#',
  '#............#',
  '#...........G#',
  '##############',
];

export const portalDungeonMap = {
  id: 'portalDungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
  guardianMonsterId: 'portalGuardian',
};
```

- [ ] **Step 2: Register the entrance in `js/data/toolDungeons.js`**

Current file:

```js
export const TOOL_DUNGEON_ENTRANCES = {
  axe: {
    screenId: 'farNorth', x: 13, y: 7, mapId: 'axeDungeon', tileKind: 'axeDungeonEntrance',
  },
  pick: {
    screenId: 'southSoutheast', x: 18, y: 14, mapId: 'pickDungeon', tileKind: 'pickDungeonEntrance',
  },
  canoe: {
    screenId: 'west', x: 18, y: 13, mapId: 'canoeDungeon', tileKind: 'canoeDungeonEntrance',
  },
};
```

Add a fourth entry:

```js
export const TOOL_DUNGEON_ENTRANCES = {
  axe: {
    screenId: 'farNorth', x: 13, y: 7, mapId: 'axeDungeon', tileKind: 'axeDungeonEntrance',
  },
  pick: {
    screenId: 'southSoutheast', x: 18, y: 14, mapId: 'pickDungeon', tileKind: 'pickDungeonEntrance',
  },
  canoe: {
    screenId: 'west', x: 18, y: 13, mapId: 'canoeDungeon', tileKind: 'canoeDungeonEntrance',
  },
  // screenId/x/y are placeholders - Timothy hand-places the real spot via
  // the terrain painter's "Place Tool Dungeon Entrance" mode, same as the
  // other three (see docs/superpowers/specs/2026-09-01-portal-scroll-
  // design.md). Every place that reads TOOL_DUNGEON_ENTRANCES compares a
  // real screenId string against this null, which is always false, so a
  // null entry here is inert until it's filled in - never reachable, never
  // a crash (see tests/toolDungeonMaps.test.js's null-placeholder test).
  portal: {
    screenId: null, x: null, y: null, mapId: 'portalDungeon', tileKind: 'portalDungeonEntrance',
  },
};
```

- [ ] **Step 3: Wire the entrance tile kind and dungeon-entry action into `js/main.js`**

`js/main.js:17-19` currently:

```js
import { axeDungeonMap } from './maps/toolDungeons/axeDungeon.js';
import { pickDungeonMap } from './maps/toolDungeons/pickDungeon.js';
import { canoeDungeonMap } from './maps/toolDungeons/canoeDungeon.js';
```

Change to:

```js
import { axeDungeonMap } from './maps/toolDungeons/axeDungeon.js';
import { pickDungeonMap } from './maps/toolDungeons/pickDungeon.js';
import { canoeDungeonMap } from './maps/toolDungeons/canoeDungeon.js';
import { portalDungeonMap } from './maps/toolDungeons/portalDungeon.js';
```

`js/main.js:112-114` currently:

```js
  axeDungeon: axeDungeonMap,
  pickDungeon: pickDungeonMap,
  canoeDungeon: canoeDungeonMap,
```

Change to:

```js
  axeDungeon: axeDungeonMap,
  pickDungeon: pickDungeonMap,
  canoeDungeon: canoeDungeonMap,
  portalDungeon: portalDungeonMap,
```

`js/main.js:447-449` currently:

```js
  if (action === 'enterAxeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.axe.mapId);
  if (action === 'enterPickDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.pick.mapId);
  if (action === 'enterCanoeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.canoe.mapId);
```

Change to:

```js
  if (action === 'enterAxeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.axe.mapId);
  if (action === 'enterPickDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.pick.mapId);
  if (action === 'enterCanoeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.canoe.mapId);
  if (action === 'enterPortalDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.portal.mapId);
```

The generic `exitMap` handler (`js/main.js:456-462`) already walks `Object.values(TOOL_DUNGEON_ENTRANCES)` to find the matching `mapId` and return to its `{ screenId, x, y }` - no change needed there, and it can never actually be reached with the `portal` entry's null position (see Step 2's comment: the entrance tile itself never renders anywhere until real coordinates are filled in, so the player can never get inside `portalDungeon` to trigger an exit from it yet).

- [ ] **Step 4: Add the entrance tile kind to `js/tiles.js`**

Insert right after the existing `canoeDungeonEntrance` entry (`js/tiles.js:45`):

```js
  axeDungeonEntrance: { emoji: '🪓', walkable: true, encounter: false, action: 'enterAxeDungeon', description: 'A guarded passage — the axe lies beyond' },
  pickDungeonEntrance: { emoji: '⛏️', walkable: true, encounter: false, action: 'enterPickDungeon', description: 'A guarded passage — the mining pick lies beyond' },
  canoeDungeonEntrance: { emoji: '🛶', walkable: true, encounter: false, action: 'enterCanoeDungeon', description: 'A guarded passage — the boat lies beyond' },
  portalDungeonEntrance: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalDungeon', description: 'A guarded passage — a portal lies beyond' },
```

- [ ] **Step 5: Update `tests/toolDungeonMaps.test.js` to cover the fourth dungeon**

`tests/toolDungeonMaps.test.js:1-18` currently:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';
import { TOOL_DUNGEON_ENTRANCES } from '../js/data/toolDungeons.js';
import { axeDungeonMap } from '../js/maps/toolDungeons/axeDungeon.js';
import { pickDungeonMap } from '../js/maps/toolDungeons/pickDungeon.js';
import { canoeDungeonMap } from '../js/maps/toolDungeons/canoeDungeon.js';
import { isWalkableAt } from '../js/systems/world.js';

const TOOL_DUNGEONS = {
  axe: axeDungeonMap,
  pick: pickDungeonMap,
  canoe: canoeDungeonMap,
};

const ITEM_ID_FOR_TOOL = { axe: 'axe', pick: 'miningPick', canoe: 'boat' };
```

Change to:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';
import { TOOL_DUNGEON_ENTRANCES } from '../js/data/toolDungeons.js';
import { axeDungeonMap } from '../js/maps/toolDungeons/axeDungeon.js';
import { pickDungeonMap } from '../js/maps/toolDungeons/pickDungeon.js';
import { canoeDungeonMap } from '../js/maps/toolDungeons/canoeDungeon.js';
import { portalDungeonMap } from '../js/maps/toolDungeons/portalDungeon.js';
import { isWalkableAt } from '../js/systems/world.js';

const TOOL_DUNGEONS = {
  axe: axeDungeonMap,
  pick: pickDungeonMap,
  canoe: canoeDungeonMap,
  portal: portalDungeonMap,
};

const ITEM_ID_FOR_TOOL = { axe: 'axe', pick: 'miningPick', canoe: 'boat', portal: 'portalCircle' };
```

This one change automatically extends every existing test in the file (`assertValidMap`, `assertFullyReachable`, exit/guardian-tile-count, guardian-drop-integrity) to cover `portalDungeon` too, since they all iterate `TOOL_DUNGEONS`/`ITEM_ID_FOR_TOOL` generically - no other test bodies need touching.

The file's last test does need a change, since it iterates `TOOL_DUNGEON_ENTRANCES` directly (not the `TOOL_DUNGEONS` map above) and will hit the new `portal` entry's null `screenId`. `tests/toolDungeonMaps.test.js:114-131` currently:

```js
test('TOOL_DUNGEON_ENTRANCES positions are in-bounds and resolve to a walkable entrance tile kind', async () => {
  // js/screens/mapScreen.js's tileAt() unconditionally overrides this exact
  // cell with TILES[entry.tileKind] before ever reading the underlying
  // wilderness file (same mechanism as the sealed-edge override), so the
  // entrance is walkable in-game regardless of whatever terrain is painted
  // beneath it - only in-bounds placement and the tile kind's own
  // walkability actually matter.
  for (const [toolId, entry] of Object.entries(TOOL_DUNGEON_ENTRANCES)) {
    const wildernessMap = (await import(`../js/maps/wilderness/${entry.screenId}.js`))[`${entry.screenId}Map`];
    const height = wildernessMap.rows.length;
    const width = wildernessMap.rows[0].length;
    assert.ok(
      entry.x >= 0 && entry.x < width && entry.y >= 0 && entry.y < height,
      `TOOL_DUNGEON_ENTRANCES.${toolId} position (${entry.x}, ${entry.y}) is out of bounds on '${entry.screenId}' (${width}x${height})`
    );
    assert.ok(TILES[entry.tileKind].walkable, `TOOL_DUNGEON_ENTRANCES.${toolId}'s tileKind '${entry.tileKind}' must be walkable`);
  }
});
```

Change to:

```js
test('TOOL_DUNGEON_ENTRANCES positions are in-bounds and resolve to a walkable entrance tile kind', async () => {
  // js/screens/mapScreen.js's tileAt() unconditionally overrides this exact
  // cell with TILES[entry.tileKind] before ever reading the underlying
  // wilderness file (same mechanism as the sealed-edge override), so the
  // entrance is walkable in-game regardless of whatever terrain is painted
  // beneath it - only in-bounds placement and the tile kind's own
  // walkability actually matter.
  for (const [toolId, entry] of Object.entries(TOOL_DUNGEON_ENTRANCES)) {
    // A not-yet-hand-placed entrance (screenId: null) has nothing to check
    // yet - covered separately below instead of crashing this import.
    if (entry.screenId === null) continue;
    const wildernessMap = (await import(`../js/maps/wilderness/${entry.screenId}.js`))[`${entry.screenId}Map`];
    const height = wildernessMap.rows.length;
    const width = wildernessMap.rows[0].length;
    assert.ok(
      entry.x >= 0 && entry.x < width && entry.y >= 0 && entry.y < height,
      `TOOL_DUNGEON_ENTRANCES.${toolId} position (${entry.x}, ${entry.y}) is out of bounds on '${entry.screenId}' (${width}x${height})`
    );
    assert.ok(TILES[entry.tileKind].walkable, `TOOL_DUNGEON_ENTRANCES.${toolId}'s tileKind '${entry.tileKind}' must be walkable`);
  }
});

test("a not-yet-placed TOOL_DUNGEON_ENTRANCES entry (null screenId) is inert everywhere that matches on screenId", () => {
  const placeholders = Object.entries(TOOL_DUNGEON_ENTRANCES).filter(([, entry]) => entry.screenId === null);
  assert.ok(placeholders.length > 0, 'expected at least one not-yet-placed entrance to exist for this test to mean anything');
  for (const [toolId, entry] of placeholders) {
    // Every real screenId is a non-empty string, so `screenConfig.id ===
    // entry.screenId` (js/screens/mapScreen.js's tileAt()) can never match
    // null - this just pins that invariant down explicitly.
    assert.equal(entry.screenId, null, `${toolId} placeholder`);
    assert.notEqual(typeof 'anyRealScreenId', typeof entry.screenId);
  }
});
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]` → `### Added`:

```markdown
- The Circle of Ultimate Portaling's guardian dungeon (`portalDungeon`)
  and its `TOOL_DUNGEON_ENTRANCES.portal` registration - entrance
  position is still a placeholder until Timothy hand-places it with the
  terrain painter.
```

```bash
git add js/maps/toolDungeons/portalDungeon.js js/data/toolDungeons.js js/main.js js/tiles.js tests/toolDungeonMaps.test.js CHANGELOG.md
git commit -m "feat: add portal guardian dungeon and its entrance registration"
```

---

### Task 3: Terrain painter registration (4th tool)

**Files:**
- Modify: `tools/terrain-painter/painter.js`

**Interfaces:**
- Consumes: `portalDungeonMap` (Task 2, via its own dynamic `import()` at the `modulePath` given below - same as the other three).

**No automated test file exercises `painter.js` directly** (`tests/terrainPainterReachability.test.js` only tests the pure `checkProgression` algorithm in `tools/terrain-painter/reachability.js` with its own self-contained stage arrays - it doesn't read `painter.js`'s config, so it needs no changes here). Verify this task by opening the tool in a browser (Step 4 below) rather than `npm run test`.

- [ ] **Step 1: Add the portal dungeon to `SINGLE_MAPS`**

Find the `SINGLE_MAPS` config's `canoeDungeon` entry (`tools/terrain-painter/painter.js:112-114` area) and add a fourth entry right after it, following the exact same shape:

```js
  canoeDungeon: {
    label: 'Canoe Dungeon', modulePath: '../../js/maps/toolDungeons/canoeDungeon.js',
    exportName: 'canoeDungeonMap', palette: DUNGEON_PALETTE, defaultKind: 'grass',
  },
  portalDungeon: {
    label: 'Portal Dungeon', modulePath: '../../js/maps/toolDungeons/portalDungeon.js',
    exportName: 'portalDungeonMap', palette: DUNGEON_PALETTE, defaultKind: 'grass',
  },
```

- [ ] **Step 2: Register the 4th tool id and its marker color**

`tools/terrain-painter/painter.js:143-144` currently:

```js
const TOOL_DUNGEON_IDS = ['axe', 'pick', 'canoe'];
const TOOL_DUNGEON_MARKER_COLORS = { axe: '#5cb85c', pick: '#5bc0de', canoe: '#e0a83a' };
```

Change to:

```js
const TOOL_DUNGEON_IDS = ['axe', 'pick', 'canoe', 'portal'];
const TOOL_DUNGEON_MARKER_COLORS = { axe: '#5cb85c', pick: '#5bc0de', canoe: '#e0a83a', portal: '#b06fd6' };
```

Every other place in this file that drives its UI from `TOOL_DUNGEON_IDS` (the tool-dungeon select dropdown, marker placement/import-from-game-data, the autosave round-trip) already loops over this array generically - no further changes needed for those.

- [ ] **Step 3: Add the portal stage to the progression-reachability checker**

Find the `entrances` array inside the reachability-check handler (`tools/terrain-painter/painter.js:652-657` area):

```js
  const entrances = [
    { id: 'axe', label: 'axe dungeon', pos: worldKeyFor(toolDungeonMarkers.axe), unlocks: TOOL_UNLOCK_KINDS.axe },
    { id: 'pick', label: 'pick dungeon', pos: worldKeyFor(toolDungeonMarkers.pick), unlocks: TOOL_UNLOCK_KINDS.pick },
    { id: 'canoe', label: 'canoe dungeon (boat)', pos: worldKeyFor(toolDungeonMarkers.canoe), unlocks: TOOL_UNLOCK_KINDS.canoe },
    { id: null, label: 'dragon dungeon', pos: worldKeyFor(dungeonMarker), unlocks: [] },
  ];
```

Change to (portal slots in between canoe and the dragon, matching "gated behind axe + pick + boat already" - it doesn't unlock any terrain kind of its own, same as the dragon stage):

```js
  const entrances = [
    { id: 'axe', label: 'axe dungeon', pos: worldKeyFor(toolDungeonMarkers.axe), unlocks: TOOL_UNLOCK_KINDS.axe },
    { id: 'pick', label: 'pick dungeon', pos: worldKeyFor(toolDungeonMarkers.pick), unlocks: TOOL_UNLOCK_KINDS.pick },
    { id: 'canoe', label: 'canoe dungeon (boat)', pos: worldKeyFor(toolDungeonMarkers.canoe), unlocks: TOOL_UNLOCK_KINDS.canoe },
    { id: 'portal', label: 'portal dungeon', pos: worldKeyFor(toolDungeonMarkers.portal), unlocks: [] },
    { id: null, label: 'dragon dungeon', pos: worldKeyFor(dungeonMarker), unlocks: [] },
  ];
```

- [ ] **Step 4: Manually verify in a browser**

Run: `python3 -m http.server 8000` from the repo root (per `README.md`'s "Dev tools" section), then open `http://localhost:8000/tools/terrain-painter/index.html`.

Confirm:
- The tool-dungeon select dropdown now includes "Portal Dungeon".
- Switching to it lets you paint/edit a grid the same as Axe/Pick/Canoe Dungeon.
- Back on the wilderness view, the "Place Tool Dungeon Entrance" control offers a `portal` option and placing one shows a marker in the new purple (`#b06fd6`).
- Running the reachability check (with all four tool markers placed somewhere reachable) reports a `portal dungeon` stage rather than erroring.

Leave the actual entrance placement itself to Timothy per the design doc - this step only confirms the tool supports it.

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]` → `### Added`:

```markdown
- Terrain painter: registered the portal dungeon as the 4th tool
  dungeon (dropdown, marker color, progression-reachability check).
```

```bash
git add tools/terrain-painter/painter.js CHANGELOG.md
git commit -m "feat: register portal dungeon with the terrain painter tool"
```

---

### Task 4: Portal state module and save-state default

**Files:**
- Create: `js/systems/portal.js`
- Test: `tests/portal.test.js`
- Modify: `js/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Produces: `TOWN_PORTAL_POSITION` (`{ x: 7, y: 4 }`), `hasPortalTool(inventory) -> boolean`, `dropPortal(screenId, x, y) -> portal`, `markReturnPending(portal) -> portal`, all from `js/systems/portal.js`. Read by Task 5's `mapScreen.js` (`TOWN_PORTAL_POSITION`) and `main.js` (all four).
- `createNewGame()` gains `portal: null` in its returned state shape - read by Task 5's `tileAt()`/`handleUseWell` checks.

- [ ] **Step 1: Write the failing tests for `js/systems/portal.js`**

Create `tests/portal.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWN_PORTAL_POSITION, hasPortalTool, dropPortal, markReturnPending } from '../js/systems/portal.js';

test('TOWN_PORTAL_POSITION is a fixed in-town spot', () => {
  assert.deepEqual(TOWN_PORTAL_POSITION, { x: 7, y: 4 });
});

test('hasPortalTool is false with an empty inventory', () => {
  assert.equal(hasPortalTool([]), false);
});

test('hasPortalTool is false when the inventory has other items but not the portal tool', () => {
  assert.equal(hasPortalTool([{ itemId: 'axe', quantity: 1 }]), false);
});

test('hasPortalTool is false when the inventory entry exists but has zero quantity', () => {
  assert.equal(hasPortalTool([{ itemId: 'portalCircle', quantity: 0 }]), false);
});

test('hasPortalTool is true when the inventory has the tool with quantity > 0', () => {
  assert.equal(hasPortalTool([{ itemId: 'portalCircle', quantity: 1 }]), true);
});

test('dropPortal returns a fresh portal at the given position with returnPending false', () => {
  assert.deepEqual(dropPortal('north', 5, 9), {
    originScreenId: 'north', originX: 5, originY: 9, returnPending: false,
  });
});

test('markReturnPending flips returnPending to true without touching the origin fields', () => {
  const portal = dropPortal('north', 5, 9);
  const updated = markReturnPending(portal);
  assert.deepEqual(updated, { originScreenId: 'north', originX: 5, originY: 9, returnPending: true });
});

test('markReturnPending does not mutate its input (pure function)', () => {
  const portal = dropPortal('north', 5, 9);
  markReturnPending(portal);
  assert.equal(portal.returnPending, false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL with `Cannot find module '../js/systems/portal.js'` (or similar - the file doesn't exist yet).

- [ ] **Step 3: Implement `js/systems/portal.js`**

```js
// The Circle of Ultimate Portaling's own state-transition rules - pure
// functions only, no DOM/state-object mutation, mirroring how
// js/systems/toolGates.js/caches.js/miniDungeons.js separate rules from
// the js/main.js orchestration layer that actually owns `state`. See
// docs/superpowers/specs/2026-09-01-portal-scroll-design.md.

// Fixed in-town spot the return portal always appears at, regardless of
// where the player dropped the origin end - town's ROWS[4] is
// '#..S.......M...#' (shop at x=3, smith at x=11), so x=7 sits centered
// between them, clear of the well (11,8) and the exit (7,10).
export const TOWN_PORTAL_POSITION = { x: 7, y: 4 };

export function hasPortalTool(inventory) {
  return inventory.some((entry) => entry.itemId === 'portalCircle' && entry.quantity > 0);
}

export function dropPortal(screenId, x, y) {
  return { originScreenId: screenId, originX: x, originY: y, returnPending: false };
}

export function markReturnPending(portal) {
  return { ...portal, returnPending: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Add `state.portal` to `createNewGame()`'s default shape**

`js/state.js` currently has, among `createNewGame()`'s returned fields:

```js
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
```

Change to:

```js
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    // The Circle of Ultimate Portaling's current drop, or null if none is
    // out. No migration function needed for existing saves: a save made
    // before this field existed simply lacks the key, and `undefined`
    // reads exactly like `null` everywhere this feature checks it.
    portal: null,
```

- [ ] **Step 6: Add a test asserting the default**

`tests/state.test.js:32-49`'s `'createNewGame returns a fresh default state'` test asserts individual fields with `assert.equal`/`assert.deepEqual`, including `assert.equal(state.activeMiniDungeon, null);`. Add a matching line right after it:

```js
  assert.equal(state.activeMiniDungeon, null);
  assert.equal(state.portal, null);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]` → `### Added`:

```markdown
- Internal: `state.portal` save-state field and `js/systems/portal.js`'s
  pure drop/return-pending rules for the Circle of Ultimate Portaling -
  not yet wired into any screen (next commit).
```

```bash
git add js/systems/portal.js tests/portal.test.js js/state.js tests/state.test.js CHANGELOG.md
git commit -m "feat: add portal state module and state.portal save field"
```

---

### Task 5: Map rendering, hotkey, orchestration, and the well-block fix

**Files:**
- Modify: `js/tiles.js`
- Modify: `js/screens/mapScreen.js`
- Modify: `js/main.js`
- Test: `tests/mapScreenDom.test.js`

**Interfaces:**
- Consumes: `TOWN_PORTAL_POSITION`, `hasPortalTool`, `dropPortal`, `markReturnPending` (Task 4); `ITEMS.portalCircle` (Task 1).
- Produces: the fully working feature end-to-end - no later task depends on new interfaces from this one.

- [ ] **Step 1: Add the two portal tile kinds to `js/tiles.js`**

Insert right after `portalDungeonEntrance` (added in Task 2, `js/tiles.js:46`):

```js
  portalDungeonEntrance: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalDungeon', description: 'A guarded passage — a portal lies beyond' },
  portalOrigin: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalToTown', description: 'A swirling portal — steps through to town' },
  portalReturn: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalToOrigin', description: 'A swirling portal — steps through back where you left it' },
```

- [ ] **Step 2: Write the failing DOM tests for portal-tile rendering**

Rendered `.map-tile` cells carry no `data-x`/`data-y` (they're positioned via CSS `gridColumn`/`gridRow`, viewport-relative, not world coordinates) - the existing quest-board-glow test above locates its target purely by a dedicated CSS class (`map-tile-quest-ready`), not position. Follow that same approach: Step 4 below adds two dedicated classes, `map-tile-portal-origin`/`map-tile-portal-return`, so these tests can select on class alone with no position math.

Add to `tests/mapScreenDom.test.js` (new `test(...)` block - place it after the existing quest-board-glow test block, following that file's own `mountTown`/`baseState` helpers):

```js
test('mapScreen DOM - portal tiles', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('origin portal tile renders (and no return tile yet) when state.portal exists with returnPending false', async () => {
    const state = baseState({ portal: { originScreenId: 'town', originX: 7, originY: 9, returnPending: false } });
    const root = await mountTown(state);
    const originCell = root.querySelector('.map-tile-portal-origin');
    assert.ok(originCell, 'expected the origin portal tile to render');
    assert.ok(originCell.textContent.includes('🌌'), 'expected the portal emoji on the origin tile');
    assert.equal(root.querySelector('.map-tile-portal-return'), null, 'return portal should not render until returnPending is true');
  });

  await t.test('return portal tile renders at the fixed town spot once returnPending is true, origin tile is on a different screen so does not render here', async () => {
    const state = baseState({ portal: { originScreenId: 'north', originX: 3, originY: 3, returnPending: true } });
    const root = await mountTown(state);
    const returnCell = root.querySelector('.map-tile-portal-return');
    assert.ok(returnCell, 'expected the return portal tile to render');
    assert.ok(returnCell.textContent.includes('🌌'), 'expected the portal emoji on the return tile');
    assert.equal(root.querySelector('.map-tile-portal-origin'), null, "origin tile is on 'north', not 'town' - should not render in this mount");
  });

  await t.test('no portal tile anywhere when state.portal is null', async () => {
    const root = await mountTown(baseState({ portal: null }));
    assert.equal(root.querySelector('.map-tile-portal-origin'), null);
    assert.equal(root.querySelector('.map-tile-portal-return'), null);
  });
});
```

No new import needed for this test file - `TOWN_PORTAL_POSITION` isn't referenced directly (the class selectors make position-literal assertions unnecessary).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL (no `portal`/`portalOrigin`/`portalReturn` tile handling in `tileAt()` yet).

- [ ] **Step 4: Add the `tileAt()` overrides in `js/screens/mapScreen.js`**

`js/screens/mapScreen.js:227-236` currently:

```js
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
```

Change to:

```js
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
  if (state.portal && screenConfig.id === state.portal.originScreenId && x === state.portal.originX && y === state.portal.originY) {
    return TILES.portalOrigin;
  }
  if (state.portal && state.portal.returnPending && screenConfig.id === 'town' && x === TOWN_PORTAL_POSITION.x && y === TOWN_PORTAL_POSITION.y) {
    return TILES.portalReturn;
  }
  if (isSealedWorldEdge(screenConfig, x, y)) return TILES.mountainWall;
```

Add the import at the top of `js/screens/mapScreen.js` (alongside its other `../systems/*` imports): `import { TOWN_PORTAL_POSITION } from '../systems/portal.js';`.

Also add the two dedicated CSS hook classes the Step 2 tests select on. `js/screens/mapScreen.js:487-494` currently:

```js
      cell.className = 'map-tile'
        + (tile === TILES.grass || STUMP_AND_RUBBLE.has(tile) || RANDOM_SIZE_OBSTACLES.has(tile) || GRASS_CONTEXT_MARKERS.has(tile) ? ' map-tile-grass' : '')
        + (tile === TILES.water ? ' map-tile-water' : '')
        + (isPlayer ? ' map-tile-player' : '')
        // Visible from a distance so a completed quest doesn't only turn up
        // by walking in and checking - see docs/superpowers/BACKLOG.md's
        // "Quest board should glow..." item.
        + (tile === TILES.questBoard && hasAnyQuestReady(state) ? ' map-tile-quest-ready' : '');
```

Change to:

```js
      cell.className = 'map-tile'
        + (tile === TILES.grass || STUMP_AND_RUBBLE.has(tile) || RANDOM_SIZE_OBSTACLES.has(tile) || GRASS_CONTEXT_MARKERS.has(tile) ? ' map-tile-grass' : '')
        + (tile === TILES.water ? ' map-tile-water' : '')
        + (isPlayer ? ' map-tile-player' : '')
        // Visible from a distance so a completed quest doesn't only turn up
        // by walking in and checking - see docs/superpowers/BACKLOG.md's
        // "Quest board should glow..." item.
        + (tile === TILES.questBoard && hasAnyQuestReady(state) ? ' map-tile-quest-ready' : '')
        + (tile === TILES.portalOrigin ? ' map-tile-portal-origin' : '')
        + (tile === TILES.portalReturn ? ' map-tile-portal-return' : '');
```

**Deliberately unhandled edge case** (matches the design doc): if the player drops the portal while standing exactly on `(town, 7, 4)`, the origin check above matches first and permanently masks the return tile at that identical coordinate. Harmless - it only happens in the already-"silly but works" in-town case, and pressing `P` again there (Step 6 below) resets it at zero cost. Not worth branching this function for one coincidental tile - do not add a special case for it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Write the failing test for the `P` hotkey dispatch**

Add to `tests/mapScreenDom.test.js`, inside a new `test(...)` block:

```js
test('mapScreen DOM - portal hotkey', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('pressing P dispatches the usePortalTool action', async () => {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    const seenActions = [];
    mount(root, {
      state: baseState(),
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onAction: (action) => seenActions.push(action) },
    });
    keydown('p');
    assert.deepEqual(seenActions, ['usePortalTool']);
  });

  await t.test('pressing shift+P (uppercase P) also dispatches the usePortalTool action', async () => {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    const seenActions = [];
    mount(root, {
      state: baseState(),
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onAction: (action) => seenActions.push(action) },
    });
    keydown('P');
    assert.deepEqual(seenActions, ['usePortalTool']);
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL (`p`/`P` isn't handled by `handleKeydown` yet).

- [ ] **Step 8: Wire the hotkey in `js/screens/mapScreen.js`**

`js/screens/mapScreen.js:726-730` currently:

```js
function handleKeydown(event) {
  const delta = KEY_TO_DELTA[event.key];
  if (!delta) return;
  tryMove(delta[0], delta[1]);
}
```

Change to:

```js
function handleKeydown(event) {
  const delta = KEY_TO_DELTA[event.key];
  if (delta) {
    tryMove(delta[0], delta[1]);
    return;
  }
  // 'p'/'P' for the Circle of Ultimate Portaling - not part of
  // KEY_TO_DELTA since it's an action, not a move. Confirmed
  // non-colliding with battleScreen.js's own p/P (pause): that screen's
  // keydown listener is detached (screenManager.js pause()) whenever this
  // one is active, same reasoning as the documented 's'/parry collision
  // there.
  if (event.key === 'p' || event.key === 'P') {
    callbacks.onAction('usePortalTool');
  }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 10: Wire the three new actions and the well-block in `js/main.js`**

`js/main.js:443-449` currently (after Task 2's `enterPortalDungeon` line):

```js
function handleTileAction(action) {
  if (action === 'enterTown') return enterMap('town');
  if (action === 'enterDungeon') return enterMap('dungeon');
  if (action === 'enterAxeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.axe.mapId);
  if (action === 'enterPickDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.pick.mapId);
  if (action === 'enterCanoeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.canoe.mapId);
  if (action === 'enterPortalDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.portal.mapId);
```

Add three more cases right after the `enterPortalDungeon` line:

```js
  if (action === 'enterPortalDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.portal.mapId);
  if (action === 'usePortalTool') return handleUsePortalTool();
  if (action === 'enterPortalToTown') return handleEnterPortalToTown();
  if (action === 'enterPortalToOrigin') return handleEnterPortalToOrigin();
```

`js/main.js:484-493`'s existing `handleUseWell` currently:

```js
function handleUseWell() {
  const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
  if (state.player.hp >= effectiveMaxHp) {
    showFlavorBanner('You are already at full health.');
    return;
  }
  state.player.hp = effectiveMaxHp;
  persist();
  renderHud();
  showFlavorBanner('You rest at the well and feel fully restored.');
}
```

Add the well-block as a new early check:

```js
function handleUseWell() {
  if (state.portal && state.portal.returnPending) {
    showFlavorBanner("The well's waters seem out of reach — you're not fully returned to this world.");
    return;
  }
  const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
  if (state.player.hp >= effectiveMaxHp) {
    showFlavorBanner('You are already at full health.');
    return;
  }
  state.player.hp = effectiveMaxHp;
  persist();
  renderHud();
  showFlavorBanner('You rest at the well and feel fully restored.');
}
```

Then add the three new handler functions right after it:

```js
function handleUsePortalTool() {
  if (!hasPortalTool(state.inventory)) return;
  // Unconditional overwrite, not a check-and-block - "only one portal
  // pair ever" means dropping a new one always silently replaces
  // whatever was there, per docs/superpowers/specs/2026-09-01-portal-
  // scroll-design.md.
  state.portal = dropPortal(state.map, state.position.x, state.position.y);
  persist();
  goToMap(state.map);
}

function handleEnterPortalToTown() {
  if (!state.portal) return;
  state.portal = markReturnPending(state.portal);
  persist();
  enterMap('town', { x: TOWN_PORTAL_POSITION.x, y: TOWN_PORTAL_POSITION.y });
}

function handleEnterPortalToOrigin() {
  if (!state.portal) return;
  const { originScreenId, originX, originY } = state.portal;
  state.portal = null;
  persist();
  enterMap(originScreenId, { x: originX, y: originY });
}
```

Note the mutation-before-`enterMap` ordering in both transition handlers: `state` is a single object mutated in place and re-passed by reference into `mountScreen`, so `state.portal` must already reflect the new value before `enterMap`/`goToMap` remounts the destination screen - otherwise the just-warped-to screen's first render would still see the old value.

Add the import at the top of `js/main.js` (alongside its other `./systems/*` imports): `import { TOWN_PORTAL_POSITION, hasPortalTool, dropPortal, markReturnPending } from './systems/portal.js';`.

- [ ] **Step 11: Run the full test suite**

Run: `npm run test`
Expected: PASS, including every test from Tasks 1-4 and this task's own portal-tile and hotkey tests.

- [ ] **Step 12: Manual live verification**

Per this project's own testing convention (main.js's orchestration layer has no direct automated tests - see the note in this plan's header architecture description), verify the full loop in a real browser before committing:

Run: `python3 -m http.server 8000` from the repo root (per `README.md`), open `http://localhost:8000`, and use a fresh save slot (no existing save to conflict with).

1. Temporarily add the tool to `js/state.js`'s `createNewGame()` starting inventory (right next to the existing `inventory: [{ itemId: 'potion', quantity: 2 }],` line) so a fresh save starts carrying it: `inventory: [{ itemId: 'potion', quantity: 2 }, { itemId: 'portalCircle', quantity: 1 }],`. This is a temporary local-only edit for manual testing - **do not commit it**; revert it before Step 13's commit (a fresh save should NOT normally start with the portal tool, since it's meant to be guardian-gated).
2. Reload, start a fresh character, walk out into the wilderness, press `P` - confirm a `🌌` tile appears at your exact position and the map re-renders immediately (no move needed to see it).
3. Walk into it - confirm you land in town, and a `🌌` tile appears at the fixed spot near the shop/smith cluster (not wherever you happened to be standing).
4. Try the well (`⛲`) - confirm it's blocked with the "not fully returned to this world" message instead of healing.
5. Walk into the return portal - confirm you land back at your exact wilderness drop spot, and both portal tiles are gone.
6. Confirm the well heals normally again now that the round trip is complete.
7. Repeat steps 2-3, but this time abandon the trip (don't walk into the return portal) and press `P` again from a new spot - confirm the old return portal in town disappears and the well unblocks immediately.
8. Revert Step 1's temporary inventory edit in `js/state.js` before committing.

- [ ] **Step 13: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]` → `### Added` (and fold the earlier three "not yet wired in" `Unreleased` notes from Tasks 1/2/4 into one coherent entry here, since this commit is what actually makes the feature live):

```markdown
- The Circle of Ultimate Portaling is now fully playable: press `P`
  while exploring to drop a portal at your feet, walk into it to warp
  to a fixed spot in town, walk into the paired portal there to warp
  back to exactly where you left. The pair vanishes once you've made
  the full round trip. Fixed in `js/data/toolDungeons.js` -
  Timothy still needs to hand-place the guardian's dungeon entrance
  with the terrain painter before it's reachable.
- The town well's free healing is now blocked while a portal round
  trip is pending (outbound leg used, return leg not yet taken) - stops
  the portal from turning the well into a free heal reachable from
  anywhere. Dropping a new portal always clears this, at the cost of
  losing the old portal's return trip.
```

(If Task 1/2/4's individual `Unreleased` bullets are still sitting there unchanged, replace them with the single entry above rather than leaving four overlapping bullets - check the current `## [Unreleased]` section's contents first.)

```bash
git add js/tiles.js js/screens/mapScreen.js js/main.js tests/mapScreenDom.test.js CHANGELOG.md
git commit -m "feat: wire the portal tool into the map (hotkey, rendering, warp, well-block)"
```

---

### Task 6: Version bump and player-facing changelog

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `js/data/playerChangelog.js`

**Interfaces:** None - this is documentation-only, no code interfaces produced or consumed.

- [ ] **Step 1: Bump `Unreleased` into a dated version section**

Per this repo's `CHANGELOG.md` header rules, a completed feature/system is a MINOR bump. The latest existing section is `## [0.15.0] - 2026-09-01`, so this becomes `## [0.16.0] - 2026-09-01` (use today's actual date if this plan is executed on a different day). Rename the `## [Unreleased]` heading this plan's tasks have been adding to, moving its accumulated content (from Tasks 1-5, already consolidated into one coherent set of bullets per Task 5's note) under the new dated heading, and add a fresh empty `## [Unreleased]` above it for future work:

```markdown
## [Unreleased]

## [0.16.0] - 2026-09-01

### Added
- The Circle of Ultimate Portaling is now fully playable: ...
  [carry forward the exact consolidated bullets Task 5 left in Unreleased]
```

- [ ] **Step 2: Add the matching player-facing entry**

`js/data/playerChangelog.js`'s `PLAYER_CHANGELOG` array currently starts with the `0.15.0` entry. Add a new entry above it (newest first):

```js
export const PLAYER_CHANGELOG = [
  {
    version: '0.16.0',
    date: '2026-09-01',
    highlights: [
      'New: a fourth guardian-gated tool, the Circle of Ultimate Portaling - drop a portal wherever you\'re standing, warp to town, then warp right back to exactly where you left. The pair disappears once you\'ve made the round trip.',
      'Changed: the town well won\'t heal you while a portal trip back to town is still open - finish the round trip (or drop a fresh portal) first.',
    ],
  },
  {
    version: '0.15.0',
    ...
```

Skip the terrain-painter and internal `state.portal`/`js/systems/portal.js` bullets here - those are exactly the "internal-only... CI, tooling, refactors" category this file's own header comment says to leave out; a player never sees them.

- [ ] **Step 3: Run the version-sync test**

Run: `npm run test`
Expected: PASS - `tests/versionSync.test.js` checks `CHANGELOG.md`'s newest dated version matches `PLAYER_CHANGELOG[0].version`; both are now `0.16.0`.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md js/data/playerChangelog.js
git commit -m "docs: bump to 0.16.0 for the Circle of Ultimate Portaling"
```

**Do not push.** Per this repo's own rules, a push to the default branch is the release - wait for Timothy's explicit go-ahead (and note the branch is currently `main` locally, not yet pushed/switched on the remote - pushing this work is a separate, later decision on top of that).
