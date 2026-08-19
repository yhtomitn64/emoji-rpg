import test from 'node:test';
import assert from 'node:assert/strict';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from '../js/systems/saveSlots.js';
import { STORAGE_KEY, serializeState, createNewGame, loadState, DEFAULT_HERO_EMOJI } from '../js/state.js';
import { CORNER_SCREEN_IDS } from '../js/systems/dungeonEntrance.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

test('listSlots returns an empty array when nothing has been created', () => {
  const storage = createFakeStorage();
  assert.deepEqual(listSlots(storage), []);
});

test('createSlot adds a registry entry and a fresh save', () => {
  const storage = createFakeStorage();
  const { id, state } = createSlot('Hero', DEFAULT_HERO_EMOJI, storage);
  assert.equal(state.player.level, 1);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, id);
  assert.equal(slots[0].name, 'Hero');
  assert.equal(slots[0].level, 1);
  assert.equal(slots[0].ngPlusCycle, 0);
  const loaded = loadState(id, storage);
  assert.equal(loaded.player.level, 1);
});

test('createSlot passes the chosen hero emoji through to the saved state', () => {
  const storage = createFakeStorage();
  const { id, state } = createSlot('Wizard', '🧙', storage);
  assert.equal(state.player.emoji, '🧙');
  assert.equal(loadState(id, storage).player.emoji, '🧙');
});

test('createSlot generates unique ids across calls', () => {
  const storage = createFakeStorage();
  const first = createSlot('One', DEFAULT_HERO_EMOJI, storage);
  const second = createSlot('Two', DEFAULT_HERO_EMOJI, storage);
  assert.notEqual(first.id, second.id);
});

test('deleteSlot removes the registry entry and the save', () => {
  const storage = createFakeStorage();
  const { id } = createSlot('Hero', DEFAULT_HERO_EMOJI, storage);
  deleteSlot(id, storage);
  assert.deepEqual(listSlots(storage), []);
  assert.equal(loadState(id, storage), null);
});

test('deleteSlot leaves other slots untouched', () => {
  const storage = createFakeStorage();
  const { id: keepId } = createSlot('Keep', DEFAULT_HERO_EMOJI, storage);
  const { id: deleteId } = createSlot('Delete', DEFAULT_HERO_EMOJI, storage);
  deleteSlot(deleteId, storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, keepId);
  assert.notEqual(loadState(keepId, storage), null);
});

test('touchSlot updates level, ngPlusCycle, and lastPlayed for the matching slot', () => {
  const storage = createFakeStorage();
  const { id } = createSlot('Hero', DEFAULT_HERO_EMOJI, storage);
  const before = listSlots(storage)[0].lastPlayed;
  touchSlot(id, { level: 5, ngPlusCycle: 1 }, storage);
  const after = listSlots(storage)[0];
  assert.equal(after.level, 5);
  assert.equal(after.ngPlusCycle, 1);
  assert.ok(after.lastPlayed >= before);
});

test('touchSlot on an unknown id is a no-op', () => {
  const storage = createFakeStorage();
  createSlot('Hero', DEFAULT_HERO_EMOJI, storage);
  touchSlot('nonexistent', { level: 5, ngPlusCycle: 1 }, storage);
  assert.equal(listSlots(storage).length, 1);
  assert.equal(listSlots(storage)[0].level, 1);
});

test('migrateLegacySave imports an existing legacy save into a named slot and removes the old key', () => {
  const storage = createFakeStorage();
  const legacy = createNewGame();
  legacy.player.gold = 99;
  storage.setItem(STORAGE_KEY, serializeState(legacy));
  migrateLegacySave(storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].name, 'Save');
  const loaded = loadState(slots[0].id, storage);
  assert.equal(loaded.player.gold, 99);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('migrateLegacySave is a no-op when there is no legacy save', () => {
  const storage = createFakeStorage();
  migrateLegacySave(storage);
  assert.deepEqual(listSlots(storage), []);
});

test('migrateLegacySave is a no-op when a registry already exists', () => {
  const storage = createFakeStorage();
  createSlot('Existing', DEFAULT_HERO_EMOJI, storage);
  const legacy = createNewGame();
  storage.setItem(STORAGE_KEY, serializeState(legacy));
  migrateLegacySave(storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].name, 'Existing');
});

test('createSlot rolls a dungeonEntrancePosition on one of the 4 corner screens', () => {
  const storage = createFakeStorage();
  const seenScreenIds = new Set();
  for (let i = 0; i < 40; i++) {
    const { state } = createSlot(`Hero${i}`, DEFAULT_HERO_EMOJI, storage);
    assert.ok(CORNER_SCREEN_IDS.includes(state.dungeonEntrancePosition.screenId));
    seenScreenIds.add(state.dungeonEntrancePosition.screenId);
  }
  assert.ok(seenScreenIds.size > 1, 'expected createSlot to roll different corner screens across many calls, not always the same one');
});
