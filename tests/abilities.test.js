import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveTimingHit, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff, canUseAbility, ROTATION_BONUS_MULTIPLIER, TIMING_BONUS_MULTIPLIER, COMBO_PAYOFF_BONUS_MULTIPLIER, COMBO_RETURN_BONUS_MULTIPLIER } from '../js/systems/abilities.js';
import { ATB_KNOCKBACK } from '../js/systems/combat.js';

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
  assert.deepEqual(createBuffState(), { active: false, remainingMs: 0 });
});

test('activateBuff turns the buff on using the ability\'s own duration', () => {
  const superScream = ABILITIES.find((a) => a.id === 'superScream');
  assert.deepEqual(activateBuff(superScream), { active: true, remainingMs: 12000 });
});

test('tickBuff counts down while active', () => {
  const buff = { active: true, remainingMs: 1000 };
  assert.deepEqual(tickBuff(buff, 300), { active: true, remainingMs: 700 });
});

test('tickBuff expires back to the inactive state once remainingMs hits 0', () => {
  const buff = { active: true, remainingMs: 200 };
  assert.deepEqual(tickBuff(buff, 300), { active: false, remainingMs: 0 });
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

test('resolveAbilityUse applies the ability multiplier on top of a plain attack, no buff/timing bonus', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // rng()=0.5 -> variance 1.0 -> base damage = 10-2 = 8, no crit (rollCrit uses the same rng draw internally,
  // and 0.5 is well above CRIT_CHANCE=0.1, so no crit here)
  const result = resolveAbilityUse(player, monster, stab, false, false, false, () => 0.5);
  assert.equal(result.damage, 10); // round(8 * 1.3) = 10
  assert.equal(result.isCrit, false);
  assert.equal(result.monsterHp, 90);
  assert.equal(result.playerAtb, 0);
});

test('resolveAbilityUse multiplies in the rotation bonus when the buff is active', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, false, false, () => 0.5);
  // base 8, * 1.8 (chop) = round(14.4) = 14, * 1.25 (rotation) = round(17.5) = 18
  assert.equal(result.damage, 18);
});

test('resolveAbilityUse multiplies in the timing bonus on a hit', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const result = resolveAbilityUse(player, monster, stab, false, true, false, () => 0.5);
  // base 8, * 1.3 (stab) = round(10.4) = 10, * 1.30 (timing) = round(13) = 13
  assert.equal(result.damage, 13);
});

test('resolveAbilityUse stacks buff and timing bonuses together', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, true, false, () => 0.5);
  // base 8, * 1.8 = 14.4 -> round 14, * 1.25 = 17.5 -> round 18, * 1.30 = 23.4 -> round 23
  assert.equal(result.damage, 23);
});

test('resolveAbilityUse knocks the monster\'s ATB back and never drops HP below 0', () => {
  const player = { attack: 500, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 10, defense: 0, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, false, false, () => 0.5);
  assert.equal(result.monsterHp, 0);
  assert.equal(result.monsterAtb, 50 - ATB_KNOCKBACK);
});

test('resolveDelayedHit computes Slash\'s follow-up tick as a fraction of the original hit', () => {
  const slash = ABILITIES.find((a) => a.id === 'slash');
  assert.equal(resolveDelayedHit(100, slash), 20); // round(100 * 0.2)
});

test('createDefenseDebuff starts active using the ability\'s own multiplier and duration', () => {
  const sweep = ABILITIES.find((a) => a.id === 'sweep');
  assert.deepEqual(createDefenseDebuff(sweep), { active: true, multiplier: 0.85, remainingMs: 6000 });
});

test('tickDefenseDebuff counts down and expires to null', () => {
  const debuff = { active: true, multiplier: 0.85, remainingMs: 200 };
  assert.deepEqual(tickDefenseDebuff(debuff, 100), { active: true, multiplier: 0.85, remainingMs: 100 });
  assert.equal(tickDefenseDebuff(debuff, 300), null);
});

test('tickDefenseDebuff on null is a no-op', () => {
  assert.equal(tickDefenseDebuff(null, 300), null);
});

