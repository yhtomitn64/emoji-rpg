import test from 'node:test';
import assert from 'node:assert/strict';
import { CORNER_SCREEN_IDS, pickRandomEntrancePosition } from '../js/systems/dungeonEntrance.js';
import { farNortheastMap } from '../js/maps/wilderness/farNortheast.js';
import { farNorthwestMap } from '../js/maps/wilderness/farNorthwest.js';
import { farSoutheastMap } from '../js/maps/wilderness/farSoutheast.js';
import { farSouthwestMap } from '../js/maps/wilderness/farSouthwest.js';

const realCornerMaps = { farNortheast: farNortheastMap, farNorthwest: farNorthwestMap, farSoutheast: farSoutheastMap, farSouthwest: farSouthwestMap };

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('CORNER_SCREEN_IDS lists exactly the 4 new far-corner screens', () => {
  assert.deepEqual(CORNER_SCREEN_IDS, ['farNortheast', 'farNorthwest', 'farSoutheast', 'farSouthwest']);
});

test('pickRandomEntrancePosition can select each of the 4 corner ids', () => {
  const fixtureMap = { rows: ['..', '..'], legend: { '.': 'grass' } };
  const cornerMaps = { farNortheast: fixtureMap, farNorthwest: fixtureMap, farSoutheast: fixtureMap, farSouthwest: fixtureMap };
  for (let i = 0; i < 4; i++) {
    const rng = fixedRng([i / 4, 0]);
    const result = pickRandomEntrancePosition(cornerMaps, rng);
    assert.equal(result.screenId, CORNER_SCREEN_IDS[i]);
  }
});

test('pickRandomEntrancePosition always lands on a grass tile in the real corner maps', () => {
  for (const screenId of CORNER_SCREEN_IDS) {
    const index = CORNER_SCREEN_IDS.indexOf(screenId);
    const rng = fixedRng([index / 4, 0.5]);
    const result = pickRandomEntrancePosition(realCornerMaps, rng);
    assert.equal(result.screenId, screenId);
    const map = realCornerMaps[screenId];
    const char = map.rows[result.y][result.x];
    assert.equal(map.legend[char], 'grass');
  }
});

test('pickRandomEntrancePosition is deterministic given a fixed rng sequence', () => {
  const first = pickRandomEntrancePosition(realCornerMaps, fixedRng([0.1, 0.4]));
  const second = pickRandomEntrancePosition(realCornerMaps, fixedRng([0.1, 0.4]));
  assert.deepEqual(first, second);
});

test('pickRandomEntrancePosition uses Math.random by default', () => {
  const result = pickRandomEntrancePosition(realCornerMaps);
  assert.ok(CORNER_SCREEN_IDS.includes(result.screenId));
  assert.equal(typeof result.x, 'number');
  assert.equal(typeof result.y, 'number');
});
