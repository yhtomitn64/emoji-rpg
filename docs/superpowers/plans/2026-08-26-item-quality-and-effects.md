# Item Quality Tiers & Unique Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give regular monster kills a real, weighted chance to drop tiered (Plain/Fine/Superior) or wholly unique effect gear, so tougher monsters are worth fighting for loot, not just XP.

**Architecture:** A new pure-function module (`js/systems/itemQuality.js`) computes a monster's relative "toughness" from its `xp` and rolls quality tiers/unique-effect chance from it. `js/systems/loot.js`'s `rollDrop` is extended to use these rolls for a new generic equipment-drop chance (and for tiering the one existing named drop, `goblinClub`). `js/systems/inventory.js`'s data model grows an optional `tier` field on inventory entries and a new `state.equipmentTiers` map, threaded through every function that reads/writes gear. Three hand-authored Unique-effect items get three small, discrete combat hooks in `js/screens/battleScreen.js` (lifesteal, extra-swing chance, elemental proc).

**Tech Stack:** Vanilla JS (ES modules), Node's built-in test runner (`node --test`, run via `npm run test`). No DOM/jsdom testing setup exists in this repo (deliberate, standing project decision — see `docs/superpowers/BACKLOG.md`'s "Testing infra: jsdom" entry) — any change to `js/screens/battleScreen.js` is verified live in a browser, never via an automated DOM test.

**Spec:** `docs/superpowers/specs/2026-08-26-item-quality-and-effects-design.md`

## Global Constraints

- Quality tier multipliers: Fine = 1.10, Superior = 1.20 (applied to base stats before the existing +25%/level smith-upgrade scaling).
- `rollQualityTier` (Plain/Fine/Superior only) chances scale by monster toughness (0–1): Superior 2%→10%, Fine 10%→25%. Never exactly 0% at either end.
- `rollUniqueEffectChance` (its own independent check, not nested in the quality roll) scales 1%→5% by toughness.
- The generic ordinary-equipment-drop gate is a flat 10% (`EQUIPMENT_DROP_CHANCE`), independent of toughness — toughness already drives quality within that roll.
- The Unique-effect check runs *before*, and independently of, the ordinary-gear gate — only tried if the dropTable produced nothing this kill, and only the ordinary-gear gate runs if the Unique-effect check missed.
- Boss (`isBoss`), elite (`isElite`), and tool-dungeon-guardian (`forceFullBattle`) monsters are fully excluded from every roll in this feature — they keep their existing, separate drop mechanisms untouched — and excluded from the toughness min/max computation.
- A kill still yields at most one bonus item, same as today — the new generic roll only runs when the monster's own `dropTable` roll produced nothing.
- Shop-purchased items are always Plain tier; nothing bought from the shop ever carries a `tier`.
- `state.upgrades` stays keyed by itemId alone (unchanged) — upgrade progress is shared across all tiers of the same base item, by design.
- Extra-swing chance never re-rolls on its own bonus swing (capped at exactly one bonus swing per original Attack, by construction) and is fully exempt from the existing attack-spam-decay system (`attackStreakMultiplier`/`attackCooldownMsForStreak` in `js/systems/combat.js`) — it neither increments nor is subject to that streak.

---

### Task 1: `js/systems/itemQuality.js` — toughness and quality-roll functions

**Files:**
- Create: `js/systems/itemQuality.js`
- Test: `tests/itemQuality.test.js`

**Interfaces:**
- Consumes: `MONSTERS` from `js/data/monsters.js` (existing).
- Produces: `isToughnessEligible(monster) -> boolean`, `monsterToughness(monster) -> number` (0–1), `QUALITY_TIER_MULTIPLIERS -> { fine: 1.10, superior: 1.20 }`, `rollQualityTier(toughness, rng = Math.random) -> 'plain' | 'fine' | 'superior'`, `rollUniqueEffectChance(toughness, rng = Math.random) -> boolean`, `tierLabel(tier) -> string` (`''` | `'Fine '` | `'Superior '`). These exact names/signatures are used by Tasks 3, 4, 5, 6, 8.

- [ ] **Step 1: Write the failing tests**

Create `tests/itemQuality.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../js/data/monsters.js';
import {
  isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance,
  QUALITY_TIER_MULTIPLIERS, tierLabel,
} from '../js/systems/itemQuality.js';

test('isToughnessEligible excludes boss, elite, and forceFullBattle monsters', () => {
  assert.equal(isToughnessEligible(MONSTERS.boar), true);
  assert.equal(isToughnessEligible(MONSTERS.dragon), false); // isBoss
  assert.equal(isToughnessEligible(MONSTERS.jurassicJerky), false); // isElite
  assert.equal(isToughnessEligible(MONSTERS.axeGuardian), false); // forceFullBattle
});

test('monsterToughness returns 0 for the lowest-xp eligible monster and 1 for the highest', () => {
  // Today's roster: bat (xp 11) is the lowest eligible, wraith (xp 63) the
  // highest - boss/elite/guardian monsters (dragon 200, jurassicJerky 160,
  // the three xp-45/55 guardians) are excluded from this min/max entirely.
  assert.equal(monsterToughness(MONSTERS.bat), 0);
  assert.equal(monsterToughness(MONSTERS.wraith), 1);
});

test('monsterToughness spreads a mid-roster monster proportionally between the eligible min and max', () => {
  // direWolf: xp 32. (32 - 11) / (63 - 11) = 21/52 = 0.4038...
  assert.ok(Math.abs(monsterToughness(MONSTERS.direWolf) - 21 / 52) < 1e-9);
});

test('monsterToughness clamps an ineligible monster (if ever called on one) into the 0-1 range', () => {
  // Not called in practice (loot.js gates on isToughnessEligible first), but
  // the function itself should never produce a value outside 0-1 even for a
  // monster whose xp sits outside the eligible roster's range.
  assert.equal(monsterToughness(MONSTERS.dragon), 1); // xp 200, clamped to the max
});

test('rollQualityTier only ever returns plain, fine, or superior', () => {
  for (const toughness of [0, 0.25, 0.5, 0.75, 1]) {
    for (const rngValue of [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.9, 0.999]) {
      const result = rollQualityTier(toughness, () => rngValue);
      assert.ok(['plain', 'fine', 'superior'].includes(result));
    }
  }
});

test('rollQualityTier boundaries at toughness 0 match the documented 2%/10% floor', () => {
  assert.equal(rollQualityTier(0, () => 0.01), 'superior'); // < 0.02
  assert.equal(rollQualityTier(0, () => 0.05), 'fine'); // 0.02 <= x < 0.12
  assert.equal(rollQualityTier(0, () => 0.5), 'plain'); // >= 0.12
});

test('rollQualityTier boundaries at toughness 1 match the documented 10%/25% ceiling', () => {
  assert.equal(rollQualityTier(1, () => 0.05), 'superior'); // < 0.10
  assert.equal(rollQualityTier(1, () => 0.20), 'fine'); // 0.10 <= x < 0.35
  assert.equal(rollQualityTier(1, () => 0.5), 'plain'); // >= 0.35
});

test('rollUniqueEffectChance hits at the documented 1% floor and 5% ceiling', () => {
  assert.equal(rollUniqueEffectChance(0, () => 0.005), true);
  assert.equal(rollUniqueEffectChance(0, () => 0.02), false);
  assert.equal(rollUniqueEffectChance(1, () => 0.04), true);
  assert.equal(rollUniqueEffectChance(1, () => 0.06), false);
});

test('QUALITY_TIER_MULTIPLIERS matches the documented Fine/Superior bonuses', () => {
  assert.equal(QUALITY_TIER_MULTIPLIERS.fine, 1.10);
  assert.equal(QUALITY_TIER_MULTIPLIERS.superior, 1.20);
});

test('tierLabel prefixes a display name correctly for each tier, and not at all for Plain', () => {
  assert.equal(tierLabel(undefined), '');
  assert.equal(tierLabel('fine'), 'Fine ');
  assert.equal(tierLabel('superior'), 'Superior ');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `tests/itemQuality.test.js` errors because `js/systems/itemQuality.js` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/systems/itemQuality.js`:

