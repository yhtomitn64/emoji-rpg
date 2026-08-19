import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT, PARRY_ZONE_END_PERCENT,
  createWindupState, startWindup, tickWindup, isWindupComplete, windupElapsedPercent,
  resolveParryAttempt, rollIncomingDamage, resolveParrySuccess,
} from '../js/systems/parry.js';

test('createWindupState returns an inactive state', () => {
  assert.deepEqual(createWindupState(), { active: false, elapsedMs: 0 });
});

test('startWindup returns an active state at 0 elapsed', () => {
  assert.deepEqual(startWindup(), { active: true, elapsedMs: 0 });
});

test('tickWindup advances elapsedMs on an active state', () => {
  const state = tickWindup({ active: true, elapsedMs: 300 }, 300);
  assert.deepEqual(state, { active: true, elapsedMs: 600 });
});

test('tickWindup is a no-op on an inactive state', () => {
  const state = tickWindup({ active: false, elapsedMs: 0 }, 300);
  assert.deepEqual(state, { active: false, elapsedMs: 0 });
});

test('isWindupComplete is false before the duration elapses', () => {
  assert.equal(isWindupComplete({ active: true, elapsedMs: 900 }), false);
});

test('isWindupComplete is true once elapsedMs reaches the duration', () => {
  assert.equal(isWindupComplete({ active: true, elapsedMs: PARRY_WINDUP_DURATION_MS }), true);
});

test('isWindupComplete is false on an inactive state even past the duration', () => {
  assert.equal(isWindupComplete({ active: false, elapsedMs: PARRY_WINDUP_DURATION_MS + 100 }), false);
});

test('windupElapsedPercent computes the right percentage', () => {
  assert.equal(windupElapsedPercent({ active: true, elapsedMs: 500 }), 50);
  assert.equal(windupElapsedPercent({ active: true, elapsedMs: 0 }), 0);
});

test('windupElapsedPercent clamps at 100', () => {
  assert.equal(windupElapsedPercent({ active: true, elapsedMs: PARRY_WINDUP_DURATION_MS + 500 }), 100);
});

test('resolveParryAttempt is true at the zone start boundary', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_START_PERCENT), true);
});

test('resolveParryAttempt is true at the zone end boundary', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_END_PERCENT), true);
});

test('resolveParryAttempt is true inside the zone', () => {
  assert.equal(resolveParryAttempt(90), true);
});

test('resolveParryAttempt is false just below the zone', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_START_PERCENT - 1), false);
});

test('resolveParryAttempt is false above the zone (unreachable in practice, but must resolve false not throw)', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_END_PERCENT + 1), false);
});

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('rollIncomingDamage returns a non-crit damage number using the injected rng', () => {
  // First rng() call is rollCrit's roll (>= CRIT_CHANCE 0.1 means no crit).
  // Second rng() call is calculateDamage's variance roll.
  const rng = fixedRng([0.99, 0.5]);
  const monster = { attack: 20, defense: 0 };
  const player = { defense: 5 };
  const result = rollIncomingDamage(monster, player, rng);
  assert.equal(result.isCrit, false);
  assert.equal(result.damage, 15); // base = 20-5 = 15, variance 0.85+0.5*0.3 = 1.0
});

test('rollIncomingDamage applies the crit multiplier when the crit roll hits', () => {
  const critRng = fixedRng([0.0, 0.5]); // 0.0 < CRIT_CHANCE 0.1: crit
  const nonCritRng = fixedRng([0.99, 0.5]);
  const monster = { attack: 20, defense: 0 };
  const player = { defense: 5 };
  const critResult = rollIncomingDamage(monster, player, critRng);
  const nonCritResult = rollIncomingDamage(monster, player, nonCritRng);
  assert.equal(critResult.isCrit, true);
  assert.ok(critResult.damage > nonCritResult.damage);
});

test('rollIncomingDamage defaults to Math.random when no rng is passed', () => {
  const result = rollIncomingDamage({ attack: 20, defense: 0 }, { defense: 5 });
  assert.equal(typeof result.damage, 'number');
  assert.ok(result.damage > 0);
});

test('resolveParrySuccess reflects half the incoming damage, bypassing monster defense entirely', () => {
  const monster = { hp: 100, defense: 50 };
  const result = resolveParrySuccess(monster, 30);
  assert.equal(result.reflectedDamage, 15);
  assert.equal(result.monsterHp, 85); // 100 - 15, defense (50) never subtracted
});

test('resolveParrySuccess floors monster HP at 0', () => {
  const monster = { hp: 5, defense: 0 };
  const result = resolveParrySuccess(monster, 30);
  assert.equal(result.monsterHp, 0);
});

test('resolveParrySuccess resets monster ATB to 0, not a flat knockback', () => {
  const monster = { hp: 100, defense: 0 };
  const result = resolveParrySuccess(monster, 30);
  assert.equal(result.monsterAtb, 0);
});
