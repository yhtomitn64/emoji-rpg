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
import { farNorthwestMap } from '../js/maps/wilderness/farNorthwest.js';
import { northNorthwestMap } from '../js/maps/wilderness/northNorthwest.js';
import { farNorthMap } from '../js/maps/wilderness/farNorth.js';
import { northNortheastMap } from '../js/maps/wilderness/northNortheast.js';
import { farNortheastMap } from '../js/maps/wilderness/farNortheast.js';
import { westNorthwestMap } from '../js/maps/wilderness/westNorthwest.js';
import { farWestMap } from '../js/maps/wilderness/farWest.js';
import { westSouthwestMap } from '../js/maps/wilderness/westSouthwest.js';
import { eastNortheastMap } from '../js/maps/wilderness/eastNortheast.js';
import { farEastMap } from '../js/maps/wilderness/farEast.js';
import { eastSoutheastMap } from '../js/maps/wilderness/eastSoutheast.js';
import { southSouthwestMap } from '../js/maps/wilderness/southSouthwest.js';
import { farSouthMap } from '../js/maps/wilderness/farSouth.js';
import { southSoutheastMap } from '../js/maps/wilderness/southSoutheast.js';
import { farSouthwestMap } from '../js/maps/wilderness/farSouthwest.js';
import { farSoutheastMap } from '../js/maps/wilderness/farSoutheast.js';
import { MONSTERS } from '../js/data/monsters.js';
import { FLAVOR_TEXT } from '../js/data/flavorText.js';
import { isWalkableAt, isValidSavedPosition } from '../js/systems/world.js';
import { buildWorldGrid, screenToGlobal, globalToScreen } from '../js/systems/worldGrid.js';

const WILDERNESS_WIDTH = 30;
const WILDERNESS_HEIGHT = 22;

const WILDERNESS = {
  center: centerMap, north: northMap, south: southMap, east: eastMap, west: westMap,
  northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap,
  farNorthwest: farNorthwestMap, northNorthwest: northNorthwestMap, farNorth: farNorthMap,
  northNortheast: northNortheastMap, farNortheast: farNortheastMap,
  westNorthwest: westNorthwestMap, farWest: farWestMap, westSouthwest: westSouthwestMap,
  eastNortheast: eastNortheastMap, farEast: farEastMap, eastSoutheast: eastSoutheastMap,
  southSouthwest: southSouthwestMap, farSouth: farSouthMap, southSoutheast: southSoutheastMap,
  farSouthwest: farSouthwestMap, farSoutheast: farSoutheastMap,
};

const ORIGINAL_NINE_SCREEN_IDS = [
  'center', 'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest',
];

// southeast is excluded here even though it's one of the original 9 - its old
// flavor text ("the dungeon can't be far") stopped being true once the 5x5
// expansion moved the dungeon 2 screens further out, and it's pending a
// rewrite (2026-08-24), same as the still-unwritten new screens below.
const SCREENS_REQUIRING_FLAVOR_TEXT = ORIGINAL_NINE_SCREEN_IDS.filter((id) => id !== 'southeast');

const DUNGEON_APPROACH_SCREEN_IDS = [
  'eastNortheast', 'northNortheast', 'westNorthwest', 'northNorthwest',
  'eastSoutheast', 'southSoutheast', 'westSouthwest', 'southSouthwest',
];

const FAR_CORNER_SCREEN_IDS = ['farNortheast', 'farNorthwest', 'farSoutheast', 'farSouthwest'];

// checkStartPosition defaults true (town/dungeon: startPosition is where
// every game/dungeon run actually begins, always load-bearing). Wilderness
// screens pass false: startPosition there is only the generic
// return-from-interior landing spot for whichever screen happens to host a
// dungeon/tool-dungeon entrance - it matters only for the ~4 screens that
// actually host one today, which the real entrance-chain check below
// verifies directly. The other 21 screens' unused landing point isn't
// something Timothy considers a real bug (see the "only care that the
// player can navigate, get the treasure/tools, and reach the dragon" scope
// he set 2026-08-24).
function assertValidMap(map, checkStartPosition = true) {
  const width = map.rows[0].length;
  for (const row of map.rows) {
    assert.equal(row.length, width, `${map.id} rows must all be the same width`);
    for (const char of row) {
      assert.ok(map.legend[char], `${map.id} legend missing entry for '${char}'`);
      assert.ok(TILES[map.legend[char]], `${map.id} legend points to unknown tile '${map.legend[char]}'`);
    }
  }
  if (!checkStartPosition) return;
  const { x, y } = map.startPosition;
  assert.ok(isValidSavedPosition(map, x, y), `${map.id} startPosition must be walkable or tool-gated, not a permanent wall`);
}

