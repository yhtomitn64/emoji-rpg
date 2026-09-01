# Buff Potions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gold-sink buff-potion system: 10 new consumables, a 4-slot loadout configured from the Inventory screen, and an in-battle item quick-select menu (with a real slow-motion window, not a full pause) that drinks them.

**Architecture:** Two new pure-logic modules (`js/systems/buffPotions.js`, `js/systems/loadout.js`) hold all the new game rules and are unit-tested in isolation, matching how `js/systems/abilities.js`/`combat.js`/`parry.js` already separate rules from the `js/screens/*.js` DOM/integration layer. `battleScreen.js` gets a generalized `pauseBattle(timeScale)` (0 = today's hard stop, 0.25 = the new slow-mo), a new item quick-select overlay, and a single `recomputeEffectBonuses()` choke point so every existing combat call site that already reads `playerEffectBonuses.*` picks up active potion buffs for free, with zero changes to those call sites.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict`, jsdom via `tests/helpers/dom.js` for screen DOM tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-31-buff-potions-design.md`

## Global Constraints

- No new npm dependencies.
- New consumable bonus data lives in `ITEMS[id].stats`/`ITEMS[id].buffDurationMs` (same shape gear already uses via `js/systems/inventory.js`'s `STAT_KEYS`/`getEquipmentBonuses`) — never hand-duplicate bonus numbers in a second table.
- Timed buff duration: `12000` ms, defined once via each item's own `buffDurationMs`.
- Slow-mo time scale while the item quick-select menu is open: `0.25`.
- Loadout size: 4 slots, exported as `LOADOUT_SIZE` from `js/systems/loadout.js`.
- Every consumable added to `js/data/items.js` also needs an entry in `SHOP_CATALOG` (all 10 are purchasable — that's the point of the gold sink).
- Follow existing test conventions exactly: `node:test`/`node:assert/strict`, `tests/helpers/dom.js`'s `setupDom/teardownDom/createRoot/click/keydown`, the `sequence(...)` rng-mock pattern from `tests/loot.test.js`, and the save/restore-`Math.random` pattern from `tests/battleScreenDom.test.js`.
- Run `npm run test` (never `npm test`/`npx jest`) after every task and confirm a clean pass before committing.
- Per this repo's own `CLAUDE.md`: every commit touching non-doc files needs a `CHANGELOG.md` entry under `## [Unreleased]` (CI enforces this). Bump `Unreleased` into a dated version section, and add the matching `js/data/playerChangelog.js` entry, only in this plan's final task (Task 8's last step) — not after every task.

---

### Task 1: Buff potion item data

**Files:**
- Modify: `js/data/items.js`
- Test: `tests/data.test.js` (existing generic item-shape test already covers new entries — no new test file needed)

**Interfaces:**
- Produces: 10 new `ITEMS` keys — `strengthDraught`, `ironSkinTonic`, `swiftElixir`, `vampiricTonic`, `momentumElixir`, `emberVial`, `thornbarkDraught`, `focusTonic`, `berserkerTonic`, `secondWind`. The 8 timed ones carry `stats` + `buffDurationMs: 12000`; the 2 one-shots carry only `description`. All 10 added to `SHOP_CATALOG`. Later tasks (`buffPotions.js`, `battleScreen.js`) read these `stats`/`buffDurationMs` fields directly.

- [ ] **Step 1: Add the 10 items to `js/data/items.js`**

Insert a new `// Buff potions` section right after the existing `potion` (heal) entry (`js/data/items.js:60`):

```js
  // Buff potions - see docs/superpowers/specs/2026-08-31-buff-potions-design.md.
  // buffDurationMs marks the 8 timed ones; js/systems/buffPotions.js reads
  // it (plus `stats`, same shape/source of truth as equipped gear) to know
  // which consumables are timed buffs vs. the 2 one-shots below, which have
  // no stats/duration at all - their effect is a flag battleScreen.js sets
  // directly (see drinkPotion()/consumeGuaranteedCritBonus()/monsterAttack()).
  strengthDraught: { id: 'strengthDraught', name: 'Strength Draught', emoji: '💥', type: 'consumable', price: 35, stats: { attack: 6 }, buffDurationMs: 12000 },
  ironSkinTonic: { id: 'ironSkinTonic', name: 'Iron Skin Tonic', emoji: '🛡️', type: 'consumable', price: 35, stats: { defense: 4 }, buffDurationMs: 12000 },
  swiftElixir: { id: 'swiftElixir', name: 'Swift Elixir', emoji: '💨', type: 'consumable', price: 30, stats: { speed: 4 }, buffDurationMs: 12000 },
  vampiricTonic: { id: 'vampiricTonic', name: 'Vampiric Tonic', emoji: '🩸', type: 'consumable', price: 35, stats: { lifestealPercent: 15 }, buffDurationMs: 12000 },
  momentumElixir: { id: 'momentumElixir', name: 'Momentum Elixir', emoji: '🌀', type: 'consumable', price: 40, stats: { extraSwingChance: 12 }, buffDurationMs: 12000 },
  emberVial: { id: 'emberVial', name: 'Ember Vial', emoji: '🔥', type: 'consumable', price: 40, stats: { elementalProcChance: 20, elementalProcDamage: 5 }, buffDurationMs: 12000 },
  thornbarkDraught: { id: 'thornbarkDraught', name: 'Thornbark Draught', emoji: '🪵', type: 'consumable', price: 30, stats: { thornsPercent: 20 }, buffDurationMs: 12000 },
  focusTonic: { id: 'focusTonic', name: 'Focus Tonic', emoji: '🎯', type: 'consumable', price: 35, stats: { critChancePercent: 10 }, buffDurationMs: 12000 },
  berserkerTonic: { id: 'berserkerTonic', name: 'Berserker Tonic', emoji: '💢', type: 'consumable', price: 60, description: 'Your next hit is a guaranteed critical' },
  secondWind: { id: 'secondWind', name: 'Second Wind', emoji: '🕊️', type: 'consumable', price: 120, description: 'Survive one lethal hit at 1 HP this battle' },
```

- [ ] **Step 2: Add all 10 to `SHOP_CATALOG`**

`js/data/items.js:1-5` currently:

```js
export const SHOP_CATALOG = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves',
  'powerRing', 'clothCap', 'clothTunic', 'clothPants', 'luckyCharm', 'potion',
  'windGreaves', 'frostCharm',
];
```

Change to:

```js
export const SHOP_CATALOG = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves',
  'powerRing', 'clothCap', 'clothTunic', 'clothPants', 'luckyCharm', 'potion',
  'windGreaves', 'frostCharm',
  'strengthDraught', 'ironSkinTonic', 'swiftElixir', 'vampiricTonic', 'momentumElixir',
  'emberVial', 'thornbarkDraught', 'focusTonic', 'berserkerTonic', 'secondWind',
];
```

- [ ] **Step 3: Run the existing data test to confirm the new items are well-formed**

Run: `npm run test`
Expected: PASS (`tests/data.test.js`'s "every item has required fields" test already iterates all of `ITEMS`, so it covers the 10 new entries with no changes needed).

- [ ] **Step 4: Commit**

Add a `CHANGELOG.md` entry under `## [Unreleased]`:

```markdown
### Added
- 10 new buff-potion items (data only, not yet purchasable/usable in a
  battle - see follow-up commits) as part of the excess-gold-sink work.
```

```bash
git add js/data/items.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add 10 buff potion items to the item catalog

Data-only first step for the buff-potions gold sink - not yet
purchasable or usable in battle, see docs/superpowers/specs/
2026-08-31-buff-potions-design.md and the plan for the follow-up
commits that wire this up.

Claude-Session: https://claude.ai/code/session_01Kn5DNjPZVXGktscHQzQg3F
EOF
)"
```

---

### Task 2: `js/systems/buffPotions.js` — timed-buff stacking + one-shot IDs

**Files:**
- Create: `js/systems/buffPotions.js`
- Test: `tests/buffPotions.test.js`

**Interfaces:**
- Consumes: `ITEMS` from `js/data/items.js` (Task 1's `stats`/`buffDurationMs` fields).
- Produces: `ONE_SHOT_POTION_IDS` (array), `isTimedBuffPotion(itemId): boolean`, `createActiveBuffs(): []`, `activateTimedBuff(activeBuffs, itemId): activeBuffs`, `tickActiveBuffs(activeBuffs, dt): activeBuffs`, `getActiveBuffBonuses(activeBuffs): statsObject`, `combineBonuses(base, extra): statsObject`. `battleScreen.js` (Task 8) is the consumer.

- [ ] **Step 1: Write the failing tests**

Create `tests/buffPotions.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONE_SHOT_POTION_IDS, isTimedBuffPotion, createActiveBuffs, activateTimedBuff,
  tickActiveBuffs, getActiveBuffBonuses, combineBonuses,
} from '../js/systems/buffPotions.js';

test('ONE_SHOT_POTION_IDS lists exactly the two one-shot potions', () => {
  assert.deepEqual(ONE_SHOT_POTION_IDS, ['berserkerTonic', 'secondWind']);
});

test('isTimedBuffPotion is true for the 8 timed potions, false for one-shots and the heal potion', () => {
  assert.equal(isTimedBuffPotion('strengthDraught'), true);
  assert.equal(isTimedBuffPotion('focusTonic'), true);
  assert.equal(isTimedBuffPotion('berserkerTonic'), false);
  assert.equal(isTimedBuffPotion('secondWind'), false);
  assert.equal(isTimedBuffPotion('potion'), false);
});

test('createActiveBuffs starts empty', () => {
  assert.deepEqual(createActiveBuffs(), []);
});

test('activateTimedBuff adds a new entry with the item\'s own buffDurationMs', () => {
  const active = activateTimedBuff(createActiveBuffs(), 'strengthDraught');
  assert.deepEqual(active, [{ itemId: 'strengthDraught', remainingMs: 12000 }]);
});

test('activateTimedBuff on an already-active potion refreshes duration instead of stacking a duplicate', () => {
  let active = activateTimedBuff(createActiveBuffs(), 'strengthDraught');
  active = tickActiveBuffs(active, 5000); // remainingMs now 7000
  active = activateTimedBuff(active, 'strengthDraught');
  assert.deepEqual(active, [{ itemId: 'strengthDraught', remainingMs: 12000 }]);
});

test('activateTimedBuff stacks different potion types together', () => {
  let active = activateTimedBuff(createActiveBuffs(), 'strengthDraught');
  active = activateTimedBuff(active, 'swiftElixir');
  assert.deepEqual(active, [
    { itemId: 'strengthDraught', remainingMs: 12000 },
    { itemId: 'swiftElixir', remainingMs: 12000 },
  ]);
});

test('tickActiveBuffs counts down and drops expired entries', () => {
  let active = [{ itemId: 'strengthDraught', remainingMs: 1000 }];
  active = tickActiveBuffs(active, 300);
  assert.deepEqual(active, [{ itemId: 'strengthDraught', remainingMs: 700 }]);
  active = tickActiveBuffs(active, 700);
  assert.deepEqual(active, []);
});

test('tickActiveBuffs does not mutate the input array', () => {
  const input = [{ itemId: 'strengthDraught', remainingMs: 1000 }];
  tickActiveBuffs(input, 300);
  assert.deepEqual(input, [{ itemId: 'strengthDraught', remainingMs: 1000 }]);
});

test('getActiveBuffBonuses sums each active buff\'s own item stats', () => {
  const active = [{ itemId: 'strengthDraught', remainingMs: 1 }, { itemId: 'emberVial', remainingMs: 1 }];
  assert.deepEqual(getActiveBuffBonuses(active), { attack: 6, elementalProcChance: 20, elementalProcDamage: 5 });
});

test('getActiveBuffBonuses adds two active buffs on the same stat together', () => {
  // Contrived (no two real potions share a stat today), but the sum must
  // still be correct if that ever changes.
  const active = [{ itemId: 'strengthDraught', remainingMs: 1 }, { itemId: 'strengthDraught', remainingMs: 1 }];
  assert.deepEqual(getActiveBuffBonuses(active), { attack: 12 });
});

test('getActiveBuffBonuses returns an empty object with no active buffs', () => {
  assert.deepEqual(getActiveBuffBonuses([]), {});
});

test('combineBonuses adds extra onto base, only reading base\'s own keys', () => {
  const base = { attack: 5, defense: 3, speed: 0 };
  const extra = { attack: 6, elementalProcChance: 20 }; // elementalProcChance absent from base - must be ignored, not added as a new key
  assert.deepEqual(combineBonuses(base, extra), { attack: 11, defense: 3, speed: 0 });
});

test('combineBonuses with no extra bonuses returns base unchanged (new object)', () => {
  const base = { attack: 5 };
  const combined = combineBonuses(base, {});
  assert.deepEqual(combined, { attack: 5 });
  assert.notEqual(combined, base);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/buffPotions.test.js`
Expected: FAIL — `Cannot find module '../js/systems/buffPotions.js'`

- [ ] **Step 3: Implement `js/systems/buffPotions.js`**

```js
import { ITEMS } from '../data/items.js';

// One-shot potions (guaranteed-crit, Second Wind) apply once and clear a
// flag rather than running on a duration - see js/screens/battleScreen.js's
// consumeGuaranteedCritBonus() and the Second Wind check inside
// monsterAttack(). Timed buffs (the other 8) all set `buffDurationMs` on
// their ITEMS entry and use their own `stats` as the bonus - same shape
// and source of truth as equipped gear (js/systems/inventory.js's
// getEquipmentBonuses). See docs/superpowers/specs/2026-08-31-buff-
// potions-design.md.
export const ONE_SHOT_POTION_IDS = ['berserkerTonic', 'secondWind'];

export function isTimedBuffPotion(itemId) {
  const item = ITEMS[itemId];
  return !!item && item.type === 'consumable' && !!item.buffDurationMs;
}

export function createActiveBuffs() {
  return [];
}

// Drinking a potion whose buff is already active refreshes its duration
// instead of stacking a second copy of the same stat bonus - stacking is
// for *different* potion types running together (e.g. Strength Draught +
// Swift Elixir), not multiple charges of the same one.
export function activateTimedBuff(activeBuffs, itemId) {
  const withoutExisting = activeBuffs.filter((buff) => buff.itemId !== itemId);
  return [...withoutExisting, { itemId, remainingMs: ITEMS[itemId].buffDurationMs }];
}

export function tickActiveBuffs(activeBuffs, dt) {
  return activeBuffs
    .map((buff) => ({ ...buff, remainingMs: Math.max(0, buff.remainingMs - dt) }))
    .filter((buff) => buff.remainingMs > 0);
}

// Sums every active buff's own `stats` (its ITEMS entry) into one bonus
// object - same shape as getEquipmentBonuses' return value, so it can be
// added directly onto it (see combineBonuses).
export function getActiveBuffBonuses(activeBuffs) {
  const bonuses = {};
  for (const buff of activeBuffs) {
    const stats = ITEMS[buff.itemId].stats || {};
    for (const [stat, value] of Object.entries(stats)) {
      bonuses[stat] = (bonuses[stat] || 0) + value;
    }
  }
  return bonuses;
}

// Adds `extra`'s stats on top of `base` (a full STAT_KEYS-shaped object,
// e.g. the equipment-only bonuses from getEquipmentBonuses) - only base's
// own keys are read, so `extra` doesn't need to carry every key.
export function combineBonuses(base, extra) {
  const combined = { ...base };
  for (const stat of Object.keys(base)) {
    combined[stat] += extra[stat] || 0;
  }
  return combined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS (all tests, including the new `tests/buffPotions.test.js`)

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]`:

```markdown
### Added
- `js/systems/buffPotions.js`: pure logic for stacking timed potion buffs
  and identifying one-shot potions (not yet wired into battle).
```

```bash
git add js/systems/buffPotions.js tests/buffPotions.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add buffPotions.js system module for stacking timed potion buffs

Pure logic only (activate/tick/sum bonuses, one-shot ID list) - not yet
wired into a battle. See docs/superpowers/specs/2026-08-31-buff-
potions-design.md.

Claude-Session: https://claude.ai/code/session_01Kn5DNjPZVXGktscHQzQg3F
EOF
)"
```

---

### Task 3: Loadout state + `js/systems/loadout.js`

**Files:**
- Modify: `js/state.js`, `js/main.js`
- Create: `js/systems/loadout.js`
- Test: `tests/loadout.test.js`, add cases to `tests/state.test.js`

**Interfaces:**
- Produces: `state.loadout` — a 4-element array of `itemId | null`, defaulting to `['potion', null, null, null]` (keeps the "press i to heal" default working with zero setup). `migrateLoadout(state)` in `state.js`. `LOADOUT_SIZE`, `createEmptyLoadout()`, `setLoadoutSlot(loadout, slotIndex, itemId)`, `clearLoadoutSlot(loadout, slotIndex)`, `loadoutSlotsForItem(loadout, itemId)` from `loadout.js`. Consumed by Task 4 (Inventory screen) and Task 7 (battle quick-select).

- [ ] **Step 1: Write the failing tests**

Create `tests/loadout.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOADOUT_SIZE, createEmptyLoadout, setLoadoutSlot, clearLoadoutSlot, loadoutSlotsForItem,
} from '../js/systems/loadout.js';

test('LOADOUT_SIZE is 4', () => {
  assert.equal(LOADOUT_SIZE, 4);
});

test('createEmptyLoadout returns 4 empty slots', () => {
  assert.deepEqual(createEmptyLoadout(), [null, null, null, null]);
});

test('setLoadoutSlot assigns an item to a slot, bumping out the previous occupant', () => {
  const loadout = setLoadoutSlot(createEmptyLoadout(), 1, 'strengthDraught');
  assert.deepEqual(loadout, [null, 'strengthDraught', null, null]);
  const replaced = setLoadoutSlot(loadout, 1, 'swiftElixir');
  assert.deepEqual(replaced, [null, 'swiftElixir', null, null]);
});

test('setLoadoutSlot removes the item from any other slot it already occupied', () => {
  const loadout = setLoadoutSlot(setLoadoutSlot(createEmptyLoadout(), 0, 'potion'), 2, 'potion');
  assert.deepEqual(loadout, [null, null, 'potion', null]);
});

test('setLoadoutSlot does not mutate the input array', () => {
  const input = createEmptyLoadout();
  setLoadoutSlot(input, 0, 'potion');
  assert.deepEqual(input, [null, null, null, null]);
});

test('clearLoadoutSlot empties one slot, leaving the others alone', () => {
  const loadout = ['potion', 'strengthDraught', null, null];
  assert.deepEqual(clearLoadoutSlot(loadout, 1), ['potion', null, null, null]);
});

test('loadoutSlotsForItem returns every slot index holding the given item', () => {
  const loadout = ['potion', 'strengthDraught', 'potion', null];
  assert.deepEqual(loadoutSlotsForItem(loadout, 'potion'), [0, 2]);
  assert.deepEqual(loadoutSlotsForItem(loadout, 'swiftElixir'), []);
});
```

Add to `tests/state.test.js` (open the file first to match its existing import/style, then append):

```js
test('createNewGame starts with the heal potion loaded into loadout slot 1', () => {
  const state = createNewGame();
  assert.deepEqual(state.loadout, ['potion', null, null, null]);
});

test('migrateLoadout adds the default loadout to a save from before it existed', () => {
  const legacy = createNewGame();
  delete legacy.loadout;
  const migrated = migrateLoadout(legacy);
  assert.deepEqual(migrated.loadout, ['potion', null, null, null]);
});

test('migrateLoadout is a no-op once loadout already exists', () => {
  const state = { ...createNewGame(), loadout: ['strengthDraught', null, null, null] };
  const migrated = migrateLoadout(state);
  assert.deepEqual(migrated.loadout, ['strengthDraught', null, null, null]);
});
```

(Add `migrateLoadout` to that test file's existing `import { createNewGame, ... } from '../js/state.js';` line.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/loadout.test.js tests/state.test.js`
Expected: FAIL — `Cannot find module '../js/systems/loadout.js'` and `migrateLoadout is not a function` / `state.loadout` assertions failing.

- [ ] **Step 3: Implement `js/systems/loadout.js`**

```js
export const LOADOUT_SIZE = 4;

export function createEmptyLoadout() {
  return Array(LOADOUT_SIZE).fill(null);
}

// Also clears itemId from any OTHER slot it already occupied, so the same
// potion can never occupy two slots at once - the 4-slot cap is about
// choosing 4 *distinct* potions to bring, not filling every slot with the
// same one.
export function setLoadoutSlot(loadout, slotIndex, itemId) {
  const next = loadout.map((slotItemId) => (slotItemId === itemId ? null : slotItemId));
  next[slotIndex] = itemId;
  return next;
}

export function clearLoadoutSlot(loadout, slotIndex) {
  const next = [...loadout];
  next[slotIndex] = null;
  return next;
}

// Which slot(s) (if any) a given item currently occupies - a Potions-tab
// row uses this to light up its own numbered toggle buttons.
export function loadoutSlotsForItem(loadout, itemId) {
  return loadout.reduce((slots, slotItemId, index) => {
    if (slotItemId === itemId) slots.push(index);
    return slots;
  }, []);
}
```

- [ ] **Step 4: Add `loadout` to `state.js` and write `migrateLoadout`**

In `js/state.js`, inside `createNewGame()` (`js/state.js:45-82`), add a `loadout` field. Insert right after the `inventory` line (`js/state.js:51`):

```js
    inventory: [{ itemId: 'potion', quantity: 2 }],
    // The heal potion starts pre-loaded into slot 1 so the existing "press
    // i to heal" battle habit keeps working with zero setup - the other 3
    // slots are for the player to fill in from the Inventory screen's
    // Potions tab. See docs/superpowers/specs/2026-08-31-buff-potions-
    // design.md.
    loadout: ['potion', null, null, null],
```

Add `migrateLoadout` right after `migrateBestDamage` (`js/state.js:120-123`):

```js
// One-time migration for saves from before the potion loadout existed -
// defaults to the same starting loadout createNewGame() gives a fresh
// save (heal potion in slot 1, rest empty), so an existing player's Item
// button keeps healing exactly as before with no extra setup needed.
export function migrateLoadout(state) {
  if ('loadout' in state) return state;
  return { ...state, loadout: ['potion', null, null, null] };
}
```

- [ ] **Step 5: Wire `migrateLoadout` into `js/main.js`'s migration chain**

`js/main.js:1` currently:

```js
import { loadState, saveState, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION, migrateRingSlots, migrateBestDamage } from './state.js';
```

Change to:

```js
import { loadState, saveState, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION, migrateRingSlots, migrateBestDamage, migrateLoadout } from './state.js';
```

`js/main.js:122-125` currently:

```js
  state = migrateUpgradesToPerTier(loadedState);
  state = migrateNgPlusToolCarryover(state);
  state = migrateRingSlots(state);
  state = migrateBestDamage(state);
```

Change to:

```js
  state = migrateUpgradesToPerTier(loadedState);
  state = migrateNgPlusToolCarryover(state);
  state = migrateRingSlots(state);
  state = migrateBestDamage(state);
  state = migrateLoadout(state);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]`:

```markdown
### Added
- Potion loadout state (`state.loadout`, 4 slots, defaults to the heal
  potion in slot 1) and `js/systems/loadout.js` for assigning slots - not
  yet exposed in any screen.
```

```bash
git add js/state.js js/main.js js/systems/loadout.js tests/loadout.test.js tests/state.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add potion loadout state and js/systems/loadout.js

state.loadout (4 slots, defaults to the heal potion in slot 1) plus a
migration for existing saves and pure slot-assignment logic - not yet
exposed in any screen. See docs/superpowers/specs/2026-08-31-buff-
potions-design.md.

Claude-Session: https://claude.ai/code/session_01Kn5DNjPZVXGktscHQzQg3F
EOF
)"
```

---

### Task 4: Inventory screen loadout UI

**Files:**
- Modify: `js/screens/inventoryScreen.js`, `css/styles.css`, `tests/inventoryScreenDom.test.js` (fixture fix)

**Interfaces:**
- Consumes: `LOADOUT_SIZE`, `setLoadoutSlot`, `clearLoadoutSlot` from `js/systems/loadout.js` (Task 3).
- Produces: numbered toggle buttons on every Potions-tab row; clicking one assigns/unassigns that item to that loadout slot. Also fixes a real bug: the existing "Use" button (heal-only) would corrupt HP to `NaN` if rendered for one of Task 1's new non-heal consumables — it's now gated on `item.heal`.

- [ ] **Step 1: Fix the existing test fixture (it has no `loadout`, which the new code will read)**

`tests/inventoryScreenDom.test.js`'s `buildState()` (`tests/inventoryScreenDom.test.js:10-25`) is a hand-built state object, not `createNewGame()`-based, and doesn't include `loadout`. Add it so the Potions tab doesn't crash reading `state.loadout[index]` on `undefined`:

```js
function buildState() {
  return {
    player: { hp: 20, maxHp: 20, gold: 0 },
    equipment: { weapon: null, head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: {},
    upgrades: {},
    loadout: [null, null, null, null],
    inventory: [
      { itemId: 'ironSword', quantity: 1 },
      { itemId: 'clothCap', quantity: 1, tier: 'superior' },
      { itemId: 'clothTunic', quantity: 1, tier: 'fine' },
      { itemId: 'leatherScrap', quantity: 5 },
      { itemId: 'ironScrap', quantity: 2 },
      { itemId: 'batWing', quantity: 9 },
      { itemId: 'potion', quantity: 3 },
      { itemId: 'strengthDraught', quantity: 2 },
      { itemId: 'miningPick', quantity: 1 },
      { itemId: 'axe', quantity: 1 },
    ],
  };
}
```

(Added `strengthDraught` to the fixture's inventory too, so the new tests below have a non-heal consumable to exercise.)

- [ ] **Step 2: Write the new failing tests**

Append to the `test('inventoryScreen DOM', ...)` block in `tests/inventoryScreenDom.test.js` (find the Potions tab's tab-switch button id first — follow the existing pattern used for switching tabs elsewhere in this file, e.g. `click(root.querySelector('[data-tab="consumable"]'))`, matching whatever `TABS`' `id` values render as in `inventoryScreen.js`'s tab buttons):

```js
  await t.test('Potions tab rows show 4 loadout toggle buttons, and only the heal potion shows a Use button', async () => {
    const root = await mountInventory(buildState());
    click(root.querySelector('[data-tab="consumable"]'));
    const rows = [...root.querySelectorAll('.inventory-tab-content .inventory-row')];
    const potionRow = rows.find((row) => row.textContent.includes('Potion'));
    const draughtRow = rows.find((row) => row.textContent.includes('Strength Draught'));
    assert.equal(potionRow.querySelectorAll('button[data-loadout-slot]').length, 4);
    assert.ok(potionRow.querySelector('button[data-use]'));
    assert.equal(draughtRow.querySelectorAll('button[data-loadout-slot]').length, 4);
    assert.equal(draughtRow.querySelector('button[data-use]'), null);
  });

  await t.test('clicking a loadout slot button assigns the item, bumping out any previous occupant', async () => {
    const state = buildState();
    const root = await mountInventory(state);
    click(root.querySelector('[data-tab="consumable"]'));
    const potionSlot1 = [...root.querySelectorAll('.inventory-row')]
      .find((row) => row.textContent.includes('Potion x'))
      .querySelector('button[data-loadout-slot="0"]');
    click(potionSlot1);
    assert.deepEqual(state.loadout, ['potion', null, null, null]);
    const draughtSlot1 = [...root.querySelectorAll('.inventory-row')]
      .find((row) => row.textContent.includes('Strength Draught'))
      .querySelector('button[data-loadout-slot="0"]');
    click(draughtSlot1);
    assert.deepEqual(state.loadout, ['strengthDraught', null, null, null]);
  });

  await t.test('clicking an already-assigned loadout slot button unassigns it', async () => {
    const state = { ...buildState(), loadout: ['potion', null, null, null] };
    const root = await mountInventory(state);
    click(root.querySelector('[data-tab="consumable"]'));
    const potionSlot1 = [...root.querySelectorAll('.inventory-row')]
      .find((row) => row.textContent.includes('Potion x'))
      .querySelector('button[data-loadout-slot="0"]');
    click(potionSlot1);
    assert.deepEqual(state.loadout, [null, null, null, null]);
  });
```

(Verified: `js/screens/inventoryScreen.js:120` renders tab buttons as `<button class="inventory-tab-btn..." data-tab="${tab.id}">`, so `root.querySelector('[data-tab="consumable"]')` above is correct as written.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/inventoryScreenDom.test.js`
Expected: FAIL — no `data-loadout-slot` buttons exist yet.

- [ ] **Step 4: Implement the inventory screen changes**

In `js/screens/inventoryScreen.js`, add the import (alongside the existing `import { tierLabel } from '../systems/itemQuality.js';` at line 5):

```js
import { LOADOUT_SIZE, setLoadoutSlot, clearLoadoutSlot } from '../systems/loadout.js';
```

Add a new helper function right before `renderConsumableRows` (`js/screens/inventoryScreen.js:98`):

```js
function loadoutToggleButtonsHtml(itemId) {
  return Array.from({ length: LOADOUT_SIZE }, (_, index) => {
    const active = state.loadout[index] === itemId;
    return `<button class="inventory-loadout-slot-btn${active ? ' active' : ''}" data-loadout-slot="${index}" data-loadout-item="${itemId}" title="Loadout slot ${index + 1}">${index + 1}</button>`;
  }).join('');
}
```

Replace `renderConsumableRows` (`js/screens/inventoryScreen.js:98-109`):

```js
function renderConsumableRows(entries) {
  if (entries.length === 0) return '<div class="inventory-empty">No potions.</div>';
  const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
  const atFullHp = state.player.hp >= effectiveMaxHp;
  return entries.map((entry) => {
    const item = ITEMS[entry.itemId];
    // Only the heal potion has a `heal` field - the Use button drinks it
    // outside of battle. The 10 buff potions are battle-only (see the
    // loadout + item quick-select menu in battleScreen.js) - rendering a
    // Use button for one of those used to call applyHeal() with an
    // undefined heal amount, corrupting player HP to NaN.
    const useButton = item.heal ? `<button data-use="${entry.itemId}" ${atFullHp ? 'disabled' : ''}>Use</button>` : '';
    return `<div class="inventory-row">
      <span title="${describeItem(state, entry.itemId)}">${item.emoji} ${item.name} x${entry.quantity}</span>
      <span class="inventory-loadout-slots">${loadoutToggleButtonsHtml(entry.itemId)}</span>
      ${useButton}
    </div>`;
  }).join('');
}
```

Add the click wiring right after the existing `rootEl.querySelectorAll('button[data-use]')...` block (`js/screens/inventoryScreen.js:181-191`):

```js
  rootEl.querySelectorAll('button[data-loadout-slot]').forEach((btn) => {
    btn.onclick = () => {
      const slotIndex = Number(btn.dataset.loadoutSlot);
      const itemId = btn.dataset.loadoutItem;
      const alreadyInSlot = state.loadout[slotIndex] === itemId;
      state.loadout = alreadyInSlot ? clearLoadoutSlot(state.loadout, slotIndex) : setLoadoutSlot(state.loadout, slotIndex, itemId);
      callbacks.onChange();
      render();
    };
  });
```

- [ ] **Step 5: Add CSS**

In `css/styles.css`, add right after the `.inventory-empty` rule (`css/styles.css:855`):

```css
.inventory-loadout-slots {
  display: flex;
  gap: 4px;
}
.inventory-loadout-slot-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 0.75rem;
  background: #222;
  border: 1px solid #444;
  border-radius: 4px;
  color: #888;
  cursor: pointer;
}
.inventory-loadout-slot-btn.active {
  background: #4a7a4a;
  color: #fff;
  border-color: #7bbf7b;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]`:

```markdown
### Added
- Inventory screen: Potions tab rows now show 4 loadout toggle buttons for
  assigning a potion to a battle quick-select slot (not yet usable in
  battle - see follow-up commits).

### Fixed
- Inventory screen's potion "Use" button no longer renders for non-heal
  consumables, which would have corrupted player HP to NaN.
```

```bash
git add js/screens/inventoryScreen.js css/styles.css tests/inventoryScreenDom.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add loadout slot toggles to the Inventory Potions tab

Also fixes a latent bug where the "Use" button (heal-only) would have
rendered for the new non-heal buff potions and corrupted HP to NaN.
Loadout still isn't consumed by battle yet - see the plan's remaining
tasks.

Claude-Session: https://claude.ai/code/session_01Kn5DNjPZVXGktscHQzQg3F
EOF
)"
```

---

### Task 5: Potion drops from monster kills

**Files:**
- Modify: `js/systems/loot.js`, `js/main.js`
- Test: `tests/loot.test.js`

**Interfaces:**
- Produces: `POTION_DROP_CHANCE` (0.08), `POTION_DROP_POOL` (weighted array of potion ids). `rollDrop()`'s return value gains a `potionId` field (`null` or one of the 10 potion ids), independent of `item`/`tier` — a kill can grant both a regular item AND a potion in the same roll. `js/main.js`'s battle-reward code grants it via the existing `grantDropItem` helper.

- [ ] **Step 1: Write the failing tests**

Add to `tests/loot.test.js` (append near the end, using the existing `monster`/`sequence` helpers already defined in that file):

```js
test('rollDrop never grants a potion when the roll misses POTION_DROP_CHANCE', () => {
  const drop = rollDrop(monster, sequence(0.5, 0.5, 0.99)); // gold, dropTable, potion-chance roll (0.99 misses 0.08)
  assert.equal(drop.potionId, null);
});

test('rollDrop grants a potion from POTION_DROP_POOL when the roll lands inside POTION_DROP_CHANCE', () => {
  const drop = rollDrop(monster, sequence(0.5, 0.5, 0.01, 0)); // last two: potion-chance roll (hits), pool pick index 0
  assert.equal(drop.potionId, POTION_DROP_POOL[0]);
});

test('a potion drop can happen alongside a regular item drop from the same kill', () => {
  const drop = rollDrop(monster, sequence(0.5, 0.1, 0.01, 0)); // gold, dropTable roll lands inside leatherScrap's 0.3 chance, potion roll hits
  assert.equal(drop.item, 'leatherScrap');
  assert.equal(drop.potionId, POTION_DROP_POOL[0]);
});

test('POTION_DROP_POOL only contains real potion item ids', () => {
  for (const itemId of POTION_DROP_POOL) {
    assert.ok(ITEMS[itemId], `${itemId} is not a real item`);
    assert.equal(ITEMS[itemId].type, 'consumable');
  }
});
```

Update the file's import line to include the new exports:

```js
import { rollDrop, getItemSources, EQUIPMENT_DROP_CHANCE, EQUIPMENT_DROP_POOL, UNIQUE_EFFECT_ITEM_IDS, POTION_DROP_CHANCE, POTION_DROP_POOL } from '../js/systems/loot.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/loot.test.js`
Expected: FAIL — `POTION_DROP_POOL is not exported` / `drop.potionId` is `undefined`.

- [ ] **Step 3: Implement the loot.js change**

Add near the top of `js/systems/loot.js`, after `UNIQUE_EFFECT_ITEM_IDS` (`js/systems/loot.js:13`):

```js
export const POTION_DROP_CHANCE = 0.08;
// Repeated entries weight the pick toward the cheaper timed buffs and
// rarer for the two pricier one-shots.
export const POTION_DROP_POOL = [
  'strengthDraught', 'strengthDraught', 'strengthDraught',
  'ironSkinTonic', 'ironSkinTonic', 'ironSkinTonic',
  'swiftElixir', 'swiftElixir', 'swiftElixir',
  'vampiricTonic', 'vampiricTonic', 'vampiricTonic',
  'momentumElixir', 'momentumElixir',
  'emberVial', 'emberVial',
  'thornbarkDraught', 'thornbarkDraught',
  'focusTonic', 'focusTonic',
  'berserkerTonic',
  'secondWind',
];
```

Change `rollDrop`'s return statement (`js/systems/loot.js:102`) from:

```js
  return { gold, item, tier };
}
```

to:

```js
  // Independent of the item/tier roll above (not competing for the "one
  // bonus item per kill" slot) - a kill can grant both a regular item AND
  // a potion in the same roll.
  let potionId = null;
  if (rng() < POTION_DROP_CHANCE) {
    potionId = pickRandom(POTION_DROP_POOL, rng);
  }

  return { gold, item, tier, potionId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS. Also spot-check `tests/loot.test.js`'s pre-existing tests still pass unchanged (they use a constant-returning rng like `() => 0.1`, which now also feeds the new potion-chance roll — confirm none of their assertions touch `potionId` and none break; they don't, since `rollDrop`'s new field is additive).

- [ ] **Step 5: Wire the grant in `js/main.js`**

`js/main.js:750-756` currently:

```js
      const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
      const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);
      const gold = Math.round(drop.gold * rewardMultiplier.gold);
      Object.assign(state, addGold(state, gold));
      if (drop.item) {
        grantDropItem(drop.item, drop.tier);
      }
```

Change to:

```js
      const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
      const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);
      const gold = Math.round(drop.gold * rewardMultiplier.gold);
      Object.assign(state, addGold(state, gold));
      if (drop.item) {
        grantDropItem(drop.item, drop.tier);
      }
      if (drop.potionId) {
        grantDropItem(drop.potionId);
      }
```

(`grantDropItem`'s `tier` param is omitted here — potions have no tier concept, and `tierLabel(undefined)` already returns `''`, matching how the function is documented/used elsewhere.)

- [ ] **Step 6: Run the full suite once more**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]`:

```markdown
### Added
- Monster kills now have an 8% independent chance to also drop a random
  buff potion, on top of the existing gold/item roll.
```

```bash
git add js/systems/loot.js js/main.js tests/loot.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add a chance for monster kills to drop buff potions

Independent 8% roll, additive to the existing gold/item drop - a kill
can grant both in the same roll.

Claude-Session: https://claude.ai/code/session_01Kn5DNjPZVXGktscHQzQg3F
EOF
)"
```

---

### Task 6: Battle slow-mo pause (generalize `pauseBattle`/`resumeBattle`)

**Files:**
- Modify: `js/screens/battleScreen.js`
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Produces: `pauseBattle(timeScale = 0)` — `0` reproduces today's exact hard-stop behavior (used by the existing P-key pause); a fractional value (Task 7 will pass `0.25`) keeps the 300ms tick interval running at a scaled real-time rate and slows (rather than freezes) monster windup/parry-zone CSS animations via the Web Animations API, guarded for environments (jsdom) with no `getAnimations()`. `resumeBattle()` reverses either case using the same `shiftWindupStart` real-clock-compensation `pauseBattle`/`resumeBattle` already use, generalized to `pausedForMs * (1 - timeScale)`. `toggleBattlePause()` unchanged in behavior for `0`.

- [ ] **Step 1: Record the current passing baseline, since this task adds no new tests of its own**

There is no way to observe `pauseBattle(timeScale)` through the public `mount`/`unmount` surface until Task 7 wires a real caller to it (the item quick-select menu calling `pauseBattle(0.25)`) — a test written now couldn't exercise the new behavior, only the unchanged `timeScale = 0` path the existing pause tests already cover. So this task ships the generalized implementation with **no new test file changes**, and Task 7 (which adds slow-mo-observing tests once `openItemMenu()` exists) is what actually proves the fractional-`timeScale` path works. Confirm the existing suite is green before touching `battleScreen.js`, so any regression this task introduces in the `timeScale = 0` path is caught by Step 3 below.

Run: `npm run test`
Expected: PASS (baseline, nothing changed yet).

- [ ] **Step 2: Implement the `pauseBattle`/`resumeBattle` generalization**

Add two module-level variables near the existing `let battlePaused = false;`/`let pauseStartedAt = 0;` declarations (search for `pauseStartedAt`):

```js
let pauseTimeScale = 0;
```

Replace `pauseBattle` (`js/screens/battleScreen.js:1602-1617`, the function starting `function pauseBattle() {`):

```js
// timeScale: 0 = hard stop (today's P-key pause). A fractional value like
// 0.25 keeps combat ticking at a reduced real-time rate instead of
// freezing it outright - used by the item quick-select menu (Task 7),
// which wants some ongoing urgency rather than a full freeze. Everything
// driven purely off tick()'s own fixed per-call deltas (ATB gauges,
// cooldowns, buffs, defense debuffs) speeds/slows for free just by
// changing how often tick() itself fires - only the real-clock-driven
// windup/parry-zone CSS animations need their own explicit scaling below.
// getAnimations() is the Web Animations API - guarded with `?.()` since
// jsdom (this file's own test environment) doesn't implement it; the
// slow-mo visual is a no-op there, tick()'s own scaled interval still
// works fine.
function pauseBattle(timeScale = 0) {
  if (battlePaused || battleOver) return;
  battlePaused = true;
  pauseTimeScale = timeScale;
  pauseStartedAt = Date.now();
  clearInterval(intervalId);
  intervalId = timeScale > 0 ? setInterval(tick, 300 / timeScale) : null;
  monsterCombatants.forEach((mc, i) => {
    if (mc.windup.active) {
      if (timeScale > 0) {
        (elements.monsterAtbFills[i].getAnimations?.() || []).forEach((anim) => { anim.playbackRate = timeScale; });
        (elements.monsterParryZones[i].getAnimations?.() || []).forEach((anim) => { anim.playbackRate = timeScale; });
      } else {
        elements.monsterAtbFills[i].style.animationPlayState = 'paused';
        elements.monsterParryZones[i].style.animationPlayState = 'paused';
      }
    }
  });
  if (activeTimingMeterHandle) activeTimingMeterHandle.pause();
  if (timeScale === 0) {
    elements.pauseBtn.textContent = '▶️';
    elements.pauseBtn.title = 'Resume battle (P)';
    elements.pausedOverlay.hidden = false;
  }
}
```

Replace `resumeBattle` (immediately following, `js/screens/battleScreen.js:1619-1634`):

```js
function resumeBattle() {
  if (!battlePaused) return;
  const pausedForMs = Date.now() - pauseStartedAt;
  const timeScale = pauseTimeScale;
  battlePaused = false;
  pauseTimeScale = 0;
  // Only (1 - timeScale) of the elapsed real time should be hidden from
  // windup's real-clock progress - at timeScale 0 (hard stop) that's the
  // full elapsed duration, exactly matching this function's behavior
  // before it took a scale factor at all.
  const offsetMs = pausedForMs * (1 - timeScale);
  monsterCombatants.forEach((mc, i) => {
    if (mc.windup.active) {
      mc.windup = shiftWindupStart(mc.windup, offsetMs);
      elements.monsterAtbFills[i].style.animationPlayState = 'running';
      elements.monsterParryZones[i].style.animationPlayState = 'running';
      (elements.monsterAtbFills[i].getAnimations?.() || []).forEach((anim) => { anim.playbackRate = 1; });
      (elements.monsterParryZones[i].getAnimations?.() || []).forEach((anim) => { anim.playbackRate = 1; });
    }
  });
  if (activeTimingMeterHandle) activeTimingMeterHandle.resume();
  intervalId = setInterval(tick, 300);
  elements.pauseBtn.textContent = '⏸️';
  elements.pauseBtn.title = 'Pause battle (P)';
  elements.pausedOverlay.hidden = true;
}
```

`toggleBattlePause()` (`js/screens/battleScreen.js:1636-1639`) stays as-is for now — Task 7 adds an `itemMenuOpen` guard to it.

- [ ] **Step 3: Run the full suite to confirm nothing regressed**

Run: `npm run test`
Expected: PASS — every existing pause-related test (P-key toggle, windup timing) must still pass unchanged, since `pauseBattle()` with no argument defaults to `timeScale = 0`, reproducing the exact prior code path.

- [ ] **Step 4: Commit**

Add to `CHANGELOG.md` under `## [Unreleased]`:

```markdown
### Changed
- Internal: `pauseBattle()`/`resumeBattle()` now take an optional
  `timeScale` (default 0, today's exact hard-stop behavior) so a future
  caller can ask for a slowed-not-frozen pause. No player-visible change
  yet - the P-key pause still always uses the default.
```

```bash
git add js/screens/battleScreen.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
refactor: generalize pauseBattle/resumeBattle with a timeScale param

Default 0 exactly reproduces today's hard-stop P-key pause. A
fractional timeScale (unused until the next commit's item quick-select
menu) keeps the tick interval and windup animations running at a
scaled rate instead of freezing outright.

Claude-Session: https://claude.ai/code/session_01Kn5DNjPZVXGktscHQzQg3F
EOF
)"
```

---

### Task 7: Item quick-select overlay + potion dispatch

**Files:**
- Modify: `js/screens/battleScreen.js`, `css/styles.css`, `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `LOADOUT_SIZE` from `js/systems/loadout.js`; `isTimedBuffPotion`, `createActiveBuffs`, `activateTimedBuff` from `js/systems/buffPotions.js` (Task 2); `pauseBattle(timeScale)`/`resumeBattle()` from Task 6.
- Produces: pressing `i`/clicking the Item button opens a quick-select overlay listing the 4 loadout slots (1-4 keys, arrows+Enter, or click; Escape cancels); selecting a slot removes 1 of that item and dispatches it (heal / timed-buff activation / one-shot flag — the one-shot flags themselves are consumed elsewhere, in Task 8). Replaces the old direct-heal `playerUseItem()`.

- [ ] **Step 1: Update the 2 existing tests that assumed Item = instant heal**

`tests/battleScreenDom.test.js:68` (inside `'every action button has a plain-language description...'`):

```js
    assert.match(root.querySelector('#btn-item').title, /heal/);
```

Change to:

```js
    assert.match(root.querySelector('#btn-item').title, /potion/i);
```

`tests/battleScreenDom.test.js:108-112` (`'Item button heals when a potion is used'`):

```js
  await t.test('Item button heals when a potion is used', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ player: { ...createNewGame().player, hp: 5 }, inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    assert.equal(root.querySelector('#btn-item').disabled, false);
    click(root.querySelector('#btn-item'));
    assert.match(root.querySelector('#battle-log').textContent, /drink a potion and heal/);
  });
```

Change to (Item now opens the menu first; the default loadout already has `potion` in slot 1 via `createNewGame()`, so `baseState()` doesn't need a `loadout` override here):

```js
  await t.test('Item button opens the quick-select menu, and selecting the heal potion heals', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ player: { ...createNewGame().player, hp: 5 }, inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    assert.equal(root.querySelector('#btn-item').disabled, false);
    click(root.querySelector('#btn-item'));
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    click(root.querySelector('button[data-slot="0"]'));
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, true);
    assert.match(root.querySelector('#battle-log').textContent, /drink Potion and heal/);
  });
```

- [ ] **Step 2: Write the new failing tests**

Append more cases to the same test block:

```js
  await t.test('Item button is disabled when the loadout has nothing usable', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ inventory: [], loadout: [null, null, null, null] }) });
    assert.equal(root.querySelector('#btn-item').disabled, true);
  });

  await t.test('pressing "i" opens the item menu, and pressing "1" selects slot 1', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    keydown('i');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    keydown('1');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, true);
    assert.match(root.querySelector('#battle-log').textContent, /drink Potion and heal/);
  });

  await t.test('pressing Escape while the item menu is open cancels without consuming anything', async () => {
    const { root, state } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    keydown('i');
    keydown('Escape');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, true);
    assert.equal(state.inventory.find((e) => e.itemId === 'potion').quantity, 1);
  });

  await t.test('drinking a timed buff potion logs a confirmation and shows it on the potion buff indicator', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'strengthDraught', quantity: 1 }], loadout: ['strengthDraught', null, null, null] }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    assert.match(root.querySelector('#battle-log').textContent, /Strength Draught/);
    assert.match(root.querySelector('#battle-potion-buff-indicator').textContent, /12s/);
  });

  await t.test('drinking a one-shot potion logs a confirmation', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'berserkerTonic', quantity: 1 }], loadout: ['berserkerTonic', null, null, null] }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    assert.match(root.querySelector('#battle-log').textContent, /guaranteed to crit/);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL — `#battle-item-menu-overlay` doesn't exist yet, `#btn-item`'s click still calls the old `playerUseItem`.

