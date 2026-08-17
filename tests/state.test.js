import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, serializeState, deserializeState, saveState, loadState, slotSaveKey, DEFAULT_HERO_EMOJI } from '../js/state.js';

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
  assert.equal(state.ngPlusCycle, 0);
  assert.deepEqual(state.questProgress, {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  });
  assert.deepEqual(state.gateRewards, {});
  assert.equal(state.player.emoji, DEFAULT_HERO_EMOJI);
});

test('createNewGame uses the passed hero emoji instead of the default', () => {
  const state = createNewGame('🧙');
  assert.equal(state.player.emoji, '🧙');
});

test('serializeState and deserializeState round-trip', () => {
  const state = createNewGame();
  const json = serializeState(state);
  const restored = deserializeState(json);
  assert.deepEqual(restored, state);
});

test('slotSaveKey builds a per-slot storage key', () => {
  assert.equal(slotSaveKey('abc123'), 'emoji-rpg-save-abc123');
});

test('saveState writes to a slot-specific key and loadState reads it back', () => {
  const storage = createFakeStorage();
  const state = createNewGame();
  state.player.gold = 42;
  saveState(state, 'slot-1', storage);
  const loaded = loadState('slot-1', storage);
  assert.equal(loaded.player.gold, 42);
});

test('saveState for one slot does not affect another slot', () => {
  const storage = createFakeStorage();
  const stateA = createNewGame();
  stateA.player.gold = 10;
  const stateB = createNewGame();
  stateB.player.gold = 20;
  saveState(stateA, 'slot-a', storage);
  saveState(stateB, 'slot-b', storage);
  assert.equal(loadState('slot-a', storage).player.gold, 10);
  assert.equal(loadState('slot-b', storage).player.gold, 20);
});

test('loadState returns null when nothing saved for that slot', () => {
  const storage = createFakeStorage();
  assert.equal(loadState('slot-1', storage), null);
});
