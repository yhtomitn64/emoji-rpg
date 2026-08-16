# Inventory & Equipment Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the player a real inventory screen — see unequipped gear with a stat comparison against what's equipped, manually equip/unequip, and check material/potion counts without a trip to town — and remove the auto-equip-on-pickup behavior that made all of this invisible before. Also fix the smith accepting any material for any slot's upgrade.

**Architecture:** A new pure `getItemEffectiveStats(itemId, upgradeLevel)` in the existing `js/systems/inventory.js` factors out per-item stat math already used by `getEquipmentBonuses`, reused by a new `getItemStatDelta(state, itemId)` for the equip-comparison UI and a new `unequipItem(state, slot)` alongside the existing `equipItem`. A new `js/screens/inventoryScreen.js` (mirrors the existing `smithScreen.js`/`statsPanel.js` template-string + button-click pattern) is the only new UI surface. The smith's existing material dropdown, which today computes one shared material list for every slot, gets restructured to filter per-slot by a new `upgradeSlot` field added to each material item. `main.js` gets a new `🎒 Inventory` HUD button (mirrors the existing `📊 Stats` button exactly, including the shared during-battle disable) and loses both of its auto-equip call sites.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- Material → `upgradeSlot` mapping (exact, no others): `ironScrap`/`snakeFang`/`orcTusk` → `weapon`; `spiderSilk` → `head`; `leatherScrap` → `body`; `wolfPelt` → `legs`; `batWing`/`wraithEssence` → `accessory`.
- No auto-equip anywhere in the game after this plan — every item pickup (monster drop, mini-dungeon treasure, cache) adds to inventory only. Equipping is exclusively a player action from the new Inventory screen.
- `getItemEffectiveStats` returns **unrounded** per-stat values; every caller aggregates first and rounds exactly once at the end — never round per-item before summing/comparing (this exact trap already broke `getEquipmentBonuses` once before in this codebase's history if done wrong, per its own inline comment).
- The Inventory screen's Gear section shows a stat delta against whatever currently occupies that item's slot, computed at both items' **real current** `state.upgrades` levels (not upgrade level 0).
- No native `confirm()`/`prompt()` — equip/unequip are both instantly reversible, so no confirmation step is needed for either.
- `🎒 Inventory` HUD button follows the exact same `battleActive`-driven disable as `📊 Stats` — both must go through the same shared enable/disable function so they can never drift out of sync.
- No test file for `js/screens/inventoryScreen.js` or the `main.js` wiring — matches this project's established convention for every other DOM screen (no test harness exists for this file class).

---

### Task 1: Pure equip/unequip and stat-delta helpers in `js/systems/inventory.js`

**Files:**
- Modify: `js/systems/inventory.js`
- Modify: `tests/inventory.test.js`

**Interfaces:**
- Produces: `getItemEffectiveStats(itemId, upgradeLevel = 0)` → `{ attack, defense, maxHp, speed }` (unrounded); `getItemStatDelta(state, itemId)` → `{ attack, defense, maxHp, speed }` (rounded, candidate item vs whatever's currently equipped in that item's slot, or zero if the slot is empty); `unequipItem(state, slot)` → new state (moves the equipped item back to inventory, empties the slot, throws if the slot is already empty). `getEquipmentBonuses(state)`'s existing signature and output are unchanged — this task only refactors its internals to call the new `getItemEffectiveStats` instead of inlining the same formula. Tasks 3 and 4 import `getItemStatDelta`, `unequipItem`, and the pre-existing `equipItem`/`getEquipmentBonuses`.

- [ ] **Step 1: Write the failing tests**

In `tests/inventory.test.js`, change the import line from:

```js
import {
  addGold, spendGold, addItem, removeItem, equipItem, upgradeItem, upgradeCost, getEquipmentBonuses,
} from '../js/systems/inventory.js';
```

to:

```js
import {
  addGold, spendGold, addItem, removeItem, equipItem, unequipItem, upgradeItem, upgradeCost,
  getEquipmentBonuses, getItemEffectiveStats, getItemStatDelta,
} from '../js/systems/inventory.js';
```

Then add these tests at the end of the file (after the existing `'getEquipmentBonuses sums stats from equipped, upgraded gear'` test):

```js
test('getItemEffectiveStats returns unrounded base stats at upgrade level 0', () => {
  const stats = getItemEffectiveStats('starterSword', 0);
  assert.deepEqual(stats, { attack: 3, defense: 0, maxHp: 0, speed: 0 });
});

test('getItemEffectiveStats scales fractionally per upgrade level without rounding', () => {
  const stats = getItemEffectiveStats('powerRing', 1);
  assert.equal(stats.attack, 2.5);
});

test('getEquipmentBonuses sums fractional per-item bonuses before rounding once (regression guard for the getItemEffectiveStats refactor)', () => {
  let state = createNewGame();
  state.upgrades.starterSword = 1; // weapon, equipped by default: base attack 3 -> 3 + 3*0.25*1 = 3.75
  state = addItem(state, 'powerRing', 1);
  state = equipItem(state, 'powerRing', 'accessory');
  state.upgrades.powerRing = 1; // accessory: base attack 2 -> 2 + 2*0.25*1 = 2.5
  const bonuses = getEquipmentBonuses(state);
  // Correct (sum-then-round-once): 3.75 + 2.5 = 6.25 -> 6.
  // A regression that rounds each item's contribution before summing would instead
  // produce round(3.75) + round(2.5) = 4 + 3 = 7, failing this assertion.
  assert.equal(bonuses.attack, 6);
});

test('getItemStatDelta compares a candidate item against the currently equipped item in its slot', () => {
  const state = createNewGame(); // weapon: starterSword, attack 3, upgrade 0
  const delta = getItemStatDelta(state, 'ironSword'); // weapon, attack 6, upgrade 0
  assert.equal(delta.attack, 3);
});

test('getItemStatDelta compares against an empty slot as zero', () => {
  const state = createNewGame(); // head slot is empty
  const delta = getItemStatDelta(state, 'ironHelm'); // head, defense 3
  assert.equal(delta.defense, 3);
});

test("getItemStatDelta uses the candidate item's own real upgrade level, not the equipped item's", () => {
  let state = createNewGame();
  state.upgrades.ironSword = 2; // ironSword sitting in inventory, previously upgraded
  const delta = getItemStatDelta(state, 'ironSword');
  // ironSword base attack 6 at upgrade 2 -> 6 + 6*0.25*2 = 9; equipped starterSword base 3 at upgrade 0 -> 3.
  assert.equal(delta.attack, 6);
});

test('unequipItem moves the equipped item back to inventory and empties the slot', () => {
  let state = createNewGame(); // weapon: starterSword equipped, not in inventory
  state = unequipItem(state, 'weapon');
  assert.equal(state.equipment.weapon, null);
  const entry = state.inventory.find((e) => e.itemId === 'starterSword');
  assert.equal(entry.quantity, 1);
});

test('unequipItem throws when the slot is already empty', () => {
  const state = createNewGame(); // head slot empty
  assert.throws(() => unequipItem(state, 'head'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `unequipItem`, `getItemEffectiveStats`, `getItemStatDelta` are not exported yet.

- [ ] **Step 3: Refactor `getEquipmentBonuses` and add the three new functions in `js/systems/inventory.js`**

Change:

```js
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
```

to:

```js
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

export function unequipItem(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);
  let next = { ...state, equipment: { ...state.equipment, [slot]: null } };
  next = addItem(next, itemId, 1);
  return next;
}
```

Then change:

```js
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
  // Upgrade scaling (0.25/level) is fractional for most items; round each total
  // once so callers only ever see integer stats (HUD, battle, saved HP).
  for (const stat of Object.keys(bonuses)) {
    bonuses[stat] = Math.round(bonuses[stat]);
  }
  return bonuses;
}
```

to:

```js
export function getItemEffectiveStats(itemId, upgradeLevel = 0) {
  const item = ITEMS[itemId];
  const stats = { attack: 0, defense: 0, maxHp: 0, speed: 0 };
  for (const stat of Object.keys(stats)) {
    const base = item.stats?.[stat] || 0;
    stats[stat] = base + base * 0.25 * upgradeLevel;
  }
  return stats;
}