- [ ] **Step 4: Implement the overlay DOM**

Add the import (alongside the existing `js/systems/inventory.js`/`js/systems/abilities.js` imports at the top of `js/screens/battleScreen.js`):

```js
import { LOADOUT_SIZE } from '../systems/loadout.js';
import { isTimedBuffPotion, createActiveBuffs, activateTimedBuff } from '../systems/buffPotions.js';
```

Add a constant near the top-of-file constants (alongside `VICTORY_PAUSE_MS` etc.):

```js
const ITEM_MENU_TIME_SCALE = 0.25;
```

Add module-level state near the existing `let battlePaused = false;`/`let pauseTimeScale = 0;`:

```js
let itemMenuOpen = false;
let itemMenuSelectedIndex = 0;
```

In `buildDom()` (`js/screens/battleScreen.js:237-270`), add the overlay markup right after the existing `.battle-paused-overlay` block:

```html
      <div class="battle-paused-overlay" id="battle-paused-overlay" hidden>
        <div class="battle-paused-label">⏸️ PAUSED</div>
      </div>
      <div class="battle-item-menu-overlay" id="battle-item-menu-overlay" hidden>
        <div class="battle-item-menu-slots" id="battle-item-menu-slots"></div>
      </div>
```

Add the corresponding entries to the `elements = { ... }` object (`js/screens/battleScreen.js:272-300`), right after `pausedOverlay: document.getElementById('battle-paused-overlay'),`:

