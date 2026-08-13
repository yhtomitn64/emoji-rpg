import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier } from '../js/systems/combat.js';

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
