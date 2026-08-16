import test from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel, applyXp } from '../js/systems/leveling.js';

test('xpForLevel increases with level', () => {
  assert.ok(xpForLevel(2) > xpForLevel(1));
});

test('xpForLevel is unchanged below level 10', () => {
  assert.equal(xpForLevel(5), 112);
  assert.equal(xpForLevel(8), 226);
  assert.equal(xpForLevel(9), 270);
});

test('xpForLevel ramps up starting at level 10', () => {
  assert.equal(xpForLevel(10), 341);
  assert.equal(xpForLevel(15), 860);
});

test('applyXp accumulates xp without leveling when below threshold', () => {
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const { player: next, leveledUp } = applyXp(player, 1);
  assert.equal(leveledUp, false);
  assert.equal(next.level, 1);
  assert.equal(next.xp, 1);
});

test('applyXp levels up, increases stats, and refills hp to max (level 1->2, unchanged)', () => {
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

test('applyXp reaching level 9 still uses the unchanged pre-rework gains and a full heal', () => {
  const player = { level: 8, xp: 0, hp: 5, maxHp: 36, attack: 18, defense: 9, speed: 11, gold: 0 };
  const needed = xpForLevel(8);
  const { player: next, leveledUp } = applyXp(player, needed);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 9);
  assert.equal(next.maxHp, 40);
  assert.equal(next.attack, 20);
  assert.equal(next.defense, 10);
  assert.equal(next.speed, 12);
  assert.equal(next.hp, next.maxHp);
});

test('applyXp reaching level 10 applies tapered gains and a partial heal, not full', () => {
  const player = { level: 9, xp: 0, hp: 10, maxHp: 40, attack: 20, defense: 10, speed: 12, gold: 0 };
  const needed = xpForLevel(9);
  const { player: next, leveledUp } = applyXp(player, needed);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 10);
  assert.equal(next.maxHp, 42);
  assert.equal(next.attack, 21);
  assert.equal(next.defense, 11);
  assert.equal(next.speed, 13);
  assert.equal(next.hp, 26);
});

test('applyXp reaching an odd level in the tapered tier grants no speed gain', () => {
  const player = { level: 10, xp: 0, hp: 30, maxHp: 42, attack: 21, defense: 11, speed: 13, gold: 0 };
  const needed = xpForLevel(10);
  const { player: next } = applyXp(player, needed);
  assert.equal(next.level, 11);
  assert.equal(next.maxHp, 44);
  assert.equal(next.attack, 22);
  assert.equal(next.defense, 12);
  assert.equal(next.speed, 13);
  assert.equal(next.hp, 37);
});

test('applyXp on a multi-level jump crossing the level-10 boundary uses partial heal based on the final level', () => {
  const player = { level: 7, xp: 0, hp: 5, maxHp: 32, attack: 16, defense: 8, speed: 10, gold: 0 };
  const total = xpForLevel(7) + xpForLevel(8) + xpForLevel(9) + xpForLevel(10);
  const { player: next, leveledUp } = applyXp(player, total);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 11);
  assert.equal(next.maxHp, 44);
  assert.equal(next.attack, 22);
  assert.equal(next.defense, 12);
  assert.equal(next.speed, 13);
  assert.equal(next.hp, 25);
});
