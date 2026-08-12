import test from 'node:test';
import assert from 'node:assert/strict';
import { markVisited, isVisited } from '../js/systems/exploration.js';

test('markVisited records a tile as visited for a given screen, immutably', () => {
  const visited = {};
  const next = markVisited(visited, 'center', 3, 4);
  assert.equal(isVisited(next, 'center', 3, 4), true);
  assert.deepEqual(visited, {});
});

test('isVisited returns false for unvisited tiles and unknown screens', () => {
  const visited = { center: { '3,4': true } };
  assert.equal(isVisited(visited, 'center', 5, 5), false);
  assert.equal(isVisited(visited, 'unknown', 3, 4), false);
});

test('markVisited preserves previously visited tiles on the same screen', () => {
  let visited = markVisited({}, 'center', 1, 1);
  visited = markVisited(visited, 'center', 2, 2);
  assert.equal(isVisited(visited, 'center', 1, 1), true);
  assert.equal(isVisited(visited, 'center', 2, 2), true);
});
