# Silly Monster Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename 8 monsters' display names to goofy food/object names (dragon boss untouched), and give `orc`/`wraith` a chance to show themed flavor text instead of the generic "A wild X appears!" line on battle start.

**Architecture:** Pure data change in `js/data/monsters.js` for the names and new `flavorLines` arrays. A new pure, RNG-injectable function `pickAppearLine(monster, rng)` in `js/systems/combat.js` (following the existing `calculateDamage`/`rollCrit` pattern of accepting `rng = Math.random`) decides which opening battle-log line to use; `js/screens/battleScreen.js`'s `mount()` calls it instead of inlining the template string. This keeps the new logic unit-testable without any DOM/jsdom setup, which this project doesn't have.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- No emoji changes for any monster — only `name` (and, for orc/wraith, a new `flavorLines` field) changes.
- `dragon`'s name stays "Dragon" — it is explicitly out of scope.
- Flavor-line chance is exactly 35% (`FLAVOR_LINE_CHANCE = 0.35`), only for monsters that have a `flavorLines` array.
- Names are exactly as approved in the spec table — do not improvise different names.

---

### Task 1: Rename monster display names and add orc/wraith flavor lines

**Files:**
- Modify: `js/data/monsters.js`
- Modify: `tests/data.test.js`

**Interfaces:**
- Produces: `MONSTERS.orc.flavorLines` and `MONSTERS.wraith.flavorLines` — each a non-empty array of non-empty strings. Task 2 reads this field via `pickAppearLine(monster, rng)`.

- [ ] **Step 1: Write the failing test**

Add these two assertions inside the existing `for (const [id, monster] of Object.entries(MONSTERS))` loop in `tests/data.test.js` (the loop currently ends after the `dropTable` `for` block — add the new assertions right after that inner `for` loop, still inside the outer loop):

```js
    assert.ok(typeof monster.name === 'string' && monster.name.length > 0, `${id} name`);
    if (monster.flavorLines !== undefined) {
      assert.ok(Array.isArray(monster.flavorLines) && monster.flavorLines.length > 0, `${id} flavorLines must be a non-empty array`);
      for (const line of monster.flavorLines) {
        assert.ok(typeof line === 'string' && line.length > 0, `${id} has an empty flavor line`);
      }
    }
```

The full test block should read:

```js
test('every monster has required fields and a valid drop table', () => {
  for (const [id, monster] of Object.entries(MONSTERS)) {
    assert.equal(monster.id, id);
    assert.ok(monster.hp > 0, `${id} hp`);
    assert.ok(Array.isArray(monster.goldRange) && monster.goldRange.length === 2);
    const totalChance = (monster.dropTable || []).reduce((sum, entry) => sum + entry.chance, 0);
    assert.ok(totalChance <= 1, `${id} drop table exceeds 100%`);
    for (const entry of monster.dropTable || []) {
      assert.ok(ITEMS[entry.itemId], `${id} references unknown item ${entry.itemId}`);
    }
    assert.ok(typeof monster.name === 'string' && monster.name.length > 0, `${id} name`);
    if (monster.flavorLines !== undefined) {
      assert.ok(Array.isArray(monster.flavorLines) && monster.flavorLines.length > 0, `${id} flavorLines must be a non-empty array`);
      for (const line of monster.flavorLines) {
        assert.ok(typeof line === 'string' && line.length > 0, `${id} has an empty flavor line`);
      }
    }
  }
});
```

This test already passes against the current data (names are non-empty strings, no monster has `flavorLines` yet), so there's nothing to "fail" yet for this specific assertion — the real failing check comes from a new dedicated test added in this same step:

```js
test('regular and dungeon-tier monsters have the approved silly names, dragon does not', () => {
  const expectedNames = {
    boar: 'Snorty McPigface',
    bat: 'Spooky Pancake',
    snake: 'Slippery Breadstick',
    goblin: 'Mean Meatball',
    direWolf: 'Mega Muffin',
    spider: 'Eight-Leg Eggroll',
    orc: 'Super Mean Meatloaf',
    wraith: 'Ghost Apple Supreme',
    dragon: 'Dragon',
  };
  for (const [id, expectedName] of Object.entries(expectedNames)) {
    assert.equal(MONSTERS[id].name, expectedName, `${id} name`);
  }
});
```

