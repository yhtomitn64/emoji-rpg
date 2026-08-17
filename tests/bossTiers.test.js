import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BOSS_TIER, BOSS_TIER_FLAVOR_LINES, getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp, nextBossTierToAttempt, resolveBossTierAfterWin } from '../js/systems/bossTiers.js';
import { MONSTERS } from '../js/data/monsters.js';

test('constants match the design', () => {
  assert.equal(MAX_BOSS_TIER, 2);
  assert.equal(BOSS_TIER_FLAVOR_LINES.length, 5);
});

test('getBossTierStats at tier 0 matches the base dragon stats exactly', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 0);
  assert.deepEqual(stats, { hp: 150, attack: 34, defense: 12, speed: 11, xp: 200 });
});

test('getBossTierStats at tier 1 doubles hp/xp and raises attack/defense by ~25%', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 1);
  assert.deepEqual(stats, { hp: 300, attack: 43, defense: 15, speed: 11, xp: 400 });
});

test('getBossTierStats at tier 2 (max) compounds correctly', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 2);
  assert.deepEqual(stats, { hp: 600, attack: 53, defense: 19, speed: 11, xp: 800 });
});

test('pickBossReturnFlavor returns one of the known flavor lines by index', () => {
  assert.equal(pickBossReturnFlavor(() => 0), BOSS_TIER_FLAVOR_LINES[0]);
  assert.equal(pickBossReturnFlavor(() => 0.9999), BOSS_TIER_FLAVOR_LINES[4]);
});

test('shouldPromptForRematch is true only when defeated at least once and below the cap', () => {
  assert.equal(shouldPromptForRematch({ flags: { dungeonBossDefeated: false }, bossTier: 0 }), false);
  assert.equal(shouldPromptForRematch({ flags: { dungeonBossDefeated: true }, bossTier: 0 }), true);
  assert.equal(shouldPromptForRematch({ flags: { dungeonBossDefeated: true }, bossTier: 1 }), true);
  assert.equal(shouldPromptForRematch({ flags: { dungeonBossDefeated: true }, bossTier: 2 }), false);
});

test('resolveBattleXp uses the pending boss xp when set, otherwise falls back to the base monster xp', () => {
  assert.equal(resolveBattleXp(600, MONSTERS.boar), 600);
  assert.equal(resolveBattleXp(null, MONSTERS.boar), MONSTERS.boar.xp);
});

test('nextBossTierToAttempt is always exactly one tier above the current tier', () => {
  assert.equal(nextBossTierToAttempt(0), 1);
  assert.equal(nextBossTierToAttempt(1), 2);
});

test('resolveBossTierAfterWin advances the tier on a win, and never skips or regresses it', () => {
  // Normal re-fight at the current (already-cleared) tier: no change.
  assert.equal(resolveBossTierAfterWin(0, 0), 0);
  // Won an escalation attempt one tier above current: advance by exactly one.
  assert.equal(resolveBossTierAfterWin(0, 1), 1);
  assert.equal(resolveBossTierAfterWin(1, 2), 2);
  // Re-winning an already-cleared tier is idempotent, not a regression.
  assert.equal(resolveBossTierAfterWin(1, 1), 1);
  // Defensive: an attempted tier below current never regresses the cleared tier.
  assert.equal(resolveBossTierAfterWin(1, 0), 1);
});
