# Emoji RPG POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable browser RPG where you walk an emoji grid overworld, fight emoji monsters in a turn-based ATB battle screen, level up, loot gear/materials/gold, shop and upgrade gear in a small town, and clear one dungeon with a boss.

**Architecture:** Vanilla JS with native ES modules, no bundler/build step, DOM + CSS Grid rendering (every tile is a styled `<div>` containing an emoji). A single mutable `gameState` object lives in `js/main.js` and is the source of truth; pure functions in `js/systems/*.js` take state (or state slices) and return new values, and callers reconcile them into the shared `gameState` via `Object.assign(state, result)`. A small screen manager swaps which screen module is mounted into `#app`. Progress persists to `localStorage`.

**Tech Stack:** Plain HTML/CSS/JS (ES modules), Node.js built-in `node:test` + `node:assert/strict` for unit tests (no npm dependencies), served locally with any static file server (e.g. `python3 -m http.server`).

## Global Constraints

- No build tooling: no bundler, no transpiler, no npm dependencies. `package.json` exists only to set `"type": "module"` and a `test` script.
- Node.js 18+ required to run tests (`node --test` is built in from Node 18).
- Must be served over `http://` (e.g. a static file server), not opened via `file://` — browsers block ES module imports from `file://`.
- All game art is emoji text glyphs rendered in the DOM — no image assets, no canvas.
- Pure game-logic modules (`js/systems/*.js`, `js/state.js`) must have no `document`/`window`/DOM references, so they can be unit tested under Node without a browser.
- Death has no penalty: on defeat the player respawns in Town at full HP, keeping all gold, items, gear, and XP.

---

## File Structure

```
package.json
index.html
css/styles.css
js/
  state.js                     # gameState shape, save/load
  tiles.js                     # tile type lookup (emoji, walkable, action)
  data/
    monsters.js                # monster stat/drop-table definitions
    items.js                   # gear/consumable/material definitions
  maps/
    overworldMap.js
    townMap.js
    dungeonMap.js
  systems/
    combat.js                  # damage formula, ATB gauge math
    leveling.js                # XP curve, level-up stat growth
    loot.js                    # drop table rolls
    inventory.js                # gold/item/equipment/upgrade logic
  screens/
    screenManager.js           # mount/unmount active screen
    mapScreen.js                # generic grid renderer + movement + encounters
    battleScreen.js              # ATB battle UI
    shopScreen.js                 # buy gear/consumables
    smithScreen.js                 # upgrade equipped gear
  main.js                       # bootstraps game, wires screens together
tests/
  state.test.js
  data.test.js
  combat.test.js
  leveling.test.js
  loot.test.js
  inventory.test.js
  maps.test.js
```

---

### Task 1: Project Scaffold, Game State & Save/Load

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Produces: `createNewGame(): GameState`, `serializeState(state): string`, `deserializeState(json): GameState`, `saveState(state, storage?): void`, `loadState(storage?): GameState | null`, `STORAGE_KEY: string`
- `GameState` shape: `{ player: { level, xp, hp, maxHp, attack, defense, speed, gold }, equipment: { weapon, head, body, legs, accessory }, upgrades: {}, inventory: [{ itemId, quantity }], map, position: {x,y} | null, flags: { dungeonBossDefeated } }`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "emoji-rpg",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Create `index.html` scaffold (no script tag yet — added in Task 11)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Emoji RPG</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <div id="hud"></div>
  <div id="app"></div>
</body>
</html>
```

- [ ] **Step 3: Create `css/styles.css` with a base reset**

```css
* { box-sizing: border-box; font-family: sans-serif; }
body { margin: 0; background: #222; color: #eee; }
#hud { padding: 8px; background: #111; font-size: 1.1rem; }
#app { padding: 8px; }
```

- [ ] **Step 4: Write the failing test for state creation and serialization**

Create `tests/state.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, serializeState, deserializeState, saveState, loadState } from '../js/state.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
}

test('createNewGame returns a fresh default state', () => {
  const state = createNewGame();
  assert.equal(state.player.level, 1);
  assert.equal(state.player.gold, 20);
  assert.equal(state.map, 'overworld');
  assert.equal(state.equipment.weapon, 'starterSword');
});

test('serializeState and deserializeState round-trip', () => {
  const state = createNewGame();
  const json = serializeState(state);
  const restored = deserializeState(json);
  assert.deepEqual(restored, state);
});

test('saveState writes to storage and loadState reads it back', () => {
  const storage = createFakeStorage();
  const state = createNewGame();
  state.player.gold = 42;
  saveState(state, storage);
  const loaded = loadState(storage);
  assert.equal(loaded.player.gold, 42);
});

test('loadState returns null when nothing saved', () => {
  const storage = createFakeStorage();
  assert.equal(loadState(storage), null);
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/state.js` does not exist yet (module not found).

- [ ] **Step 6: Create `js/state.js`**

```js
export const STORAGE_KEY = 'emoji-rpg-save';

export function createNewGame() {
  return {
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20 },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null },
    upgrades: {},
    inventory: [{ itemId: 'potion', quantity: 2 }],
    map: 'overworld',
    position: null,
    flags: { dungeonBossDefeated: false },
  };
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(json) {
  return JSON.parse(json);
}

export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, serializeState(state));
}

