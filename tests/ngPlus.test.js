import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canStartNgPlus,
  getNgPlusCombatOverrides,
  getNgPlusRewardMultiplier,
  scaleDropTable,
  resetWorldForNgPlus,
  migrateNgPlusToolCarryover,
} from '../js/systems/ngPlus.js';
import { MONSTERS } from '../js/data/monsters.js';
import { createNewGame } from '../js/state.js';

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test('getNgPlusCombatOverrides at cycle 0 matches the base monster exactly', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 0);
  assert.deepEqual(stats, { hp: 600, attack: 58, defense: 22, speed: 13 });
});

test('getNgPlusCombatOverrides at cycle 1 doubles hp and raises attack/defense ~25%', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 1);
  assert.deepEqual(stats, { hp: 1200, attack: 73, defense: 28, speed: 13 });
});

test('getNgPlusCombatOverrides at cycle 2 compounds correctly', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 2);
  assert.deepEqual(stats, { hp: 2400, attack: 91, defense: 34, speed: 13 });
});

test('getNgPlusCombatOverrides keeps compounding with no ceiling past cycle 2', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 5);
  assert.deepEqual(stats, { hp: 19200, attack: 177, defense: 67, speed: 13 });
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

test('scaleDropTable at cycle 1 and 2 leaves a table that already sums to 1.0 unchanged (no headroom to improve)', () => {
  const cycle1 = scaleDropTable(MONSTERS.dragon.dropTable, 1);
  assertClose(cycle1[0].chance, 0.6);
  assertClose(cycle1[1].chance, 0.4);
  const cycle2 = scaleDropTable(MONSTERS.dragon.dropTable, 2);
  assertClose(cycle2[0].chance, 0.6);
  assertClose(cycle2[1].chance, 0.4);
});

test('scaleDropTable scales up a table with headroom (sum under 1) without needing to normalize', () => {
  const scaled = scaleDropTable(MONSTERS.goblin.dropTable, 1);
  assertClose(scaled[0].chance, 0.225);
  assertClose(scaled[1].chance, 0.3);
});

// Tools only ever appear as their own guardian's guaranteed (chance: 1)
// drop now (see js/data/monsters.js - the 2026-08-28 fix removed the stray
// chance<1 tool drops that used to sit on orc/wraith), so no real monster's
// dropTable mixes a tool entry with other chance-based entries any more.
// scaleDropTable's tool-exclusion behavior still needs covering - a
// synthetic table exercises it directly instead of relying on production
// data happening to have this shape.
test('scaleDropTable leaves a tool entry untouched and excludes it from the normalization sum', () => {
  // At cycle 2 (1.5^2 = 2.25), naive scaling would total 0.55 * 2.25 = 1.2375 and trigger
  // normalization, cutting orcTusk's chance. With the tool entry excluded from scaling and
  // from the normalization sum, orcTusk alone (0.3 * 2.25 = 0.675) never exceeds 1.
  const table = [{ itemId: 'orcTusk', chance: 0.3 }, { itemId: 'miningPick', chance: 0.25 }];
  const scaled = scaleDropTable(table, 2);
  const tuskEntry = scaled.find((e) => e.itemId === 'orcTusk');
  const pickEntry = scaled.find((e) => e.itemId === 'miningPick');
  assert.equal(pickEntry.chance, 0.25);
  assertClose(tuskEntry.chance, 0.675);
});

test('scaleDropTable preserves entry order and does not mutate the original table', () => {
  const original = [{ itemId: 'orcTusk', chance: 0.3 }, { itemId: 'miningPick', chance: 0.25 }, { itemId: 'potion', chance: 0.1 }];
  const table = original.map((e) => ({ ...e }));
  const scaled = scaleDropTable(table, 2);
  assert.deepEqual(scaled.map((e) => e.itemId), ['orcTusk', 'miningPick', 'potion']);
  assert.deepEqual(table, original);
});

test('canStartNgPlus requires the boss defeated at least once, with no cycle ceiling', () => {
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: false }, ngPlusCycle: 0 }), false);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 0 }), true);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 1 }), true);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 2 }), true);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 50 }), true);
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
  state.gateRewards = { center: { '4,4': true } };
  state.miniDungeons = { center: { '3,3': { variantId: 'miniDungeonA', treasureTaken: false } } };
  state.activeMiniDungeon = { screenId: 'center', x: 3, y: 3 };
  state.bossTier = 2;
  state.map = 'northeast';
  state.position = { x: 5, y: 5 };
  state.ngPlusCycle = 0;
  state.lossStreak = 5;
  state.clearedGates = { center: { '1,1': true } };

  const reset = resetWorldForNgPlus(state);

  assert.equal(reset.player.level, 12);
  assert.equal(reset.player.gold, 500);
  assert.equal(reset.equipment.weapon, 'ironSword');
  assert.equal(reset.upgrades.ironSword, 2);
  assert.deepEqual(reset.inventory, [{ itemId: 'potion', quantity: 5 }]);

  assert.equal(reset.flags.dungeonBossDefeated, false);
  // Trails are deliberately kept across NG+ cycles - see resetWorldForNgPlus.
  assert.deepEqual(reset.visited, { center: { '1,1': true } });
  assert.deepEqual(reset.seenScreens, {});
  assert.deepEqual(reset.caches, {});
  assert.deepEqual(reset.gateRewards, {});
  assert.deepEqual(reset.miniDungeons, {});
  assert.equal(reset.activeMiniDungeon, null);
  assert.equal(reset.bossTier, 0);
  assert.equal(reset.map, 'center');
  assert.equal(reset.position, null);
  assert.equal(reset.ngPlusCycle, 1);
  assert.equal(reset.lossStreak, 0);
  assert.deepEqual(reset.clearedGates, {});
});

