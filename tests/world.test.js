import test from 'node:test';
import assert from 'node:assert/strict';
import { directionFromDelta, computeEdgeLandingPosition, isWalkableAt, isValidSavedPosition, pickTileVariant, isChokepointTile, computeViewportOrigin } from '../js/systems/world.js';

test('directionFromDelta maps movement deltas to compass directions', () => {
  assert.equal(directionFromDelta(1, 0), 'east');
  assert.equal(directionFromDelta(-1, 0), 'west');
  assert.equal(directionFromDelta(0, 1), 'south');
  assert.equal(directionFromDelta(0, -1), 'north');
});

test('computeEdgeLandingPosition places the player on the mirrored edge of the neighbor screen', () => {
  const currentPosition = { x: 5, y: 3 };
  const neighborMap = { rows: new Array(11).fill('.'.repeat(15)) };

  assert.deepEqual(computeEdgeLandingPosition('east', currentPosition, neighborMap), { x: 0, y: 3 });
  assert.deepEqual(computeEdgeLandingPosition('west', currentPosition, neighborMap), { x: 14, y: 3 });
  assert.deepEqual(computeEdgeLandingPosition('south', currentPosition, neighborMap), { x: 5, y: 0 });
  assert.deepEqual(computeEdgeLandingPosition('north', currentPosition, neighborMap), { x: 5, y: 10 });
});

test('isValidSavedPosition accepts a tool-gated tile even though it is not unconditionally walkable', () => {
  const map = {
    rows: ['MG'],
    legend: { M: 'mountain', G: 'grass' },
  };
  assert.equal(isWalkableAt(map, 0, 0), false); // gate tile is NOT unconditionally walkable
  assert.equal(isValidSavedPosition(map, 0, 0), true); // but IS a valid position to have saved
  assert.equal(isValidSavedPosition(map, 1, 0), true); // plain walkable tile also valid
});

test('isValidSavedPosition rejects a plain impassable tile (no requiresTool) and out-of-bounds', () => {
  const map = {
    rows: ['TG'],
    legend: { T: 'tree', G: 'grass' },
  };
  assert.equal(isValidSavedPosition(map, 0, 0), false);
  assert.equal(isValidSavedPosition(map, 5, 5), false);
});

test('pickTileVariant returns the plain emoji for a tile with no variants', () => {
  const tile = { emoji: '🌲' };
  assert.equal(pickTileVariant(tile, 3, 4), '🌲');
});

test('pickTileVariant is deterministic - the same (x, y) always picks the same variant', () => {
  const tile = { emoji: '🟩', variants: ['🟩', '🍀', '🌼'] };
  const first = pickTileVariant(tile, 7, 12);
  const second = pickTileVariant(tile, 7, 12);
  assert.equal(first, second);
});

test('pickTileVariant picks different variants for different coordinates', () => {
  const tile = { emoji: '🟩', variants: ['🟩', '🍀', '🌼'] };
  const results = new Set();
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      results.add(pickTileVariant(tile, x, y));
    }
  }
  assert.equal(results.size, 3);
});

function gridIsPassable(rows) {
  return (x, y) => rows[y]?.[x] === '.';
}

test('isChokepointTile is true for a one-tile-wide pass between two obstacle-filled regions', () => {
  const rows = [
    '.....',
    '##.##',
    '.....',
  ];
  assert.equal(isChokepointTile(5, 3, 2, 1, gridIsPassable(rows)), true);
});

test('isChokepointTile is true for a single tile in a narrow corridor with passable tiles on both sides', () => {
  assert.equal(isChokepointTile(3, 1, 1, 0, gridIsPassable(['...'])), true);
});

test('isChokepointTile is false when every walkable tile stays connected via another route (an open ring)', () => {
  const rows = [
    '...',
    '...',
    '...',
  ];
  assert.equal(isChokepointTile(3, 3, 1, 1, gridIsPassable(rows)), false);
});

test('isChokepointTile is false for a dead end - fewer than two passable neighbors means nothing to disconnect', () => {
  const rows = [
    '.#',
    '..',
  ];
  assert.equal(isChokepointTile(2, 2, 1, 1, gridIsPassable(rows)), false);
});

test('computeViewportOrigin centers the viewport on the player away from any edge', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 99, maxGy: 99 };
  assert.deepEqual(computeViewportOrigin(50, 50, 11, 7, bounds), { originGx: 45, originGy: 47 });
});

test('computeViewportOrigin clamps at the minimum edge instead of showing past it', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 99, maxGy: 99 };
  assert.deepEqual(computeViewportOrigin(1, 1, 11, 7, bounds), { originGx: 0, originGy: 0 });
});

test('computeViewportOrigin clamps at the maximum edge instead of showing past it', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 99, maxGy: 99 };
  assert.deepEqual(computeViewportOrigin(98, 98, 11, 7, bounds), { originGx: 89, originGy: 93 });
});

test('computeViewportOrigin centers a whole small map (viewport bigger than the world) with no panning', () => {
  const bounds = { minGx: 0, minGy: 0, maxGx: 9, maxGy: 7 }; // a 10x8 town-sized map
  assert.deepEqual(computeViewportOrigin(3, 3, 21, 15, bounds), { originGx: -5, originGy: -3 });
  // moving the "player" elsewhere on the same small map doesn't move the origin at all
  assert.deepEqual(computeViewportOrigin(8, 6, 21, 15, bounds), { originGx: -5, originGy: -3 });
});
