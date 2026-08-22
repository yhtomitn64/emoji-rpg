import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMEBACK_POTION_CAP,
  incrementLossStreak,
  potionsForStreak,
  getComebackMessage,
  postDeathWarpCost,
} from '../js/systems/comeback.js';

test('incrementLossStreak increases the streak by 1', () => {
  assert.equal(incrementLossStreak(0), 1);
  assert.equal(incrementLossStreak(4), 5);
});

test('COMEBACK_POTION_CAP is 5', () => {
  assert.equal(COMEBACK_POTION_CAP, 5);
});

test('potionsForStreak matches the streak count below the cap', () => {
  assert.equal(potionsForStreak(1), 1);
  assert.equal(potionsForStreak(2), 2);
  assert.equal(potionsForStreak(5), 5);
});

test('potionsForStreak clamps at the cap above it', () => {
  assert.equal(potionsForStreak(6), 5);
  assert.equal(potionsForStreak(100), 5);
});

test('getComebackMessage uses singular copy for 1 potion', () => {
  assert.equal(
    getComebackMessage(1),
    'Something takes pity on you — +1 potion to keep you going.'
  );
});

test('getComebackMessage uses escalating copy with the count for 2+ potions', () => {
  assert.equal(getComebackMessage(2), 'Another rough one... +2 potions this time.');
  assert.equal(getComebackMessage(5), 'Another rough one... +5 potions this time.');
});

test('postDeathWarpCost scales linearly with level at 10 gold per level', () => {
  assert.equal(postDeathWarpCost(1), 10);
  assert.equal(postDeathWarpCost(5), 50);
  assert.equal(postDeathWarpCost(11), 110);
});
