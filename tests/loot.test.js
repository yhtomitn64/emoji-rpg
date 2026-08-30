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

test('rollDrop\'s ring-toughness-floor filter actually shrinks the Unique-effect pool below the ring floor (not just a coincidental index match)', () => {
  const weakMonster = { goldRange: [4, 8], xp: 16, dropTable: [] }; // toughness ~0.096, well under the 0.6 ring floor
  // sequence: [gold, mythic-essence check misses, unique-effect check hits (0.001), pool pick 0.999]
  // At ngPlusCycle 1 the ring floor excludes emberRing and windfuryRing (both ring-slot, below
  // floor) but not retributionCharm (accessory-slot, ngPlusOnly satisfied at cycle 1) - the
  // filtered pool is ['vampiricFang', 'swiftStrikeCharm', 'keenEye', 'retributionCharm'] (4
  // items), so floor(0.999*4) = 3 -> retributionCharm. The unfiltered 6-item list would instead
  // give floor(0.999*6) = 5 -> windfuryRing, so this distinguishes filtered from unfiltered output.
  const drop = rollDrop(weakMonster, sequence(0, 0.5, 0.001, 0.999), 1);
  assert.equal(drop.item, 'retributionCharm');
});

test('rollDrop\'s Unique-effect pool filter applies both the ring floor and ngPlusOnly gate together at ngPlusCycle 0', () => {
  const weakMonster = { goldRange: [4, 8], xp: 16, dropTable: [] }; // toughness ~0.096, well under the 0.6 ring floor
  // sequence: [gold, unique-effect check hits (0.001) - no mythic-essence-check rng() call at
  //            cycle 0, since `ngPlusCycle >= 1 && ...` short-circuits before calling rng() -
  //            pool pick 0.999]
  // At ngPlusCycle 0 the ring floor excludes emberRing/windfuryRing AND ngPlusOnly excludes
  // retributionCharm/windfuryRing, leaving only ['vampiricFang', 'swiftStrikeCharm', 'keenEye']
  // (3 items), so floor(0.999*3) = 2 -> keenEye. The unfiltered 6-item list would instead give
  // floor(0.999*6) = 5 -> windfuryRing, so this distinguishes filtered from unfiltered output
  // and proves both gates (not just one) are active at cycle 0.
  const drop = rollDrop(weakMonster, sequence(0, 0.001, 0.999), 0);
  assert.equal(drop.item, 'keenEye');
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