```js
    itemMenuOverlay: document.getElementById('battle-item-menu-overlay'),
    itemMenuSlots: document.getElementById('battle-item-menu-slots'),
```

Also add a potion-buff indicator element next to the existing Super Scream one. In the hero zone markup (`js/screens/battleScreen.js:257`, `<div class="battle-buff-indicator" id="battle-buff-indicator"></div>`), add right after it:

```html
              <div class="battle-buff-indicator" id="battle-buff-indicator"></div>
              <div class="battle-potion-buff-indicator" id="battle-potion-buff-indicator"></div>
```

And the matching `elements` entry, right after `buffIndicator: document.getElementById('battle-buff-indicator'),`:

```js
    potionBuffIndicator: document.getElementById('battle-potion-buff-indicator'),
```

- [ ] **Step 5: Implement `hasUsableLoadoutItem`, `renderItemMenu`, `openItemMenu`, `closeItemMenu`, `selectItemMenuSlot`, `drinkPotion`, `updatePotionBuffIndicator`**

Add these functions right before `updateBuffIndicator` (`js/screens/battleScreen.js:490`):

```js
// Shared by the Item button's disabled state and openItemMenu()'s own
// guard, so the two can't drift apart. secondWindAvailable is read here
// even though Task 8 is what actually sets/consumes it - a module-level
// `let` declared in Task 8 below; both this function and openItemMenu()
// only read it, so declaration order across the two tasks doesn't matter
// once both are applied.
function hasUsableLoadoutItem() {
  return state.loadout.some((itemId) => {
    if (!itemId) return false;
    const owned = state.inventory.find((entry) => entry.itemId === itemId)?.quantity || 0;
    if (owned === 0) return false;
    if (itemId === 'secondWind' && secondWindAvailable) return false;
    return true;
  });
}

function renderItemMenu() {
  const slotsHtml = state.loadout.map((itemId, index) => {
    if (!itemId) {
      return `<div class="battle-item-menu-slot battle-item-menu-slot-empty">${index + 1}</div>`;
    }
    const item = ITEMS[itemId];
    const owned = state.inventory.find((entry) => entry.itemId === itemId)?.quantity || 0;
    const disabled = owned === 0 || (itemId === 'secondWind' && secondWindAvailable);
    const selectedClass = index === itemMenuSelectedIndex ? ' battle-item-menu-slot-selected' : '';
    return `<button class="battle-item-menu-slot${selectedClass}" data-slot="${index}" ${disabled ? 'disabled' : ''}>
      <span class="battle-item-menu-slot-key">${index + 1}</span>
      <span class="battle-item-menu-slot-icon">${item.emoji}</span>
      <span class="battle-item-menu-slot-name">${item.name}${owned > 1 ? ` x${owned}` : ''}</span>
    </button>`;
  }).join('');
  elements.itemMenuSlots.innerHTML = slotsHtml;
  elements.itemMenuSlots.querySelectorAll('button[data-slot]').forEach((btn) => {
    btn.onclick = () => selectItemMenuSlot(Number(btn.dataset.slot));
  });
}

function openItemMenu() {
  if (battleOver || battlePaused || itemMenuOpen) return;
  if (!hasUsableLoadoutItem()) {
    log.push('No usable items loaded.');
    updateLog();
    return;
  }
  itemMenuOpen = true;
  itemMenuSelectedIndex = Math.max(0, state.loadout.findIndex((itemId) => itemId));
  pauseBattle(ITEM_MENU_TIME_SCALE);
  renderItemMenu();
  elements.itemMenuOverlay.hidden = false;
}

function closeItemMenu() {
  if (!itemMenuOpen) return;
  itemMenuOpen = false;
  elements.itemMenuOverlay.hidden = true;
  resumeBattle();
}

function selectItemMenuSlot(index) {
  const itemId = state.loadout[index];
  if (!itemId) return;
  const owned = state.inventory.find((entry) => entry.itemId === itemId)?.quantity || 0;
  if (owned === 0) return;
  if (itemId === 'secondWind' && secondWindAvailable) return;
  closeItemMenu();
  drinkPotion(itemId);
}

function handleItemMenuKeydown(event) {
  const key = event.key;
  if (key === 'Escape') {
    event.preventDefault();
    closeItemMenu();
    return;
  }
  if (key >= '1' && key <= '4') {
    event.preventDefault();
    selectItemMenuSlot(Number(key) - 1);
    return;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    event.preventDefault();
    itemMenuSelectedIndex = (itemMenuSelectedIndex + LOADOUT_SIZE - 1) % LOADOUT_SIZE;
    renderItemMenu();
    return;
  }
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    event.preventDefault();
    itemMenuSelectedIndex = (itemMenuSelectedIndex + 1) % LOADOUT_SIZE;
    renderItemMenu();
    return;
  }
  if (key === 'Enter') {
    event.preventDefault();
    selectItemMenuSlot(itemMenuSelectedIndex);
  }
}

// The real dispatch: heal (the only item with `.heal`), a timed buff
// (anything with `buffDurationMs`), or a one-shot flag (berserkerTonic/
// secondWind, consumed elsewhere - see Task 8's consumeGuaranteedCritBonus
// and the Second Wind check inside monsterAttack()).
function drinkPotion(itemId) {
  Object.assign(state, removeItem(state, itemId, 1));
  const item = ITEMS[itemId];
  if (item.heal) {
    const result = resolvePotionUse(playerCombatant, item.heal, Math.random, playerEffectBonuses.critChancePercent / 100);
    playerCombatant.hp = result.playerHp;
    log.push(result.isCrit
      ? `Critical! You drink ${item.name} and heal ${result.heal}!`
      : `You drink ${item.name} and heal ${result.heal}.`);
    updateHpBars();
  } else if (isTimedBuffPotion(itemId)) {
    activeBuffs = activateTimedBuff(activeBuffs, itemId);
    recomputeEffectBonuses();
    log.push(`You drink ${item.name}! It surges through you.`);
  } else if (itemId === 'berserkerTonic') {
    guaranteedCritNextHit = true;
    log.push(`You drink ${item.name}! Your next hit is guaranteed to crit.`);
  } else if (itemId === 'secondWind') {
    secondWindAvailable = true;
    log.push(`You drink ${item.name}! You'll survive a killing blow once this fight.`);
  }
  updatePotionBuffIndicator();
  updateLog();
  updateMenu();
}

