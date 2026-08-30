# NG+ Gear Progression & Gold Sink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Mythic gear tier (drop luck + gold-cost smith reforge), two new NG+-exclusive unique items (Retribution Charm, Windfury Ring), and two new ring equipment slots — giving NG+ players real power headroom past today's gear ceiling while draining the gold surplus.

**Architecture:** Extends the existing quality-tier system (`itemQuality.js`/`loot.js`/`inventory.js`) with a fourth tier rather than a new stat axis, so per-tier upgrade tracking, tooltips, and equipment-bonus math all generalize for free. Ring slots are a new slot *type* (`'ring'`) that resolves to one of two physical keys (`ring1`/`ring2`) at equip time, layered onto the existing fixed-slot equipment model. All new content is gated behind `state.ngPlusCycle >= 1`, threaded through `rollDrop`'s existing single-roll-per-bonus-item structure so every new roll is a no-op (zero extra `rng()` calls) for any pre-NG+ player — this is what keeps every existing test passing unmodified.

**Tech Stack:** Plain JS, ES modules, no build step. `node:test` + `node:assert/strict` for unit tests (`tests/*.js`), jsdom-based DOM tests via `tests/helpers/dom.js` for screen wiring (matches `tests/inventoryScreenDom.test.js`'s existing convention).

**Spec:** `docs/superpowers/specs/2026-08-30-ng-plus-gear-progression-design.md`

## Global Constraints

- Run `npm run test` (never `npm test`/`npx jest` directly — this project's `package.json` defines `test` as `node --test tests/*.js`) after every task.
- Every new roll/gate added to `rollDrop`/`rollQualityTier` MUST be a no-op when `ngPlusCycle` is omitted or `0` — this is required for every existing test in `tests/loot.test.js` and `tests/itemQuality.test.js` to keep passing unmodified without editing their call sites.
- All new numeric constants (mythic multiplier, boss-mythic chance, essence drop rate, reforge cost, thorns percent, ring toughness floor) are explicitly-flagged starting hypotheses per the spec — implement them as named exported constants (never inline magic numbers), so a future balance pass can tune them without touching logic.
- `CHANGELOG.md` needs an `## [Unreleased]` entry before this can deploy (CI-enforced). This repo's own versioning checklist (`CLAUDE.md`) also requires a matching `js/data/playerChangelog.js` entry once this is ready to ship, and bumping `Unreleased` into a dated version section before the actual push — both added in the final task here, but the push itself is Timothy's call per this repo's "never push to master without explicit approval" rule.
- Rings are drop-only, never shop-purchasable — do not add any ring-slot item to `SHOP_CATALOG`.

---

### Task 1: Mythic tier core — `itemQuality.js`

**Files:**
- Modify: `js/systems/itemQuality.js`
- Test: `tests/itemQuality.test.js`

**Interfaces:**
- Produces: `QUALITY_TIER_MULTIPLIERS.mythic` (number), `tierLabel('mythic')` returns `'Mythic '`, `rollQualityTier(toughness, rng, ngPlusCycle = 0)` can now return `'mythic'`, `rollMythicEssenceChance(toughness, rng) -> boolean`, `RING_TOUGHNESS_FLOOR` (number), `BOSS_MYTHIC_CHANCE` (number).
- Consumes: nothing new — `lerp` already exists in this file.

- [ ] **Step 1: Write the failing tests**

Add to `tests/itemQuality.test.js` (alongside the existing `rollQualityTier`/`QUALITY_TIER_MULTIPLIERS`/`tierLabel` tests — import the new names too):

```js
import {
  isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance,
  rollMythicEssenceChance, QUALITY_TIER_MULTIPLIERS, tierLabel, RING_TOUGHNESS_FLOOR,
  BOSS_MYTHIC_CHANCE,
} from '../js/systems/itemQuality.js';
```

```js
test('rollQualityTier never returns mythic when ngPlusCycle is omitted or 0', () => {
  for (const toughness of [0, 0.5, 1]) {
    for (let i = 0; i <= 20; i++) {
      const rngValue = i / 20;
      assert.notEqual(rollQualityTier(toughness, () => rngValue), 'mythic');
      assert.notEqual(rollQualityTier(toughness, () => rngValue, 0), 'mythic');
    }
  }
});

test('rollQualityTier can return mythic once ngPlusCycle >= 1, at the low end of the roll', () => {
  assert.equal(rollQualityTier(1, () => 0.001, 1), 'mythic');
  assert.equal(rollQualityTier(1, () => 0.001, 2), 'mythic');
});

test('rollQualityTier at ngPlusCycle >= 1 still returns superior/fine/plain above the mythic band', () => {
  // toughness 0: mythic band is [0, 0.005). Confirm superior/fine/plain still
  // reachable just above it, matching the pre-mythic thresholds shifted up
  // by the mythic band width.
  assert.equal(rollQualityTier(0, () => 0.006, 1), 'superior'); // 0.005 <= x < 0.005+0.02
  assert.equal(rollQualityTier(0, () => 0.5, 1), 'plain');
});

test('rollQualityTier only ever returns plain, fine, superior, or mythic at any ngPlusCycle', () => {
  for (const toughness of [0, 0.25, 0.5, 0.75, 1]) {
    for (const cycle of [0, 1, 2]) {
      for (const rngValue of [0, 0.005, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.9, 0.999]) {
        const result = rollQualityTier(toughness, () => rngValue, cycle);
        assert.ok(['plain', 'fine', 'superior', 'mythic'].includes(result));
      }
    }
  }
});

test('QUALITY_TIER_MULTIPLIERS.mythic is greater than superior', () => {
  assert.equal(QUALITY_TIER_MULTIPLIERS.mythic, 1.35);
  assert.ok(QUALITY_TIER_MULTIPLIERS.mythic > QUALITY_TIER_MULTIPLIERS.superior);
});

test('tierLabel prefixes Mythic correctly', () => {
  assert.equal(tierLabel('mythic'), 'Mythic ');
});

test('rollMythicEssenceChance hits at the documented 2% floor and 6% ceiling', () => {
  assert.equal(rollMythicEssenceChance(0, () => 0.01), true);
  assert.equal(rollMythicEssenceChance(0, () => 0.03), false);
  assert.equal(rollMythicEssenceChance(1, () => 0.05), true);
  assert.equal(rollMythicEssenceChance(1, () => 0.07), false);
});

test('RING_TOUGHNESS_FLOOR and BOSS_MYTHIC_CHANCE match the documented starting values', () => {
  assert.equal(RING_TOUGHNESS_FLOOR, 0.6);
  assert.equal(BOSS_MYTHIC_CHANCE, 0.25);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `rollMythicEssenceChance`, `RING_TOUGHNESS_FLOOR`, `BOSS_MYTHIC_CHANCE` are not exported yet, and `rollQualityTier` never returns `'mythic'`.

- [ ] **Step 3: Implement**

In `js/systems/itemQuality.js`, replace the `QUALITY_TIER_MULTIPLIERS` line and `rollQualityTier` function, and add the new constants/function after `rollUniqueEffectChance`:

```js
export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20, mythic: 1.35 };

// Starting hypothesis, not a final balance number - verify with
// scripts/simulate-balance.js before treating this as correct. A fully
// maxed Mythic item (1.35 tier x 1.75 upgrade-level-3) tops out at 2.3625x
// base, vs. Superior's current 2.1x ceiling.
export const MYTHIC_TIER_CHANCE_MIN = 0.005;
export const MYTHIC_TIER_CHANCE_MAX = 0.02;

// Only reachable once ngPlusCycle >= 1 - the mythic band sits at the low end
// of the same single roll Fine/Superior already use, so ngPlusCycle=0 (the
// default) reproduces today's exact thresholds with zero behavior change.
export function rollQualityTier(toughness, rng = Math.random, ngPlusCycle = 0) {
  const mythicChance = ngPlusCycle >= 1 ? lerp(MYTHIC_TIER_CHANCE_MIN, MYTHIC_TIER_CHANCE_MAX, toughness) : 0;
  const superiorChance = lerp(0.02, 0.10, toughness);
  const fineChance = lerp(0.10, 0.25, toughness);
  const roll = rng();
  if (roll < mythicChance) return 'mythic';
  if (roll < mythicChance + superiorChance) return 'superior';
  if (roll < mythicChance + superiorChance + fineChance) return 'fine';
  return 'plain';
}

// 1% at the weakest eligible monster, 5% at the toughest - its own
// independent check, not a bucket inside rollQualityTier.
export function rollUniqueEffectChance(toughness, rng = Math.random) {
  return rng() < lerp(0.01, 0.05, toughness);
}

// Mythic Essence: the reforge material, dropped the same way as everything
// else in this file - toughness-weighted, gated to ngPlusCycle >= 1 by its
// caller (loot.js), not by this function itself.
export const MYTHIC_ESSENCE_CHANCE_MIN = 0.02;
export const MYTHIC_ESSENCE_CHANCE_MAX = 0.06;

export function rollMythicEssenceChance(toughness, rng = Math.random) {
  return rng() < lerp(MYTHIC_ESSENCE_CHANCE_MIN, MYTHIC_ESSENCE_CHANCE_MAX, toughness);
}

// A hard floor, not a weighted chance like the rolls above - below this
// toughness, no ring-slot item can drop at all, regardless of RNG. Applies
// uniformly to every ring-slot item (loot.js's eligibleUniqueEffectPool).
export const RING_TOUGHNESS_FLOOR = 0.6;

// Bosses are excluded from rollQualityTier entirely (isToughnessEligible
// returns false for isBoss) - a dragon kill's chance to tag its named drop
// Mythic is a separate, flat roll in loot.js, not toughness-weighted.
export const BOSS_MYTHIC_CHANCE = 0.25;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/systems/itemQuality.js tests/itemQuality.test.js
git commit -m "feat: add Mythic quality tier core to itemQuality.js"
```

---

### Task 2: New item data — `items.js`

**Files:**
- Modify: `js/data/items.js`
- Modify: `tests/data.test.js`

**Interfaces:**
- Produces: `ITEMS.mythicEssence`, `ITEMS.retributionCharm`, `ITEMS.windfuryRing`. `ITEMS.emberRing.slot` changes from `'accessory'` to `'ring'`. New item-schema field `ngPlusOnly: true` (boolean, only present on `retributionCharm`/`windfuryRing`) — consumed by Task 3's `eligibleUniqueEffectPool`.
- Consumes: nothing new.

- [ ] **Step 1: Update the failing assertion + write new tests**

`tests/data.test.js`'s existing "the three v1 Unique-effect items have the documented slots" test asserts `emberRing.slot === 'accessory'` — this must change since Ember Ring is being reclassified. Update that one line:

```js
  const emberRing = ITEMS.emberRing;
  assert.equal(emberRing.name, 'Ember Ring');
  assert.equal(emberRing.slot, 'ring'); // reclassified 2026-08-30 - was 'accessory'
```

Add a new test in the same file:

```js
test('the two NG+-exclusive unique items have the documented slots, prices, effect stats, and ngPlusOnly flag', () => {
  const retributionCharm = ITEMS.retributionCharm;
  assert.equal(retributionCharm.name, 'Retribution Charm');
  assert.equal(retributionCharm.slot, 'accessory');
  assert.equal(retributionCharm.price, 0);
  assert.equal(retributionCharm.stats.thornsPercent, 20);
  assert.equal(retributionCharm.ngPlusOnly, true);

  const windfuryRing = ITEMS.windfuryRing;
  assert.equal(windfuryRing.name, 'Windfury Ring');
  assert.equal(windfuryRing.slot, 'ring');
  assert.equal(windfuryRing.price, 0);
  assert.equal(windfuryRing.stats.extraSwingChance, 10);
  assert.equal(windfuryRing.stats.critChancePercent, 8);
  assert.equal(windfuryRing.ngPlusOnly, true);

  for (const id of ['retributionCharm', 'windfuryRing']) {
    assert.ok(!SHOP_CATALOG.includes(id), `${id} must not be shop-purchasable`);
  }
});

test('mythicEssence is a generic material (no upgradeSlot) not sold in the shop', () => {
  const essence = ITEMS.mythicEssence;
  assert.equal(essence.name, 'Mythic Essence');
  assert.equal(essence.type, 'material');
  assert.equal(essence.upgradeSlot, undefined);
  assert.ok(!SHOP_CATALOG.includes('mythicEssence'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `ITEMS.mythicEssence`/`retributionCharm`/`windfuryRing` are `undefined`, and `emberRing.slot` is still `'accessory'`.

- [ ] **Step 3: Implement**

In `js/data/items.js`, change Ember Ring's slot and add the three new items. Ember Ring (in the "Unique-effect drops" block):

```js
  emberRing: { id: 'emberRing', name: 'Ember Ring', emoji: '🔥', slot: 'ring', price: 0,
    stats: { elementalProcChance: 20, elementalProcDamage: 6 } },
```

Add after `keenEye` in that same "Unique-effect drops" block:

```js
  // NG+-exclusive - see js/systems/loot.js's eligibleUniqueEffectPool,
  // gated on ngPlusOnly + (for windfuryRing) the ring toughness floor.
  retributionCharm: { id: 'retributionCharm', name: 'Retribution Charm', emoji: '🪞', slot: 'accessory', price: 0,
    stats: { thornsPercent: 20 }, ngPlusOnly: true },
  windfuryRing: { id: 'windfuryRing', name: 'Windfury Ring', emoji: '💍', slot: 'ring', price: 0,
    stats: { extraSwingChance: 10, critChancePercent: 8 }, ngPlusOnly: true },
```

Add to the "Materials" block, after `boneFragment`:

```js
  // Reforge material for the Mythic tier (js/systems/inventory.js's
  // reforgeToMythic) - no upgradeSlot, since it's collected generically
  // rather than per-slot like the other materials above.
  mythicEssence: { id: 'mythicEssence', name: 'Mythic Essence', emoji: '💎', type: 'material' },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/data/items.js tests/data.test.js
git commit -m "feat: add Mythic Essence, Retribution Charm, Windfury Ring; reclassify Ember Ring to ring slot"
```

---

### Task 3: `rollDrop` threading — `loot.js`

**Files:**
- Modify: `js/systems/loot.js`
- Test: `tests/loot.test.js`

**Interfaces:**
- Consumes (from Task 1): `rollMythicEssenceChance`, `RING_TOUGHNESS_FLOOR`, `BOSS_MYTHIC_CHANCE` from `itemQuality.js`. Consumes (from Task 2): `ITEMS.mythicEssence`, `.ngPlusOnly`, `.slot === 'ring'`.
- Produces: `rollDrop(monster, rng = Math.random, ngPlusCycle = 0)` — same shape as before (`{ gold, item, tier }`), `item` can now be `'mythicEssence'`, `tier` can now be `'mythic'`. `UNIQUE_EFFECT_ITEM_IDS` gains `'retributionCharm', 'windfuryRing'`. `getItemSources('mythicEssence')` returns a real source string instead of falling through to "Unknown source".

- [ ] **Step 1: Write the failing tests**

Add to `tests/loot.test.js`:

```js
test('rollDrop never rolls mythic essence, retributionCharm, or windfuryRing when ngPlusCycle is omitted or 0', () => {
  const toughMonster = { goldRange: [18, 30], xp: 63, dropTable: [] }; // wraith-level
  for (let i = 0; i <= 20; i++) {
    const v = i / 20;
    const drop = rollDrop(toughMonster, () => v);
    assert.notEqual(drop.item, 'mythicEssence');
    assert.notEqual(drop.item, 'retributionCharm');
    assert.notEqual(drop.item, 'windfuryRing');
  }
});

test('rollDrop can grant mythic essence once ngPlusCycle >= 1', () => {
  const toughMonster = { goldRange: [18, 30], xp: 63, dropTable: [] };
  // sequence: [gold, mythic-essence check (0.01 < 0.06 ceiling at toughness 1 -> hits)]
  const drop = rollDrop(toughMonster, sequence(0, 0.01), 1);
  assert.equal(drop.item, 'mythicEssence');
});

test('rollDrop can grant a mythic-tier ordinary equipment drop once ngPlusCycle >= 1', () => {
  const toughMonster = { goldRange: [18, 30], xp: 63, dropTable: [] };
  // sequence: [gold, mythic-essence check (misses), unique-effect check (misses),
  //            ordinary-gear gate (hits), pool pick, quality roll -> mythic]
  const drop = rollDrop(toughMonster, sequence(0, 0.5, 0.5, 0.05, 0, 0.001), 1);
  assert.ok(EQUIPMENT_DROP_POOL.includes(drop.item));
  assert.equal(drop.tier, 'mythic');
});

test('rollDrop excludes windfuryRing/retributionCharm from the Unique-effect pool below ngPlusCycle 1, and Ember Ring below the ring toughness floor', () => {
  const weakMonster = { goldRange: [4, 8], xp: 16, dropTable: [] }; // boar-level, toughness ~0.096, well under the 0.6 ring floor
  // sequence: [gold, mythic-essence check misses (0.5 well above its ~2.4% chance at this toughness),
  //            unique-effect check hits (0.001 well below its ~1.4% chance), pool pick index 0]
  // At this toughness/cycle, emberRing and windfuryRing are excluded (ring floor), retributionCharm is
  // NOT excluded (it's accessory-slot, only gated by ngPlusOnly, which cycle 1 satisfies) - the surviving
  // pool is ['vampiricFang', 'swiftStrikeCharm', 'keenEye', 'retributionCharm'], so index 0 is deterministic.
  const drop = rollDrop(weakMonster, sequence(0, 0.5, 0.001, 0), 1);
  assert.equal(drop.item, 'vampiricFang');
});

test('rollDrop can grant windfuryRing once ngPlusCycle >= 1 and the monster is above the ring toughness floor', () => {
  const toughMonster = { goldRange: [18, 30], xp: 63, dropTable: [] }; // toughness 1, well above the 0.6 floor
  // sequence: [gold, mythic-essence check misses, unique-effect check hits, pool pick -> last index]
  // At toughness 1/cycle 1 nothing is excluded, so the pool is the full 6-item
  // UNIQUE_EFFECT_ITEM_IDS list in its declared order - index 5 (floor(0.999*6)) is windfuryRing.
  const drop = rollDrop(toughMonster, sequence(0, 0.5, 0.01, 0.999), 1);
  assert.equal(drop.item, 'windfuryRing');
});

test('rollDrop tags a boss\'s named drop as mythic once ngPlusCycle >= 1, per BOSS_MYTHIC_CHANCE', () => {
  const bossLike = { goldRange: [65, 100], xp: 200, isBoss: true, dropTable: [{ itemId: 'dragonFang', chance: 1 }] };
  // sequence: [gold, dropTable roll (hits dragonFang), boss-mythic roll (0.01 < 0.25 -> hits)]
  const drop = rollDrop(bossLike, sequence(0, 0, 0.01), 1);
  assert.equal(drop.item, 'dragonFang');
  assert.equal(drop.tier, 'mythic');
});

test('rollDrop never tags a boss drop mythic when ngPlusCycle is 0', () => {
  const bossLike = { goldRange: [65, 100], xp: 200, isBoss: true, dropTable: [{ itemId: 'dragonFang', chance: 1 }] };
  const drop = rollDrop(bossLike, sequence(0, 0, 0), 0);
  assert.equal(drop.item, 'dragonFang');
  assert.equal(drop.tier, undefined);
});

test('getItemSources gives mythicEssence a real source instead of falling through to Unknown source', () => {
  assert.ok(getItemSources('mythicEssence').length > 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `rollDrop` doesn't accept a third argument yet, `UNIQUE_EFFECT_ITEM_IDS` doesn't include the two new items, `getItemSources('mythicEssence')` returns `[]`.

- [ ] **Step 3: Implement**

In `js/systems/loot.js`, update the import and `UNIQUE_EFFECT_ITEM_IDS`:

```js
import {
  isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance,
  rollMythicEssenceChance, RING_TOUGHNESS_FLOOR, BOSS_MYTHIC_CHANCE,
} from './itemQuality.js';

export const EQUIPMENT_DROP_CHANCE = 0.10; // flat - toughness already drives
  // *quality* within this roll; scaling the gate too would double-compound
  // the reward for fighting tougher monsters.
export const EQUIPMENT_DROP_POOL = SHOP_CATALOG.filter((id) => ITEMS[id].slot);
export const UNIQUE_EFFECT_ITEM_IDS = ['vampiricFang', 'swiftStrikeCharm', 'emberRing', 'keenEye', 'retributionCharm', 'windfuryRing'];

// vampiricFang/swiftStrikeCharm/keenEye are never filtered out (no
// ngPlusOnly flag, not a ring slot) - this invariant is what guarantees the
// pool below is never empty, at any toughness/cycle combination.
function eligibleUniqueEffectPool(toughness, ngPlusCycle) {
  return UNIQUE_EFFECT_ITEM_IDS.filter((id) => {
    const item = ITEMS[id];
    if (item.ngPlusOnly && ngPlusCycle < 1) return false;
    if (item.slot === 'ring' && toughness < RING_TOUGHNESS_FLOOR) return false;
    return true;
  });
}
```

Update `getItemSources` — add a case before the final `else if`:

```js
export function getItemSources(itemId) {
  const sources = [];
  if (ITEMS[itemId].startingItem) sources.push('Starting gear');
  for (const monster of Object.values(MONSTERS)) {
    if ((monster.dropTable || []).some((entry) => entry.itemId === itemId)) {
      sources.push(`Dropped by ${monster.name}`);
    }
  }
  if (SHOP_CATALOG.includes(itemId)) sources.push('Available in the shop');
  if (MINI_DUNGEON_TREASURE_ITEM_POOL.includes(itemId)) sources.push('Mini-dungeon treasure');
  if (itemId === 'mythicEssence') sources.push('Rare NG+ monster-kill drop');
  else if (UNIQUE_EFFECT_ITEM_IDS.includes(itemId)) sources.push('Rare monster-kill drop');
  else if (EQUIPMENT_DROP_POOL.includes(itemId)) sources.push('Found on monster kills');
  return sources;
}
```

Update `rollDrop`:

```js
export function rollDrop(monster, rng = Math.random, ngPlusCycle = 0) {
  const [minGold, maxGold] = monster.goldRange;
  const gold = minGold + Math.floor(rng() * (maxGold - minGold + 1));

  let item = null;
  let tier;
  const eligible = isToughnessEligible(monster);
  const toughness = eligible ? monsterToughness(monster) : 0;

  // Mythic Essence gets first dibs on the "at most one bonus item per kill"
  // slot, but only once ngPlusCycle >= 1 - the short-circuit on that check
  // means zero extra rng() calls at cycle 0, so every pre-NG+ test/player
  // sees identical behavior to before this feature existed.
  if (eligible) {
    if (ngPlusCycle >= 1 && rollMythicEssenceChance(toughness, rng)) {
      item = 'mythicEssence';
    } else if (rollUniqueEffectChance(toughness, rng)) {
      item = pickRandom(eligibleUniqueEffectPool(toughness, ngPlusCycle), rng);
    } else if (rng() < EQUIPMENT_DROP_CHANCE) {
      item = pickRandom(EQUIPMENT_DROP_POOL, rng);
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    }
  }

  if (!item && monster.dropTable && monster.dropTable.length > 0) {
    const roll = rng();
    let cumulative = 0;
    for (const entry of monster.dropTable) {
      cumulative += entry.chance;
      if (roll < cumulative) {
        item = entry.itemId;
        break;
      }
    }
    // An existing named equipment drop (e.g. goblinClub) can still be a
    // better-than-plain copy of itself, but never redirects into an
    // unrelated Unique-effect item - the named drop IS that item.
    if (item && eligible && ITEMS[item].slot) {
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    }
    // Bosses are excluded from the toughness-weighted roll above
    // (isToughnessEligible is false for isBoss), so their named drops never
    // get a tier there - this is the separate mechanism that lets a dragon
    // kill's dragonFang/dragonScaleMail become Mythic in NG+.
    if (item && monster.isBoss && ngPlusCycle >= 1 && ITEMS[item].slot && rng() < BOSS_MYTHIC_CHANCE) {
      tier = 'mythic';
    }
  }

  return { gold, item, tier };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/systems/loot.js tests/loot.test.js
git commit -m "feat: thread ngPlusCycle through rollDrop for Mythic tier, essence, and boss drops"
```

---

### Task 4: `thornsPercent` stat + reforge — `inventory.js`

**Files:**
- Modify: `js/systems/inventory.js`
- Test: `tests/inventory.test.js`

**Interfaces:**
- Produces: `thornsPercent` added to `STAT_KEYS` (flows automatically through `getItemEffectiveStats`/`getEquipmentBonuses`/`getItemStatDelta`, no other change needed there). `REFORGE_GOLD_COST`, `REFORGE_ESSENCE_COST` (numbers). `canReforgeToMythic(state, slot) -> boolean`. `reforgeToMythic(state, slot) -> state` (throws on invalid state, same error-throwing convention as `upgradeItem`).
- Consumes (from Task 2): `ITEMS.mythicEssence`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/inventory.test.js`:

```js
test('getEquipmentBonuses includes thornsPercent from an equipped Retribution Charm', () => {
  const state = {
    equipment: { weapon: null, head: null, body: null, legs: null, accessory: 'retributionCharm', ring1: null, ring2: null },
    equipmentTiers: {},
    upgrades: {},
  };
  const bonuses = getEquipmentBonuses(state);
  assert.equal(bonuses.thornsPercent, 20);
});

test('canReforgeToMythic is true only for an equipped Superior-tier item', () => {
  const state = {
    equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: { weapon: 'superior' },
    upgrades: {},
  };
  assert.equal(canReforgeToMythic(state, 'weapon'), true);
  assert.equal(canReforgeToMythic(state, 'head'), false); // nothing equipped
  const fineState = { ...state, equipmentTiers: { weapon: 'fine' } };
  assert.equal(canReforgeToMythic(fineState, 'weapon'), false);
});

test('reforgeToMythic spends gold and essence, sets the slot tier to mythic, and carries over the upgrade level', () => {
  const state = {
    player: { gold: 500 },
    equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: { weapon: 'superior' },
    upgrades: { 'ironSword:superior': 2 },
    inventory: [{ itemId: 'mythicEssence', quantity: 5 }],
  };
  const next = reforgeToMythic(state, 'weapon');
  assert.equal(next.player.gold, 500 - REFORGE_GOLD_COST);
  assert.equal(next.equipmentTiers.weapon, 'mythic');
  assert.equal(next.upgrades['ironSword:mythic'], 2);
  const essenceEntry = next.inventory.find((e) => e.itemId === 'mythicEssence');
  assert.equal(essenceEntry.quantity, 5 - REFORGE_ESSENCE_COST);
});

test('reforgeToMythic throws when the slot is not Superior tier', () => {
  const state = {
    player: { gold: 500 },
    equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: {},
    upgrades: {},
    inventory: [{ itemId: 'mythicEssence', quantity: 5 }],
  };
  assert.throws(() => reforgeToMythic(state, 'weapon'));
});

test('reforgeToMythic throws when short on gold or essence', () => {
  const base = {
    equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: { weapon: 'superior' },
    upgrades: {},
  };
  assert.throws(() => reforgeToMythic({ ...base, player: { gold: 0 }, inventory: [{ itemId: 'mythicEssence', quantity: 5 }] }, 'weapon'));
  assert.throws(() => reforgeToMythic({ ...base, player: { gold: 500 }, inventory: [] }, 'weapon'));
});
```

Update the import line at the top of `tests/inventory.test.js` to include the new names (`canReforgeToMythic, reforgeToMythic, REFORGE_GOLD_COST, REFORGE_ESSENCE_COST`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — none of the new exports exist yet.

- [ ] **Step 3: Implement**

In `js/systems/inventory.js`, add `thornsPercent` to `STAT_KEYS`:

```js
const STAT_KEYS = [
  'attack', 'defense', 'maxHp', 'speed', 'enemySlowPercent',
  'lifestealPercent', 'extraSwingChance', 'elementalProcChance', 'elementalProcDamage',
  'critChancePercent', 'thornsPercent',
];
```

Add after `upgradeItem`:

```js
// Reforge: Superior -> Mythic, gold + Mythic Essence, gated to NG+ by the
// caller (smithScreen.js only shows this once ngPlusCycle >= 1). Starting
// numbers, not final balance - see the design spec.
export const REFORGE_GOLD_COST = 400;
export const REFORGE_ESSENCE_COST = 3;

export function canReforgeToMythic(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) return false;
  return state.equipmentTiers?.[slot] === 'superior';
}

// Carries the item's current (Superior-tier) upgrade level over to its new
// Mythic-tier key, rather than resetting to 0 - it's the same physical
// item being reforged, not a fresh copy, so losing smith-upgrade progress
// on reforge would make this a straight downgrade until re-upgraded.
export function reforgeToMythic(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);
  const tier = state.equipmentTiers?.[slot];
  if (tier !== 'superior') throw new Error(`${itemId} must be Superior tier to reforge`);

  const essenceCount = state.inventory.find((entry) => entry.itemId === 'mythicEssence')?.quantity || 0;
  if (essenceCount < REFORGE_ESSENCE_COST) throw new Error('Not enough Mythic Essence');
  if (state.player.gold < REFORGE_GOLD_COST) throw new Error('Not enough gold');

  let next = spendGold(state, REFORGE_GOLD_COST);
  next = removeItem(next, 'mythicEssence', REFORGE_ESSENCE_COST);
  const carriedUpgradeLevel = getUpgradeLevel(next, itemId, tier);
  next = {
    ...next,
    equipmentTiers: { ...next.equipmentTiers, [slot]: 'mythic' },
    upgrades: { ...next.upgrades, [upgradeKey(itemId, 'mythic')]: carriedUpgradeLevel },
  };
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/systems/inventory.js tests/inventory.test.js
git commit -m "feat: add thornsPercent stat and Mythic reforge to inventory.js"
```

---

### Task 5: Thorns reflect damage — `combat.js`

**Files:**
- Modify: `js/systems/combat.js`
- Test: `tests/combat.test.js`

**Interfaces:**
- Produces: `resolveMonsterAttack(monster, player, rng = Math.random, thornsPercent = 0)` now also returns `monsterHp` and `reflectedDamage` in its result object (existing fields unchanged).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

Add to `tests/combat.test.js`, right after the existing `resolveMonsterAttack` test:

```js
test('resolveMonsterAttack with thornsPercent 0 (the default) never reflects damage', () => {
  const monster = { attack: 8, defense: 2, atb: 0, hp: 50 };
  const player = { hp: 20, defense: 4, atb: 60 };
  const result = resolveMonsterAttack(monster, player, () => 0.5);
  assert.equal(result.monsterHp, 50);
  assert.equal(result.reflectedDamage, 0);
});

test('resolveMonsterAttack reflects thornsPercent of the incoming damage back at the monster', () => {
  const monster = { attack: 8, defense: 2, atb: 0, hp: 50 };
  const player = { hp: 20, defense: 4, atb: 60 };
  // base 8-4=4, variance 1.0 -> damage 4; 20% of 4 = 0.8, rounds to 1
  const result = resolveMonsterAttack(monster, player, () => 0.5, 20);
  assert.equal(result.damage, 4);
  assert.equal(result.reflectedDamage, 1);
  assert.equal(result.monsterHp, 49);
});

test('resolveMonsterAttack thorns reflect never drops monsterHp below 0', () => {
  const monster = { attack: 8, defense: 2, atb: 0, hp: 1 };
  const player = { hp: 20, defense: 4, atb: 60 };
  const result = resolveMonsterAttack(monster, player, () => 0.5, 100);
  assert.equal(result.monsterHp, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `result.monsterHp`/`result.reflectedDamage` are `undefined`.

- [ ] **Step 3: Implement**

In `js/systems/combat.js`, replace `resolveMonsterAttack`:

```js
export function resolveMonsterAttack(monster, player, rng = Math.random, thornsPercent = 0) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(monster, player, rng);
  damage = applyCritMultiplier(damage, isCrit);
  const reflectedDamage = Math.round(damage * thornsPercent / 100);
  return {
    damage,
    isCrit,
    playerHp: Math.max(0, player.hp - damage),
    playerAtb: applyKnockback(player.atb, ATB_KNOCKBACK),
    monsterAtb: 0,
    monsterHp: Math.max(0, monster.hp - reflectedDamage),
    reflectedDamage,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/systems/combat.js tests/combat.test.js
git commit -m "feat: add thorns reflect damage to resolveMonsterAttack"
```

---

### Task 6: Wire thorns into the battle screen — `battleScreen.js`

**Files:**
- Modify: `js/screens/battleScreen.js`
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes (from Task 5): `resolveMonsterAttack`'s new `monsterHp`/`reflectedDamage` fields. Consumes the existing module-level `playerEffectBonuses` (already populated at battle-mount time, already used for `critChancePercent`/`lifestealPercent`/etc. at lines 119-124/937/990).
- Produces: `monsterAttack(monster)` now applies thorns reflect damage to the monster and logs it, mirroring the existing `resolveParrySuccess` counter-attack pattern in `resolveMonsterWindup`.

- [ ] **Step 1: Write the failing test**

This file has no existing test that lets an unparried monster attack actually land (the parry tests all press the parry key in time) — but it has everything needed to build one: `monsterOverrides: [{ speed: 1000 }]` saturates the monster's ATB on the first 300ms tick so its windup starts immediately, and `tick()`'s own `isWindupComplete` check (`js/screens/battleScreen.js:1317-1322`) automatically resolves the windup as unparried once `PARRY_WINDUP_DURATION_MS` (1000ms, from `js/systems/parry.js`) elapses with no parry keypress — this calls `monsterAttack(monster)` for real. Add this test to `tests/battleScreenDom.test.js`, in the same `test('battleScreen DOM', ...)` block as the existing parry tests:

```js
  await t.test('a Retribution Charm reflects damage back at the attacking monster on its unparried attack', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ equipment: { ...createNewGame().equipment, accessory: 'retributionCharm' } }),
      monsterOverrides: [{ speed: 1000 }],
    });
    // windup starts on the first tick (~300ms); wait past the full
    // PARRY_WINDUP_DURATION_MS (1000ms) without pressing the parry key
    // ('s'), then past one more 300ms tick so tick()'s own
    // isWindupComplete poll catches it and resolves an unparried attack -
    // same windup mechanics the existing parry tests above use, just
    // letting the window close instead of pressing in time.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await new Promise((resolve) => setTimeout(resolve, 350));
    const log = root.querySelector('#battle-log').textContent;
    assert.match(log, /hits you for/);
    assert.match(log, /Retribution Charm reflects/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — no reflect log line exists yet.

- [ ] **Step 3: Implement**

In `js/screens/battleScreen.js`, update `monsterAttack` and `applyMonsterAttackImpact`:

```js
function applyMonsterAttackImpact(monster, result) {
  log.push(result.isCrit
    ? `Critical! ${monster.name} hits you for ${result.damage}!`
    : `${monster.name} hits you for ${result.damage}.`);
  if (result.reflectedDamage > 0) {
    log.push(`Your Retribution Charm reflects ${result.reflectedDamage} damage back at ${monster.name}!`);
    const monsterIndex = monsterCombatants.indexOf(monster);
    playHitEffect(elements.monsterZones[monsterIndex], elements.monsterEmojis[monsterIndex], result.reflectedDamage, false);
  }
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, result.damage, result.isCrit);
  checkOutcome();
}

function monsterAttack(monster) {
  const result = resolveMonsterAttack(monster, playerCombatant, Math.random, playerEffectBonuses.thornsPercent);
  playerCombatant.hp = result.playerHp;
  playerCombatant.atb = result.playerAtb;
  monster.atb = result.monsterAtb;
  monster.hp = result.monsterHp;
  const monsterIndex = monsterCombatants.indexOf(monster);
  playMonsterAttackWindup(monster, monsterIndex);
  applyMonsterAttackImpact(monster, result);
}
```

The log copy hard-codes "Retribution Charm" since it's currently the only source of `thornsPercent` — if a second thorns source is ever added, generalize the wording then, not preemptively.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js tests/battleScreenDom.test.js
git commit -m "feat: wire thorns reflect damage and log line into battleScreen monster attacks"
```

---

### Task 7: Ring slots in state — `state.js` + `main.js`

**Files:**
- Modify: `js/state.js`
- Modify: `js/main.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Produces: `createNewGame`'s `equipment`/`equipmentTiers` include `ring1: null, ring2: null`. New `migrateRingSlots(state) -> state` in `state.js` (idempotent, same convention as `migrateNgPlusToolCarryover`/`migrateUpgradesToPerTier`).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

Add to `tests/state.test.js`:

```js
test('createNewGame includes empty ring1/ring2 equipment slots', () => {
  const state = createNewGame();
  assert.equal(state.equipment.ring1, null);
  assert.equal(state.equipment.ring2, null);
});

test('migrateRingSlots adds empty ring1/ring2 keys to a save that predates them', () => {
  const legacy = createNewGame();
  delete legacy.equipment.ring1;
  delete legacy.equipment.ring2;
  const migrated = migrateRingSlots(legacy);
  assert.equal(migrated.equipment.ring1, null);
  assert.equal(migrated.equipment.ring2, null);
});

test('migrateRingSlots is a no-op on a save that already has ring slots', () => {
  const state = createNewGame();
  state.equipment.ring1 = 'emberRing';
  const migrated = migrateRingSlots(state);
  assert.equal(migrated.equipment.ring1, 'emberRing');
});

test('migrateRingSlots never overwrites an already-equipped ring', () => {
  const legacy = createNewGame();
  legacy.equipment.ring1 = 'emberRing';
  delete legacy.equipment.ring2;
  const migrated = migrateRingSlots(legacy);
  assert.equal(migrated.equipment.ring1, 'emberRing');
  assert.equal(migrated.equipment.ring2, null);
});
```

Update the import line at the top of `tests/state.test.js` to include `migrateRingSlots`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `migrateRingSlots` is not exported yet, and `createNewGame().equipment.ring1` is `undefined`.

- [ ] **Step 3: Implement**

In `js/state.js`, update `createNewGame`'s `equipment` line:

```js
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
```

Add after `createNewGame`:

```js
// One-time migration for saves from before ring slots existed - nothing
// carries over into them (no item has ever occupied a ring slot before this
// feature), this just adds the two empty keys so downstream code that reads
// state.equipment.ring1/ring2 directly never sees undefined vs. null drift.
export function migrateRingSlots(state) {
  if ('ring1' in state.equipment && 'ring2' in state.equipment) return state;
  return {
    ...state,
    equipment: { ring1: null, ring2: null, ...state.equipment },
    equipmentTiers: { ...state.equipmentTiers },
  };
}
```

In `js/main.js`, add the import and call it alongside the two existing migrations (line ~122-123):

```js
import { loadState, saveState, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION, migrateRingSlots } from './state.js';
```

```js
  state = migrateUpgradesToPerTier(loadedState);
  state = migrateNgPlusToolCarryover(state);
  state = migrateRingSlots(state);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/state.js js/main.js tests/state.test.js
git commit -m "feat: add ring1/ring2 equipment slots to state, with a load-time migration"
```

---

### Task 8: Thread `ngPlusCycle` into `main.js`'s `rollDrop` call sites

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes (from Task 3): `rollDrop`'s new third parameter.
- No new exports — this task only changes call sites.

- [ ] **Step 1: Update the three call sites**

`js/main.js` has three `rollDrop(scaledMonster)` calls (in the win-outcome loop, the `fled-with-loot` branch, and the `fled` loop — found via `grep -n "rollDrop(" js/main.js`). `state.ngPlusCycle` is already in scope at all three (each already reads it one line earlier for `getNgPlusRewardMultiplier`/`scaleDropTable`). Change each:

```js
const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: PASS (no behavior change for `ngPlusCycle === 0`; this task has no dedicated new test since it's pure call-site wiring already covered by Task 3's `rollDrop` unit tests — verify manually per Step 3 below).

- [ ] **Step 3: Manual sanity check**

Start the game locally (`python3 -m http.server 8000`, per this repo's README), start NG+ from a save with `dungeonBossDefeated: true`, and confirm a few kills still grant gold/items normally (no crash, no regression) — this is a wiring task with no isolated unit to test, so this manual check is the actual verification.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: thread state.ngPlusCycle into main.js's rollDrop call sites"
```

---

### Task 9: Smith reforge UI — `smithScreen.js`

**Files:**
- Modify: `js/screens/smithScreen.js`
- Test: `tests/smithScreenDom.test.js` (new file — no smith DOM test exists yet; mirror `tests/inventoryScreenDom.test.js`'s `setupDom`/`teardownDom`/`createRoot`/`click` pattern from `tests/helpers/dom.js`)

**Interfaces:**
- Consumes (from Task 4): `canReforgeToMythic`, `reforgeToMythic`, `REFORGE_GOLD_COST`, `REFORGE_ESSENCE_COST` from `inventory.js`.
- Produces: a new "Reforge to Mythic" button per slot, shown only when `canReforgeToMythic(state, slot)` is true and `state.ngPlusCycle >= 1`.

- [ ] **Step 1: Write the failing test**

Create `tests/smithScreenDom.test.js`:

```js
// Real DOM tests for js/screens/smithScreen.js's Mythic reforge action,
// using jsdom (see tests/helpers/dom.js). Not exhaustive coverage of the
// pre-existing smith-upgrade flow - scoped to the new reforge button.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click } from './helpers/dom.js';

function buildState(overrides = {}) {
  return {
    player: { gold: 500 },
    equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: { weapon: 'superior' },
    upgrades: {},
    inventory: [{ itemId: 'mythicEssence', quantity: 5 }],
    ngPlusCycle: 1,
    ...overrides,
  };
}

async function mountSmith(state, callbacks = { onUpgrade: () => {}, onLeave: () => {} }) {
  const { mount } = await import('../js/screens/smithScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('smithScreen reforge DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/smithScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('shows a Reforge button for a Superior-tier equipped item once ngPlusCycle >= 1', async () => {
    const root = await mountSmith(buildState());
    assert.ok(root.querySelector('button[data-reforge="weapon"]'));
  });

  await t.test('hides the Reforge button before ngPlusCycle 1', async () => {
    const root = await mountSmith(buildState({ ngPlusCycle: 0 }));
    assert.equal(root.querySelector('button[data-reforge="weapon"]'), null);
  });

  await t.test('hides the Reforge button for a non-Superior tier', async () => {
    const root = await mountSmith(buildState({ equipmentTiers: {} }));
    assert.equal(root.querySelector('button[data-reforge="weapon"]'), null);
  });

  await t.test('clicking Reforge sets the slot tier to mythic and calls onUpgrade', async () => {
    let upgraded = false;
    const root = await mountSmith(buildState(), { onUpgrade: () => { upgraded = true; }, onLeave: () => {} });
    click(root.querySelector('button[data-reforge="weapon"]'));
    assert.ok(upgraded);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — no `[data-reforge]` button exists yet.

- [ ] **Step 3: Implement**

In `js/screens/smithScreen.js`, update the import and `render`:

```js
import { ITEMS } from '../data/items.js';
import {
  upgradeCost, upgradeItem, MAX_UPGRADE_LEVEL, describeItem, getUpgradeLevel,
  canReforgeToMythic, reforgeToMythic, REFORGE_GOLD_COST, REFORGE_ESSENCE_COST,
} from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';
```

```js
function render() {
  const rows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="smith-row">${slot}: (empty)</div>`;

    const item = ITEMS[itemId];
    const tier = state.equipmentTiers?.[slot];
    const level = getUpgradeLevel(state, itemId, tier);

    const reforgeEligible = state.ngPlusCycle >= 1 && canReforgeToMythic(state, slot);
    const essenceCount = state.inventory.find((entry) => entry.itemId === 'mythicEssence')?.quantity || 0;
    const canAffordReforge = state.player.gold >= REFORGE_GOLD_COST && essenceCount >= REFORGE_ESSENCE_COST;
    const reforgeButton = reforgeEligible
      ? `<button data-reforge="${slot}" ${canAffordReforge ? '' : 'disabled'}>Reforge to Mythic (${REFORGE_GOLD_COST}g + ${REFORGE_ESSENCE_COST} Essence)</button>`
      : '';

    if (level >= MAX_UPGRADE_LEVEL) {
      return `<div class="smith-row">
      <span title="${describeItem(itemId, tier)}">${item.emoji} ${tierLabel(tier)}${item.name} +${level} (MAX)</span>
      ${reforgeButton}
    </div>`;
    }

    const cost = upgradeCost(level);
    const materials = materialOptionsForSlot(slot);
    const canAfford = state.player.gold >= cost;
    const options = materials
      .map((m) => `<option value="${m.itemId}" title="${describeItem(m.itemId)}">${ITEMS[m.itemId].name} (x${m.quantity})</option>`)
      .join('');

    return `<div class="smith-row">
      <span title="${describeItem(itemId, tier)}">${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      <select data-slot="${slot}">${options}</select>
      <button data-slot="${slot}" ${materials.length === 0 || !canAfford ? 'disabled' : ''}>Upgrade (${cost}g)</button>
      ${reforgeButton}
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="smith-screen">
      <button class="screen-close-x" id="btn-close-x" aria-label="Leave smith">✕</button>
      <h2>Smith (Gold: ${state.player.gold})</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-slot]').forEach((btn) => {
    btn.onclick = () => tryUpgrade(btn.dataset.slot);
  });
  rootEl.querySelectorAll('button[data-reforge]').forEach((btn) => {
    btn.onclick = () => tryReforge(btn.dataset.reforge);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
  document.getElementById('btn-close-x').onclick = () => callbacks.onLeave();
}

function tryReforge(slot) {
  try {
    const next = reforgeToMythic(state, slot);
    Object.assign(state, next);
    callbacks.onUpgrade();
  } catch {
    // Not enough gold or essence — button availability already reflects this
  }
  render();
}
```

`SLOTS` in this file gains `'ring1', 'ring2'` — combine with Task 10 which touches the same array shape in two other files, so do this rename in this task's commit and Task 10's commit together consistently (both are one-line array edits, low risk of drift):

```js
const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory', 'ring1', 'ring2'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/screens/smithScreen.js tests/smithScreenDom.test.js
git commit -m "feat: add Mythic reforge button to smithScreen"
```

---

### Task 10: Ring slot equip UI — `inventoryScreen.js` + `statsPanel.js`

**Files:**
- Modify: `js/screens/inventoryScreen.js`
- Modify: `js/screens/statsPanel.js`
- Test: `tests/inventoryScreenDom.test.js`

**Interfaces:**
- Consumes (from Task 4/9's `equipItem`, unchanged signature): `equipItem(state, itemId, slot, tier)`.
- Produces: `resolveRingEquipSlot(state) -> 'ring1' | 'ring2' | null` (new, in `inventory.js`). Ring-slot gear rows in the inventory's Gear tab render either one "Equip" button (targeting the resolved empty ring) or two buttons ("→ Ring 1" / "→ Ring 2") when both rings are already occupied. `TIER_RANK` gains `mythic: 3`.

- [ ] **Step 1: Write the failing tests**

First add `resolveRingEquipSlot` to `js/systems/inventory.js` (needed by the DOM code this task adds) — add after `equipItem`:

```js
// Rings are a slot *type* ('ring' on the item), not a physical equipment
// key - this resolves which of the two physical slots (ring1/ring2) an
// equip action should target. Returns null when both are already occupied,
// which callers (inventoryScreen.js) use to offer an explicit choice
// instead of guessing which ring to replace.
export function resolveRingEquipSlot(state) {
  if (!state.equipment.ring1) return 'ring1';
  if (!state.equipment.ring2) return 'ring2';
  return null;
}
```

Add a unit test to `tests/inventory.test.js`:

```js
test('resolveRingEquipSlot picks ring1 first, then ring2, then null when both are full', () => {
  const empty = { equipment: { ring1: null, ring2: null } };
  assert.equal(resolveRingEquipSlot(empty), 'ring1');
  const oneFull = { equipment: { ring1: 'emberRing', ring2: null } };
  assert.equal(resolveRingEquipSlot(oneFull), 'ring2');
  const bothFull = { equipment: { ring1: 'emberRing', ring2: 'windfuryRing' } };
  assert.equal(resolveRingEquipSlot(bothFull), null);
});
```

Add DOM tests to `tests/inventoryScreenDom.test.js`, in the same `test('inventoryScreen DOM', ...)` block as the existing equip test (`'equipping an item from the Gear tab still moves it into Equipment and calls onChange'`, which needs no tab click first since Gear is already the default active tab — follow that same shape). First update `buildState()` in this file to include `ring1: null, ring2: null` in its `equipment` object (required so `renderEquippedRows`/`SLOTS` don't read `undefined` for the two new slots), then add:

```js
  await t.test('equipping a ring-slot item with one empty ring slot targets that slot directly', async () => {
    const state = buildState();
    state.inventory.push({ itemId: 'emberRing', quantity: 1 });
    const root = await mountInventory(state);
    const equipBtn = root.querySelector('button[data-equip="emberRing"]');
    assert.ok(equipBtn);
    assert.equal(equipBtn.dataset.slot, 'ring1');
    click(equipBtn);
    assert.equal(state.equipment.ring1, 'emberRing');
  });

  await t.test('equipping a ring-slot item with both rings full offers a choice of which to replace', async () => {
    const state = buildState();
    state.equipment.ring1 = 'emberRing';
    state.equipment.ring2 = 'windfuryRing';
    state.inventory.push({ itemId: 'emberRing', quantity: 1 }); // a second copy, in the bag
    const root = await mountInventory(state);
    const ring1Btn = root.querySelector('button[data-equip="emberRing"][data-slot="ring1"]');
    const ring2Btn = root.querySelector('button[data-equip="emberRing"][data-slot="ring2"]');
    assert.ok(ring1Btn);
    assert.ok(ring2Btn);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `resolveRingEquipSlot` doesn't exist, ring equip buttons aren't rendered yet.

- [ ] **Step 3: Implement**

In `js/systems/inventory.js`, add `resolveRingEquipSlot` per Step 1 above (this is the real implementation, not just the test-writing step — add it now if not already present from following Step 1 literally).

In `js/screens/inventoryScreen.js`:

```js
import { ITEMS } from '../data/items.js';
import {
  getItemStatDelta, equipItem, unequipItem, removeItem, applyHeal, getEquipmentBonuses,
  describeItem, getUpgradeLevel, resolveRingEquipSlot,
} from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory', 'ring1', 'ring2'];
const SLOT_LABELS = { ring1: 'Ring 1', ring2: 'Ring 2' };
const TIER_RANK = { mythic: 3, superior: 2, fine: 1 };
```

Update `renderEquippedRows` to use the display label:

```js
function renderEquippedRows() {
  return SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    const label = SLOT_LABELS[slot] || slot;
    if (!itemId) return `<div class="inventory-row">${label}: (empty)</div>`;
    const item = ITEMS[itemId];
    const tier = state.equipmentTiers?.[slot];
    const level = getUpgradeLevel(state, itemId, tier);
    return `<div class="inventory-row">
      <span title="${describeItem(itemId, tier)}">${label}: ${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      <button data-unequip="${slot}">Unequip</button>
    </div>`;
  }).join('');
}
```

Update `renderGearRows` to branch on ring-slot items:

```js
function equipButtonsFor(entry, item) {
  if (item.slot !== 'ring') {
    return `<button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="${item.slot}">Equip</button>`;
  }
  const resolvedSlot = resolveRingEquipSlot(state);
  if (resolvedSlot) {
    return `<button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="${resolvedSlot}">Equip</button>`;
  }
  return `<button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="ring1">→ Ring 1</button>
    <button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="ring2">→ Ring 2</button>`;
}

function renderGearRows(entries) {
  if (entries.length === 0) return '<div class="inventory-empty">No unequipped gear.</div>';
  return entries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const delta = getItemStatDelta(state, entry.itemId, entry.tier);
    const deltaText = formatDelta(delta);
    const qtyText = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    return `<div class="inventory-row">
      <span title="${describeItem(entry.itemId, entry.tier)}">${item.emoji} ${tierLabel(entry.tier)}${item.name}${qtyText}${deltaText ? ` (${deltaText})` : ''}</span>
      ${equipButtonsFor(entry, item)}
    </div>`;
  }).join('');
}
```

Update the equip click handler to use `data-slot` instead of re-deriving from `ITEMS[itemId].slot`:

```js
  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      const tier = btn.dataset.tier || undefined;
      Object.assign(state, equipItem(state, itemId, btn.dataset.slot, tier));
      callbacks.onChange();
      render();
    };
  });
```

In `js/screens/statsPanel.js` (display-only, no equip action here):

```js
const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory', 'ring1', 'ring2'];
const SLOT_LABELS = { ring1: 'Ring 1', ring2: 'Ring 2' };
```

```js
  const equipRows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    const label = SLOT_LABELS[slot] || slot;
    if (!itemId) return `<div class="stats-slot">${label}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    const tier = state.equipmentTiers?.[slot];
    return `<div class="stats-slot">${label}: ${item.emoji} ${tierLabel(tier)}${item.name} +${level}</div>`;
  }).join('');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/systems/inventory.js js/screens/inventoryScreen.js js/screens/statsPanel.js tests/inventoryScreenDom.test.js tests/inventory.test.js
git commit -m "feat: add ring slot equip UI to inventoryScreen and statsPanel"
```

---

### Task 11: Balance verification + docs/changelog

**Files:**
- Modify: `scripts/simulate-balance.js`
- Modify: `CHANGELOG.md`
- Modify: `js/data/playerChangelog.js`

**Interfaces:**
- No new exports — this task adds a balance baseline and closes out the repo's required docs.

- [ ] **Step 1: Add a maxed-Mythic NG+2 baseline vs. NG+2-scaled monsters**

`makeBuild` (`scripts/simulate-balance.js`) currently hard-codes `upgrades: {}` and never passes `equipmentTiers` at all, so no existing build models tier or smith-upgrade level — and `main()`'s `monsters` map has no NG+-cycle scaling, only boss-tier scaling via `getBossTierStats`. Both need a small, additive extension (no existing build/behavior changes).

Update the imports at the top of the file:

```js
import { getEquipmentBonuses, upgradeKey, MAX_UPGRADE_LEVEL } from '../js/systems/inventory.js';
import { getNgPlusCombatOverrides } from '../js/systems/ngPlus.js';
```

Update `makeBuild` to accept optional `equipmentTiers`/`upgrades` (defaulting to today's behavior when omitted, so every existing `BUILDS` entry is unaffected):

```js
function makeBuild({ name, level, equipment, equipmentTiers = {}, upgrades = {}, potions }) {
  const player = playerAtLevel(level);
  const fullEquipment = { weapon: null, head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null, ...equipment };
  const bonuses = getEquipmentBonuses({ player, equipment: fullEquipment, equipmentTiers, upgrades });
  return {
    name,
    level,
    potions,
    goldSpent: gearCost(fullEquipment),
    maxHp: player.maxHp + bonuses.maxHp,
    attack: player.attack + bonuses.attack,
    defense: player.defense + bonuses.defense,
    speed: player.speed + bonuses.speed,
  };
}

// Every slot at Mythic tier, upgrade level 3 (the actual ceiling this
// feature is meant to raise) - used by the maxed-Mythic NG+2 build below.
function maxedUpgrades(equipment, equipmentTiers) {
  const upgrades = {};
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;
    upgrades[upgradeKey(itemId, equipmentTiers[slot])] = MAX_UPGRADE_LEVEL;
  }
  return upgrades;
}
```

Add the new build to the `BUILDS` array, after the existing `'veteran L11 (full iron)'` entry:

```js
  // NG+ gear-ceiling baseline, added for the Mythic tier feature - every
  // slot maxed (Mythic tier, upgrade level 3), run against NG+2-scaled
  // monsters below. Compare its win rate against 'veteran L11 (full iron)'
  // vs. the same monsters at NG+0 to see how much of today's Superior-tier
  // ceiling this build actually recovers.
  (() => {
    const equipment = { weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor', legs: 'ironGreaves', accessory: 'powerRing' };
    const equipmentTiers = { weapon: 'mythic', head: 'mythic', body: 'mythic', legs: 'mythic', accessory: 'mythic' };
    return makeBuild({
      name: 'maxed Mythic L12 (NG+2)',
      level: 12,
      equipment,
      equipmentTiers,
      upgrades: maxedUpgrades(equipment, equipmentTiers),
      potions: 6,
    });
  })(),
```

In `main()`, add NG+2-scaled monster entries right after the existing `monsters`/`dragonBase`/boss-tier setup:

```js
  const NG_PLUS_MATCHUP_IDS = MATCHUPS.map((id) => `${id}NgPlus2`);
  for (const id of MATCHUPS) {
    monsters[`${id}NgPlus2`] = {
      ...MONSTERS[id],
      ...getNgPlusCombatOverrides(MONSTERS[id], 2),
      name: `${MONSTERS[id].name} (NG+2)`,
      ...(overrides[`${id}NgPlus2`] || {}),
    };
  }
```

Then extend both places that currently iterate `[...MATCHUPS, ...BOSS_TIER_MATCHUP_IDS]` (the "Monster stats under test" print loop and the main report loop) to `[...MATCHUPS, ...BOSS_TIER_MATCHUP_IDS, ...NG_PLUS_MATCHUP_IDS]`.

- [ ] **Step 2: Run it and record the result**

Run: `node scripts/simulate-balance.js` (per this file's own header comment, this is the documented invocation — it's deliberately not wired into `npm run test`, since it's a stochastic report with no pass/fail assertions).

In the printed matrix, compare `'maxed Mythic L12 (NG+2)'`'s win rate against each `<Monster> (NG+2)` row to `'veteran L11 (full iron)'`'s win rate against the same monsters' NG+0 rows (already in the existing matrix). If the Mythic-NG+2 numbers are still lopsided in the monsters' favor relative to that NG+0 baseline, that's a signal the `1.35` mythic multiplier from Task 1 needs raising — treat this as a real data point, not just a checkbox: if the numbers say the constant is wrong, go back and change `QUALITY_TIER_MULTIPLIERS.mythic` in `js/systems/itemQuality.js` (Task 1) before continuing, and re-run.

- [ ] **Step 3: CHANGELOG.md**

Add an entry under `## [Unreleased]` (`### Added`, matching this repo's existing Keep-a-Changelog style):

```markdown
### Added
- Mythic gear tier (NG+ only): a fourth quality tier above Superior, obtainable via drop luck or a gold + Mythic Essence smith reforge.
- Two new NG+-exclusive unique items: Retribution Charm (reflects damage) and Windfury Ring.
- Two new ring equipment slots (Ring 1 / Ring 2), alongside the existing weapon/head/body/legs/accessory slots. Ring-slot items (Ember Ring, Windfury Ring) only drop from sufficiently tough monsters.
```

- [ ] **Step 4: `js/data/playerChangelog.js`**

Add a matching entry as `PLAYER_CHANGELOG`'s new first element (newest-first, per this repo's convention) with the same version number the `CHANGELOG.md` bump uses, in player-facing language (no internal file/function names):

```js
{
  version: '<the version number chosen when bumping Unreleased — pick per this repo's CLAUDE.md MINOR-vs-PATCH rule>',
  date: '<today's date>',
  changes: [
    'New Game+ players can now find and forge Mythic-tier gear, one step beyond Superior.',
    'Two new ring slots — go find some rings to fill them.',
    'Two new rare items only found in New Game+: the Retribution Charm and the Windfury Ring.',
  ],
},
```

- [ ] **Step 5: Run the full suite one more time**

Run: `npm run test`
Expected: PASS (includes `tests/versionSync.test.js`, which fails if `CHANGELOG.md`'s newest version and `PLAYER_CHANGELOG[0].version` don't match).

- [ ] **Step 6: Commit**

```bash
git add scripts/simulate-balance.js CHANGELOG.md js/data/playerChangelog.js
git commit -m "test: add maxed-Mythic NG+2 balance baseline; docs: changelog entries for NG+ gear progression"
```

Do not push — per this repo's CLAUDE.md, a push to `master` is the release, and that's explicitly Timothy's call.