Add both the loop-assertion changes and this new test to `tests/data.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL on `regular and dungeon-tier monsters have the approved silly names, dragon does not` — actual names are still "Boar", "Bat", etc.

- [ ] **Step 3: Rename monsters and add flavor lines in `js/data/monsters.js`**

Replace the entire file contents with:

```js
export const MONSTERS = {
  boar: {
    id: 'boar', name: 'Snorty McPigface', emoji: '🐗',
    hp: 17, attack: 4, defense: 1, speed: 4,
    xp: 8, goldRange: [2, 5],
    dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }],
  },
  bat: {
    id: 'bat', name: 'Spooky Pancake', emoji: '🦇',
    hp: 11, attack: 3, defense: 0, speed: 7,
    xp: 6, goldRange: [1, 4],
    dropTable: [{ itemId: 'batWing', chance: 0.25 }],
  },
  snake: {
    id: 'snake', name: 'Slippery Breadstick', emoji: '🐍',
    hp: 14, attack: 5, defense: 1, speed: 5,
    xp: 9, goldRange: [2, 6],
    dropTable: [{ itemId: 'snakeFang', chance: 0.25 }],
  },
  goblin: {
    id: 'goblin', name: 'Mean Meatball', emoji: '👺',
    hp: 21, attack: 6, defense: 2, speed: 4,
    xp: 12, goldRange: [3, 8],
    dropTable: [
      { itemId: 'goblinClub', chance: 0.15 },
      { itemId: 'ironScrap', chance: 0.2 },
    ],
  },
  direWolf: {
    id: 'direWolf', name: 'Mega Muffin', emoji: '🐺',
    hp: 30, attack: 8, defense: 3, speed: 6,
    xp: 20, goldRange: [5, 10],
    dropTable: [{ itemId: 'wolfPelt', chance: 0.3 }],
  },
  spider: {
    id: 'spider', name: 'Eight-Leg Eggroll', emoji: '🕷️',
    hp: 25, attack: 7, defense: 2, speed: 5,
    xp: 18, goldRange: [4, 9],
    dropTable: [{ itemId: 'spiderSilk', chance: 0.3 }],
  },
  dragon: {
    id: 'dragon', name: 'Dragon', emoji: '🐉',
    hp: 110, attack: 34, defense: 12, speed: 11,
    xp: 150, goldRange: [50, 80],
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
    hp: 40, attack: 26, defense: 8, speed: 8,
    xp: 40, goldRange: [12, 20],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }],
    flavorLines: [
      'You smell burnt garlic bread. Super Mean Meatloaf has entered the room.',
      'Super Mean Meatloaf lumbers out of the shadows, still steaming with rage.',
      'Super Mean Meatloaf glares at you like you insulted its secret recipe.',
    ],
  },
  wraith: {
    id: 'wraith', name: 'Ghost Apple Supreme', emoji: '👻',
    hp: 38, attack: 26, defense: 4, speed: 11,
    xp: 42, goldRange: [12, 22],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }],
    flavorLines: [
      'A chill rolls in. Ghost Apple Supreme has come for seconds.',
      'Ghost Apple Supreme drifts through the wall, unnervingly translucent and smelling faintly of cinnamon.',
      'Ghost Apple Supreme rattles its core ominously.',
    ],
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, all suites including the two `data.test.js` tests.

- [ ] **Step 5: Commit**

```bash
git add js/data/monsters.js tests/data.test.js
git commit -m "feat: rename regular and dungeon-tier monsters with silly names"
```

---

### Task 2: Add `pickAppearLine` and wire it into the battle screen

**Files:**
- Modify: `js/systems/combat.js`
- Modify: `tests/combat.test.js`
- Modify: `js/screens/battleScreen.js:256`

**Interfaces:**
- Consumes: `MONSTERS[monsterId]` object shape from Task 1, specifically `.name` (string) and optional `.flavorLines` (string array).
- Produces: `pickAppearLine(monster, rng = Math.random)` — returns a string. `FLAVOR_LINE_CHANCE` — exported constant, `0.35`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/combat.test.js` (extend the existing import line and add three new tests):

```js
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier, pickAppearLine, FLAVOR_LINE_CHANCE } from '../js/systems/combat.js';
```

```js
test('pickAppearLine returns the generic line when the monster has no flavorLines', () => {
  const monster = { name: 'Snorty McPigface' };
  assert.equal(pickAppearLine(monster, () => 0), 'A wild Snorty McPigface appears!');
});

