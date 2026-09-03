import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveTimingHit, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff, canUseAbility, estimateAbilityDamage, ROTATION_BONUS_MULTIPLIER, buildAbilityExplainerSections } from '../js/systems/abilities.js';
import { ATB_KNOCKBACK } from '../js/systems/combat.js';

test('ABILITIES has exactly the five abilities in level order, ids unchanged from before the rename', () => {
  assert.deepEqual(ABILITIES.map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
  assert.deepEqual(ABILITIES.map((a) => a.unlockLevel), [2, 4, 6, 8, 10]);
});

test('the rename maps display name/icon to the new rotation roles, ids stay internal', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.stab.name, 'Impale');
  assert.equal(byId.chop.name, 'Sever');
  assert.equal(byId.slash.name, 'Lacerate');
  assert.equal(byId.sweep.name, 'Faultline');
  assert.equal(byId.sweep.icon, '🪨');
  assert.equal(byId.superScream.name, 'Super Scream');
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

test('resolveTimingHit is true inside the sweet spot, true on the edges, false outside it', () => {
  assert.equal(resolveTimingHit(85, 80, 100), true);
  assert.equal(resolveTimingHit(80, 80, 100), true);
  assert.equal(resolveTimingHit(100, 80, 100), true);
  assert.equal(resolveTimingHit(79, 80, 100), false);
  assert.equal(resolveTimingHit(50, 80, 100), false);
});

test('resolveAbilityUse applies the ability multiplier on top of a plain attack, no buff bonus', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // rng()=0.5 -> variance 1.0 -> base damage = 10-2 = 8, no crit
  const result = resolveAbilityUse(player, monster, stab, false, () => 0.5);
  assert.equal(result.damage, 6); // round(8 * 0.8) = 6
  assert.equal(result.isCrit, false);
  assert.equal(result.monsterHp, 94);
  assert.equal(result.playerAtb, 0);
});

test('resolveAbilityUse multiplies in the rotation bonus when the buff is active', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, () => 0.5);
  // base 8, * 1.1 (chop) = round(8.8) = 9, * 1.25 (rotation) = round(11.25) = 11
  assert.equal(result.damage, 11);
});

test('resolveAbilityUse applies an optional crit chance bonus, defaulting to none', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const noBonus = resolveAbilityUse(player, monster, stab, false, () => 0.15, 0);
  assert.equal(noBonus.isCrit, false);
  const withBonus = resolveAbilityUse(player, monster, stab, false, () => 0.15, 0.08);
  assert.equal(withBonus.isCrit, true);
});

test('resolveAbilityUse knocks the monster\'s ATB back and never drops HP below 0', () => {
  const player = { attack: 500, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 10, defense: 0, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, () => 0.5);
  assert.equal(result.monsterHp, 0);
  assert.equal(result.monsterAtb, 50 - ATB_KNOCKBACK);
});

test('resolveDelayedHit computes Lacerate\'s follow-up bleed tick as a fraction of the original hit', () => {
  const lacerate = ABILITIES.find((a) => a.id === 'slash');
  assert.equal(resolveDelayedHit(100, lacerate), 20); // round(100 * 0.2)
});

test('createDefenseDebuff starts active using the ability\'s own multiplier and duration', () => {
  const faultline = ABILITIES.find((a) => a.id === 'sweep');
  assert.deepEqual(createDefenseDebuff(faultline), { active: true, multiplier: 0.85, remainingMs: 6000 });
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

test('only Faultline has the aoe flag set', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.sweep.aoe, true);
  assert.equal(byId.stab.aoe, undefined);
  assert.equal(byId.chop.aoe, undefined);
  assert.equal(byId.slash.aoe, undefined);
  assert.equal(byId.superScream.aoe, undefined);
});

test('Sever carries its own permanent extra-target count of 1, no other ability does by default', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.chop.extraTargetCount, 1);
  assert.equal(byId.stab.extraTargetCount, undefined);
  assert.equal(byId.slash.extraTargetCount, undefined);
  assert.equal(byId.sweep.extraTargetCount, undefined);
});