```js
import { MONSTERS } from '../data/monsters.js';

export function isToughnessEligible(monster) {
  return !monster.isBoss && !monster.isElite && !monster.forceFullBattle;
}

const ELIGIBLE_MONSTERS = Object.values(MONSTERS).filter(isToughnessEligible);
const XP_MIN = Math.min(...ELIGIBLE_MONSTERS.map((m) => m.xp));
const XP_MAX = Math.max(...ELIGIBLE_MONSTERS.map((m) => m.xp));

export function monsterToughness(monster) {
  if (XP_MAX === XP_MIN) return 0; // guards a future roster of exactly one eligible monster
  const clamped = Math.min(Math.max(monster.xp, XP_MIN), XP_MAX);
  return (clamped - XP_MIN) / (XP_MAX - XP_MIN);
}

function lerp(min, max, t) { return min + (max - min) * t; }

export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20 };

// Returns 'plain' | 'fine' | 'superior'. Deciding whether something is a
// Unique-effect item at all happens earlier, via rollUniqueEffectChance -
// this function is scoped to just the three ordinary tiers so its odds are
// the same whether it's called for the new generic drop roll or for an
// existing named drop like goblinClub (see js/systems/loot.js).
export function rollQualityTier(toughness, rng = Math.random) {
  const superiorChance = lerp(0.02, 0.10, toughness);
  const fineChance = lerp(0.10, 0.25, toughness);
  const roll = rng();
  if (roll < superiorChance) return 'superior';
  if (roll < superiorChance + fineChance) return 'fine';
  return 'plain';
}

// 1% at the weakest eligible monster, 5% at the toughest - its own
// independent check, not a bucket inside rollQualityTier.
export function rollUniqueEffectChance(toughness, rng = Math.random) {
  return rng() < lerp(0.01, 0.05, toughness);
}

export function tierLabel(tier) {
  if (tier === 'fine') return 'Fine ';
  if (tier === 'superior') return 'Superior ';
  return '';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS (all `tests/itemQuality.test.js` tests green; full suite still at its previous count + these new tests, 0 failures).

- [ ] **Step 5: Commit**

```bash
git add js/systems/itemQuality.js tests/itemQuality.test.js
git commit -m "feat: add itemQuality module for monster-toughness-weighted drop tiers"
```

---

### Task 2: `js/data/items.js` — the three v1 Unique-effect items

**Files:**
- Modify: `js/data/items.js`
- Modify: `tests/data.test.js`

**Interfaces:**
- Produces: three new `ITEMS` entries — `vampiricFang` (`slot: 'weapon'`, `stats: { attack: 7, lifestealPercent: 15 }`), `swiftStrikeCharm` (`slot: 'accessory'`, `stats: { extraSwingChance: 10 }`), `emberRing` (`slot: 'accessory'`, `stats: { elementalProcChance: 20, elementalProcDamage: 6 }`). All `price: 0`, none added to `SHOP_CATALOG`. Task 3 references these three IDs by name in `UNIQUE_EFFECT_ITEM_IDS`; Task 9 reads their `lifestealPercent`/`extraSwingChance`/`elementalProcChance`/`elementalProcDamage` stats.

- [ ] **Step 1: Write the failing test**

Add to `tests/data.test.js` (after the existing `'the rare elite (jurassicJerky)...'` test, same file):

```js
test('the three v1 Unique-effect items have the documented slots, prices, and effect stats', () => {
  const vampiricFang = ITEMS.vampiricFang;
  assert.equal(vampiricFang.name, 'Vampiric Fang');
  assert.equal(vampiricFang.slot, 'weapon');
  assert.equal(vampiricFang.price, 0);
  assert.equal(vampiricFang.stats.attack, 7);
  assert.equal(vampiricFang.stats.lifestealPercent, 15);

  const swiftStrikeCharm = ITEMS.swiftStrikeCharm;
  assert.equal(swiftStrikeCharm.name, 'Swift Strike Charm');
  assert.equal(swiftStrikeCharm.slot, 'accessory');
  assert.equal(swiftStrikeCharm.price, 0);
  assert.equal(swiftStrikeCharm.stats.extraSwingChance, 10);

  const emberRing = ITEMS.emberRing;
  assert.equal(emberRing.name, 'Ember Ring');
  assert.equal(emberRing.slot, 'accessory');
  assert.equal(emberRing.price, 0);
  assert.equal(emberRing.stats.elementalProcChance, 20);
  assert.equal(emberRing.stats.elementalProcDamage, 6);

  for (const id of ['vampiricFang', 'swiftStrikeCharm', 'emberRing']) {
    assert.ok(!SHOP_CATALOG.includes(id), `${id} must not be shop-purchasable`);
  }
});
```

This test file already imports `ITEMS` from `js/data/items.js`; add `SHOP_CATALOG` to that same import line (`import { ITEMS } from '../js/data/items.js';` becomes `import { ITEMS, SHOP_CATALOG } from '../js/data/items.js';`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `ITEMS.vampiricFang` is `undefined`.

- [ ] **Step 3: Write the implementation**

In `js/data/items.js`, add a new section after `// Accessory` and before `// Consumables`:

```js
  // Unique-effect drops (found only, never sold - see js/systems/loot.js's
  // UNIQUE_EFFECT_ITEM_IDS)
  vampiricFang: { id: 'vampiricFang', name: 'Vampiric Fang', emoji: '🦴', slot: 'weapon', price: 0,
    stats: { attack: 7, lifestealPercent: 15 } },
  swiftStrikeCharm: { id: 'swiftStrikeCharm', name: 'Swift Strike Charm', emoji: '🔮', slot: 'accessory', price: 0,
    stats: { extraSwingChance: 10 } },
  emberRing: { id: 'emberRing', name: 'Ember Ring', emoji: '🔥', slot: 'accessory', price: 0,
    stats: { elementalProcChance: 20, elementalProcDamage: 6 } },

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS, including the pre-existing `'every item has required fields'` test (the three new entries already satisfy `id`/`name`/`emoji`).

- [ ] **Step 5: Commit**

```bash
git add js/data/items.js tests/data.test.js
git commit -m "feat: add the three v1 Unique-effect items (Vampiric Fang, Swift Strike Charm, Ember Ring)"
```

---

### Task 3: `js/systems/loot.js` — the two-stage drop roll

**Files:**
- Modify: `js/systems/loot.js`
- Modify: `tests/loot.test.js`

**Interfaces:**
- Consumes: `isToughnessEligible`, `monsterToughness`, `rollQualityTier`, `rollUniqueEffectChance` from `js/systems/itemQuality.js` (Task 1); `vampiricFang`/`swiftStrikeCharm`/`emberRing` existing in `ITEMS` (Task 2).
- Produces: `rollDrop(monster, rng = Math.random)` now returns `{ gold, item, tier }` (`tier` is `undefined` for a Plain item, a Unique item, or no item at all) instead of `{ gold, item }`. New exports `EQUIPMENT_DROP_CHANCE` (0.10), `EQUIPMENT_DROP_POOL` (array of itemIds), `UNIQUE_EFFECT_ITEM_IDS` (`['vampiricFang', 'swiftStrikeCharm', 'emberRing']`). Tasks 5 (`main.js`) consume the new `tier` field on `rollDrop`'s return value.

- [ ] **Step 1: Update the existing test fixture and write the failing tests**

The current shared `monster` fixture in `tests/loot.test.js` has no `xp` field. Once `rollDrop` calls `monsterToughness(monster)` (which reads `monster.xp`), a missing `xp` would silently produce `NaN` throughout the new roll math — every comparison against `NaN` is `false`, so the existing tests would keep passing today only by accident (their chosen rng values already happen to miss the new rolls even under `NaN`), not because the fixture is actually correct. Fix the fixture explicitly rather than leave that accidental pass in place:

Replace the top of `tests/loot.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDrop, getItemSources } from '../js/systems/loot.js';

const monster = {
  goldRange: [2, 5],
  dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }],
};
```

with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDrop, getItemSources, EQUIPMENT_DROP_CHANCE, EQUIPMENT_DROP_POOL, UNIQUE_EFFECT_ITEM_IDS } from '../js/systems/loot.js';

// A sequence-mock rng: returns each value in order, then repeats the last
// value for any further calls. Needed because rollDrop calls rng() multiple
// times per invocation (gold, dropTable roll, quality/unique rolls, pool
// pick) and different tests need to control several of those calls at once.
function sequence(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const monster = {
  goldRange: [2, 5],
  xp: 16, // boar-level - a real, eligible xp value so toughness math is meaningful, not NaN
  dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }],
};
```

Then add these new tests at the end of the file:

