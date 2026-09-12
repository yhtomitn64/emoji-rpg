// Tests for the coupling between the camera and the hero's stride
// (js/systems/world.js's computeCameraOrigin, and what it does to a held-key
// walk end to end).
//
// Raised live by Timothy 2026-09-10, after the walk cadence and the stride
// were already put on one clock in 0.32.2: "I am wondering if we can take
// another stab at making the character walking perfectly smooth with no
// microstutter. It seems to me both the map and character are a little
// stuttery and maybe the issue is we need to tie it all together."
//
// That last guess was right, and it was a third clock nobody had looked at.
// The camera aimed at computeViewportOrigin, which is computed from the
// hero's *logical tile*, so its target jumped a whole tile the instant a step
// landed; the camera's exponential ease then sprinted right after each step
// and crawled just before the next one. The hero's own stride, meanwhile, is
// deliberately constant-speed. Two different velocity profiles for the same
// motion, and what the eye actually sees is the difference between them.
//
// Both halves of the visible result had been measured separately before and
// each looked acceptable on its own; the composite - the hero's position ON
// SCREEN, which is (hero - camera) - had never been measured at all. That is
// what the walk simulation at the bottom of this file checks, and it is the
// test that would actually catch a regression back to a quantised target.
//
// Simulating rather than driving a browser is the method this loop has been
// worked on with throughout, deliberately: see BACKLOG.md's "Micro-pause once
// per step" entry, where simulation overturned the plan (exponential
// smoothing won the obvious single metric and would have shipped a lurch).
// It is also the only method available here - Chrome suspends
// requestAnimationFrame for an unfocused tab, so the live loop cannot be
// stepped from automation at all. See tests/mapCamera.test.js's own header.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeViewportOrigin, computeCameraOrigin } from '../js/systems/world.js';
import { __testables } from '../js/screens/mapCanvasRenderer.js';

const { computeCameraStep, computeHeroStep } = __testables;

// A cluster comfortably bigger than the viewport in both axes, so the camera
// is free to pan and nothing clamps - the ordinary wilderness case.
const ROOMY = { minGx: 0, minGy: 0, maxGx: 200, maxGy: 200 };
const TILES_WIDE = 21;
const TILES_TALL = 11;

test('computeCameraOrigin - agrees exactly with computeViewportOrigin on whole tiles', async (t) => {
  // The property that lets the glide be turned off without the camera
  // settling anywhere different: at rest the hero is always on a whole tile,
  // and there the two functions must not merely be close, they must be equal.
  await t.test('every whole-tile centre in a roomy cluster', () => {
    for (let gx = 0; gx <= 200; gx += 7) {
      for (let gy = 0; gy <= 200; gy += 11) {
        assert.deepEqual(
          computeCameraOrigin(gx, gy, TILES_WIDE, TILES_TALL, ROOMY),
          computeViewportOrigin(gx, gy, TILES_WIDE, TILES_TALL, ROOMY),
          `disagreed at (${gx}, ${gy})`,
        );
      }
    }
  });

  await t.test('and at the clamped edges, where the centre stops mattering', () => {
    for (const gx of [0, 1, 2, 198, 199, 200]) {
      assert.deepEqual(
        computeCameraOrigin(gx, gx, TILES_WIDE, TILES_TALL, ROOMY),
        computeViewportOrigin(gx, gx, TILES_WIDE, TILES_TALL, ROOMY),
        `disagreed at the edge (${gx}, ${gx})`,
      );
    }
  });

  await t.test('and on a world smaller than the viewport, which centres instead of panning', () => {
    const tiny = { minGx: 0, minGy: 0, maxGx: 5, maxGy: 4 };
    assert.deepEqual(
      computeCameraOrigin(2.5, 2.5, TILES_WIDE, TILES_TALL, tiny),
      computeViewportOrigin(2, 2, TILES_WIDE, TILES_TALL, tiny),
      'a fractional centre must not shift a world that has no panning in it at all',
    );
  });
});

