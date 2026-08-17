# Metroidvania Tool-Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two tools (a mining pick and an axe), each dropped by a specific dungeon-tier monster, that permanently unlock four hand-placed gates carved out of existing decorative terrain on the 9 wilderness screens — one real through-shortcut, and three small dead-end pockets each granting a one-time reward on first crossing.

**Architecture:** A new pure `js/systems/toolGates.js` (mirrors `caches.js`'s shape exactly) holds the tool-check, locked-gate messaging, and one-time-reward-collection logic. Two new item entries and two new monster drop-table entries feed it. Four new tile-type entries in `js/tiles.js`, each converting a small number of existing `#` characters on four specific wilderness screens into the new gate type, keep every existing map-validation and reachability test passing unchanged (gated tiles keep `walkable: false` at the base level — the only value those tests ever check). The actual tool-awareness lives entirely in `js/screens/mapScreen.js`'s own movement check (confirmed by reading the code: `tryMove` has its own separate walkability check and never calls `js/systems/world.js`'s `isWalkableAt`, which is used only for load-time position validation and by the reachability test suite) — `isWalkableAt` is not touched by this plan at all.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- Two new items: `miningPick` (emoji `⛏️`) and `axe` (emoji `🪓`), both `type: 'tool'`, `price: 0` (drop-only, never shop-purchasable), not equippable in any of the 5 gear slots, never consumed.
- `orc`'s drop table gains `{ itemId: 'miningPick', chance: 0.25 }`; `wraith`'s gains `{ itemId: 'axe', chance: 0.25 }` — each alongside its existing material drop entry, unchanged.
- Four new tile types in `js/tiles.js`:
  - `mountain`: `{ emoji: '⛰️', walkable: false, encounter: false, requiresTool: 'miningPick' }`
  - `mountainCache`: `{ emoji: '⛰️', walkable: false, encounter: false, requiresTool: 'miningPick', hasReward: true }`
  - `thicket`: `{ emoji: '🌳', walkable: false, encounter: false, requiresTool: 'axe' }`
  - `thicketCache`: `{ emoji: '🌳', walkable: false, encounter: false, requiresTool: 'axe', hasReward: true }`
- Exactly four gate placements, on four different wilderness screens (exact before/after row strings given in Task 3 — copy them verbatim, they were derived from the real current file contents and hand-verified character-by-character):
  1. `east.js`, row y=10, **mountain** (plain, no reward) — opens the full width of an existing 2-tile-wide interior tree wall, creating a genuine through-shortcut.
  2. `southwest.js`, row y=12, **thicketCache** (reward) — a single-tile dead-end opening into an existing 5-tile-wide tree wall (only 1 of 5 columns opened, so this is deliberately NOT a through-passage, just a reward nook).
  3. `northwest.js`, row y=4, **mountainCache** (reward) — a single-tile dead-end opening into an existing 10-tile-wide tree block.
  4. `north.js`, row y=15, **thicketCache** (reward) — a single-tile dead-end opening into an existing 3-tile-wide tree cluster.
- Reward on a `hasReward` gate: `gold = 15 + Math.floor(rng() * 11)` (15-25 inclusive) plus a guaranteed `potion`, granted exactly once per (screenId, x, y), tracked the same way `state.caches` already is.
- Locked-gate message format: `"You need {a|an} {Item Name} to get through here."`, article chosen by whether the item name starts with a vowel.
- `js/systems/world.js`'s `isWalkableAt` is NOT modified by this plan.
- No new maps/zones. World-edge border trees are never touched by any placement.

---

### Task 1: Add the two tool items and their monster drop-table entries

**Files:**
- Modify: `js/data/items.js`
- Modify: `js/data/monsters.js`
- Modify: `tests/data.test.js`

**Interfaces:**
- Produces: `ITEMS.miningPick`, `ITEMS.axe` (both `{ id, name, emoji, type: 'tool', price: 0 }`); `MONSTERS.orc.dropTable` and `MONSTERS.wraith.dropTable` each gain one new entry. Task 2's `toolGates.js` imports `ITEMS` and reads `ITEMS[toolId].name`. Task 5's wiring reads `ITEMS[loot.item].name` for the reward-grant flavor message (already an existing pattern via `handleCacheFound`).

- [ ] **Step 1: Write the failing tests**

Add this test to `tests/data.test.js`, anywhere after the existing `'every quest-eligible monster still has at least one material drop'` test:

```js
test('orc drops a mining pick and wraith drops an axe, alongside their existing material drop', () => {
  const orcTools = MONSTERS.orc.dropTable.filter((entry) => ITEMS[entry.itemId].type === 'tool');
  assert.equal(orcTools.length, 1);
  assert.equal(orcTools[0].itemId, 'miningPick');
  assert.equal(orcTools[0].chance, 0.25);

  const wraithTools = MONSTERS.wraith.dropTable.filter((entry) => ITEMS[entry.itemId].type === 'tool');
  assert.equal(wraithTools.length, 1);
  assert.equal(wraithTools[0].itemId, 'axe');
  assert.equal(wraithTools[0].chance, 0.25);

  assert.equal(ITEMS.miningPick.type, 'tool');
  assert.equal(ITEMS.miningPick.price, 0);
  assert.equal(ITEMS.axe.type, 'tool');
  assert.equal(ITEMS.axe.price, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ITEMS.miningPick`/`ITEMS.axe` are `undefined`, so `ITEMS[entry.itemId].type` throws or the drop-table filters find nothing.

- [ ] **Step 3: Add the two tool items to `js/data/items.js`**

Add this new section at the end of the file, immediately before the closing `};`:

```js

  // Tools
  miningPick: { id: 'miningPick', name: 'Mining Pick', emoji: '⛏️', type: 'tool', price: 0 },
  axe: { id: 'axe', name: 'Axe', emoji: '🪓', type: 'tool', price: 0 },
```

- [ ] **Step 4: Add the two drop-table entries in `js/data/monsters.js`**

Change:

```js
  orc: {
    id: 'orc', name: 'Super Mean Meatloaf', emoji: '👹',
    hp: 180, attack: 32, defense: 8, speed: 8,
    xp: 60, goldRange: [18, 28],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }],
```

to:

```js
  orc: {
    id: 'orc', name: 'Super Mean Meatloaf', emoji: '👹',
    hp: 180, attack: 32, defense: 8, speed: 8,
    xp: 60, goldRange: [18, 28],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }, { itemId: 'miningPick', chance: 0.25 }],
```

Change:

```js
  wraith: {
    id: 'wraith', name: 'Ghost Apple Supreme', emoji: '👻',
    hp: 170, attack: 32, defense: 4, speed: 11,
    xp: 63, goldRange: [18, 30],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }],
```

to:

```js
  wraith: {
    id: 'wraith', name: 'Ghost Apple Supreme', emoji: '👻',
    hp: 170, attack: 32, defense: 4, speed: 11,
    xp: 63, goldRange: [18, 30],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }, { itemId: 'axe', chance: 0.25 }],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, the new test plus the full existing suite.

- [ ] **Step 6: Commit**

```bash
git add js/data/items.js js/data/monsters.js tests/data.test.js
git commit -m "feat: add mining pick and axe tool items, dropped by orc and wraith"
```

---

### Task 2: `js/systems/toolGates.js` — pure tool-check, messaging, and reward logic

**Files:**
- Create: `js/systems/toolGates.js`
- Test: `tests/toolGates.test.js`

**Interfaces:**
- Consumes: `ITEMS` from `js/data/items.js` (Task 1).
- Produces: `GATE_REWARD_GOLD_MIN` (15), `GATE_REWARD_GOLD_RANGE` (11); `hasRequiredTool(tile, inventory)` → boolean; `getLockedGateMessage(toolId)` → string; `isGateRewardCollected(gateRewards, screenId, x, y)` → boolean; `markGateRewardCollected(gateRewards, screenId, x, y)` → new `gateRewards` object; `rollGateReward(rng = Math.random)` → `{ gold, item: 'potion' }`. Task 5's `mapScreen.js` imports all five functions.

- [ ] **Step 1: Write the failing tests**

Create `tests/toolGates.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GATE_REWARD_GOLD_MIN,
  GATE_REWARD_GOLD_RANGE,
  hasRequiredTool,
  getLockedGateMessage,
  isGateRewardCollected,
  markGateRewardCollected,
  rollGateReward,
} from '../js/systems/toolGates.js';

test('hasRequiredTool is true for a tile with no requiresTool field, regardless of inventory', () => {
  assert.equal(hasRequiredTool({}, []), true);
});

test('hasRequiredTool is false when the inventory lacks the required tool', () => {
  const tile = { requiresTool: 'miningPick' };
  assert.equal(hasRequiredTool(tile, []), false);
  assert.equal(hasRequiredTool(tile, [{ itemId: 'axe', quantity: 1 }]), false);
});

test('hasRequiredTool is true when the inventory has the required tool with quantity > 0', () => {
  const tile = { requiresTool: 'miningPick' };
  assert.equal(hasRequiredTool(tile, [{ itemId: 'miningPick', quantity: 1 }]), true);
});

test('hasRequiredTool is false when the inventory entry exists but has zero quantity', () => {
  const tile = { requiresTool: 'axe' };
  assert.equal(hasRequiredTool(tile, [{ itemId: 'axe', quantity: 0 }]), false);
});

test('getLockedGateMessage names the correct tool with correct a/an grammar', () => {
  assert.equal(getLockedGateMessage('miningPick'), 'You need a Mining Pick to get through here.');
  assert.equal(getLockedGateMessage('axe'), 'You need an Axe to get through here.');
});

test('isGateRewardCollected/markGateRewardCollected round-trip, immutably', () => {
  const gateRewards = {};
  const next = markGateRewardCollected(gateRewards, 'northwest', 14, 4);
  assert.equal(isGateRewardCollected(next, 'northwest', 14, 4), true);
  assert.deepEqual(gateRewards, {});
});

test('isGateRewardCollected returns false for uncollected tiles and unknown screens', () => {
  const gateRewards = { northwest: { '14,4': true } };
  assert.equal(isGateRewardCollected(gateRewards, 'northwest', 1, 1), false);
  assert.equal(isGateRewardCollected(gateRewards, 'unknown', 14, 4), false);
});

test('markGateRewardCollected preserves previously recorded rewards on the same screen', () => {
  let gateRewards = markGateRewardCollected({}, 'north', 3, 15);
  gateRewards = markGateRewardCollected(gateRewards, 'north', 9, 9);
  assert.equal(isGateRewardCollected(gateRewards, 'north', 3, 15), true);
  assert.equal(isGateRewardCollected(gateRewards, 'north', 9, 9), true);
});

test('rollGateReward rolls gold in the 15-25 range and always grants a potion', () => {
  const low = rollGateReward(() => 0);
  assert.equal(low.gold, GATE_REWARD_GOLD_MIN);
  assert.equal(low.item, 'potion');
  const high = rollGateReward(() => 0.9999);
  assert.equal(high.gold, GATE_REWARD_GOLD_MIN + GATE_REWARD_GOLD_RANGE - 1);
  assert.equal(high.item, 'potion');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/toolGates.js` does not exist yet, so the import throws.

- [ ] **Step 3: Implement `js/systems/toolGates.js`**

```js
import { ITEMS } from '../data/items.js';

export const GATE_REWARD_GOLD_MIN = 15;
export const GATE_REWARD_GOLD_RANGE = 11;

export function hasRequiredTool(tile, inventory) {
  if (!tile.requiresTool) return true;
  return inventory.some((entry) => entry.itemId === tile.requiresTool && entry.quantity > 0);
}

export function getLockedGateMessage(toolId) {
  const name = ITEMS[toolId].name;
  const article = /^[AEIOU]/.test(name) ? 'an' : 'a';
  return `You need ${article} ${name} to get through here.`;
}

export function isGateRewardCollected(gateRewards, screenId, x, y) {
  return Boolean(gateRewards[screenId] && gateRewards[screenId][`${x},${y}`]);
}

export function markGateRewardCollected(gateRewards, screenId, x, y) {
  const key = `${x},${y}`;
  const screenRewards = { ...(gateRewards[screenId] || {}), [key]: true };
  return { ...gateRewards, [screenId]: screenRewards };
}

export function rollGateReward(rng = Math.random) {
  const gold = GATE_REWARD_GOLD_MIN + Math.floor(rng() * GATE_REWARD_GOLD_RANGE);
  return { gold, item: 'potion' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 9 new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/systems/toolGates.js tests/toolGates.test.js
git commit -m "feat: add pure tool-check, messaging, and gate-reward logic"
```

---

### Task 3: Tool-gated tile types and the four map placements

**Files:**
- Modify: `js/tiles.js`
- Modify: `js/maps/wilderness/east.js`
- Modify: `js/maps/wilderness/southwest.js`
- Modify: `js/maps/wilderness/northwest.js`
- Modify: `js/maps/wilderness/north.js`
- Modify: `tests/maps.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 (tile data is independent of the item/tool-check modules; they're connected only via the shared `requiresTool` string value, which matches `ITEMS`' ids by convention, not by import).
- Produces: `TILES.mountain`, `TILES.mountainCache`, `TILES.thicket`, `TILES.thicketCache` (each `{ emoji, walkable: false, encounter: false, requiresTool, hasReward? }`); the four wilderness screens now include one of these tile types at the exact coordinates below. Task 5's `mapScreen.js` reads these tiles' `requiresTool`/`hasReward` fields directly via its existing `tileAt()` helper — no new interface beyond the tile data itself.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/maps.test.js`, anywhere after the existing `'every walkable tile on every wilderness screen is reachable from startPosition'` test:

```js
test('tool-gated tiles appear on the correct screens with the correct tool requirement and reward flag', () => {
  const eastTileKeys = [...eastMap.rows.join('')].map((c) => eastMap.legend[c]);
  assert.ok(eastTileKeys.includes('mountain'), 'east must have a mountain gate');
  assert.equal(TILES.mountain.requiresTool, 'miningPick');
  assert.equal(TILES.mountain.hasReward, undefined);

  const southwestTileKeys = [...southwestMap.rows.join('')].map((c) => southwestMap.legend[c]);
  assert.ok(southwestTileKeys.includes('thicketCache'), 'southwest must have a thicketCache gate');
  assert.equal(TILES.thicketCache.requiresTool, 'axe');
  assert.equal(TILES.thicketCache.hasReward, true);

  const northwestTileKeys = [...northwestMap.rows.join('')].map((c) => northwestMap.legend[c]);
  assert.ok(northwestTileKeys.includes('mountainCache'), 'northwest must have a mountainCache gate');
  assert.equal(TILES.mountainCache.requiresTool, 'miningPick');
  assert.equal(TILES.mountainCache.hasReward, true);

  const northTileKeys = [...northMap.rows.join('')].map((c) => northMap.legend[c]);
  assert.ok(northTileKeys.includes('thicketCache'), 'north must have a thicketCache gate');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `TILES.mountain` etc. don't exist yet, and none of the 4 screens have the new legend characters yet.

- [ ] **Step 3: Add the four tile types to `js/tiles.js`**

Change:

```js
  questBoard: { emoji: '📋', walkable: true, encounter: false, action: 'enterQuestBoard' },
};
```

to:

```js
  questBoard: { emoji: '📋', walkable: true, encounter: false, action: 'enterQuestBoard' },
  mountain: { emoji: '⛰️', walkable: false, encounter: false, requiresTool: 'miningPick' },
  mountainCache: { emoji: '⛰️', walkable: false, encounter: false, requiresTool: 'miningPick', hasReward: true },
  thicket: { emoji: '🌳', walkable: false, encounter: false, requiresTool: 'axe' },
  thicketCache: { emoji: '🌳', walkable: false, encounter: false, requiresTool: 'axe', hasReward: true },
};
```

- [ ] **Step 4: Place the `east.js` mountain gate (through-shortcut)**

Change the `LEGEND` object:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };
```

to:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water', M: 'mountain' };
```

Change the row at array index 10 (the 11th entry in `ROWS`) from:

```js
  '...##...##.....~~~~~~........#',
```

to:

```js
  '...MM...##.....~~~~~~........#',
```

This opens both columns of an existing 2-tile-wide interior tree wall at y=10, connecting the open west strip (x=0-2) directly to the parallel corridor (x=5-7) — previously only reachable by detouring to y=0-2 or y=19-21. The edit only converts two `#` (tree, `walkable: false`) characters into `M` (mountain, also `walkable: false` at the base level) — no currently-walkable tile is affected, so the existing reachability test is unaffected by construction.

- [ ] **Step 5: Place the `southwest.js` thicketCache gate (dead-end reward)**

Change the `LEGEND` object:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };
```

to:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water', X: 'thicketCache' };
```

Change the row at array index 12 from:

```js
  '#...#####...~~~...#####.......',
```

to:

```js
  '#...X####...~~~...#####.......',
```

This converts only the first column of an existing 5-tile-wide tree wall at y=12. The remaining 4 columns of that wall stay solid `#`, so this is deliberately a dead-end (the player can step onto the gate tile and back out, but cannot cross the full wall) — a reward nook, not a through-passage. Same reachability reasoning as Step 4: one `#` becomes `X` (also `walkable: false`), nothing currently walkable is touched.

- [ ] **Step 6: Place the `northwest.js` mountainCache gate (dead-end reward)**

Change the `LEGEND` object:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };
```

to:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water', M: 'mountainCache' };
```

Change the row at array index 4 from:

```js
  '#.............##########......',
```

to:

```js
  '#.............M#########......',
```

Same reasoning: converts the first column of an existing 10-tile-wide tree block into a single dead-end reward tile.

- [ ] **Step 7: Place the `north.js` thicketCache gate (dead-end reward)**

Change the `LEGEND` object:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };
```

to:

```js
const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water', X: 'thicketCache' };
```

Change the row at array index 15 from:

```js
  '...###..................###...',
```

to:

```js
  '...X##..................###...',
```

Same reasoning: converts the first column of an existing 3-tile-wide left tree cluster into a single dead-end reward tile (the separate, untouched right-side `###` cluster on the same row is unaffected).

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, the new test plus the full existing suite — including, unchanged, `'every walkable tile on every wilderness screen is reachable from startPosition'` (this test iterates all 9 wilderness screens generically, so it already re-validates all 4 edited screens with zero new test code needed) and `'every wilderness screen is exactly 30x22'` (every edit preserves the original row's exact character count).

- [ ] **Step 9: Commit**

```bash
git add js/tiles.js js/maps/wilderness/east.js js/maps/wilderness/southwest.js js/maps/wilderness/northwest.js js/maps/wilderness/north.js tests/maps.test.js
git commit -m "feat: add tool-gated tile types and place four gates on the world map"
```

---

### Task 4: `state.gateRewards` in the save schema

**Files:**
- Modify: `js/state.js`
- Modify: `js/main.js:94-99` (the `questProgress` backfill block in `startGame`)
- Modify: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-3.
- Produces: every state object (fresh or loaded) has `gateRewards: {}` by default. Task 5 reads and mutates `state.gateRewards` indirectly, via Task 2's `toolGates.js` functions.

- [ ] **Step 1: Write the failing test**

In `tests/state.test.js`, change:

```js
  assert.equal(state.bossTier, 0);
  assert.equal(state.ngPlusCycle, 0);
  assert.deepEqual(state.questProgress, {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  });
});
```

to:

```js
  assert.equal(state.bossTier, 0);
  assert.equal(state.ngPlusCycle, 0);
  assert.deepEqual(state.questProgress, {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  });
  assert.deepEqual(state.gateRewards, {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `state.gateRewards` is `undefined`.

- [ ] **Step 3: Add `gateRewards` to `createNewGame()` in `js/state.js`**

Change:

```js
    questProgress: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
  };
}
```

to:

```js
    questProgress: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
    gateRewards: {},
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Backfill `state.gateRewards` for existing saves in `js/main.js`**

Change:

```js
  if (!state.questProgress) {
    state.questProgress = {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    };
  }
  renderHud();
```

to:

```js
  if (!state.questProgress) {
    state.questProgress = {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    };
  }
  if (!state.gateRewards) {
    state.gateRewards = {};
  }
  renderHud();
```

No automated test for this block (matches every backfill line above it, none of which have one either) — verify by inspection that it matches their exact shape.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/main.js tests/state.test.js
git commit -m "feat: add gateRewards to save state"
```

---

### Task 5: Wire tool-awareness into map movement

**Files:**
- Modify: `js/screens/mapScreen.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `hasRequiredTool`, `getLockedGateMessage`, `isGateRewardCollected`, `markGateRewardCollected`, `rollGateReward` from `js/systems/toolGates.js` (Task 2); `TILES.mountain`/`mountainCache`/`thicket`/`thicketCache` (Task 3, consumed transparently via the existing `tileAt()` helper — no new import needed for the tile data itself); `state.gateRewards` (Task 4).
- Produces: `mapScreen.js`'s `tryMove` becomes tool-aware; two new callbacks, `onLockedGate(message)` and `onGateReward(loot)`, added to the `callbacks` object every `mapScreen.mount()` caller must supply (only `main.js`'s `goToMap` mounts this screen, so only that call site needs updating). `main.js` gains `handleLockedGate(message)` and `handleGateReward(loot)`.

This task has no dedicated automated test for `mapScreen.js` or `main.js` — matches every other DOM/wiring change in this project's history (no test harness exists for this file class). Correctness rests on Task 2's own tests plus the manual verification in Step 5.

- [ ] **Step 1: Add the import to `js/screens/mapScreen.js`**

Change:

```js
import { hasCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance } from '../systems/miniDungeons.js';
import { resolveStepDiscovery } from '../systems/discovery.js';
```

to:

```js
import { hasCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance } from '../systems/miniDungeons.js';
import { resolveStepDiscovery } from '../systems/discovery.js';
import { hasRequiredTool, getLockedGateMessage, isGateRewardCollected, markGateRewardCollected, rollGateReward } from '../systems/toolGates.js';
```

- [ ] **Step 2: Make `tryMove`'s walkability check tool-aware**

Change:

```js
  const tile = tileAt(nx, ny);
  if (!tile || !tile.walkable) return;

  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });

  const discovery = resolveStepDiscovery(state, mapConfig, nx, ny, tile);
  if (discovery.miniDungeons) {
    Object.assign(state, { miniDungeons: discovery.miniDungeons });
  }
  if (discovery.caches) {
    Object.assign(state, { caches: discovery.caches });
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
```

to:

```js
  const tile = tileAt(nx, ny);
  if (!tile) return;
  if (!tile.walkable) {
    if (!tile.requiresTool) return;
    if (!hasRequiredTool(tile, state.inventory)) {
      callbacks.onLockedGate(getLockedGateMessage(tile.requiresTool));
      return;
    }
  }

  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });

  const discovery = resolveStepDiscovery(state, mapConfig, nx, ny, tile);
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

  if (gateReward) {
    callbacks.onGateReward(gateReward);
    return;
  }

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }
```

Note: `tile.encounter` is `false` on every gated tile (per Task 3's tile definitions), so the existing `if (tile.encounter && ...)` monster-encounter roll near the bottom of `tryMove` never fires for a gate tile — no changes needed there. `resolveStepDiscovery` (`js/systems/discovery.js`) also needs no changes: it only evaluates tiles with `encounter: true`, and returns `{ outcome: 'none' }` immediately otherwise.

- [ ] **Step 3: Add `handleLockedGate` and `handleGateReward` to `js/main.js`**

No new imports are needed for this step — `main.js` already imports `ITEMS`, `addGold`, `addItem`, and `showFlavorBanner` at the top of the file (used by `handleCacheFound` and others), and both new handlers below only need those four.

Add these two new functions directly after `handleCacheFound` (after its closing brace, before `function handleEnterMiniDungeon`):

```js
function handleLockedGate(message) {
  showFlavorBanner(message);
}

function handleGateReward(loot) {
  Object.assign(state, addGold(state, loot.gold));
  Object.assign(state, addItem(state, loot.item, 1));
  showFlavorBanner(`You clear the way and find a stash: ${loot.gold} gold and 1 ${ITEMS[loot.item].name}!`);
  persist();
  renderHud();
}
```

- [ ] **Step 4: Wire the two new callbacks into `goToMap`**

Change:

```js
function goToMap(mapId) {
  state.map = mapId;
  renderHud();
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    callbacks: {
      onMove: () => persist(),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
      onCacheFound: handleCacheFound,
      onEnterMiniDungeon: handleEnterMiniDungeon,
    },
  });
}
```

to:

```js
function goToMap(mapId) {
  state.map = mapId;
  renderHud();
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    callbacks: {
      onMove: () => persist(),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
      onCacheFound: handleCacheFound,
      onEnterMiniDungeon: handleEnterMiniDungeon,
      onLockedGate: handleLockedGate,
      onGateReward: handleGateReward,
    },
  });
}
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 6: Manual verification**

If a browser is available, run `python3 -m http.server` from the repo root, open `http://localhost:8000`, and:

- Walk to the `east` screen (from `center`'s start position, walk east — `centerMap.neighbors.east` is `'east'`). Navigate to roughly (3,10) or (4,10) and confirm you cannot walk through — the two tiles there show the mountain emoji (⛰️) and moving into them does nothing but display "You need a Mining Pick to get through here."
- Fight orc/wraith repeatedly (in the dungeon) until you get a `miningPick` or `axe` drop (25% chance each, alongside their existing material). Open Inventory and confirm a new "Tools" section shows the tool you picked up.
- Return to the same gate tile with the mining pick in inventory. Confirm you can now walk through it, and that walking through the `east` gate (a through-shortcut) actually connects both sides — you should be able to continue walking east through both mountain tiles into the corridor beyond.
- Visit one of the three reward gates (`southwest` (4,12), `northwest` (14,4), or `north` (3,15)) with the correct tool. Confirm stepping onto it grants gold + potion with a flavor message, and that visiting it again (walking off and back on) does NOT grant a second reward.
- Reload the page between steps to confirm `state.gateRewards` persists correctly.

If no browser is available (common in this environment), substitute with: (a) a hand-trace of the diff confirming `tryMove`'s new branch structure is reachable and correctly ordered (locked-gate check before the position update; reward check after state updates but before `render()`, matching the existing cache/mini-dungeon pattern), and (b) a Node `--input-type=module` script that imports the real `js/systems/toolGates.js` functions and replays: a tile with `requiresTool: 'miningPick'` and an inventory without the pick returns the correct locked message; the same tile with the pick in inventory is treated as passable; a `hasReward` tile's first crossing rolls a reward and marks it collected; a second `isGateRewardCollected` check on the same coordinates returns `true`. Write what you did and found into your report either way.

- [ ] **Step 7: Commit**

```bash
git add js/screens/mapScreen.js js/main.js
git commit -m "feat: wire tool-gated terrain into map movement"
```

---

### Task 6: Tools section in the Inventory screen

**Files:**
- Modify: `js/screens/inventoryScreen.js`

**Interfaces:**
- Consumes: `ITEMS` (already imported) — no new imports needed, `state.inventory` entries with `ITEMS[entry.itemId].type === 'tool'` (Task 1's items).
- Produces: no interface change — `mount`/`unmount` signatures are unchanged, this only adds a new read-only section to the existing render, following the exact same pattern as the Materials/Potions sections.

- [ ] **Step 1: Add `renderToolRows` to `js/screens/inventoryScreen.js`**

Change:

```js
function renderConsumableRows() {
  const consumableEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'consumable');
  if (consumableEntries.length === 0) return '<div class="inventory-empty">No potions.</div>';
  return consumableEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}
```

to:

```js
function renderConsumableRows() {
  const consumableEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'consumable');
  if (consumableEntries.length === 0) return '<div class="inventory-empty">No potions.</div>';
  return consumableEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}

function renderToolRows() {
  const toolEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'tool');
  if (toolEntries.length === 0) return '<div class="inventory-empty">No tools.</div>';
  return toolEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">${item.emoji} ${item.name}</div>`;
  }).join('');
}
```

- [ ] **Step 2: Add the new section to `render()`**

Change:

```js
      <h3>Potions</h3>
      ${renderConsumableRows()}
      <button id="btn-close-inventory">Close</button>
```

to:

```js
      <h3>Potions</h3>
      ${renderConsumableRows()}
      <h3>Tools</h3>
      ${renderToolRows()}
      <button id="btn-close-inventory">Close</button>
```

No new CSS is needed — this reuses the existing `.inventory-row`/`.inventory-empty` classes already defined in `css/styles.css` for the Materials/Potions sections.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (no test harness exists for this file, matching every other screen module).

- [ ] **Step 4: Commit**

```bash
git add js/screens/inventoryScreen.js
git commit -m "feat: show a Tools section in the inventory screen"
```

---

## Self-Review Notes

- **Spec coverage:** two tool items + monster drops (Task 1), pure tool-check/messaging/reward module (Task 2), four tile types + four hand-placed, verified-safe placements (Task 3), `gateRewards` save-schema field (Task 4), `mapScreen.js`/`main.js` wiring including the locked-gate message and one-time reward grant (Task 5), Inventory screen Tools section (Task 6), `isWalkableAt` left completely untouched (confirmed — no task modifies `js/systems/world.js`) — all covered.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code and exact, hand-verified before/after strings for every map edit.
- **Type consistency:** `hasRequiredTool(tile, inventory)`, `getLockedGateMessage(toolId)`, `isGateRewardCollected(gateRewards, screenId, x, y)`, `markGateRewardCollected(gateRewards, screenId, x, y)`, `rollGateReward(rng)` (Task 2) are consumed with identical signatures in Task 5's `mapScreen.js`. `TILES.mountain`/`mountainCache`/`thicket`/`thicketCache`'s `requiresTool`/`hasReward` fields (Task 3) are read by name in Task 5's `tryMove` exactly as defined. `onLockedGate`/`onGateReward` callback names match between Task 5's `mapScreen.js` (`callbacks.onLockedGate(...)`, `callbacks.onGateReward(...)`) and `main.js` (`onLockedGate: handleLockedGate, onGateReward: handleGateReward`). `state.gateRewards` (Task 4) is the exact field name read/written throughout Task 5.
- **Correction made during self-review:** Task 5's Step 3 originally considered adding an `ITEMS` import to `main.js`, but `main.js` already imports `ITEMS` at the top of the file (used by `handleCacheFound` and others) — the step now explicitly notes this is a no-op rather than risking a duplicate-import mistake during implementation.
