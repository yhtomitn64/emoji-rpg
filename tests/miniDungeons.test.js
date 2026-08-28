import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MINI_DUNGEON_CAP_PER_SCREEN,
  MINI_DUNGEON_VARIANT_IDS,
  MINI_DUNGEON_TREASURE_ITEM_POOL,
  hasMiniDungeonEntrance,
  countMiniDungeonEntrances,
  getMiniDungeonEntrance,
  isTreasureTaken,
  recordMiniDungeonEntrance,
  markTreasureTaken,
  shouldRevealMiniDungeon,
  pickMiniDungeonVariant,
  rollMiniDungeonTreasure,
} from '../js/systems/miniDungeons.js';

test('constants match the design', () => {
  assert.equal(MINI_DUNGEON_CAP_PER_SCREEN, 1);
  assert.deepEqual(MINI_DUNGEON_VARIANT_IDS, ['miniDungeonA', 'miniDungeonB', 'miniDungeonC', 'miniDungeonD', 'miniDungeonE']);
  assert.deepEqual(MINI_DUNGEON_TREASURE_ITEM_POOL, [
    'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves', 'powerRing', 'luckyCharm',
  ]);
});

test('recordMiniDungeonEntrance records an entrance with its variant, immutably', () => {
  const miniDungeons = {};
  const next = recordMiniDungeonEntrance(miniDungeons, 'north', 5, 6, 'miniDungeonB');
  assert.equal(hasMiniDungeonEntrance(next, 'north', 5, 6), true);
  assert.deepEqual(getMiniDungeonEntrance(next, 'north', 5, 6), { variantId: 'miniDungeonB', treasureTaken: false });
  assert.deepEqual(miniDungeons, {});
});

test('hasMiniDungeonEntrance returns false for unrecorded tiles and unknown screens', () => {
  const miniDungeons = { north: { '5,6': { variantId: 'miniDungeonA', treasureTaken: false } } };
  assert.equal(hasMiniDungeonEntrance(miniDungeons, 'north', 1, 1), false);
  assert.equal(hasMiniDungeonEntrance(miniDungeons, 'unknown', 5, 6), false);
});

test('countMiniDungeonEntrances counts entrances on a screen and returns 0 for unknown screens', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(countMiniDungeonEntrances(miniDungeons, 'north'), 1);
  assert.equal(countMiniDungeonEntrances(miniDungeons, 'unknown'), 0);
});

test('getMiniDungeonEntrance returns undefined for unrecorded tiles', () => {
  assert.equal(getMiniDungeonEntrance({}, 'north', 5, 6), undefined);
});

test('markTreasureTaken marks the treasure taken without changing the variant, immutably', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonC');
  const next = markTreasureTaken(miniDungeons, 'north', 5, 6);
  assert.deepEqual(getMiniDungeonEntrance(next, 'north', 5, 6), { variantId: 'miniDungeonC', treasureTaken: true });
  assert.equal(getMiniDungeonEntrance(miniDungeons, 'north', 5, 6).treasureTaken, false);
});

test('isTreasureTaken reflects the treasureTaken flag and is false for unrecorded entrances', () => {
  assert.equal(isTreasureTaken({}, 'north', 5, 6), false);
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(isTreasureTaken(miniDungeons, 'north', 5, 6), false);
  const taken = markTreasureTaken(miniDungeons, 'north', 5, 6);
  assert.equal(isTreasureTaken(taken, 'north', 5, 6), true);
});

test('shouldRevealMiniDungeon returns false for a tile that already has an entrance, even under the cap', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(shouldRevealMiniDungeon(miniDungeons, 'north', 5, 6, 1, () => 0), false);
});

test('shouldRevealMiniDungeon returns false once the screen is at the cap, even for a fresh tile', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 6, 'miniDungeonA');
  assert.equal(shouldRevealMiniDungeon(miniDungeons, 'north', 9, 9, 1, () => 0), false);
});

test('shouldRevealMiniDungeon returns false when chance is 0, even for a fresh tile under the cap', () => {
  assert.equal(shouldRevealMiniDungeon({}, 'north', 5, 6, 0, () => 0), false);
});

test('shouldRevealMiniDungeon returns true for a fresh tile under the cap when the roll hits', () => {
  assert.equal(shouldRevealMiniDungeon({}, 'north', 5, 6, 1, () => 0), true);
});

test('shouldRevealMiniDungeon returns false on a screen chokepoint even when everything else says yes - raised 2026-08-28', () => {
  assert.equal(shouldRevealMiniDungeon({}, 'north', 5, 6, 1, () => 0, () => true), false);
});

test('shouldRevealMiniDungeon defaults to never treating a tile as a chokepoint when isChokepoint is omitted', () => {
  assert.equal(shouldRevealMiniDungeon({}, 'north', 5, 6, 1, () => 0), true);
});

test('pickMiniDungeonVariant picks by index across the full range', () => {
  assert.equal(pickMiniDungeonVariant(() => 0), 'miniDungeonA');
  assert.equal(pickMiniDungeonVariant(() => 0.3), 'miniDungeonB');
  assert.equal(pickMiniDungeonVariant(() => 0.5), 'miniDungeonC');
  assert.equal(pickMiniDungeonVariant(() => 0.7), 'miniDungeonD');
  assert.equal(pickMiniDungeonVariant(() => 0.9999), 'miniDungeonE');
});

test('rollMiniDungeonTreasure rolls gold in the 25-50 range and always includes an item', () => {
  const low = rollMiniDungeonTreasure(() => 0);
  assert.equal(low.gold, 25);
  assert.equal(low.item, 'ironSword');
  const high = rollMiniDungeonTreasure(() => 0.9999);
  assert.equal(high.gold, 50);
  assert.equal(high.item, 'luckyCharm');
});
