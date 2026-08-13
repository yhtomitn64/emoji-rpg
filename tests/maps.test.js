import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import { townMap } from '../js/maps/townMap.js';
import { dungeonMap } from '../js/maps/dungeonMap.js';
import { centerMap } from '../js/maps/wilderness/center.js';
import { northMap } from '../js/maps/wilderness/north.js';
import { southMap } from '../js/maps/wilderness/south.js';
import { eastMap } from '../js/maps/wilderness/east.js';
import { westMap } from '../js/maps/wilderness/west.js';
import { northeastMap } from '../js/maps/wilderness/northeast.js';
import { northwestMap } from '../js/maps/wilderness/northwest.js';
import { southeastMap } from '../js/maps/wilderness/southeast.js';
import { southwestMap } from '../js/maps/wilderness/southwest.js';
import { MONSTERS } from '../js/data/monsters.js';

const WILDERNESS = {
  center: centerMap, north: northMap, south: southMap, east: eastMap, west: westMap,
  northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap,
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

function assertBorderWalkable(map, side) {
  const height = map.rows.length;
  const width = map.rows[0].length;
  if (side === 'north' || side === 'south') {
    const y = side === 'north' ? 0 : height - 1;
    for (let x = 1; x < width - 1; x++) {
      const tileKey = map.legend[map.rows[y][x]];
      assert.ok(TILES[tileKey].walkable, `${map.id} ${side} border must be walkable at x=${x}`);
    }
  } else {
    const x = side === 'west' ? 0 : width - 1;
    for (let y = 1; y < height - 1; y++) {
      const tileKey = map.legend[map.rows[y][x]];
      assert.ok(TILES[tileKey].walkable, `${map.id} ${side} border must be walkable at y=${y}`);
    }
  }
}

test('town map is well-formed and includes shop, smith, and exit tiles', () => {
  assertValidMap(townMap);
  const chars = townMap.rows.join('');
  const tileKeys = [...chars].map((c) => townMap.legend[c]);
  assert.ok(tileKeys.includes('shop'));
  assert.ok(tileKeys.includes('smith'));
  assert.ok(tileKeys.includes('exit'));
});

test('dungeon map is well-formed, includes a boss tile, and references a real boss monster', () => {
  assertValidMap(dungeonMap);
  const chars = dungeonMap.rows.join('');
  const tileKeys = [...chars].map((c) => dungeonMap.legend[c]);
  assert.ok(tileKeys.includes('boss'));
  assert.ok(MONSTERS[dungeonMap.bossMonsterId]);
});

test('every wilderness screen is well-formed with a walkable start position', () => {
  for (const map of Object.values(WILDERNESS)) {
    assertValidMap(map);
  }
});

test('every wilderness screen border is walkable exactly where a neighbor exists', () => {
  for (const map of Object.values(WILDERNESS)) {
    for (const side of ['north', 'south', 'east', 'west']) {
      if (map.neighbors[side]) {
        assertBorderWalkable(map, side);
      }
    }
  }
});

test('wilderness screen neighbor links are symmetric', () => {
  const opposite = { north: 'south', south: 'north', east: 'west', west: 'east' };
  for (const [id, map] of Object.entries(WILDERNESS)) {
    for (const side of ['north', 'south', 'east', 'west']) {
      const neighborId = map.neighbors[side];
      if (!neighborId) continue;
      const neighborMap = WILDERNESS[neighborId];
      assert.ok(neighborMap, `${id}'s ${side} neighbor '${neighborId}' must be a real screen`);
      assert.equal(
        neighborMap.neighbors[opposite[side]],
        id,
        `${neighborId} must link back to ${id} via ${opposite[side]}`
      );
    }
  }
});

test('center screen has the town entrance and southeast screen has the dungeon entrance', () => {
  const centerTileKeys = [...centerMap.rows.join('')].map((c) => centerMap.legend[c]);
  assert.ok(centerTileKeys.includes('townEntrance'));
  const southeastTileKeys = [...southeastMap.rows.join('')].map((c) => southeastMap.legend[c]);
  assert.ok(southeastTileKeys.includes('dungeonEntrance'));
});