export function loadState(storage = globalThis.localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return deserializeState(raw);
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (4 tests)

- [ ] **Step 8: Commit**

```bash
git add package.json index.html css/styles.css js/state.js tests/state.test.js
git commit -m "feat: scaffold project and add game state save/load"
```

---

### Task 2: Item & Monster Data Definitions

**Files:**
- Create: `js/data/items.js`
- Create: `js/data/monsters.js`
- Test: `tests/data.test.js`

**Interfaces:**
- Produces: `ITEMS: { [itemId]: Item }` where `Item = { id, name, emoji, slot?, type?, price?, stats?, heal? }`
- Produces: `MONSTERS: { [monsterId]: Monster }` where `Monster = { id, name, emoji, hp, attack, defense, speed, xp, goldRange: [min,max], dropTable: [{itemId, chance}], isBoss? }`
- Consumes: nothing (pure data)

- [ ] **Step 1: Write the failing data-sanity test**

Create `tests/data.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';

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
  }
});

test('every item has required fields', () => {
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.equal(item.id, id);
    assert.ok(item.name);
    assert.ok(item.emoji);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/data/items.js` and `js/data/monsters.js` do not exist yet.

- [ ] **Step 3: Create `js/data/items.js`**

```js
export const ITEMS = {
  // Weapons
  starterSword: { id: 'starterSword', name: 'Starter Sword', emoji: '🗡️', slot: 'weapon', price: 0, stats: { attack: 3 } },
  ironSword: { id: 'ironSword', name: 'Iron Sword', emoji: '⚔️', slot: 'weapon', price: 30, stats: { attack: 6 } },
  goblinClub: { id: 'goblinClub', name: 'Goblin Club', emoji: '🏏', slot: 'weapon', price: 0, stats: { attack: 8 } },
  dragonFang: { id: 'dragonFang', name: 'Dragon Fang Blade', emoji: '🦷', slot: 'weapon', price: 0, stats: { attack: 14 } },

  // Head
  clothCap: { id: 'clothCap', name: 'Cloth Cap', emoji: '🧢', slot: 'head', price: 15, stats: { defense: 1 } },
  ironHelm: { id: 'ironHelm', name: 'Iron Helm', emoji: '⛑️', slot: 'head', price: 35, stats: { defense: 3 } },

  // Body
  clothTunic: { id: 'clothTunic', name: 'Cloth Tunic', emoji: '👕', slot: 'body', price: 20, stats: { defense: 2, maxHp: 4 } },
  ironArmor: { id: 'ironArmor', name: 'Iron Armor', emoji: '🥋', slot: 'body', price: 45, stats: { defense: 5, maxHp: 8 } },
  dragonScaleMail: { id: 'dragonScaleMail', name: 'Dragon Scale Mail', emoji: '🐲', slot: 'body', price: 0, stats: { defense: 10, maxHp: 15 } },

  // Legs
  clothPants: { id: 'clothPants', name: 'Cloth Pants', emoji: '👖', slot: 'legs', price: 15, stats: { defense: 1, speed: 1 } },
  ironGreaves: { id: 'ironGreaves', name: 'Iron Greaves', emoji: '🦵', slot: 'legs', price: 30, stats: { defense: 3 } },

  // Accessory
  luckyCharm: { id: 'luckyCharm', name: 'Lucky Charm', emoji: '🍀', slot: 'accessory', price: 25, stats: { speed: 2 } },
  powerRing: { id: 'powerRing', name: 'Power Ring', emoji: '💍', slot: 'accessory', price: 40, stats: { attack: 2 } },

  // Consumables
  potion: { id: 'potion', name: 'Potion', emoji: '🧪', type: 'consumable', price: 10, heal: 15 },

  // Materials
  leatherScrap: { id: 'leatherScrap', name: 'Leather Scrap', emoji: '🟫', type: 'material' },
  batWing: { id: 'batWing', name: 'Bat Wing', emoji: '🦴', type: 'material' },
  snakeFang: { id: 'snakeFang', name: 'Snake Fang', emoji: '🦷', type: 'material' },
  ironScrap: { id: 'ironScrap', name: 'Iron Scrap', emoji: '🔩', type: 'material' },
  wolfPelt: { id: 'wolfPelt', name: 'Wolf Pelt', emoji: '🐾', type: 'material' },
  spiderSilk: { id: 'spiderSilk', name: 'Spider Silk', emoji: '🕸️', type: 'material' },
};
```

- [ ] **Step 4: Create `js/data/monsters.js`**

```js
export const MONSTERS = {
  boar: {
    id: 'boar', name: 'Boar', emoji: '🐗',
    hp: 12, attack: 4, defense: 1, speed: 4,
    xp: 8, goldRange: [2, 5],
    dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }],
  },
  bat: {
    id: 'bat', name: 'Bat', emoji: '🦇',
    hp: 8, attack: 3, defense: 0, speed: 7,
    xp: 6, goldRange: [1, 4],
    dropTable: [{ itemId: 'batWing', chance: 0.25 }],
  },
  snake: {
    id: 'snake', name: 'Snake', emoji: '🐍',
    hp: 10, attack: 5, defense: 1, speed: 5,
    xp: 9, goldRange: [2, 6],
    dropTable: [{ itemId: 'snakeFang', chance: 0.25 }],
  },
  goblin: {
    id: 'goblin', name: 'Goblin', emoji: '👺',
    hp: 15, attack: 6, defense: 2, speed: 4,
    xp: 12, goldRange: [3, 8],
    dropTable: [
      { itemId: 'goblinClub', chance: 0.15 },
      { itemId: 'ironScrap', chance: 0.2 },
    ],
  },
  direWolf: {
    id: 'direWolf', name: 'Dire Wolf', emoji: '🐺',
    hp: 22, attack: 8, defense: 3, speed: 6,
    xp: 20, goldRange: [5, 10],
    dropTable: [{ itemId: 'wolfPelt', chance: 0.3 }],
  },
  spider: {
    id: 'spider', name: 'Giant Spider', emoji: '🕷️',
    hp: 18, attack: 7, defense: 2, speed: 5,
    xp: 18, goldRange: [4, 9],
    dropTable: [{ itemId: 'spiderSilk', chance: 0.3 }],
  },
  dragon: {
    id: 'dragon', name: 'Dragon', emoji: '🐉',
    hp: 60, attack: 12, defense: 5, speed: 6,
    xp: 100, goldRange: [30, 50],
    dropTable: [
      { itemId: 'dragonScaleMail', chance: 0.6 },
      { itemId: 'dragonFang', chance: 0.4 },
    ],
    isBoss: true,
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all previous tests + 2 new tests)

- [ ] **Step 6: Commit**

```bash
git add js/data/items.js js/data/monsters.js tests/data.test.js
git commit -m "feat: add item and monster data definitions"
```

---

### Task 3: Combat System (Damage & ATB Gauge)

**Files:**
- Create: `js/systems/combat.js`
- Test: `tests/combat.test.js`

**Interfaces:**
- Produces: `calculateDamage(attacker: {attack}, defender: {defense}, rng?: () => number): number`, `tickGauge(currentAtb: number, speed: number, dt: number): number`, `isReady(atb: number): boolean`, `ATB_MAX: number`
- Consumes: nothing

- [ ] **Step 1: Write the failing test**

Create `tests/combat.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, tickGauge, isReady, ATB_MAX } from '../js/systems/combat.js';