test('applyDefenseDebuff reduces defense while active, leaves the monster untouched when null', () => {
  const monster = { hp: 50, defense: 20, atb: 0 };
  const debuff = { active: true, multiplier: 0.85, remainingMs: 1000 };
  assert.equal(applyDefenseDebuff(monster, debuff).defense, 17); // round(20 * 0.85)
  assert.equal(applyDefenseDebuff(monster, null), monster);
});

test('ABILITIES combo metadata pairs Stab↔Chop and Slash↔Sweep with matching roles and bonus multipliers', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.stab.comboRole, 'setup');
  assert.equal(byId.stab.comboPartnerId, 'chop');
  assert.equal(byId.stab.comboBonusMultiplier, COMBO_RETURN_BONUS_MULTIPLIER);
  assert.equal(byId.chop.comboRole, 'payoff');
  assert.equal(byId.chop.comboPartnerId, 'stab');
  assert.equal(byId.chop.comboBonusMultiplier, COMBO_PAYOFF_BONUS_MULTIPLIER);
  assert.equal(byId.slash.comboRole, 'setup');
  assert.equal(byId.slash.comboPartnerId, 'sweep');
  assert.equal(byId.slash.comboBonusMultiplier, COMBO_RETURN_BONUS_MULTIPLIER);
  assert.equal(byId.sweep.comboRole, 'payoff');
  assert.equal(byId.sweep.comboPartnerId, 'slash');
  assert.equal(byId.sweep.comboBonusMultiplier, COMBO_PAYOFF_BONUS_MULTIPLIER);
  assert.equal(byId.superScream.comboRole, undefined);
});

test('only Sweep has the aoe flag set', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.sweep.aoe, true);
  assert.equal(byId.stab.aoe, undefined);
  assert.equal(byId.chop.aoe, undefined);
  assert.equal(byId.slash.aoe, undefined);
  assert.equal(byId.superScream.aoe, undefined);
});

test('COMBO_PAYOFF_BONUS_MULTIPLIER and COMBO_RETURN_BONUS_MULTIPLIER have the spec\'d values', () => {
  assert.equal(COMBO_PAYOFF_BONUS_MULTIPLIER, 1.5);
  assert.equal(COMBO_RETURN_BONUS_MULTIPLIER, 1.15);
});

test('resolveAbilityUse multiplies in the combo payoff bonus when comboBonusActive is true on a payoff ability', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, false, true, () => 0.5);
  // base 8, * 1.8 (chop) = round(14.4) = 14, * 1.5 (combo payoff bonus) = round(21) = 21
  assert.equal(result.damage, 21);
});

test('resolveAbilityUse multiplies in the smaller combo return bonus on a setup ability', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const result = resolveAbilityUse(player, monster, stab, false, false, true, () => 0.5);
  // base 8, * 1.3 (stab) = round(10.4) = 10, * 1.15 (combo return bonus) = round(11.5) = 12
  assert.equal(result.damage, 12);
});

test('resolveAbilityUse stacks the combo bonus with the buff and timing bonuses together', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, true, true, () => 0.5);
  // base 8, * 1.8 = 14.4 -> 14, * 1.25 (buff) = 17.5 -> 18, * 1.30 (timing) = 23.4 -> 23, * 1.5 (combo) = 34.5 -> 35
  assert.equal(result.damage, 35);
});

test('resolveAbilityUse does not apply any combo bonus when comboBonusActive is false', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, false, false, () => 0.5);
  // base 8, * 1.8 (chop) = round(14.4) = 14, no combo multiplier
  assert.equal(result.damage, 14);
});

test('canUseAbility requires ready unless a primed payoff bypasses it', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: true, comboPrimed: false, comboRole: 'setup' }), true);
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false, comboPrimed: false, comboRole: 'setup' }), false);
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false, comboPrimed: true, comboRole: 'payoff' }), true);
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false, comboPrimed: true, comboRole: 'setup' }), false);
});

test('canUseAbility is false when locked or on cooldown regardless of combo state', () => {
  assert.equal(canUseAbility({ locked: true, onCooldown: false, ready: true, comboPrimed: true, comboRole: 'payoff' }), false);
  assert.equal(canUseAbility({ locked: false, onCooldown: true, ready: true, comboPrimed: true, comboRole: 'payoff' }), false);
});