function updatePotionBuffIndicator() {
  elements.potionBuffIndicator.textContent = activeBuffs
    .map((buff) => `${ITEMS[buff.itemId].emoji} ${Math.ceil(buff.remainingMs / 1000)}s`)
    .join(' ');
}
```

(`recomputeEffectBonuses`, `activeBuffs`, `guaranteedCritNextHit`, `secondWindAvailable` are declared/implemented in Task 8, which lands immediately after this task — `drinkPotion`'s timed-buff branch and `hasUsableLoadoutItem`'s `secondWindAvailable` read will not resolve until Task 8's commit; both tasks must land together before running the full suite. Task 8's steps below start from this exact state.)

- [ ] **Step 6: Wire the Item button, handleKeydown, updateMenu, and endBattle**

Replace the old `function playerUseItem() { ... }` (`js/screens/battleScreen.js:1405-1425`) — delete it entirely; `drinkPotion`/`openItemMenu` above replace it.

In `updateMenu()` (`js/screens/battleScreen.js`, find `const hasPotion = state.inventory.some((entry) => entry.itemId === 'potion' && entry.quantity > 0);` around line 577), replace:

```js
  const hasPotion = state.inventory.some((entry) => entry.itemId === 'potion' && entry.quantity > 0);
```

with:

```js
  const hasUsableItem = hasUsableLoadoutItem();