test('calculateDamage returns at least 1 even against high defense', () => {
  const attacker = { attack: 5 };
  const defender = { defense: 100 };
  const damage = calculateDamage(attacker, defender, () => 0.5);
  assert.equal(damage, 1);
});

test('calculateDamage scales with attack minus defense and rng variance', () => {
  const attacker = { attack: 10 };
  const defender = { defense: 4 };
  const damageLow = calculateDamage(attacker, defender, () => 0);
  const damageHigh = calculateDamage(attacker, defender, () => 1);
  assert.equal(damageLow, Math.round(6 * 0.85));
  assert.equal(damageHigh, Math.round(6 * 1.15));
});

test('tickGauge increases atb by speed times dt, capped at ATB_MAX', () => {
  assert.equal(tickGauge(0, 5, 1), 5);
  assert.equal(tickGauge(98, 5, 1), ATB_MAX);
});

test('isReady is true once atb reaches ATB_MAX', () => {
  assert.equal(isReady(99), false);
  assert.equal(isReady(100), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/systems/combat.js` does not exist yet.

- [ ] **Step 3: Create `js/systems/combat.js`**

```js
export const ATB_MAX = 100;

export function calculateDamage(attacker, defender, rng = Math.random) {
  const base = Math.max(1, attacker.attack - defender.defense);
  const variance = 0.85 + rng() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

export function tickGauge(currentAtb, speed, dt) {
  return Math.min(ATB_MAX, currentAtb + speed * dt);
}

export function isReady(atb) {
  return atb >= ATB_MAX;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all previous tests + 4 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/combat.js tests/combat.test.js
git commit -m "feat: add combat damage and ATB gauge logic"
```

---

### Task 4: Leveling System

**Files:**
- Create: `js/systems/leveling.js`
- Test: `tests/leveling.test.js`

**Interfaces:**
- Produces: `xpForLevel(level: number): number`, `applyXp(player: PlayerStats, xpGained: number): { player: PlayerStats, leveledUp: boolean }`
- Consumes: `PlayerStats` shape from `js/state.js` (`{level, xp, hp, maxHp, attack, defense, speed, gold}`)

- [ ] **Step 1: Write the failing test**

Create `tests/leveling.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel, applyXp } from '../js/systems/leveling.js';

test('xpForLevel increases with level', () => {
  assert.ok(xpForLevel(2) > xpForLevel(1));
});

test('applyXp accumulates xp without leveling when below threshold', () => {
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const { player: next, leveledUp } = applyXp(player, 1);
  assert.equal(leveledUp, false);
  assert.equal(next.level, 1);
  assert.equal(next.xp, 1);
});

test('applyXp levels up, increases stats, and refills hp to max', () => {
  const player = { level: 1, xp: 0, hp: 5, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const needed = xpForLevel(1);
  const { player: next, leveledUp } = applyXp(player, needed);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 2);
  assert.equal(next.maxHp, 24);
  assert.equal(next.attack, 7);
  assert.equal(next.hp, next.maxHp);
});

test('applyXp can trigger multiple level ups from a large xp gain', () => {
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const { player: next } = applyXp(player, 1000);
  assert.ok(next.level > 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/systems/leveling.js` does not exist yet.

- [ ] **Step 3: Create `js/systems/leveling.js`**

```js
export function xpForLevel(level) {
  return Math.round(10 * Math.pow(level, 1.5));
}

export function applyXp(player, xpGained) {
  let { level, attack, defense, speed, maxHp } = player;
  let xp = player.xp + xpGained;
  let leveledUp = false;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    maxHp += 4;
    attack += 2;
    defense += 1;
    speed += 1;
    leveledUp = true;
  }

  const hp = leveledUp ? maxHp : player.hp;

  return {
    player: { ...player, level, xp, maxHp, attack, defense, speed, hp },
    leveledUp,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all previous tests + 4 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/leveling.js tests/leveling.test.js
git commit -m "feat: add automatic XP and leveling system"
```

---

### Task 5: Loot System

**Files:**
- Create: `js/systems/loot.js`
- Test: `tests/loot.test.js`

**Interfaces:**
- Produces: `rollDrop(monster: {goldRange, dropTable}, rng?: () => number): { gold: number, item: string | null }`
- Consumes: `Monster` shape from `js/data/monsters.js` (`goldRange`, `dropTable`)

- [ ] **Step 1: Write the failing test**

Create `tests/loot.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDrop } from '../js/systems/loot.js';

const monster = {
  goldRange: [2, 5],
  dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }],
};

test('rollDrop returns gold within the monster gold range', () => {
  const dropMin = rollDrop(monster, () => 0);
  assert.equal(dropMin.gold, 2);
  const dropMax = rollDrop(monster, () => 0.999);
  assert.equal(dropMax.gold, 5);
});

test('rollDrop grants the item when the roll lands inside its chance', () => {
  const drop = rollDrop(monster, () => 0.1);
  assert.equal(drop.item, 'leatherScrap');
});

test('rollDrop grants no item when the roll lands outside the drop table', () => {
  const drop = rollDrop(monster, () => 0.9);
  assert.equal(drop.item, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/systems/loot.js` does not exist yet.

- [ ] **Step 3: Create `js/systems/loot.js`**

```js
export function rollDrop(monster, rng = Math.random) {
  const [minGold, maxGold] = monster.goldRange;
  const gold = minGold + Math.floor(rng() * (maxGold - minGold + 1));

  let item = null;
  if (monster.dropTable && monster.dropTable.length > 0) {
    const roll = rng();
    let cumulative = 0;
    for (const entry of monster.dropTable) {
      cumulative += entry.chance;
      if (roll < cumulative) {
        item = entry.itemId;
        break;
      }
    }
  }

  return { gold, item };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all previous tests + 3 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/loot.js tests/loot.test.js
git commit -m "feat: add loot drop table rolling"
```

---

### Task 6: Inventory & Equipment System

**Files:**
- Create: `js/systems/inventory.js`
- Test: `tests/inventory.test.js`

**Interfaces:**
- Consumes: `ITEMS` from `js/data/items.js` (Task 2), `GameState` shape from `js/state.js` (Task 1)
- Produces: `addGold(state, amount)`, `spendGold(state, amount)` (throws if insufficient), `addItem(state, itemId, quantity?)`, `removeItem(state, itemId, quantity?)`, `equipItem(state, itemId, slot)` (throws if item not in inventory), `upgradeCost(currentLevel: number): number`, `upgradeItem(state, slot, materialId, cost)` (throws if no item equipped, missing material, or insufficient gold), `getEquipmentBonuses(state): {attack, defense, maxHp, speed}`. All state-mutating functions are pure — they return a new state object rather than mutating the input.

- [ ] **Step 1: Write the failing test**

Create `tests/inventory.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../js/state.js';
import {
  addGold, spendGold, addItem, removeItem, equipItem, upgradeItem, upgradeCost, getEquipmentBonuses,
} from '../js/systems/inventory.js';

test('addGold and spendGold adjust player gold immutably', () => {
  const state = createNewGame();
  const richer = addGold(state, 10);
  assert.equal(richer.player.gold, 30);
  assert.equal(state.player.gold, 20);
  const poorer = spendGold(richer, 5);
  assert.equal(poorer.player.gold, 25);
});

test('spendGold throws when gold is insufficient', () => {
  const state = createNewGame();
  assert.throws(() => spendGold(state, 1000));
});

test('addItem stacks quantities for existing items', () => {
  let state = createNewGame();
  state = addItem(state, 'potion', 1);
  const entry = state.inventory.find((e) => e.itemId === 'potion');
  assert.equal(entry.quantity, 3);
});

test('removeItem decrements and removes zero-quantity entries', () => {
  let state = createNewGame();
  state = removeItem(state, 'potion', 2);
  const entry = state.inventory.find((e) => e.itemId === 'potion');
  assert.equal(entry, undefined);
});

test('equipItem swaps gear between equipment slot and inventory', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1);
  state = equipItem(state, 'ironSword', 'weapon');
  assert.equal(state.equipment.weapon, 'ironSword');
  const inventoryHasStarter = state.inventory.some((e) => e.itemId === 'starterSword');
  assert.ok(inventoryHasStarter);
});

test('equipItem throws when the item is not in inventory', () => {
  const state = createNewGame();
  assert.throws(() => equipItem(state, 'ironSword', 'weapon'));
});

test('upgradeCost scales with current upgrade level', () => {
  assert.equal(upgradeCost(0), 20);
  assert.equal(upgradeCost(1), 40);
});

test('upgradeItem consumes gold and material, increasing upgrade level', () => {
  let state = createNewGame();
  state = addItem(state, 'leatherScrap', 1);
  state = upgradeItem(state, 'weapon', 'leatherScrap', 20);
  assert.equal(state.upgrades.starterSword, 1);
  assert.equal(state.player.gold, 0);
  const materialEntry = state.inventory.find((e) => e.itemId === 'leatherScrap');
  assert.equal(materialEntry, undefined);
});

test('upgradeItem throws without the required material', () => {
  const state = createNewGame();
  assert.throws(() => upgradeItem(state, 'weapon', 'leatherScrap', 20));
});

test('getEquipmentBonuses sums stats from equipped, upgraded gear', () => {
  const state = createNewGame();
  const bonuses = getEquipmentBonuses(state);
  assert.equal(bonuses.attack, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/systems/inventory.js` does not exist yet.

- [ ] **Step 3: Create `js/systems/inventory.js`**

```js
import { ITEMS } from '../data/items.js';

export const UPGRADE_BASE_COST = 20;

export function addGold(state, amount) {
  return { ...state, player: { ...state.player, gold: state.player.gold + amount } };
}

export function spendGold(state, amount) {
  if (state.player.gold < amount) throw new Error('Not enough gold');
  return { ...state, player: { ...state.player, gold: state.player.gold - amount } };
}

export function addItem(state, itemId, quantity = 1) {
  const inventory = state.inventory.map((entry) => ({ ...entry }));
  const existing = inventory.find((entry) => entry.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    inventory.push({ itemId, quantity });
  }
  return { ...state, inventory };
}

export function removeItem(state, itemId, quantity = 1) {
  const inventory = state.inventory
    .map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity - quantity } : entry))
    .filter((entry) => entry.quantity > 0);
  return { ...state, inventory };
}

export function equipItem(state, itemId, slot) {
  const inventoryEntry = state.inventory.find((entry) => entry.itemId === itemId && entry.quantity > 0);
  if (!inventoryEntry) throw new Error(`Item ${itemId} not in inventory`);

  const previouslyEquipped = state.equipment[slot];
  let next = removeItem(state, itemId, 1);
  next = { ...next, equipment: { ...next.equipment, [slot]: itemId } };
  if (previouslyEquipped) {
    next = addItem(next, previouslyEquipped, 1);
  }
  return next;
}

export function upgradeCost(currentLevel) {
  return UPGRADE_BASE_COST * (currentLevel + 1);
}

export function upgradeItem(state, slot, materialId, cost) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);

  const hasMaterial = state.inventory.some((entry) => entry.itemId === materialId && entry.quantity > 0);
  if (!hasMaterial) throw new Error('Missing required material');
  if (state.player.gold < cost) throw new Error('Not enough gold');

  let next = spendGold(state, cost);
  next = removeItem(next, materialId, 1);
  const upgradeLevel = (next.upgrades?.[itemId] || 0) + 1;
  next = { ...next, upgrades: { ...next.upgrades, [itemId]: upgradeLevel } };
  return next;
}

export function getEquipmentBonuses(state) {
  const bonuses = { attack: 0, defense: 0, maxHp: 0, speed: 0 };
  for (const slot of Object.keys(state.equipment)) {
    const itemId = state.equipment[slot];
    if (!itemId) continue;
    const item = ITEMS[itemId];
    const upgradeLevel = state.upgrades?.[itemId] || 0;
    for (const stat of Object.keys(bonuses)) {
      const base = item.stats?.[stat] || 0;
      bonuses[stat] += base + base * 0.25 * upgradeLevel;
    }
  }
  return bonuses;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all previous tests + 9 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/inventory.js tests/inventory.test.js
git commit -m "feat: add inventory, equipment, and smith upgrade logic"
```

---

### Task 7: Tiles & Map Definitions

**Files:**
- Create: `js/tiles.js`
- Create: `js/maps/overworldMap.js`
- Create: `js/maps/townMap.js`
- Create: `js/maps/dungeonMap.js`
- Test: `tests/maps.test.js`

**Interfaces:**
- Produces: `TILES: { [tileKey]: { emoji, walkable, encounter?, action? } }`
- Produces: `overworldMap`, `townMap`, `dungeonMap`, each `{ id, legend: {[char]: tileKey}, rows: string[], startPosition: {x,y}, encounterChance: number, monsterTable: string[], bossMonsterId?: string }`
- Consumes: nothing (pure data), but tests consume `MONSTERS` from Task 2 to validate `bossMonsterId`

- [ ] **Step 1: Write the failing test**

Create `tests/maps.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { overworldMap } from '../js/maps/overworldMap.js';
import { townMap } from '../js/maps/townMap.js';
import { dungeonMap } from '../js/maps/dungeonMap.js';
import { MONSTERS } from '../js/data/monsters.js';

function assertValidMap(map) {
  const width = map.rows[0].length;
  for (const row of map.rows) {
    assert.equal(row.length, width, `${map.id} rows must all be the same width`);
    for (const char of row) {
      assert.ok(map.legend[char], `${map.id} legend missing entry for '${char}'`);
      assert.ok(TILES[map.legend[char]], `${map.id} legend points to unknown tile '${map.legend[char]}'`);
    }
  }
}

test('overworld map is well-formed and has a walkable start position', () => {
  assertValidMap(overworldMap);
  const { x, y } = overworldMap.startPosition;
  const tileKey = overworldMap.legend[overworldMap.rows[y][x]];
  assert.ok(TILES[tileKey].walkable);
});

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/tiles.js` and the map files do not exist yet.

- [ ] **Step 3: Create `js/tiles.js`**

```js
export const TILES = {
  grass: { emoji: '🟩', walkable: true, encounter: true },
  tree: { emoji: '🌲', walkable: false, encounter: false },
  water: { emoji: '🟦', walkable: false, encounter: false },
  townEntrance: { emoji: '🏘️', walkable: true, encounter: false, action: 'enterTown' },
  dungeonEntrance: { emoji: '🕳️', walkable: true, encounter: false, action: 'enterDungeon' },
  shop: { emoji: '🏪', walkable: true, encounter: false, action: 'enterShop' },
  smith: { emoji: '⚒️', walkable: true, encounter: false, action: 'enterSmith' },
  exit: { emoji: '🚪', walkable: true, encounter: false, action: 'exitMap' },
  boss: { emoji: '🐉', walkable: true, encounter: false, action: 'bossBattle' },
};
```

- [ ] **Step 4: Create `js/maps/overworldMap.js`**

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  '~': 'water',
  T: 'townEntrance',
  D: 'dungeonEntrance',
};

const ROWS = [
  '####################',
  '#..................#',
  '#..................#',
  '#....T.............#',
  '#..................#',
  '#........~~........#',
  '#........~~........#',
  '#..................#',
  '#..................#',
  '#.............D....#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####################',
];

export const overworldMap = {
  id: 'overworld',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.1,
  monsterTable: ['boar', 'bat', 'snake', 'goblin'],
};
```

- [ ] **Step 5: Create `js/maps/townMap.js`**

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  E: 'exit',
};

const ROWS = [
  '########',
  '#......#',
  '#.S..M.#',
  '#......#',
  '#..E...#',
  '########',
];

export const townMap = {
  id: 'town',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 3, y: 3 },
  encounterChance: 0,
  monsterTable: [],
};
```

- [ ] **Step 6: Create `js/maps/dungeonMap.js`**

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  E: 'exit',
  B: 'boss',
};

const ROWS = [
  '####################',
  '#E.................#',
  '#..................#',
  '#..#####...#####...#',
  '#..#.......#...#...#',
  '#..#..######...#...#',
  '#..#........#..#...#',
  '#...........#..#...#',
  '#............#.#...#',
  '#.............##..B#',
  '####################',
];

export const dungeonMap = {
  id: 'dungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.2,
  monsterTable: ['direWolf', 'spider'],
  bossMonsterId: 'dragon',
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all previous tests + 3 new tests)

- [ ] **Step 8: Commit**

```bash
git add js/tiles.js js/maps tests/maps.test.js
git commit -m "feat: add tile types and overworld/town/dungeon map data"
```

---

### Task 8: Screen Manager & Map Screen (Overworld/Town/Dungeon Navigation)

**Files:**
- Create: `js/screens/screenManager.js`
- Create: `js/screens/mapScreen.js`

**Interfaces:**
- Consumes: `TILES` from `js/tiles.js` (Task 7)
- Produces: `mountScreen(screenModule, props): void` (screenManager). Every screen module (this and future ones) exports `mount(root: HTMLElement, props): void` and `unmount(): void`.
- `mapScreen.mount` props: `{ state, mapConfig, callbacks: { onMove(position), onAction(actionName), onEncounter(monsterId) } }`

This task is DOM-only, so it cannot be red/green tested with `node:test`. Instead each step ends with a Node-based module-load smoke check (catches syntax/import errors without a browser) and full behavior is verified manually once Task 11 wires everything together.

- [ ] **Step 1: Create `js/screens/screenManager.js`**

```js
let activeScreen = null;

export function mountScreen(screen, props) {
  const root = document.getElementById('app');
  if (activeScreen && activeScreen.unmount) {
    activeScreen.unmount();
  }
  root.innerHTML = '';
  activeScreen = screen;
  screen.mount(root, props);
}
```

- [ ] **Step 2: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/screenManager.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Create `js/screens/mapScreen.js`**

```js
import { TILES } from '../tiles.js';

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

function render() {
  const cols = mapConfig.rows[0].length;
  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let y = 0; y < mapConfig.rows.length; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = document.createElement('div');
      cell.className = 'map-tile';
      const tile = tileAt(x, y);
      const isPlayer = state.position.x === x && state.position.y === y;
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
  const tile = tileAt(nx, ny);
  if (!tile || !tile.walkable) return;

  state.position = { x: nx, y: ny };
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
  render();
  window.addEventListener('keydown', handleKeydown);
}

export function unmount() {
  window.removeEventListener('keydown', handleKeydown);
}
```

- [ ] **Step 4: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/mapScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 5: Commit**

```bash
git add js/screens/screenManager.js js/screens/mapScreen.js
git commit -m "feat: add screen manager and generic map navigation screen"
```

---

### Task 9: Battle Screen (ATB Combat UI)

**Files:**
- Create: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `MONSTERS` (Task 2), `ITEMS` (Task 2), `calculateDamage`/`tickGauge`/`isReady` (Task 3), `getEquipmentBonuses` (Task 6)
- Produces: `mount(root, props)` / `unmount()`. `mount` props: `{ state, monsterId, callbacks: { onBattleEnd(outcome: 'won'|'lost'|'fled', monsterId) } }`. On mount/unmount it exports the standard screen module shape used by `screenManager`.

- [ ] **Step 1: Create `js/screens/battleScreen.js`**

```js
import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { calculateDamage, tickGauge, isReady } from '../systems/combat.js';
import { getEquipmentBonuses } from '../systems/inventory.js';

let rootEl = null;
let state = null;
let monsterId = null;
let callbacks = null;
let intervalId = null;
let playerCombatant = null;
let monsterCombatant = null;
let battleOver = false;
let log = [];

function buildPlayerCombatant() {
  const bonuses = getEquipmentBonuses(state);
  return {
    emoji: '🧑',
    hp: state.player.hp,
    maxHp: state.player.maxHp + bonuses.maxHp,
    attack: state.player.attack + bonuses.attack,
    defense: state.player.defense + bonuses.defense,
    speed: state.player.speed + bonuses.speed,
    atb: 0,
  };
}

function buildMonsterCombatant() {
  const monster = MONSTERS[monsterId];
  return {
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed: monster.speed,
    atb: 0,
  };
}

function render() {
  rootEl.innerHTML = `
    <div class="battle-screen">
      <div class="combatant">${monsterCombatant.emoji} ${monsterCombatant.name} — HP ${monsterCombatant.hp}/${monsterCombatant.maxHp}</div>
      <div class="combatant">${playerCombatant.emoji} You — HP ${playerCombatant.hp}/${playerCombatant.maxHp}</div>
      <div class="battle-log">${log.slice(-4).join('<br>')}</div>
      <div class="battle-menu" id="battle-menu"></div>
    </div>
  `;

  if (isReady(playerCombatant.atb) && !battleOver) {
    renderMenu();
  }
}

function renderMenu() {
  const menu = document.getElementById('battle-menu');
  if (!menu) return;
  menu.innerHTML = `
    <button id="btn-attack">Attack</button>
    <button id="btn-item">Item</button>
    <button id="btn-flee">Flee</button>
  `;
  document.getElementById('btn-attack').onclick = playerAttack;
  document.getElementById('btn-item').onclick = playerUseItem;
  document.getElementById('btn-flee').onclick = playerFlee;
}

function playerAttack() {
  const damage = calculateDamage(playerCombatant, monsterCombatant);
  monsterCombatant.hp = Math.max(0, monsterCombatant.hp - damage);
  log.push(`You hit ${monsterCombatant.name} for ${damage}.`);
  playerCombatant.atb = 0;
  checkOutcome();
  render();
}

function playerUseItem() {
  const potionEntry = state.inventory.find((entry) => entry.itemId === 'potion' && entry.quantity > 0);
  if (!potionEntry) {
    log.push('No potions left.');
    render();
    return;
  }
  potionEntry.quantity -= 1;
  state.inventory = state.inventory.filter((entry) => entry.quantity > 0);
  const heal = ITEMS.potion.heal;
  playerCombatant.hp = Math.min(playerCombatant.maxHp, playerCombatant.hp + heal);
  log.push(`You drink a potion and heal ${heal}.`);
  playerCombatant.atb = 0;
  render();
}

function playerFlee() {
  if (MONSTERS[monsterId].isBoss) {
    log.push('You cannot flee from this battle!');
    playerCombatant.atb = 0;
    render();
    return;
  }
  endBattle('fled');
}

function monsterAttack() {
  const damage = calculateDamage(monsterCombatant, playerCombatant);
  playerCombatant.hp = Math.max(0, playerCombatant.hp - damage);
  log.push(`${monsterCombatant.name} hits you for ${damage}.`);
  monsterCombatant.atb = 0;
  checkOutcome();
}

function checkOutcome() {
  if (monsterCombatant.hp <= 0) {
    endBattle('won');
  } else if (playerCombatant.hp <= 0) {
    endBattle('lost');
  }
}

function tick() {
  if (battleOver) return;
  playerCombatant.atb = tickGauge(playerCombatant.atb, playerCombatant.speed, 1);
  monsterCombatant.atb = tickGauge(monsterCombatant.atb, monsterCombatant.speed, 1);

  if (isReady(monsterCombatant.atb) && !isReady(playerCombatant.atb)) {
    monsterAttack();
  }

  render();
}

function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  callbacks.onBattleEnd(outcome, monsterId);
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterId = props.monsterId;
  callbacks = props.callbacks;
  battleOver = false;
  log = [`A wild ${MONSTERS[monsterId].name} appears!`];
  playerCombatant = buildPlayerCombatant();
  monsterCombatant = buildMonsterCombatant();
  render();
  intervalId = setInterval(tick, 300);
}

export function unmount() {
  clearInterval(intervalId);
}
```

- [ ] **Step 2: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/battleScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: add ATB battle screen"
```

---

### Task 10: Shop & Smith Screens

**Files:**
- Create: `js/screens/shopScreen.js`
- Create: `js/screens/smithScreen.js`

**Interfaces:**
- Consumes: `ITEMS` (Task 2), `addItem`/`spendGold`/`equipItem` (Task 6) for `shopScreen`; `ITEMS` (Task 2), `upgradeCost`/`upgradeItem` (Task 6) for `smithScreen`
- Produces: both export `mount(root, props)` / `unmount()`. `shopScreen.mount` props: `{ state, callbacks: { onPurchase(), onLeave() } }`. `smithScreen.mount` props: `{ state, callbacks: { onUpgrade(), onLeave() } }`

- [ ] **Step 1: Create `js/screens/shopScreen.js`**

```js
import { ITEMS } from '../data/items.js';
import { spendGold, addItem, equipItem } from '../systems/inventory.js';

const CATALOG = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves',
  'powerRing', 'clothCap', 'clothTunic', 'clothPants', 'luckyCharm', 'potion',
];

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const rows = CATALOG.map((itemId) => {
    const item = ITEMS[itemId];
    return `<div class="shop-row">
      <span>${item.emoji} ${item.name} — ${item.price}g</span>
      <button data-item="${itemId}">Buy</button>
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="shop-screen">
      <h2>Shop (Gold: ${state.player.gold})</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-item]').forEach((btn) => {
    btn.onclick = () => buyItem(btn.dataset.item);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
}

function buyItem(itemId) {
  const item = ITEMS[itemId];
  if (state.player.gold < item.price) return;

  let next = spendGold(state, item.price);
  next = addItem(next, itemId, 1);
  if (item.slot) {
    next = equipItem(next, itemId, item.slot);
  }
  Object.assign(state, next);
  callbacks.onPurchase();
  render();
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

Run: `node --input-type=module -e "import('./js/screens/shopScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Create `js/screens/smithScreen.js`**

```js
import { ITEMS } from '../data/items.js';
import { upgradeCost, upgradeItem } from '../systems/inventory.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory'];

let rootEl = null;
let state = null;
let callbacks = null;

function materialOptions() {
  return state.inventory.filter((entry) => {
    const item = ITEMS[entry.itemId];
    return item.type === 'material' && entry.quantity > 0;
  });
}

function render() {
  const materials = materialOptions();
  const rows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="smith-row">${slot}: (empty)</div>`;

    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    const cost = upgradeCost(level);
    const options = materials
      .map((m) => `<option value="${m.itemId}">${ITEMS[m.itemId].name} (x${m.quantity})</option>`)
      .join('');

    return `<div class="smith-row">
      <span>${item.emoji} ${item.name} +${level}</span>
      <select data-slot="${slot}">${options}</select>
      <button data-slot="${slot}" ${materials.length === 0 ? 'disabled' : ''}>Upgrade (${cost}g)</button>
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="smith-screen">
      <h2>Smith (Gold: ${state.player.gold})</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-slot]').forEach((btn) => {
    btn.onclick = () => tryUpgrade(btn.dataset.slot);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
}