test('computeCameraOrigin - a fractional centre moves the camera fractionally', async (t) => {
  // The whole point: the target has to be able to sit between two tiles.
  // computeViewportOrigin cannot, which is the bug.
  await t.test('half a tile of hero movement is half a tile of camera movement', () => {
    const at10 = computeCameraOrigin(10, 10, TILES_WIDE, TILES_TALL, ROOMY);
    const at105 = computeCameraOrigin(10.5, 10, TILES_WIDE, TILES_TALL, ROOMY);
    assert.equal(at105.originGx - at10.originGx, 0.5);
    assert.equal(at105.originGy, at10.originGy, 'the untouched axis must not move');
  });

  await t.test('the target is strictly monotonic across a whole tile of travel, never stepped', () => {
    let previous = -Infinity;
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const { originGx } = computeCameraOrigin(10 + f, 10, TILES_WIDE, TILES_TALL, ROOMY);
      assert.ok(originGx > previous, `stalled or went backwards at fraction ${f.toFixed(2)}`);
      previous = originGx;
    }
  });

  await t.test('clamping still holds for a fractional centre near an edge', () => {
    const { originGx } = computeCameraOrigin(0.5, 0.5, TILES_WIDE, TILES_TALL, ROOMY);
    assert.equal(originGx, ROOMY.minGx, 'must not show past the cluster edge mid-stride');
    const far = computeCameraOrigin(199.5, 199.5, TILES_WIDE, TILES_TALL, ROOMY);
    assert.equal(far.originGx, ROOMY.maxGx - TILES_WIDE + 1);
  });
});

// ---------------------------------------------------------------------------
// The end-to-end walk simulation
// ---------------------------------------------------------------------------

const WALK_MS = 110;          // mapScreen's WALK_REPEAT_INTERVAL_MS
const WALK_MAX_FRAME_MS = 250;
const WALK_MAX_CATCHUP = 2;
const TILE_PX = 48;
const FRAME_MS = 1000 / 60;

// Replays the real pipeline offline: mapScreen's walk accumulator produces
// steps, the renderer's stride and camera consume them, and what is recorded
// is the hero's position ON SCREEN in px and the map's scroll in px.
//
// `quantisedTarget` reproduces the pre-fix behaviour (camera aimed at the
// hero's logical tile) so the two can be compared in one place, which is what
// makes the assertions below meaningful rather than arbitrary.
function simulateHeldWalk({ smoothingMs, quantisedTarget, frames = 900, warmup = 120 }) {
  let walkAccum = 0;
  let tileGx = 20;
  let heroGx = null;
  let camGx = null;
  const screenPx = [];
  const scrollPx = [];

  for (let i = 0; i < frames; i += 1) {
    walkAccum += Math.min(FRAME_MS, WALK_MAX_FRAME_MS);
    let taken = 0;
    while (walkAccum >= WALK_MS && taken < WALK_MAX_CATCHUP) {
      walkAccum -= WALK_MS;
      taken += 1;
      tileGx += 1;
    }
    if (walkAccum > WALK_MS) walkAccum = 0;

    const hero = heroGx === null ? null : { gx: heroGx, gy: 0 };
    const stride = computeHeroStep(hero, { gx: tileGx, gy: 0 }, smoothingMs > 0 ? WALK_MS : 0, FRAME_MS);
    heroGx = stride.heroGx;

    const centre = quantisedTarget ? tileGx : heroGx;
    const originFn = quantisedTarget ? computeViewportOrigin : computeCameraOrigin;
    const { originGx } = originFn(centre, 0, TILES_WIDE, TILES_TALL, ROOMY);
    const cam = camGx === null ? null : { gx: camGx, gy: 0 };
    camGx = computeCameraStep(cam, { gx: originGx, gy: 0 }, smoothingMs, FRAME_MS).camGx;

    if (i < warmup) continue;   // ignore the mount transient
    screenPx.push((heroGx - camGx) * TILE_PX);
    scrollPx.push(camGx * TILE_PX);
  }
  return { screenPx, scrollPx };
}

// How uneven a series of positions is, frame to frame. A perfectly smooth pan
// moves the identical distance every frame, i.e. spread 0.
function perFrameSpread(series) {
  const deltas = [];
  for (let i = 1; i < series.length; i += 1) deltas.push(series[i] - series[i - 1]);
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length;
  return { mean, spread: Math.sqrt(variance), min: Math.min(...deltas), max: Math.max(...deltas) };
}

