import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDrop, getItemSources } from '../js/systems/loot.js';

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

test('getItemSources lists every monster whose drop table includes the item', () => {
  const sources = getItemSources('potion');
  assert.ok(sources.includes('Dropped by Mean Meatball'));
  assert.ok(sources.includes('Dropped by Super Mean Meatloaf'));
});

test('getItemSources lists a single-source material by its one dropping monster', () => {
  assert.deepEqual(getItemSources('ironScrap'), ['Dropped by Mean Meatball']);
});

test('getItemSources flags shop-purchasable items', () => {
  assert.ok(getItemSources('ironSword').includes('Available in the shop'));
  assert.ok(!getItemSources('dragonFang').includes('Available in the shop'));
});

test('getItemSources flags the starting weapon and items with no known source', () => {
  assert.deepEqual(getItemSources('starterSword'), ['Starting gear']);
});

test('getItemSources flags mini-dungeon treasure pool items', () => {
  assert.ok(getItemSources('powerRing').includes('Mini-dungeon treasure'));
});
