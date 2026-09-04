import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier, pickAppearLine, FLAVOR_LINE_CHANCE, applyKnockback, ATB_KNOCKBACK, rollKnockback, ATB_KNOCKBACK_CHANCE, applySpeedDamageBonus, SPEED_DAMAGE_BONUS_THRESHOLD, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, isMonsterOutclassed, resolveWeakMobEncounter, WEAK_MOB_HITS_TO_KILL_THRESHOLD, WEAK_MOB_TRIGGER_CHANCE, attackStreakMultiplier, ATTACK_STREAK_DECAY, ATTACK_STREAK_FLOOR, ATTACK_STREAK_FLOOR_PER_ABILITY, ATTACK_STREAK_RECOVERY_MS, attackKnockbackMultiplier, ATTACK_KNOCKBACK_DECAY, attackCooldownMsForStreak, ATTACK_COOLDOWN_BASE_MS, ATTACK_COOLDOWN_GROWTH_MS, attackFalloffJustTriggered, ABILITY_GCD_BASE_MS, ABILITY_GCD_MS_PER_SPEED, ABILITY_GCD_FLOOR_MS, abilityGcdMsForSpeed } from '../js/systems/combat.js';

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

test('rollCrit adds an optional bonus chance on top of the base threshold, defaulting to none', () => {
  // Base CRIT_CHANCE is 0.1 - a roll of 0.15 misses with no bonus...
  assert.equal(rollCrit(() => 0.15), false);
  // ...but hits once a +0.08 item bonus (e.g. Keen Eye's critChancePercent: 8) raises the threshold past it.
  assert.equal(rollCrit(() => 0.15, 0.08), true);
  assert.equal(rollCrit(() => 0.5, 0.08), false);
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

test('rollKnockback only applies the knockback below ATB_KNOCKBACK_CHANCE, leaving atb untouched otherwise', () => {
  assert.equal(rollKnockback(50, ATB_KNOCKBACK, () => ATB_KNOCKBACK_CHANCE - 0.001), 50 - ATB_KNOCKBACK);
  assert.equal(rollKnockback(50, ATB_KNOCKBACK, () => ATB_KNOCKBACK_CHANCE), 50);
  assert.equal(rollKnockback(50, ATB_KNOCKBACK, () => ATB_KNOCKBACK_CHANCE + 0.001), 50);
});

test('rollKnockback defaults to Math.random when no rng is supplied', () => {
  assert.equal(typeof rollKnockback(50, ATB_KNOCKBACK), 'number');
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
  // rng()=0.5 misses the low-probability knockback roll (ATB_KNOCKBACK_CHANCE
  // is 0.05) - see the dedicated rollKnockback tests below for the proc case.
  const result = resolvePlayerAttack(player, monster, () => 0.5);
  // base 10-2=8, variance 0.85+0.5*0.3=1.0 -> 8, no crit, speed bonus: round(8*1.1)=9
  assert.equal(result.damage, 9);
  assert.equal(result.isCrit, false);
  assert.equal(result.monsterHp, 21);
  assert.equal(result.monsterAtb, 50);
  assert.equal(result.playerAtb, 0);
});

test('resolvePlayerAttack knocks the monster\'s ATB back only when the low-probability roll hits', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 30, defense: 2, atb: 50 };
  const procced = resolvePlayerAttack(player, monster, () => 0.01);
  assert.equal(procced.monsterAtb, 50 - ATB_KNOCKBACK);
});

test('resolvePlayerAttack applies an optional streak multiplier to damage before crit/speed bonus, defaulting to no change', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 30, defense: 2, atb: 50 };
  const result = resolvePlayerAttack(player, monster, () => 0.5, 0.7);
  // base 10-2=8, variance 1.0 -> 8, streak multiplier 0.7 -> round(5.6)=6, no crit, speed below threshold
  assert.equal(result.damage, 6);
  assert.equal(result.monsterHp, 24);
});

test('resolvePlayerAttack applies an optional crit chance bonus, defaulting to none', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 30, defense: 2, atb: 50 };
  // rng of 0.15 misses the base 0.1 crit chance with no bonus...
  const noBonus = resolvePlayerAttack(player, monster, () => 0.15, 1, 1, 0);
  assert.equal(noBonus.isCrit, false);
  // ...but hits with a +0.08 bonus (Keen Eye's critChancePercent: 8, converted to a fraction).
  const withBonus = resolvePlayerAttack(player, monster, () => 0.15, 1, 1, 0.08);
  assert.equal(withBonus.isCrit, true);
});