function tryUpgrade(slot) {
  const select = rootEl.querySelector(`select[data-slot="${slot}"]`);
  const materialId = select?.value;
  if (!materialId) return;

  const itemId = state.equipment[slot];
  const level = state.upgrades?.[itemId] || 0;
  const cost = upgradeCost(level);

  try {
    const next = upgradeItem(state, slot, materialId, cost);
    Object.assign(state, next);
    callbacks.onUpgrade();
  } catch {
    // Not enough gold or missing material — button availability already reflects this
  }
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
```

- [ ] **Step 4: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/smithScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 5: Commit**

```bash
git add js/screens/shopScreen.js js/screens/smithScreen.js
git commit -m "feat: add shop and smith screens"
```

---

### Task 11: Main Wiring, HUD & Full Loop Integration

**Files:**
- Create: `js/main.js`
- Modify: `index.html` (add `<script type="module" src="js/main.js"></script>` before `</body>`)
- Modify: `css/styles.css` (add map/battle/shop/smith styling)

**Interfaces:**
- Consumes everything produced by Tasks 1-10: `createNewGame`/`loadState`/`saveState` (state.js), `mountScreen` (screenManager.js), `mapScreen`/`battleScreen`/`shopScreen`/`smithScreen`, `overworldMap`/`townMap`/`dungeonMap`, `MONSTERS`, `applyXp`, `rollDrop`, `addGold`/`addItem`

- [ ] **Step 1: Add the script tag to `index.html`**

Modify `index.html` — replace:
```html
  <div id="app"></div>
</body>
```
with:
```html
  <div id="app"></div>
  <script type="module" src="js/main.js"></script>
</body>
```

- [ ] **Step 2: Expand `css/styles.css` with map/battle/shop/smith styling**

Append to `css/styles.css`:

```css
.map-grid {
  display: grid;
  gap: 2px;
}
.map-tile {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  background: #333;
}

.battle-screen, .shop-screen, .smith-screen {
  max-width: 480px;
  margin: 0 auto;
}
.combatant { margin-bottom: 8px; font-size: 1.3rem; }
.battle-log { min-height: 80px; background: #111; padding: 8px; margin: 8px 0; font-size: 0.9rem; }
.battle-menu button, .shop-row button, .smith-row button, #btn-leave {
  margin: 4px; padding: 8px 12px; font-size: 1rem;
}
.shop-row, .smith-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px solid #444;
}
```

- [ ] **Step 3: Create `js/main.js`**

```js
import { createNewGame, loadState, saveState } from './state.js';
import { mountScreen } from './screens/screenManager.js';
import * as mapScreen from './screens/mapScreen.js';
import * as battleScreen from './screens/battleScreen.js';
import * as shopScreen from './screens/shopScreen.js';
import * as smithScreen from './screens/smithScreen.js';
import { overworldMap } from './maps/overworldMap.js';
import { townMap } from './maps/townMap.js';
import { dungeonMap } from './maps/dungeonMap.js';
import { MONSTERS } from './data/monsters.js';
import { applyXp } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem } from './systems/inventory.js';

