import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, serializeState, deserializeState, saveState, loadState } from '../js/state.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
}

test('createNewGame returns a fresh default state', () => {
  const state = createNewGame();
  assert.equal(state.player.level, 1);
  assert.equal(state.player.gold, 20);
  assert.equal(state.map, 'center');
  assert.equal(state.equipment.weapon, 'starterSword');
  assert.deepEqual(state.caches, {});
  assert.deepEqual(state.miniDungeons, {});
  assert.equal(state.activeMiniDungeon, null);
  assert.equal(state.bossTier, 0);
});

test('serializeState and deserializeState round-trip', () => {
  const state = createNewGame();
  const json = serializeState(state);
  const restored = deserializeState(json);
  assert.deepEqual(restored, state);
});

test('saveState writes to storage and loadState reads it back', () => {
  const storage = createFakeStorage();
  const state = createNewGame();
  state.player.gold = 42;
  saveState(state, storage);
  const loaded = loadState(storage);
  assert.equal(loaded.player.gold, 42);
});

test('loadState returns null when nothing saved', () => {
  const storage = createFakeStorage();
  assert.equal(loadState(storage), null);
});