```js
test('rollDrop applies a quality tier to an existing named equipment drop (e.g. goblinClub-shaped entries)', () => {
  const goblinLike = { goldRange: [5, 13], xp: 22, dropTable: [{ itemId: 'goblinClub', chance: 1 }] };
  // sequence: [gold, dropTable roll (hits goblinClub), quality roll -> superior at this toughness]
  const drop = rollDrop(goblinLike, sequence(0, 0, 0.01));
  assert.equal(drop.item, 'goblinClub');
  assert.equal(drop.tier, 'superior');
});

test('rollDrop never applies a tier to a material/potion/tool drop', () => {
  // sequence: [gold, dropTable roll (hits leatherScrap, a material)]
  const drop = rollDrop(monster, sequence(0, 0.1));
  assert.equal(drop.item, 'leatherScrap');
  assert.equal(drop.tier, undefined);
});

test('rollDrop can produce a Unique-effect item when the dropTable misses and the Unique-effect check hits', () => {
  const toughMonster = { goldRange: [18, 30], xp: 63, dropTable: [] }; // wraith-level, toughness 1 -> unique ceiling 5%
  // sequence: [gold, unique-effect check (0.04 < 0.05 -> hits), pool pick]
  const drop = rollDrop(toughMonster, sequence(0, 0.04, 0));
  assert.ok(UNIQUE_EFFECT_ITEM_IDS.includes(drop.item));
  assert.equal(drop.tier, undefined);
});

test('rollDrop falls through to the ordinary-gear check only when the Unique-effect check misses', () => {
  const toughMonster = { goldRange: [18, 30], xp: 63, dropTable: [] };
  // sequence: [gold, unique-effect check (0.5, well above the 5% ceiling -> misses),
  //            ordinary-gear gate (0.05 < 0.10 -> hits), pool pick, quality roll (0.05 -> superior at toughness 1)]
  const drop = rollDrop(toughMonster, sequence(0, 0.5, 0.05, 0, 0.05));
  assert.ok(EQUIPMENT_DROP_POOL.includes(drop.item));
  assert.equal(drop.tier, 'superior');
});

test('rollDrop grants no bonus item when both the Unique-effect check and the ordinary-gear gate miss', () => {
  const toughMonster = { goldRange: [18, 30], xp: 63, dropTable: [] };
  // sequence: [gold, unique-effect check (misses), ordinary-gear gate (0.9, above the flat 10% -> misses)]
  const drop = rollDrop(toughMonster, sequence(0, 0.5, 0.9));
  assert.equal(drop.item, null);
  assert.equal(drop.tier, undefined);
});

test('rollDrop never rolls the generic equipment path when the dropTable already produced an item', () => {
  const goblinLike = { goldRange: [5, 13], xp: 22, dropTable: [{ itemId: 'goblinClub', chance: 1 }] };
  // Even with a very low rng that would trivially hit every later check,
  // only the dropTable item (goblinClub) and its own quality roll should
  // ever be consulted - the item must never be overwritten by a pool pick.
  const drop = rollDrop(goblinLike, sequence(0, 0, 0.001, 0.001, 0.001));
  assert.equal(drop.item, 'goblinClub');
});

test('boss, elite, and forceFullBattle monsters never get the Unique-effect or ordinary-gear roll, regardless of rng', () => {
  const bossLike = { goldRange: [65, 100], xp: 200, isBoss: true, dropTable: [] };
  const eliteLike = { goldRange: [55, 90], xp: 160, isElite: true, dropTable: [] };
  const guardianLike = { goldRange: [15, 25], xp: 45, forceFullBattle: true, dropTable: [] };
  for (const m of [bossLike, eliteLike, guardianLike]) {
    // A trivially-low rng would hit every check if isToughnessEligible didn't gate them out first.
    const drop = rollDrop(m, () => 0);
    assert.equal(drop.item, null);
    assert.equal(drop.tier, undefined);
  }
});

test('EQUIPMENT_DROP_POOL contains only equipment-slot items from the shop catalog', () => {
  assert.ok(EQUIPMENT_DROP_POOL.length > 0);
  for (const id of EQUIPMENT_DROP_POOL) {
    assert.ok(ITEMS[id].slot, `${id} must have a slot`);
  }
  assert.ok(!EQUIPMENT_DROP_POOL.includes('potion'));
});
```

Add `import { ITEMS } from '../js/data/items.js';` to the top of `tests/loot.test.js` (needed by the new `EQUIPMENT_DROP_POOL` test) if it isn't already imported there.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `rollDrop` doesn't yet return a `tier` field, and `EQUIPMENT_DROP_CHANCE`/`EQUIPMENT_DROP_POOL`/`UNIQUE_EFFECT_ITEM_IDS` aren't exported yet.

- [ ] **Step 3: Write the implementation**

Replace the whole of `js/systems/loot.js` with:

```js
import { MONSTERS } from '../data/monsters.js';
import { ITEMS, SHOP_CATALOG } from '../data/items.js';
import { MINI_DUNGEON_TREASURE_ITEM_POOL } from './miniDungeons.js';
import { isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance } from './itemQuality.js';

export const EQUIPMENT_DROP_CHANCE = 0.10; // flat - toughness already drives
  // *quality* within this roll; scaling the gate too would double-compound
  // the reward for fighting tougher monsters.
export const EQUIPMENT_DROP_POOL = SHOP_CATALOG.filter((id) => ITEMS[id].slot);
export const UNIQUE_EFFECT_ITEM_IDS = ['vampiricFang', 'swiftStrikeCharm', 'emberRing'];

function pickRandom(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
}

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
  return sources;
}

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

  let tier;
  // Boss/elite/forceFullBattle monsters keep their own separate, already-
  // guaranteed-exciting drop mechanisms untouched - excluded from every
  // roll below, not just the generic one, so an existing named drop like
  // the dragon's dragonFang never picks up a stray tier roll either.
  if (isToughnessEligible(monster)) {
    const toughness = monsterToughness(monster);
    if (item && ITEMS[item].slot) {
      // An existing named equipment drop (e.g. goblinClub) can still be a
      // better-than-plain copy of itself, but never redirects into an
      // unrelated Unique-effect item - the named drop IS that item.
      const quality = rollQualityTier(toughness, rng);
      if (quality !== 'plain') tier = quality;
    } else if (!item) {
      if (rollUniqueEffectChance(toughness, rng)) {
        item = pickRandom(UNIQUE_EFFECT_ITEM_IDS, rng);
      } else if (rng() < EQUIPMENT_DROP_CHANCE) {
        item = pickRandom(EQUIPMENT_DROP_POOL, rng);
        const quality = rollQualityTier(toughness, rng);
        if (quality !== 'plain') tier = quality;
      }
    }
  }

  return { gold, item, tier };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS, full suite green.

- [ ] **Step 5: Commit**

```bash
git add js/systems/loot.js tests/loot.test.js
git commit -m "feat: roll a quality tier or Unique-effect item on monster kills"
```

---

### Task 4: `js/state.js` + `js/systems/inventory.js` — tier-aware data model

**Files:**
- Modify: `js/state.js`
- Modify: `js/systems/inventory.js`
- Modify: `tests/inventory.test.js`

**Interfaces:**
- Consumes: `QUALITY_TIER_MULTIPLIERS` from `js/systems/itemQuality.js` (Task 1).
- Produces: `createNewGame()` now includes `equipmentTiers: {}`. `addItem(state, itemId, quantity = 1, tier)`, `removeItem(state, itemId, quantity = 1, tier)`, `equipItem(state, itemId, slot, tier)`, `unequipItem(state, slot)` (reads the tier being unequipped from `state.equipmentTiers`), `getItemEffectiveStats(itemId, upgradeLevel = 0, tier)`, `getEquipmentBonuses(state)` (unchanged signature, now reads `state.equipmentTiers`), `getItemStatDelta(state, itemId, tier)`. All now return/expect objects with 9 stat keys (`attack`, `defense`, `maxHp`, `speed`, `enemySlowPercent`, `lifestealPercent`, `extraSwingChance`, `elementalProcChance`, `elementalProcDamage`) instead of 5. Tasks 5, 6, 7, 8, 9 all consume these exact signatures.

- [ ] **Step 1: Write the failing tests**

In `tests/inventory.test.js`, first fix the test that will break from the new stat keys — replace:

```js
test('getItemEffectiveStats returns unrounded base stats at upgrade level 0', () => {
  const stats = getItemEffectiveStats('starterSword', 0);
  assert.deepEqual(stats, { attack: 3, defense: 0, maxHp: 0, speed: 0, enemySlowPercent: 0 });
});
```

with:

```js
test('getItemEffectiveStats returns unrounded base stats at upgrade level 0', () => {
  const stats = getItemEffectiveStats('starterSword', 0);
  assert.deepEqual(stats, {
    attack: 3, defense: 0, maxHp: 0, speed: 0, enemySlowPercent: 0,
    lifestealPercent: 0, extraSwingChance: 0, elementalProcChance: 0, elementalProcDamage: 0,
  });
});
```

Then add these new tests at the end of the file:

```js
test('addItem keeps a Plain and a Fine copy of the same base item as two separate stacks', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1); // Plain
  state = addItem(state, 'ironSword', 1, 'fine');
  const plainEntry = state.inventory.find((e) => e.itemId === 'ironSword' && e.tier === undefined);
  const fineEntry = state.inventory.find((e) => e.itemId === 'ironSword' && e.tier === 'fine');
  assert.equal(plainEntry.quantity, 1);
  assert.equal(fineEntry.quantity, 1);
});

test('addItem stacks two drops of the same tier together', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1, 'superior');
  state = addItem(state, 'ironSword', 1, 'superior');
  const entries = state.inventory.filter((e) => e.itemId === 'ironSword');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].quantity, 2);
});

test('removeItem only removes from the matching tier stack', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1);
  state = addItem(state, 'ironSword', 1, 'fine');
  state = removeItem(state, 'ironSword', 1, 'fine');
  const plainEntry = state.inventory.find((e) => e.itemId === 'ironSword' && e.tier === undefined);
  const fineEntry = state.inventory.find((e) => e.itemId === 'ironSword' && e.tier === 'fine');
  assert.equal(plainEntry.quantity, 1);
  assert.equal(fineEntry, undefined);
});

test('getItemEffectiveStats applies the tier multiplier before the upgrade-level scaling', () => {
  // ironSword base attack 6. Superior (1.20): 6 * 1.20 = 7.2. At upgrade
  // level 1: 7.2 + 7.2 * 0.25 = 9.
  const stats = getItemEffectiveStats('ironSword', 1, 'superior');
  assert.equal(stats.attack, 9);
});

test('getItemEffectiveStats treats an undefined tier as Plain (multiplier 1)', () => {
  const stats = getItemEffectiveStats('ironSword', 0, undefined);
  assert.equal(stats.attack, 6);
});

