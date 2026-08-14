import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_CAP_PER_SCREEN,
  CACHE_ITEM_CHANCE,
  CACHE_ITEM_POOL,
  hasCache,
  countCaches,
  recordCache,
  rollCacheLoot,
  shouldRevealCache,
} from '../js/systems/caches.js';

test('constants match the design', () => {
  assert.equal(CACHE_CAP_PER_SCREEN, 3);
  assert.equal(CACHE_ITEM_CHANCE, 0.3);
  assert.deepEqual(CACHE_ITEM_POOL, [
    'potion', 'leatherScrap', 'batWing', 'snakeFang', 'ironScrap', 'wolfPelt', 'spiderSilk', 'orcTusk', 'wraithEssence',
  ]);
});

test('recordCache marks a tile as having a cache for a given screen, immutably', () => {
  const caches = {};
  const next = recordCache(caches, 'center', 3, 4);
  assert.equal(hasCache(next, 'center', 3, 4), true);
  assert.deepEqual(caches, {});
});

test('hasCache returns false for tiles without a cache and unknown screens', () => {
  const caches = { center: { '3,4': true } };
  assert.equal(hasCache(caches, 'center', 5, 5), false);
  assert.equal(hasCache(caches, 'unknown', 3, 4), false);
});

test('recordCache preserves previously recorded caches on the same screen', () => {
  let caches = recordCache({}, 'center', 1, 1);
  caches = recordCache(caches, 'center', 2, 2);
  assert.equal(hasCache(caches, 'center', 1, 1), true);
  assert.equal(hasCache(caches, 'center', 2, 2), true);
});

test('countCaches counts caches on a screen and returns 0 for unknown screens', () => {
  let caches = recordCache({}, 'center', 1, 1);
  caches = recordCache(caches, 'center', 2, 2);
  assert.equal(countCaches(caches, 'center'), 2);
  assert.equal(countCaches(caches, 'unknown'), 0);
});

test('rollCacheLoot rolls maximum gold and no item when both rolls miss high', () => {
  const loot = rollCacheLoot(() => 0.9999);
  assert.equal(loot.gold, 15);
  assert.equal(loot.item, null);
});

test('rollCacheLoot rolls minimum gold and the first pool item when both rolls hit low', () => {
  const values = [0, 0, 0];
  let i = 0;
  const rng = () => values[i++];
  const loot = rollCacheLoot(rng);
  assert.equal(loot.gold, 5);
  assert.equal(loot.item, 'potion');
});

test('rollCacheLoot picks the item by index when the item roll hits', () => {
  const values = [0.5, 0.1, 0.5];
  let i = 0;
  const rng = () => values[i++];
  const loot = rollCacheLoot(rng);
  assert.equal(loot.gold, 10);
  assert.equal(loot.item, 'ironScrap');
});

test('rollCacheLoot returns no item when the item roll exactly equals the chance threshold', () => {
  const values = [0.5, CACHE_ITEM_CHANCE];
  let i = 0;
  const rng = () => values[i++];
  const loot = rollCacheLoot(rng);
  assert.equal(loot.item, null);
});

test('shouldRevealCache returns false for a tile that already has a cache, even under the cap', () => {
  const caches = recordCache({}, 'center', 5, 5);
  assert.equal(shouldRevealCache(caches, 'center', 5, 5, 1, () => 0), false);
});

test('shouldRevealCache returns false once the screen is at the cap, even for a fresh tile', () => {
  let caches = recordCache({}, 'center', 1, 1);
  caches = recordCache(caches, 'center', 2, 2);
  caches = recordCache(caches, 'center', 3, 3);
  assert.equal(shouldRevealCache(caches, 'center', 9, 9, 1, () => 0), false);
});

test('shouldRevealCache returns false when cacheChance is 0, even for a fresh tile under the cap', () => {
  assert.equal(shouldRevealCache({}, 'center', 5, 5, 0, () => 0), false);
});

test('shouldRevealCache returns true for a fresh tile under the cap when the roll hits', () => {
  assert.equal(shouldRevealCache({}, 'center', 5, 5, 1, () => 0), true);
});
