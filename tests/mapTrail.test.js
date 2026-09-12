// Tests for the worn-path trail as the canvas renderer draws it.
//
// The trail is the map's most intricate piece of rendering and the one whose
// past bugs were all *seams* - two tiles sharing an edge disagreeing about
// its color, its width, or its waviness, each of which was only ever caught
// by looking at a real save in a real browser (see the long comments in
// js/systems/trail.js). Porting it from SVG to canvas is exactly the kind of
// change that could reintroduce one, so these lock down the properties those
// bugs violated - as numbers, which the SVG version never had test coverage
// for at all.
//
// The port is deliberately a transcription, not a reinterpretation: the draw
// list carries trail.js's own numbers in trail.js's own 0..100 coordinate
// space, and the painter's single scale by TILE_SIZE_PX / TRAIL_VIEWBOX_SIZE
// is the only unit conversion anywhere. These tests assert that the numbers
// arriving at the painter are trail.js's, unmodified.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';
import { markVisited, markDirection } from '../js/systems/exploration.js';
import {
  trailWearFraction, trailStrokeWidthBetween, trailBorderFraction,
  trailDotRadius, trailHubRadius, connectorPathPoints,
  edgeOwner, edgeJitter, getTrailColor, getGroundColor, trailColorForFraction,
} from '../js/systems/trail.js';
import { TILES } from '../js/tiles.js';
import { TRAIL_VIEWBOX_SIZE } from '../js/systems/mapRenderModel.js';

// A lone 5x3 grass screen. Lone means its cluster origin is (0, 0), so a
// map-local (x, y) is also its world (gx, gy) - see screenToGlobal.
const PLAINS = {
  id: 'plains',
  legend: { '.': 'grass' },
  rows: ['.....', '.....', '.....'],
  neighbors: {},
  monsterTable: [],
  encounterChance: 0,
  cacheChance: 0,
};

// Walks the given tiles into state.visited by hand, so a test can set an
// exact visit count and exact crossed-edge set rather than driving enough
// real keypresses to produce one. `visits` is [x, y, count, dirs].
function stateWithTrail(visits, position) {
  const state = { ...createNewGame(), map: 'plains', position };
  let visited = state.visited;
  for (const [x, y, count, dirs] of visits) {
    for (let i = 0; i < count; i++) visited = markVisited(visited, 'plains', x, y);
    for (const dir of dirs) visited = markDirection(visited, 'plains', x, y, dir);
  }
  return { ...state, visited };
}

async function drawListFor(state) {
  const { mount, __getDrawListForTest } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  const maps = { plains: PLAINS };
  mount(root, {
    renderer: 'canvas',
    state,
    mapConfig: PLAINS,
    maps,
    worldGrid: buildWorldGrid(maps),
    callbacks: { onFirstVisit: () => {}, onMove: () => {}, onWornPathHint: () => {} },
  });
  return __getDrawListForTest();
}

function trailAt(drawList, gx, gy) {
  return drawList.ops.find((op) => op.op === 'trail' && op.gx === gx && op.gy === gy);
}

const GRASS_TRAIL = getTrailColor(TILES.grass);
const GRASS_GROUND = getGroundColor(TILES.grass);
const colorAt = (fraction) => trailColorForFraction(GRASS_TRAIL, GRASS_GROUND, fraction);