test('an effect stat (not just attack/defense) scales with smith-upgrade level via the same +25%/level formula, for free', () => {
  // vampiricFang: lifestealPercent 15. At upgrade level 2: 15 + 15*0.25*2 = 22.5.
  const stats = getItemEffectiveStats('vampiricFang', 2, undefined);
  assert.equal(stats.lifestealPercent, 22.5);
});

test('equipItem and unequipItem carry the tier through state.equipmentTiers', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1, 'fine');
  state = equipItem(state, 'ironSword', 'weapon', 'fine');
  assert.equal(state.equipment.weapon, 'ironSword');
  assert.equal(state.equipmentTiers.weapon, 'fine');

  state = unequipItem(state, 'weapon');
  const entry = state.inventory.find((e) => e.itemId === 'ironSword' && e.tier === 'fine');
  assert.equal(entry.quantity, 1);
});

test('equipItem restores the previously-equipped item at its own tier when swapping', () => {
  let state = createNewGame(); // starterSword equipped, Plain (no tier)
  state = addItem(state, 'ironSword', 1, 'superior');
  state = equipItem(state, 'ironSword', 'weapon', 'superior');
  const restoredStarter = state.inventory.find((e) => e.itemId === 'starterSword' && e.tier === undefined);
  assert.equal(restoredStarter.quantity, 1);
});

test('getEquipmentBonuses reads the equipped item at its stored tier, not Plain', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1, 'superior');
  state = equipItem(state, 'ironSword', 'weapon', 'superior');
  const bonuses = getEquipmentBonuses(state);
  // starterSword (Plain, unequipped now) is gone from equipment; ironSword
  // Superior at upgrade 0: 6 * 1.20 = 7.2, rounded once at the end -> 7.
  assert.equal(bonuses.attack, 7);
});

test('getEquipmentBonuses includes the new effect stat keys, summed like any other stat', () => {
  let state = createNewGame();
  state = addItem(state, 'swiftStrikeCharm', 1);
  state = equipItem(state, 'swiftStrikeCharm', 'accessory', undefined);
  const bonuses = getEquipmentBonuses(state);
  assert.equal(bonuses.extraSwingChance, 10);
  assert.equal(bonuses.lifestealPercent, 0);
});

test('getItemStatDelta compares a tiered candidate against the currently-equipped tier', () => {
  let state = createNewGame(); // starterSword equipped, Plain, attack 3
  const delta = getItemStatDelta(state, 'ironSword', 'superior'); // 6 * 1.20 = 7.2
  assert.equal(delta.attack, 4); // round(7.2 - 3) = 4
});

