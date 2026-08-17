import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier, pickAppearLine, FLAVOR_LINE_CHANCE, applyKnockback, ATB_KNOCKBACK, applySpeedDamageBonus, SPEED_DAMAGE_BONUS_THRESHOLD, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse } from '../js/systems/combat.js';

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

test('resolvePlayerAttack composes damage, crit, speed bonus, and knockback into one result - the single source both battleScreen.js and scripts/simulate-balance.js call', () => {
  const player = { attack: 10, defense: 4, speed: SPEED_DAMAGE_BONUS_THRESHOLD, atb: 0 };
  const monster = { hp: 30, defense: 2, atb: 50 };
  const result = resolvePlayerAttack(player, monster, () => 0.5);
  // base 10-2=8, variance 0.85+0.5*0.3=1.0 -> 8, no crit, speed bonus: round(8*1.1)=9
  assert.equal(result.damage, 9);
  assert.equal(result.isCrit, false);
  assert.equal(result.monsterHp, 21);
  assert.equal(result.monsterAtb, 50 - ATB_KNOCKBACK);
  assert.equal(result.playerAtb, 0);
});

test('resolveMonsterAttack composes damage, crit, and knockback the same way, without the player-only speed bonus', () => {
  const monster = { attack: 8, defense: 2, atb: 0 };
  const player = { hp: 20, defense: 4, atb: 60 };
  const result = resolveMonsterAttack(monster, player, () => 0.5);
  // base 8-4=4, variance 1.0 -> 4, no crit, no speed bonus applies to the monster
  assert.equal(result.damage, 4);
  assert.equal(result.isCrit, false);
  assert.equal(result.playerHp, 16);
  assert.equal(result.playerAtb, 60 - ATB_KNOCKBACK);
  assert.equal(result.monsterAtb, 0);
});

test('resolvePotionUse heals by the given amount, capped at maxHp', () => {
  const player = { hp: 10, maxHp: 20 };
  const result = resolvePotionUse(player, 15, () => 0.5);
  assert.equal(result.isCrit, false);
  assert.equal(result.heal, 15);
  assert.equal(result.playerHp, 20);
});

test('resolvePotionUse can crit-heal, reusing the same crit system as attacks', () => {
  const player = { hp: 10, maxHp: 100 };
  const result = resolvePotionUse(player, 15, () => 0);
  assert.equal(result.isCrit, true);
  assert.equal(result.heal, Math.round(15 * 1.5));
  assert.equal(result.playerHp, 10 + Math.round(15 * 1.5));
});
