import test from 'node:test';
import assert from 'node:assert/strict';
import { directionFromDelta, computeEdgeLandingPosition, isWalkableAt, isValidSavedPosition, pickTileVariant, isChokepointTile } from '../js/systems/world.js';

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
