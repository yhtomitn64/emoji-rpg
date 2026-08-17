import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier, pickAppearLine, FLAVOR_LINE_CHANCE, applyKnockback, ATB_KNOCKBACK, applySpeedDamageBonus, SPEED_DAMAGE_BONUS_THRESHOLD, applyEnemySlow } from '../js/systems/combat.js';

test('calculateDamage returns at least 1 even against high defense', () => {
  const attacker = { attack: 5 };
  const defender = { defense: 100 };
  const damage = calculateDamage(attacker, defender, () => 0.5);
  assert.equal(damage, 1);
});

test('calculateDamage scales with attack minus defense and rng variance', () => {
  const attacker = { attack: 10 };
  const defender = { defense: 4 };
  const damageLow = calculateDamage(attacker, defender, () => 0);
  const damageHigh = calculateDamage(attacker, defender, () => 1);
  assert.equal(damageLow, Math.round(6 * 0.85));
  assert.equal(damageHigh, Math.round(6 * 1.15));
});

test('tickGauge increases atb by speed times dt, capped at ATB_MAX', () => {
  assert.equal(tickGauge(0, 5, 1), 5);
  assert.equal(tickGauge(98, 5, 1), ATB_MAX);
});

test('isReady is true once atb reaches ATB_MAX', () => {
  assert.equal(isReady(99), false);
  assert.equal(isReady(100), true);
});

test('rollCrit returns true below the crit chance threshold, false above it', () => {
  assert.equal(rollCrit(() => 0.05), true);
  assert.equal(rollCrit(() => 0.5), false);
});

test('applyCritMultiplier scales damage on a crit and leaves it unchanged otherwise', () => {
  assert.equal(applyCritMultiplier(10, false), 10);
  assert.equal(applyCritMultiplier(10, true), 15);
});

test('pickAppearLine returns the generic line when the monster has no flavorLines', () => {
  const monster = { name: 'Snorty McPigface' };
  assert.equal(pickAppearLine(monster, () => 0), 'A wild Snorty McPigface appears!');
});

test('pickAppearLine returns the generic line when the chance roll misses', () => {
  const monster = { name: 'Super Mean Meatloaf', flavorLines: ['Line A', 'Line B'] };
  assert.equal(pickAppearLine(monster, () => FLAVOR_LINE_CHANCE), 'A wild Super Mean Meatloaf appears!');
});

test('pickAppearLine picks a flavor line by index when the chance roll hits', () => {
  const monster = { name: 'Ghost Apple Supreme', flavorLines: ['Line A', 'Line B', 'Line C'] };
  const values = [0.1, 0.6];
  let i = 0;
  const rng = () => values[i++];
  assert.equal(pickAppearLine(monster, rng), 'Line B');
});

test('applyKnockback subtracts a flat amount from atb, never going below 0', () => {
  assert.equal(applyKnockback(50, ATB_KNOCKBACK), 50 - ATB_KNOCKBACK);
  assert.equal(applyKnockback(5, ATB_KNOCKBACK), 0);
  assert.equal(applyKnockback(0, ATB_KNOCKBACK), 0);
});

test('applySpeedDamageBonus boosts damage once speed reaches the threshold, otherwise leaves it unchanged', () => {
  assert.equal(applySpeedDamageBonus(10, SPEED_DAMAGE_BONUS_THRESHOLD - 1), 10);
  assert.equal(applySpeedDamageBonus(10, SPEED_DAMAGE_BONUS_THRESHOLD), 11);
});

test('applyEnemySlow reduces speed by the given percent, never below 1', () => {
  assert.equal(applyEnemySlow(10, 15), 9);
  assert.equal(applyEnemySlow(10, 0), 10);
  assert.equal(applyEnemySlow(1, 90), 1);
});
