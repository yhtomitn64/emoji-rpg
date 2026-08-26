import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import {
  TRAIL_WEAR_CAP, trailWearFraction, trailStrokeOpacity, trailStrokeWidth, trailDotRadius,
  edgeOwner, edgeJitter, connectorPathD, getTrailColor,
} from '../js/systems/trail.js';

test('trailWearFraction scales linearly from 0 to 1 and clamps at the cap', () => {
  assert.equal(trailWearFraction(0), 0);
  assert.equal(trailWearFraction(5), 0.5);
  assert.equal(trailWearFraction(TRAIL_WEAR_CAP), 1);
  assert.equal(trailWearFraction(TRAIL_WEAR_CAP + 5), 1);
});

test('trailStrokeOpacity and trailStrokeWidth are never zero at fraction 0 (a first connection is faintly visible, not invisible)', () => {
  assert.equal(trailStrokeOpacity(0), 0.25);
  assert.equal(trailStrokeOpacity(1), 0.8);
  assert.equal(trailStrokeWidth(0), 10);
  assert.equal(trailStrokeWidth(1), 18);
});

test('trailDotRadius scales with wear fraction the same way', () => {
  assert.equal(trailDotRadius(0), 6);
  assert.equal(trailDotRadius(1), 12);
});

test('edgeOwner resolves a shared edge to the same lower-coordinate tile from either side', () => {
  assert.deepEqual(edgeOwner(5, 5, 'e'), { x: 5, y: 5, axis: 'h' });
  assert.deepEqual(edgeOwner(6, 5, 'w'), { x: 5, y: 5, axis: 'h' });
  assert.deepEqual(edgeOwner(5, 5, 's'), { x: 5, y: 5, axis: 'v' });
  assert.deepEqual(edgeOwner(5, 6, 'n'), { x: 5, y: 5, axis: 'v' });
});

test('edgeOwner throws for an unknown direction', () => {
  assert.throws(() => edgeOwner(5, 5, 'nowhere'));
});

test('edgeJitter is deterministic for the same inputs', () => {
  assert.equal(edgeJitter(5, 5, 'h'), edgeJitter(5, 5, 'h'));
});

test('edgeJitter uses independent streams for the two axes at the same coordinates', () => {
  assert.notEqual(edgeJitter(5, 5, 'h'), edgeJitter(5, 5, 'v'));
});

test('edgeJitter stays within the expected -0.5..0.5 range', () => {
  for (let x = 0; x < 20; x++) {
    const j = edgeJitter(x, 3, 'h');
    assert.ok(j >= -0.5 && j < 0.5, `jitter ${j} out of range`);
  }
});

test('connectorPathD draws toward east with zero jitter', () => {
  assert.equal(connectorPathD('e', 0, 100), 'M 50 50 Q 75.00 50.00 100 50');
});

test('connectorPathD bows perpendicular to the direction when jitter is nonzero', () => {
  assert.equal(connectorPathD('n', 0.5, 100), 'M 50 50 Q 67.50 25.00 50 0');
  assert.equal(connectorPathD('s', -0.3, 100), 'M 50 50 Q 60.50 75.00 50 100');
  assert.equal(connectorPathD('w', 0.25, 100), 'M 50 50 Q 25.00 41.25 0 50');
});

test('connectorPathD throws for an unknown direction', () => {
  assert.throws(() => connectorPathD('nowhere', 0, 100));
});

test('getTrailColor returns the grass color for grass and falls back to it for an unmapped tile', () => {
  assert.equal(getTrailColor(TILES.grass), '#6b4a2f');
  assert.equal(getTrailColor(TILES.caveWall), '#6b4a2f');
});

test('getTrailColor returns a distinct color for cave floor', () => {
  assert.equal(getTrailColor(TILES.caveFloor), '#7a7a7a');
});

test('getTrailColor returns a distinct blue for water, not the dirt-path default', () => {
  assert.equal(getTrailColor(TILES.water), '#4a7fa8');
});
