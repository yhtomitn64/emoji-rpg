import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStepDiscovery } from '../js/systems/discovery.js';
import { recordMiniDungeonEntrance, hasMiniDungeonEntrance } from '../js/systems/miniDungeons.js';
import { hasCache } from '../js/systems/caches.js';

test('resolveStepDiscovery returns none for a non-encounter tile regardless of rolls', () => {
  const state = { miniDungeons: {}, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 1, cacheChance: 1 };
  const tile = { encounter: false };
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, () => 0);
  assert.deepEqual(result, { outcome: 'none' });
});

test('resolveStepDiscovery re-enters an already-discovered mini-dungeon without re-rolling or re-recording', () => {
  const miniDungeons = recordMiniDungeonEntrance({}, 'north', 5, 5, 'miniDungeonA');
  const state = { miniDungeons, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 1, cacheChance: 1 };
  const tile = { encounter: true };
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, () => { throw new Error('rng should not be called'); });
  assert.equal(result.outcome, 'enterMiniDungeon');
  assert.equal(result.miniDungeons, undefined);
});

// Raised 2026-09-05: "the random dungeons offering more gold is so silly...
// let's drop that mechanic for now" - MINI_DUNGEONS_ENABLED
// (js/systems/miniDungeons.js) means an otherwise-hit mini-dungeon roll no
// longer reveals one; it still consumes its own rng() call (so later rolls
// in the sequence - the cache roll here - keep their position), then falls
// through to try the cache next, same as any other miss would.
test('resolveStepDiscovery never enters a mini-dungeon while MINI_DUNGEONS_ENABLED is off, even when that roll would have hit', () => {
  const state = { miniDungeons: {}, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 0.5, cacheChance: 0 };
  const tile = { encounter: true };
  const values = [0.1, 0.1]; // mini-dungeon roll (would hit: 0.1 < 0.5), then the cache roll (misses: cacheChance is 0)
  let i = 0;
  const rng = () => values[i++];
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, rng);
  assert.deepEqual(result, { outcome: 'none' });
  assert.equal(hasMiniDungeonEntrance(state.miniDungeons, 'north', 5, 5), false);
});

test('resolveStepDiscovery falls through to a cache when the mini-dungeon roll misses', () => {
  const state = { miniDungeons: {}, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 0.5, cacheChance: 0.5 };
  const tile = { encounter: true };
  const values = [0.9, 0.1, 0, 0, 0];
  let i = 0;
  const rng = () => values[i++];
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, rng);
  assert.equal(result.outcome, 'cache');
  assert.equal(hasCache(result.caches, 'north', 5, 5), true);
  assert.deepEqual(result.cacheLoot, { gold: 5, item: 'potion' });
});

test('resolveStepDiscovery returns none when both rolls miss', () => {
  const state = { miniDungeons: {}, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 0.5, cacheChance: 0.5 };
  const tile = { encounter: true };
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, () => 0.99);
  assert.deepEqual(result, { outcome: 'none' });
});

test('resolveStepDiscovery never places a mini-dungeon on a screen chokepoint, even when the roll hits - raised 2026-08-28', () => {
  // A mini-dungeon entrance placed on the only crossing of a narrow pass
  // forces the player through its interior on every single crossing. A
  // hit roll should fall through to a cache/miss instead of placing there.
  const state = { miniDungeons: {}, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 1, cacheChance: 0 };
  const tile = { encounter: true };
  const isChokepoint = (x, y) => x === 5 && y === 5;
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, () => 0, isChokepoint);
  assert.deepEqual(result, { outcome: 'none' });
});

// Was "still places a mini-dungeon on a non-chokepoint tile when the roll
// hits" before MINI_DUNGEONS_ENABLED went off (2026-09-05) - the
// chokepoint-avoidance logic itself is still covered, unaffected by the
// flag, by wouldRevealMiniDungeon's own tests in tests/miniDungeons.test.js.
test('resolveStepDiscovery still never enters a mini-dungeon on a non-chokepoint tile, while MINI_DUNGEONS_ENABLED is off', () => {
  const state = { miniDungeons: {}, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 1, cacheChance: 0 };
  const tile = { encounter: true };
  const isChokepoint = (x, y) => x === 9 && y === 9;
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, () => 0, isChokepoint);
  assert.deepEqual(result, { outcome: 'none' });
});
