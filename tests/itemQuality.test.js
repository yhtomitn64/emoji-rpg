import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../js/data/monsters.js';
import {
  isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance,
  rollMythicEssenceChance, QUALITY_TIER_MULTIPLIERS, tierLabel, RING_TOUGHNESS_FLOOR,
  BOSS_MYTHIC_CHANCE,
} from '../js/systems/itemQuality.js';

test('isToughnessEligible excludes boss, elite, and forceFullBattle monsters', () => {
  assert.equal(isToughnessEligible(MONSTERS.boar), true);
  assert.equal(isToughnessEligible(MONSTERS.dragon), false); // isBoss
  assert.equal(isToughnessEligible(MONSTERS.jurassicJerky), false); // isElite
  assert.equal(isToughnessEligible(MONSTERS.axeGuardian), false); // forceFullBattle
});

test('monsterToughness returns 0 for the lowest-xp eligible monster and 1 for the highest', () => {
  // Today's roster: bat (xp 11) is the lowest eligible, wraith (xp 63) the
  // highest - boss/elite/guardian monsters (dragon 200, jurassicJerky 160,
  // the three xp-45/55 guardians) are excluded from this min/max entirely.
  assert.equal(monsterToughness(MONSTERS.bat), 0);
  assert.equal(monsterToughness(MONSTERS.wraith), 1);
});

test('monsterToughness spreads a mid-roster monster proportionally between the eligible min and max', () => {
  // direWolf: xp 32. (32 - 11) / (63 - 11) = 21/52 = 0.4038...
  assert.ok(Math.abs(monsterToughness(MONSTERS.direWolf) - 21 / 52) < 1e-9);
});

test('monsterToughness clamps an ineligible monster (if ever called on one) into the 0-1 range', () => {
  // Not called in practice (loot.js gates on isToughnessEligible first), but
  // the function itself should never produce a value outside 0-1 even for a
  // monster whose xp sits outside the eligible roster's range.
  assert.equal(monsterToughness(MONSTERS.dragon), 1); // xp 200, clamped to the max
});

test('rollQualityTier only ever returns plain, fine, or superior', () => {
  for (const toughness of [0, 0.25, 0.5, 0.75, 1]) {
    for (const rngValue of [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.9, 0.999]) {
      const result = rollQualityTier(toughness, () => rngValue);
      assert.ok(['plain', 'fine', 'superior'].includes(result));
    }
  }
});

test('rollQualityTier boundaries at toughness 0 match the documented 2%/10% floor', () => {
  assert.equal(rollQualityTier(0, () => 0.01), 'superior'); // < 0.02
  assert.equal(rollQualityTier(0, () => 0.05), 'fine'); // 0.02 <= x < 0.12
  assert.equal(rollQualityTier(0, () => 0.5), 'plain'); // >= 0.12
});

test('rollQualityTier boundaries at toughness 1 match the documented 10%/25% ceiling', () => {
  assert.equal(rollQualityTier(1, () => 0.05), 'superior'); // < 0.10
  assert.equal(rollQualityTier(1, () => 0.20), 'fine'); // 0.10 <= x < 0.35
  assert.equal(rollQualityTier(1, () => 0.5), 'plain'); // >= 0.35
});

test('rollUniqueEffectChance hits at the documented 1% floor and 5% ceiling', () => {
  assert.equal(rollUniqueEffectChance(0, () => 0.005), true);
  assert.equal(rollUniqueEffectChance(0, () => 0.02), false);
  assert.equal(rollUniqueEffectChance(1, () => 0.04), true);
  assert.equal(rollUniqueEffectChance(1, () => 0.06), false);
});

test('QUALITY_TIER_MULTIPLIERS matches the documented Fine/Superior bonuses', () => {
  assert.equal(QUALITY_TIER_MULTIPLIERS.fine, 1.10);
  assert.equal(QUALITY_TIER_MULTIPLIERS.superior, 1.20);
});

test('tierLabel prefixes a display name correctly for each tier, and not at all for Plain', () => {
  assert.equal(tierLabel(undefined), '');
  assert.equal(tierLabel('fine'), 'Fine ');
  assert.equal(tierLabel('superior'), 'Superior ');
});

test('rollQualityTier never returns mythic when ngPlusCycle is omitted or 0', () => {
  for (const toughness of [0, 0.5, 1]) {
    for (let i = 0; i <= 20; i++) {
      const rngValue = i / 20;
      assert.notEqual(rollQualityTier(toughness, () => rngValue), 'mythic');
      assert.notEqual(rollQualityTier(toughness, () => rngValue, 0), 'mythic');
    }
  }
});

test('rollQualityTier can return mythic once ngPlusCycle >= 1, at the low end of the roll', () => {
  assert.equal(rollQualityTier(1, () => 0.001, 1), 'mythic');
  assert.equal(rollQualityTier(1, () => 0.001, 2), 'mythic');
});

test('rollQualityTier at ngPlusCycle >= 1 still returns superior/fine/plain above the mythic band', () => {
  // toughness 0: mythic band is [0, 0.005). Confirm superior/fine/plain still
  // reachable just above it, matching the pre-mythic thresholds shifted up
  // by the mythic band width.
  assert.equal(rollQualityTier(0, () => 0.006, 1), 'superior'); // 0.005 <= x < 0.005+0.02
  assert.equal(rollQualityTier(0, () => 0.5, 1), 'plain');
});

test('rollQualityTier only ever returns plain, fine, superior, or mythic at any ngPlusCycle', () => {
  for (const toughness of [0, 0.25, 0.5, 0.75, 1]) {
    for (const cycle of [0, 1, 2]) {
      for (const rngValue of [0, 0.005, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.9, 0.999]) {
        const result = rollQualityTier(toughness, () => rngValue, cycle);
        assert.ok(['plain', 'fine', 'superior', 'mythic'].includes(result));
      }
    }
  }
});

test('QUALITY_TIER_MULTIPLIERS.mythic is greater than superior', () => {
  assert.equal(QUALITY_TIER_MULTIPLIERS.mythic, 1.5);
  assert.ok(QUALITY_TIER_MULTIPLIERS.mythic > QUALITY_TIER_MULTIPLIERS.superior);
});

test('tierLabel prefixes Mythic correctly', () => {
  assert.equal(tierLabel('mythic'), 'Mythic ');
});

test('rollMythicEssenceChance hits at the documented 2% floor and 6% ceiling', () => {
  assert.equal(rollMythicEssenceChance(0, () => 0.01), true);
  assert.equal(rollMythicEssenceChance(0, () => 0.03), false);
  assert.equal(rollMythicEssenceChance(1, () => 0.05), true);
  assert.equal(rollMythicEssenceChance(1, () => 0.07), false);
});

test('RING_TOUGHNESS_FLOOR and BOSS_MYTHIC_CHANCE match the documented starting values', () => {
  assert.equal(RING_TOUGHNESS_FLOOR, 0.6);
  assert.equal(BOSS_MYTHIC_CHANCE, 0.25);
});