```

And replace the Item button's `actionButtonHtml({...})` call (`js/screens/battleScreen.js:610-617`):

```js
    ${actionButtonHtml({
      id: 'btn-item',
      icon: '🧪',
      key: 'i',
      title: hasPotion ? `Item (i) — drink a potion to heal ${ITEMS.potion.heal} HP` : `Item (i) — drink a potion to heal ${ITEMS.potion.heal} HP (no potions left)`,
      disabled: !hasPotion,
    })}
```

with:

```js
    ${actionButtonHtml({
      id: 'btn-item',
      icon: '🧪',
      key: 'i',
      title: hasUsableItem ? 'Item (i) — choose a potion from your loadout' : 'Item (i) — no usable items loaded (set a loadout in Inventory)',
      disabled: !hasUsableItem,
    })}
```

And change `document.getElementById('btn-item').onclick = playerUseItem;` to:

```js
  document.getElementById('btn-item').onclick = openItemMenu;
```

In `handleKeydown` (`js/screens/battleScreen.js:1079-1139`), route to the item menu when it's open BEFORE the general `battlePaused` gate, and replace the old `i` branch. Current relevant lines:

```js
function handleKeydown(event) {
  if (battleOver) return;
  const key = event.key;
  if (key === 'p' || key === 'P') {
    toggleBattlePause();
    return;
  }
  ...
  if (battlePaused) return;
  ...
  if (key === 'i' || key === 'I') {
    playerUseItem();
    return;
  }
```

Change to:

```js
function handleKeydown(event) {
  if (battleOver) return;
  const key = event.key;
  if (itemMenuOpen) {
    handleItemMenuKeydown(event);
    return;
  }
  if (key === 'p' || key === 'P') {
    toggleBattlePause();
    return;
  }
  ...
  if (battlePaused) return;
  ...
  if (key === 'i' || key === 'I') {
    openItemMenu();
    return;
  }
```

(Leave every other branch in `handleKeydown` untouched — only the new `itemMenuOpen` branch at the top and the `i`-key branch's target function change.)

Guard `toggleBattlePause()` (`js/screens/battleScreen.js:1636-1639`) against the physical pause button being clicked while the item menu is open (which would desync the two overlays):

```js
function toggleBattlePause() {
  if (itemMenuOpen) return;
  if (battlePaused) resumeBattle();
  else pauseBattle();
}
```

In `endBattle()` (`js/screens/battleScreen.js:1646-1655`), a monster can still land a killing blow while the item menu is open (slow-mo, not a full freeze — see Task 6's comment on `pauseBattle`), so the menu needs the same "battle ended while paused" cleanup the existing `battlePaused` block already gets. Current:

```js
function endBattle(outcome) {
  battleOver = true;
  // A still-resolving ability sequence (e.g. an AOE stagger) can end the
  // battle while paused - see the battlePaused declaration's own comment on
  // why those aren't frozen. Drop the pause rather than let its dim overlay
  // and inert pause button sit on top of the win/loss sequence.
  if (battlePaused) {
    battlePaused = false;
    elements.pausedOverlay.hidden = true;
  }
```

Change to:

```js
function endBattle(outcome) {
  battleOver = true;
  // A still-resolving ability sequence (e.g. an AOE stagger) can end the
  // battle while paused - see the battlePaused declaration's own comment on
  // why those aren't frozen. Drop the pause rather than let its dim overlay
  // and inert pause button sit on top of the win/loss sequence. Same
  // reasoning for the item quick-select menu: its slow-mo (not a full
  // freeze) still lets a monster complete a windup and land a killing
  // blow while it's open.
  if (battlePaused) {
    battlePaused = false;
    elements.pausedOverlay.hidden = true;
  }
  if (itemMenuOpen) {
    itemMenuOpen = false;
    elements.itemMenuOverlay.hidden = true;
  }
```

- [ ] **Step 7: Reset item-menu state in `mount()`**

In `mount()` (`js/screens/battleScreen.js:1683+`), alongside the existing `battlePaused = false;`, add:

```js
  itemMenuOpen = false;
  itemMenuSelectedIndex = 0;
```

- [ ] **Step 8: Add CSS**

In `css/styles.css`, add right after the `.battle-paused-label` rule (`css/styles.css:304-309`):

```css
.battle-item-menu-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
}
.battle-item-menu-overlay[hidden] {
  display: none;
}
.battle-item-menu-slots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 12px;
}
.battle-item-menu-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 90px;
  padding: 8px 4px;
  background: rgba(17, 17, 17, 0.92);
  border: 1px solid #555;
  border-radius: 6px;
  color: #eee;
  cursor: pointer;
  font-size: 0.75rem;
}
.battle-item-menu-slot-selected {
  border-color: #ffd54a;
  box-shadow: 0 0 6px rgba(255, 213, 74, 0.6);
}
.battle-item-menu-slot:disabled,
.battle-item-menu-slot-empty {
  opacity: 0.4;
  cursor: default;
}
.battle-item-menu-slot-key {
  font-weight: 700;
}
```

And right after the `.battle-buff-indicator` rule (`css/styles.css:518`, check its exact closing brace and insert after):

```css
.battle-potion-buff-indicator {
  font-size: 0.75rem;
  color: #9be69b;
}
```

- [ ] **Step 9: This task's code alone will not pass tests yet — proceed directly to Task 8, then run the full suite once both are applied.**

`drinkPotion`'s timed-buff branch calls `recomputeEffectBonuses()` and reads `activeBuffs`, and `hasUsableLoadoutItem`/`renderItemMenu`/`selectItemMenuSlot` read `secondWindAvailable` — none of which exist until Task 8. Do not attempt `npm run test` between Step 8 and Task 8's completion; it will fail with `ReferenceError`s for those names. Commit Task 7 and Task 8 together as a single commit (see Task 8's own commit step) rather than separately, since they're only independently *reviewable*, not independently *runnable*.

---

### Task 8: Combined bonuses + one-shot consumption + buff indicator wiring

**Files:**
- Modify: `js/screens/battleScreen.js`, `js/data/playerChangelog.js`, `CHANGELOG.md`
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `combineBonuses`, `getActiveBuffBonuses`, `createActiveBuffs` from `js/systems/buffPotions.js`; `guaranteedCritNextHit`/`secondWindAvailable`/`activeBuffs` declared here, read by Task 7's `drinkPotion`/`hasUsableLoadoutItem`/`renderItemMenu`.
- Produces: every existing combat call site that already reads `playerEffectBonuses.*` (lifesteal, elemental proc, crit chance, extra swing, thorns) picks up active potion buffs automatically via a single `recomputeEffectBonuses()` choke point — no per-call-site changes. Guaranteed-crit and Second Wind become real, consumed exactly once.

- [ ] **Step 1: Write the failing tests**

Append to `tests/battleScreenDom.test.js`:

```js
  await t.test('an active Strength Draught increases Attack damage over the unbuffed baseline', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5; // fixed variance roll, no crit (rollCrit needs < 0.1)
    try {
      const { root: unbuffedRoot } = await mountBattle(['boar'], { state: baseState() });
      click(unbuffedRoot.querySelector('#btn-attack'));
      const unbuffedDamage = Number(unbuffedRoot.querySelector('#battle-log').textContent.match(/for (\d+)/)[1]);
      const { unmount } = await import('../js/screens/battleScreen.js');
      unmount();

      const { root: buffedRoot } = await mountBattle(['boar'], {
        state: baseState({ inventory: [{ itemId: 'strengthDraught', quantity: 1 }], loadout: ['strengthDraught', null, null, null] }),
      });
      click(buffedRoot.querySelector('#btn-item'));
      click(buffedRoot.querySelector('button[data-slot="0"]'));
      click(buffedRoot.querySelector('#btn-attack'));
      // Only the Attack line contains "for <N>" - the drink confirmation
      // line above it doesn't - so the same simple match used for the
      // unbuffed case works here too.
      const buffedDamage = Number(buffedRoot.querySelector('#battle-log').textContent.match(/for (\d+)/)[1]);
      assert.ok(buffedDamage > unbuffedDamage, `expected buffed damage ${buffedDamage} > unbuffed ${unbuffedDamage}`);
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('Berserker Tonic guarantees the next Attack is a crit even when the crit roll would miss', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99; // never satisfies rollCrit()'s own < 0.1 check on its own
    try {
      const { root } = await mountBattle(['boar'], {
        state: baseState({ inventory: [{ itemId: 'berserkerTonic', quantity: 1 }], loadout: ['berserkerTonic', null, null, null] }),
      });
      click(root.querySelector('#btn-item'));
      click(root.querySelector('button[data-slot="0"]'));
      click(root.querySelector('#btn-attack'));
      assert.match(root.querySelector('#battle-log').textContent, /Critical! You hit/);
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('Berserker Tonic\'s guaranteed crit only applies to the next hit, not the one after', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
      const { root } = await mountBattle(['boar'], {
        state: baseState({ inventory: [{ itemId: 'berserkerTonic', quantity: 1 }], loadout: ['berserkerTonic', null, null, null] }),
      });
      click(root.querySelector('#btn-item'));
      click(root.querySelector('button[data-slot="0"]'));
      click(root.querySelector('#btn-attack')); // consumes the guaranteed crit
      const logAfterFirst = root.querySelector('#battle-log').textContent;
      assert.match(logAfterFirst, /Critical! You hit/);
      const linesAfterFirst = root.querySelectorAll('#battle-log div').length;
      // Attack's own spam-cooldown (attackCooldownMsForStreak, streak 1 =
      // 700ms) blocks a same-tick second click - a disabled button doesn't
      // fire click handlers even via a dispatched event, matching real
      // browser behavior. Wait past 3 ticks (900ms) so tick()'s own
      // `attackCooldownMs -= 300` decays it back to 0 first.
      await new Promise((resolve) => setTimeout(resolve, 950));
      click(root.querySelector('#btn-attack')); // should NOT be a crit (0.99 never satisfies rollCrit on its own)
      const linesAfterSecond = root.querySelectorAll('#battle-log div').length;
      assert.equal(linesAfterSecond, linesAfterFirst + 1, 'second Attack should have logged exactly one new line');
      const secondLine = [...root.querySelectorAll('#battle-log div')].pop().textContent;
      assert.doesNotMatch(secondLine, /Critical!/);
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('Second Wind survives a lethal hit at 1 HP', async () => {
    const { root, state } = await mountBattle(['boar'], {
      state: baseState({
        player: { ...createNewGame().player, hp: 1 },
        inventory: [{ itemId: 'secondWind', quantity: 1 }],
        loadout: ['secondWind', null, null, null],
      }),
      monsterOverrides: [{ speed: 1000 }], // ready to wind up on the first tick
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    // Same unparried-hit forcing pattern as the existing "a Retribution
    // Charm reflects damage..." test above: wait past the first tick
    // (windup starts, ~300ms), then past the full PARRY_WINDUP_DURATION_MS
    // without pressing parry, then one more tick so tick()'s own
    // isWindupComplete poll resolves the attack.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await new Promise((resolve) => setTimeout(resolve, PARRY_WINDUP_DURATION_MS));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(state.player.hp, 1);
    assert.match(root.querySelector('#battle-log').textContent, /Second Wind kicks in/);
  });

  await t.test('a second Second Wind can\'t be drunk while one is already armed', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({
        inventory: [{ itemId: 'secondWind', quantity: 2 }],
        loadout: ['secondWind', null, null, null],
      }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]')); // arms it - 1 copy left in inventory
    click(root.querySelector('#btn-item'));
    assert.equal(root.querySelector('button[data-slot="0"]').disabled, true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL — `ReferenceError: recomputeEffectBonuses is not defined` / `activeBuffs is not defined`, plus the buff/crit/Second-Wind assertions failing.

- [ ] **Step 3: Implement the combined-bonus wiring**

Add module-level state near the existing `let playerEffectBonuses = null;` (`js/screens/battleScreen.js:83`):

```js
let equipmentBonuses = null;
let activeBuffs = [];
let guaranteedCritNextHit = false;
let secondWindAvailable = false;
```

Add the recompute function right after `playerEffectBonuses`'s declaration area (or alongside `updateBuffIndicator`, matching this file's convention of grouping small state-transform helpers near their first use):

```js
// The single place playerEffectBonuses is ever assigned after mount() -
// every existing combat call site already reads playerEffectBonuses.*
// directly (lifesteal/elemental proc in applyOnHitEffects, crit/extra-
// swing/thorns at their own resolve*() call sites), so keeping it always
// equal to equipment + active potion buffs means none of those call sites
// need to change at all.
function recomputeEffectBonuses() {
  playerEffectBonuses = combineBonuses(equipmentBonuses, getActiveBuffBonuses(activeBuffs));
}
```

Add the import (extend Task 7's `buffPotions.js` import line):

```js
import { isTimedBuffPotion, createActiveBuffs, activateTimedBuff, tickActiveBuffs, getActiveBuffBonuses, combineBonuses } from '../systems/buffPotions.js';
```

In `mount()`, replace:

```js
  playerEffectBonuses = getEquipmentBonuses(state);
  playerCombatant = buildPlayerCombatant(playerEffectBonuses);
```

with:

```js
  equipmentBonuses = getEquipmentBonuses(state);
  activeBuffs = createActiveBuffs();
  guaranteedCritNextHit = false;
  secondWindAvailable = false;
  recomputeEffectBonuses();
  playerCombatant = buildPlayerCombatant(playerEffectBonuses);
```

In `tick()`, right after `buffState = tickBuff(buffState, 300);` (`js/screens/battleScreen.js:1540`), add:

```js
  activeBuffs = tickActiveBuffs(activeBuffs, 300);
  recomputeEffectBonuses();
```

And right after the existing `updateBuffIndicator();` call at the end of `tick()` (`js/screens/battleScreen.js:1595-1596`), add:

```js
  updatePotionBuffIndicator();
```

- [ ] **Step 4: Implement guaranteed-crit consumption**

Add a helper right before `resolveOneAttack` (`js/screens/battleScreen.js:1141`):

```js
// "Next hit" is consumed by the very next crit-chance roll, whether that's
// Attack or an ability - clears itself immediately so an AOE ability
// (Sweep) only guarantees the crit on the first monster it hits in that
// same swing, not every monster.
function consumeGuaranteedCritBonus() {
  if (guaranteedCritNextHit) {
    guaranteedCritNextHit = false;
    return 1;
  }
  return playerEffectBonuses.critChancePercent / 100;
}
```

Replace the 3 `critChanceBonus` argument expressions at Attack and ability call sites (NOT the potion-use one in `drinkPotion` — drinking isn't a "hit"):

`resolveOneAttack` (`js/screens/battleScreen.js:1157`):

```js
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), Math.random, streakMultiplier, knockbackMultiplier, playerEffectBonuses.critChancePercent / 100);
```

→

```js
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), Math.random, streakMultiplier, knockbackMultiplier, consumeGuaranteedCritBonus());
```

The two `resolveAbilityUse(...)` call sites (`js/screens/battleScreen.js:1330` and `:1365`), each ending in `playerEffectBonuses.critChancePercent / 100)`:

```js
        const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(mc, debuffSnapshots[n]), ability, buffActiveAtPress, timingHit, comboBonusActive, Math.random, playerEffectBonuses.critChancePercent / 100);
```

→

```js
        const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(mc, debuffSnapshots[n]), ability, buffActiveAtPress, timingHit, comboBonusActive, Math.random, consumeGuaranteedCritBonus());
```

```js
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit, comboBonusActive, Math.random, playerEffectBonuses.critChancePercent / 100);
```

→

```js
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit, comboBonusActive, Math.random, consumeGuaranteedCritBonus());
```

Leave `resolvePotionUse`'s call site in `drinkPotion` (Task 7) reading `playerEffectBonuses.critChancePercent / 100` directly — drinking a potion is never affected by the guaranteed-crit flag.

- [ ] **Step 5: Implement Second Wind consumption**

In `monsterAttack()` (`js/screens/battleScreen.js:1461-1479`), current:

```js
function monsterAttack(monster) {
  const result = resolveMonsterAttack(monster, playerCombatant, Math.random, playerEffectBonuses.thornsPercent);
  playerCombatant.hp = result.playerHp;
  playerCombatant.atb = result.playerAtb;
```

Change to:

```js
function monsterAttack(monster) {
  const result = resolveMonsterAttack(monster, playerCombatant, Math.random, playerEffectBonuses.thornsPercent);
  playerCombatant.hp = result.playerHp;
  if (playerCombatant.hp <= 0 && secondWindAvailable) {
    secondWindAvailable = false;
    playerCombatant.hp = 1;
    log.push('Second Wind kicks in! You survive with 1 HP.');
  }
  playerCombatant.atb = result.playerAtb;
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: PASS — including every Task 7 test (now that `recomputeEffectBonuses`/`activeBuffs`/`guaranteedCritNextHit`/`secondWindAvailable` exist) and every new Task 8 test.

- [ ] **Step 7: Version bump — the only task in this plan that does this**

Per this repo's own `CLAUDE.md` versioning checklist: this is a completed feature (a MINOR bump), and since every push here deploys immediately, bump `Unreleased` into a dated version now so nothing ships un-versioned.

In `CHANGELOG.md`, move everything accumulated under `## [Unreleased]` across Tasks 1-8 into a new dated section. Check `CHANGELOG.md`'s current top-of-file for the next version number and today's date (`date +%Y-%m-%d`), then restructure to:

```markdown
## [Unreleased]

## [x.y.0] - YYYY-MM-DD

### Added
- 10 new buff-potion items, purchasable in the shop: 8 timed stat/effect
  buffs (attack, defense, speed, lifesteal, extra swing chance, elemental
  proc, thorns, crit chance - each a 12s boost) and 2 one-shots
  (guaranteed crit on your next hit, and a Second Wind that saves you from
  one lethal hit per battle).
- A 4-slot potion loadout, set up from the Inventory screen's Potions tab -
  pick which potions to carry into battle.
- A new in-battle item quick-select menu (press `i`, pick 1-4/arrows/click)
  that drinks from your loadout - battle slows to 25% speed while it's
  open instead of fully pausing, so there's still some urgency.
- Monster kills now have an 8% independent chance to also drop a random
  buff potion.

### Fixed
- Inventory screen's potion "Use" button no longer renders for non-heal
  consumables (would have corrupted player HP to NaN for the new buff
  potions).
```

(Replace the exact MINOR version number with whatever `CHANGELOG.md`'s current top entry implies is next, per its own header rules.)

- [ ] **Step 8: Add the player-facing changelog entry**

Per this repo's `CLAUDE.md`: add a matching entry to `js/data/playerChangelog.js`'s `PLAYER_CHANGELOG` array (newest first), listing only what a player would actually notice (skip nothing here — the whole feature is player-visible). Read the file first to match its existing entry shape/style exactly, then add an entry for the same version number as the `CHANGELOG.md` bump above, e.g. (adjust wording/fields to match the file's real existing structure once read):

```js
{
  version: 'x.y.0',
  date: 'YYYY-MM-DD',
  changes: [
    'New buff potions! 8 temporary combat boosts and 2 one-shot potions (guaranteed crit, Second Wind) - buy them in the shop.',
    'Set up a 4-potion loadout from the Inventory screen, then press the Item button (i) in battle to pick one mid-fight.',
    'Monster kills now sometimes drop a bonus potion.',
  ],
},
```

- [ ] **Step 9: Run `tests/versionSync.test.js` and the full suite one final time**

Run: `npm run test`
Expected: PASS — `versionSync.test.js` specifically confirms `CHANGELOG.md`'s newest dated version matches `PLAYER_CHANGELOG[0].version`.

- [ ] **Step 10: Commit (Tasks 7 + 8 together)**

```bash
git add js/screens/battleScreen.js css/styles.css tests/battleScreenDom.test.js js/data/playerChangelog.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: wire buff potions into battle (item quick-select, buffs, one-shots)

- Item button (i) now opens a 4-slot quick-select menu instead of
  instantly drinking the heal potion; battle slows to 25% speed while
  it's open rather than fully pausing.
- Timed buff potions stack (different types) and merge into combat via
  a single recomputeEffectBonuses() choke point, so every existing
  combat call site picks them up with no changes of its own.
- Berserker Tonic guarantees the next hit crits; Second Wind survives
  one lethal hit per battle.

Completes the buff-potions gold sink - see docs/superpowers/specs/
2026-08-31-buff-potions-design.md and this plan
(docs/superpowers/plans/2026-08-31-buff-potions.md).

Claude-Session: https://claude.ai/code/session_01Kn5DNjPZVXGktscHQzQg3F
EOF
)"
```

- [ ] **Step 11: STOP here — do not push.**

Per this repo's own instructions (never push/merge to `master` without explicit approval — a push here deploys immediately) and this plan's own operating instructions for tonight's run: everything through this step is committed locally only. Report the final `git log`/`git status`/test-suite state and wait for Timothy to review and say go before `git push`.
