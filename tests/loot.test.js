import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDrop, getItemSources, EQUIPMENT_DROP_CHANCE, EQUIPMENT_DROP_POOL, UNIQUE_EFFECT_ITEM_IDS } from '../js/systems/loot.js';
import { ITEMS } from '../js/data/items.js';

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
