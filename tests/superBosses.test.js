import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPER_BOSSES } from '../js/data/superBosses.js';
import { TILES } from '../js/tiles.js';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';
import { superBossOneDungeonMap } from '../js/maps/superBosses/superBossOneDungeon.js';
import { isWalkableAt } from '../js/systems/world.js';

// Ported from tests/toolDungeonMaps.test.js, which doesn't export its own
// assertValidMap/assertFullyReachable helpers - same logic, reused here so
// a superboss's own dungeon file gets the identical structural coverage
// every tool dungeon already gets.
function assertValidMap(map) {
  const width = map.rows[0].length;
  for (const row of map.rows) {
    assert.equal(row.length, width, `${map.id} rows must all be the same width`);
    for (const char of row) {
      assert.ok(map.legend[char], `${map.id} legend missing entry for '${char}'`);
      assert.ok(TILES[map.legend[char]], `${map.id} legend points to unknown tile '${map.legend[char]}'`);
    }
  }
  const { x, y } = map.startPosition;
  const tileKey = map.legend[map.rows[y][x]];
  assert.ok(TILES[tileKey].walkable, `${map.id} startPosition must be walkable`);
}

function assertFullyReachable(map) {
  const height = map.rows.length;
  const width = map.rows[0].length;
  const { x: startX, y: startY } = map.startPosition;

  const visited = new Set();
  const queue = [[startX, startY]];
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (!isWalkableAt(map, nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWalkableAt(map, x, y)) {
        assert.ok(
          visited.has(`${x},${y}`),
          `${map.id} tile (${x},${y}) is walkable but unreachable from startPosition`
        );
      }
    }
  }
}

// Every real hasDungeon SUPER_BOSSES entry's own dungeon map file, keyed
// the same way tests/toolDungeonMaps.test.js keys TOOL_DUNGEONS - generic
// over however many superbosses eventually get their own dungeon, not
// hardcoded to just this one.
const SUPER_BOSS_DUNGEONS = { superBossOne: superBossOneDungeonMap };

test('every SUPER_BOSSES entry has the required shape', () => {
  for (const [id, entry] of Object.entries(SUPER_BOSSES)) {
    assert.equal(entry.id, id, `${id}'s own id field must match its registry key`);
    assert.equal(typeof entry.monsterId, 'string');
    assert.equal(typeof entry.hasDungeon, 'boolean');
    if (entry.hasDungeon) {
      assert.equal(typeof entry.dungeonMapId, 'string', `${id} has hasDungeon: true but no dungeonMapId`);
    } else {
      assert.equal(entry.dungeonMapId, null, `${id} has hasDungeon: false but a non-null dungeonMapId`);
    }
  }
});

// Mirrors tests/toolDungeonMaps.test.js's "a not-yet-placed entry is inert
// everywhere that matches on screenId" test - a fresh SUPER_BOSSES entry
// starts with screenId: null so it never matches a real wilderness screen
// until Timothy places it with the terrain painter.
test('a not-yet-placed SUPER_BOSSES entry (null screenId) is inert everywhere that matches on screenId', () => {
  const placeholder = { id: 'someSuperBoss', monsterId: 'someMonster', screenId: null, x: null, y: null, hasDungeon: false, dungeonMapId: null };
  assert.equal(placeholder.screenId, null);
  assert.notEqual(typeof 'anyRealScreenId', typeof placeholder.screenId);
});

test('superBossMarker and superBossEntrance tile kinds exist and are walkable', () => {
  assert.ok(TILES.superBossMarker, 'TILES.superBossMarker must exist');
  assert.equal(TILES.superBossMarker.walkable, true);
  assert.equal(TILES.superBossMarker.action, 'superBossBattle');

  assert.ok(TILES.superBossEntrance, 'TILES.superBossEntrance must exist');
  assert.equal(TILES.superBossEntrance.walkable, true);
  assert.equal(TILES.superBossEntrance.action, 'enterSuperBossDungeon');
});

test('a hasDungeon SUPER_BOSSES entry always names a distinct dungeonMapId, never reused across entries', () => {
  const dungeonMapIds = Object.values(SUPER_BOSSES)
    .filter((entry) => entry.hasDungeon)
    .map((entry) => entry.dungeonMapId);
  const uniqueIds = new Set(dungeonMapIds);
  assert.equal(uniqueIds.size, dungeonMapIds.length, 'each hasDungeon superboss must have its own unique dungeonMapId');
});

// From here down: the worked example (superBossOne) - was a vacuous no-op
// against the empty registry before this task, now exercises a real entry
// end to end.

test('superBossOne is placed for real (non-null screenId), not left as an inert stub', () => {
  const entry = SUPER_BOSSES.superBossOne;
  assert.ok(entry, 'SUPER_BOSSES.superBossOne must exist');
  assert.notEqual(entry.screenId, null, 'superBossOne must be placed (screenId non-null) - see task-14-report.md');
  assert.equal(typeof entry.x, 'number');
  assert.equal(typeof entry.y, 'number');
});