test('Faultline carries a widenBonusTargets of 1, reused as the widen buff target bonus', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.sweep.widenBonusTargets, 1);
});

test('Lacerate carries a retrigger config with a window duration and a sweet spot matching TIMING_SWEET_SPOT_START/END', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.deepEqual(byId.slash.retrigger, { windowMs: 1200, sweetSpotStartPercent: 80, sweetSpotEndPercent: 100, buffDurationMs: 9000 });
});

test('canUseAbility requires ready, unless a retrigger window is open for this ability', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: true }), true);
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false }), false);
  assert.equal(canUseAbility({ locked: false, onCooldown: true, ready: false, retriggerWindowOpen: true }), true);
});

test('canUseAbility is false when locked, even with a retrigger window open', () => {
  assert.equal(canUseAbility({ locked: true, onCooldown: false, ready: true, retriggerWindowOpen: true }), false);
});

test('canUseAbility is false when on cooldown and no retrigger window is open', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: true, ready: true }), false);
});

test('canUseAbility bypasses the ready gate when alwaysReady is set, e.g. Super Scream', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false, alwaysReady: true }), true);
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false, alwaysReady: false }), false);
});

test('canUseAbility still respects locked/onCooldown even when alwaysReady is set', () => {
  assert.equal(canUseAbility({ locked: true, onCooldown: false, ready: false, alwaysReady: true }), false);
  assert.equal(canUseAbility({ locked: false, onCooldown: true, ready: false, alwaysReady: true }), false);
});

test('every ability has a distinct icon', () => {
  const icons = ABILITIES.map((a) => a.icon);
  assert.ok(icons.every((icon) => typeof icon === 'string' && icon.length > 0));
  assert.equal(new Set(icons).size, icons.length);
});

test('estimateAbilityDamage applies the ability multiplier with no buff bonus', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // rng()=0.5 -> variance 1.0 -> base damage = 10-2 = 8, * 0.8 (stab) = round(6.4) = 6
  assert.equal(estimateAbilityDamage(player, monster, stab, false, () => 0.5), 6);
});

test('estimateAbilityDamage multiplies in the rotation buff bonus when active', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  // base 8, * 1.1 (chop) = round(8.8) = 9, * 1.25 (rotation) = round(11.25) = 11
  assert.equal(estimateAbilityDamage(player, monster, chop, true, () => 0.5), 11);
});

test('estimateAbilityDamage applies the speed damage bonus deterministically', () => {
  const player = { attack: 10, defense: 4, speed: 20, atb: 0 }; // at SPEED_DAMAGE_BONUS_THRESHOLD
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // base 8, * 0.8 (stab) = round(6.4) = 6, * 1.1 (speed bonus) = round(6.6) = 7
  assert.equal(estimateAbilityDamage(player, monster, stab, false, () => 0.5), 7);
});

test('estimateAbilityDamage defaults to an average roll when no rng is supplied', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const result = estimateAbilityDamage(player, monster, stab, false);
  assert.equal(result, 6);
});

test('ROTATION_BONUS_MULTIPLIER keeps its spec\'d value', () => {
  assert.equal(ROTATION_BONUS_MULTIPLIER, 1.25);
});

test('buildAbilityExplainerSections maps each unlocked ability to its icon/name/text, in the order given', () => {
  const [stab, chop] = ABILITIES;
  const sections = buildAbilityExplainerSections([stab, chop], { stab: 'Impale text', chop: 'Sever text' });
  assert.deepEqual(sections, [
    { icon: stab.icon, title: stab.name, text: 'Impale text' },
    { icon: chop.icon, title: chop.name, text: 'Sever text' },
  ]);
});

test('buildAbilityExplainerSections falls back to an empty string when an ability has no explainer text yet', () => {
  const [stab] = ABILITIES;
  const sections = buildAbilityExplainerSections([stab], {});
  assert.equal(sections[0].text, '');
});