export function getEquipmentBonuses(state) {
  const bonuses = { attack: 0, defense: 0, maxHp: 0, speed: 0 };
  for (const slot of Object.keys(state.equipment)) {
    const itemId = state.equipment[slot];
    if (!itemId) continue;
    const upgradeLevel = state.upgrades?.[itemId] || 0;
    const itemStats = getItemEffectiveStats(itemId, upgradeLevel);
    for (const stat of Object.keys(bonuses)) {
      bonuses[stat] += itemStats[stat];
    }
  }
  // Upgrade scaling (0.25/level) is fractional for most items; round each total
  // once so callers only ever see integer stats (HUD, battle, saved HP).
  for (const stat of Object.keys(bonuses)) {
    bonuses[stat] = Math.round(bonuses[stat]);
  }
  return bonuses;
}

export function getItemStatDelta(state, itemId) {
  const item = ITEMS[itemId];
  const currentItemId = state.equipment[item.slot];
  const currentUpgrade = currentItemId ? (state.upgrades?.[currentItemId] || 0) : 0;
  const newUpgrade = state.upgrades?.[itemId] || 0;
  const currentStats = currentItemId
    ? getItemEffectiveStats(currentItemId, currentUpgrade)
    : { attack: 0, defense: 0, maxHp: 0, speed: 0 };
  const newStats = getItemEffectiveStats(itemId, newUpgrade);
  const delta = {};
  for (const stat of Object.keys(newStats)) {
    delta[stat] = Math.round(newStats[stat] - currentStats[stat]);
  }
  return delta;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all new tests plus the full existing suite (including the pre-existing `'getEquipmentBonuses sums stats from equipped, upgraded gear'` test, which must still pass unchanged — that's the byte-identical-output guarantee for the refactor).

- [ ] **Step 5: Commit**

```bash
git add js/systems/inventory.js tests/inventory.test.js
git commit -m "feat: add pure equip/unequip and stat-delta helpers to inventory system"
```

---

### Task 2: Slot-match the smith's upgrade materials

**Files:**
- Modify: `js/data/items.js`
- Modify: `js/systems/inventory.js`
- Modify: `js/screens/smithScreen.js`
- Modify: `tests/inventory.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: every material item in `ITEMS` gains an `upgradeSlot` field; `upgradeItem(state, slot, materialId, cost)` throws if `ITEMS[materialId].upgradeSlot !== slot` (in addition to its existing missing-material and insufficient-gold checks); `smithScreen.js`'s material dropdown is now computed per-slot instead of once globally. No other task depends on this task's outputs — Tasks 3 and 4 don't touch the smith or materials.

- [ ] **Step 1: Write the failing tests**

In `tests/inventory.test.js`, change the existing test:

```js
test('upgradeItem consumes gold and material, increasing upgrade level', () => {
  let state = createNewGame();
  state = addItem(state, 'leatherScrap', 1);
  state = upgradeItem(state, 'weapon', 'leatherScrap', 20);
  assert.equal(state.upgrades.starterSword, 1);
  assert.equal(state.player.gold, 0);
  const materialEntry = state.inventory.find((e) => e.itemId === 'leatherScrap');
  assert.equal(materialEntry, undefined);
});
```

to:

```js
test('upgradeItem consumes gold and material, increasing upgrade level', () => {
  let state = createNewGame();
  state = addItem(state, 'ironScrap', 1);
  state = upgradeItem(state, 'weapon', 'ironScrap', 20);
  assert.equal(state.upgrades.starterSword, 1);
  assert.equal(state.player.gold, 0);
  const materialEntry = state.inventory.find((e) => e.itemId === 'ironScrap');
  assert.equal(materialEntry, undefined);
});
```

Change the existing test:

```js
test('upgradeItem throws without the required material', () => {
  const state = createNewGame();
  assert.throws(() => upgradeItem(state, 'weapon', 'leatherScrap', 20));
});
```

to (this now uses a slot-matched-but-absent material, so it still isolates the "missing material" failure rather than accidentally testing the new slot-mismatch failure):

```js
test('upgradeItem throws without the required material', () => {
  const state = createNewGame();
  assert.throws(() => upgradeItem(state, 'weapon', 'ironScrap', 20));
});
```

Then add these new tests after it:

```js
test("upgradeItem throws when the material's upgradeSlot does not match the slot being upgraded", () => {
  let state = createNewGame();
  state = addItem(state, 'leatherScrap', 1); // upgradeSlot: body
  assert.throws(() => upgradeItem(state, 'weapon', 'leatherScrap', 20));
});

test('upgradeItem succeeds with a slot-matched material', () => {
  let state = createNewGame();
  state = addItem(state, 'ironScrap', 1); // upgradeSlot: weapon
  state = upgradeItem(state, 'weapon', 'ironScrap', 20);
  assert.equal(state.upgrades.starterSword, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — the two changed tests fail because `leatherScrap`/`ironScrap` don't have an `upgradeSlot` field yet so the new validation doesn't exist, and the new tests fail for the same reason.

- [ ] **Step 3: Add `upgradeSlot` to every material in `js/data/items.js`**

Change:

```js
  // Materials
  leatherScrap: { id: 'leatherScrap', name: 'Leather Scrap', emoji: '🟫', type: 'material' },
  batWing: { id: 'batWing', name: 'Bat Wing', emoji: '🦴', type: 'material' },
  snakeFang: { id: 'snakeFang', name: 'Snake Fang', emoji: '🦷', type: 'material' },
  ironScrap: { id: 'ironScrap', name: 'Iron Scrap', emoji: '🔩', type: 'material' },
  wolfPelt: { id: 'wolfPelt', name: 'Wolf Pelt', emoji: '🐾', type: 'material' },
  spiderSilk: { id: 'spiderSilk', name: 'Spider Silk', emoji: '🕸️', type: 'material' },
  orcTusk: { id: 'orcTusk', name: 'Orc Tusk', emoji: '🦷', type: 'material' },
  wraithEssence: { id: 'wraithEssence', name: 'Wraith Essence', emoji: '💠', type: 'material' },
};
```

to:

```js
  // Materials
  leatherScrap: { id: 'leatherScrap', name: 'Leather Scrap', emoji: '🟫', type: 'material', upgradeSlot: 'body' },
  batWing: { id: 'batWing', name: 'Bat Wing', emoji: '🦴', type: 'material', upgradeSlot: 'accessory' },
  snakeFang: { id: 'snakeFang', name: 'Snake Fang', emoji: '🦷', type: 'material', upgradeSlot: 'weapon' },
  ironScrap: { id: 'ironScrap', name: 'Iron Scrap', emoji: '🔩', type: 'material', upgradeSlot: 'weapon' },
  wolfPelt: { id: 'wolfPelt', name: 'Wolf Pelt', emoji: '🐾', type: 'material', upgradeSlot: 'legs' },
  spiderSilk: { id: 'spiderSilk', name: 'Spider Silk', emoji: '🕸️', type: 'material', upgradeSlot: 'head' },
  orcTusk: { id: 'orcTusk', name: 'Orc Tusk', emoji: '🦷', type: 'material', upgradeSlot: 'weapon' },
  wraithEssence: { id: 'wraithEssence', name: 'Wraith Essence', emoji: '💠', type: 'material', upgradeSlot: 'accessory' },
};
```

- [ ] **Step 4: Add the slot-match validation to `upgradeItem` in `js/systems/inventory.js`**

Change:

```js
export function upgradeItem(state, slot, materialId, cost) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);

  const hasMaterial = state.inventory.some((entry) => entry.itemId === materialId && entry.quantity > 0);
  if (!hasMaterial) throw new Error('Missing required material');
  if (state.player.gold < cost) throw new Error('Not enough gold');
```

to:

```js
export function upgradeItem(state, slot, materialId, cost) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);

  if (ITEMS[materialId].upgradeSlot !== slot) throw new Error(`${materialId} cannot upgrade the ${slot} slot`);

  const hasMaterial = state.inventory.some((entry) => entry.itemId === materialId && entry.quantity > 0);
  if (!hasMaterial) throw new Error('Missing required material');
  if (state.player.gold < cost) throw new Error('Not enough gold');
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all new/changed tests plus the full existing suite.

- [ ] **Step 6: Fix `smithScreen.js`'s material list to be per-slot instead of global**

Today, `materialOptions()` is computed once in `render()` and the exact same list is reused for every slot's dropdown — this is the root cause of the bug (any material shows up as valid for every slot). Change:

```js
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
```

to:

```js
function materialOptionsForSlot(slot) {
  return state.inventory.filter((entry) => {
    const item = ITEMS[entry.itemId];
    return item.type === 'material' && item.upgradeSlot === slot && entry.quantity > 0;
  });
}

function render() {
  const rows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="smith-row">${slot}: (empty)</div>`;

    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    const cost = upgradeCost(level);
    const materials = materialOptionsForSlot(slot);
    const options = materials
      .map((m) => `<option value="${m.itemId}">${ITEMS[m.itemId].name} (x${m.quantity})</option>`)
      .join('');

    return `<div class="smith-row">
      <span>${item.emoji} ${item.name} +${level}</span>
      <select data-slot="${slot}">${options}</select>
      <button data-slot="${slot}" ${materials.length === 0 ? 'disabled' : ''}>Upgrade (${cost}g)</button>
    </div>`;
  }).join('');
```

`tryUpgrade(slot)` needs no changes — it already reads the material id from the (now correctly filtered) `<select>`'s value and passes it straight to `upgradeItem`, which now independently validates the match too.

This module has no dedicated automated test (no DOM harness in this project, matching every other screen module) — verify by reading the diff that `materialOptionsForSlot` is now called once per slot inside the `SLOTS.map` loop, not once globally outside it.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add js/data/items.js js/systems/inventory.js js/screens/smithScreen.js tests/inventory.test.js
git commit -m "feat: slot-match smith upgrade materials"
```

---

### Task 3: `js/screens/inventoryScreen.js` — the inventory screen

**Files:**
- Create: `js/screens/inventoryScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `getItemStatDelta`, `equipItem`, `unequipItem` from `js/systems/inventory.js` (Task 1); `ITEMS` from `js/data/items.js`.
- Produces: `mount(root, props)` where `props` is `{ state, callbacks: { onChange: () => void, onClose: () => void } }`, and `unmount()`. `onChange` fires after every equip/unequip action (the screen re-renders itself immediately after, so `onChange` is purely for the caller to persist/refresh the HUD — it does not need to trigger a re-render). Follows the same shape as every other screen module, so it works with the existing `mountOverlay`/`unmountOverlay` in `js/screens/screenManager.js` with no changes there. Task 4 supplies `state` and the callbacks at mount time.

This module has no dedicated automated test — pure DOM rendering driven by props/callbacks and the already-tested pure functions from Task 1, matching `smithScreen.js`/`statsPanel.js`/`shopScreen.js`, none of which have test files either.

- [ ] **Step 1: Create `js/screens/inventoryScreen.js`**

```js
import { ITEMS } from '../data/items.js';
import { getItemStatDelta, equipItem, unequipItem } from '../systems/inventory.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory'];

let rootEl = null;
let state = null;
let callbacks = null;

function formatDelta(delta) {
  return Object.entries(delta)
    .filter(([, value]) => value !== 0)
    .map(([stat, value]) => `${stat} ${value > 0 ? '+' : ''}${value}`)
    .join(', ');
}

function renderEquippedRows() {
  return SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="inventory-row">${slot}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    return `<div class="inventory-row">
      <span>${slot}: ${item.emoji} ${item.name} +${level}</span>
      <button data-unequip="${slot}">Unequip</button>
    </div>`;
  }).join('');
}

function renderGearRows() {
  const gearEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].slot);
  if (gearEntries.length === 0) return '<div class="inventory-empty">No unequipped gear.</div>';
  return gearEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const delta = getItemStatDelta(state, entry.itemId);
    const deltaText = formatDelta(delta);
    const qtyText = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    return `<div class="inventory-row">
      <span>${item.emoji} ${item.name}${qtyText}${deltaText ? ` (${deltaText})` : ''}</span>
      <button data-equip="${entry.itemId}">Equip</button>
    </div>`;
  }).join('');
}

function renderMaterialRows() {
  const materialEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'material');
  if (materialEntries.length === 0) return '<div class="inventory-empty">No materials.</div>';
  return materialEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}

function renderConsumableRows() {
  const consumableEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'consumable');
  if (consumableEntries.length === 0) return '<div class="inventory-empty">No potions.</div>';
  return consumableEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}

function render() {
  rootEl.innerHTML = `
    <div class="overlay-panel inventory-panel">
      <h2>Inventory</h2>
      <h3>Equipment</h3>
      ${renderEquippedRows()}
      <h3>Gear</h3>
      ${renderGearRows()}
      <h3>Materials</h3>
      ${renderMaterialRows()}
      <h3>Potions</h3>
      ${renderConsumableRows()}
      <button id="btn-close-inventory">Close</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      Object.assign(state, equipItem(state, itemId, ITEMS[itemId].slot));
      callbacks.onChange();
      render();
    };
  });
  rootEl.querySelectorAll('button[data-unequip]').forEach((btn) => {
    btn.onclick = () => {
      Object.assign(state, unequipItem(state, btn.dataset.unequip));
      callbacks.onChange();
      render();
    };
  });
  document.getElementById('btn-close-inventory').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
```

- [ ] **Step 2: Add inventory-screen CSS to `css/styles.css`**

Change:

```css
.battle-menu button, .shop-row button, .smith-row button, #btn-leave, .start-screen button {
  margin: 4px; padding: 8px 12px; font-size: 1rem;
}
```

to:

```css
.battle-menu button, .shop-row button, .smith-row button, #btn-leave, .start-screen button, .inventory-panel button {
  margin: 4px; padding: 8px 12px; font-size: 1rem;
}
```

Then add these new rules anywhere after the `.new-game-row input` block:

```css
.inventory-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px solid #444;
}
.inventory-empty { color: #888; padding: 6px 0; font-size: 0.85rem; }
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (this file adds no new tests and isn't imported by anything yet — it's inert until Task 4 wires it in).

- [ ] **Step 4: Commit**

```bash
git add js/screens/inventoryScreen.js css/styles.css
git commit -m "feat: add inventory screen with equip/unequip and stat comparison"
```

---

### Task 4: Wire the inventory screen into the HUD and remove auto-equip-on-drop

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `inventoryScreen` module (Task 3, `mount(root, {state, callbacks: {onChange, onClose}})`); `getItemStatDelta`/`equipItem`/`unequipItem` are used only inside `inventoryScreen.js`, not directly by `main.js`.
- Produces: a new `🎒 Inventory` HUD button and `openInventory()` function; `setStatsButtonEnabled` is renamed to `setHudButtonsEnabled` and now toggles both HUD buttons together; the two auto-equip call sites in `handleTreasureFound` and `handleBattleEnd` are removed.

This task has no dedicated automated test — matches every other `main.js`/DOM-orchestration task in this project's history. Correctness rests on Task 1's own tests plus the manual verification in Step 7.

- [ ] **Step 1: Update imports**

Change:

```js
import * as statsPanel from './screens/statsPanel.js';
import * as startScreen from './screens/startScreen.js';
```

to:

```js
import * as statsPanel from './screens/statsPanel.js';
import * as inventoryScreen from './screens/inventoryScreen.js';
import * as startScreen from './screens/startScreen.js';
```

Change:

```js
import { addGold, addItem, equipItem, getEquipmentBonuses } from './systems/inventory.js';
```

to:

```js
import { addGold, addItem, getEquipmentBonuses } from './systems/inventory.js';
```

(`equipItem` is dropped because, after Step 4 of this task removes both of `main.js`'s auto-equip call sites, nothing in this file calls it anymore — it's only used inside `inventoryScreen.js` now, which imports it itself.)

- [ ] **Step 2: Rename `setStatsButtonEnabled` to `setHudButtonsEnabled` and have it toggle both buttons**

Change:

```js
function setStatsButtonEnabled(enabled) {
  const statsButton = document.getElementById('btn-open-stats');
  if (statsButton) {
    statsButton.disabled = !enabled;
  }
}
```

to:

```js
function setHudButtonsEnabled(enabled) {
  const statsButton = document.getElementById('btn-open-stats');
  if (statsButton) {
    statsButton.disabled = !enabled;
  }
  const inventoryButton = document.getElementById('btn-open-inventory');
  if (inventoryButton) {
    inventoryButton.disabled = !enabled;
  }
}
```

Then update its three call sites. Change (in `handleBossBattle`):

```js
  setStatsButtonEnabled(false);
  mountOverlay(bossPromptScreen, {
```

to:

```js
  setHudButtonsEnabled(false);
  mountOverlay(bossPromptScreen, {
```

Change (in `handleEncounter`):

```js
function handleEncounter(monsterId, monsterOverrides = null) {
  battleActive = true;
  setStatsButtonEnabled(false);
```

to:

```js
function handleEncounter(monsterId, monsterOverrides = null) {
  battleActive = true;
  setHudButtonsEnabled(false);
```

Change (in `handleBattleEnd`):

```js
function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();
  battleActive = false;
  setStatsButtonEnabled(true);
```

to:

```js
function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();
  battleActive = false;
  setHudButtonsEnabled(true);
```

- [ ] **Step 3: Add the Inventory HUD button and `openInventory`**

Change:

```js
function renderHud() {
  const bonuses = getEquipmentBonuses(state);
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp + bonuses.maxHp} Gold:${state.player.gold}`;

  const statsButton = document.createElement('button');
  statsButton.id = 'btn-open-stats';
  statsButton.textContent = '📊 Stats';
  statsButton.disabled = battleActive;
  statsButton.onclick = openStats;

  hud.appendChild(label);
  hud.appendChild(statsButton);
}

