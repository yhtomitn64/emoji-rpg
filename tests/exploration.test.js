import test from 'node:test';
import assert from 'node:assert/strict';
import { markVisited, markDirection, isVisited, getVisitCount, getVisitDirs } from '../js/systems/exploration.js';

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

test('markVisited with a direction adds it to the tile\'s recorded dirs', () => {
  const visited = markVisited({}, 'center', 5, 5, 's');
  assert.deepEqual(getVisitDirs(visited, 'center', 5, 5), ['s']);
});

test('markVisited without a direction records no dirs (e.g. the initial screen-landing tile)', () => {
  const visited = markVisited({}, 'center', 5, 5);
  assert.deepEqual(getVisitDirs(visited, 'center', 5, 5), []);
});

test('markVisited accumulates distinct directions across repeated calls', () => {
  let visited = markVisited({}, 'center', 5, 5, 'n');
  visited = markVisited(visited, 'center', 5, 5, 'w');
  assert.deepEqual(getVisitDirs(visited, 'center', 5, 5).sort(), ['n', 'w']);
});

test('markVisited does not duplicate a direction already recorded, but still counts the visit', () => {
  let visited = markVisited({}, 'center', 5, 5, 'n');
  visited = markVisited(visited, 'center', 5, 5, 'n');
  assert.deepEqual(getVisitDirs(visited, 'center', 5, 5), ['n']);
  assert.equal(getVisitCount(visited, 'center', 5, 5), 2);
});

test('getVisitDirs returns an empty array for a never-visited tile', () => {
  assert.deepEqual(getVisitDirs({}, 'center', 0, 0), []);
  assert.deepEqual(getVisitDirs({ center: {} }, 'center', 0, 0), []);
});

test('getVisitDirs returns an empty array for a legacy (pre-directional) visited entry', () => {
  assert.deepEqual(getVisitDirs({ center: { '3,4': true } }, 'center', 3, 4), []);
  assert.deepEqual(getVisitDirs({ center: { '3,4': 5 } }, 'center', 3, 4), []);
});

test('markDirection adds a direction to an already-visited tile without incrementing its count', () => {
  let visited = markVisited({}, 'center', 5, 5);
  visited = markDirection(visited, 'center', 5, 5, 'e');
  assert.equal(getVisitCount(visited, 'center', 5, 5), 1);
  assert.deepEqual(getVisitDirs(visited, 'center', 5, 5), ['e']);
});

test('markDirection does not duplicate an already-recorded direction', () => {
  let visited = markVisited({}, 'center', 5, 5, 'e');
  visited = markDirection(visited, 'center', 5, 5, 'e');
  assert.deepEqual(getVisitDirs(visited, 'center', 5, 5), ['e']);
});

test('markDirection returns the same reference (no-op) when the direction is already recorded', () => {
  const visited = markVisited({}, 'center', 5, 5, 'e');
  const next = markDirection(visited, 'center', 5, 5, 'e');
  assert.equal(next, visited);
});

test('markDirection accumulates alongside a legacy entry (upgrading it) without touching its count', () => {
  const legacyVisited = { center: { '3,4': true } };
  const next = markDirection(legacyVisited, 'center', 3, 4, 'n');
  assert.equal(getVisitCount(next, 'center', 3, 4), 1);
  assert.deepEqual(getVisitDirs(next, 'center', 3, 4), ['n']);
});