test('attackStreakMultiplier decays damage per consecutive attack, flooring at ATTACK_STREAK_FLOOR', () => {
  assert.equal(attackStreakMultiplier(0), 1);
  assert.equal(attackStreakMultiplier(1), 1 - ATTACK_STREAK_DECAY);
  assert.equal(attackStreakMultiplier(100), ATTACK_STREAK_FLOOR);
});

test('ATTACK_STREAK_RECOVERY_MS is a slow, real-time-only recharge, decoupled from the capped ATB gauge', () => {
  assert.equal(ATTACK_STREAK_RECOVERY_MS, 8000);
});

test('attackStreakMultiplier drops steeply enough to hit the floor by the 2nd consecutive press', () => {
  // The first press stays full strength; the falloff after that needs to be
  // big, not gradual, or spamming Attack still reads as viable for a few
  // presses in a row (Timothy's own read after the ability-scaled-floor
  // pass: "the game feels better when I don't use attack so much").
  assert.equal(attackStreakMultiplier(2), ATTACK_STREAK_FLOOR);
});

test('attackStreakMultiplier lowers the floor as more abilities are unlocked, reaching 0 at 5', () => {
  assert.equal(attackStreakMultiplier(100, 0), ATTACK_STREAK_FLOOR);
  assert.equal(attackStreakMultiplier(100, 1), ATTACK_STREAK_FLOOR - ATTACK_STREAK_FLOOR_PER_ABILITY);
  assert.equal(attackStreakMultiplier(100, 5), 0);
  assert.equal(attackStreakMultiplier(100, 8), 0);
});

test('attackStreakMultiplier still decays gradually toward a lowered floor, not instantly', () => {
  assert.equal(attackStreakMultiplier(1, 5), 1 - ATTACK_STREAK_DECAY);
  assert.equal(attackStreakMultiplier(0, 5), 1);
});

test('attackKnockbackMultiplier decays knockback per consecutive attack, reaching exactly 0 with no floor', () => {
  assert.equal(attackKnockbackMultiplier(0), 1);
  assert.equal(attackKnockbackMultiplier(1), 1 - ATTACK_KNOCKBACK_DECAY);
  assert.equal(attackKnockbackMultiplier(3), 0);
  assert.equal(attackKnockbackMultiplier(100), 0);
});

test('attackCooldownMsForStreak grows the cooldown uncapped with each consecutive attack', () => {
  assert.equal(attackCooldownMsForStreak(0), ATTACK_COOLDOWN_BASE_MS);
  assert.equal(attackCooldownMsForStreak(1), ATTACK_COOLDOWN_BASE_MS + ATTACK_COOLDOWN_GROWTH_MS);
  assert.equal(attackCooldownMsForStreak(5), ATTACK_COOLDOWN_BASE_MS + ATTACK_COOLDOWN_GROWTH_MS * 5);
  assert.equal(attackCooldownMsForStreak(50), ATTACK_COOLDOWN_BASE_MS + ATTACK_COOLDOWN_GROWTH_MS * 50);
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

test('resolveMonsterAttack with thornsPercent 0 (the default) never reflects damage', () => {
  const monster = { attack: 8, defense: 2, atb: 0, hp: 50 };
  const player = { hp: 20, defense: 4, atb: 60 };
  const result = resolveMonsterAttack(monster, player, () => 0.5);
  assert.equal(result.monsterHp, 50);
  assert.equal(result.reflectedDamage, 0);
});

test('resolveMonsterAttack reflects thornsPercent of the incoming damage back at the monster', () => {
  const monster = { attack: 8, defense: 2, atb: 0, hp: 50 };
  const player = { hp: 20, defense: 4, atb: 60 };
  // base 8-4=4, variance 1.0 -> damage 4; 20% of 4 = 0.8, rounds to 1
  const result = resolveMonsterAttack(monster, player, () => 0.5, 20);
  assert.equal(result.damage, 4);
  assert.equal(result.reflectedDamage, 1);
  assert.equal(result.monsterHp, 49);
});

test('resolveMonsterAttack thorns reflect never drops monsterHp below 0', () => {
  const monster = { attack: 8, defense: 2, atb: 0, hp: 1 };
  const player = { hp: 20, defense: 4, atb: 60 };
  const result = resolveMonsterAttack(monster, player, () => 0.5, 100);
  assert.equal(result.monsterHp, 0);
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

test('resolvePotionUse applies an optional crit chance bonus the same way resolvePlayerAttack does', () => {
  const player = { hp: 10, maxHp: 100 };
  const noBonus = resolvePotionUse(player, 15, () => 0.15, 0);
  assert.equal(noBonus.isCrit, false);
  const withBonus = resolvePotionUse(player, 15, () => 0.15, 0.08);
  assert.equal(withBonus.isCrit, true);
});

test('isMonsterOutclassed is true when hits-to-kill is at or below the threshold', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 10 * WEAK_MOB_HITS_TO_KILL_THRESHOLD };
  assert.equal(isMonsterOutclassed(player, monster), true);
});

test('isMonsterOutclassed is false once hits-to-kill exceeds the threshold', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 10 * WEAK_MOB_HITS_TO_KILL_THRESHOLD + 1 };
  assert.equal(isMonsterOutclassed(player, monster), false);
});