test('resetWorldForNgPlus resets zone1Steps to 0', () => {
  const state = createNewGame();
  state.zone1Steps = 1234;
  const reset = resetWorldForNgPlus(state);
  assert.equal(reset.zone1Steps, 0);
});

// Raised 2026-08-29: "NG+ should reset the tools you have otherwise you can
// go straight to dragon." resetWorldForNgPlus never touched state.inventory
// or state.clearedGates before this fix, so a player who already owned
// every tool and had already cleared every tool gate kept both across an
// NG+ reset.
test('resetWorldForNgPlus strips tool items from inventory but keeps everything else', () => {
  const state = createNewGame();
  state.flags.dungeonBossDefeated = true;
  state.inventory = [
    { itemId: 'axe', quantity: 1 },
    { itemId: 'miningPick', quantity: 1 },
    { itemId: 'boat', quantity: 1 },
    { itemId: 'potion', quantity: 3 },
    { itemId: 'ironSword', quantity: 1 },
  ];
  const reset = resetWorldForNgPlus(state);
  assert.deepEqual(reset.inventory, [
    { itemId: 'potion', quantity: 3 },
    { itemId: 'ironSword', quantity: 1 },
  ]);
});

test('resetWorldForNgPlus resets clearedGates to reproduce a brand-new save\'s reachability graph', () => {
  const state = createNewGame();
  state.flags.dungeonBossDefeated = true;
  state.clearedGates = { center: { '1,1': true }, north: { '2,2': true } };
  const reset = resetWorldForNgPlus(state);
  assert.deepEqual(reset.clearedGates, {});
});

test('migrateNgPlusToolCarryover strips carried-over tools once for a save already mid-NG+-cycle', () => {
  const state = createNewGame();
  state.ngPlusCycle = 1;
  state.inventory = [{ itemId: 'axe', quantity: 1 }, { itemId: 'potion', quantity: 2 }];

  const migrated = migrateNgPlusToolCarryover(state);
  assert.deepEqual(migrated.inventory, [{ itemId: 'potion', quantity: 2 }]);
  assert.equal(migrated.ngPlusToolsMigrated, true);
});

test('migrateNgPlusToolCarryover is a no-op for a save that has never done NG+', () => {
  const state = createNewGame();
  state.ngPlusCycle = 0;
  state.inventory = [{ itemId: 'axe', quantity: 1 }];
  const migrated = migrateNgPlusToolCarryover(state);
  assert.deepEqual(migrated.inventory, [{ itemId: 'axe', quantity: 1 }]);
  assert.equal(migrated.ngPlusToolsMigrated, true);
});

test('migrateNgPlusToolCarryover only strips tools once - a legitimately re-earned tool survives a later load', () => {
  const state = createNewGame();
  state.ngPlusCycle = 1;
  state.inventory = [{ itemId: 'axe', quantity: 1 }];

  const firstLoad = migrateNgPlusToolCarryover(state);
  assert.deepEqual(firstLoad.inventory, []);

  // Player re-earns the axe post-migration, then the game reloads again.
  firstLoad.inventory = [{ itemId: 'axe', quantity: 1 }];
  const secondLoad = migrateNgPlusToolCarryover(firstLoad);
  assert.deepEqual(secondLoad.inventory, [{ itemId: 'axe', quantity: 1 }]);
});

test('resetWorldForNgPlus keeps worn-path trail data across cycles, unlike other world-progress fields', () => {
  const state = createNewGame();
  state.flags.dungeonBossDefeated = true;
  state.visited = { center: { '1,1': true }, north: { '3,3': true } };
  const reset = resetWorldForNgPlus(state);
  assert.deepEqual(reset.visited, state.visited);
});

test('resetWorldForNgPlus keeps incrementing ngPlusCycle with no ceiling', () => {
  const state = createNewGame();
  state.flags.dungeonBossDefeated = true;
  state.ngPlusCycle = 2;
  const reset = resetWorldForNgPlus(state);
  assert.equal(reset.ngPlusCycle, 3);

  const furtherState = { ...state, ngPlusCycle: 50 };
  assert.equal(resetWorldForNgPlus(furtherState).ngPlusCycle, 51);
});