function openStats() {
  if (battleActive) return;
  mountOverlay(statsPanel, {
    state,
    callbacks: { onClose: () => unmountOverlay() },
  });
}
```

to:

```js
function renderHud() {
  const bonuses = getEquipmentBonuses(state);
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp + bonuses.maxHp} Gold:${state.player.gold}`;

  const statsButton = document.createElement('button');
  statsButton.id = 'btn-open-stats';
  statsButton.textContent = '📊 Stats';
  statsButton.disabled = battleActive;
  statsButton.onclick = openStats;

  const inventoryButton = document.createElement('button');
  inventoryButton.id = 'btn-open-inventory';
  inventoryButton.textContent = '🎒 Inventory';
  inventoryButton.disabled = battleActive;
  inventoryButton.onclick = openInventory;

  hud.appendChild(label);
  hud.appendChild(statsButton);
  hud.appendChild(inventoryButton);
}

function openStats() {
  if (battleActive) return;
  mountOverlay(statsPanel, {
    state,
    callbacks: { onClose: () => unmountOverlay() },
  });
}

function openInventory() {
  if (battleActive) return;
  mountOverlay(inventoryScreen, {
    state,
    callbacks: {
      onChange: () => { persist(); renderHud(); },
      onClose: () => unmountOverlay(),
    },
  });
}
```