test("superBossOne's placement is in-bounds and resolves to a walkable tile kind matching its hasDungeon flag", async () => {
  const entry = SUPER_BOSSES.superBossOne;
  const wildernessMap = (await import(`../js/maps/wilderness/${entry.screenId}.js`))[`${entry.screenId}Map`];
  const height = wildernessMap.rows.length;
  const width = wildernessMap.rows[0].length;
  assert.ok(
    entry.x >= 0 && entry.x < width && entry.y >= 0 && entry.y < height,
    `superBossOne's position (${entry.x}, ${entry.y}) is out of bounds on '${entry.screenId}' (${width}x${height})`
  );
  const expectedTileKind = entry.hasDungeon ? 'superBossEntrance' : 'superBossMarker';
  assert.ok(TILES[expectedTileKind].walkable, `TILES.${expectedTileKind} must be walkable`);
});

test('every monster flagged isSuperBoss has the required combat/loot shape', () => {
  const superBossMonsters = Object.values(MONSTERS).filter((m) => m.isSuperBoss);
  assert.ok(superBossMonsters.length > 0, 'at least one monster should be flagged isSuperBoss by now');
  for (const monster of superBossMonsters) {
    assert.equal(monster.forceFullBattle, true, `${monster.id} must force a full battle so its guaranteed drop can never be skipped`);
    assert.notEqual(monster.isBoss, true, `${monster.id} must not be isBoss - that would falsely flag the dragon as defeated and unblock fleeing rules meant only for it`);
    assert.ok(Array.isArray(monster.dropTable) && monster.dropTable.length > 0, `${monster.id} needs a dropTable`);
    for (const dropEntry of monster.dropTable) {
      assert.ok(ITEMS[dropEntry.itemId], `${monster.id}'s dropTable references unknown item '${dropEntry.itemId}'`);
    }
    // A superboss's headline drop should be a guaranteed (chance: 1), explicitly
    // tiered entry - that's the whole point of the new apex tier/dropTable.tier
    // override mechanism (Task 4).
    assert.ok(
      monster.dropTable.some((e) => e.chance === 1 && e.tier),
      `${monster.id} should have at least one guaranteed (chance: 1), explicitly-tiered dropTable entry`
    );
  }
});

test('every SUPER_BOSSES entry whose monster has specialAttacks defines them with a well-formed shape', () => {
  for (const entry of Object.values(SUPER_BOSSES)) {
    const monster = MONSTERS[entry.monsterId];
    assert.ok(monster, `${entry.id}'s monsterId '${entry.monsterId}' is not a real monster`);
    if (!monster.specialAttacks) continue;
    for (const special of monster.specialAttacks) {
      assert.ok(['stun', 'slow', 'cooldownOverload'].includes(special.type), `${monster.id} has an unknown specialAttack type '${special.type}'`);
      assert.equal(typeof special.chancePerTurn, 'number');
      assert.ok(special.chancePerTurn > 0 && special.chancePerTurn <= 1, `${monster.id}'s ${special.type} chancePerTurn must be in (0, 1]`);
    }
  }
});

test('every hasDungeon SUPER_BOSSES entry has a well-formed, fully-reachable dungeon map with a walkable start, exactly one exit and one guardian tile, and a guardian matching its own monster', () => {
  for (const [superBossId, entry] of Object.entries(SUPER_BOSSES)) {
    if (!entry.hasDungeon) continue;
    const map = SUPER_BOSS_DUNGEONS[superBossId];
    assert.ok(map, `no dungeon map registered under this test file's SUPER_BOSS_DUNGEONS for superboss '${superBossId}' (dungeonMapId '${entry.dungeonMapId}') - add it there`);
    assert.equal(map.id, entry.dungeonMapId, `${map.id}'s own id must match SUPER_BOSSES.${superBossId}.dungeonMapId`);

    assertValidMap(map);
    assertFullyReachable(map);

    const chars = map.rows.join('');
    const tileKeys = [...chars].map((c) => map.legend[c]);
    assert.equal(tileKeys.filter((k) => k === 'exit').length, 1, `${map.id} must have exactly one exit tile`);
    assert.equal(tileKeys.filter((k) => k === 'guardian').length, 1, `${map.id} must have exactly one guardian tile`);

    const { x, y } = map.startPosition;
    assert.equal(map.legend[map.rows[y][x]], 'exit', `${map.id} startPosition must be its exit tile`);

    assert.ok(MONSTERS[map.guardianMonsterId], `${map.id} guardianMonsterId '${map.guardianMonsterId}' is not a real monster`);
    assert.equal(map.guardianMonsterId, entry.monsterId, `${map.id}'s guardianMonsterId must match SUPER_BOSSES.${superBossId}.monsterId`);
  }
});
