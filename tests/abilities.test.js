import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, getUnlockedAbilities, tickCooldowns } from '../js/systems/abilities.js';

test('ABILITIES has exactly the five abilities in level order', () => {
  assert.deepEqual(ABILITIES.map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
  assert.deepEqual(ABILITIES.map((a) => a.unlockLevel), [2, 4, 6, 8, 10]);
});

test('getUnlockedAbilities returns only abilities unlocked at or below the given level', () => {
  assert.deepEqual(getUnlockedAbilities(1), []);
  assert.deepEqual(getUnlockedAbilities(2).map((a) => a.id), ['stab']);
  assert.deepEqual(getUnlockedAbilities(5).map((a) => a.id), ['stab', 'chop']);
  assert.deepEqual(getUnlockedAbilities(10).map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
  assert.deepEqual(getUnlockedAbilities(99).map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
});

test('tickCooldowns reduces every entry by dt, flooring at 0', () => {
  const result = tickCooldowns({ stab: 1000, chop: 200, sweep: 0 }, 300);
  assert.deepEqual(result, { stab: 700, chop: 0, sweep: 0 });
});

test('tickCooldowns does not mutate the input object', () => {
  const input = { stab: 1000 };
  tickCooldowns(input, 300);
  assert.deepEqual(input, { stab: 1000 });
});
