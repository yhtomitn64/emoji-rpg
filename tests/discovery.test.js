import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStepDiscovery } from '../js/systems/discovery.js';
import { recordMiniDungeonEntrance, getMiniDungeonEntrance } from '../js/systems/miniDungeons.js';
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

test('resolveStepDiscovery discovers and records a fresh mini-dungeon entrance when the roll hits', () => {
  const state = { miniDungeons: {}, caches: {} };
  const mapConfig = { id: 'north', miniDungeonChance: 0.5, cacheChance: 1 };
  const tile = { encounter: true };
  const values = [0.1, 0.5];
  let i = 0;
  const rng = () => values[i++];
  const result = resolveStepDiscovery(state, mapConfig, 5, 5, tile, rng);
  assert.equal(result.outcome, 'enterMiniDungeon');
  assert.deepEqual(getMiniDungeonEntrance(result.miniDungeons, 'north', 5, 5), { variantId: 'miniDungeonB', treasureTaken: false });
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