const MAPS = { overworld: overworldMap, town: townMap, dungeon: dungeonMap };

const state = loadState() || createNewGame();
if (!state.position) {
  state.position = { ...MAPS[state.map].startPosition };
}

function renderHud() {
  const hud = document.getElementById('hud');
  hud.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp} Gold:${state.player.gold}`;
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
    },
  });
}

function handleTileAction(action) {
  if (action === 'enterTown') return goToMap('town');
  if (action === 'enterDungeon') return goToMap('dungeon');
  if (action === 'exitMap') return goToMap('overworld');
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
  if (action === 'bossBattle') return handleEncounter(dungeonMap.bossMonsterId);
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
  mountScreen(battleScreen, {
    state,
    monsterId,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}

function handleBattleEnd(outcome, monsterId) {
  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const { player } = applyXp(state.player, monster.xp);
    state.player = player;

    const drop = rollDrop(monster);
    Object.assign(state, addGold(state, drop.gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }

    saveState(state);
    renderHud();
    goToMap(state.map);
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp;
    state.map = 'town';
    state.position = { ...townMap.startPosition };
    saveState(state);
    renderHud();
    goToMap('town');
  } else if (outcome === 'fled') {
    saveState(state);
    renderHud();
    goToMap(state.map);
  }
}

renderHud();
goToMap(state.map);
```

