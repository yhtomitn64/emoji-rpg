import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../js/state.js';
import {
  addGold, spendGold, addItem, removeItem, equipItem, unequipItem, upgradeItem, upgradeCost,
  getEquipmentBonuses, getItemEffectiveStats, getItemStatDelta,
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
  state = addItem(state, 'ironScrap', 1);
  state = upgradeItem(state, 'weapon', 'ironScrap', 20);
  assert.equal(state.upgrades.starterSword, 1);
  assert.equal(state.player.gold, 0);
  const materialEntry = state.inventory.find((e) => e.itemId === 'ironScrap');
  assert.equal(materialEntry, undefined);
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
  assert.equal(state.upgrades.starterSword, 1);
});

test('getEquipmentBonuses sums stats from equipped, upgraded gear', () => {
  const state = createNewGame();
  const bonuses = getEquipmentBonuses(state);
  assert.equal(bonuses.attack, 3);
});

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
