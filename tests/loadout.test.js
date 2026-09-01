import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOADOUT_SIZE, createEmptyLoadout, setLoadoutSlot, clearLoadoutSlot, loadoutSlotsForItem,
} from '../js/systems/loadout.js';

test('LOADOUT_SIZE is 4', () => {
  assert.equal(LOADOUT_SIZE, 4);
});

test('createEmptyLoadout returns 4 empty slots', () => {
  assert.deepEqual(createEmptyLoadout(), [null, null, null, null]);
});

test('setLoadoutSlot assigns an item to a slot, bumping out the previous occupant', () => {
  const loadout = setLoadoutSlot(createEmptyLoadout(), 1, 'strengthDraught');
  assert.deepEqual(loadout, [null, 'strengthDraught', null, null]);
  const replaced = setLoadoutSlot(loadout, 1, 'swiftElixir');
  assert.deepEqual(replaced, [null, 'swiftElixir', null, null]);
});

test('setLoadoutSlot removes the item from any other slot it already occupied', () => {
  const loadout = setLoadoutSlot(setLoadoutSlot(createEmptyLoadout(), 0, 'potion'), 2, 'potion');
  assert.deepEqual(loadout, [null, null, 'potion', null]);
});

test('setLoadoutSlot does not mutate the input array', () => {
  const input = createEmptyLoadout();
  setLoadoutSlot(input, 0, 'potion');
  assert.deepEqual(input, [null, null, null, null]);
});

test('clearLoadoutSlot empties one slot, leaving the others alone', () => {
  const loadout = ['potion', 'strengthDraught', null, null];
  assert.deepEqual(clearLoadoutSlot(loadout, 1), ['potion', null, null, null]);
});

test('loadoutSlotsForItem returns every slot index holding the given item', () => {
  const loadout = ['potion', 'strengthDraught', 'potion', null];
  assert.deepEqual(loadoutSlotsForItem(loadout, 'potion'), [0, 2]);
  assert.deepEqual(loadoutSlotsForItem(loadout, 'swiftElixir'), []);
});
