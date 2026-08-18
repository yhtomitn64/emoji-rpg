import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveTimingHit } from '../js/systems/abilities.js';

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

test('createBuffState starts inactive with no bonus', () => {
  assert.deepEqual(createBuffState(), { active: false, remainingMs: 0, multiplier: 1 });
});

test('activateBuff turns the buff on using the ability\'s own duration and multiplier', () => {
  const superScream = ABILITIES.find((a) => a.id === 'superScream');
  assert.deepEqual(activateBuff(superScream), { active: true, remainingMs: 12000, multiplier: 1.4 });
});

test('tickBuff counts down while active', () => {
  const buff = { active: true, remainingMs: 1000, multiplier: 1.4 };
  assert.deepEqual(tickBuff(buff, 300), { active: true, remainingMs: 700, multiplier: 1.4 });
});

test('tickBuff expires back to the inactive state once remainingMs hits 0', () => {
  const buff = { active: true, remainingMs: 200, multiplier: 1.4 };
  assert.deepEqual(tickBuff(buff, 300), { active: false, remainingMs: 0, multiplier: 1 });
});

test('tickBuff on an already-inactive buff is a no-op', () => {
  const buff = createBuffState();
  assert.deepEqual(tickBuff(buff, 300), buff);
});

test('resolveTimingHit is true inside the sweet spot', () => {
  assert.equal(resolveTimingHit(85, 80, 100), true);
});

test('resolveTimingHit is true exactly on the sweet spot edges', () => {
  assert.equal(resolveTimingHit(80, 80, 100), true);
  assert.equal(resolveTimingHit(100, 80, 100), true);
});

test('resolveTimingHit is false outside the sweet spot', () => {
  assert.equal(resolveTimingHit(79, 80, 100), false);
  assert.equal(resolveTimingHit(50, 80, 100), false);
});
