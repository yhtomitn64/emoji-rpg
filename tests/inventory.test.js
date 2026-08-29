import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../js/state.js';
import {
  addGold, spendGold, addItem, removeItem, equipItem, unequipItem, upgradeItem, upgradeCost,
  getEquipmentBonuses, getItemEffectiveStats, getItemStatDelta, MAX_UPGRADE_LEVEL, applyHeal, sellPrice,
  maxAffordableQuantity, describeItem, upgradeKey, getUpgradeLevel, migrateUpgradesToPerTier, sellDuplicateGear,
} from '../js/systems/inventory.js';
import { ITEMS } from '../js/data/items.js';

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
  state = addItem(state, 'ironScrap', 1);
  state = upgradeItem(state, 'weapon', 'ironScrap', 20);
  assert.equal(state.upgrades[upgradeKey('starterSword', undefined)], 1);
  assert.equal(state.player.gold, 0);
  const materialEntry = state.inventory.find((e) => e.itemId === 'ironScrap');
  assert.equal(materialEntry, undefined);
});

test('upgradeItem rejects upgrading past MAX_UPGRADE_LEVEL', () => {
  let state = createNewGame();
  state = addGold(state, 1000);
  state = addItem(state, 'ironScrap', MAX_UPGRADE_LEVEL);
  for (let i = 0; i < MAX_UPGRADE_LEVEL; i += 1) {
    const cost = upgradeCost(getUpgradeLevel(state, 'starterSword', undefined));
    state = upgradeItem(state, 'weapon', 'ironScrap', cost);
  }
  assert.equal(state.upgrades[upgradeKey('starterSword', undefined)], MAX_UPGRADE_LEVEL);

  state = addItem(state, 'ironScrap', 1);
  const goldBefore = state.player.gold;
  const materialBefore = state.inventory.find((e) => e.itemId === 'ironScrap').quantity;
  assert.throws(() => upgradeItem(state, 'weapon', 'ironScrap', upgradeCost(MAX_UPGRADE_LEVEL)));
  // Level, gold, and material are unchanged by the rejected attempt.
  assert.equal(state.upgrades[upgradeKey('starterSword', undefined)], MAX_UPGRADE_LEVEL);
  assert.equal(state.player.gold, goldBefore);
  assert.equal(state.inventory.find((e) => e.itemId === 'ironScrap').quantity, materialBefore);
});

test('upgradeItem throws without the required material', () => {
  const state = createNewGame();
  assert.throws(() => upgradeItem(state, 'weapon', 'ironScrap', 20));
});

test("upgradeItem throws when the material's upgradeSlot does not match the slot being upgraded", () => {
  let state = createNewGame();
  state = addItem(state, 'leatherScrap', 1); // upgradeSlot: body
  assert.throws(() => upgradeItem(state, 'weapon', 'leatherScrap', 20));
});

test('upgradeItem succeeds with a slot-matched material', () => {
  let state = createNewGame();
  state = addItem(state, 'ironScrap', 1); // upgradeSlot: weapon
  state = upgradeItem(state, 'weapon', 'ironScrap', 20);
  assert.equal(state.upgrades[upgradeKey('starterSword', undefined)], 1);
});

test('getEquipmentBonuses sums stats from equipped, upgraded gear', () => {
  const state = createNewGame();
  const bonuses = getEquipmentBonuses(state);
  assert.equal(bonuses.attack, 3);
});

test('getItemEffectiveStats returns unrounded base stats at upgrade level 0', () => {
  const stats = getItemEffectiveStats('starterSword', 0);
  assert.deepEqual(stats, {
    attack: 3, defense: 0, maxHp: 0, speed: 0, enemySlowPercent: 0,
    lifestealPercent: 0, extraSwingChance: 0, elementalProcChance: 0, elementalProcDamage: 0,
    critChancePercent: 0,
  });
});

test('getItemEffectiveStats scales fractionally per upgrade level without rounding', () => {
  const stats = getItemEffectiveStats('powerRing', 1);
  assert.equal(stats.attack, 2.5);
});