test('mapTrail - a visited tile with no crossed edges', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('renders a centered dot, sized and colored by its own wear', async () => {
    // Position the hero elsewhere so mount()'s own markVisited doesn't add a
    // visit to the tile under test.
    const state = stateWithTrail([[1, 1, 4, []]], { x: 4, y: 2 });
    const op = trailAt(await drawListFor(state), 1, 1);
    assert.ok(op, 'expected a trail op on the visited tile');
    assert.equal(op.strokes.length, 0);
    assert.equal(op.hub, null, 'a lone dot has no strokes to notch against, so no hub');
    assert.equal(op.dot.r, trailDotRadius(trailWearFraction(4)));
    assert.equal(op.dot.color, colorAt(trailWearFraction(4)));
  });

  await t.test('a more-walked tile gets a bigger, more saturated dot', async () => {
    const light = trailAt(await drawListFor(stateWithTrail([[1, 1, 1, []]], { x: 4, y: 2 })), 1, 1);
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    const heavy = trailAt(await drawListFor(stateWithTrail([[1, 1, 10, []]], { x: 4, y: 2 })), 1, 1);
    assert.ok(heavy.dot.r > light.dot.r);
    assert.equal(heavy.dot.color, GRASS_TRAIL, 'fully worn reaches the solid trail color');
    assert.notEqual(light.dot.color, heavy.dot.color);
  });
});

test('mapTrail - connector strokes', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('curve control points come straight from connectorPathPoints, with the shared edge jitter', async () => {
    const state = stateWithTrail([[1, 1, 3, ['e']], [2, 1, 3, ['w']]], { x: 4, y: 2 });
    const op = trailAt(await drawListFor(state), 1, 1);
    const stroke = op.strokes.find((s) => s.dir === 'e');
    const owner = edgeOwner(1, 1, 'e');
    const expected = connectorPathPoints('e', edgeJitter(owner.x, owner.y, owner.axis), TRAIL_VIEWBOX_SIZE);
    assert.equal(stroke.cx, expected.cx);
    assert.equal(stroke.cy, expected.cy);
    assert.equal(stroke.qx, expected.qx);
    assert.equal(stroke.qy, expected.qy);
    assert.equal(stroke.tx, expected.tx);
    assert.equal(stroke.ty, expected.ty);
  });

  // The bug this guards: each tile's edge used to taper all the way to the
  // OTHER tile's own color, so two different colors landed on the same
  // physical point and produced a hard color wall - confirmed live on a real
  // save. The shared value both sides must agree on is the border fraction.
  await t.test('a stroke tapers from its own wear toward the shared BORDER fraction, not the neighbor raw fraction', async () => {
    const state = stateWithTrail([[1, 1, 8, ['e']], [2, 1, 2, ['w']]], { x: 4, y: 2 });
    const drawList = await drawListFor(state);
    const own = trailWearFraction(8);
    const neighbor = trailWearFraction(2);
    const stroke = trailAt(drawList, 1, 1).strokes.find((s) => s.dir === 'e');
    assert.equal(stroke.fromColor, colorAt(own), 'the center is this tile own wear color');
    assert.equal(stroke.toColor, colorAt(trailBorderFraction(own, neighbor)));
    assert.notEqual(stroke.toColor, colorAt(neighbor), 'must not taper to the neighbor raw fraction');
  });

  await t.test('the two tiles sharing an edge agree exactly on that edge color and width', async () => {
    const state = stateWithTrail([[1, 1, 8, ['e']], [2, 1, 2, ['w']]], { x: 4, y: 2 });
    const drawList = await drawListFor(state);
    const eastward = trailAt(drawList, 1, 1).strokes.find((s) => s.dir === 'e');
    const westward = trailAt(drawList, 2, 1).strokes.find((s) => s.dir === 'w');
    assert.equal(eastward.toColor, westward.toColor, 'a seam here is exactly the bug that was confirmed live');
    assert.equal(eastward.width, westward.width, 'widths must be symmetric across a shared edge');
  });

  await t.test('stroke width is the symmetric between-tiles width, never this tile own', async () => {
    const state = stateWithTrail([[1, 1, 10, ['e']], [2, 1, 0, ['w']]], { x: 4, y: 2 });
    const stroke = trailAt(await drawListFor(state), 1, 1).strokes.find((s) => s.dir === 'e');
    assert.equal(stroke.width, trailStrokeWidthBetween(trailWearFraction(10), trailWearFraction(0)));
  });

  await t.test('both tiles jitter their shared edge identically, so the stroke has no kink at the border', async () => {
    const state = stateWithTrail([[1, 1, 3, ['e']], [2, 1, 3, ['w']]], { x: 4, y: 2 });
    const drawList = await drawListFor(state);
    const owner = edgeOwner(1, 1, 'e');
    const sharedJitter = edgeJitter(owner.x, owner.y, owner.axis);
    // The east stroke of (1,1) and the west stroke of (2,1) describe the two
    // halves of one physical path; both must be bowed by the same amount.
    assert.deepEqual(edgeOwner(2, 1, 'w'), owner, 'the lower-coordinate tile owns the shared edge');
    const eastward = trailAt(drawList, 1, 1).strokes.find((s) => s.dir === 'e');
    assert.equal(eastward.qx, connectorPathPoints('e', sharedJitter, TRAIL_VIEWBOX_SIZE).qx);
  });
});

