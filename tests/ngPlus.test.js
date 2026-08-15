import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_NG_PLUS_CYCLE,
  canStartNgPlus,
  getNgPlusCombatOverrides,
  getNgPlusRewardMultiplier,
  scaleDropTable,
  resetWorldForNgPlus,
} from '../js/systems/ngPlus.js';
import { MONSTERS } from '../js/data/monsters.js';
import { createNewGame } from '../js/state.js';

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test('MAX_NG_PLUS_CYCLE is 2', () => {
  assert.equal(MAX_NG_PLUS_CYCLE, 2);
});

test('getNgPlusCombatOverrides at cycle 0 matches the base monster exactly', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 0);
  assert.deepEqual(stats, { hp: 110, attack: 34, defense: 12, speed: 11 });
});

test('getNgPlusCombatOverrides at cycle 1 doubles hp and raises attack/defense ~25%', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 1);
  assert.deepEqual(stats, { hp: 220, attack: 43, defense: 15, speed: 11 });
});

test('getNgPlusCombatOverrides at cycle 2 (max) compounds correctly', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 2);
  assert.deepEqual(stats, { hp: 440, attack: 53, defense: 19, speed: 11 });
});

test('getNgPlusRewardMultiplier compounds 1.5x per cycle', () => {
  assert.deepEqual(getNgPlusRewardMultiplier(0), { gold: 1, xp: 1 });
  const cycle1 = getNgPlusRewardMultiplier(1);
  assertClose(cycle1.gold, 1.5);
  assertClose(cycle1.xp, 1.5);
  const cycle2 = getNgPlusRewardMultiplier(2);
  assertClose(cycle2.gold, 2.25);
  assertClose(cycle2.xp, 2.25);
});

test('scaleDropTable at cycle 0 leaves chances unchanged', () => {
  const scaled = scaleDropTable(MONSTERS.dragon.dropTable, 0);
  assert.deepEqual(scaled.map((e) => e.chance), [0.6, 0.4]);
});

test('scaleDropTable at cycle 1 scales chances up without hitting the cap', () => {
  const scaled = scaleDropTable(MONSTERS.dragon.dropTable, 1);
  assertClose(scaled[0].chance, 0.9);
  assertClose(scaled[1].chance, 0.6);
});

test('scaleDropTable at cycle 2 caps every entry at 0.9', () => {
  const scaled = scaleDropTable(MONSTERS.dragon.dropTable, 2);
  assert.equal(scaled[0].chance, 0.9);
  assert.equal(scaled[1].chance, 0.9);
});

test('canStartNgPlus requires the boss defeated at least once and below the cap', () => {
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: false }, ngPlusCycle: 0 }), false);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 0 }), true);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 1 }), true);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 2 }), false);
});

test('resetWorldForNgPlus preserves player power and resets world state', () => {
  const state = createNewGame();
  state.player.level = 12;
  state.player.gold = 500;
  state.equipment.weapon = 'ironSword';
  state.upgrades.ironSword = 2;
  state.inventory = [{ itemId: 'potion', quantity: 5 }];
  state.flags.dungeonBossDefeated = true;
  state.visited = { center: { '1,1': true } };
  state.seenScreens = { center: true };
  state.caches = { center: { '2,2': true } };
  state.miniDungeons = { center: { '3,3': { variantId: 'miniDungeonA', treasureTaken: false } } };
  state.activeMiniDungeon = { screenId: 'center', x: 3, y: 3 };
  state.bossTier = 2;
  state.map = 'northeast';
  state.position = { x: 5, y: 5 };
  state.ngPlusCycle = 0;

  const reset = resetWorldForNgPlus(state);

  assert.equal(reset.player.level, 12);
  assert.equal(reset.player.gold, 500);
  assert.equal(reset.equipment.weapon, 'ironSword');
  assert.equal(reset.upgrades.ironSword, 2);
  assert.deepEqual(reset.inventory, [{ itemId: 'potion', quantity: 5 }]);

  assert.equal(reset.flags.dungeonBossDefeated, false);
  assert.deepEqual(reset.visited, {});
  assert.deepEqual(reset.seenScreens, {});
  assert.deepEqual(reset.caches, {});
  assert.deepEqual(reset.miniDungeons, {});
  assert.equal(reset.activeMiniDungeon, null);
  assert.equal(reset.bossTier, 0);
  assert.equal(reset.map, 'center');
  assert.equal(reset.position, null);
  assert.equal(reset.ngPlusCycle, 1);
});

test('resetWorldForNgPlus caps ngPlusCycle at MAX_NG_PLUS_CYCLE', () => {
  const state = createNewGame();
  state.flags.dungeonBossDefeated = true;
  state.ngPlusCycle = 2;
  const reset = resetWorldForNgPlus(state);
  assert.equal(reset.ngPlusCycle, 2);
});
