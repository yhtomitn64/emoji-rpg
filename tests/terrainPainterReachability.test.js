import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_UNLOCK_KINDS,
  floodFillReachable,
  computeFrontier,
  checkProgression,
} from '../tools/terrain-painter/reachability.js';

const TOOLLESS_KINDS = new Set(['grass', 'townEntrance']);

// Builds an isPassable(x, y, unlockedKinds) callback over a plain 2D array
// of kind strings, matching what painter.js's cellPassable does for the
// real grid (minus entrance-marker/sealed-edge overrides, which are
// painter-specific plumbing, not part of the staged algorithm itself).
function isPassableOver(kindGrid) {
  return (x, y, unlockedKinds) => unlockedKinds.has(kindGrid[y][x]);
}

function dims(kindGrid) {
  return { width: kindGrid[0].length, height: kindGrid.length };
}

function fill(width, height, kind) {
  return Array.from({ length: height }, () => new Array(width).fill(kind));
}

function entrancesFor(positions) {
  // positions: { axe, pick, canoe, dragon } each {x,y}|null
  return [
    { id: 'axe', label: 'axe dungeon', pos: positions.axe, unlocks: TOOL_UNLOCK_KINDS.axe },
    { id: 'pick', label: 'pick dungeon', pos: positions.pick, unlocks: TOOL_UNLOCK_KINDS.pick },
    { id: 'canoe', label: 'canoe dungeon (boat)', pos: positions.canoe, unlocks: TOOL_UNLOCK_KINDS.canoe },
    { id: null, label: 'dragon dungeon', pos: positions.dragon, unlocks: [] },
  ];
}

test('floodFillReachable stays within bounds and only expands into passable tiles', () => {
  const g = fill(5, 5, 'tree');
  g[2][1] = 'grass'; g[2][2] = 'grass'; g[2][3] = 'grass';
  const isPassable = (x, y) => TOOLLESS_KINDS.has(g[y][x]);
  const reached = floodFillReachable(5, 5, { x: 1, y: 2 }, isPassable);
  assert.deepEqual([...reached].sort(), ['1,2', '2,2', '3,2'].sort());
});

test('computeFrontier finds only the blocked tiles directly adjacent to the reached region', () => {
  const g = fill(5, 5, 'tree');
  g[2][2] = 'grass';
  const isPassable = (x, y) => TOOLLESS_KINDS.has(g[y][x]);
  const reached = floodFillReachable(5, 5, { x: 2, y: 2 }, isPassable);
  const frontier = computeFrontier(5, 5, reached, isPassable);
  assert.deepEqual([...frontier].sort(), ['1,2', '3,2', '2,1', '2,3'].sort());
});

test('checkProgression: fully open map with no gates at all is ok', () => {
  const g = fill(10, 10, 'grass');
  const positions = { axe: { x: 2, y: 2 }, pick: { x: 4, y: 4 }, canoe: { x: 6, y: 6 }, dragon: { x: 8, y: 8 } };
  const result = checkProgression({
    width: 10, height: 10, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
    toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(positions),
  });
  assert.equal(result.ok, true);
  assert.equal(result.stageIndex, null);
  assert.equal(result.frontier.size, 0);
});

