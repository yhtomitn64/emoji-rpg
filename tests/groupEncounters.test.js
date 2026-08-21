import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_SPAWN_KILL_THRESHOLD, GROUP_SPAWN_CHANCE, GROUP_SIZE_MIN, GROUP_SIZE_MAX,
  incrementKillCount, rollEncounterGroup,
} from '../js/systems/groupEncounters.js';

test('incrementKillCount increments the given key from 0', () => {
  const result = incrementKillCount({ boar: 0, bat: 0 }, 'boar');
  assert.equal(result.boar, 1);
  assert.equal(result.bat, 0);
});

test('incrementKillCount increments an existing non-zero count', () => {
  const result = incrementKillCount({ boar: 5 }, 'boar');
  assert.equal(result.boar, 6);
});

test('incrementKillCount treats a missing key as 0', () => {
  const result = incrementKillCount({}, 'boar');
  assert.equal(result.boar, 1);
});

test('incrementKillCount does not mutate the input object', () => {
  const input = { boar: 0 };
  incrementKillCount(input, 'boar');
  assert.equal(input.boar, 0);
});

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('rollEncounterGroup returns a 1-element array below the kill threshold, regardless of rng', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD - 1 };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a 1-element array at threshold when the chance roll misses', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([GROUP_SPAWN_CHANCE, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a group at threshold when the chance roll hits', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0]));
  assert.ok(result.length >= GROUP_SIZE_MIN && result.length <= GROUP_SIZE_MAX);
  assert.ok(result.every((id) => id === 'boar'));
});

test('rollEncounterGroup can produce the minimum group size', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0]));
  assert.equal(result.length, GROUP_SIZE_MIN);
});

test('rollEncounterGroup can produce the maximum group size', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0.999]));
  assert.equal(result.length, GROUP_SIZE_MAX);
});

test('rollEncounterGroup treats an unseen monster id as 0 kills (never groups)', () => {
  const result = rollEncounterGroup('boar', {}, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup defaults to Math.random when no rng is passed', () => {
  const result = rollEncounterGroup('boar', { boar: 0 });
  assert.deepEqual(result, ['boar']);
});
