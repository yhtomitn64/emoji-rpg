import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';
import { TOOL_DUNGEON_ENTRANCES } from '../js/data/toolDungeons.js';
import { axeDungeonMap } from '../js/maps/toolDungeons/axeDungeon.js';
import { pickDungeonMap } from '../js/maps/toolDungeons/pickDungeon.js';
import { canoeDungeonMap } from '../js/maps/toolDungeons/canoeDungeon.js';
import { isWalkableAt } from '../js/systems/world.js';

const TOOL_DUNGEONS = {
  axe: axeDungeonMap,
  pick: pickDungeonMap,
  canoe: canoeDungeonMap,
};

const ITEM_ID_FOR_TOOL = { axe: 'axe', pick: 'miningPick', canoe: 'boat' };

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

test('every tool dungeon is well-formed with a walkable start position', () => {
  for (const map of Object.values(TOOL_DUNGEONS)) {
    assertValidMap(map);
  }
});

test('every walkable tile in every tool dungeon is reachable from startPosition', () => {
  for (const map of Object.values(TOOL_DUNGEONS)) {
    assertFullyReachable(map);
  }
});

test('every tool dungeon has exactly one exit tile and exactly one guardian tile', () => {
  for (const map of Object.values(TOOL_DUNGEONS)) {
    const chars = map.rows.join('');
    const tileKeys = [...chars].map((c) => map.legend[c]);
    assert.equal(tileKeys.filter((k) => k === 'exit').length, 1, `${map.id} must have exactly one exit tile`);
    assert.equal(tileKeys.filter((k) => k === 'guardian').length, 1, `${map.id} must have exactly one guardian tile`);
  }
});

test("every tool dungeon's startPosition is its exit tile", () => {
  for (const map of Object.values(TOOL_DUNGEONS)) {
    const { x, y } = map.startPosition;
    const tileKey = map.legend[map.rows[y][x]];
    assert.equal(tileKey, 'exit', `${map.id} startPosition must be the exit tile`);
  }
});

test('every tool dungeon references a real monster as its guardian, matching TOOL_DUNGEON_ENTRANCES', () => {
  for (const [toolId, map] of Object.entries(TOOL_DUNGEONS)) {
    assert.ok(MONSTERS[map.guardianMonsterId], `${map.id} guardianMonsterId '${map.guardianMonsterId}' is not a real monster`);
    assert.equal(map.id, TOOL_DUNGEON_ENTRANCES[toolId].mapId, `${map.id} id must match TOOL_DUNGEON_ENTRANCES.${toolId}.mapId`);
  }
});

test('every guardian monster guarantees exactly its own tool, skips the weak-mob check, and is not flagged as the dragon boss', () => {
  for (const [toolId, map] of Object.entries(TOOL_DUNGEONS)) {
    const guardian = MONSTERS[map.guardianMonsterId];
    assert.equal(guardian.forceFullBattle, true, `${guardian.id} must force a full battle so its guaranteed drop can never be skipped`);
    assert.notEqual(guardian.isBoss, true, `${guardian.id} must not be isBoss - that would falsely flag the dragon as defeated`);
    assert.deepEqual(guardian.dropTable, [{ itemId: ITEM_ID_FOR_TOOL[toolId], chance: 1 }]);
    assert.equal(ITEMS[guardian.dropTable[0].itemId].type, 'tool', `${guardian.id}'s drop must be a real tool item`);
  }
});

test('TOOL_DUNGEON_ENTRANCES positions are in-bounds and resolve to a walkable entrance tile kind', async () => {
  // js/screens/mapScreen.js's tileAt() unconditionally overrides this exact
  // cell with TILES[entry.tileKind] before ever reading the underlying
  // wilderness file (same mechanism as the sealed-edge override), so the
  // entrance is walkable in-game regardless of whatever terrain is painted
  // beneath it - only in-bounds placement and the tile kind's own
  // walkability actually matter.
  for (const [toolId, entry] of Object.entries(TOOL_DUNGEON_ENTRANCES)) {
    const wildernessMap = (await import(`../js/maps/wilderness/${entry.screenId}.js`))[`${entry.screenId}Map`];
    const height = wildernessMap.rows.length;
    const width = wildernessMap.rows[0].length;
    assert.ok(
      entry.x >= 0 && entry.x < width && entry.y >= 0 && entry.y < height,
      `TOOL_DUNGEON_ENTRANCES.${toolId} position (${entry.x}, ${entry.y}) is out of bounds on '${entry.screenId}' (${width}x${height})`
    );
    assert.ok(TILES[entry.tileKind].walkable, `TOOL_DUNGEON_ENTRANCES.${toolId}'s tileKind '${entry.tileKind}' must be walkable`);
  }
});