test('checkProgression: axe dungeon sealed inside permanent tree walls fails at stage 0, even with every tool', () => {
  const g = fill(10, 10, 'grass');
  // 3x3 tree box around (5,5), fully enclosing it - tree never unlocks.
  for (let y = 4; y <= 6; y++) {
    for (let x = 4; x <= 6; x++) g[y][x] = 'tree';
  }
  g[5][5] = 'grass'; // the axe entrance itself, but walled in on all 4 sides
  const positions = { axe: { x: 5, y: 5 }, pick: { x: 1, y: 1 }, canoe: { x: 2, y: 1 }, dragon: { x: 3, y: 1 } };
  const result = checkProgression({
    width: 10, height: 10, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
    toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(positions),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stageIndex, 0);
  assert.equal(result.stageId, 'axe');
  assert.ok(result.frontier.size > 0, 'expected a non-empty frontier marking the blocked boundary');
  assert.ok(!result.frontier.has('5,5'), 'the unreached target itself is not part of the frontier - only reached-adjacent blocked tiles are');
});

test('checkProgression: pick dungeon behind thicket becomes reachable only after the axe stage unlocks it', () => {
  const g = fill(10, 10, 'grass');
  // Thicket wall separating town's side from the pick dungeon's pocket.
  for (let y = 0; y < 10; y++) g[y][5] = 'thicket';
  g[5][5] = 'thicket'; // still thicket, just documenting the gate column
  const positions = { axe: { x: 1, y: 1 }, pick: { x: 8, y: 8 }, canoe: { x: 9, y: 9 }, dragon: { x: 9, y: 0 } };
  const result = checkProgression({
    width: 10, height: 10, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
    toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(positions),
  });
  assert.equal(result.ok, true, 'axe unlocks thicket, which should open the path to pick/canoe/dragon beyond it');
});

test('checkProgression: chicken-and-egg gate - axe dungeon behind mountain (needs pick) fails even though pick itself is freely reachable', () => {
  const g = fill(10, 10, 'grass');
  // 3x3 mountain box around the axe entrance - only 'pick' unlocks mountain,
  // but pick can never be obtained before axe passes, so this is a genuine
  // design deadlock the check must catch.
  for (let y = 4; y <= 6; y++) {
    for (let x = 4; x <= 6; x++) g[y][x] = 'mountain';
  }
  g[5][5] = 'grass'; // axe entrance, walled in by mountain on all sides
  const positions = { axe: { x: 5, y: 5 }, pick: { x: 1, y: 1 }, canoe: { x: 2, y: 1 }, dragon: { x: 3, y: 1 } };
  const result = checkProgression({
    width: 10, height: 10, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
    toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(positions),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stageIndex, 0, 'axe must fail first - pick being separately reachable does not matter, order is enforced');
  assert.equal(result.stageId, 'axe');
});

test('checkProgression: each of the 4 stages fails independently when only that stage\'s gate is unbeatable', () => {
  function buildChainGrid() {
    const g = fill(20, 1, 'grass');
    g[0][4] = 'thicket'; // town(0,0) -> axe(2,0) open grass; axe -> pick needs this thicket cell at x=4
    g[0][9] = 'mountain'; // pick(6,0) -> canoe(8,0) open; canoe -> ... needs mountain at x=9 actually placed between pick and canoe
    g[0][14] = 'water'; // canoe -> dragon gate
    return g;
  }
  // Layout: town=0, axe=2, [thicket@4], pick=6, [mountain@9], canoe=11, [water@14], dragon=16
  function basePositions() {
    return { axe: { x: 2, y: 0 }, pick: { x: 6, y: 0 }, canoe: { x: 11, y: 0 }, dragon: { x: 16, y: 0 } };
  }

  // Sanity: the intended chain is fully solvable as designed.
  {
    const g = buildChainGrid();
    const result = checkProgression({
      width: 20, height: 1, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
      toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(basePositions()),
    });
    assert.equal(result.ok, true, 'the constructed happy-path chain should be fully solvable in order');
  }

  // Break the axe->pick thicket gate by making it permanent tree instead.
  {
    const g = buildChainGrid();
    g[0][4] = 'tree';
    const result = checkProgression({
      width: 20, height: 1, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
      toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(basePositions()),
    });
    assert.equal(result.ok, false);
    assert.equal(result.stageIndex, 1, 'pick dungeon should be the one reported unreachable');
    assert.equal(result.stageId, 'pick');
  }

  // Break the pick->canoe mountain gate.
  {
    const g = buildChainGrid();
    g[0][9] = 'tree';
    const result = checkProgression({
      width: 20, height: 1, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
      toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(basePositions()),
    });
    assert.equal(result.ok, false);
    assert.equal(result.stageIndex, 2);
    assert.equal(result.stageId, 'canoe');
  }

  // Break the canoe->dragon water gate.
  {
    const g = buildChainGrid();
    g[0][14] = 'tree';
    const result = checkProgression({
      width: 20, height: 1, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
      toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(basePositions()),
    });
    assert.equal(result.ok, false);
    assert.equal(result.stageIndex, 3);
    assert.equal(result.stageId, null, "the dragon dungeon stage's id is null, matching painter.js's own entrances array");
  }
});

test('checkProgression: an unplaced entrance (pos null) fails at that exact stage', () => {
  const g = fill(10, 10, 'grass');
  const positions = { axe: { x: 1, y: 1 }, pick: null, canoe: { x: 3, y: 1 }, dragon: { x: 4, y: 1 } };
  const result = checkProgression({
    width: 10, height: 10, town: { x: 0, y: 0 }, isPassable: isPassableOver(g),
    toollessKinds: TOOLLESS_KINDS, entrances: entrancesFor(positions),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stageIndex, 1);
  assert.equal(result.stageId, 'pick');
});