- [ ] **Step 4: Remove auto-equip from `handleTreasureFound`**

Change:

```js
function handleTreasureFound() {
  if (!state.activeMiniDungeon) return;
  const { screenId, x, y } = state.activeMiniDungeon;
  if (isTreasureTaken(state.miniDungeons, screenId, x, y)) return;
  Object.assign(state, { miniDungeons: markTreasureTaken(state.miniDungeons, screenId, x, y) });
  const loot = rollMiniDungeonTreasure();
  Object.assign(state, addGold(state, loot.gold));
  Object.assign(state, addItem(state, loot.item, 1));
  const itemDef = ITEMS[loot.item];
  if (itemDef.slot && !state.equipment[itemDef.slot]) {
    Object.assign(state, equipItem(state, loot.item, itemDef.slot));
  }
  showFlavorBanner(`You found a treasure: ${loot.gold} gold and a ${itemDef.name}!`);
  persist();
  renderHud();
}
```

to:

```js
function handleTreasureFound() {
  if (!state.activeMiniDungeon) return;
  const { screenId, x, y } = state.activeMiniDungeon;
  if (isTreasureTaken(state.miniDungeons, screenId, x, y)) return;
  Object.assign(state, { miniDungeons: markTreasureTaken(state.miniDungeons, screenId, x, y) });
  const loot = rollMiniDungeonTreasure();
  Object.assign(state, addGold(state, loot.gold));
  Object.assign(state, addItem(state, loot.item, 1));
  const itemDef = ITEMS[loot.item];
  showFlavorBanner(`You found a treasure: ${loot.gold} gold and a ${itemDef.name}!`);
  persist();
  renderHud();
}
```

