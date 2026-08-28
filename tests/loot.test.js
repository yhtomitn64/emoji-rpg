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

test('getItemSources flags Unique-effect items as a rare monster-kill drop, not "Found on monster kills"', () => {
  for (const id of UNIQUE_EFFECT_ITEM_IDS) {
    const sources = getItemSources(id);
    assert.ok(sources.includes('Rare monster-kill drop'), `${id} should be flagged as a rare monster-kill drop`);
    assert.ok(!sources.includes('Found on monster kills'), `${id} should not also say "Found on monster kills"`);
  }
});

test('getItemSources flags ordinary equipment-drop-pool items as findable on monster kills', () => {
  assert.ok(getItemSources('ironSword').includes('Found on monster kills'));
});

test('rollDrop applies a quality tier to an existing named equipment drop (e.g. goblinClub-shaped entries)', () => {
  const goblinLike = { goldRange: [5, 13], xp: 22, dropTable: [{ itemId: 'goblinClub', chance: 1 }] };
  // sequence: [gold, unique-effect pre-roll miss, ordinary-gear pre-roll miss,
  //            dropTable roll (hits goblinClub), quality roll -> superior at this toughness]
  const drop = rollDrop(goblinLike, sequence(0, 0.5, 0.5, 0, 0.01));
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

test('rollDrop\'s Unique-effect/ordinary-gear pre-roll takes priority over the dropTable\'s own item when both would hit', () => {
  const goblinLike = { goldRange: [5, 13], xp: 22, dropTable: [{ itemId: 'goblinClub', chance: 1 }] };
  // sequence: [gold, unique-effect pre-roll hits at this toughness, pool pick]
  // goblinLike's dropTable would also hit (chance 1) if it were ever
  // consulted - confirm the pre-roll wins and the dropTable is never reached.
  const drop = rollDrop(goblinLike, sequence(0, 0.001, 0));
  assert.ok(UNIQUE_EFFECT_ITEM_IDS.includes(drop.item));
  assert.notEqual(drop.item, 'goblinClub');
});

test('the pre-roll still gets a fair chance even when NG+ rescaling saturates the dropTable to 100%', () => {
  // Regression test for a bug found in final review: NG+'s scaleDropTable
  // boosts and re-normalizes drop-table chances, up to a full 1.0 at high
  // cycles. Before the pre-roll/dropTable reordering above, a saturated
  // dropTable meant the toughness-weighted pre-roll below could never fire
  // at all, starving Unique-effect/tiered drops to 0% for exactly the
  // toughest monsters at high NG+ cycles - the opposite of the feature's
  // goal. Simulates that saturation directly rather than importing
  // scaleDropTable, since this module doesn't otherwise depend on NG+.
  const saturatedWraith = { goldRange: [18, 30], xp: 63, dropTable: [{ itemId: 'wraithEssence', chance: 1 }] };
  const drop = rollDrop(saturatedWraith, sequence(0, 0.001, 0));
  assert.ok(UNIQUE_EFFECT_ITEM_IDS.includes(drop.item));
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