- [ ] **Step 4: Run the full automated test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (all tests from Tasks 1-7)

- [ ] **Step 5: Manual full-loop playtest**

Run: `python3 -m http.server 8000` from the project root, then open `http://localhost:8000` in a browser. Walk through the checklist:

- Overworld renders as an emoji grid; arrow keys/WASD move the player
- Walking on grass occasionally triggers a battle
- In battle: the ATB gauges visibly fill, an action menu appears when yours is full, Attack deals damage, Item heals with a potion, Flee returns to the overworld/dungeon
- Winning a battle shows increased gold/XP and occasionally an item; leveling up is reflected in the HUD
- Losing a battle sends you to Town at full HP with your gold/items/gear intact
- Walking onto the town-entrance tile enters Town; walking onto the shop/smith tiles opens those screens; Leave returns to Town; the exit tile returns to the overworld
- In the Shop, buying a piece of gear spends gold and equips it immediately; buying a potion adds it to inventory
- In the Smith, upgrading equipped gear (with a material in inventory) spends gold + the material and increases the item's `+N` level
- Walking onto the dungeon-entrance tile enters the Dungeon; encounters are more frequent; reaching the boss tile triggers a fixed Dragon battle
- Beating the boss sets the "defeated" flag (spot-check via `localStorage.getItem('emoji-rpg-save')` in devtools) and drops boss loot
- Reload the page after playing — position, stats, gear, and gold are all restored from `localStorage`

