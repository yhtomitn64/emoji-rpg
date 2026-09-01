import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONE_SHOT_POTION_IDS, isTimedBuffPotion, createActiveBuffs, activateTimedBuff,
  tickActiveBuffs, getActiveBuffBonuses, combineBonuses,
} from '../js/systems/buffPotions.js';

test('ONE_SHOT_POTION_IDS lists exactly the two one-shot potions', () => {
  assert.deepEqual(ONE_SHOT_POTION_IDS, ['berserkerTonic', 'secondWind']);
});

test('isTimedBuffPotion is true for the 8 timed potions, false for one-shots and the heal potion', () => {
  assert.equal(isTimedBuffPotion('strengthDraught'), true);
  assert.equal(isTimedBuffPotion('focusTonic'), true);
  assert.equal(isTimedBuffPotion('berserkerTonic'), false);
  assert.equal(isTimedBuffPotion('secondWind'), false);
  assert.equal(isTimedBuffPotion('potion'), false);
});

test('createActiveBuffs starts empty', () => {
  assert.deepEqual(createActiveBuffs(), []);
});

test('activateTimedBuff adds a new entry with the item\'s own buffDurationMs', () => {
  const active = activateTimedBuff(createActiveBuffs(), 'strengthDraught');
  assert.deepEqual(active, [{ itemId: 'strengthDraught', remainingMs: 12000 }]);
});

test('activateTimedBuff on an already-active potion refreshes duration instead of stacking a duplicate', () => {
  let active = activateTimedBuff(createActiveBuffs(), 'strengthDraught');
  active = tickActiveBuffs(active, 5000); // remainingMs now 7000
  active = activateTimedBuff(active, 'strengthDraught');
  assert.deepEqual(active, [{ itemId: 'strengthDraught', remainingMs: 12000 }]);
});

test('activateTimedBuff stacks different potion types together', () => {
  let active = activateTimedBuff(createActiveBuffs(), 'strengthDraught');
  active = activateTimedBuff(active, 'swiftElixir');
  assert.deepEqual(active, [
    { itemId: 'strengthDraught', remainingMs: 12000 },
    { itemId: 'swiftElixir', remainingMs: 12000 },
  ]);
});

test('tickActiveBuffs counts down and drops expired entries', () => {
  let active = [{ itemId: 'strengthDraught', remainingMs: 1000 }];
  active = tickActiveBuffs(active, 300);
  assert.deepEqual(active, [{ itemId: 'strengthDraught', remainingMs: 700 }]);
  active = tickActiveBuffs(active, 700);
  assert.deepEqual(active, []);
});

test('tickActiveBuffs does not mutate the input array', () => {
  const input = [{ itemId: 'strengthDraught', remainingMs: 1000 }];
  tickActiveBuffs(input, 300);
  assert.deepEqual(input, [{ itemId: 'strengthDraught', remainingMs: 1000 }]);
});

test('getActiveBuffBonuses sums each active buff\'s own item stats', () => {
  const active = [{ itemId: 'strengthDraught', remainingMs: 1 }, { itemId: 'emberVial', remainingMs: 1 }];
  assert.deepEqual(getActiveBuffBonuses(active), { attack: 6, elementalProcChance: 20, elementalProcDamage: 5 });
});

test('getActiveBuffBonuses adds two active buffs on the same stat together', () => {
  // Contrived (no two real potions share a stat today), but the sum must
  // still be correct if that ever changes.
  const active = [{ itemId: 'strengthDraught', remainingMs: 1 }, { itemId: 'strengthDraught', remainingMs: 1 }];
  assert.deepEqual(getActiveBuffBonuses(active), { attack: 12 });
});

test('getActiveBuffBonuses returns an empty object with no active buffs', () => {
  assert.deepEqual(getActiveBuffBonuses([]), {});
});

test('combineBonuses adds extra onto base, only reading base\'s own keys', () => {
  const base = { attack: 5, defense: 3, speed: 0 };
  const extra = { attack: 6, elementalProcChance: 20 }; // elementalProcChance absent from base - must be ignored, not added as a new key
  assert.deepEqual(combineBonuses(base, extra), { attack: 11, defense: 3, speed: 0 });
});

test('combineBonuses with no extra bonuses returns base unchanged (new object)', () => {
  const base = { attack: 5 };
  const combined = combineBonuses(base, {});
  assert.deepEqual(combined, { attack: 5 });
  assert.notEqual(combined, base);
});