test('getEquipmentBonuses sums fractional per-item bonuses before rounding once (regression guard for the getItemEffectiveStats refactor)', () => {
  let state = createNewGame();
  state.upgrades[upgradeKey('starterSword', undefined)] = 1; // weapon, equipped by default: base attack 3 -> 3 + 3*0.25*1 = 3.75
  state = addItem(state, 'powerRing', 1);
  state = equipItem(state, 'powerRing', 'accessory');
  state.upgrades[upgradeKey('powerRing', undefined)] = 1; // accessory: base attack 2 -> 2 + 2*0.25*1 = 2.5
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

test('getItemStatDelta reports 0, not NaN, for a stat neither item touches against an empty slot', () => {
  const state = createNewGame(); // head slot is empty
  const delta = getItemStatDelta(state, 'ironHelm'); // head, no enemySlowPercent stat
  assert.equal(delta.enemySlowPercent, 0);
});

test("getItemStatDelta uses the candidate item's own real upgrade level, not the equipped item's", () => {
  let state = createNewGame();
  state.upgrades[upgradeKey('ironSword', undefined)] = 2; // ironSword sitting in inventory, previously upgraded
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

test('applyHeal adds the amount without exceeding maxHp', () => {
  assert.equal(applyHeal(10, 20, 5), 15);
  assert.equal(applyHeal(18, 20, 15), 20);
  assert.equal(applyHeal(20, 20, 15), 20);
});

test('sellPrice is half the listed price, rounded down', () => {
  assert.equal(sellPrice(30), 15);
  assert.equal(sellPrice(15), 7);
  assert.equal(sellPrice(0), 0);
});

test('maxAffordableQuantity caps the requested quantity to what gold can afford', () => {
  assert.equal(maxAffordableQuantity(100, 10, 100), 10);
  assert.equal(maxAffordableQuantity(100, 10, 5), 5);
  assert.equal(maxAffordableQuantity(5, 10, 100), 0);
  assert.equal(maxAffordableQuantity(100, 0, 5), 5);
});

test('describeItem summarizes stat-bearing gear', () => {
  assert.equal(describeItem('ironSword'), 'Iron Sword: attack +6');
  assert.equal(describeItem('clothTunic'), 'Cloth Tunic: defense +2, maxHp +4');
});

test('describeItem summarizes a heal-type consumable', () => {
  assert.equal(describeItem('potion'), 'Potion: heals 15 HP');
});

test('describeItem summarizes an upgrade material by its slot', () => {
  assert.equal(describeItem('ironScrap'), 'Iron Scrap: upgrade material for weapon gear');
});

test('describeItem prefers an explicit description field over inferred text', () => {
  assert.equal(describeItem('miningPick'), 'Mining Pick: Clears mountain gates blocking the way');
});

test('describeItem applies the tier multiplier to displayed stats, and treats undefined as Plain', () => {
  // ironSword base attack 6. Superior (1.20): round(6 * 1.20) = 7.
  assert.equal(describeItem('ironSword', 'superior'), 'Iron Sword: attack +7');
  assert.equal(describeItem('ironSword', undefined), 'Iron Sword: attack +6');
});

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

test('getEquipmentBonuses includes critChancePercent from an equipped Keen Eye', () => {
  let state = createNewGame();
  state = addItem(state, 'keenEye', 1);
  state = equipItem(state, 'keenEye', 'accessory', undefined);
  const bonuses = getEquipmentBonuses(state);
  assert.equal(bonuses.critChancePercent, 8);
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

// Raised 2026-08-29: Timothy found a Fine Iron Helm already showing "MAX"
// upgrade level despite never upgrading that specific copy - state.upgrades
// was keyed by bare itemId only, so every tier of the same base item shared
// one upgrade level. Fixed by keying on itemId+tier instead (upgradeKey).
test('a Fine copy of an item starts at upgrade level 0 even after the Plain copy was upgraded', () => {
  let state = createNewGame();
  state = addItem(state, 'ironScrap', 1);
  state = upgradeItem(state, 'weapon', 'ironScrap', 20); // upgrades Plain starterSword to level 1
  state = addItem(state, 'ironSword', 1, 'fine');
  assert.equal(getUpgradeLevel(state, 'ironSword', 'fine'), 0);
  assert.equal(getUpgradeLevel(state, 'starterSword', undefined), 1);
});

test('upgradeItem only advances the currently-equipped tier, leaving other tiers of the same item untouched', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1); // Plain
  state = addItem(state, 'ironSword', 1, 'fine');
  state = equipItem(state, 'ironSword', 'weapon', 'fine');
  state = addItem(state, 'ironScrap', 1);
  state = upgradeItem(state, 'weapon', 'ironScrap', 20); // upgrades the equipped Fine copy
  assert.equal(getUpgradeLevel(state, 'ironSword', 'fine'), 1);
  assert.equal(getUpgradeLevel(state, 'ironSword', undefined), 0);
});

test('getUpgradeLevel defaults to 0 for an item/tier with no recorded upgrade', () => {
  const state = createNewGame();
  assert.equal(getUpgradeLevel(state, 'ironSword', 'superior'), 0);
});

test('migrateUpgradesToPerTier moves a legacy bare-itemId key to the currently-equipped slot\'s real tier', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1, 'fine');
  state = equipItem(state, 'ironSword', 'weapon', 'fine');
  state.upgrades.ironSword = 2; // legacy bare-key write, as if from before this fix
  state = migrateUpgradesToPerTier(state);
  assert.equal(getUpgradeLevel(state, 'ironSword', 'fine'), 2);
  assert.equal(state.upgrades.ironSword, undefined);
});

test('migrateUpgradesToPerTier defaults an orphaned legacy key (item not currently equipped) to Plain', () => {
  let state = createNewGame();
  state.upgrades.ironScrap = 1; // not equippable at all, but exercises the "no equipped slot found" path
  state = migrateUpgradesToPerTier(state);
  assert.equal(getUpgradeLevel(state, 'ironScrap', undefined), 1);
});

test('migrateUpgradesToPerTier is a no-op when there are no legacy bare keys', () => {
  const state = createNewGame();
  const migrated = migrateUpgradesToPerTier(state);
  assert.deepEqual(migrated.upgrades, state.upgrades);
});

// Raised 2026-08-29 (screenshot): Plain Goblin Club x2 and Fine Goblin Club
// both showed "(attack -16)" in the inventory list even though Fine is
// genuinely 1 attack point stronger - getItemStatDelta rounded the final
// subtracted difference instead of rounding each side first, so two raw
// deltas 0.8 apart could land in the same rounding bucket. Reproduced here
// with the exact real config that collides: Fossil Fang (attack 14) maxed
// at upgrade level 3 equipped as the weapon.
test('getItemStatDelta never shows the same delta for a Plain and a Fine copy of the same base item', () => {
  let state = createNewGame();
  state = addItem(state, 'fossilFang', 1);
  state = equipItem(state, 'fossilFang', 'weapon');
  state.upgrades[upgradeKey('fossilFang', undefined)] = MAX_UPGRADE_LEVEL;

  const plainDelta = getItemStatDelta(state, 'goblinClub', undefined);
  const fineDelta = getItemStatDelta(state, 'goblinClub', 'fine');
  assert.notEqual(plainDelta.attack, fineDelta.attack);
  assert.equal(fineDelta.attack, plainDelta.attack + 1);
});

// Raised 2026-08-29: "add a sell duplicates button... auto sells all your
// dupes to clean up INV."
test('sellDuplicateGear keeps one copy of each gear entry and sells the rest at half price', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 3); // price 30 -> sellPrice 15 each
  state = addItem(state, 'clothCap', 1); // no duplicate, untouched

  const result = sellDuplicateGear(state);

  const swordEntry = result.state.inventory.find((e) => e.itemId === 'ironSword');
  assert.equal(swordEntry.quantity, 1, 'expected one Iron Sword kept, the other 2 sold');
  const capEntry = result.state.inventory.find((e) => e.itemId === 'clothCap');
  assert.equal(capEntry.quantity, 1, 'expected the non-duplicate item left untouched');
  assert.equal(result.soldCount, 2);
  assert.equal(result.goldEarned, 2 * sellPrice(ITEMS.ironSword.price));
  assert.equal(result.state.player.gold, state.player.gold + result.goldEarned);
});

test('sellDuplicateGear ignores materials/potions/tools even at quantity > 1', () => {
  let state = createNewGame(); // starts with 2 potions
  const result = sellDuplicateGear(state);
  assert.equal(result.soldCount, 0);
  assert.equal(result.goldEarned, 0);
  const potionEntry = result.state.inventory.find((e) => e.itemId === 'potion');
  assert.equal(potionEntry.quantity, 2, 'expected potions (not gear) to be left alone');
});

test('sellDuplicateGear leaves a currently-equipped item alone (equipping already removes its inventory copy)', () => {
  let state = createNewGame();
  state = addItem(state, 'ironSword', 1);
  state = equipItem(state, 'ironSword', 'weapon');
  const result = sellDuplicateGear(state);
  assert.equal(result.soldCount, 0);
  assert.equal(result.state.equipment.weapon, 'ironSword');
});