// Mirrors js/screens/mapScreen.js's isSealedWorldEdge: a true world-boundary
// cell (a side with no neighbor at all) always renders and behaves as
// mountainWall in the real game regardless of what's painted there.
// isValidSavedPosition alone doesn't know this - without this check, a
// boundary tile painted as e.g. grass or water reads as passable here even
// though it's a forced wall in-game, silently under-counting real
// unreachable regions whenever a "connection" only exists through the
// sealed edge.
function isTrueWorldBoundary(map, x, y) {
  const width = map.rows[0].length;
  const height = map.rows.length;
  if (y === 0 && !map.neighbors.north) return true;
  if (y === height - 1 && !map.neighbors.south) return true;
  if (x === 0 && !map.neighbors.west) return true;
  if (x === width - 1 && !map.neighbors.east) return true;
  return false;
}

// Tool-gated tiles (water/thicket/mountain with requiresTool) are treated as
// passable here, same as isValidSavedPosition: the wilderness is designed to
// be gradually unlocked by tools found in-world, so a lake or tree wall the
// player can't cross *yet* is intentional, not a broken map. This only
// flags tiles with genuinely no route in - enclosed by permanent obstacles
// (tree/mountainWall/water with no requiresTool, or the sealed world edge)
// even with every tool.
function isConnectivityPassable(map, x, y) {
  if (isTrueWorldBoundary(map, x, y)) return false;
  return isValidSavedPosition(map, x, y);
}

// Wilderness screens are not self-contained: a screen can legitimately be
// split by a mountain range or river into two halves that each only connect
// out through a *different* neighboring screen, never to each other
// locally - so checking each screen in isolation from its own generic
// center point produces massive false positives (an earlier version of this
// check flagged 13 of 25 screens, thousands of tiles). Any real reachability
// check has to walk the whole stitched 5x5 world the same way the real game
// does (js/systems/worldGrid.js - a landing tile is always a valid graph
// node even if it isn't itself "passable"). Shared by both the whole-world
// walk and the staged tool-unlock-order walk below.
const EDGE_DIRECTIONS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

function floodFillWholeWorld(wilderness, start, isPassable) {
  const grid = buildWorldGrid(wilderness);
  const tileKey = (id, x, y) => `${id}:${x},${y}`;
  const visited = new Set([tileKey(start.id, start.x, start.y)]);
  const queue = [start];

  while (queue.length > 0) {
    const { id, x, y } = queue.shift();
    const map = wilderness[id];
    const width = map.rows[0].length;
    const height = map.rows.length;
    for (const [dir, [dx, dy]] of Object.entries(EDGE_DIRECTIONS)) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        const neighborId = map.neighbors[dir];
        if (!neighborId) continue;
        const { gx, gy } = screenToGlobal(grid, id, x, y);
        const landing = globalToScreen(grid, id, gx + dx, gy + dy);
        assert.ok(landing, 'expected a valid landing screen when crossing a real neighbor link');
        const k = tileKey(landing.screenId, landing.localX, landing.localY);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ id: landing.screenId, x: landing.localX, y: landing.localY });
        continue;
      }
      if (!isPassable(map, nx, ny)) continue;
      const k = tileKey(id, nx, ny);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ id, x: nx, y: ny });
    }
  }
  return { visited, tileKey };
}