- [ ] **Step 5: Remove auto-equip from `handleBattleEnd`**

Change:

```js
    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
      const droppedItemDef = ITEMS[drop.item];
      if (droppedItemDef.slot) {
        Object.assign(state, equipItem(state, drop.item, droppedItemDef.slot));
      }
    }
    if (monster.isBoss) {
```

to:

```js
    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
    }
    if (monster.isBoss) {
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 7: Manual verification**

If a browser is available, run `python3 -m http.server` from the repo root, open `http://localhost:8000`, and:

- Confirm the HUD now shows both `📊 Stats` and `🎒 Inventory` buttons.
- Fight a monster that has a drop table, win, and confirm the dropped item lands in your inventory WITHOUT auto-equipping (check Stats — your old gear is still equipped).
- Open Inventory, confirm the new item appears in the Gear section with a stat delta, click Equip, confirm it moves to the Equipment section and the previously-equipped item reappears in Gear.
- Click Unequip on something, confirm it returns to the Gear section and the slot shows "(empty)".
- Confirm Materials and Potions sections show real counts matching what you're carrying.
- Confirm both HUD buttons are disabled during a battle and re-enabled after.
- At the smith, confirm each slot's material dropdown only offers slot-matched materials (per the Global Constraints table), and is empty/disabled if you don't have one for that slot.

