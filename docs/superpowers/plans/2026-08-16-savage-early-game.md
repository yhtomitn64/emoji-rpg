# Savage Early Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune all 9 non-boss-tier monsters' HP/attack/rewards so the whole game feels meaningfully dangerous from the first fight instead of only past level 10, while preserving (and sharpening) the existing near-town → far-corner → dungeon → dragon escalation.

**Architecture:** This is almost entirely a data change in `js/data/monsters.js` — no logic changes anywhere. Two supporting pieces: `tests/data.test.js` gets an exact-value regression test locking in the new numbers, plus a smaller structural regression check (every quest-eligible monster still has a material drop, unaffected by this change but worth locking in given how many systems now read `MONSTERS`). `scripts/simulate-balance.js` (the project's existing, real-combat-code-driven balance tool, previously scoped to only the dungeon/boss tier) gets extended to also cover the near-town and far-corner tiers, then run for real to confirm the new numbers land where the design doc says they should.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- Exact new stats (every other field — `id`, `name`, `emoji`, `dropTable`, `isBoss`, `flavorLines` — and every monster's position/ordering in the file is unchanged):

  | Monster | hp | attack | defense | speed | xp | goldRange |
  |---|---|---|---|---|---|---|
  | boar | 77 | 10 | 1 | 4 | 16 | [4, 8] |
  | bat | 55 | 9 | 0 | 7 | 11 | [2, 7] |
  | snake | 60 | 10 | 1 | 5 | 16 | [4, 9] |
  | goblin | 67 | 10 | 2 | 4 | 22 | [5, 13] |
  | direWolf | 100 | 14 | 3 | 6 | 32 | [8, 15] |
  | spider | 85 | 12 | 2 | 5 | 29 | [7, 14] |
  | dragon | 150 | 34 | 12 | 11 | 200 | [65, 100] |
  | orc | 180 | 32 | 8 | 8 | 60 | [18, 28] |
  | wraith | 170 | 32 | 4 | 11 | 63 | [18, 30] |

- These numbers were already validated by simulating real fights against the actual combat code (not estimated) — implementation should transcribe them exactly, not "improve" them.
- No changes to `calculateDamage`, starting gold, the potion economy, monster speed (already listed unchanged above), or any monster's `dropTable`.

---

### Task 1: Update monster stats and rewards in `js/data/monsters.js`

**Files:**
- Modify: `js/data/monsters.js`
- Modify: `tests/data.test.js`