test('a held-key walk is smooth on screen, which is the thing being fixed', async (t) => {
  await t.test('the hero barely moves on screen at all - the camera holds them', () => {
    // At a steady walk the character should sit essentially still in the
    // frame while the world slides past. Before the coupling they slid back
    // and forth across ~15px of screen every single step.
    const { screenPx } = simulateHeldWalk({ smoothingMs: 250, quantisedTarget: false });
    const { spread, min, max } = perFrameSpread(screenPx);
    assert.ok(spread < 0.01, `hero's on-screen spread should be ~0, got ${spread.toFixed(3)}px`);
    assert.ok(max - min < 0.05, `hero's on-screen travel per frame should be flat, got ${(max - min).toFixed(3)}px`);
  });

  await t.test('the map scrolls the same distance every frame', () => {
    const { scrollPx } = simulateHeldWalk({ smoothingMs: 250, quantisedTarget: false });
    const { spread, mean } = perFrameSpread(scrollPx);
    assert.ok(mean > 6, `sanity: the map should actually be scrolling, got ${mean.toFixed(3)}px/frame`);
    assert.ok(spread < 0.01, `map scroll spread should be ~0, got ${spread.toFixed(3)}px`);
  });

  await t.test('and the quantised target it replaced is measurably worse at both', () => {
    // Not a fixed threshold: the point is the direction and the size of the
    // gap, so this compares the two directly. If someone points the camera
    // back at the logical tile, this fails.
    const fixed = simulateHeldWalk({ smoothingMs: 250, quantisedTarget: false });
    const before = simulateHeldWalk({ smoothingMs: 250, quantisedTarget: true });
    const heroBefore = perFrameSpread(before.screenPx).spread;
    const heroAfter = perFrameSpread(fixed.screenPx).spread;
    const scrollBefore = perFrameSpread(before.scrollPx).spread;
    const scrollAfter = perFrameSpread(fixed.scrollPx).spread;
    assert.ok(heroBefore > 1, `sanity: the old behaviour really did wobble, got ${heroBefore.toFixed(3)}px`);
    assert.ok(heroAfter * 10 < heroBefore, `hero should be far steadier: ${heroBefore.toFixed(3)} -> ${heroAfter.toFixed(3)}`);
    assert.ok(scrollAfter * 10 < scrollBefore, `scroll should be far steadier: ${scrollBefore.toFixed(3)} -> ${scrollAfter.toFixed(3)}`);
  });

  await t.test('every glide setting benefits, not just the default', () => {
    for (const smoothingMs of [120, 250, 400]) {
      const { screenPx, scrollPx } = simulateHeldWalk({ smoothingMs, quantisedTarget: false });
      assert.ok(perFrameSpread(screenPx).spread < 0.01, `hero wobbled at glide ${smoothingMs}`);
      assert.ok(perFrameSpread(scrollPx).spread < 0.01, `map scroll was uneven at glide ${smoothingMs}`);
    }
  });

  await t.test('glide 0 still means no smoothing anywhere - the pre-canvas feel is untouched', () => {
    // The slider's zero end is documented as reproducing the old DOM
    // renderer exactly: hero and camera both jump a whole tile at once, so
    // the hero never leaves the centre of the frame between steps.
    const { screenPx } = simulateHeldWalk({ smoothingMs: 0, quantisedTarget: false });
    const { spread } = perFrameSpread(screenPx);
    assert.equal(spread, 0, 'at glide 0 the hero must sit exactly still on screen, snapping with the camera');
  });
});

// ---------------------------------------------------------------------------
// The same property, through the real render loop
// ---------------------------------------------------------------------------

// The simulation above replays the pipeline; this drives the actual one.
// Worth having both: every pure function can be individually correct while
// frame() wires them together wrongly, and the wiring IS the fix here (the
// camera has to aim at the hero, and it has to do so after the hero has
// already advanced this frame, not before). Nothing in this file's
// simulation would notice either mistake.
//
// jsdom has no canvas, so getContext('2d') normally returns null and the
// renderer no-ops out of frame() on its first line - which is why the canvas
// renderer has had no integration coverage at all until now. A recording
// stub is enough: none of the camera logic cares what the draw calls do,
// only that the loop runs to completion without throwing.
import { setupDom, teardownDom, createRoot, keydown, keyup } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';