test('pickAppearLine returns the generic line when the chance roll misses', () => {
  const monster = { name: 'Super Mean Meatloaf', flavorLines: ['Line A', 'Line B'] };
  assert.equal(pickAppearLine(monster, () => FLAVOR_LINE_CHANCE), 'A wild Super Mean Meatloaf appears!');
});

test('pickAppearLine picks a flavor line by index when the chance roll hits', () => {
  const monster = { name: 'Ghost Apple Supreme', flavorLines: ['Line A', 'Line B', 'Line C'] };
  const values = [0.1, 0.6];
  let i = 0;
  const rng = () => values[i++];
  assert.equal(pickAppearLine(monster, rng), 'Line B');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `pickAppearLine is not a function` (or similar import error) since `js/systems/combat.js` doesn't export it yet.

- [ ] **Step 3: Implement `pickAppearLine` in `js/systems/combat.js`**

Append to the end of `js/systems/combat.js`:

```js
export const FLAVOR_LINE_CHANCE = 0.35;

export function pickAppearLine(monster, rng = Math.random) {
  const lines = monster.flavorLines;
  if (!lines || lines.length === 0 || rng() >= FLAVOR_LINE_CHANCE) {
    return `A wild ${monster.name} appears!`;
  }
  const index = Math.floor(rng() * lines.length);
  return lines[index];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, all three new `combat.test.js` tests plus the full existing suite.

- [ ] **Step 5: Wire `pickAppearLine` into `battleScreen.js`**

In `js/screens/battleScreen.js`, update the import line (currently):

```js
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier } from '../systems/combat.js';
```

to:

```js
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier, pickAppearLine } from '../systems/combat.js';
```

Then in `mount()`, replace:

```js
  log = [`A wild ${MONSTERS[monsterId].name} appears!`];
```

with:

```js
  log = [pickAppearLine(MONSTERS[monsterId])];
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites (this change has no dedicated test of its own since `battleScreen.js` has no test file in this project — `pickAppearLine`'s own tests in Task 2 Step 1 already cover the decision logic; this step is pure wiring).

- [ ] **Step 7: Manual verification**

Run: `python3 -m http.server` from the repo root, open `http://localhost:8000` in a browser.
- Walk into a fight with any regular-tier monster (e.g. a boar near town) and confirm the battle log's opening line reads "A wild Snorty McPigface appears!" and the monster's display name throughout the fight (HP label, "You hit ... for N" log lines) uses the new name.
- Confirm the dragon boss fight still shows "A wild Dragon appears!" and the name "Dragon" throughout.
- Fight orc/wraith in the dungeon a handful of times (their `flavorLines` trigger ~35% of the time) — confirm you eventually see one of the themed flavor lines as the opening log entry instead of the generic one, and that the rest of the fight still refers to the monster by its new name ("Super Mean Meatloaf hits you for N.").

- [ ] **Step 8: Commit**

```bash
git add js/systems/combat.js tests/combat.test.js js/screens/battleScreen.js
git commit -m "feat: show themed flavor text on some orc/wraith encounters"
```

---

## Self-Review Notes

- **Spec coverage:** All 8 renames (Task 1), `flavorLines` for orc/wraith (Task 1), 35% trigger chance (Task 2), fallback to generic line for every other monster (Task 2), structural + literal name tests (Task 1), manual verification steps (Task 2) — all covered. Emoji/item names/dragon exclusion are explicitly left untouched, matching the spec's out-of-scope list.
- **Placeholder scan:** No TBD/TODO; all code blocks are complete, copy-pasteable.
- **Type consistency:** `pickAppearLine(monster, rng = Math.random)` signature matches its Task 2 Step 1 test calls and its Task 2 Step 5 call site (`pickAppearLine(MONSTERS[monsterId])`, using the default `rng`). `FLAVOR_LINE_CHANCE` is defined once in `combat.js` and only referenced (not redefined) in the test file.