test('getItemStatDelta reports 0 for a new effect stat when neither item has it', () => {
  const state = createNewGame();
  const delta = getItemStatDelta(state, 'ironHelm');
  assert.equal(delta.lifestealPercent, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `addItem`/`removeItem`/`equipItem` don't accept a `tier` argument yet, `getItemEffectiveStats` doesn't accept a `tier` argument, `state.equipmentTiers` doesn't exist.

- [ ] **Step 3: Write the implementation**

In `js/state.js`, in `createNewGame`, add `equipmentTiers: {},` immediately after the existing `upgrades: {},` line.

Replace the whole of `js/systems/inventory.js` with:

```js
import { ITEMS } from '../data/items.js';
import { QUALITY_TIER_MULTIPLIERS } from './itemQuality.js';

export const UPGRADE_BASE_COST = 20;
export const MAX_UPGRADE_LEVEL = 3;

const STAT_KEYS = [
  'attack', 'defense', 'maxHp', 'speed', 'enemySlowPercent',
  'lifestealPercent', 'extraSwingChance', 'elementalProcChance', 'elementalProcDamage',
];

function zeroStats() {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
}

export function addGold(state, amount) {
  return { ...state, player: { ...state.player, gold: state.player.gold + amount } };
}

export function spendGold(state, amount) {
  if (state.player.gold < amount) throw new Error('Not enough gold');
  return { ...state, player: { ...state.player, gold: state.player.gold - amount } };
}

export function addItem(state, itemId, quantity = 1, tier) {
  const inventory = state.inventory.map((entry) => ({ ...entry }));
  const existing = inventory.find((entry) => entry.itemId === itemId && entry.tier === tier);
  if (existing) {
    existing.quantity += quantity;
  } else {
    inventory.push({ itemId, quantity, tier });
  }
  return { ...state, inventory };
}

export function removeItem(state, itemId, quantity = 1, tier) {
  const inventory = state.inventory
    .map((entry) => (entry.itemId === itemId && entry.tier === tier ? { ...entry, quantity: entry.quantity - quantity } : entry))
    .filter((entry) => entry.quantity > 0);
  return { ...state, inventory };
}

export function equipItem(state, itemId, slot, tier) {
  const inventoryEntry = state.inventory.find((entry) => entry.itemId === itemId && entry.tier === tier && entry.quantity > 0);
  if (!inventoryEntry) throw new Error(`Item ${itemId} not in inventory`);

  const previouslyEquipped = state.equipment[slot];
  const previousTier = state.equipmentTiers?.[slot];
  let next = removeItem(state, itemId, 1, tier);
  next = {
    ...next,
    equipment: { ...next.equipment, [slot]: itemId },
    equipmentTiers: { ...next.equipmentTiers, [slot]: tier },
  };
  if (previouslyEquipped) {
    next = addItem(next, previouslyEquipped, 1, previousTier);
  }
  return next;
}

export function unequipItem(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);
  const tier = state.equipmentTiers?.[slot];
  let next = {
    ...state,
    equipment: { ...state.equipment, [slot]: null },
    equipmentTiers: { ...state.equipmentTiers, [slot]: undefined },
  };
  next = addItem(next, itemId, 1, tier);
  return next;
}

export function applyHeal(hp, maxHp, amount) {
  return Math.min(maxHp, hp + amount);
}

export function sellPrice(price) {
  return Math.floor(price / 2);
}

export function maxAffordableQuantity(gold, price, requested) {
  if (price <= 0) return requested;
  return Math.min(requested, Math.floor(gold / price));
}

export function describeItem(itemId) {
  const item = ITEMS[itemId];
  if (item.description) return `${item.name}: ${item.description}`;
  if (item.stats) {
    const statsText = Object.entries(item.stats).map(([stat, value]) => `${stat} +${value}`).join(', ');
    if (statsText) return `${item.name}: ${statsText}`;
  }
  if (item.heal) return `${item.name}: heals ${item.heal} HP`;
  if (item.upgradeSlot) return `${item.name}: upgrade material for ${item.upgradeSlot} gear`;
  return item.name;
}

export function upgradeCost(currentLevel) {
  return UPGRADE_BASE_COST * (currentLevel + 1);
}

export function upgradeItem(state, slot, materialId, cost) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);

  if ((state.upgrades?.[itemId] || 0) >= MAX_UPGRADE_LEVEL) throw new Error(`${itemId} is already at max upgrade level`);

  if (ITEMS[materialId].upgradeSlot !== slot) throw new Error(`${materialId} cannot upgrade the ${slot} slot`);

  const hasMaterial = state.inventory.some((entry) => entry.itemId === materialId && entry.quantity > 0);
  if (!hasMaterial) throw new Error('Missing required material');
  if (state.player.gold < cost) throw new Error('Not enough gold');

  let next = spendGold(state, cost);
  next = removeItem(next, materialId, 1);
  const upgradeLevel = (next.upgrades?.[itemId] || 0) + 1;
  next = { ...next, upgrades: { ...next.upgrades, [itemId]: upgradeLevel } };
  return next;
}

export function getItemEffectiveStats(itemId, upgradeLevel = 0, tier) {
  const item = ITEMS[itemId];
  const stats = zeroStats();
  const tierMultiplier = tier ? QUALITY_TIER_MULTIPLIERS[tier] : 1;
  for (const stat of STAT_KEYS) {
    const base = (item.stats?.[stat] || 0) * tierMultiplier;
    stats[stat] = base + base * 0.25 * upgradeLevel;
  }
  return stats;
}

export function getEquipmentBonuses(state) {
  const bonuses = zeroStats();
  for (const slot of Object.keys(state.equipment)) {
    const itemId = state.equipment[slot];
    if (!itemId) continue;
    const upgradeLevel = state.upgrades?.[itemId] || 0;
    const tier = state.equipmentTiers?.[slot];
    const itemStats = getItemEffectiveStats(itemId, upgradeLevel, tier);
    for (const stat of STAT_KEYS) {
      bonuses[stat] += itemStats[stat];
    }
  }
  // Upgrade/tier scaling is fractional for most items; round each total once
  // so callers only ever see integer stats (HUD, battle, saved HP).
  for (const stat of STAT_KEYS) {
    bonuses[stat] = Math.round(bonuses[stat]);
  }
  return bonuses;
}

export function getItemStatDelta(state, itemId, tier) {
  const item = ITEMS[itemId];
  const currentItemId = state.equipment[item.slot];
  const currentUpgrade = currentItemId ? (state.upgrades?.[currentItemId] || 0) : 0;
  const currentTier = currentItemId ? state.equipmentTiers?.[item.slot] : undefined;
  const newUpgrade = state.upgrades?.[itemId] || 0;
  const currentStats = currentItemId
    ? getItemEffectiveStats(currentItemId, currentUpgrade, currentTier)
    : zeroStats();
  const newStats = getItemEffectiveStats(itemId, newUpgrade, tier);
  const delta = {};
  for (const stat of Object.keys(newStats)) {
    delta[stat] = Math.round(newStats[stat] - currentStats[stat]);
  }
  return delta;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS, full suite green.

- [ ] **Step 5: Commit**

```bash
git add js/state.js js/systems/inventory.js tests/inventory.test.js
git commit -m "feat: thread item quality tiers through inventory, equipment, and stat calculations"
```

---

### Task 5: `js/main.js` — pass drop tier through to inventory and pickup messages

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `rollDrop(...).tier` (Task 3), `addItem(state, itemId, quantity, tier)` (Task 4), `tierLabel(tier)` (Task 1).
- Produces: `grantDropItem(itemId, tier)` (was `grantDropItem(itemId)`) — no other file calls this function, so this signature change is fully contained to this file.

- [ ] **Step 1: Add the `tierLabel` import**

In `js/main.js`, find the existing import from `./systems/itemQuality.js` — there isn't one yet, so add a new import line near the other `./systems/*` imports (e.g. right after the `import { rollDrop } from './systems/loot.js';` line):

```js
import { tierLabel } from './systems/itemQuality.js';
```

- [ ] **Step 2: Update `grantDropItem` to accept and use the tier**

Find:

```js
function grantDropItem(itemId) {
  const item = ITEMS[itemId];
  const isNewTool = item.type === 'tool' && !state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  Object.assign(state, addItem(state, itemId, 1));
  if (isNewTool) {
    playCelebration(item.emoji, `You found a ${item.name}! ${item.description}.`);
  } else {
    playItemPickupToast(item.emoji, item.name);
  }
}
```

Replace with:

```js
function grantDropItem(itemId, tier) {
  const item = ITEMS[itemId];
  const isNewTool = item.type === 'tool' && !state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  Object.assign(state, addItem(state, itemId, 1, tier));
  const displayName = `${tierLabel(tier)}${item.name}`;
  if (isNewTool) {
    playCelebration(item.emoji, `You found a ${displayName}! ${item.description}.`);
  } else {
    playItemPickupToast(item.emoji, displayName);
  }
}
```

Tools never carry a tier (they have no `.slot`, so `rollDrop` never assigns one to them), so `tierLabel(undefined)` returns `''` and this branch's message is byte-for-byte unchanged for tool pickups.

- [ ] **Step 3: Update all three `grantDropItem` call sites to pass `drop.tier`**

There are three identical-shaped call sites (in the `'won'`/`'surrender'` outcome branch, the `'fled-with-loot'` branch, and the `'fled'` branch's per-monster loop). In each, find:

```js
      if (drop.item) {
        grantDropItem(drop.item);
      }
```

(note: indentation differs slightly between the three sites — two are indented 6 spaces, one inside the `'fled'` loop is indented 6 spaces too; match whatever the existing line's indentation is) and replace with:

```js
      if (drop.item) {
        grantDropItem(drop.item, drop.tier);
      }
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `npm run test`
Expected: PASS, full suite green (no existing test covers `main.js` directly — this file isn't unit-tested, same standing limitation as `battleScreen.js` — so this step confirms no *other* file's tests regressed).

- [ ] **Step 5: Manually verify in a browser**

`main.js` has no automated test coverage (it's DOM-orchestration code, same as `battleScreen.js`). Verify live:

```bash
cd /Users/timothy.burgher/funstuff/rpg
python3 -m http.server 8791
```

In a browser tab, navigate to `http://localhost:8791/index.html`, open the browser console, and run:

```js
const { createNewGame } = await import('/js/state.js');
window.__debugTierTest = async (tier) => {
  const mainModule = await import('/js/main.js'); // side-effect: mounts start screen, harmless
};
```

Since `main.js`'s `grantDropItem` is not exported, the simplest live check is via actual play: create a new character, fight several battles (any monster), and confirm:
- A normal material/potion drop still shows the ordinary pickup toast unchanged.
- If a Fine/Superior/Unique item happens to drop (odds are real but not guaranteed on any single kill — keep fighting for a few minutes, or see Task 11 for a deterministic debug-hook approach that forces a specific drop), the toast/celebration text shows the tier prefix (e.g. "You found a Fine Iron Sword!" or the name of one of the three Unique items).

Full deterministic verification (forcing an exact tier/Unique drop on demand) happens in Task 11, once the combat hooks are wired too — this step is a quick sanity pass that ordinary play still works with no console errors.

- [ ] **Step 6: Commit**

```bash
git add js/main.js
git commit -m "feat: thread dropped item's quality tier into pickup messages"
```

---

### Task 6: `js/screens/inventoryScreen.js` — tier-aware equip/display

**Files:**
- Modify: `js/screens/inventoryScreen.js`

**Interfaces:**
- Consumes: `tierLabel` (Task 1), `getItemStatDelta(state, itemId, tier)` and `equipItem(state, itemId, slot, tier)` (Task 4).

- [ ] **Step 1: Add the `tierLabel` import**

Find:

```js
import { ITEMS } from '../data/items.js';
import { getItemStatDelta, equipItem, unequipItem, removeItem, applyHeal, getEquipmentBonuses, describeItem } from '../systems/inventory.js';
```

Replace with:

```js
import { ITEMS } from '../data/items.js';
import { getItemStatDelta, equipItem, unequipItem, removeItem, applyHeal, getEquipmentBonuses, describeItem } from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';
```

- [ ] **Step 2: Show the equipped item's tier**

Find:

```js
function renderEquippedRows() {
  return SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="inventory-row">${slot}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    return `<div class="inventory-row">
      <span title="${describeItem(itemId)}">${slot}: ${item.emoji} ${item.name} +${level}</span>
      <button data-unequip="${slot}">Unequip</button>
    </div>`;
  }).join('');
}
```

Replace with:

```js
function renderEquippedRows() {
  return SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="inventory-row">${slot}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    const tier = state.equipmentTiers?.[slot];
    return `<div class="inventory-row">
      <span title="${describeItem(itemId)}">${slot}: ${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      <button data-unequip="${slot}">Unequip</button>
    </div>`;
  }).join('');
}
```

- [ ] **Step 3: Show each unequipped gear entry's tier, and pass it through the Equip button**

Find:

```js
function renderGearRows() {
  const gearEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].slot);
  if (gearEntries.length === 0) return '<div class="inventory-empty">No unequipped gear.</div>';
  return gearEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const delta = getItemStatDelta(state, entry.itemId);
    const deltaText = formatDelta(delta);
    const qtyText = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    return `<div class="inventory-row">
      <span title="${describeItem(entry.itemId)}">${item.emoji} ${item.name}${qtyText}${deltaText ? ` (${deltaText})` : ''}</span>
      <button data-equip="${entry.itemId}">Equip</button>
    </div>`;
  }).join('');
}
```

Replace with:

```js
function renderGearRows() {
  const gearEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].slot);
  if (gearEntries.length === 0) return '<div class="inventory-empty">No unequipped gear.</div>';
  return gearEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const delta = getItemStatDelta(state, entry.itemId, entry.tier);
    const deltaText = formatDelta(delta);
    const qtyText = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    return `<div class="inventory-row">
      <span title="${describeItem(entry.itemId)}">${item.emoji} ${tierLabel(entry.tier)}${item.name}${qtyText}${deltaText ? ` (${deltaText})` : ''}</span>
      <button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}">Equip</button>
    </div>`;
  }).join('');
}
```

The `data-tier` attribute is deliberately `''` (not the literal string `'undefined'`) for a Plain entry, so the click handler below can cleanly convert it back to `undefined`.

- [ ] **Step 4: Pass the clicked row's tier through to `equipItem`**

Find:

```js
  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      Object.assign(state, equipItem(state, itemId, ITEMS[itemId].slot));
      callbacks.onChange();
      render();
    };
  });
```

Replace with:

```js
  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      const tier = btn.dataset.tier || undefined;
      Object.assign(state, equipItem(state, itemId, ITEMS[itemId].slot, tier));
      callbacks.onChange();
      render();
    };
  });
```

This fixes a real, otherwise-latent bug: without this, if a player owned both a Plain and a Fine copy of the same item, clicking "Equip" on either row would always equip whichever copy `equipItem`'s old (tier-blind) lookup happened to find first, regardless of which row was actually clicked.

- [ ] **Step 5: Manually verify in a browser**

```bash
cd /Users/timothy.burgher/funstuff/rpg
python3 -m http.server 8791
```

Open `http://localhost:8791/index.html`, open the console, and run:

```js
const { createNewGame } = await import('/js/state.js');
const { addItem } = await import('/js/systems/inventory.js');
const inventoryScreen = await import('/js/screens/inventoryScreen.js');

let state = createNewGame();
state = addItem(state, 'ironSword', 1); // Plain
state = addItem(state, 'ironSword', 1, 'fine');
state = addItem(state, 'ironSword', 1, 'superior');

const root = document.createElement('div');
document.body.appendChild(root);
inventoryScreen.mount(root, { state, callbacks: { onChange: () => {}, onClose: () => {} } });
```

Confirm visually (zoom/screenshot the `root` element): three separate Iron Sword rows appear, labeled plain "Iron Sword", "Fine Iron Sword", and "Superior Iron Sword", each with its own stat delta shown, each with its own working Equip button. Click "Equip" on the Fine row specifically, then re-run `inventoryScreen.mount(root, ...)` (or inspect `state.equipment.weapon`/`state.equipmentTiers.weapon` directly in the console) to confirm the Fine copy — not Plain or Superior — is the one that got equipped, and the "Equipment" section at the top now shows "Fine Iron Sword".

- [ ] **Step 6: Commit**

```bash
git add js/screens/inventoryScreen.js
git commit -m "feat: show item quality tiers in the inventory screen and equip the exact tier clicked"
```

---

### Task 7: `js/screens/shopScreen.js` — shop only ever sees Plain-tier stock

**Files:**
- Modify: `js/screens/shopScreen.js`

**Interfaces:**
- Consumes: nothing new — this task only changes which inventory entries the shop screen's existing logic filters to.

The shop only ever sells/buys Plain items (per the spec, "shop-purchased items... Plain tier, exactly as today"). Without this fix, a player who also owns a Fine/Superior copy of a shop item (found as a drop) would see a confusing/wrong "own X" count, and worse, the Sell button could sell their valuable found copy at the same base price as a Plain one.

- [ ] **Step 1: Restrict the owned-quantity lookup to the Plain stack**

Find:

```js
    const ownedEntry = state.inventory.find((entry) => entry.itemId === itemId);
    const ownedQty = ownedEntry ? ownedEntry.quantity : 0;
```

Replace with:

```js
    const ownedEntry = state.inventory.find((entry) => entry.itemId === itemId && !entry.tier);
    const ownedQty = ownedEntry ? ownedEntry.quantity : 0;
```

- [ ] **Step 2: Restrict `sellItem`'s owned check to the Plain stack**

Find:

```js
function sellItem(itemId) {
  const owned = state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  if (!owned) return;

  let next = removeItem(state, itemId, 1);
```

Replace with:

```js
function sellItem(itemId) {
  const owned = state.inventory.some((entry) => entry.itemId === itemId && !entry.tier && entry.quantity > 0);
  if (!owned) return;

  let next = removeItem(state, itemId, 1); // tier defaults to undefined - only ever sells the Plain stack
```

`buyItem`'s `addItem(next, itemId, quantity)` call and the post-purchase `equipItem(state, pendingEquip, ITEMS[pendingEquip].slot)` call both already default their `tier` argument to `undefined` by omission — no change needed there, since everything the shop screen ever adds or auto-equips is, by construction, something it just sold (always Plain).

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npm run test`
Expected: PASS (no automated test covers `shopScreen.js` directly — DOM-orchestration code, same standing limitation).

- [ ] **Step 4: Manually verify in a browser**

```bash
cd /Users/timothy.burgher/funstuff/rpg
python3 -m http.server 8791
```

Open `http://localhost:8791/index.html`, console:

```js
const { createNewGame } = await import('/js/state.js');
const { addItem } = await import('/js/systems/inventory.js');
const shopScreen = await import('/js/screens/shopScreen.js');

let state = createNewGame();
state = addItem(state, 'ironSword', 2); // 2 Plain
state = addItem(state, 'ironSword', 1, 'superior'); // 1 Superior, found

const root = document.createElement('div');
document.body.appendChild(root);
shopScreen.mount(root, { state, callbacks: { onPurchase: () => {}, onLeave: () => {} } });
```

Confirm the Iron Sword shop row shows "(own 2)" — not 3 — since only the Plain stack counts. Click "Sell" on that row, then re-inspect `state.inventory` in the console: the Plain stack should have dropped to 1, and the Superior entry should be completely untouched (still quantity 1).

- [ ] **Step 5: Commit**

```bash
git add js/screens/shopScreen.js
git commit -m "fix: shop screen only counts/sells Plain-tier stock, never a found tiered copy"
```

---

### Task 8: `js/screens/smithScreen.js` — show the equipped item's tier

**Files:**
- Modify: `js/screens/smithScreen.js`

**Interfaces:**
- Consumes: `tierLabel` (Task 1).

Small, cosmetic-only consistency fix: without it, a Fine/Superior/Unique item shown in the Smith screen would silently lose its tier label (while the same item shows it correctly in the Inventory screen), which would read as a display bug. `state.upgrades`/upgrade mechanics themselves are entirely unaffected — upgrade progress already keys by itemId alone regardless of tier (see Global Constraints), so no logic changes here, only what gets printed.

- [ ] **Step 1: Add the `tierLabel` import**

Find:

```js
import { ITEMS } from '../data/items.js';
import { upgradeCost, upgradeItem, MAX_UPGRADE_LEVEL, describeItem } from '../systems/inventory.js';
```

Replace with:

```js
import { ITEMS } from '../data/items.js';
import { upgradeCost, upgradeItem, MAX_UPGRADE_LEVEL, describeItem } from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';
```

- [ ] **Step 2: Show the tier in both smith-row branches**

Find:

```js
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;

    if (level >= MAX_UPGRADE_LEVEL) {
      return `<div class="smith-row">
      <span title="${describeItem(itemId)}">${item.emoji} ${item.name} +${level} (MAX)</span>
    </div>`;
    }

    const cost = upgradeCost(level);
    const materials = materialOptionsForSlot(slot);
    const options = materials
      .map((m) => `<option value="${m.itemId}" title="${describeItem(m.itemId)}">${ITEMS[m.itemId].name} (x${m.quantity})</option>`)
      .join('');

    return `<div class="smith-row">
      <span title="${describeItem(itemId)}">${item.emoji} ${item.name} +${level}</span>
      <select data-slot="${slot}">${options}</select>
      <button data-slot="${slot}" ${materials.length === 0 ? 'disabled' : ''}>Upgrade (${cost}g)</button>
    </div>`;
```

Replace with:

```js
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    const tier = state.equipmentTiers?.[slot];

    if (level >= MAX_UPGRADE_LEVEL) {
      return `<div class="smith-row">
      <span title="${describeItem(itemId)}">${item.emoji} ${tierLabel(tier)}${item.name} +${level} (MAX)</span>
    </div>`;
    }

    const cost = upgradeCost(level);
    const materials = materialOptionsForSlot(slot);
    const options = materials
      .map((m) => `<option value="${m.itemId}" title="${describeItem(m.itemId)}">${ITEMS[m.itemId].name} (x${m.quantity})</option>`)
      .join('');

    return `<div class="smith-row">
      <span title="${describeItem(itemId)}">${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      <select data-slot="${slot}">${options}</select>
      <button data-slot="${slot}" ${materials.length === 0 ? 'disabled' : ''}>Upgrade (${cost}g)</button>
    </div>`;
```

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add js/screens/smithScreen.js
git commit -m "feat: show the equipped item's quality tier in the smith screen"
```

---

### Task 9: `js/screens/battleScreen.js` part 1 — lifesteal and elemental proc

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `getEquipmentBonuses(state)` (Task 4, already imported in this file) now including `lifestealPercent`/`elementalProcChance`/`elementalProcDamage`.
- Produces: module-level `playerEffectBonuses` (set once per battle, in `mount()`) and `applyOnHitEffects(target, damage)`, called from both `playerAttack()` and `playerUseAbility()`'s two damage-resolution branches. Task 10 also calls `applyOnHitEffects` (via the `resolveOneAttack` helper it introduces).

This module has zero automated test coverage today (no jsdom in this repo — see the Tech Stack note at the top of this plan). Every step below that isn't a `npm run test` regression check is a manual, live-browser verification step with exact code to run, matching how the ability-hiding and terrain-painter changes were verified earlier in this project's history.

- [ ] **Step 1: Add `playerEffectBonuses` and set it in `mount()`**

Find the module-level `let` declarations near the top of the file:

```js
let attackStreak = 0;
let attackCooldownMs = 0;
let attackTauntShown = false;
let attackStreakIdleMs = 0;
let liveDamageNumbers = [];
```

Replace with:

```js
let attackStreak = 0;
let attackCooldownMs = 0;
let attackTauntShown = false;
let attackStreakIdleMs = 0;
let liveDamageNumbers = [];
let playerEffectBonuses = null;
```

Then find, in `mount()`:

```js
  battleOver = false;
  playerCombatant = buildPlayerCombatant();
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
```

Replace with:

```js
  battleOver = false;
  playerCombatant = buildPlayerCombatant();
  playerEffectBonuses = getEquipmentBonuses(state);
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
```

Equipment can't change mid-battle (the equip/inventory screens aren't reachable while a battle overlay is mounted), so this is computed once per battle rather than on every hit.

- [ ] **Step 2: Add the shared `applyOnHitEffects` helper**

Add this new function immediately after `buildMonsterCombatant` (i.e., right before `function paintPlaceholder` or whatever function currently follows it — insert it directly after the closing `}` of `buildMonsterCombatant`, before the next function in the file):

```js
// Lifesteal and elemental proc are each their own small, discrete hook -
// deliberately not a generic "on-hit effect" pipeline, matching how
// crit/knockback/combo bonuses are each their own named mechanic in this
// file already. Called once per monster actually hit by a player action
// (once for a single-target hit, once per monster for an AOE ability).
function applyOnHitEffects(target, damage) {
  if (playerEffectBonuses.lifestealPercent > 0) {
    const healAmount = Math.round(damage * playerEffectBonuses.lifestealPercent / 100);
    playerCombatant.hp = Math.min(playerCombatant.maxHp, playerCombatant.hp + healAmount);
  }
  if (playerEffectBonuses.elementalProcChance > 0 && Math.random() * 100 < playerEffectBonuses.elementalProcChance) {
    target.hp = Math.max(0, target.hp - playerEffectBonuses.elementalProcDamage);
    log.push(`🔥 Bonus fire damage to ${target.name}: ${playerEffectBonuses.elementalProcDamage}!`);
  }
}
```

- [ ] **Step 3: Call it from `playerAttack()`**

Find, inside `playerAttack()`:

```js
  playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
  updateHpBars();
  updateAtbBars();
  updateLog();
  checkOutcome();
  updateMenu();
}
```

(this is the end of `playerAttack()` — the one instance of this exact `playHitEffect` line inside that function; `playerUseAbility()`'s two branches have their own separate `playHitEffect` calls, handled in the next step). Replace with:

```js
  playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
  applyOnHitEffects(target, result.damage);
  updateHpBars();
  updateAtbBars();
  updateLog();
  checkOutcome();
  updateMenu();
}
```

- [ ] **Step 4: Call it from both branches of `playerUseAbility()`**

In the AOE branch, find:

```js
        playHitEffect(elements.monsterZones[monsterIndex], elements.monsterEmojis[monsterIndex], result.damage, result.isCrit);
      });
```

Replace with:

```js
        playHitEffect(elements.monsterZones[monsterIndex], elements.monsterEmojis[monsterIndex], result.damage, result.isCrit);
        applyOnHitEffects(mc, result.damage);
      });
```

In the single-target branch, find:

```js
    playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
    updateHpBars();
    updateAtbBars();
    updateLog();
    checkOutcome();
    updateMenu();
  } finally {
```

Replace with:

```js
    playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
    applyOnHitEffects(target, result.damage);
    updateHpBars();
    updateAtbBars();
    updateLog();
    checkOutcome();
    updateMenu();
  } finally {
```

- [ ] **Step 5: Run tests to verify nothing broke**

Run: `npm run test`
Expected: PASS, full suite green (this file has no automated tests of its own; this confirms no other file's tests regressed from the shared `getEquipmentBonuses` shape change).

- [ ] **Step 6: Manually verify lifesteal and elemental proc in a browser**

```bash
cd /Users/timothy.burgher/funstuff/rpg
python3 -m http.server 8791
```

Open `http://localhost:8791/index.html`, console:

```js
const { createNewGame } = await import('/js/state.js');
const { addItem, equipItem } = await import('/js/systems/inventory.js');
const battleScreen = await import('/js/screens/battleScreen.js');

let state = createNewGame();
state = addItem(state, 'vampiricFang', 1);
state = equipItem(state, 'vampiricFang', 'weapon', undefined);
state = addItem(state, 'emberRing', 1);
state = equipItem(state, 'emberRing', 'accessory', undefined);
state.player.hp = 10; // damaged, so a lifesteal heal is visibly observable

const root = document.createElement('div');
document.body.appendChild(root);
battleScreen.mount(root, { state, monsterIds: ['boar'], callbacks: { onBattleEnd: () => {} } });

// Force the player's ATB to full so Attack is immediately usable, then attack.
// (battleScreen's internal tick loop normally fills this over real time.)
```

Since `playerCombatant`/`isReady` aren't exported, the simplest way to land a guaranteed hit for observation is to wait for the visible "Attack" button to become enabled in the DOM (it starts disabled until the ATB gauge fills, typically within a couple of seconds of real time), then click it:

```js
await new Promise((resolve) => {
  const check = () => {
    const btn = document.getElementById('btn-attack');
    if (btn && !btn.disabled) resolve();
    else setTimeout(check, 200);
  };
  check();
});
document.getElementById('btn-attack').click();
```

Confirm in the DOM/console:
- The battle log (`root.querySelector('.battle-log')` or similar — inspect the rendered HTML) shows the normal hit line, and — since `emberRing`'s `elementalProcChance` is 20%, this may take a few attacks to observe — eventually a "🔥 Bonus fire damage to Snorty McPigface: 6!" line.
- The hero's HP bar/text (`root` contains the HP display) increases from its starting damaged value after a hit lands, confirming lifesteal healed the player (15% of whatever damage was dealt, rounded).

Repeat the attack a few times (re-click `btn-attack` once it re-enables) if the elemental proc didn't fire on the first hit, to confirm it does eventually fire and produces its own distinct log line rather than being silently folded into the main hit number.

- [ ] **Step 7: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: wire lifesteal and elemental proc combat effects into player attacks and abilities"
```

---

### Task 10: `js/screens/battleScreen.js` part 2 — extra-swing chance

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `playerEffectBonuses`, `applyOnHitEffects` (Task 9).
- Produces: a new `resolveOneAttack(countsTowardStreak)` helper, extracted from `playerAttack()`'s body; `playerAttack()` itself becomes a thin wrapper that calls it once normally and, on a successful extra-swing roll, calls it again without touching the attack-streak/cooldown state.

- [ ] **Step 1: Extract `playerAttack()`'s body into `resolveOneAttack`, and roll the extra-swing chance**

Find the entire current `playerAttack` function:

```js
function playerAttack() {
  // Same re-entrancy hazard as playerUseAbility's own guard, but from the other
  // direction: while an ability's timing meter is pending, playerCombatant.atb
  // hasn't been reset and updateMenu() hasn't re-rendered, so Attack (button or
  // the 'a' keydown path) is still clickable/pressable. Left unguarded, a
  // resolvePlayerAttack() here could end the battle (checkOutcome -> endBattle)
  // while the pending ability's await is still outstanding - see the
  // `if (battleOver) return;` added after that await below for the other half
  // of this fix.
  if (abilityActionInFlight || attackCooldownMs > 0) return;
  // Capture the target's index now: updateHpBars() below can re-anchor
  // selectedMonsterIndex to a survivor the instant this hit is a killing
  // blow, so re-reading selectedMonsterIndex after that point would make the
  // hit effect render on the wrong (undamaged) monster.
  const targetIndex = selectedMonsterIndex;
  const target = monsterCombatants[targetIndex];
  const unlockedAbilityCount = getUnlockedAbilities(state.player.level).length;
  const streakMultiplier = attackStreakMultiplier(attackStreak, unlockedAbilityCount);
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), Math.random, streakMultiplier, attackKnockbackMultiplier(attackStreak));
  attackStreak += 1;
  attackStreakIdleMs = 0;
  attackCooldownMs = attackCooldownMsForStreak(attackStreak);
  target.hp = result.monsterHp;
  target.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  log.push(result.isCrit
    ? `Critical! You hit ${target.name} for ${result.damage}!`
    : `You hit ${target.name} for ${result.damage}.`);
  const floor = Math.max(0, ATTACK_STREAK_FLOOR - unlockedAbilityCount * ATTACK_STREAK_FLOOR_PER_ABILITY);
  if (streakMultiplier <= floor && unlockedAbilityCount > 0 && !attackTauntShown) {
    attackTauntShown = true;
    const taunt = ATTACK_TAUNT_LINES[Math.floor(Math.random() * ATTACK_TAUNT_LINES.length)];
    log.push(taunt(target.name));
  }
  // Play the hit effect before updateHpBars() hides a killed monster's slot
  // (display: none), so a killing blow's damage number/flash/shake is
  // actually visible instead of rendering onto an already-hidden element.
  playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
  applyOnHitEffects(target, result.damage);
  updateHpBars();
  updateAtbBars();
  updateLog();
  checkOutcome();
  updateMenu();
}
```

Replace with:

```js
function resolveOneAttack(countsTowardStreak) {
  // Capture the target's index now: updateHpBars() below can re-anchor
  // selectedMonsterIndex to a survivor the instant this hit is a killing
  // blow, so re-reading selectedMonsterIndex after that point would make the
  // hit effect render on the wrong (undamaged) monster.
  const targetIndex = selectedMonsterIndex;
  const target = monsterCombatants[targetIndex];
  const unlockedAbilityCount = getUnlockedAbilities(state.player.level).length;
  // A bonus swing from extraSwingChance is deliberately exempt from the
  // attack-spam-decay system - see the Global Constraints at the top of
  // this plan and the design spec's "Combat hooks" section for why: it's an
  // automatic proc from one real press, not player spam, so it always hits
  // at full strength (multiplier 1) and never advances or is throttled by
  // the streak/cooldown state.
  const streakMultiplier = countsTowardStreak ? attackStreakMultiplier(attackStreak, unlockedAbilityCount) : 1;
  const knockbackMultiplier = countsTowardStreak ? attackKnockbackMultiplier(attackStreak) : 1;
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), Math.random, streakMultiplier, knockbackMultiplier);
  if (countsTowardStreak) {
    attackStreak += 1;
    attackStreakIdleMs = 0;
    attackCooldownMs = attackCooldownMsForStreak(attackStreak);
  }
  target.hp = result.monsterHp;
  target.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  log.push(result.isCrit
    ? `Critical! You hit ${target.name} for ${result.damage}!`
    : `You hit ${target.name} for ${result.damage}.`);
  if (countsTowardStreak) {
    const floor = Math.max(0, ATTACK_STREAK_FLOOR - unlockedAbilityCount * ATTACK_STREAK_FLOOR_PER_ABILITY);
    if (streakMultiplier <= floor && unlockedAbilityCount > 0 && !attackTauntShown) {
      attackTauntShown = true;
      const taunt = ATTACK_TAUNT_LINES[Math.floor(Math.random() * ATTACK_TAUNT_LINES.length)];
      log.push(taunt(target.name));
    }
  }
  // Play the hit effect before updateHpBars() hides a killed monster's slot
  // (display: none), so a killing blow's damage number/flash/shake is
  // actually visible instead of rendering onto an already-hidden element.
  playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
  applyOnHitEffects(target, result.damage);
}

function playerAttack() {
  // Same re-entrancy hazard as playerUseAbility's own guard, but from the other
  // direction: while an ability's timing meter is pending, playerCombatant.atb
  // hasn't been reset and updateMenu() hasn't re-rendered, so Attack (button or
  // the 'a' keydown path) is still clickable/pressable. Left unguarded, a
  // resolvePlayerAttack() here could end the battle (checkOutcome -> endBattle)
  // while the pending ability's await is still outstanding - see the
  // `if (battleOver) return;` added after that await below for the other half
  // of this fix.
  if (abilityActionInFlight || attackCooldownMs > 0) return;
  resolveOneAttack(true);
  updateHpBars();
  updateAtbBars();
  updateLog();
  checkOutcome();
  updateMenu();
  // Extra-swing chance (e.g. Swift Strike Charm) - deliberately does not
  // re-roll on the bonus swing itself, capping this at exactly one bonus
  // swing per original attack by construction (there's no recursive call
  // here, just this one guarded block). Gated on !battleOver: the first
  // swing above may have just ended the battle via checkOutcome ->
  // endBattle, which schedules callbacks.onBattleEnd via setTimeout: calling
  // checkOutcome a second time from a second swing would double-schedule
  // that callback and double-process rewards/XP for the same battle.
  if (!battleOver && playerEffectBonuses.extraSwingChance > 0 && Math.random() * 100 < playerEffectBonuses.extraSwingChance) {
    const bonusTarget = monsterCombatants[selectedMonsterIndex];
    if (bonusTarget && bonusTarget.hp > 0) {
      resolveOneAttack(false);
      updateHpBars();
      updateAtbBars();
      updateLog();
      checkOutcome();
      updateMenu();
    }
  }
}
```

- [ ] **Step 2: Run tests to verify nothing broke**

Run: `npm run test`
Expected: PASS, full suite green.

- [ ] **Step 3: Manually verify the refactor didn't change normal Attack behavior**

```bash
cd /Users/timothy.burgher/funstuff/rpg
python3 -m http.server 8791
```

Open `http://localhost:8791/index.html`, console:

```js
const { createNewGame } = await import('/js/state.js');
const battleScreen = await import('/js/screens/battleScreen.js');

const state = createNewGame();
const root = document.createElement('div');
document.body.appendChild(root);
battleScreen.mount(root, { state, monsterIds: ['boar'], callbacks: { onBattleEnd: () => {} } });

await new Promise((resolve) => {
  const check = () => {
    const btn = document.getElementById('btn-attack');
    if (btn && !btn.disabled) resolve();
    else setTimeout(check, 200);
  };
  check();
});
document.getElementById('btn-attack').click();
```

With no extra-swing item equipped, confirm exactly one "You hit..." log line appears per click, and the attack cooldown/streak behaves exactly as it did before this refactor (repeated rapid clicks show the existing damage-decay/growing-cooldown behavior — this is a *regression* check, not new behavior).

- [ ] **Step 4: Manually verify the extra-swing chance fires exactly once and doesn't touch the streak**

Same page, console:

```js
const { addItem, equipItem } = await import('/js/systems/inventory.js');
let state2 = createNewGame();
state2 = addItem(state2, 'swiftStrikeCharm', 1);
state2 = equipItem(state2, 'swiftStrikeCharm', 'accessory', undefined);

const root2 = document.createElement('div');
document.body.appendChild(root2);
battleScreen.mount(root2, { state: state2, monsterIds: ['boar'], callbacks: { onBattleEnd: () => {} } });

await new Promise((resolve) => {
  const check = () => {
    const btn = root2.querySelector('#btn-attack');
    if (btn && !btn.disabled) resolve();
    else setTimeout(check, 200);
  };
  check();
});
root2.querySelector('#btn-attack').click();
```

`swiftStrikeCharm`'s `extraSwingChance` is 10%, so this may take a few clicks (wait for the button to re-enable each time, matching its cooldown) to observe. When it fires, confirm in the rendered log (inspect `root2`'s HTML) that **two** "You hit..." lines appear from that single click, and that the attack cooldown shown afterward corresponds to only **one** streak increment (not two) — i.e., it's no harsher than a normal single Attack would have produced at that streak count. Confirm no infinite chain occurs (the two hits happen and then it stops — clicking again starts a fresh independent roll for the *next* click, it doesn't keep chaining within the same click).

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: wire extra-swing chance, exempt from the attack-spam-decay system"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only).

A final holistic pass exercising the full feature together, now that every piece (roll, data model, all three screens, all three combat effects) is wired. Use the debug-hook technique already established this session for verifying `battleScreen.js`/`main.js` changes without jsdom.

- [ ] **Step 1: Run the full automated suite one more time**

Run: `npm run test`
Expected: PASS, 0 failures. Note the final test count for your own sanity check against where the suite started (409 before this feature).

- [ ] **Step 2: Force and observe a Fine/Superior/Unique drop end-to-end through real gameplay code**

```bash
cd /Users/timothy.burgher/funstuff/rpg
python3 -m http.server 8791
```

Open `http://localhost:8791/index.html`, console:

```js
const { rollDrop } = await import('/js/systems/loot.js');
const { MONSTERS } = await import('/js/data/monsters.js');

// Force a Unique-effect drop from the toughest eligible regular monster.
const uniqueDrop = rollDrop(MONSTERS.wraith, () => 0.001);
console.log(uniqueDrop); // expect: { gold: <number>, item: one of vampiricFang/swiftStrikeCharm/emberRing, tier: undefined }

// Force a Superior-tier ordinary gear drop.
const gearDrop = rollDrop({ ...MONSTERS.wraith, dropTable: [] }, (() => { let i = 0; const vals = [0, 0.5, 0.05, 0, 0.05]; return () => vals[Math.min(i++, vals.length - 1)]; })());
console.log(gearDrop); // expect: { gold: <number>, item: <one of EQUIPMENT_DROP_POOL>, tier: 'superior' }
```

Confirm both console logs match the expected shape described in the comments.

- [ ] **Step 3: Confirm the whole pickup-to-equip-to-battle loop works for a Unique item**

Same page, console:

```js
const { createNewGame } = await import('/js/state.js');
const { addItem, equipItem, getEquipmentBonuses } = await import('/js/systems/inventory.js');
const inventoryScreen = await import('/js/screens/inventoryScreen.js');
const battleScreen = await import('/js/screens/battleScreen.js');

let state = createNewGame();
state = addItem(state, 'vampiricFang', 1); // simulates having just picked it up
const invRoot = document.createElement('div');
document.body.appendChild(invRoot);
inventoryScreen.mount(invRoot, { state, callbacks: { onChange: () => {}, onClose: () => {} } });
// Visually confirm the Gear section shows "🦴 Vampiric Fang" with its attack/lifesteal delta,
// then click its Equip button in the rendered UI (or call equipItem directly):
state = equipItem(state, 'vampiricFang', 'weapon', undefined);

console.log(getEquipmentBonuses(state)); // expect attack and lifestealPercent both non-zero

const battleRoot = document.createElement('div');
document.body.appendChild(battleRoot);
battleScreen.mount(battleRoot, { state, monsterIds: ['boar'], callbacks: { onBattleEnd: () => {} } });
```

Attack a few times (waiting for the button to re-enable between clicks, as in Task 9/10's steps) and confirm the hero's HP visibly increases after hits land (lifesteal from Vampiric Fang), with no console errors throughout.

- [ ] **Step 4: Clean up test tabs/state**

Close any browser tabs opened for this verification. No debug hooks were left in shipped code (everything verified above ran from the browser console against the real, unmodified modules — nothing was temporarily added to and needs removing from `js/main.js` or `js/screens/battleScreen.js` for this feature, unlike the ability-unlock-celebration verification earlier this session which did add and then remove a `window.__debugGame` hook).

- [ ] **Step 5: Update the backlog and changelog**

Mark the "Rung-3 gear effects" backlog entry (`docs/superpowers/BACKLOG.md`, Combat pass ideas section) as still-open for anything beyond the three v1 effects (crit-chance, parry-window trade-offs remain unbuilt). Add a `CHANGELOG.md` entry under `## [Unreleased]` → `### Added` describing the shipped feature (tiered/Unique drops, the three new items and their effects), following this repo's existing changelog style (see any recent entry for the exact prose conventions).

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/BACKLOG.md CHANGELOG.md
git commit -m "docs: mark item-quality-tiers-and-effects shipped in changelog and backlog"
```