- [ ] **Step 6: Commit**

```bash
git add index.html css/styles.css js/main.js
git commit -m "feat: wire main game loop, HUD, and persistence together"
```

---

### Task 12: Balance Pass & README

**Files:**
- Modify: `js/data/monsters.js`, `js/systems/leveling.js`, map `encounterChance` values (only if playtesting in Task 11 revealed pacing issues)
- Create: `README.md`

**Interfaces:** none new — this task only tunes existing values and documents how to run the project.

- [ ] **Step 1: Tune pacing based on the Task 11 playtest**

While playing through Task 11's checklist, note whether: early overworld fights felt too slow/fast to win, leveling felt too slow/fast, encounter rate felt too sparse/frequent, or the dungeon boss felt trivial/impossible. Adjust the relevant constant(s) directly:
- Monster `hp`/`attack`/`xp`/`goldRange` in `js/data/monsters.js`
- The stat growth-per-level values in `js/systems/leveling.js`'s `applyXp` (`maxHp += 4`, `attack += 2`, etc.) or the `xpForLevel` curve
- `encounterChance` in `js/maps/overworldMap.js` / `dungeonMap.js`

There is no fixed target here beyond the stated goal: overworld grinding should feel quick, and the dungeon boss should be a real (but winnable with reasonable prep) test of level and gear.

- [ ] **Step 2: Run the automated test suite after any tuning changes**

Run: `npm test`
Expected: PASS — tuning numeric constants should not break any existing assertions (if a test does break because it hard-coded a tuned value, e.g. the leveling test's `next.maxHp === 24`, update that assertion to match the new intended value).

- [ ] **Step 3: Create `README.md`**

```markdown
# Emoji RPG

A browser-based RPG using emoji for all art. Walk the overworld, fight monsters
in turn-based ATB battles, level up, loot gear and gold, shop and upgrade gear
in town, and clear the dungeon's boss.

## Run it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Run tests

```bash
npm test
```

Requires Node.js 18+ (uses the built-in `node:test` runner — no dependencies to install).

## Controls

Arrow keys or WASD to move. In battle, click the action buttons (Attack / Item / Flee) once your ATB gauge is full.
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: balance pass and add README"
```
