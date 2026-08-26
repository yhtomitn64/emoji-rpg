import test from 'node:test';
import assert from 'node:assert/strict';
import { markVisited, isVisited, getVisitCount } from '../js/systems/exploration.js';

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

test('markVisited increments the walk count on repeated visits to the same tile', () => {
  let visited = markVisited({}, 'center', 3, 3);
  visited = markVisited(visited, 'center', 3, 3);
  visited = markVisited(visited, 'center', 3, 3);
  assert.equal(getVisitCount(visited, 'center', 3, 3), 3);
});

test('getVisitCount returns 0 for a tile that was never visited', () => {
  assert.equal(getVisitCount({}, 'center', 0, 0), 0);
  assert.equal(getVisitCount({ center: {} }, 'center', 0, 0), 0);
});

test('getVisitCount treats a legacy boolean true (old save format) as a count of 1', () => {
  const legacyVisited = { center: { '3,4': true } };
  assert.equal(getVisitCount(legacyVisited, 'center', 3, 4), 1);
  assert.equal(isVisited(legacyVisited, 'center', 3, 4), true);
});

test('markVisited on a legacy boolean entry upgrades it to a real count', () => {
  const legacyVisited = { center: { '3,4': true } };
  const next = markVisited(legacyVisited, 'center', 3, 4);
  assert.equal(getVisitCount(next, 'center', 3, 4), 2);
});
