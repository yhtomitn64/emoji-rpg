import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_SPAWN_KILL_THRESHOLD, GROUP_SPAWN_CHANCE_BASE, GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE,
  GROUP_SIZE_MIN, GROUP_SIZE_MAX_BASE, GROUP_SIZE_MAX_CAP, ZONE1_STEPS_PER_SIZE_ESCALATION,
  GROUP_SIZE_RAMP_KILLS_PER_STEP,
  incrementKillCount, rollEncounterGroup, groupSpawnChance, effectiveGroupSizeMax, killCountSizeCap,
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

test('groupSpawnChance is the base chance at NG+ cycle 0', () => {
  assert.equal(groupSpawnChance(0), GROUP_SPAWN_CHANCE_BASE);
});

test('groupSpawnChance rises by GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE per NG+ cycle', () => {
  assert.equal(groupSpawnChance(1), GROUP_SPAWN_CHANCE_BASE + GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE);
  assert.equal(groupSpawnChance(2), GROUP_SPAWN_CHANCE_BASE + GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE * 2);
});

test('effectiveGroupSizeMax is the base max at NG+ cycle 0 with no zone-1 steps', () => {
  assert.equal(effectiveGroupSizeMax(0, 0), GROUP_SIZE_MAX_BASE);
});

test('effectiveGroupSizeMax rises by 1 per NG+ cycle', () => {
  assert.equal(effectiveGroupSizeMax(1, 0), GROUP_SIZE_MAX_BASE + 1);
  assert.equal(effectiveGroupSizeMax(2, 0), GROUP_SIZE_MAX_BASE + 2);
});

test('effectiveGroupSizeMax rises by 1 per ZONE1_STEPS_PER_SIZE_ESCALATION steps, floored', () => {
  assert.equal(effectiveGroupSizeMax(0, ZONE1_STEPS_PER_SIZE_ESCALATION - 1), GROUP_SIZE_MAX_BASE);
  assert.equal(effectiveGroupSizeMax(0, ZONE1_STEPS_PER_SIZE_ESCALATION), GROUP_SIZE_MAX_BASE + 1);
  assert.equal(effectiveGroupSizeMax(0, ZONE1_STEPS_PER_SIZE_ESCALATION * 2), GROUP_SIZE_MAX_BASE + 2);
});

test('effectiveGroupSizeMax stacks NG+ cycle and zone-1 steps additively', () => {
  assert.equal(effectiveGroupSizeMax(1, ZONE1_STEPS_PER_SIZE_ESCALATION), GROUP_SIZE_MAX_BASE + 1 + 1);
});

test('effectiveGroupSizeMax never exceeds GROUP_SIZE_MAX_CAP even with both escalations maxed', () => {
  assert.equal(effectiveGroupSizeMax(2, ZONE1_STEPS_PER_SIZE_ESCALATION * 10), GROUP_SIZE_MAX_CAP);
});

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('rollEncounterGroup returns a 1-element array below the kill threshold, regardless of rng', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD - 1 };
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a 1-element array at threshold when the chance roll misses', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([groupSpawnChance(0), 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a group at threshold when the chance roll hits', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([0, 0, 0]));
  const max = effectiveGroupSizeMax(0, 0);
  assert.ok(result.length >= GROUP_SIZE_MIN && result.length <= max);
  assert.ok(result.every((id) => id === 'boar'), 'a single-species monsterTable should only ever produce that species');
});

test('rollEncounterGroup can produce the minimum group size', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  // rng sequence: chance roll (hits), size roll (0 -> GROUP_SIZE_MIN), one pick for the one extra slot.
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, fixedRng([0, 0, 0]));
  assert.equal(result.length, GROUP_SIZE_MIN);
});

test('rollEncounterGroup can produce the effective maximum group size once the kill-count ramp has caught up', () => {
  const max = effectiveGroupSizeMax(0, 0);
  // Enough kills past the threshold for killCountSizeCap to reach `max` too -
  // see killCountSizeCap's own comment for why this can't just sit at the
  // threshold anymore.
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD + (max - GROUP_SIZE_MIN) * GROUP_SIZE_RAMP_KILLS_PER_STEP };
  // rng sequence: chance roll (hits), size roll (0.999 -> max), one pick per extra slot (max - 1 of them).
  const rng = fixedRng([0, 0.999, ...Array(max - 1).fill(0)]);
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 0, 0, rng);
  assert.equal(result.length, max);
});

