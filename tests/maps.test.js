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
import { FLAVOR_TEXT } from '../js/data/flavorText.js';
import { isWalkableAt } from '../js/systems/world.js';

const WILDERNESS_WIDTH = 30;
const WILDERNESS_HEIGHT = 22;

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

test('town map is well-formed and includes shop, smith, quest board, and exit tiles', () => {
  assertValidMap(townMap);
  const chars = townMap.rows.join('');
  const tileKeys = [...chars].map((c) => townMap.legend[c]);
  assert.ok(tileKeys.includes('shop'));
  assert.ok(tileKeys.includes('smith'));
  assert.ok(tileKeys.includes('questBoard'));
  assert.ok(tileKeys.includes('exit'));
});

test('dungeon map is well-formed, includes a boss tile, and references a real boss monster', () => {
  assertValidMap(dungeonMap);
  const chars = dungeonMap.rows.join('');
  const tileKeys = [...chars].map((c) => dungeonMap.legend[c]);
  assert.ok(tileKeys.includes('boss'));
  assert.ok(MONSTERS[dungeonMap.bossMonsterId]);
});

test('dungeon map has an axe-gated thicket shortcut connecting the interior maze to the boss corridor', () => {
  const tileKeys = [...dungeonMap.rows.join('')].map((c) => dungeonMap.legend[c]);
  assert.ok(tileKeys.includes('thicket'), 'dungeon must have a thicket gate');
  assert.equal(TILES.thicket.requiresTool, 'axe');
});

test('every wilderness screen is well-formed with a walkable start position', () => {
  for (const map of Object.values(WILDERNESS)) {
    assertValidMap(map);
  }
});

test('every wilderness screen is exactly 30x22', () => {
  for (const map of Object.values(WILDERNESS)) {
    assert.equal(map.rows.length, WILDERNESS_HEIGHT, `${map.id} must have ${WILDERNESS_HEIGHT} rows`);
    for (const row of map.rows) {
      assert.equal(row.length, WILDERNESS_WIDTH, `${map.id} rows must be ${WILDERNESS_WIDTH} characters wide`);
    }
  }
});

test('every walkable tile on every wilderness screen is reachable from startPosition', () => {
  for (const map of Object.values(WILDERNESS)) {
    assertFullyReachable(map);
  }
});

test('every FLAVOR_TEXT key is a real wilderness screen or an explicitly allowed extra, and every wilderness screen has flavor text', () => {
  const screenIds = Object.keys(WILDERNESS);
  // 'town' is a deliberate addition (a first-visit nudge to buy armor before
  // heading out, added 2026-08-17) - not a wilderness screen, but a real map id.
  const allowedExtraKeys = ['town'];
  for (const key of Object.keys(FLAVOR_TEXT)) {
    assert.ok(
      screenIds.includes(key) || allowedExtraKeys.includes(key),
      `FLAVOR_TEXT key '${key}' does not match a real wilderness screen id or an allowed extra`
    );
  }
  for (const id of screenIds) {
    assert.ok(FLAVOR_TEXT[id], `wilderness screen '${id}' is missing a FLAVOR_TEXT entry`);
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

test('every map has a valid cacheChance, and town has caches disabled', () => {
  const allMaps = { ...WILDERNESS, town: townMap, dungeon: dungeonMap };
  for (const [id, map] of Object.entries(allMaps)) {
    assert.equal(typeof map.cacheChance, 'number', `${id} cacheChance must be a number`);
    assert.ok(map.cacheChance >= 0 && map.cacheChance <= 1, `${id} cacheChance must be between 0 and 1`);
  }
  assert.equal(townMap.cacheChance, 0, 'town must have caches disabled');
  assert.equal(dungeonMap.cacheChance, 0.04, 'dungeon cacheChance must be 0.04');
  for (const [id, map] of Object.entries(WILDERNESS)) {
    assert.equal(map.cacheChance, 0.03, `${id} cacheChance must be 0.03`);
  }
});

test('every wilderness screen has the correct miniDungeonChance, town and dungeon do not have the field', () => {
  for (const [id, map] of Object.entries(WILDERNESS)) {
    const expected = id === 'center' ? 0 : 0.005;
    assert.equal(map.miniDungeonChance, expected, `${id} miniDungeonChance must be ${expected}`);
  }
  assert.equal(townMap.miniDungeonChance, undefined, 'town must not have a miniDungeonChance field');
  assert.equal(dungeonMap.miniDungeonChance, undefined, 'dungeon must not have a miniDungeonChance field');
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

test('center screen has the town entrance', () => {
  const centerTileKeys = [...centerMap.rows.join('')].map((c) => centerMap.legend[c]);
  assert.ok(centerTileKeys.includes('townEntrance'));
});

test('southeast screen has no static dungeon entrance tile — the entrance is a per-save override now', () => {
  assert.ok(!Object.values(southeastMap.legend).includes('dungeonEntrance'));
  assert.ok(!southeastMap.rows.join('').includes('D'));
});

test('tool-gated tiles appear on the correct screens with the correct tool requirement and reward flag', () => {
  const eastTileKeys = [...eastMap.rows.join('')].map((c) => eastMap.legend[c]);
  assert.ok(eastTileKeys.includes('mountain'), 'east must have a mountain gate');
  assert.equal(TILES.mountain.requiresTool, 'miningPick');
  assert.equal(TILES.mountain.hasReward, undefined);

  const southwestTileKeys = [...southwestMap.rows.join('')].map((c) => southwestMap.legend[c]);
  assert.ok(southwestTileKeys.includes('thicketCache'), 'southwest must have a thicketCache gate');
  assert.equal(TILES.thicketCache.requiresTool, 'axe');
  assert.equal(TILES.thicketCache.hasReward, true);

  const northwestTileKeys = [...northwestMap.rows.join('')].map((c) => northwestMap.legend[c]);
  assert.ok(northwestTileKeys.includes('mountainCache'), 'northwest must have a mountainCache gate');
  assert.equal(TILES.mountainCache.requiresTool, 'miningPick');
  assert.equal(TILES.mountainCache.hasReward, true);

  const northTileKeys = [...northMap.rows.join('')].map((c) => northMap.legend[c]);
  assert.ok(northTileKeys.includes('thicketCache'), 'north must have a thicketCache gate');
});
