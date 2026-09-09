import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDebugCharacterFromUrl } from '../js/systems/debugCharacters.js';
import { listSlots, upsertSlot } from '../js/systems/saveSlots.js';
import { loadState, createNewGame } from '../js/state.js';
import { ABILITIES } from '../js/systems/abilities.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

test('applyDebugCharacterFromUrl is a no-op with no ?debug param', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('', storage);
  assert.equal(id, null);
  assert.deepEqual(listSlots(storage), []);
});

test('applyDebugCharacterFromUrl is a no-op for an unknown ?debug value', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('?debug=nonexistentCharacter', storage);
  assert.equal(id, null);
  assert.deepEqual(listSlots(storage), []);
});

test('?debug=level10 creates a level 10 save with every ability unlocked', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('?debug=level10', storage);
  assert.ok(id);
  const state = loadState(id, storage);
  assert.equal(state.player.level, 10);
  const unlockedCount = ABILITIES.filter((a) => a.unlockLevel <= state.player.level).length;
  assert.equal(unlockedCount, ABILITIES.length, 'level 10 should unlock every ability');
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, id);
});

test('the level10 debug character equips gear at the NG+0 upgrade cap, not past it', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('?debug=level10', storage);
  const state = loadState(id, storage);
  assert.equal(state.upgrades['ironSword:plain'], 3);
});

test('revisiting the same ?debug URL resets the slot instead of creating a duplicate', () => {
  const storage = createFakeStorage();
  applyDebugCharacterFromUrl('?debug=level10', storage);
  // Simulate the player having played a bit on the debug save since.
  upsertSlot('debug-level10', '[Debug] level10', { ...createNewGame(), player: { ...createNewGame().player, level: 3, gold: 1 } }, storage);
  applyDebugCharacterFromUrl('?debug=level10', storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1, 'revisiting the debug URL should reset the one slot, not duplicate it');
  assert.equal(loadState(slots[0].id, storage).player.level, 10);
});

test('a debug character never collides with a real player\'s save slots', () => {
  const storage = createFakeStorage();
  storage.setItem('emoji-rpg-slots', JSON.stringify([{ id: 'slot-real', name: 'My Hero', level: 5, ngPlusCycle: 0 }]));
  applyDebugCharacterFromUrl('?debug=level10', storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 2);
  assert.ok(slots.some((s) => s.id === 'slot-real' && s.name === 'My Hero'));
});
