import test from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel, applyXp } from '../js/systems/leveling.js';

test('xpForLevel increases with level', () => {
  assert.ok(xpForLevel(2) > xpForLevel(1));
});

test('applyXp accumulates xp without leveling when below threshold', () => {
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const { player: next, leveledUp } = applyXp(player, 1);
  assert.equal(leveledUp, false);
  assert.equal(next.level, 1);
  assert.equal(next.xp, 1);
});

test('applyXp levels up, increases stats, and refills hp to max', () => {
  const player = { level: 1, xp: 0, hp: 5, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const needed = xpForLevel(1);
  const { player: next, leveledUp } = applyXp(player, needed);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 2);
  assert.equal(next.maxHp, 24);
  assert.equal(next.attack, 7);
  assert.equal(next.hp, next.maxHp);
});

test('applyXp can trigger multiple level ups from a large xp gain', () => {
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const { player: next } = applyXp(player, 1000);
  assert.ok(next.level > 2);
});