// The real bar (Timothy, 2026-08-24): "I only really care that the player
// can navigate the map, get all the treasure, get the tools and proceed to
// the dragon" - not that literally every grass tile in the world is
// reachable. This walks the actual TOOL_DUNGEON_ENTRANCES/
// DEFAULT_DUNGEON_ENTRANCE_POSITION data in tool-unlock order (axe -> pick
// -> canoe/boat -> dragon), unlocking each tool's gated terrain
// (TILES[kind].requiresTool) only after confirming that tool's own dungeon
// is reachable with whatever's already unlocked - catching a chicken-and-egg
// gate a single "reachable with any combination of tools" check would miss.
// Mirrors tools/terrain-painter/reachability.js's checkProgression, adapted
// for the real multi-screen world instead of the painter's flat canvas.
function assertRealEntranceChainReachable(wilderness, toolDungeonEntrances, dungeonEntrancePosition) {
  // js/screens/mapScreen.js's tileAt() always overrides these exact cells
  // with the (always-walkable) entrance tile before ever reading the
  // underlying wilderness file, same mechanism as the sealed-edge override
  // (see tests/toolDungeonMaps.test.js) - so an entrance sitting on painted
  // tree/water is still walkable in-game. Without this, farNorth (13,7)
  // (the real axe entrance, currently painted over with tree) reads as a
  // false negative here.
  const entranceKeys = new Set(
    [...Object.values(toolDungeonEntrances), dungeonEntrancePosition]
      .map((e) => `${e.screenId}:${e.x},${e.y}`)
  );

  function isPassableAtStage(map, x, y, unlockedTools) {
    if (entranceKeys.has(`${map.id}:${x},${y}`)) return true;
    if (isTrueWorldBoundary(map, x, y)) return false;
    const char = map.rows[y]?.[x];
    if (!char) return false;
    const tile = TILES[map.legend[char]];
    if (!tile) return false;
    if (tile.walkable) return true;
    return Boolean(tile.requiresTool && unlockedTools.has(tile.requiresTool));
  }

  const stages = [
    { label: 'axe dungeon', entry: toolDungeonEntrances.axe, grants: 'axe' },
    { label: 'pick dungeon', entry: toolDungeonEntrances.pick, grants: 'miningPick' },
    { label: 'canoe dungeon (boat)', entry: toolDungeonEntrances.canoe, grants: 'boat' },
    { label: 'dragon dungeon', entry: dungeonEntrancePosition, grants: null },
  ];

  const unlockedTools = new Set();
  const start = { id: 'center', ...wilderness.center.startPosition };
  let { visited } = floodFillWholeWorld(wilderness, start, (map, x, y) => isPassableAtStage(map, x, y, unlockedTools));

  for (const stage of stages) {
    assert.ok(stage.entry, `${stage.label}'s entrance position is not configured`);
    const key = `${stage.entry.screenId}:${stage.entry.x},${stage.entry.y}`;
    assert.ok(
      visited.has(key),
      `${stage.label} at ${stage.entry.screenId} (${stage.entry.x},${stage.entry.y}) is not reachable with tools unlocked so far (${[...unlockedTools].join(', ') || 'none'})`
    );
    if (stage.grants) {
      unlockedTools.add(stage.grants);
      ({ visited } = floodFillWholeWorld(wilderness, start, (map, x, y) => isPassableAtStage(map, x, y, unlockedTools)));
    }
  }
}

// Not "every column along the shared border is open": crossing a screen
// boundary now resolves through js/systems/worldGrid.js's globalToScreen
// (mapScreen.js's tryMove steps the player's GLOBAL position by one tile and
// resolves whichever screen/local-tile that lands on, unconditionally - no
// separate teleport function, no walkability check on the landing tile
// itself), and tryMove only ever validates the tile being moved *onto* next,
// never the one currently stood on - so landing on a single non-passable
// border tile isn't a softlock, it's cosmetic for one frame. A screen's border can
// legitimately funnel crossings through a narrow gap in trees/mountains
// (organic terrain, not a bug). What actually has to hold: for every pair
// of neighboring screens, at least one column/row exists where BOTH sides'
// border tiles are passable at the same time - a real, usable crossing
// point must exist somewhere along the shared edge.
function assertSharedCrossingExists(id, map, side, neighborId, neighborMap) {
  const width = map.rows[0].length;
  const height = map.rows.length;
  const neighborWidth = neighborMap.rows[0].length;
  const neighborHeight = neighborMap.rows.length;
  let found = false;
  if (side === 'north' || side === 'south') {
    const y = side === 'north' ? 0 : height - 1;
    const ny = side === 'north' ? neighborHeight - 1 : 0;
    for (let x = 0; x < width; x++) {
      if (isConnectivityPassable(map, x, y) && isConnectivityPassable(neighborMap, x, ny)) {
        found = true;
        break;
      }
    }
  } else {
    const x = side === 'west' ? 0 : width - 1;
    const nx = side === 'west' ? neighborWidth - 1 : 0;
    for (let y = 0; y < height; y++) {
      if (isConnectivityPassable(map, x, y) && isConnectivityPassable(neighborMap, nx, y)) {
        found = true;
        break;
      }
    }
  }
  assert.ok(found, `${id} <-> ${neighborId} (${side}) have no aligned open crossing point on their shared border`);
}

// No assertBorderBlocked: js/screens/mapScreen.js's isSealedWorldEdge (and
// the terrain painter's matching check, which blocks painting there at all)
// now force every true world-boundary cell to behave and render as
// mountainWall regardless of what's saved in the map file, so a screen's
// raw border content on a no-neighbor side no longer affects gameplay.

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