test('resolveWeakMobEncounter returns null against a boss, even when outclassed and the trigger roll would hit', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 30 };
  assert.equal(resolveWeakMobEncounter(player, monster, true, () => 0), null);
});

test('resolveWeakMobEncounter returns null when the monster is not outclassed', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 31 };
  assert.equal(resolveWeakMobEncounter(player, monster, false, () => 0), null);
});

test('resolveWeakMobEncounter returns null when the trigger roll misses', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 30 };
  assert.equal(resolveWeakMobEncounter(player, monster, false, () => WEAK_MOB_TRIGGER_CHANCE), null);
});

test('resolveWeakMobEncounter resolves to surrender on a low second roll', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 30 };
  const values = [0, 0];
  let i = 0;
  const rng = () => values[i++];
  assert.equal(resolveWeakMobEncounter(player, monster, false, rng), 'surrender');
});

test('resolveWeakMobEncounter resolves to fled-with-loot on a mid second roll', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 30 };
  const values = [0, 0.5];
  let i = 0;
  const rng = () => values[i++];
  assert.equal(resolveWeakMobEncounter(player, monster, false, rng), 'fled-with-loot');
});

test('resolveWeakMobEncounter resolves to fled-empty on a high second roll', () => {
  const player = { attack: 10 };
  const monster = { defense: 0, hp: 30 };
  const values = [0, 0.9];
  let i = 0;
  const rng = () => values[i++];
  assert.equal(resolveWeakMobEncounter(player, monster, false, rng), 'fled-empty');
});

test('attackFalloffJustTriggered is false while the streak multiplier is still full strength', () => {
  assert.equal(attackFalloffJustTriggered(1, false), false);
});

test('attackFalloffJustTriggered is true the first time the multiplier decays and it has not been seen yet', () => {
  assert.equal(attackFalloffJustTriggered(0.65, false), true);
});

test('attackFalloffJustTriggered is false once already seen, even while decayed', () => {
  assert.equal(attackFalloffJustTriggered(0.65, true), false);
});

test('abilityGcdMsForSpeed is exactly 1000ms at the player\'s starting speed of 5', () => {
  assert.equal(abilityGcdMsForSpeed(5), 1000);
});

test('abilityGcdMsForSpeed decreases as speed increases', () => {
  assert.ok(abilityGcdMsForSpeed(10) < abilityGcdMsForSpeed(5));
});

test('abilityGcdMsForSpeed never drops below the floor, however high speed goes', () => {
  assert.equal(abilityGcdMsForSpeed(1000), ABILITY_GCD_FLOOR_MS);
});

test('abilityGcdMsForSpeed matches the base/per-speed/floor formula directly', () => {
  assert.equal(abilityGcdMsForSpeed(0), ABILITY_GCD_BASE_MS);
  assert.equal(abilityGcdMsForSpeed(20), Math.max(ABILITY_GCD_FLOOR_MS, ABILITY_GCD_BASE_MS - 20 * ABILITY_GCD_MS_PER_SPEED));
});
