import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldGrid, screenToGlobal, globalToScreen, clusterBounds } from '../js/systems/worldGrid.js';

function fakeScreen(id, width, height, neighbors) {
  return { id, rows: new Array(height).fill('.'.repeat(width)), neighbors };
}

test('screenToGlobal places a lone screen (no neighbors) at its own origin', () => {
  const maps = { town: fakeScreen('town', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(screenToGlobal(grid, 'town', 0, 0), { gx: 0, gy: 0 });
  assert.deepEqual(screenToGlobal(grid, 'town', 9, 7), { gx: 9, gy: 7 });
});

test('screenToGlobal offsets an east neighbor by the west screen\'s own width', () => {
  const maps = {
    west: fakeScreen('west', 10, 8, { east: 'east' }),
    east: fakeScreen('east', 10, 8, { west: 'west' }),
  };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(screenToGlobal(grid, 'east', 0, 0), { gx: 10, gy: 0 });
});

test('screenToGlobal offsets a south neighbor by the north screen\'s own height', () => {
  const maps = {
    north: fakeScreen('north', 10, 8, { south: 'south' }),
    south: fakeScreen('south', 10, 8, { north: 'north' }),
  };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(screenToGlobal(grid, 'south', 0, 0), { gx: 0, gy: 8 });
});

test('globalToScreen round-trips screenToGlobal across a 2x2 grid of screens', () => {
  const maps = {
    nw: fakeScreen('nw', 5, 5, { east: 'ne', south: 'sw' }),
    ne: fakeScreen('ne', 5, 5, { west: 'nw', south: 'se' }),
    sw: fakeScreen('sw', 5, 5, { east: 'se', north: 'nw' }),
    se: fakeScreen('se', 5, 5, { west: 'sw', north: 'ne' }),
  };
  const grid = buildWorldGrid(maps);
  for (const id of Object.keys(maps)) {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const { gx, gy } = screenToGlobal(grid, id, x, y);
        assert.deepEqual(globalToScreen(grid, id, gx, gy), { screenId: id, localX: x, localY: y });
      }
    }
  }
});

test('globalToScreen returns null one tile past a cluster\'s outer edge', () => {
  const maps = { town: fakeScreen('town', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.equal(globalToScreen(grid, 'town', 10, 0), null); // one past the east edge
  assert.equal(globalToScreen(grid, 'town', -1, 0), null); // one past the west edge
  assert.equal(globalToScreen(grid, 'town', 0, 8), null); // one past the south edge
});

test('globalToScreen never crosses between two unrelated one-screen clusters', () => {
  // Both "town" and "dungeon" have no neighbors, so both start at their own
  // (0,0) - a naive implementation without per-cluster scoping would let a
  // query anchored on "town" resolve into "dungeon"'s identically-numbered
  // tiles.
  const maps = { town: fakeScreen('town', 10, 8), dungeon: fakeScreen('dungeon', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(globalToScreen(grid, 'town', 3, 3), { screenId: 'town', localX: 3, localY: 3 });
});

test('clusterBounds spans every screen in a 2x2 grid, not just one screen', () => {
  const maps = {
    nw: fakeScreen('nw', 5, 5, { east: 'ne', south: 'sw' }),
    ne: fakeScreen('ne', 5, 5, { west: 'nw', south: 'se' }),
    sw: fakeScreen('sw', 5, 5, { east: 'se', north: 'nw' }),
    se: fakeScreen('se', 5, 5, { west: 'sw', north: 'ne' }),
  };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(clusterBounds(grid, 'se'), { minGx: 0, minGy: 0, maxGx: 9, maxGy: 9 });
});

test('clusterBounds for a lone screen is just that screen\'s own extent', () => {
  const maps = { town: fakeScreen('town', 10, 8) };
  const grid = buildWorldGrid(maps);
  assert.deepEqual(clusterBounds(grid, 'town'), { minGx: 0, minGy: 0, maxGx: 9, maxGy: 7 });
});