If no browser is available (common in this environment), substitute with: (a) a hand-trace of the diff confirming `openInventory`/`renderHud`'s new button wiring and both auto-equip removals are correctly connected, and (b) a Node `--input-type=module` script that imports the real `js/systems/inventory.js` functions (`equipItem`, `unequipItem`, `getItemStatDelta`, `upgradeItem`) against a fake state object to replay the same sequence (equip an item, confirm the delta then equip then unequip round-trips correctly; attempt a mismatched-slot upgrade and confirm it throws; attempt a matched one and confirm it succeeds). Write what you did and found into your report either way.

- [ ] **Step 8: Commit**

```bash
git add js/main.js
git commit -m "feat: wire inventory screen into the HUD and remove auto-equip-on-drop"
```

---

## Self-Review Notes

- **Spec coverage:** `upgradeSlot` data field and exact mapping (Task 2), no-auto-equip-anywhere (Task 4's two removals), new Inventory HUD button separate from Stats with matching battle-disable behavior (Task 4), four-section inventory screen — Equipment/Gear/Materials/Potions (Task 3), stat delta on unequipped gear at real upgrade levels (Task 1's `getItemStatDelta`, consumed by Task 3), smith slot-matching validation and per-slot dropdown filtering (Task 2), shared `getItemEffectiveStats` refactor with round-once discipline (Task 1) — all covered.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code.
- **Type consistency:** `getItemEffectiveStats(itemId, upgradeLevel)` → `{attack, defense, maxHp, speed}` (Task 1) is consumed identically by `getEquipmentBonuses` (Task 1) and `getItemStatDelta` (Task 1), both rounding only once at their own aggregation point — verified no intermediate per-item rounding sneaks in anywhere. `unequipItem(state, slot)` (Task 1) matches exactly how Task 3's `inventoryScreen.js` calls it (`unequipItem(state, btn.dataset.unequip)`). `getItemStatDelta(state, itemId)` (Task 1) matches Task 3's `getItemStatDelta(state, entry.itemId)` call. `ITEMS[materialId].upgradeSlot` (Task 2's data change) matches exactly what Task 2's `upgradeItem` validation and `smithScreen.js`'s `materialOptionsForSlot` both read. `inventoryScreen.mount(root, {state, callbacks: {onChange, onClose}})` (Task 3) matches exactly how Task 4's `openInventory` calls `mountOverlay(inventoryScreen, {...})`.