**Interfaces:**
- Produces: `MONSTERS.<id>.hp/.attack/.xp/.goldRange` (and `defense` for orc/wraith, which also changes numerically despite "unchanged" meaning "same value as before" for most others — see the exact table above, defense is listed for every monster and matches today's value in every case) updated to the Global Constraints table. Task 2 reads these same fields when it extends the simulator.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/data.test.js`, anywhere after the existing `'every monster has required fields and a valid drop table'` test:

```js
test('near-town, far-corner, dungeon, and dragon monsters have the savage-early-game stats', () => {
  const expectedStats = {
    boar: { hp: 77, attack: 10, defense: 1, speed: 4, xp: 16, goldRange: [4, 8] },
    bat: { hp: 55, attack: 9, defense: 0, speed: 7, xp: 11, goldRange: [2, 7] },
    snake: { hp: 60, attack: 10, defense: 1, speed: 5, xp: 16, goldRange: [4, 9] },
    goblin: { hp: 67, attack: 10, defense: 2, speed: 4, xp: 22, goldRange: [5, 13] },
    direWolf: { hp: 100, attack: 14, defense: 3, speed: 6, xp: 32, goldRange: [8, 15] },
    spider: { hp: 85, attack: 12, defense: 2, speed: 5, xp: 29, goldRange: [7, 14] },
    dragon: { hp: 150, attack: 34, defense: 12, speed: 11, xp: 200, goldRange: [65, 100] },
    orc: { hp: 180, attack: 32, defense: 8, speed: 8, xp: 60, goldRange: [18, 28] },
    wraith: { hp: 170, attack: 32, defense: 4, speed: 11, xp: 63, goldRange: [18, 30] },
  };
  for (const [id, expected] of Object.entries(expectedStats)) {
    const monster = MONSTERS[id];
    assert.equal(monster.hp, expected.hp, `${id} hp`);
    assert.equal(monster.attack, expected.attack, `${id} attack`);
    assert.equal(monster.defense, expected.defense, `${id} defense`);
    assert.equal(monster.speed, expected.speed, `${id} speed`);
    assert.equal(monster.xp, expected.xp, `${id} xp`);
    assert.deepEqual(monster.goldRange, expected.goldRange, `${id} goldRange`);
  }
});
```

Also add this import to the top of `tests/data.test.js` (it isn't there yet):

```js
import { QUEST_REQUIREMENTS } from '../js/systems/quests.js';
```

And add this second test anywhere after the one above:

```js
test('every quest-eligible monster still has at least one material drop', () => {
  for (const monsterId of Object.keys(QUEST_REQUIREMENTS)) {
    const monster = MONSTERS[monsterId];
    const hasMaterial = (monster.dropTable || []).some((entry) => ITEMS[entry.itemId].type === 'material');
    assert.ok(hasMaterial, `${monsterId} has no material-type drop entry`);
  }
});
```

(This second test passes both before and after this task's changes, since `dropTable` isn't touched — it's a regression lock, not something this task is expected to make go from failing to passing. The first test is the real red/green check.)

- [ ] **Step 2: Run tests to verify the first one fails**

Run: `npm test`
Expected: The `'near-town, far-corner, dungeon, and dragon monsters have the savage-early-game stats'` test FAILS (current data still has the old numbers, e.g. `boar.hp` is `17`, not `77`). The `'every quest-eligible monster still has at least one material drop'` test PASSES already (expected, per the note above) — that's not a bug.

- [ ] **Step 3: Update `js/data/monsters.js`**

Replace the entire contents of `js/data/monsters.js` with:

```js
export const MONSTERS = {
  boar: {
    id: 'boar', name: 'Snorty McPigface', emoji: '🐗',
    hp: 77, attack: 10, defense: 1, speed: 4,
    xp: 16, goldRange: [4, 8],
    dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }],
  },
  bat: {
    id: 'bat', name: 'Spooky Pancake', emoji: '🦇',
    hp: 55, attack: 9, defense: 0, speed: 7,
    xp: 11, goldRange: [2, 7],
    dropTable: [{ itemId: 'batWing', chance: 0.25 }],
  },
  snake: {
    id: 'snake', name: 'Slippery Breadstick', emoji: '🐍',
    hp: 60, attack: 10, defense: 1, speed: 5,
    xp: 16, goldRange: [4, 9],
    dropTable: [{ itemId: 'snakeFang', chance: 0.25 }],
  },
  goblin: {
    id: 'goblin', name: 'Mean Meatball', emoji: '👺',
    hp: 67, attack: 10, defense: 2, speed: 4,
    xp: 22, goldRange: [5, 13],
    dropTable: [
      { itemId: 'goblinClub', chance: 0.15 },
      { itemId: 'ironScrap', chance: 0.2 },
    ],
  },
  direWolf: {
    id: 'direWolf', name: 'Mega Muffin', emoji: '🐺',
    hp: 100, attack: 14, defense: 3, speed: 6,
    xp: 32, goldRange: [8, 15],
    dropTable: [{ itemId: 'wolfPelt', chance: 0.3 }],
  },
  spider: {
    id: 'spider', name: 'Eight-Leg Eggroll', emoji: '🕷️',
    hp: 85, attack: 12, defense: 2, speed: 5,
    xp: 29, goldRange: [7, 14],
    dropTable: [{ itemId: 'spiderSilk', chance: 0.3 }],
  },
  dragon: {
    id: 'dragon', name: 'Dragon', emoji: '🐉',
    hp: 150, attack: 34, defense: 12, speed: 11,
    xp: 200, goldRange: [65, 100],
    dropTable: [
      { itemId: 'dragonScaleMail', chance: 0.6 },
      { itemId: 'dragonFang', chance: 0.4 },
    ],
    isBoss: true,
  },
  // Dungeon tier. Attack is deliberately set well above the ~19-22 defense a
  // player reaches with the full iron shop set, so stacking cheap defense no
  // longer drops these to the calculateDamage 1-point floor. See
  // scripts/simulate-balance.js for the tuning evidence.
  orc: {
    id: 'orc', name: 'Super Mean Meatloaf', emoji: '👹',
    hp: 180, attack: 32, defense: 8, speed: 8,
    xp: 60, goldRange: [18, 28],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }],
    // Optional field: dungeon-tier only. ~35% chance to replace generic "A wild X appears!" (see pickAppearLine in js/systems/combat.js).
    flavorLines: [
      'You smell burnt garlic bread. Super Mean Meatloaf has entered the room.',
      'Super Mean Meatloaf lumbers out of the shadows, still steaming with rage.',
      'Super Mean Meatloaf glares at you like you insulted its secret recipe.',
    ],
  },
  wraith: {
    id: 'wraith', name: 'Ghost Apple Supreme', emoji: '👻',
    hp: 170, attack: 32, defense: 4, speed: 11,
    xp: 63, goldRange: [18, 30],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }],
    flavorLines: [
      'A chill rolls in. Ghost Apple Supreme has come for seconds.',
      'Ghost Apple Supreme drifts through the wall, unnervingly translucent and smelling faintly of cinnamon.',
      'Ghost Apple Supreme rattles its core ominously.',
    ],
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, both new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/data/monsters.js tests/data.test.js
git commit -m "feat: retune monster stats and rewards for a harder early-to-late game"
```

---

### Task 2: Extend `scripts/simulate-balance.js` to cover the full monster roster

**Files:**
- Modify: `scripts/simulate-balance.js`

**Interfaces:**
- Consumes: the new `MONSTERS` data from Task 1 (this script imports `MONSTERS` directly, no changes needed there — it always reads live).
- Produces: `MATCHUPS` now lists all 9 monster ids instead of 3; `BUILDS` gains two new low-level entries. No other script consumes this file's exports (it's a standalone CLI tool, not imported anywhere), so nothing else needs updating.

This script is intentionally not part of `npm test` (see its own file-header comment) — it's a manual balance-reporting tool. This task's "test" is running it and reading the output, not an automated assertion.

- [ ] **Step 1: Add two new low-level builds**

Change:

```js
const BUILDS = [
  // Rushed the dungeon: barely bought anything, just the free starting sword
  // and the cheapest hat. This is the "under-prepared arrival".
  makeBuild({
    name: 'rushed L6 (starter sword + cloth cap)',
```

to:

```js
const BUILDS = [
  // Near-town tier baseline for the savage-early-game rework: the cheapest
  // armor piece a level-1 character can actually afford (clothTunic spends
  // the entire 20g starting purse).
  makeBuild({
    name: 'L1 (starter sword + cloth tunic)',
    level: 1,
    equipment: { weapon: 'starterSword', body: 'clothTunic' },
    potions: 2,
  }),
  // Far-corner tier baseline: a couple levels and a second cloth piece in.
  makeBuild({
    name: 'L4 (starter sword + cloth tunic + cloth cap)',
    level: 4,
    equipment: { weapon: 'starterSword', body: 'clothTunic', head: 'clothCap' },
    potions: 3,
  }),
  // Rushed the dungeon: barely bought anything, just the free starting sword
  // and the cheapest hat. This is the "under-prepared arrival".
  makeBuild({
    name: 'rushed L6 (starter sword + cloth cap)',
```

(This inserts the two new builds at the front of the array, before the existing `rushed L6` entry — every other existing build entry is unchanged, just shifted down in the array.)

- [ ] **Step 2: Extend `MATCHUPS` to the full roster**

Change:

```js
const MATCHUPS = ['orc', 'wraith', 'dragon'];
```

to:

```js
const MATCHUPS = ['boar', 'bat', 'snake', 'goblin', 'direWolf', 'spider', 'orc', 'wraith', 'dragon'];
```

- [ ] **Step 3: Run the extended simulator**

Run: `node scripts/simulate-balance.js`

This now prints a full cross-product — every build against every one of the 9 monsters (63 rows). Most rows won't be interesting (e.g. `veteran L11 (full iron)` vs `boar` will show a near-total stomp — that's expected and fine, not a bug to fix). Focus on these specific rows, which are the ones the design doc's numbers were validated against:

- `L1 (starter sword + cloth tunic)` vs `boar`/`bat`/`snake`/`goblin` — expect roughly 56-83% win rate, 18-35% HP left on win, close to the full 2 starting potions used.
- `L4 (starter sword + cloth tunic + cloth cap)` vs `direWolf`/`spider` — expect 100% win rate, roughly 54-62% HP left, low potion use.
- `prepared L9 (full iron)` vs `orc`/`wraith` — expect 100% win rate, roughly 48-50% HP left.
- `prepared L9 (full iron)` vs `dragon` — expect roughly 87% win rate, roughly 20% HP left, most/all of the 6 potions used.
- `veteran L11 (full iron)` vs `dragon` — expect 100% win rate, roughly 46% HP left.

If the real run's numbers drift meaningfully from these (the design doc's own validation used the exact same formula this script implements, so they should match closely, but confirm rather than assume) — that's a signal worth flagging in your task report, not something to silently "fix" by changing `js/data/monsters.js` again without checking with the human first, since Task 1's numbers are the approved spec.

- [ ] **Step 4: Commit**

```bash
git add scripts/simulate-balance.js
git commit -m "feat: extend the balance simulator to cover the full monster roster"
```

---

## Self-Review Notes

- **Spec coverage:** exact stat table for all 9 monsters (Task 1, tested), reward scaling (same table, same test), quest material-drop regression (Task 1's second test), simulator extended to the full roster for future use (Task 2), final numbers re-confirmed via a real run (Task 2 Step 3) — all covered. The design doc's "no changes to `calculateDamage`/starting gold/potion economy/speed/dropTable" non-goals are satisfied by omission — nothing in either task touches those.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code and the exact validated numbers, not estimates.
- **Type consistency:** The stat table in Global Constraints, Task 1's test, Task 1's `monsters.js` replacement, and Task 2's expected-output notes all use the identical numbers for all 9 monsters — cross-checked line by line while writing this plan.