test('mapTrail - the junction hub', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  // A fork's strokes are each drawn at their own width, so a thinner one
  // falls short of a wider one at the shared center - a hard rectangular
  // notch, confirmed live on a real save. The hub covers it.
  await t.test('a fork gets a hub sized to its widest connected stroke', async () => {
    const state = stateWithTrail([
      [2, 1, 6, ['e', 'w', 'n']],
      [3, 1, 10, ['w']],
      [1, 1, 1, ['e']],
      [2, 0, 4, ['s']],
    ], { x: 4, y: 2 });
    const op = trailAt(await drawListFor(state), 2, 1);
    assert.equal(op.strokes.length, 3);
    assert.ok(op.hub, 'expected a hub at a 3-way fork');
    assert.equal(op.hub.r, trailHubRadius(op.strokes.map((s) => s.width)));
    assert.equal(op.hub.r, Math.max(...op.strokes.map((s) => s.width)) / 2);
    assert.equal(op.hub.color, colorAt(trailWearFraction(6)));
  });

  await t.test('a single connected direction gets no hub - there is no other width to clash with', async () => {
    const state = stateWithTrail([[1, 1, 5, ['e']], [2, 1, 5, ['w']]], { x: 4, y: 2 });
    const op = trailAt(await drawListFor(state), 1, 1);
    assert.equal(op.strokes.length, 1);
    assert.equal(op.hub, null);
  });
});

test('mapTrail - paint order and coordinate space', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('every trail number stays inside trail.js own 0..100 space, never pre-scaled to pixels', async () => {
    const state = stateWithTrail([[2, 1, 6, ['e', 'w']], [3, 1, 4, ['w']], [1, 1, 4, ['e']]], { x: 4, y: 2 });
    const op = trailAt(await drawListFor(state), 2, 1);
    for (const stroke of op.strokes) {
      for (const key of ['cx', 'cy', 'qx', 'qy', 'tx', 'ty']) {
        assert.ok(
          stroke[key] >= -TRAIL_VIEWBOX_SIZE && stroke[key] <= TRAIL_VIEWBOX_SIZE * 2,
          `${key}=${stroke[key]} looks pre-scaled; the painter applies TILE_SIZE_PX/100 itself`,
        );
      }
      assert.equal(stroke.cx, TRAIL_VIEWBOX_SIZE / 2, 'every stroke starts at the tile center');
      assert.equal(stroke.cy, TRAIL_VIEWBOX_SIZE / 2);
    }
  });

  await t.test('the trail paints over the ground and under the tile own sprites', async () => {
    const state = stateWithTrail([[1, 1, 5, ['e']], [2, 1, 5, ['w']]], { x: 1, y: 1 });
    const drawList = await drawListFor(state);
    const kinds = drawList.ops.filter((op) => op.gx === 1 && op.gy === 1).map((op) => op.op);
    assert.equal(kinds[0], 'ground');
    assert.ok(kinds.indexOf('trail') > 0);
    assert.ok(
      kinds.indexOf('glyph') > kinds.indexOf('trail'),
      'the hero standing on a worn tile must paint over its trail, not under it',
    );
  });
});