// A plain open field, wider and taller than the default viewport so the
// camera actually has room to pan, and with no neighbours so the cluster is
// this one screen. Synthetic rather than a real wilderness screen on purpose:
// what is under test is the camera, and a real screen would tie the
// assertions to whatever water and trees happen to sit near its start tile.
const FIELD_WIDE = 60;
const FIELD_TALL = 40;
const fieldMap = {
  id: 'field',
  legend: { '.': 'grass' },
  rows: Array.from({ length: FIELD_TALL }, () => '.'.repeat(FIELD_WIDE)),
  startPosition: { x: 5, y: 20 },
  encounterChance: 0,
  cacheChance: 0,
  miniDungeonChance: 0,
  monsterTable: [],
  neighbors: {},
};

function installStubCanvas() {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'canvas') return { width: 1008, height: 624 };
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (prop in target) return target[prop];
      return noop;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  window.HTMLCanvasElement.prototype.getContext = () => ctx;
}

// Replaces requestAnimationFrame with a queue this test drives by hand, so
// frames land at chosen timestamps instead of at jsdom's own pace.
function installManualFrames() {
  // A real queue, not a single slot: mapScreen's walk loop and the renderer's
  // draw loop each hold their own registration at the same time, and the
  // whole subject of this test is how those two interleave. A one-callback
  // stub silently drops whichever registered first, and the character never
  // takes a second step.
  let pending = new Map();
  let nextId = 1;
  global.requestAnimationFrame = (cb) => { const handle = nextId++; pending.set(handle, cb); return handle; };
  global.cancelAnimationFrame = (handle) => { pending.delete(handle); };
  window.requestAnimationFrame = global.requestAnimationFrame;
  window.cancelAnimationFrame = global.cancelAnimationFrame;
  return {
    // Runs the callbacks registered before this frame, at time `now`.
    // Anything they register lands in the next frame, as a browser does it.
    tick(now) {
      const due = pending;
      pending = new Map();
      for (const cb of due.values()) cb(now);
    },
  };
}

test('the real render loop keeps the hero steady on screen while walking', async (t) => {
  t.beforeEach(() => {
    setupDom();
    installStubCanvas();
  });
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('the camera tracks the hero, not the tile they are walking toward', async () => {
    const frames = installManualFrames();
    const { mount } = await import('../js/screens/mapScreen.js');
    const maps = { field: fieldMap };
    const state = { ...createNewGame(), position: { ...fieldMap.startPosition } };
    mount(createRoot(), {
      state, mapConfig: fieldMap, maps, worldGrid: buildWorldGrid(maps),
      debugNoEncounters: true,
      callbacks: { onFirstVisit: () => {}, onMove: () => {}, onWornPathHint: () => {} },
    });

    const { readCameraState } = __testables;
    // mount() only queues the first frame; the camera has no position until
    // that frame actually runs.
    let now = FRAME_MS;
    frames.tick(now);
    assert.notEqual(readCameraState().camGx, null, 'sanity: the stub canvas must have let the renderer paint a frame');

    // Hold a direction and run a couple of seconds of even 60fps frames.
    keydown('ArrowRight');
    const samples = [];
    for (let i = 0; i < 180; i += 1) {
      now += FRAME_MS;
      frames.tick(now);
      const { camGx, heroGx } = readCameraState();
      samples.push({ screen: (heroGx - camGx) * TILE_PX, scroll: camGx * TILE_PX });
    }
    keyup('ArrowRight');

    const settled = samples.slice(60);   // past the start-walking ramp
    const scroll = perFrameSpread(settled.map((s) => s.scroll));
    const screen = perFrameSpread(settled.map((s) => s.screen));

    assert.ok(scroll.mean > 1, `sanity: the camera should be panning, got ${scroll.mean.toFixed(3)}px/frame`);
    assert.ok(
      screen.max - screen.min < 1,
      `the hero should hold their place on screen; travelled ${(screen.max - screen.min).toFixed(3)}px/frame`,
    );
    assert.ok(
      scroll.spread < scroll.mean * 0.1,
      `the map should scroll evenly; spread ${scroll.spread.toFixed(3)}px against a ${scroll.mean.toFixed(3)}px mean`,
    );
  });
});