test('every wilderness screen is well-formed (legend/rows structure)', () => {
  for (const map of Object.values(WILDERNESS)) {
    assertValidMap(map, false);
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

test('the real axe -> pick -> canoe (boat) -> dragon entrance chain is reachable in tool-unlock order', async () => {
  const { TOOL_DUNGEON_ENTRANCES } = await import('../js/data/toolDungeons.js');
  const { DEFAULT_DUNGEON_ENTRANCE_POSITION } = await import('../js/state.js');
  assertRealEntranceChainReachable(WILDERNESS, TOOL_DUNGEON_ENTRANCES, DEFAULT_DUNGEON_ENTRANCE_POSITION);
});

test('every FLAVOR_TEXT key is a real wilderness screen or an explicitly allowed extra', () => {
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
});

test('every one of the original 9 wilderness screens has flavor text, except southeast which is pending a rewrite', () => {
  // The remaining new screens from the 5x5 map expansion (2026-08-23) deliberately
  // ship without flavor text - Timothy writes this game's narrative himself, at his
  // own pace, rather than it being drafted here.
  for (const id of SCREENS_REQUIRING_FLAVOR_TEXT) {
    assert.ok(FLAVOR_TEXT[id], `wilderness screen '${id}' is missing a FLAVOR_TEXT entry`);
  }
  assert.equal(FLAVOR_TEXT.southeast, undefined, 'southeast is pending a flavor text rewrite - it should have no entry yet');
});

test('the 8 dungeon-approach screens and 4 far-corner screens have flavor text (2026-08-24)', () => {
  for (const id of [...DUNGEON_APPROACH_SCREEN_IDS, ...FAR_CORNER_SCREEN_IDS]) {
    assert.ok(FLAVOR_TEXT[id], `wilderness screen '${id}' is missing a FLAVOR_TEXT entry`);
  }
});

test('every pair of neighboring wilderness screens shares at least one open crossing point on their common border', () => {
  const checkedPairs = new Set();
  for (const [id, map] of Object.entries(WILDERNESS)) {
    for (const side of ['north', 'south', 'east', 'west']) {
      const neighborId = map.neighbors[side];
      if (!neighborId) continue;
      const pairKey = [id, neighborId].sort().join('|');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);
      assertSharedCrossingExists(id, map, side, neighborId, WILDERNESS[neighborId]);
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

test('center screen start position (where exiting town lands you) is orthogonally adjacent to the town entrance, not diagonal', () => {
  const entranceChar = Object.entries(centerMap.legend).find(([, kind]) => kind === 'townEntrance')?.[0];
  assert.ok(entranceChar, 'center map legend must have a townEntrance character');
  let entranceX, entranceY;
  for (let y = 0; y < centerMap.rows.length; y++) {
    const x = centerMap.rows[y].indexOf(entranceChar);
    if (x >= 0) { entranceX = x; entranceY = y; }
  }
  const { x: startX, y: startY } = centerMap.startPosition;
  const dx = Math.abs(startX - entranceX);
  const dy = Math.abs(startY - entranceY);
  assert.equal(dx + dy, 1, `startPosition (${startX},${startY}) must be exactly one orthogonal step from the town entrance (${entranceX},${entranceY})`);
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

test('new roster monsters are wired into the right monsterTables', () => {
  const nearTownScreens = { east: eastMap, north: northMap, south: southMap, west: westMap };
  for (const [id, map] of Object.entries(nearTownScreens)) {
    assert.ok(map.monsterTable.includes('frog'), `${id} monsterTable should include frog`);
  }
  const farCornerScreens = { northeast: northeastMap, northwest: northwestMap, southeast: southeastMap, southwest: southwestMap };
  for (const [id, map] of Object.entries(farCornerScreens)) {
    assert.ok(map.monsterTable.includes('scorpion'), `${id} monsterTable should include scorpion`);
  }
  assert.ok(dungeonMap.monsterTable.includes('skeleton'), 'dungeon monsterTable should include skeleton');
});

test('all 16 outer-ring screens from the 5x5 expansion use the corner monster tier', () => {
  const outerRingIds = [
    'farNorthwest', 'northNorthwest', 'farNorth', 'northNortheast', 'farNortheast',
    'westNorthwest', 'farWest', 'westSouthwest', 'eastNortheast', 'farEast', 'eastSoutheast',
    'southSouthwest', 'farSouth', 'southSoutheast', 'farSouthwest', 'farSoutheast',
  ];
  for (const id of outerRingIds) {
    const map = WILDERNESS[id];
    assert.deepEqual(map.monsterTable, ['direWolf', 'spider', 'scorpion'], `${id} monsterTable should match the corner tier`);
    assert.equal(map.encounterChance, 0.15, `${id} encounterChance should be 0.15`);
  }
});
