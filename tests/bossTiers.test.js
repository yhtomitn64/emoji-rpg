import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BOSS_TIER, BOSS_TIER_FLAVOR_LINES, getBossTierStats, pickBossReturnFlavor } from '../js/systems/bossTiers.js';
import { MONSTERS } from '../js/data/monsters.js';

test('constants match the design', () => {
  assert.equal(MAX_BOSS_TIER, 2);
  assert.equal(BOSS_TIER_FLAVOR_LINES.length, 5);
});

test('getBossTierStats at tier 0 matches the base dragon stats exactly', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 0);
  assert.deepEqual(stats, { hp: 110, attack: 34, defense: 12, speed: 11, xp: 150 });
});

test('getBossTierStats at tier 1 doubles hp/xp and raises attack/defense by ~25%', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 1);
  assert.deepEqual(stats, { hp: 220, attack: 43, defense: 15, speed: 11, xp: 300 });
});

test('getBossTierStats at tier 2 (max) compounds correctly', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 2);
  assert.deepEqual(stats, { hp: 440, attack: 53, defense: 19, speed: 11, xp: 600 });
});

test('pickBossReturnFlavor returns one of the known flavor lines by index', () => {
  assert.equal(pickBossReturnFlavor(() => 0), BOSS_TIER_FLAVOR_LINES[0]);
  assert.equal(pickBossReturnFlavor(() => 0.9999), BOSS_TIER_FLAVOR_LINES[4]);
});
