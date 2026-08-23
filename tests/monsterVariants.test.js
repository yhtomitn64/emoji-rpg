import test from 'node:test';
import assert from 'node:assert/strict';
import { VARIANT_TIERS, pickMonsterVariant } from '../js/systems/monsterVariants.js';

const baseMonster = { name: 'Mean Meatball', hp: 67, attack: 10 };

test('VARIANT_TIERS has 5 tiers with a baseline (unlabeled) middle tier', () => {
  assert.equal(VARIANT_TIERS.length, 5);
  assert.equal(VARIANT_TIERS[2].label, null);
  assert.equal(VARIANT_TIERS[2].hpMultiplier, 1);
  assert.equal(VARIANT_TIERS[2].attackMultiplier, 1);
});

test('pickMonsterVariant on the baseline tier leaves name and stats unchanged', () => {
  const variant = pickMonsterVariant(baseMonster, () => 0.5);
  assert.equal(variant.name, 'Mean Meatball');
  assert.equal(variant.hp, 67);
  assert.equal(variant.attack, 10);
});

test('pickMonsterVariant on the weakest tier prefixes the name and scales stats down', () => {
  const variant = pickMonsterVariant(baseMonster, () => 0);
  assert.equal(variant.name, 'Puny Mean Meatball');
  assert.equal(variant.hp, Math.round(67 * 0.85));
  assert.equal(variant.attack, Math.round(10 * 0.85));
});

test('pickMonsterVariant on the strongest tier prefixes the name and scales stats up', () => {
  const variant = pickMonsterVariant(baseMonster, () => 0.999);
  assert.equal(variant.name, 'Savage Mean Meatball');
  assert.equal(variant.hp, Math.round(67 * 1.15));
  assert.equal(variant.attack, Math.round(10 * 1.15));
});

test('pickMonsterVariant always returns integer hp/attack', () => {
  for (const rngValue of [0, 0.2, 0.4, 0.6, 0.8]) {
    const variant = pickMonsterVariant(baseMonster, () => rngValue);
    assert.equal(Number.isInteger(variant.hp), true);
    assert.equal(Number.isInteger(variant.attack), true);
  }
});