// Raised 2026-09-04: "I got 5 the first time I got the multi mobs... start
// with 2 then after maybe like 5 more kills 3 and so on."
test('killCountSizeCap pins to GROUP_SIZE_MIN right at the kill threshold', () => {
  assert.equal(killCountSizeCap(GROUP_SPAWN_KILL_THRESHOLD), GROUP_SIZE_MIN);
  assert.equal(killCountSizeCap(GROUP_SPAWN_KILL_THRESHOLD + GROUP_SIZE_RAMP_KILLS_PER_STEP - 1), GROUP_SIZE_MIN);
});

test('killCountSizeCap climbs by one every GROUP_SIZE_RAMP_KILLS_PER_STEP kills past the threshold', () => {
  assert.equal(killCountSizeCap(GROUP_SPAWN_KILL_THRESHOLD + GROUP_SIZE_RAMP_KILLS_PER_STEP), GROUP_SIZE_MIN + 1);
  assert.equal(killCountSizeCap(GROUP_SPAWN_KILL_THRESHOLD + GROUP_SIZE_RAMP_KILLS_PER_STEP * 2), GROUP_SIZE_MIN + 2);
});

test('rollEncounterGroup pins the very first eligible encounter to GROUP_SIZE_MIN, even when effectiveGroupSizeMax is already escalated', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  // NG+ cycle 2 alone would otherwise allow up to effectiveGroupSizeMax(2,0) = GROUP_SIZE_MAX_BASE + 2 -
  // "5 mobs, day one" is exactly this scenario (a species crossing the kill
  // threshold well after NG+/zone1Steps pressure has already grown the
  // ceiling). The size roll below is forced to its top (0.999) and should
  // still land on GROUP_SIZE_MIN, not the escalated ceiling.
  const rng = fixedRng([0, 0.999, 0]);
  const result = rollEncounterGroup('boar', killCounts, ['boar'], 2, 0, rng);
  assert.equal(result.length, GROUP_SIZE_MIN, 'the very first eligible encounter should still be pinned to the minimum size');
});

test('rollEncounterGroup treats an unseen monster id as 0 kills (never groups)', () => {
  const result = rollEncounterGroup('boar', {}, ['boar'], 0, 0, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup defaults to Math.random when no rng is passed', () => {
  const result = rollEncounterGroup('boar', { boar: 0 }, ['boar'], 0, 0);
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup mixes species: extra slots are independently rolled from monsterTable, not all copies of the seed', () => {
  const max = effectiveGroupSizeMax(0, 0);
  // Enough kills past the threshold for killCountSizeCap to reach `max` too - see killCountSizeCap's own comment.
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD + (max - GROUP_SIZE_MIN) * GROUP_SIZE_RAMP_KILLS_PER_STEP };
  const monsterTable = ['boar', 'bat', 'snake'];
  // chance roll hits (0 < 0.3), size roll 0.999 -> max (4),
  // then 3 picks into a 3-species table: index 0 ('boar'), index 1 ('bat'), index 2 ('snake').
  const rng = fixedRng([0, 0.999, 0, 0.4, 0.7]);
  const result = rollEncounterGroup('boar', killCounts, monsterTable, 0, 0, rng);
  assert.equal(result.length, max);
  assert.equal(result[0], 'boar', 'the seed monster is always first');
  assert.ok(result.includes('bat') && result.includes('snake'), 'expected a genuine mix, not four copies of the seed');
});

test('rollEncounterGroup scales the effective max with ngPlusCycle and zone1Steps once the kill-count ramp has caught up', () => {
  const ngPlusCycle = 2;
  const zone1Steps = 0;
  const max = effectiveGroupSizeMax(ngPlusCycle, zone1Steps);
  // Enough kills past the threshold for killCountSizeCap to reach `max` too - see killCountSizeCap's own comment.
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD + (max - GROUP_SIZE_MIN) * GROUP_SIZE_RAMP_KILLS_PER_STEP };
  const rng = fixedRng([0, 0.999, ...Array(max - 1).fill(0)]);
  const result = rollEncounterGroup('boar', killCounts, ['boar'], ngPlusCycle, zone1Steps, rng);
  assert.equal(result.length, max);
  assert.ok(max > GROUP_SIZE_MAX_BASE, 'sanity check: NG+ cycle 2 should actually raise the max above the base');
});
