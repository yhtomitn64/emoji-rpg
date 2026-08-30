# Bigger, Mixed Monster Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the monster-group size ceiling from 3 to 6, mix species within a group instead of always-identical copies, and add two independent escalation pressures (NG+ cycle, time spent wandering zone-1 screens this cycle) that push group size and NG+-only spawn frequency toward that ceiling.

**Architecture:** All new logic lives in the existing pure module `js/systems/groupEncounters.js` (size/chance formulas, mixed-species rolling) plus a small amount of state plumbing (`state.zone1Steps`, incremented in `js/screens/mapScreen.js`'s `tryMove`). No new files, no new systems module - this is a rework of one existing module and its two call sites.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict`, jsdom for DOM tests (see `tests/helpers/dom.js`).

**Spec:** `docs/superpowers/specs/2026-08-30-bigger-mixed-monster-groups-design.md`

## Global Constraints

- `GROUP_SPAWN_KILL_THRESHOLD = 10` stays unchanged - the per-species lifetime-kill gate is untouched by this build.
- `GROUP_SIZE_MIN = 2` stays unchanged.
- Baseline group-size max moves from 3 to 4 (`GROUP_SIZE_MAX_BASE = 4`); the hard ceiling everywhere is 6 (`GROUP_SIZE_MAX_CAP = 6`).
- Escalation is additive and stacks: `effectiveGroupSizeMax = min(6, 4 + ngPlusCycle + floor(zone1Steps / 300))`.
- `GROUP_SPAWN_CHANCE` (base 0.3) rises by `+0.1` per NG+ cycle - NG+ raises frequency, zone-1 lingering only raises size.
- Every group slot beyond the seed monster is independently rolled from that screen's own `monsterTable` (can repeat, can re-roll the seed species) - never a weighted/guaranteed-majority seed species.
- `state.zone1Steps` increments by 1 per tile-move while the current screen is one of the 24 wilderness screens (everything under `js/maps/wilderness/` except `center`, which is the town screen and has `monsterTable: []`) - never on town, the boss dungeon, or a mini-dungeon.
- `state.zone1Steps` resets to 0 only on an NG+ transition (`resetWorldForNgPlus`), never on death/flee/any other event.
- Elite and boss encounters are untouched - both already bypass `rollEncounterGroup` entirely (see `js/screens/mapScreen.js`'s `rollEliteEncounter()` branch and the dedicated boss-battle tile action) and stay that way.

---

### Task 1: `groupEncounters.js` — size/chance scaling and mixed-species rolling

**Files:**
- Modify: `js/systems/groupEncounters.js`
- Test: `tests/groupEncounters.test.js`

**Interfaces:**
- Produces: `GROUP_SPAWN_KILL_THRESHOLD` (unchanged, still 10), `GROUP_SPAWN_CHANCE_BASE` (0.3), `GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE` (0.1), `GROUP_SIZE_MIN` (unchanged, still 2), `GROUP_SIZE_MAX_BASE` (4), `GROUP_SIZE_MAX_CAP` (6), `ZONE1_STEPS_PER_SIZE_ESCALATION` (300) - all named exports.
- Produces: `groupSpawnChance(ngPlusCycle) -> number`, `effectiveGroupSizeMax(ngPlusCycle, zone1Steps) -> number`, `incrementKillCount(killCounts, monsterId) -> object` (unchanged from today), `rollEncounterGroup(monsterId, killCounts, monsterTable, ngPlusCycle, zone1Steps, rng = Math.random) -> string[]`.
- Consumes: nothing from other tasks - this is the first task and the foundation the others build on.
- `GROUP_SIZE_MAX` (the old single constant) is removed - Task 3's `mapScreen.js` changes are the only other place that touches this module, and they land after this task.

- [ ] **Step 1: Write the failing tests for `groupSpawnChance` and `effectiveGroupSizeMax`**

Add to `tests/groupEncounters.test.js` (new tests, alongside the existing ones - don't remove anything yet):

```js
import {
  GROUP_SPAWN_KILL_THRESHOLD, GROUP_SPAWN_CHANCE_BASE, GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE,
  GROUP_SIZE_MIN, GROUP_SIZE_MAX_BASE, GROUP_SIZE_MAX_CAP, ZONE1_STEPS_PER_SIZE_ESCALATION,
  incrementKillCount, rollEncounterGroup, groupSpawnChance, effectiveGroupSizeMax,
} from '../js/systems/groupEncounters.js';

test('groupSpawnChance is the base chance at NG+ cycle 0', () => {
  assert.equal(groupSpawnChance(0), GROUP_SPAWN_CHANCE_BASE);
});

test('groupSpawnChance rises by GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE per NG+ cycle', () => {
  assert.equal(groupSpawnChance(1), GROUP_SPAWN_CHANCE_BASE + GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE);
  assert.equal(groupSpawnChance(2), GROUP_SPAWN_CHANCE_BASE + GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE * 2);
});

test('effectiveGroupSizeMax is the base max at NG+ cycle 0 with no zone-1 steps', () => {
  assert.equal(effectiveGroupSizeMax(0, 0), GROUP_SIZE_MAX_BASE);
});

test('effectiveGroupSizeMax rises by 1 per NG+ cycle', () => {
  assert.equal(effectiveGroupSizeMax(1, 0), GROUP_SIZE_MAX_BASE + 1);
  assert.equal(effectiveGroupSizeMax(2, 0), GROUP_SIZE_MAX_BASE + 2);
});

test('effectiveGroupSizeMax rises by 1 per ZONE1_STEPS_PER_SIZE_ESCALATION steps, floored', () => {
  assert.equal(effectiveGroupSizeMax(0, ZONE1_STEPS_PER_SIZE_ESCALATION - 1), GROUP_SIZE_MAX_BASE);
  assert.equal(effectiveGroupSizeMax(0, ZONE1_STEPS_PER_SIZE_ESCALATION), GROUP_SIZE_MAX_BASE + 1);
  assert.equal(effectiveGroupSizeMax(0, ZONE1_STEPS_PER_SIZE_ESCALATION * 2), GROUP_SIZE_MAX_BASE + 2);
});

test('effectiveGroupSizeMax stacks NG+ cycle and zone-1 steps additively', () => {
  assert.equal(effectiveGroupSizeMax(1, ZONE1_STEPS_PER_SIZE_ESCALATION), GROUP_SIZE_MAX_BASE + 1 + 1);
});

test('effectiveGroupSizeMax never exceeds GROUP_SIZE_MAX_CAP even with both escalations maxed', () => {
  assert.equal(effectiveGroupSizeMax(2, ZONE1_STEPS_PER_SIZE_ESCALATION * 10), GROUP_SIZE_MAX_CAP);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test 2>&1 | grep -A 5 "groupSpawnChance\|effectiveGroupSizeMax"`
Expected: FAIL - `groupSpawnChance`/`effectiveGroupSizeMax` are not exported (import error) or undefined.

- [ ] **Step 3: Write the failing tests for `rollEncounterGroup`'s new signature and mixed-species output**

Replace the existing `rollEncounterGroup`-related tests in `tests/groupEncounters.test.js` (the ones currently importing `GROUP_SPAWN_CHANCE`/`GROUP_SIZE_MAX`) with:

```js
test('rollEncounterGroup returns a 1-element array below the kill threshold, regardless of rng', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD - 1 };
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a 1-element array at threshold when the chance roll misses', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([groupSpawnChance(0), 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a group at threshold when the chance roll hits', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([0, 0, 0]));
  const max = effectiveGroupSizeMax(0, 0);
  assert.ok(result.length >= GROUP_SIZE_MIN && result.length <= max);
  assert.ok(result.every((id) => id === 'boar'), 'a single-species monsterTable should only ever produce that species');
});

test('rollEncounterGroup can produce the minimum group size', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  // rng sequence: chance roll (hits), size roll (0 -> GROUP_SIZE_MIN), one pick for the one extra slot.
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([0, 0, 0]));
  assert.equal(result.length, GROUP_SIZE_MIN);
});

test('rollEncounterGroup can produce the effective maximum group size', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const max = effectiveGroupSizeMax(0, 0);
  // rng sequence: chance roll (hits), size roll (0.999 -> max), one pick per extra slot (max - 1 of them).
  const rng = fixedRng([0, 0.999, ...Array(max - 1).fill(0)]);
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, rng);
  assert.equal(result.length, max);
});

test('rollEncounterGroup treats an unseen monster id as 0 kills (never groups)', () => {
  const result = rollEncounterGroup('boar', {}, ['boar'], 0, 0, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup defaults to Math.random when no rng is passed', () => {
  const result = rollEncounterGroup('boar', { boar: 0 }, ['boar'], 0, 0);
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup mixes species: extra slots are independently rolled from monsterTable, not all copies of the seed', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const monsterTable = ['boar', 'bat', 'snake'];
  // chance roll hits (0 < 0.3), size roll 0.999 -> effectiveGroupSizeMax(0,0) = 4,
  // then 3 picks into a 3-species table: index 0 ('boar'), index 1 ('bat'), index 2 ('snake').
  const rng = fixedRng([0, 0.999, 0, 0.4, 0.7]);
  const result = rollEncounterGroup('boar', killCounts, monsterTable, 0, 0, rng);
  assert.equal(result.length, 4);
  assert.equal(result[0], 'boar', 'the seed monster is always first');
  assert.ok(result.includes('bat') && result.includes('snake'), 'expected a genuine mix, not four copies of the seed');
});

test('rollEncounterGroup scales the effective max with ngPlusCycle and zone1Steps, not just the base', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const ngPlusCycle = 2;
  const zone1Steps = 0;
  const max = effectiveGroupSizeMax(ngPlusCycle, zone1Steps);
  const rng = fixedRng([0, 0.999, ...Array(max - 1).fill(0)]);
  const result = rollEncounterGroup('boar', killCounts, ['boar'], ngPlusCycle, zone1Steps, rng);
  assert.equal(result.length, max);
  assert.ok(max > GROUP_SIZE_MAX_BASE, 'sanity check: NG+ cycle 2 should actually raise the max above the base');
});
```

Remove the old `GROUP_SPAWN_CHANCE`/`GROUP_SIZE_MAX` named imports from the top of the file (replaced by `GROUP_SPAWN_CHANCE_BASE`/`GROUP_SIZE_MAX_BASE`/`GROUP_SIZE_MAX_CAP`/`groupSpawnChance`/`effectiveGroupSizeMax` as shown above).

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm run test 2>&1 | grep -A 5 "rollEncounterGroup"`
Expected: FAIL - `rollEncounterGroup` still has the old 3-argument signature, so calls with 6 arguments either throw or silently ignore the extra ones and produce single-species results.

- [ ] **Step 5: Rewrite `js/systems/groupEncounters.js`**

Replace the entire file with:

```js
export const GROUP_SPAWN_KILL_THRESHOLD = 10;
export const GROUP_SPAWN_CHANCE_BASE = 0.3;
export const GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE = 0.1;
export const GROUP_SIZE_MIN = 2;
export const GROUP_SIZE_MAX_BASE = 4;
export const GROUP_SIZE_MAX_CAP = 6;
export const ZONE1_STEPS_PER_SIZE_ESCALATION = 300;

export function incrementKillCount(killCounts, monsterId) {
  return { ...killCounts, [monsterId]: (killCounts[monsterId] || 0) + 1 };
}

// NG+ raises how *often* a group spawns at all, not just how big one is -
// zone-1 lingering (effectiveGroupSizeMax below) only ever raises size.
export function groupSpawnChance(ngPlusCycle) {
  return GROUP_SPAWN_CHANCE_BASE + ngPlusCycle * GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE;
}

// Two independent, additive escalation pressures toward the same hard cap:
// NG+ cycle (persists until the next cycle) and steps taken on a zone-1
// wilderness screen this cycle (js/screens/mapScreen.js's tryMove, reset on
// NG+ transition - see js/systems/ngPlus.js's resetWorldForNgPlus). A
// player who lingers in zone-1 long enough can reach the max group size
// even at NG+ cycle 0.
export function effectiveGroupSizeMax(ngPlusCycle, zone1Steps) {
  const escalation = ngPlusCycle + Math.floor(zone1Steps / ZONE1_STEPS_PER_SIZE_ESCALATION);
  return Math.min(GROUP_SIZE_MAX_CAP, GROUP_SIZE_MAX_BASE + escalation);
}

// monsterId is the seed species (already rolled by the caller, js/screens/
// mapScreen.js's tryMove, from the same monsterTable passed in here) - it's
// always the first element of a rolled group. Every slot beyond it is
// independently rolled from monsterTable too, so a group can be a genuine
// mix of species, not always-identical copies of the seed.
export function rollEncounterGroup(monsterId, killCounts, monsterTable, ngPlusCycle, zone1Steps, rng = Math.random) {
  const kills = killCounts[monsterId] || 0;
  if (kills < GROUP_SPAWN_KILL_THRESHOLD || rng() >= groupSpawnChance(ngPlusCycle)) {
    return [monsterId];
  }
  const max = effectiveGroupSizeMax(ngPlusCycle, zone1Steps);
  const size = GROUP_SIZE_MIN + Math.floor(rng() * (max - GROUP_SIZE_MIN + 1));
  return [monsterId, ...Array.from({ length: size - 1 }, () => monsterTable[Math.floor(rng() * monsterTable.length)])];
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test 2>&1 | grep -E "not ok|# (tests|pass|fail)"`
Expected: all tests pass, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add js/systems/groupEncounters.js tests/groupEncounters.test.js
git commit -m "feat: raise group-size cap to 6, mix species, scale with NG+/zone-1 lingering"
```

---

### Task 2: `zone1Steps` state plumbing

**Files:**
- Modify: `js/state.js`
- Modify: `js/systems/ngPlus.js`
- Modify: `js/main.js`
- Test: `tests/state.test.js`
- Test: `tests/ngPlus.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `state.zone1Steps` (a number, defaults to 0) - Task 3 reads and increments this field.

- [ ] **Step 1: Write the failing test for `createNewGame`**

Add to `tests/state.test.js`, near the existing `createNewGame` tests:

```js
test('createNewGame starts zone1Steps at 0', () => {
  const state = createNewGame();
  assert.equal(state.zone1Steps, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test 2>&1 | grep -A 5 "zone1Steps at 0"`
Expected: FAIL - `state.zone1Steps` is `undefined`, not `0`.

- [ ] **Step 3: Add `zone1Steps: 0` to `createNewGame`**

In `js/state.js`, inside `createNewGame`'s returned object, add the field (alongside `lossStreak: 0` reads well as a neighbor):

```js
    lossStreak: 0,
    encounterCooldown: 0,
    zone1Steps: 0,
    dungeonEntrancePosition,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test 2>&1 | grep -A 5 "zone1Steps at 0"`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `resetWorldForNgPlus`**

Add to `tests/ngPlus.test.js`, near the existing `resetWorldForNgPlus` tests (the ones asserting `lossStreak`/`ngPlusCycle` reset):

```js
test('resetWorldForNgPlus resets zone1Steps to 0', () => {
  const state = createNewGame();
  state.zone1Steps = 1234;
  const reset = resetWorldForNgPlus(state);
  assert.equal(reset.zone1Steps, 0);
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test 2>&1 | grep -A 5 "resets zone1Steps"`
Expected: FAIL - `reset.zone1Steps` is still `1234` (not reset).

- [ ] **Step 7: Add `zone1Steps: 0` to `resetWorldForNgPlus`'s returned object**

In `js/systems/ngPlus.js`, inside `resetWorldForNgPlus`'s returned object (alongside `lossStreak: 0`):

```js
    lossStreak: 0,
    zone1Steps: 0,
    ngPlusCycle: Math.min(state.ngPlusCycle + 1, MAX_NG_PLUS_CYCLE),
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test 2>&1 | grep -A 5 "resets zone1Steps"`
Expected: PASS.

- [ ] **Step 9: Add the legacy-save migration in `js/main.js`**

No test for this step specifically (it only matters for a save file predating this field, which `createNewGame` in tests never produces) - but it's required for real existing saves. In `js/main.js`'s `startGame`, alongside the existing `if (!state.monsterKillCounts) { ... }` / `if (!state.gateRewards) { ... }` backfill block:

```js
  if (!state.zone1Steps) {
    state.zone1Steps = 0;
  }
```

- [ ] **Step 10: Run the full suite to make sure nothing else broke**

Run: `npm run test 2>&1 | grep -E "not ok|# (tests|pass|fail)"`
Expected: all tests pass, 0 failures.

- [ ] **Step 11: Commit**

```bash
git add js/state.js js/systems/ngPlus.js js/main.js tests/state.test.js tests/ngPlus.test.js
git commit -m "feat: add zone1Steps state field, reset on NG+ transition"
```

---

### Task 3: `mapScreen.js` — track zone-1 steps and roll mixed groups

**Files:**
- Modify: `js/screens/mapScreen.js`
- Test: `tests/mapScreenDom.test.js`

**Interfaces:**
- Consumes: `rollEncounterGroup(monsterId, killCounts, monsterTable, ngPlusCycle, zone1Steps, rng)` from Task 1; `state.zone1Steps` from Task 2.
- Produces: nothing further downstream - this is the last functional task.

- [ ] **Step 1: Write the failing test for zone-1 step tracking**

Add to `tests/mapScreenDom.test.js` (new `test(...)` block, following the existing file's `setupDom`/`teardownDom` pattern):

```js
test('mapScreen DOM - zone-1 step tracking', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a step on a zone-1 wilderness screen increments state.zone1Steps', async () => {
    const northScreen = {
      id: 'north',
      legend: { '.': 'grass' },
      rows: ['...', '...', '...'],
      neighbors: {},
      monsterTable: [],
      encounterChance: 0,
      cacheChance: 0,
    };
    const maps = { north: northScreen };
    const worldGrid = buildWorldGrid(maps);
    const state = baseState({ position: { x: 1, y: 1 } });
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      state, mapConfig: northScreen, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {},
      },
    });
    assert.equal(state.zone1Steps, 0);
    keydown('ArrowRight');
    assert.equal(state.zone1Steps, 1);
  });

  await t.test('a step on the town screen does not increment state.zone1Steps', async () => {
    const centerScreen = {
      id: 'center',
      legend: { '.': 'grass' },
      rows: ['...', '...', '...'],
      neighbors: {},
      monsterTable: [],
      encounterChance: 0,
      cacheChance: 0,
    };
    const maps = { center: centerScreen };
    const worldGrid = buildWorldGrid(maps);
    const state = baseState({ position: { x: 1, y: 1 } });
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      state, mapConfig: centerScreen, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {},
      },
    });
    keydown('ArrowRight');
    assert.equal(state.zone1Steps, 0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test 2>&1 | grep -A 8 "zone-1 step tracking"`
Expected: FAIL on the first test (`state.zone1Steps` stays `0` after the move - nothing increments it yet). The second test passes vacuously (already 0), which is fine at this stage.

- [ ] **Step 3: Add the zone-1 id set and increment `tryMove`**

In `js/screens/mapScreen.js`, add a module-level constant near the top of the file (alongside the other module-level constants like `KEY_TO_DELTA`):

```js
// No "zone" concept exists in the map registry (js/main.js's MAPS object is
// a flat list) - this is the explicit list of the 24 wilderness screens
// ("zone 1"), deliberately excluding center (the town screen itself,
// monsterTable: [], no encounters ever roll there) and every dungeon/
// mini-dungeon. Used only to decide whether a step counts toward
// state.zone1Steps (js/systems/groupEncounters.js's effectiveGroupSizeMax
// escalation) - see docs/superpowers/specs/2026-08-30-bigger-mixed-monster-
// groups-design.md.
const ZONE1_WILDERNESS_MAP_IDS = new Set([
  'north', 'south', 'east', 'west',
  'northeast', 'northwest', 'southeast', 'southwest',
  'farNorthwest', 'northNorthwest', 'farNorth', 'northNortheast', 'farNortheast',
  'westNorthwest', 'farWest', 'westSouthwest',
  'eastNortheast', 'farEast', 'eastSoutheast',
  'southSouthwest', 'farSouth', 'southSoutheast',
  'farSouthwest', 'farSoutheast',
]);
```

Then in `tryMove`, right after the block that swaps the current screen (so `state.map` already reflects whichever screen the step actually landed on, whether or not this step crossed a boundary):

```js
  if (screenConfig.id !== mapConfig.id) {
    mapConfig = screenConfig;
    state.map = screenConfig.id;
    announceScreenIfNew(screenConfig);
  }

  if (ZONE1_WILDERNESS_MAP_IDS.has(state.map)) {
    state.zone1Steps = (state.zone1Steps || 0) + 1;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test 2>&1 | grep -A 8 "zone-1 step tracking"`
Expected: both PASS.

- [ ] **Step 5: Write the failing test for the mixed-group encounter roll wiring**

Add to `tests/mapScreenDom.test.js` (this exercises the actual call-site change, using a forced encounter so the test is deterministic):

```js
test('mapScreen DOM - group encounter roll passes monsterTable/ngPlusCycle/zone1Steps through', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a forced encounter past the kill threshold can roll a mixed-species group', async () => {
    const originalRandom = Math.random;
    // Verified against a real run of this exact scenario (not just read from
    // source) - js/screens/mapScreen.js's tryMove makes/triggers Math.random()
    // calls in this exact order for one step onto a tile with tile.encounter
    // true: (1) js/systems/discovery.js's resolveStepDiscovery, mini-dungeon
    // check (mapConfig.miniDungeonChance is undefined below, so this always
    // misses regardless of the value rolled - still consumes one call), (2)
    // resolveStepDiscovery's cache check (cacheChance: 0 below, same deal -
    // always misses, still consumes one call), (3) the encounterChance roll
    // (must be < 1), (4) rollEliteEncounter's own roll
    // (js/systems/eliteEncounter.js, ELITE_ENCOUNTER_CHANCE = 0.05 - must
    // roll >= 0.05 to miss), (5) picking monsterId out of monsterTable
    // (floor(val * 3) into ['boar','bat','snake'] - 0.01 -> index 0, 'boar'),
    // then js/systems/groupEncounters.js's own rollEncounterGroup takes over:
    // (6) the group-spawn-chance roll (must be < 0.3 to hit), (7) the size
    // roll (0.99 -> the effective max, 4, since effectiveGroupSizeMax(0, 0)
    // = GROUP_SIZE_MAX_BASE = 4), then (8)-(10) one species pick per of the
    // 3 extra slots - 0.01/0.4/0.7 into the same 3-species table picks index
    // 0/1/2 ('boar'/'bat'/'snake'). Confirmed this sequence actually produces
    // ['boar', 'boar', 'bat', 'snake'] against Task 1 + this task's own
    // call-site change, both applied.
    const sequence = [0.5, 0.5, 0.01, 0.99, 0.01, 0.01, 0.99, 0.01, 0.4, 0.7];
    let i = 0;
    Math.random = () => sequence[Math.min(i++, sequence.length - 1)];
    try {
      const northScreen = {
        id: 'north',
        legend: { '.': 'grass' },
        rows: ['...', '...', '...'],
        neighbors: {},
        monsterTable: ['boar', 'bat', 'snake'],
        encounterChance: 1,
        cacheChance: 0,
      };
      const maps = { north: northScreen };
      const worldGrid = buildWorldGrid(maps);
      const state = baseState({
        position: { x: 0, y: 1 },
        monsterKillCounts: { boar: 10, bat: 10, snake: 10 },
      });
      const { mount } = await import('../js/screens/mapScreen.js');
      const root = createRoot();
      let encounteredIds = null;
      mount(root, {
        state, mapConfig: northScreen, maps, worldGrid,
        callbacks: {
          onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
          onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
          onGateReward: () => {}, onEncounter: (ids) => { encounteredIds = ids; },
        },
      });
      keydown('ArrowRight');
      assert.ok(encounteredIds, 'expected an encounter to fire');
      assert.ok(encounteredIds.length > 1, 'expected a group, not a solo encounter');
    } finally {
      Math.random = originalRandom;
    }
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test 2>&1 | grep -A 8 "mixed-species group"`
Expected: FAIL - either an error (old `rollEncounterGroup` signature ignores the extra args and never mixes) or `encounteredIds.length` is 1, since `tryMove` still calls the old 2-argument form.

- [ ] **Step 7: Update the call site in `tryMove`**

In `js/screens/mapScreen.js`, find:

```js
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts);
```

Replace with:

```js
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts, mapConfig.monsterTable, state.ngPlusCycle, state.zone1Steps);
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test 2>&1 | grep -A 8 "mixed-species group"`
Expected: PASS. If it's still failing because the rng sequence in Step 5 doesn't line up with the actual call order in this codebase's `tryMove`/`rollEliteEncounter`, add a `console.log` of each `Math.random()` call's position temporarily to confirm the real order, adjust the `sequence` array to match, and re-run - the test's intent (force a mixed group deterministically) is what matters, not the exact sequence values above.

- [ ] **Step 9: Run the full suite**

Run: `npm run test 2>&1 | grep -E "not ok|# (tests|pass|fail)"`
Expected: all tests pass, 0 failures.

- [ ] **Step 10: Commit**

```bash
git add js/screens/mapScreen.js tests/mapScreenDom.test.js
git commit -m "feat: track zone-1 steps, roll mixed-species groups on encounter"
```

---

### Task 4: Battle-screen 6-slot legibility check, CHANGELOG, and version bump

**Files:**
- Modify (maybe): `css/styles.css`
- Modify: `CHANGELOG.md`
- Modify: `js/data/playerChangelog.js`

**Interfaces:**
- Consumes: nothing new - this is a manual verification pass over Tasks 1-3's combined effect, plus the required per-push documentation.

This task has no failing-test cycle of its own - it's a manual check (per the spec's own "Battle-screen sizing" section: "a live check once this is wired up decides whether the gap/HP-bar width need a small reduction... not a guaranteed code change") followed by the mandatory CHANGELOG/version-bump steps this repo's own `CLAUDE.md` requires before every push.

- [ ] **Step 1: Start the app locally and trigger a 6-monster group**

Run: `npx http-server . -p 8000` (or any static file server from the repo root), open `http://localhost:8000`. Temporarily set a save's `ngPlusCycle` to 2 via the browser console (`JSON.parse(localStorage.getItem('emoji-rpg-save'))`, edit, `localStorage.setItem` back, reload) or grind a monster's kill count past 10 and get lucky with the roll, to force a 6-member group encounter.

- [ ] **Step 2: Visually confirm the battle screen stays legible at 6 slots**

Check: do the 6 monster zones wrap onto two rows inside `.overlay-panel.battle-screen`'s `max-width: min(92vw, 860px)` without overlapping each other or overflowing the dialog? Is each HP bar/name still readable?

- [ ] **Step 3: If it looks cramped, reduce `.battle-monster-row`'s gap and/or HP-bar width past a slot-count threshold**

Only if Step 2 found a real legibility problem. In `css/styles.css`, `.battle-monster-row` currently has `gap: 18px` and `.battle-monster-slot .battle-hp-bar, .battle-monster-slot .battle-atb-bar { width: 110px; }` - if six slots overlap or overflow, reduce the gap (e.g. to `10px`) and/or the bar width (e.g. to `90px`). This can't be pre-written without seeing the real result, per the spec's own note that this is a checkpoint, not a guaranteed change.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test 2>&1 | grep -E "not ok|# (tests|pass|fail)"`
Expected: all tests pass (this task's CSS-only change, if any, isn't covered by the jsdom suite - see `battleScreenDom.test.js`'s own header on why pixel-level rendering isn't in scope for it).

- [ ] **Step 5: Add the `CHANGELOG.md` entry and bump the version**

Per this repo's own `CLAUDE.md` versioning checklist: this is a completed feature/build (a finished spec under `docs/superpowers/specs/`), so it's a MINOR bump. Check `CHANGELOG.md`'s current newest version first (`grep -m1 "^## \[" CHANGELOG.md`) and bump the next MINOR above it. Add an entry under a new `## [x.y.0] - YYYY-MM-DD` section (today's date), moving anything already sitting in `## [Unreleased]` into it too if present:

```markdown
## [Unreleased]

## [x.y.0] - YYYY-MM-DD

### Added
- Monster groups can now reach up to 6 members (up from 3) and mix
  species within one group instead of always-identical copies
  (`js/systems/groupEncounters.js`).
- Two independent pressures push group size toward that cap: NG+ cycle,
  and time spent wandering zone-1 wilderness screens this cycle
  (`state.zone1Steps`, `js/screens/mapScreen.js`). NG+ also raises how
  often a group spawns at all, not just how big it is.
```

(Replace `x.y.0`/`YYYY-MM-DD` with the actual next version and today's real date - don't leave the placeholders in.)

- [ ] **Step 6: Add the matching `js/data/playerChangelog.js` entry**

Add a new entry at the top of `PLAYER_CHANGELOG` with the same version number, written for a player (no file/function names):

```js
  {
    version: 'x.y.0',
    date: 'YYYY-MM-DD',
    highlights: [
      'Monster groups can now have up to 6 members instead of 3, and can be a mix of different enemy types instead of always the same one.',
      'The longer you wander the wilds (or the deeper into New Game+ you are), the bigger and more frequent those groups get.',
    ],
  },
```

- [ ] **Step 7: Run the full test suite one more time**

Run: `npm run test 2>&1 | grep -E "not ok|# (tests|pass|fail)"`
Expected: all tests pass, including `tests/versionSync.test.js` (which fails the whole suite if `CHANGELOG.md`'s newest version and `PLAYER_CHANGELOG[0].version` don't match).

- [ ] **Step 8: Commit**

```bash
git add CHANGELOG.md js/data/playerChangelog.js css/styles.css
git commit -m "docs: changelog + version bump for bigger/mixed monster groups"
```

Do not push without the user's explicit go-ahead - per this repo's own `CLAUDE.md`, a push to `master` is the live release.

## Self-Review Notes

- **Spec coverage:** every "In scope" bullet from the design doc maps to a task above - size/chance scaling and mixed species (Task 1), the `zone1Steps` field and its reset (Task 2), the increment wiring and the `rollEncounterGroup` call-site update (Task 3), and the battle-screen legibility checkpoint (Task 4). The "Out of scope" bullets (inter-monster synergies, the visual overhaul, the kill-threshold gate, elite/boss encounters) are untouched by every task above.
- **Type consistency:** `rollEncounterGroup`'s signature (`monsterId, killCounts, monsterTable, ngPlusCycle, zone1Steps, rng`) is identical everywhere it's defined (Task 1) and called (Task 3, `mapScreen.js`). `effectiveGroupSizeMax`/`groupSpawnChance` signatures match between their Task 1 definitions and Task 1's own tests.
- **Placeholder scan:** Task 4's Step 5/6 leave `x.y.0`/`YYYY-MM-DD` as explicit fill-in-at-execution-time values (the real next version number depends on whatever's shipped between now and when this task actually runs) - flagged inline as "replace before committing," not left as an unexplained TODO.
