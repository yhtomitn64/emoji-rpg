import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from '../js/tiles.js';
import {
  TRAIL_WEAR_CAP, trailWearFraction, trailStrokeWidth, trailStrokeWidthBetween, trailDotRadius,
  edgeOwner, edgeJitter, edgeTargetPoint, connectorPathD, getTrailColor, getGroundColor,
  blendColors, trailColorForFraction,
} from '../js/systems/trail.js';

test('trailWearFraction scales linearly from 0 to 1 and clamps at the cap', () => {
  assert.equal(trailWearFraction(0), 0);
  assert.equal(trailWearFraction(5), 0.5);
  assert.equal(trailWearFraction(TRAIL_WEAR_CAP), 1);
  assert.equal(trailWearFraction(TRAIL_WEAR_CAP + 5), 1);
});

test('trailStrokeWidth scales with wear fraction', () => {
  assert.equal(trailStrokeWidth(0), 10);
  assert.equal(trailStrokeWidth(1), 18);
});

test('trailStrokeWidthBetween is symmetric and equals trailStrokeWidth of the average fraction', () => {
  assert.equal(trailStrokeWidthBetween(0.2, 0.8), trailStrokeWidthBetween(0.8, 0.2));
  assert.equal(trailStrokeWidthBetween(0.2, 0.8), trailStrokeWidth(0.5));
  assert.equal(trailStrokeWidthBetween(1, 1), trailStrokeWidth(1));
  assert.equal(trailStrokeWidthBetween(0, 0), trailStrokeWidth(0));
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

test('edgeTargetPoint returns the edge-midpoint per direction, matching connectorPathD\'s own endpoints', () => {
  assert.deepEqual(edgeTargetPoint('n', 100), [50, 0]);
  assert.deepEqual(edgeTargetPoint('s', 100), [50, 100]);
  assert.deepEqual(edgeTargetPoint('w', 100), [0, 50]);
  assert.deepEqual(edgeTargetPoint('e', 100), [100, 50]);
});

test('edgeTargetPoint throws for an unknown direction', () => {
  assert.throws(() => edgeTargetPoint('nowhere', 100));
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

test('blendColors returns colorA unchanged at t=0 and colorB unchanged at t=1', () => {
  assert.equal(blendColors('#3f6b34', '#6b4a2f', 0), '#3f6b34');
  assert.equal(blendColors('#3f6b34', '#6b4a2f', 1), '#6b4a2f');
});

test('blendColors interpolates per channel at t=0.5', () => {
  assert.equal(blendColors('#3f6b34', '#6b4a2f', 0.5), '#555b32');
});

test('getGroundColor returns each terrain\'s actual CSS background color, matching css/styles.css', () => {
  assert.equal(getGroundColor(TILES.grass), '#3f6b34');
  assert.equal(getGroundColor(TILES.water), '#2b6cb0');
  assert.equal(getGroundColor(TILES.caveFloor), '#333333');
});

test('getGroundColor falls back to the grass color for an unmapped tile', () => {
  assert.equal(getGroundColor(TILES.caveWall), '#3f6b34');
});

test('trailColorForFraction returns the base trail color unchanged at full wear (fraction 1)', () => {
  assert.equal(trailColorForFraction('#6b4a2f', '#3f6b34', 1), '#6b4a2f');
});

test('trailColorForFraction returns the ground color unchanged at zero wear (fraction 0) - a bare-unworn tile is indistinguishable from bare ground', () => {
  assert.equal(trailColorForFraction('#6b4a2f', '#3f6b34', 0), '#3f6b34');
});

test('trailColorForFraction blends between ground and trail color at partial wear', () => {
  assert.equal(trailColorForFraction('#6b4a2f', '#3f6b34', 0.5), '#555b32');
});

test('two tiles sharing an edge compute the exact same color for that shared point when they agree on the fraction - the property that made the old opacity-based seam bug possible to fix', () => {
  const fraction = 0.3;
  const colorFromTileA = trailColorForFraction('#6b4a2f', '#3f6b34', fraction);
  const colorFromTileB = trailColorForFraction('#6b4a2f', '#3f6b34', fraction);
  assert.equal(colorFromTileA, colorFromTileB);
});
