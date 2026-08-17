import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { miniDungeonVariantA } from '../js/maps/miniDungeons/variantA.js';
import { miniDungeonVariantB } from '../js/maps/miniDungeons/variantB.js';
import { miniDungeonVariantC } from '../js/maps/miniDungeons/variantC.js';
import { miniDungeonVariantD } from '../js/maps/miniDungeons/variantD.js';
import { miniDungeonVariantE } from '../js/maps/miniDungeons/variantE.js';
import { isWalkableAt } from '../js/systems/world.js';
import { MINI_DUNGEON_VARIANT_IDS } from '../js/systems/miniDungeons.js';

const VARIANTS = {
  miniDungeonA: miniDungeonVariantA,
  miniDungeonB: miniDungeonVariantB,
  miniDungeonC: miniDungeonVariantC,
  miniDungeonD: miniDungeonVariantD,
  miniDungeonE: miniDungeonVariantE,
};

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

test('every mini-dungeon variant is registered and matches MINI_DUNGEON_VARIANT_IDS', () => {
  assert.deepEqual(Object.keys(VARIANTS).sort(), [...MINI_DUNGEON_VARIANT_IDS].sort());
  for (const id of MINI_DUNGEON_VARIANT_IDS) {
    assert.equal(VARIANTS[id].id, id);
  }
});

test('every mini-dungeon variant is well-formed with a walkable start position', () => {
  for (const map of Object.values(VARIANTS)) {
    assertValidMap(map);
  }
});

test('every walkable tile in every mini-dungeon variant is reachable from startPosition', () => {
  for (const map of Object.values(VARIANTS)) {
    assertFullyReachable(map);
  }
});

test('every mini-dungeon variant has exactly one entrance/exit tile and exactly one treasure tile', () => {
  for (const map of Object.values(VARIANTS)) {
    const chars = map.rows.join('');
    const tileKeys = [...chars].map((c) => map.legend[c]);
    const entranceCount = tileKeys.filter((k) => k === 'miniDungeonEntrance').length;
    const treasureCount = tileKeys.filter((k) => k === 'miniDungeonTreasure').length;
    assert.equal(entranceCount, 1, `${map.id} must have exactly one entrance/exit tile`);
    assert.equal(treasureCount, 1, `${map.id} must have exactly one treasure tile`);
  }
});

test("every mini-dungeon variant's startPosition is its entrance/exit tile", () => {
  for (const map of Object.values(VARIANTS)) {
    const { x, y } = map.startPosition;
    const tileKey = map.legend[map.rows[y][x]];
    assert.equal(tileKey, 'miniDungeonEntrance', `${map.id} startPosition must be the entrance/exit tile`);
  }
});

test('every mini-dungeon variant uses the orc/wraith monster table at 0.2 encounter chance', () => {
  for (const map of Object.values(VARIANTS)) {
    assert.deepEqual(map.monsterTable, ['orc', 'wraith']);
    assert.equal(map.encounterChance, 0.2);
  }
});
